/**
 * @module mabinogi-auction-history-cleanup
 *
 * @summary 12개월이 지난 오래된 경매 내역 월별 테이블을 정리하는 Cloudflare Worker
 * @description
 * 이 워커는 Cron 트리거에 의해 매월 1회 자동 실행되어 다음 작업을 수행합니다.
 * 1. D1 데이터베이스에 연결합니다.
 * 2. `price_history_YYYYMM` 및 `history_options_YYYYMM` 형식의 월별 테이블 중
 *    현재 날짜(KST 기준)로부터 12개월 이상 오래된 테이블을 찾아 `DROP TABLE` 명령으로 삭제합니다.
 * 3. 이 과정을 통해 D1 데이터베이스의 쓰기/삭제 비용을 최소화하고 저장 공간을 효율적으로 관리합니다.
 */

// 분산 환경에서 워커의 중복 실행을 방지하기 위한 잠금 키 (Cloudflare KV 사용)
const CRON_JOB_LOCK_KEY = 'CRON_JOB_LOCK_CLEANUP_V1';

export default {
	/**
	 * Cron 트리거에 의해 주기적으로 실행되는 메인 핸들러입니다.
	 * @param {object} event - 스케줄 이벤트 정보
	 * @param {object} env - 워커 환경 변수 및 바인딩 (D1 DB, KV 등)
	 * @param {ExecutionContext} ctx - 실행 컨텍스트 (waitUntil 등을 위해 사용)
	 */
	async scheduled(event, env, ctx) {
		const taskStartTime = new Date();

		// KV를 사용하여 분산 환경에서 동시 실행을 방지합니다.
		const currentLock = await env.MABINOGI_AUCTION_KV.get(CRON_JOB_LOCK_KEY);
		if (currentLock) {
			console.log(`[${taskStartTime.toISOString()}] 다른 정리 작업이 실행 중입니다. (Lock 획득 실패). 이번 작업은 건너뜁니다.`);
			return;
		}

		// 현재 작업이 시작되었음을 알리는 잠금을 설정합니다. (1시간 후 자동 만료)
		await env.MABINOGI_AUCTION_KV.put(CRON_JOB_LOCK_KEY, taskStartTime.toISOString(), { expirationTtl: 3600 });

		console.log(`[${taskStartTime.toISOString()}] 오래된 경매 내역 테이블 정리 시작.`);

		try {
			// 12개월이 지난 오래된 월별 테이블을 정리합니다.
			await manageOldTables(env.mabinogi_auction_db);
		} catch (error) {
			console.error('테이블 정리 작업 중 심각한 오류가 발생했습니다:', error);
		} finally {
			// 작업이 성공하든 실패하든 잠금을 해제합니다.
			await env.MABINOGI_AUCTION_KV.delete(CRON_JOB_LOCK_KEY);
			console.log(`[${taskStartTime.toISOString()}] 오래된 경매 내역 테이블 정리 종료.`);
		}
	},
};

/**
 * 12개월 이상 오래된 월별 테이블을 찾아 삭제하는 함수입니다.
 * @param {D1Database} db - D1 데이터베이스 인스턴스
 */
async function manageOldTables(db) {
	console.log('오래된 월별 테이블 정리 시작...');
	try { 
		const now = new Date(); // 현재 UTC 시간
		// KST(한국 시간) 기준으로 현재 날짜를 가져옵니다.
		const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
		// 삭제 기준이 될 12개월 전의 년/월을 계산합니다.
		kstNow.setMonth(kstNow.getMonth() - 13); 
		const cutoffYear = kstNow.getFullYear(); 
		const cutoffMonth = kstNow.getMonth() + 1; // getMonth()는 0-11을 반환하므로 +1 해줍니다.
		const cutoffSuffix = `${cutoffYear}${String(cutoffMonth).padStart(2, '0')}`;

		// D1의 sqlite_master 테이블에서 'price_history_' 또는 'history_options_'로 시작하는 테이블 목록을 조회합니다.
		const { results: tables } = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'price_history_%' OR name LIKE 'history_options_%')").all();

		if (!tables || tables.length === 0) {
			console.log('정리할 월별 테이블이 없습니다.');
			return;
		}

		const dropStmts = [];
		const tablePattern = /_(20\d{2})(0[1-9]|1[0-2])$/; // 테이블 이름에서 YYYYMM 형식의 접미사를 추출하기 위한 정규식

		for (const table of tables) {
			const match = table.name.match(tablePattern); // 테이블 이름에서 YYYYMM 부분 추출
			// 테이블 이름의 YYYYMM 접미사가 삭제 기준(cutoffSuffix)보다 작거나 같으면 삭제 대상입니다.
			if (match && (match[1] + match[2]) <= cutoffSuffix) {
				console.log(`삭제 대상 테이블 발견: ${table.name}`);
				dropStmts.push(db.prepare(`DROP TABLE ${table.name}`));
			}
		}

		if (dropStmts.length > 0) {
			console.log(`${dropStmts.length}개의 오래된 테이블을 삭제합니다.`);
			await db.batch(dropStmts);
			console.log('오래된 테이블 삭제 완료.');
		} else {
			console.log('삭제할 오래된 테이블이 없습니다.');
		} // catch 블록에서 오류 발생 시 상위 핸들러로 전파
	} catch (error) {
		console.error('오래된 테이블 정리 중 오류 발생:', { message: error.message, cause: error.cause });
		throw error; // 오류 발생 시 상위 핸들러로 전파
	}
}
