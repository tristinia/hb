// config.js
module.exports = {
  // API 설정
  API_KEY: process.env.API_KEY || '', // GitHub Secrets에서 설정
  API_BASE_URL: 'https://open.api.nexon.com/mabinogi/v1/auction/list',
  API_DELAY_MS: 250, // 초당 4회 요청 (5회 제한보다 안전)
  MAX_RETRIES: 3, // 오류 발생 시 최대 재시도 횟수
  
  // 데이터 저장 경로
  DATA_DIR: './data',
  ITEMS_DIR: './data/items',
  META_DIR: './data/meta',
  
  // 로그 설정
  LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
  
  // 실행 주기 (GitHub Actions에서 설정)
  // 기본값: 매일 실행
  // 주1회 실행하려면 cron: '0 9 * * 0' (매주 일요일)
};
