/**
 * @summary 마비노기 경매장 데이터 통계 생성 및 정리 Worker
 * @description
 * 이 Worker는 Cron 트리거에 따라 주기적으로 실행되어 4가지 다른 작업을 수행합니다.
 * 1. 시간별 통계 생성 (매시 5분): `price_history` -> `stats_hourly`
 * 2. 일별 통계 롤업 (매일 0시 10분): `stats_hourly` -> `stats_daily`
 * 3. 월별 통계 롤업 (매월 1일 0시 15분): `stats_daily` -> `stats_monthly`
 * 4. 오래된 데이터 삭제 (매일 0시 20분): `price_history`에서 옵션 없는 오래된 데이터 정리
 */

export default {
	/**
	 * 수동 테스트를 위한 fetch 핸들러.
	 * @param {Request} request
	 * @param {object} env
	 * @param {ExecutionContext} ctx
	 */
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		// 수동 트리거를 위한 경로. 예: /?cron=5 * * * *
		if (url.pathname === "/__scheduled") {
			const cron = url.searchParams.get("cron");
			if (!cron) {
				return new Response("Cron parameter is required. e.g., /__scheduled?cron=5+*+*+*+*", { status: 400 });
			}
			ctx.waitUntil(this.scheduled({ cron }, env, ctx));
			return new Response(`Scheduled event for "${cron}" triggered manually. Check logs.`);
		}
		return new Response("This is a scheduled Worker for statistics processing.");
	},

	/**
	 * Cron 트리거에 의해 주기적으로 실행되는 메인 핸들러.
	 * event.cron 속성을 확인하여 4가지 다른 작업을 분기 처리합니다.
	 * @param {object} event - 스케줄 이벤트 정보 (event.cron 포함)
	 * @param {object} env - 워커 환경 변수 (D1 DB 바인딩 등)
	 * @param {ExecutionContext} ctx - 실행 컨텍스트
	 */
	async scheduled(event, env, ctx) {
		const db = env.mabinogi_auction_db;
		const taskStartTime = new Date();
		console.log(`[${taskStartTime.toISOString()}] Triggered with cron: "${event.cron}"`);

		// 작업별 고유 잠금 키 생성
		const lockKey = `STATS_JOB_LOCK:${event.cron.replace(/\s/g, '_')}`;
		const currentLock = await env.MABINOGI_AUCTION_KV.get(lockKey);

		if (currentLock) {
			console.log(`[${taskStartTime.toISOString()}] Cron "${event.cron}"에 대한 다른 작업이 실행 중입니다. (Lock 획득 실패).`);
			return;
		}

		// 작업 유형에 따라 잠금 만료 시간 설정 (시간별: 55분, 그 외: 30분)
		const expirationTtl = event.cron === '5 * * * *' ? 3300 : 1800;
		await env.MABINOGI_AUCTION_KV.put(lockKey, taskStartTime.toISOString(), { expirationTtl });

		try {
			switch (event.cron) {
				// (1) 시간별 통계 생성 (매시 5분)
				case '5 * * * *':
					await this.generateHourlyStats(db, taskStartTime, env);
					break;

				// (2) 일별 통계 롤업 (매일 0시 10분)
				case '10 0 * * *':
					await this.rollupDailyStats(db, taskStartTime, env);
					break;

				// (3) 월별 통계 롤업 (매월 1일 0시 15분)
				case '15 0 1 * *':
					await this.rollupMonthlyStats(db, taskStartTime, env);
					break;

				// (4) 오래된 데이터 삭제 (매일 0시 20분)
				case '20 0 * * *':
					await this.cleanupOldData(db, taskStartTime, env);
					break;

				default:
					console.warn(`No task defined for cron: "${event.cron}"`);
			}
		} catch (error) {
			console.error(`Error during scheduled task for cron "${event.cron}":`, error);
		} finally {
			await env.MABINOGI_AUCTION_KV.delete(lockKey); // 작업 완료 후 잠금 해제
			console.log(`[${new Date().toISOString()}] Finished task for cron: "${event.cron}"`);
		}
	},

	/**
	 * (1) 시간별 통계 생성 (매시 5분)
	 * @param {D1Database} db
	 * @param {Date} now - 현재 실행 시각
	 */
	async generateHourlyStats(db, now, env) {
		console.log("Generating hourly stats...");

		// 통계 생성 대상 시간 버킷 계산 (예: 10:05 실행 -> 09:00:00 버킷)
		const targetHour = new Date(now);
		targetHour.setHours(targetHour.getHours() - 1, 0, 0, 0); // 1시간 전, 분/초/밀리초 초기화

		const startTime = targetHour.toISOString(); // 예: '2023-10-27T09:00:00.000Z'
		const endTime = new Date(targetHour.getTime() + 3599999).toISOString(); // 예: '2023-10-27T09:59:59.999Z'
		const timestampBucket = targetHour.toISOString().replace('T', ' ').substring(0, 19); // 'YYYY-MM-DD HH:00:00'

		console.log(`Time range: ${startTime} to ${endTime}`);

		const query = `
			INSERT INTO stats_hourly (item_id, timestamp, avg_price, transactions, volume)
			SELECT
				item_id,
				?, -- timestampBucket
				CAST(AVG(price) AS INTEGER) as avg_price,
				COUNT(*) as transactions,
				SUM(item_count) as volume
			FROM price_history
			WHERE timestamp >= ? AND timestamp <= ? -- startTime, endTime
			GROUP BY item_id
			ON CONFLICT(item_id, timestamp) DO UPDATE SET
				avg_price = excluded.avg_price,
				transactions = excluded.transactions,
				volume = excluded.volume;
		`;

		const { success, meta } = await db.prepare(query).bind(timestampBucket, startTime, endTime).run();
		console.log(`Hourly stats generation complete. Success: ${success}, Rows written: ${meta.rows_written}`);
	},

	/**
	 * (2) 일별 통계 롤업 (매일 0시 10분)
	 * @param {D1Database} db
	 * @param {Date} now - 현재 실행 시각
	 */
	async rollupDailyStats(db, now, env) {
		console.log("Rolling up daily stats...");

		// 어제 날짜 계산 ('YYYY-MM-DD')
		const yesterday = new Date(now);
		yesterday.setDate(yesterday.getDate() - 1);
		const targetDate = yesterday.toISOString().substring(0, 10);

		console.log(`Target date: ${targetDate}`);

		const query = `
			INSERT INTO stats_daily (item_id, timestamp, avg_price, transactions, volume)
			SELECT
				item_id,
				?, -- targetDate
				CAST(SUM(avg_price * volume) / SUM(volume) AS INTEGER) as avg_price,
				SUM(transactions) as transactions,
				SUM(volume) as volume
			FROM stats_hourly
			WHERE strftime('%Y-%m-%d', timestamp) = ? -- targetDate
			GROUP BY item_id
			ON CONFLICT(item_id, timestamp) DO UPDATE SET
				avg_price = excluded.avg_price,
				transactions = excluded.transactions,
				volume = excluded.volume;
		`;

		const { success, meta } = await db.prepare(query).bind(targetDate, targetDate).run();
		console.log(`Daily stats roll-up complete. Success: ${success}, Rows written: ${meta.rows_written}`);
	},

	/**
	 * (3) 월별 통계 롤업 (매월 1일 0시 15분)
	 * @param {D1Database} db
	 * @param {Date} now - 현재 실행 시각
	 */
	async rollupMonthlyStats(db, now, env) {
		console.log("Rolling up monthly stats...");

		// 지난달 계산 ('YYYY-MM')
		const lastMonth = new Date(now);
		lastMonth.setMonth(lastMonth.getMonth() - 1);
		const targetMonth = lastMonth.toISOString().substring(0, 7);

		console.log(`Target month: ${targetMonth}`);

		const query = `
			INSERT INTO stats_monthly (item_id, timestamp, avg_price, transactions, volume)
			SELECT
				item_id,
				?, -- targetMonth
				CAST(SUM(avg_price * volume) / SUM(volume) AS INTEGER) as avg_price,
				SUM(transactions) as transactions,
				SUM(volume) as volume
			FROM stats_daily
			WHERE strftime('%Y-%m', timestamp) = ? -- targetMonth
			GROUP BY item_id
			ON CONFLICT(item_id, timestamp) DO UPDATE SET
				avg_price = excluded.avg_price,
				transactions = excluded.transactions,
				volume = excluded.volume;
		`;

		const { success, meta } = await db.prepare(query).bind(targetMonth, targetMonth).run();
		console.log(`Monthly stats roll-up complete. Success: ${success}, Rows written: ${meta.rows_written}`);
	},

	/**
	 * (4) 오래된 데이터 삭제 (매일 0시 20분)
	 * @param {D1Database} db
	 * @param {Date} now - 현재 실행 시각
	 */
	async cleanupOldData(db, now, env) {
		console.log("Cleaning up old price history data...");

		// 30일 전 타임스탬프 계산
		const thirtyDaysAgo = new Date(now);
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
		const cutoffTimestamp = thirtyDaysAgo.toISOString();

		console.log(`Deleting data older than: ${cutoffTimestamp}`);

		const query = `
			DELETE FROM price_history
			WHERE timestamp < ?
			AND NOT EXISTS (
				SELECT 1 FROM history_options WHERE history_id = price_history.id
			);
		`;

		const { success, meta } = await db.prepare(query).bind(cutoffTimestamp).run();
		console.log(`Old data cleanup complete. Success: ${success}, Rows deleted: ${meta.rows_written}`);
	},
};
