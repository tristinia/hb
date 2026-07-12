/**
 * @module mabinogi-auction-history
 *
 * @summary 마비노기 경매장 '거래 완료' 내역 수집 및 D1 저장 Worker
 * @description
 * 5분마다 Cron 트리거로 자동 실행
 * 1. KV에서 마지막으로 수집한 거래 ID 조회
 * 2. Nexon API '거래 완료 내역' 엔드포인트 반복 호출, 마지막 거래 ID 이후 데이터 수집
 *    - 마지막으로 수집한 거래 발견 시 API 호출 중단
 * 3. mabinogi-metadata-processor의 `/items/upsert`를 Service Binding으로 await 호출하여
 *    이번 사이클의 아이템 전체에 대한 item_id를 일괄 수신 (실패 시 사이클 전체 스킵)
 * 4. 수집된 거래 내역을 월별 파티션 테이블(`price_history_YYYYMM`, `history_options_YYYYMM`)에 저장
 * 5. 아이템 통계(시간별, 일별, 월별) 집계 및 업데이트
 * 6. 데이터베이스 저장 성공 시에만, 메타데이터 프로세서의 `/items`(검색 인덱스 등 KV 캐시 갱신)를
 *    Fire-and-forget으로 호출
 * 7. 데이터베이스 저장 성공 시에만, 가장 최근 거래 ID를 KV에 갱신
 */

const NEXON_API_URL = 'https://open.api.nexon.com/mabinogi/v1/auction/history';

// 옵션 저장 제외 카테고리 목록 (기본적으로 모두 저장, 장비류 제외 대부분 카테고리)
const OPTION_IGNORE_CATEGORIES = [
	'개조석', '기타', '기타 소모품', '기타 스크롤', '기타 장비', '기타 재료', '꼬리',
	'날개', '낭만농장/달빛섬', '던전 통행증', '도면', '로브', '마기그래프',
	'마기그래프 도안', '마리오네트', '마법가루', '마비노벨', '마족 스크롤',
	'말풍선 스티커', '매직 크래프트', '변신 메달', '보석', '불타래', '뷰티 쿠폰',
	'분양 메달', '스케치', '알반 훈련석', '얼굴 장식', '에이도스', '염색 앰플', '옷본',
	'원거리 소모품', '음식', '의자/사물', '인챈트 스크롤', '제련/블랙스미스', '제스처', '주머니', '책',
	'천옷/방직', '유물', '퍼퓸', '페이지', '펫 토템', '포션', '피니 펫', '핀즈비즈', '한손 장비', '허브', '힐웬 공학'
];

// 저장 제외 옵션 타입 목록
const IGNORED_OPTION_TYPES = ['아이템 색상', '남은 거래 횟수'];

const KV_LAST_AUCTION_ID_KEY = 'LAST_FETCH_AUCTION_ID';

// 메타데이터 프로세서 /items/upsert 호출 설정
// 캐치업(장애 복구 등으로 대량 수집) 시 한 번에 수천 건을 단일 호출로 보내면
// metadata-processor의 D1 배치 처리 시간이 늘어나 타임아웃/한도 문제가 생길 수 있어,
// 청크 단위로 순차 호출하고 청크 크기에 비례해 타임아웃도 늘림
const METADATA_UPSERT_CHUNK_SIZE = 500;
const METADATA_UPSERT_BASE_TIMEOUT_MS = 10000;
const METADATA_UPSERT_PER_ITEM_TIMEOUT_MS = 15;

// 분산 환경 중복 실행 방지용 잠금 키 (KV)
const CRON_JOB_LOCK_KEY = 'CRON_JOB_LOCK_V1';

export default {
	/**
	 * Cron 트리거에 의해 주기적으로 실행되는 메인 핸들러
	 * @param {object} event - 스케줄 이벤트 정보
	 * @param {object} env - 워커 환경 변수 및 바인딩 (API 키, D1 DB 등)
	 * @param {ExecutionContext} ctx - 실행 컨텍스트
	 */
	async scheduled(event, env, ctx) {
		const taskStartTime = new Date();

		// KV를 사용한 분산 잠금으로 동시 실행 방지
		const currentLock = await env.MABINOGI_AUCTION_KV.get(CRON_JOB_LOCK_KEY);
		if (currentLock) {
			console.log(`[${taskStartTime.toISOString()}] 다른 작업 실행 중 (Lock 획득 실패), 이번 작업 건너뛰기`);
			return;
		}

		// 10분 후 만료되는 잠금 설정
		await env.MABINOGI_AUCTION_KV.put(CRON_JOB_LOCK_KEY, taskStartTime.toISOString(), { expirationTtl: 600 });

		console.log(`[${taskStartTime.toISOString()}] 경매장 거래 내역 수집 시작.`);


		const apiKey = env.NEXON_API_KEY;
		if (!apiKey) {
			console.error('API 키 미설정, Worker 실행 중단');
			return;
		}

		try {
			// KV에서 마지막으로 수집한 auction_buy_id 조회 (기본값 '0')
			const lastFetchAuctionId = await env.MABINOGI_AUCTION_KV.get(KV_LAST_AUCTION_ID_KEY) || '0';

			console.log(`저장된 마지막 거래 ID : ${lastFetchAuctionId}`);
			
			// API에서 마지막 거래 ID 이후의 새로운 거래 내역 조회
			const newHistoryItems = await fetchAllAuctionHistory(apiKey, lastFetchAuctionId);

			if (newHistoryItems.length === 0) {
				console.log('새로운 거래 내역 없음');
				return;
			}

			console.log(`총 ${newHistoryItems.length}개의 새로운 거래 내역 수집, 데이터베이스 저장 시작`);

			// DB 저장을 위해 시간순(오래된 것 -> 최신)으로 정렬, API는 최신순으로 반환하므로 배열 뒤집기
			newHistoryItems.reverse();

			// 메타데이터 프로세서에 이번 사이클의 아이템 전체를 일괄 upsert 요청, item_id를 수신
			// 실패 시(네트워크 오류/타임아웃/비정상 응답 등) 이번 사이클 전체를 스킵, 커서 미갱신
			// -> 다음 5분 cron이 동일 구간을 통째로 재시도 (D1 INSERT OR IGNORE로 재시도는 멱등)
			const upsertResults = await upsertItemsViaMetadataProcessor(env, newHistoryItems);
			if (!upsertResults) {
				console.error(`메타데이터 프로세서 아이템 upsert 실패로 이번 사이클(${newHistoryItems.length}건) 스킵, 커서 미갱신`);
				return;
			}

			// upsertResults는 newHistoryItems와 동일한 순서/길이이므로 인덱스로 item_id/대표 이름을 각 아이템에 결합
			newHistoryItems.forEach((item, i) => {
				item.item_id = upsertResults[i].item_id;
				item.representative_name = upsertResults[i].representative_name;
			});

			// 분류된 데이터를 데이터베이스에 일괄 저장
			const dbSuccess = await batchStoreItems(env.mabinogi_auction_db, newHistoryItems);

			// 데이터베이스 저장 성공 시에만 메타데이터 캐시 갱신 및 마지막 거래 ID 갱신
			if (dbSuccess) {
				if (env.METADATA_PROCESSOR) {
					// 검색 인덱스 등 KV 메타데이터 캐시 갱신 (Fire and Forget)
					// item.representative_name은 위에서 이미 결합했으므로 별도 가공 없이 그대로 전달
					ctx.waitUntil(
						env.METADATA_PROCESSOR.fetch('https://metadata-processor/items', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(newHistoryItems)
						}).catch(err => console.error('메타데이터 프로세서 호출 실패:', err))
					);
					console.log(`${newHistoryItems.length}개 아이템을 메타데이터 프로세서로 전송`);
				}

				// newHistoryItems 배열은 reverse() 되었으므로, 가장 마지막 요소가 가장 최신 거래
				const latestAuctionId = newHistoryItems[newHistoryItems.length - 1].auction_buy_id;
				ctx.waitUntil(env.MABINOGI_AUCTION_KV.put(KV_LAST_AUCTION_ID_KEY, latestAuctionId));
				console.log(`성공: 마지막 거래 ID 저장 완료 (${latestAuctionId})`);
				console.log('데이터베이스 저장 성공적으로 완료');
			} else {
				console.error('데이터베이스 저장 실패, 마지막 거래 ID 갱신 없이 Worker 종료');
			}

		} catch (error) {
			console.error('Worker 실행 중 심각한 오류 발생', error);
		} finally {
			// 작업 성공 여부와 관계없이 잠금 해제
			await env.MABINOGI_AUCTION_KV.delete(CRON_JOB_LOCK_KEY);
			console.log(`[${taskStartTime.toISOString()}] 경매장 거래 내역 수집 종료.`);
		}
	},
};

/**
 * Exponential Backoff를 사용한 재시도 로직 포함 fetch 함수
 * @param {string} url - 요청할 URL
 * @param {object} options - fetch 옵션
 * @param {number} retries - 최대 재시도 횟수
 * @param {number} delay - 초기 대기 시간 (ms)
 * @returns {Promise<Response>} fetch 응답
 */
async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
	for (let i = 0; i < retries; i++) {
		try {
			const response = await fetch(url, options);
			if (response.ok) {
				// 응답이 성공적이라도 JSON 파싱 실패 가능성 있으므로 clone하여 확인
				await response.clone().json();
				return response; // 성공
			}
			// 5xx 서버 오류 시에만 재시도
			if (response.status >= 500) {
				console.warn(`API 호출 실패 (시도 ${i + 1}/${retries})`, response.status);
				// 재시도 전 대기 (1초, 2초, 4초...)
				await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
			} else {
				return response; // 4xx 등 클라이언트 오류는 재시도 없음
			}
		} catch (error) { // 네트워크 오류, JSON 파싱 오류, 타임아웃 등
			if (error.name === 'AbortError') throw error; // AbortError는 재시도 없이 즉시 전파
			
			console.warn(`API 호출 또는 파싱 중 오류 발생 (시도 ${i + 1}/${retries})`, error.message);
			if (i === retries - 1) throw new Error(`API 호출이 ${retries}번 시도 후 모두 실패, 마지막 오류: ${error.message}`);
			await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
		}
	}
	throw new Error(`API 호출이 ${retries}번 시도 후 모두 실패`);
}
/**
 * Nexon API를 순차적으로 호출하여 새로운 거래 완료 내역 조회
 * @param {string} apiKey - Nexon Open API 키
 * @param {string} lastFetchAuctionId - 마지막으로 수집한 거래 ID (auction_buy_id)
 * @returns {Promise<Array>} 모든 신규 거래 내역 아이템 배열
 */
async function fetchAllAuctionHistory(apiKey, lastFetchAuctionId) {
	let allItems = [];
	let nextPage = null;
	let page = 1;
	let shouldStop = false;
	
	const url = new URL(NEXON_API_URL);

	do {
		if (nextPage) { // next_cursor로 다음 페이지 요청
			url.searchParams.set('cursor', nextPage); // API 명세에 따라 'cursor' 파라미터 사용
		}

		console.log(`API 호출 중 (${page}페이지)`);
		const response = await fetchWithRetry(url.toString(), {
			headers: { 'accept': 'application/json', 'x-nxopen-api-key': apiKey }
		});

		if (!response.ok) {
			let errorBody;
			try {
				errorBody = await response.json();
			} catch (e) {
				errorBody = await response.text();
			}
			console.error('API 호출 실패', { status: response.status, statusText: response.statusText, body: errorBody });
			throw new Error(`API 호출 실패: ${response.status}`);
		}

		const data = await response.json().catch(e => {
			console.error('API 응답 JSON 파싱 실패', e);
			throw new Error('API 응답이 유효한 JSON이 아님');
		});

		if (data?.auction_history?.length > 0) {
			for (const item of data.auction_history) {
				// 현재 아이템 ID가 마지막으로 저장된 ID와 일치하면, 이미 처리된 데이터이므로 수집 중단
				if (item.auction_buy_id === lastFetchAuctionId) {
					shouldStop = true;
					console.log(`페이지 ${page}에서 이전에 수집한 데이터(ID: ${item.auction_buy_id}) 발견, API 호출 중단`);
					break; // 현재 페이지의 나머지 아이템 처리 중단
				}
				allItems.push(item);
			}
		} else {
			console.log(`페이지 ${page}에서 더 이상 거래 내역이 없어 API 호출 중단`);
			shouldStop = true;
		}

		nextPage = data.next_cursor;
		page++;
		// Cloudflare Workers 환경에서는 I/O 작업 사이에 자동 지연이 발생하므로,
		// 명시적인 짧은 대기(e.g., 10ms)는 불필요
	} while (nextPage && !shouldStop);

	
	// API에서 반환한 값을 순차적으로 D1에 저장하기 위해 이후 로직에서 reverse() 사용
	return allItems;
}

/**
 * 메타데이터 프로세서의 `/items/upsert`를 Service Binding으로 호출하여
 * 이번 사이클 아이템 전체의 item_id/대표 이름을 일괄 수신.
 * 아이템 수가 많으면(캐치업 등) METADATA_UPSERT_CHUNK_SIZE 단위로 나눠 순차 호출
 * @param {object} env - 워커 환경 변수 및 바인딩
 * @param {Array} items - 원본 거래 내역 아이템 배열
 * @returns {Promise<Array<{representative_name: string, category: string, item_id: number|null, isNew: boolean}>|null>}
 *   items와 동일한 순서/길이의 결과 배열, 청크 중 하나라도 실패하면 전체 null (사이클 전체 스킵)
 */
async function upsertItemsViaMetadataProcessor(env, items) {
	if (!env.METADATA_PROCESSOR) {
		console.error('METADATA_PROCESSOR 서비스 바인딩 미설정');
		return null;
	}

	const totalChunks = Math.ceil(items.length / METADATA_UPSERT_CHUNK_SIZE);
	const allResults = [];

	for (let i = 0; i < items.length; i += METADATA_UPSERT_CHUNK_SIZE) {
		const chunk = items.slice(i, i + METADATA_UPSERT_CHUNK_SIZE);
		const chunkIndex = Math.floor(i / METADATA_UPSERT_CHUNK_SIZE) + 1;

		const chunkResults = await upsertItemsChunk(env, chunk, chunkIndex, totalChunks);
		if (!chunkResults) {
			return null; // 청크 하나라도 실패하면 전체 실패로 취급
		}
		allResults.push(...chunkResults);
	}

	return allResults;
}

/**
 * `/items/upsert`에 아이템 청크 1개를 호출. 청크 크기에 비례해 타임아웃을 늘림
 * @param {object} env - 워커 환경 변수 및 바인딩
 * @param {Array} chunk - 이번 호출로 보낼 아이템 청크
 * @param {number} chunkIndex - 1부터 시작하는 청크 순번 (로그용)
 * @param {number} totalChunks - 전체 청크 수 (로그용)
 * @returns {Promise<Array|null>} chunk와 동일한 순서/길이의 결과 배열, 실패 시 null
 */
async function upsertItemsChunk(env, chunk, chunkIndex, totalChunks) {
	const startTime = new Date();
	const timeoutMs = METADATA_UPSERT_BASE_TIMEOUT_MS + chunk.length * METADATA_UPSERT_PER_ITEM_TIMEOUT_MS;
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	const chunkLabel = `${chunkIndex}/${totalChunks}`;

	try {
		const response = await env.METADATA_PROCESSOR.fetch('https://metadata-processor/items/upsert', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(chunk),
			signal: controller.signal
		});

		if (!response.ok) {
			const body = await response.text().catch(() => '');
			console.error('메타데이터 프로세서 items/upsert 응답 실패', {
				time: startTime.toISOString(), reason: `HTTP ${response.status}`, chunk: chunkLabel, itemCount: chunk.length, body
			});
			return null;
		}

		const results = await response.json();
		if (!Array.isArray(results) || results.length !== chunk.length) {
			console.error('메타데이터 프로세서 items/upsert 응답 형식 불일치', {
				time: startTime.toISOString(), chunk: chunkLabel, itemCount: chunk.length,
				resultCount: Array.isArray(results) ? results.length : typeof results
			});
			return null;
		}

		return results;
	} catch (error) {
		const reason = error.name === 'AbortError' ? `타임아웃(${timeoutMs}ms)` : error.message;
		console.error('메타데이터 프로세서 items/upsert 호출 중 오류 발생', {
			time: startTime.toISOString(), reason, chunk: chunkLabel, itemCount: chunk.length
		});
		return null;
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * 분류된 데이터를 D1에 일괄 저장
 * @param {D1Database} db - D1 데이터베이스 인스턴스
 * @param {Array} allItems - 저장할 모든 아이템 목록 (각 아이템은 item_id가 이미 결합되어 있어야 함)
 * @returns {Promise<boolean>} 저장 성공 여부
 */
async function batchStoreItems(db, allItems) {
	const priceHistoryStmts = [];
	const historyOptionsStmts = [];
	const hourlyStatsUpdates = new Map();
	const dailyStatsUpdates = new Map();
	const monthlyStatsUpdates = new Map();
	const tablesToCreate = new Map(); // 생성할 월별 테이블 목록

	for (const item of allItems) {
		const itemId = item.item_id;
		if (!itemId) continue; // ID 조회 실패 시 건너뛰기

		// 통계 업데이트 준비
		const kstTimestamp = convertToKST(item.date_auction_buy);
		if (!kstTimestamp) continue;

		// 월별 테이블 이름 생성 (예: price_history_202310)
		const tableSuffix = kstTimestamp.substring(0, 7).replace('-', '');
		const priceHistoryTable = `price_history_${tableSuffix}`;
		const historyOptionsTable = `history_options_${tableSuffix}`;

		// 생성할 테이블 목록에 추가 (중복 방지)
		if (!tablesToCreate.has(priceHistoryTable)) {
			tablesToCreate.set(priceHistoryTable, db.prepare(`
				CREATE TABLE IF NOT EXISTS ${priceHistoryTable} (
					id TEXT PRIMARY KEY, item_id INTEGER NOT NULL, special_type INTEGER DEFAULT 0, price INTEGER NOT NULL, item_count INTEGER NOT NULL, timestamp TEXT NOT NULL
				)
			`));
			tablesToCreate.set(historyOptionsTable, db.prepare(`CREATE TABLE IF NOT EXISTS ${historyOptionsTable} (history_id TEXT, type TEXT, sub_type TEXT, value TEXT, value2 TEXT, PRIMARY KEY (history_id, type, sub_type, value, value2)) WITHOUT ROWID`));
		}

		if (kstTimestamp) {
			const price = item.auction_price_per_unit * item.item_count;
			const volume = item.item_count;

			// 통계 집계
			const aggregateStats = (map, key, bucket) => {
				if (!map.has(key)) {
					map.set(key, { itemId, timestampBucket: bucket, totalPrice: 0, transactions: 0, totalVolume: 0 });
				}
				const stats = map.get(key);
				stats.totalPrice += price;
				stats.transactions += 1;
				stats.totalVolume += volume;
			};

			// 시간별, 일별, 월별 통계 집계
			const hourlyBucket = `${kstTimestamp.slice(0, 13)}:00:00`;
			aggregateStats(hourlyStatsUpdates, `${itemId}|${hourlyBucket}`, hourlyBucket);

			const dailyBucket = kstTimestamp.slice(0, 10);
			aggregateStats(dailyStatsUpdates, `${itemId}|${dailyBucket}`, dailyBucket);

			const monthlyBucket = kstTimestamp.slice(0, 7);
			aggregateStats(monthlyStatsUpdates, `${itemId}|${monthlyBucket}`, monthlyBucket);
		}

		// 옵션 저장 대상 아이템인 경우에만 옵션 저장
		if (shouldSaveOptions(item) && item.item_option?.length > 0) {
			const isCurrentItemSpecialColor = isSpecialColorItem(item);
			for (const option of item.item_option) {
				if (IGNORED_OPTION_TYPES.includes(option.option_type) && !(isCurrentItemSpecialColor && option.option_type === '아이템 색상')) {
					continue;
				}
				historyOptionsStmts.push(
					db.prepare(`INSERT OR IGNORE INTO ${historyOptionsTable} (history_id, type, sub_type, value, value2) VALUES (?, ?, ?, ?, ?)`)
						.bind(item.auction_buy_id, option.option_type, option.option_sub_type, option.option_value, option.option_value2)
				);
			}
		}

		if (shouldSaveOptions(item)) { // 옵션 저장 대상 아이템은 가격 내역도 항상 저장
			priceHistoryStmts.push(db.prepare(`INSERT OR IGNORE INTO ${priceHistoryTable} (id, item_id, special_type, price, item_count, timestamp) VALUES (?, ?, ?, ?, ?, ?)`)
				.bind(item.auction_buy_id, itemId, getSpecialType(item.item_display_name), item.auction_price_per_unit, item.item_count, kstTimestamp));
		}
	}

	// 통계 업데이트 구문 생성
	const createStatsStmts = (map, tableName) => {
		const stmts = [];
		for (const stats of map.values()) {
			stmts.push(
				db.prepare(`
				INSERT INTO ${tableName} (item_id, timestamp, total_price, transactions, total_volume)
				VALUES (?, ?, ?, ?, ?)
				ON CONFLICT(item_id, timestamp) DO UPDATE SET
					total_price = total_price + excluded.total_price,
					transactions = transactions + excluded.transactions,
					total_volume = total_volume + excluded.total_volume
			`).bind(stats.itemId, stats.timestampBucket, stats.totalPrice, stats.transactions, stats.totalVolume)
			);
		}
		return stmts;
	};

	try {
		const statsHourlyStmts = createStatsStmts(hourlyStatsUpdates, 'stats_hourly');
		const statsDailyStmts = createStatsStmts(dailyStatsUpdates, 'stats_daily');
		const statsMonthlyStmts = createStatsStmts(monthlyStatsUpdates, 'stats_monthly');

		// 모든 DB 작업을 하나의 배열로 통합
		const allDbOperations = [
			...priceHistoryStmts, 
			...historyOptionsStmts, 
			...statsHourlyStmts, 
			...statsDailyStmts, 
			...statsMonthlyStmts
		];

		if (allDbOperations.length > 0) {
			// 테이블 생성 D1 batch 실행
			if (tablesToCreate.size > 0) {
				console.log(`${tablesToCreate.size / 2}개의 새로운 월별 테이블 생성 시도`);
				await db.batch([...tablesToCreate.values()]);
			}
			console.log(`DB 저장 시작: price_history(${priceHistoryStmts.length}), history_options(${historyOptionsStmts.length}), stats_hourly(${statsHourlyStmts.length}), stats_daily(${statsDailyStmts.length}), stats_monthly(${statsMonthlyStmts.length})`);
			await db.batch(allDbOperations); // 데이터 삽입 및 통계 업데이트
		}
		return true;
	} catch (dbError) {
		console.error('D1 데이터베이스 저장 중 심각한 오류 발생', {
			message: dbError.message, cause: dbError.cause, stack: dbError.stack
		});
		return false;
	}
}

/**
 * '신성한/축복받은' 상태를 숫자 코드로 변환
 * @param {string} displayName - 아이템의 item_display_name
 * @returns {number} 2: 신성한, 1: 축복받은, 0: 해당 없음
 */
function getSpecialType(displayName) {
	if (!displayName) return 0;
	if (displayName.startsWith('신성한 ')) return 2;
	if (displayName.startsWith('축복받은 ')) return 1;
	return 0;
}

/**
 * 아이템이 '지정 색상'이 포함된 염색 앰플 또는 포션인지 확인
 * 이 아이템들은 '아이템 색상' 옵션을 무시하지 않고 저장
 * @param {object} item - API에서 받은 아이템 객체
 * @returns {boolean} '지정 색상' 아이템 여부
 */
function isSpecialColorItem(item) {
    const category = item.auction_item_category;
    const name = item.item_name || '';
    return (category === '염색 앰플' || category === '포션') && name.includes('지정 색상');
}
/**
 * 아이템의 옵션 저장 여부 동적 확인
 * @param {object} item - API에서 받은 아이템 객체
 * @returns {boolean} 옵션 저장 여부
 */
function shouldSaveOptions(item) {
	const category = item.auction_item_category;
	const name = item.item_name || '';

	// 예외 규칙: 아래 아이템들은 카테고리 무관하게 항상 옵션 저장
	if (isSpecialColorItem(item)) return true;
	if (category === '음식' && name.includes('축제 요리')) return true;

	// 일반 규칙: 옵션 저장 제외 카테고리 목록에 포함되면 저장 안 함
	if (OPTION_IGNORE_CATEGORIES.includes(category)) return false;

	// 기본 규칙: 위 조건에 해당하지 않는 모든 아이템은 옵션 저장
	return true;
}

/**
 * UTC Date 객체 또는 ISO 문자열을 KST 'YYYY-MM-DD HH:MM:SS' 형식의 문자열로 변환
 * @param {Date | string} input - 변환할 Date 객체 또는 ISO 문자열
 * @returns {string | null} 'YYYY-MM-DD HH:MM:SS' 형식의 KST 시간 문자열 또는 null (유효하지 않은 입력 시)
 */
function convertToKST(input) {
	if (!input) return null;

	let date;
	if (typeof input === 'string') {
		date = new Date(input); // ISO 문자열은 UTC로 파싱
	} else if (input instanceof Date) {
		date = input; // Date 객체는 그대로 사용
	} else {
		return null;
	}

	// 유효하지 않은 날짜
	if (isNaN(date.getTime())) {
		return null;
	}

	// Intl.DateTimeFormat을 사용해 KST로 포맷팅
	const formatter = new Intl.DateTimeFormat('en-CA', { // 'en-CA'는 YYYY-MM-DD 형식 보장
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false, // 24시간 형식
		timeZone: 'Asia/Seoul'
	});

	return formatter.format(date).replace(/, /g, ' ');
}
