/**
 * 마비노기 정령 형상변환 리큐르 경매장 가격 수집기
 * 
 * Nexon Open API를 사용하여 각 아이템의 경매장 최저가를 검색하고 저장합니다.
 */

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// API 설정
const API_KEY = process.env.API_KEY;
const API_BASE_URL = 'https://open.api.nexon.com/mabinogi/v1/auction/list';

// 설정
const DATA_DIR = './data';
const SOURCE_FILE = 'spiritLiqueur.json';
const TARGET_FILE = 'spiritLiqueur_auction.json';
const API_REQUEST_DELAY = 1500; // 1.5초 (API 호출 간 지연 시간)
const MAX_RETRIES = 3; // 최대 재시도 횟수

// 메인 함수
async function main() {
  try {
    console.log('경매장 가격 수집 시작...');
    
    // 원본 데이터 파일 경로
    const sourceFilePath = path.join(DATA_DIR, SOURCE_FILE);
    const targetFilePath = path.join(DATA_DIR, TARGET_FILE);
    
    // 원본 데이터 파일 읽기
    let sourceData = [];
    try {
      const fileContent = fs.readFileSync(sourceFilePath, 'utf8');
      sourceData = JSON.parse(fileContent);
      console.log(`${SOURCE_FILE} 파일 읽기 성공: ${sourceData.length}개 항목`);
    } catch (error) {
      console.error(`${SOURCE_FILE} 파일 읽기 오류:`, error.message);
      process.exit(1);
    }
    
    // 기존 결과 파일 읽기 (있는 경우)
    let existingResults = [];
    let lastUpdate = '';
    try {
      if (fs.existsSync(targetFilePath)) {
        const existingContent = fs.readFileSync(targetFilePath, 'utf8');
        const existingData = JSON.parse(existingContent);
        
        // 데이터와 갱신 날짜 분리
        if (existingData.items && Array.isArray(existingData.items)) {
          existingResults = existingData.items;
          lastUpdate = existingData.lastUpdate || '';
        } else if (Array.isArray(existingData)) {
          // 이전 형식 지원
          existingResults = existingData;
        }
        
        console.log(`기존 ${TARGET_FILE} 파일 읽기 성공: ${existingResults.length}개 항목`);
      }
    } catch (error) {
      console.log(`기존 ${TARGET_FILE} 파일이 없거나 읽을 수 없음. 새로 생성합니다.`);
    }
    
    // 빈 API 결과 객체 초기화
    const apiResults = [];
    let successCount = 0;
    let serverErrorCount = 0;
    let totalAttempts = 0;
    
    // 각 아이템에 대해 API 호출
    for (let i = 0; i < sourceData.length; i++) {
      const item = sourceData[i];
      if (!item.name || item.name === '') continue;
      
      totalAttempts++;
      console.log(`[${i+1}/${sourceData.length}] ${item.name} 처리 중...`);
      
      // API 결과 초기화
      const apiResult = {
        name: item.name,
        auctionPrice: ''
      };
      
      // 이름에서 괄호 부분 추출 (있는 경우)
      const searchName = `정령 형상변환 리큐르(${item.name})`;
      
      // API 호출
      try {
        const { price, isServerError } = await getLowestPrice(searchName);
        
        if (isServerError) {
          serverErrorCount++;
          console.log(`${item.name} 서버 오류 발생`);
          
          // 기존 데이터에서 동일한 아이템 찾기
          const existingItem = existingResults.find(e => e.name === item.name);
          if (existingItem && existingItem.auctionPrice) {
            apiResult.auctionPrice = existingItem.auctionPrice;
            console.log(`${item.name} 기존 가격 정보 유지: ${existingItem.auctionPrice}`);
          }
        } else if (price !== null) {
          apiResult.auctionPrice = price.toString();
          successCount++;
        }
      } catch (error) {
        console.error(`${item.name} API 호출 오류:`, error.message);
        
        // 기존 데이터에서 동일한 아이템 찾기
        const existingItem = existingResults.find(e => e.name === item.name);
        if (existingItem && existingItem.auctionPrice) {
          apiResult.auctionPrice = existingItem.auctionPrice;
          console.log(`${item.name} 기존 가격 정보 유지: ${existingItem.auctionPrice}`);
        }
      }
      
      // 결과 추가
      apiResults.push(apiResult);
      
      // API 호출 간 지연
      if (i < sourceData.length - 1) {
        await sleep(API_REQUEST_DELAY);
      }
    }
    
    // 성공 비율과 서버 오류 비율 계산
    const successRate = totalAttempts > 0 ? successCount / totalAttempts : 0;
    const serverErrorRate = totalAttempts > 0 ? serverErrorCount / totalAttempts : 0;
    
    console.log(`API 호출 성공률: ${(successRate * 100).toFixed(2)}% (${successCount}/${totalAttempts})`);
    console.log(`서버 오류 비율: ${(serverErrorRate * 100).toFixed(2)}% (${serverErrorCount}/${totalAttempts})`);
    
    // 서버 오류 비율이 100%인 경우 (모든 호출이 서버 오류) 기존 데이터 유지
    if (serverErrorCount === totalAttempts && existingResults.length > 0) {
      console.warn(`모든 API 호출이 서버 오류입니다. 기존 데이터를 유지합니다.`);
      
      // 새로운 아이템이 있는지 확인하여 추가
      for (const newItem of apiResults) {
        if (!existingResults.some(e => e.name === newItem.name)) {
          existingResults.push(newItem);
          console.log(`새 아이템 추가: ${newItem.name}`);
        }
      }
      
      // 최종 결과 설정 (기존 갱신 날짜 유지)
      const finalResults = {
        lastUpdate: lastUpdate,
        items: existingResults
      };
      
      // 결과 파일 쓰기
      fs.writeFileSync(targetFilePath, JSON.stringify(finalResults, null, 2));
      console.log(`모든 API 호출이 서버 오류로 기존 데이터 유지됨`);
      return;
    }
    
    // 현재 시간을 한국 시간대로 변환
    const now = new Date();
    const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
    const updateTime = koreaTime.toISOString().replace('T', ' ').substring(0, 19);
    
    // 최종 결과 설정
    const finalResults = {
      lastUpdate: updateTime,
      items: apiResults
    };
    
    // 결과 파일 쓰기
    try {
      fs.writeFileSync(targetFilePath, JSON.stringify(finalResults, null, 2));
      console.log(`${targetFilePath} 파일 생성 완료 (${apiResults.length}개 항목)`);
    } catch (error) {
      console.error(`${targetFilePath} 파일 쓰기 오류:`, error.message);
    }
    
    console.log('가격 수집 완료!');
  } catch (error) {
    console.error('처리 중 오류 발생:', error);
    process.exit(1);
  }
}

/**
 * 경매장에서 아이템의 최저가를 가져옵니다.
 * @param {string} itemName - 검색할 아이템 이름
 * @returns {Object} - {price: number|null, isServerError: boolean} 최저가 또는 null (결과 없음)
 */
async function getLowestPrice(itemName, retryCount = 0) {
  try {
    // URL 인코딩 - trim()으로 앞뒤 공백 제거
    const encodedName = encodeURIComponent(itemName.trim());
    
    // API 호출 - 카테고리 없이 아이템명만으로 호출
    const response = await axios.get(`${API_BASE_URL}?item_name=${encodedName}`, {
      headers: {
        'accept': 'application/json',
        'x-nxopen-api-key': API_KEY
      }
    });
    
    // 결과 확인
    if (response.data && response.data.auction_item && response.data.auction_item.length > 0) {
      // 모든 가격 추출
      const prices = response.data.auction_item.map(item => item.auction_price_per_unit);
      
      // 최저가 반환
      return { price: Math.min(...prices), isServerError: false };
    }
    
    // 결과 없음
    return { price: null, isServerError: false };
  } catch (error) {
    // 오류 처리 및 재시도
    if (error.response) {
      const status = error.response.status;
      
      // 서버 오류 (500번대) 체크
      const isServerError = status >= 500;
      
      // 429 (Too Many Requests) 또는 500번대 오류는 재시도
      if ((status === 429 || status >= 500) && retryCount < MAX_RETRIES) {
        console.log(`${itemName}: API 오류 (${status}). ${retryCount + 1}번째 재시도 중...`);
        
        // 재시도 간격 늘리기 (지수 백오프)
        const delay = API_REQUEST_DELAY * Math.pow(2, retryCount);
        await sleep(delay);
        
        return getLowestPrice(itemName, retryCount + 1);
      }
      
      // 서버 오류인 경우 표시
      if (isServerError) {
        console.error(`${itemName} 서버 오류: ${status}`);
        return { price: null, isServerError: true };
      }
    }
    
    // 클라이언트 오류나 기타 오류
    console.error(`${itemName} API 호출 실패: ${error.message}`);
    return { price: null, isServerError: false };
  }
}

// 스크립트 실행
main().catch(error => {
  console.error('치명적인 오류 발생:', error);
  process.exit(1);
});
