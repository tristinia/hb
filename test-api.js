const axios = require('axios');

// API 키
const API_KEY = process.env.API_KEY;

async function testApi() {
  if (!API_KEY) {
    console.error('API 키가 설정되지 않았습니다. API_KEY 환경 변수를 설정하세요.');
    process.exit(1);
  }
  
  try {
    console.log('마비노기 API 테스트 중...');
    
    // 한글 카테고리로 테스트
    const testCategories = [
      '검',       // 검
      '둔기',     // 둔기
      '랜스',     // 랜스
      '에코스톤',  // 에코스톤
      '인챈트 스크롤' // 인챈트 스크롤
    ];
    
    for (const category of testCategories) {
      console.log(`카테고리 테스트: ${category}`);
      
      const encodedCategory = encodeURIComponent(category);
      const response = await axios.get(`https://open.api.nexon.com/mabinogi/v1/auction/list?auction_item_category=${encodedCategory}`, {
        headers: {
          'accept': 'application/json',
          'x-nxopen-api-key': API_KEY
        },
        timeout: 10000
      });
      
      const itemCount = response.data.auction_item?.length || 0;
      console.log(`- 성공: ${itemCount}개 아이템 수신`);
    }
    
    console.log('\nAPI 테스트 성공!');
  } catch (error) {
    console.error('API 테스트 실패:', error.message);
    
    if (error.response) {
      console.error('상태 코드:', error.response.status);
      console.error('오류 데이터:', error.response.data);
    }
    
    process.exit(1);
  }
}

testApi();
