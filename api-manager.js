// api-manager.js
const axios = require('axios');
const config = require('./config');
const fs = require('fs-extra');
const path = require('path');

class ApiManager {
  constructor() {
    this.apiKey = config.API_KEY;
    this.baseUrl = config.API_BASE_URL;
    this.callCount = 0;
    this.errorCount = 0;
    this.retryDelay = config.API_DELAY_MS;
  }

  async getItemsByCategory(categoryId, cursor = null) {
    try {
      // API 요청 파라미터 구성
      const params = new URLSearchParams({
        category: categoryId,
        page_size: 100 // 최대값 사용
      });
      
      if (cursor) {
        params.append("next_cursor", cursor);
      }
      
      // API 호출 간 지연
      await this.delay();
      
      // API 호출 실행
      const response = await axios.get(`${this.baseUrl}?${params.toString()}`, {
        headers: {
          'accept': 'application/json',
          'x-nxopen-api-key': this.apiKey
        }
      });
      
      // 호출 카운트 증가
      this.callCount++;
      
      if (this.callCount % 100 === 0) {
        console.log(`API 호출 횟수: ${this.callCount}`);
      }
      
      return {
        items: response.data.auction_item || [],
        next_cursor: response.data.next_cursor
      };
    } catch (error) {
      // 오류 처리
      return this.handleApiError(error, categoryId);
    }
  }
  
  async handleApiError(error, categoryId) {
    this.errorCount++;
    
    // 오류 상세 정보 추출
    const status = error.response?.status;
    const errorCode = error.response?.data?.error?.name;
    const errorMessage = error.response?.data?.error?.message || error.message;
    
    console.error(`API 오류 [${categoryId}]: ${status} - ${errorCode} - ${errorMessage}`);
    
    // 기존 데이터 확인
    const categoryPath = path.join(config.ITEMS_DIR, `${categoryId}.json`);
    
    if (fs.existsSync(categoryPath)) {
      console.log(`기존 데이터 사용: ${categoryPath}`);
      try {
        const data = JSON.parse(fs.readFileSync(categoryPath, 'utf8'));
        return {
          items: data.items || [],
          next_cursor: null,
          useExisting: true
        };
      } catch (readError) {
        console.error(`기존 데이터 읽기 오류:`, readError.message);
      }
    }
    
    return { items: [], next_cursor: null, error: true };
  }
  
  async delay() {
    return new Promise(resolve => setTimeout(resolve, this.retryDelay));
  }
  
  getStats() {
    return {
      apiCalls: this.callCount,
      errors: this.errorCount
    };
  }
}

module.exports = ApiManager;
