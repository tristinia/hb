// src/api-client.js - API 호출 담당

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { promisify } = require('util');
const config = require('./config');

const sleep = promisify(setTimeout);

// API 호출 상태
const state = {
  apiCalls: 0,
  errors: 0,
  consecutiveErrors: 0
};

/**
 * API 호출 함수
 * @param {string} categoryId - 카테고리 ID
 * @param {string} cursor - 다음 페이지 커서
 * @param {number} retryCount - 재시도 횟수
 * @returns {Promise<Object>}
 */
async function callApi(categoryId, cursor = null, retryCount = 0) {
  try {
    // API 키 확인
    if (!config.API_KEY) {
      throw new Error('API 키가 설정되지 않았습니다.');
    }
    
    // API 딜레이 적용
    await sleep(config.API_DELAY_MS);
    
    // URL 및 파라미터 설정
    const params = new URLSearchParams({
      auction_item_category: categoryId
    });
    
    // 커서가 있으면 추가
    if (cursor) {
      params.append('cursor', cursor);
    }
    
    // API 호출
    const url = `${config.API_BASE_URL}?${params.toString()}`;
    const response = await axios.get(url, {
      headers: {
        'accept': 'application/json',
        'x-nxopen-api-key': config.API_KEY
      },
      timeout: 10000 // 10초 타임아웃
    });
    
    // API 호출 카운트 증가
    state.apiCalls++;
    
    // 연속 오류 카운트 초기화
    state.consecutiveErrors = 0;
    
    return {
      items: response.data.auction_item || [],
      next_cursor: response.data.next_cursor
    };
  } catch (error) {
    // 오류 카운트 증가
    state.errors++;
    state.consecutiveErrors++;
    
    // 오류 정보 추출
    const status = error.response?.status;
    const errorCode = error.response?.data?.error?.name;
    const errorMessage = error.response?.data?.error?.message || error.message;
    
    console.error(`API 오류 [${categoryId}]: ${status} - ${errorCode} - ${errorMessage}`);
    
    // 연속 오류가 임계값 이상이면 중단할지 결정
    if (state.consecutiveErrors >= config.CONSECUTIVE_ERROR_THRESHOLD) {
      // 1. 유효하지 않은 파라미터 오류인 경우 (카테고리 ID 문제일 가능성 높음)
      if (errorCode === 'OPENAPI00004') {
        throw new Error(`치명적 오류: 카테고리 ID '${categoryId}'가 유효하지 않습니다. 마비노기 API 설명서를 확인하세요.`);
      }
      
      // 2. API 키 오류인 경우
      if (errorCode === 'OPENAPI00005') {
        throw new Error('치명적 오류: API 키가 유효하지 않습니다. API 키를 확인하세요.');
      }
      
      // 3. API 점검 중인 경우
      if (errorCode === 'OPENAPI00011') {
        throw new Error('API 점검 중입니다. 나중에 다시 시도하세요.');
      }
      
      // 4. 게임 점검 중인 경우
      if (errorCode === 'OPENAPI00010') {
        throw new Error('게임 점검 중입니다. 나중에 다시 시도하세요.');
      }
      
      // 5. API 호출량 초과한 경우
      if (errorCode === 'OPENAPI00007' || status === 429) {
        throw new Error('API 호출량 제한에 도달했습니다. 내일 다시 시도하세요.');
      }
      
      // 6. 서버 오류가 연속으로 발생하는 경우
      if (status >= 500) {
        throw new Error('서버 오류가 연속으로 발생하여 수집을 중단합니다.');
      }
    }
    
    // 재시도 허용 범위 내이면 재시도
    if (retryCount < config.MAX_RETRIES) {
      console.log(`재시도 중... (${retryCount + 1}/${config.MAX_RETRIES})`);
      // 지수 백오프 적용 (재시도마다 대기 시간 증가)
      const backoffDelay = config.API_DELAY_MS * Math.pow(2, retryCount);
      await sleep(backoffDelay);
      return callApi(categoryId, cursor, retryCount + 1);
    }
    
    // 기존 데이터 로드 시도
    try {
      const existingDataPath = path.join(config.DATA_DIR, 'items', `${sanitizeFileName(categoryId)}.json`);
      if (fs.existsSync(existingDataPath)) {
        console.log(`기존 데이터 사용: ${categoryId}`);
        const data = JSON.parse(fs.readFileSync(existingDataPath, 'utf8'));
        return {
          items: data.items || [],
          next_cursor: null,
          useExisting: true
        };
      }
    } catch (readError) {
      console.error('기존 데이터 읽기 실패:', readError.message);
    }
    
    // 모든 시도 실패
    return { items: [], next_cursor: null, error: true };
  }
}

/**
 * 파일명으로 사용할 수 없는 특수문자 처리
 * @param {string} id 원본 ID
 * @return {string} 파일명으로 사용 가능한 ID
 */
function sanitizeFileName(id) {
  // 파일 시스템에서 문제가 될 수 있는 특수 문자들을 대체
  return id.replace(/[\/\\:*?"<>|]/g, '_');
}

/**
 * 단일 카테고리 아이템 수집
 */
async function collectCategoryItems(category) {
  console.log(`카테고리 수집 시작: ${category.name} (${category.id})`);
  
  try {
    let allItems = [];
    let nextCursor = null;
    let pageCount = 0;
    let useExistingData = false;
    
    // 최대 페이지 설정
    const MAX_PAGES = config.MAX_PAGES_PER_CATEGORY || 10;
    
    // 페이지 처리
    do {
      try {
        // API 호출
        const result = await callApi(category.id, nextCursor);
        
        // 기존 데이터 사용인 경우
        if (result.useExisting) {
          allItems = result.items;
          useExistingData = true;
          break;
        }
        
        // 아이템 추가
        if (result.items && result.items.length > 0) {
          allItems = allItems.concat(result.items);
        } else {
          // 아이템이 없는 경우 페이징 중지
          break;
        }
        
        // 다음 페이지 설정
        nextCursor = result.next_cursor;
        pageCount++;
        
        console.log(` 페이지 ${pageCount} 처리 완료: 현재 총 ${allItems.length}개`);
        
        // 최대 페이지 수 체크
        if (pageCount >= MAX_PAGES) {
          break;
        }
        
        // 다음 커서가 없거나 빈 문자열이면 중단
        if (!nextCursor || nextCursor === '') {
          break;
        }
        
      } catch (error) {
        // 치명적 오류인 경우 상위로 전파
        if (error.message.startsWith('치명적 오류:')) {
          throw error;
        }
        
        break;
      }
    } while (nextCursor && pageCount < MAX_PAGES);
    
    console.log(`카테고리 ${category.id} 수집 완료: 총 ${allItems.length}개 아이템, api ${state.apiCalls}번 호출`);
    
    // 결과 반환
    return allItems;
  } catch (error) {
    // 치명적 오류는 상위로 전파
    if (error.message.startsWith('치명적 오류:')) {
      throw error;
    }
    
    console.error(`카테고리 ${category.id} 처리 중 오류:`, error.message);
    return [];
  }
}

module.exports = {
  callApi,
  collectCategoryItems,
  getStats: () => ({ 
    apiCalls: state.apiCalls, 
    errors: state.errors 
  })
};
