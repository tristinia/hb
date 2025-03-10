// src/config.js - 시스템 설정
module.exports = {
  // API 설정
  API_KEY: process.env.API_KEY,
  API_BASE_URL: 'https://open.api.nexon.com/mabinogi/v1/auction/list',
  API_DELAY_MS: 250, // 초당 4회 이하로 요청 (안전하게)
  MAX_RETRIES: 3,    // 최대 재시도 횟수
  
  // 데이터 설정
  DATA_DIR: './data',
  
  // 오류 설정
  CONSECUTIVE_ERROR_THRESHOLD: 3, // 연속 오류 임계값
  MAX_PAGES_PER_CATEGORY: 100,    // 카테고리당 최대 페이지 수
  
  // 로깅 설정
  VERBOSE: true, // 상세 로깅 활성화
};
