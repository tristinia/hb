/**
 * @module mabinogi-auction-history
 *
 * @summary 마비노기 경매장 '거래 완료' 내역을 수집하여 D1 데이터베이스에 저장하는 Cloudflare Worker
 * @description
 * 이 Worker는 5분마다 Cron 트리거로 자동 실행되어 다음 로직을 수행합니다.
 * 1. Cloudflare KV에서 '수집 시간'을 가져옵니다.
 * 2. Nexon API의 '거래 완료 내역' 엔드포인트를 반복 호출하여, 수집 시간 이후의 데이터를 수집합니다.
 *    - 데이터 누락 방지를 위해, 수집 시간과 겹치는 데이터가 포함된 페이지와 그 다음 페이지만큼 추가로 수집합니다.
 * 3. 모든 거래 내역은 `price_history` 테이블에 저장합니다.
 * 4. '옵션 저장 대상'으로 분류된 아이템의 상세 옵션만 `history_options` 테이블에 저장합니다.
 * 5. 데이터베이스 저장이 성공하면, 현재 시간을 새로운 '수집 시간'으로 KV에 갱신합니다.
 */

const NEXON_API_URL = 'https://open.api.nexon.com/mabinogi/v1/auction/history';

// 옵션을 저장하지 않을 아이템 카테고리 목록 (기본적으로 모두 저장). 장비류를 제외한 대부분의 카테고리.
const OPTION_IGNORE_CATEGORIES = [
	'개조석', '기타', '기타 소모품', '기타 스크롤', '기타 장비', '기타 재료', '꼬리',
	'날개', '낭만농장/달빛섬', '던전 통행증', '도면', '로브', '마기그래프',
	'마기그래프 도안', '마리오네트', '마법가루', '마비노벨', '마족 스크롤',
	'말풍선 스티커', '매직 크래프트', '변신 메달', '보석', '불타래', '뷰티 쿠폰',
	'분양 메달', '스케치', '알반 훈련석', '얼굴 장식', '에이도스', '염색 앰플', '옷본',
	'원거리 소모품', '음식', '의자/사물', '인챈트 스크롤', '제련/블랙스미스', '제스처', '주머니', '책',
	'천옷/방직', '유물', '퍼퓸', '페이지', '펫 토템', '포션', '피니 펫', '핀즈비즈', '한손 장비', '허브', '힐웬 공학'
];

// 저장하지 않을 옵션 타입 목록
const IGNORED_OPTION_TYPES = ['아이템 색상', '남은 거래 횟수'];

// 예외 처리 카테고리
const ITEM_NAME_RULES = {
	USE_DISPLAY_NAME_CATEGORIES: ['인챈트 스크롤', '도면', '옷본'],
	PET_MEDAL_CATEGORY: '분양 메달'
};

const KV_LAST_AUCTION_ID_KEY = 'LAST_FETCH_AUCTION_ID';

// 분산 환경에서 중복 실행을 방지하기 위한 잠금 키 (KV)
const CRON_JOB_LOCK_KEY = 'CRON_JOB_LOCK_V1';

export default {
	/**
	 * Cron 트리거에 의해 주기적으로 실행되는 메인 핸들러입니다.
	 * @param {object} event - 스케줄 이벤트 정보
	 * @param {object} env - 워커 환경 변수 및 바인딩 (API 키, D1 DB 등)
	 * @param {ExecutionContext} ctx - 실행 컨텍스트
	 */
	async scheduled(event, env, ctx) {
		const taskStartTime = new Date();

		// KV를 사용한 분산 잠금으로 동시 실행 방지
		const currentLock = await env.MABINOGI_AUCTION_KV.get(CRON_JOB_LOCK_KEY);
		if (currentLock) {
			console.log(`[${taskStartTime.toISOString()}] 다른 작업이 실행 중입니다. (Lock 획득 실패). 이번 작업은 건너뜁니다.`);
			return;
		}

		// 10분 후 만료되는 잠금 설정
		await env.MABINOGI_AUCTION_KV.put(CRON_JOB_LOCK_KEY, taskStartTime.toISOString(), { expirationTtl: 600 });

		console.log(`[${taskStartTime.toISOString()}] 경매장 거래 내역 수집 시작.`);


		// 실제 배포 시에는 Secrets에 등록된 API 키를 사용합니다.
		const apiKey = env.NEXON_API_KEY;
		if (!apiKey) {
			console.error('API 키가 설정되지 않았습니다. Worker 실행을 중단합니다.');
			return;
		}

		try {
			// 1. KV에서 마지막으로 수집한 auction_buy_id를 가져옵니다. (없으면 '0' 사용)
			const lastFetchAuctionId = await env.MABINOGI_AUCTION_KV.get(KV_LAST_AUCTION_ID_KEY) || '0';

			console.log(`저장된 마지막 거래 ID : ${lastFetchAuctionId}`);
			
			// 2. API에서 마지막 거래 ID 이후의 새로운 거래 내역을 가져옵니다.
			const newHistoryItems = await fetchAllAuctionHistory(apiKey, lastFetchAuctionId);

			if (newHistoryItems.length === 0) {
				console.log('새로운 거래 내역이 없습니다.');
				return;
			}

			console.log(`총 ${newHistoryItems.length}개의 새로운 거래 내역을 수집했습니다. 데이터베이스 저장을 시작합니다.`);

			// 3. DB 저장을 위해 시간순(오래된 것 -> 최신)으로 정렬합니다. API는 최신순으로 반환하므로 배열을 뒤집습니다.
			newHistoryItems.reverse();

			// 4. 새로운 데이터를 분류하고 데이터베이스에 저장합니다.
			const dbSuccess = await processAndStoreHistory(env.mabinogi_auction_db, newHistoryItems);

			// 5. 데이터베이스 저장이 성공했을 때만 마지막 거래 ID를 갱신합니다.
			if (dbSuccess) {
				// newHistoryItems 배열은 reverse() 되었으므로, 가장 마지막 요소가 가장 최신 거래입니다.
				const latestAuctionId = newHistoryItems[newHistoryItems.length - 1].auction_buy_id;
				await env.MABINOGI_AUCTION_KV.put(KV_LAST_AUCTION_ID_KEY, latestAuctionId);
				console.log(`성공: 마지막 거래 ID 저장 완료 (${latestAuctionId})`);
				console.log('데이터베이스 저장이 성공적으로 완료되었습니다.');
			} else {
				console.error('데이터베이스 저장 실패. 마지막 거래 ID를 갱신하지 않고 Worker를 종료합니다.');
			}
		} catch (error) {
			console.error('Worker 실행 중 심각한 오류 발생:', error);
		} finally {
			// 작업이 성공하든 실패하든 잠금을 해제합니다.
			await env.MABINOGI_AUCTION_KV.delete(CRON_JOB_LOCK_KEY);
			console.log(`[${taskStartTime.toISOString()}] 경매장 거래 내역 수집 종료.`);
		}
	},
};

/**
 * Exponential Backoff를 사용하여 재시도 로직을 포함한 fetch 함수입니다.
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
				// 응답이 성공적이라도 JSON 파싱이 실패할 수 있으므로, clone하여 확인
				await response.clone().json();
				return response; // 성공
			}
			// 5xx 서버 오류일 때만 재시도
			if (response.status >= 500) {
				console.warn(`API 호출 실패 (시도 ${i + 1}/${retries}): ${response.status}`);
				// 재시도 전 대기 (1초, 2초, 4초...)
				await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
			} else {
				return response; // 4xx 등 클라이언트 오류는 재시도 안 함
			}
		} catch (error) { // 네트워크 오류 또는 JSON 파싱 오류
			console.warn(`네트워크 오류 (시도 ${i + 1}/${retries}):`, error.message);
		if (error.name === 'AbortError') throw error; // AbortError는 재시도하지 않고 즉시 전파
		console.warn(`API 호출 중 오류 발생 (시도 ${i + 1}/${retries}):`, error.message);
		if (i === retries - 1) console.error(`API 호출이 ${retries}번 시도 후 모두 실패했습니다. 마지막 오류:`, error.message);
			await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
		}
	}
	throw new Error(`API 호출이 ${retries}번 시도 후 모두 실패했습니다.`);
}
/**
 * Nexon API를 순차적으로 호출하여 새로운 거래 완료 내역을 가져옵니다.
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
		if (nextPage) { // next_cursor를 사용하여 다음 페이지 요청
			url.searchParams.set('cursor', nextPage); // API 명세에 따라 'cursor' 파라미터 사용
		}

		console.log(`API 호출 중 (${page}페이지)...`);
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
			console.error('API 호출 실패:', { status: response.status, statusText: response.statusText, body: errorBody });
			throw new Error(`API 호출 실패: ${response.status}`);
		}

		const data = await response.json().catch(e => {
			console.error('API 응답 JSON 파싱 실패:', e);
			throw new Error('API 응답이 유효한 JSON이 아닙니다.');
		});

		if (data.auction_history && data.auction_history.length > 0) {
			for (const item of data.auction_history) {
				// 현재 아이템의 ID가 이전에 저장된 ID와 정확히 일치하면, 이미 처리된 데이터이므로 수집 중단
				if (item.auction_buy_id === lastFetchAuctionId) {
					shouldStop = true;
					console.log(`페이지 ${page}에서 이전에 수집한 데이터(ID: ${item.auction_buy_id})를 발견했습니다. API 호출을 중단합니다.`);
					break; // 현재 페이지의 나머지 아이템 처리를 중단
				}
				allItems.push(item);
			}
		} else {
			console.log(`페이지 ${page}에서 더 이상 거래 내역이 없어 API 호출을 중단합니다.`);
			shouldStop = true;
		}

		nextPage = data.next_cursor;
		page++;
		// Cloudflare Workers 환경에서는 I/O 작업 사이에 자동으로 약간의 지연이 발생하므로,
		// 명시적인 짧은 대기(e.g., 10ms)는 일반적으로 불필요합니다.
	} while (nextPage && !shouldStop);

	// API는 데이터를 순차적으로 반환합니다.
	// API에서 반환한 값을 순차적으로 D1에 저장하기 위해서 이후 로직에서 reverse()를 사용합니다.
	return allItems;
}

/**
 * 수집된 거래 내역을 D1 데이터베이스에 저장합니다.
 * @param {D1Database} db - D1 데이터베이스 인스턴스
 * @param {Array} newItems - 필터링된 새로운 거래 내역 배열
 * @returns {Promise<boolean>} 저장 성공 여부
 */
async function processAndStoreHistory(db, newItems) {
	// 1. 아이템 대표 이름과 카테고리 정보를 추출하여 Map 생성
	const representativeNameToItemDataMap = new Map();
	for (const item of newItems) {
		const representativeName = getRepresentativeItemName(item);
		if (!representativeNameToItemDataMap.has(representativeName)) {
			representativeNameToItemDataMap.set(representativeName, { category: item.auction_item_category });
		}
	}

	// 2. DB에서 아이템 ID를 일괄 조회/생성하여 Map으로 받음
	const itemIdMap = await getOrCreateItemIds(db, representativeNameToItemDataMap);

	// 3. 분류된 데이터를 데이터베이스에 일괄 저장합니다.
	return await batchStoreItems(db, newItems, itemIdMap);
}

/**
 * 분류된 데이터를 D1에 일괄 저장합니다.
 * @param {D1Database} db - D1 데이터베이스 인스턴스
 * @param {Array} allItems - 저장할 모든 아이템 목록
 * @param {Map<string, number>} itemIdMap - 아이템 이름과 ID를 매핑한 Map
 * @returns {Promise<boolean>} 저장 성공 여부
 */
async function batchStoreItems(db, allItems, itemIdMap) {
	const priceHistoryStmts = [];
	const historyOptionsStmts = [];
	const hourlyStatsUpdates = new Map();
	const dailyStatsUpdates = new Map();
	const monthlyStatsUpdates = new Map();
	const tablesToCreate = new Map(); // 생성해야 할 월별 테이블 목록

	for (const item of allItems) {
		const representativeName = getRepresentativeItemName(item);
		const itemId = itemIdMap.get(representativeName);
		if (!itemId) continue; // ID를 찾지 못한 경우 건너뛰기

		// 시간별 통계 업데이트 준비
		const kstTimestamp = convertToKST(item.date_auction_buy);
		if (!kstTimestamp) continue;

		// 월별 테이블 이름 생성 (예: price_history_202310)
		const tableSuffix = kstTimestamp.substring(0, 7).replace('-', '');
		const priceHistoryTable = `price_history_${tableSuffix}`;
		const historyOptionsTable = `history_options_${tableSuffix}`;

		// 생성해야 할 테이블 목록에 추가 (중복 방지)
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

			// 통계 집계 함수
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
			priceHistoryStmts.push(
				db.prepare(`INSERT OR IGNORE INTO ${priceHistoryTable} (id, item_id, special_type, price, item_count, timestamp) VALUES (?, ?, ?, ?, ?, ?)`)
				.bind(item.auction_buy_id, itemId, getSpecialType(item.item_display_name), item.auction_price_per_unit, item.item_count, kstTimestamp)
			);

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
	}

	// 통계 업데이트 구문 생성 함수
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
		// 테이블 생성 구문을 가장 먼저 실행
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
				console.log(`${tablesToCreate.size / 2}개의 새로운 월별 테이블 생성 시도...`);
				await db.batch([...tablesToCreate.values()]);
			}
			console.log(`DB 저장 시작: price_history(${priceHistoryStmts.length}), history_options(${historyOptionsStmts.length}), stats_hourly(${statsHourlyStmts.length}), stats_daily(${statsDailyStmts.length}), stats_monthly(${statsMonthlyStmts.length})`);
			await db.batch(allDbOperations); // 데이터 삽입 및 통계 업데이트
		}
		return true;
	} catch (dbError) {
		console.error('D1 데이터베이스 저장 중 심각한 오류 발생:', {
			message: dbError.message, cause: dbError.cause, stack: dbError.stack
		});
		return false;
	}
}





/**
 * 아이템의 대표 이름을 생성합니다. (예외 처리 규칙 적용)
 * @param {object} item - API에서 받은 아이템 객체
 * @returns {string} 생성된 대표 이름
 */
function getRepresentativeItemName(item) {
	const category = item.auction_item_category;

	
	// '분양 메달'은 '아이템 이름 - 펫 종족명' 형식으로 조합
	if (category === ITEM_NAME_RULES.PET_MEDAL_CATEGORY) {
		const options = item.item_option || [];
		const petRaceOption = options.find(opt => opt.option_type === '펫 정보' && opt.option_sub_type === '종족명');
		return petRaceOption && petRaceOption.option_value ? `${item.item_name} - ${petRaceOption.option_value}` : item.item_name;
	}

	// '인챈트 스크롤', '도면', '옷본'은 item_display_name 사용
	if (ITEM_NAME_RULES.USE_DISPLAY_NAME_CATEGORIES.includes(category)) {
		// item_display_name이 없는 경우를 대비하여 item_name을 fallback으로 사용
		return item.item_display_name || item.item_name;
	}

	return item.item_name;
}

/**
 * '신성한/축복받은' 상태를 숫자 코드로 변환합니다.
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
 * 아이템이 '지정 색상'이 포함된 염색 앰플 또는 포션인지 확인합니다.
 * 이 아이템들은 '아이템 색상' 옵션을 무시하지 않고 저장해야 합니다.
 * @param {object} item - API에서 받은 아이템 객체
 * @returns {boolean} '지정 색상' 아이템 여부
 */
function isSpecialColorItem(item) {
    const category = item.auction_item_category;
    const name = item.item_name || '';
    return (category === '염색 앰플' || category === '포션') && name.includes('지정 색상');
}
/**
 * 아이템의 옵션을 저장해야 하는지 동적으로 확인합니다.
 * @param {object} item - API에서 받은 아이템 객체
 * @returns {boolean} 옵션 저장 여부
 */
function shouldSaveOptions(item) {
	const category = item.auction_item_category;
	const name = item.item_name || '';

	// 예외 규칙: 아래 아이템들은 카테고리 무관하게 항상 옵션을 저장합니다.
	if (isSpecialColorItem(item)) return true;
	if (category === '음식' && name.includes('축제 요리')) return true;

	// 일반 규칙: 옵션 저장 제외 카테고리 목록에 포함되면 저장하지 않습니다.
	if (OPTION_IGNORE_CATEGORIES.includes(category)) return false;

	// 기본 규칙: 위의 조건에 해당하지 않는 모든 아이템은 옵션을 저장합니다.
	return true;
}

/**
 * 여러 아이템 이름에 대해 `items` 테이블을 조회하고, 없는 아이템은 새로 생성한 후,
 * { itemName: itemId } 형태의 Map을 반환합니다.
 * @param {D1Database} db - D1 데이터베이스 인스턴스.
 * @param {Map<string, {category: string}>} itemNameToDataMap - 아이템 대표 이름과 데이터(카테고리 등)를 매핑한 Map.
 * @returns {Promise<Map<string, number>>} 아이템 대표 이름과 ID를 매핑한 Map.
 */
async function getOrCreateItemIds(db, itemNameToDataMap) {
	const itemNames = [...itemNameToDataMap.keys()];
	if (itemNames.length === 0) {
		return new Map();
	}

	const itemIdMap = new Map();
	const namesToCreate = [];

	// D1의 `IN` 절은 100개 항목 제한이 있으므로, 안전하게 90개씩 분할 처리
	const CHUNK_SIZE = 90;
	// 1. DB에 이미 존재하는 아이템 ID를 일괄 조회
	for (let i = 0; i < itemNames.length; i += CHUNK_SIZE) {
		const chunk = itemNames.slice(i, i + CHUNK_SIZE);
		if (chunk.length === 0) continue;

		// `IN` 절을 사용하여 한 번의 쿼리로 여러 아이템 조회
		const placeholders = chunk.map(() => '?').join(',');
		const existingItemsStmt = db.prepare(`SELECT id, name FROM items WHERE name IN (${placeholders})`).bind(...chunk);
		try {
			const { results: existingItems } = await existingItemsStmt.all();
			for (const item of existingItems) {
				itemIdMap.set(item.name, item.id);
			}
		} catch (e) {
			console.error(`D1 'IN' 절 조회 실패 (기존 아이템):`, {
				message: e.message, cause: e.cause, stack: e.stack
			});
			throw e; // 조회 실패는 심각한 문제이므로 전파
		}
	}

	// 2. DB에 존재하지 않는 아이템 목록 생성
	for (const name of itemNames) {
		if (!itemIdMap.has(name)) {
			namesToCreate.push(name);
		}
	}

	// 3. 새로 생성해야 할 아이템이 있다면 일괄 INSERT
	if (namesToCreate.length > 0) {
		// 3. RETURNING 절을 사용하여 INSERT와 동시에 생성된 ID를 가져옵니다.
		try {
			const insertStmts = namesToCreate.map(name =>
				db.prepare('INSERT INTO items (name, category) VALUES (?, ?) RETURNING id, name')
				  .bind(name, itemNameToDataMap.get(name)?.category || '기타')
			);
			const results = await db.batch(insertStmts);
			for (const result of results) {
				const newItem = result.results[0];
				itemIdMap.set(newItem.name, newItem.id);
			}
		} catch (e) {
			console.error(`D1 'INSERT ... RETURNING' 실패:`, {
				message: e.message,
				cause: e.cause,
				itemsToCreate: namesToCreate.map(name => ({ name, category: itemNameToDataMap.get(name)?.category }))
			});
			throw e; // 생성 실패는 심각한 문제이므로 전파
		}
	}

	return itemIdMap;
}

/**
 * UTC Date 객체 또는 ISO 문자열을 KST 'YYYY-MM-DD HH:MM:SS' 형식의 문자열로 변환합니다.
 * @param {Date | string} input - 변환할 Date 객체 또는 ISO 문자열
 * @returns {string | null} 'YYYY-MM-DD HH:MM:SS' 형식의 KST 시간 문자열 또는 null (유효하지 않은 입력 시)
 */
function convertToKST(input) {
	if (!input) return null;

	let date;
	if (typeof input === 'string') {
		date = new Date(input); // ISO 문자열은 UTC로 파싱됩니다.
	} else if (input instanceof Date) {
		date = input; // Date 객체는 그대로 사용합니다.
	} else {
		return null;
	}

	// 유효하지 않은 날짜인 경우
	if (isNaN(date.getTime())) {
		return null;
	}

	// Intl.DateTimeFormat을 사용하여 KST로 포맷팅
	const formatter = new Intl.DateTimeFormat('en-CA', { // 'en-CA'는 YYYY-MM-DD 형식을 보장합니다.
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
