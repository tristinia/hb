// index.js - 메인 스크립트 (간소화 버전)
const apiClient = require('./api-client');
const dataProcessor = require('./data-processor');
const storageManager = require('./storage-manager');
const categoryManager = require('./category-manager');

/**
 * 메인 함수
 */
async function main() {
  console.log('마비노기 경매장 데이터 수집 시작');
  console.log(`시작 시간: ${new Date().toISOString()}`);
  
  try {
    // 디렉토리 초기화
    storageManager.initDirectories();
    
    // API 테스트 대신 기본 카테고리로 첫번째 API 호출 시도
    console.log('API 연결 테스트 중...');
    try {
      // 테스트용 카테고리 (기본 카테고리 중 하나 선택)
      const testCategory = categoryManager.categories[0];
      console.log(`카테고리 '${testCategory.name}'으로 API 테스트 중...`);
      
      // 첫 번째 호출로 API 테스트
      const testItems = await apiClient.collectCategoryItems(testCategory);
      console.log(`API 테스트 성공: ${testItems.length}개 아이템 수신`);
      
      // 첫 테스트 결과도 처리 (낭비하지 않도록)
      if (testItems.length > 0) {
        const processedItems = dataProcessor.processItems(testItems, testCategory.id);
        // 첫 카테고리 결과 저장
        storageManager.saveItemsData(testCategory.id, processedItems);
        
        // 추가: 옵션 구조 분석 및 저장
        const optionStructure = dataProcessor.analyzeOptionStructure(testItems);
        storageManager.saveOptionStructure(testCategory.id, optionStructure);
      }
    } catch (error) {
      console.error('API 테스트 실패. 수집을 중단합니다:', error.message);
      process.exit(1);
    }
    
    // 나머지 카테고리 처리 (첫 번째 카테고리는 이미 처리했으므로 건너뜀)
    for (let i = 1; i < categoryManager.categories.length; i++) {
      const category = categoryManager.categories[i];
      try {
        // 아이템 수집
        const items = await apiClient.collectCategoryItems(category);
        
        // 데이터 처리 (간소화된 버전)
        const processedItems = dataProcessor.processItems(items, category.id);
        
        // 카테고리별 아이템 데이터 저장
        storageManager.saveItemsData(category.id, processedItems);
        
        // 추가: 옵션 구조 분석 및 저장
        if (items.length > 0) {
          const optionStructure = dataProcessor.analyzeOptionStructure(items);
          storageManager.saveOptionStructure(category.id, optionStructure);
        }
        
      } catch (error) {
        // 치명적 오류인 경우 전체 프로세스 중단
        if (error.message.startsWith('치명적 오류:')) {
          console.error('치명적 오류로 수집이 중단됩니다:', error.message);
          process.exit(1);
        }
        
        console.error(`카테고리 ${category.id} 처리 중 오류:`, error.message);
        // 다음 카테고리로 계속
      }
    }
    
    // 실행 통계
    const stats = apiClient.getStats();
    console.log('\n=== 실행 통계 ===');
    console.log(`API 호출 횟수: ${stats.apiCalls}`);
    console.log(`오류 횟수: ${stats.errors}`);
    console.log(`종료 시간: ${new Date().toISOString()}`);
    console.log('데이터 수집 완료');
    
  } catch (error) {
    console.error('처리 중 치명적 오류:', error.message);
    process.exit(1);
  }
}

// 실행
main().catch(error => {
  console.error('예상치 못한 오류:', error);
  process.exit(1);
});
