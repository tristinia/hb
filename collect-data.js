// collect-data.js
const ApiManager = require('./api-manager');
const DataProcessor = require('./data-processor');
const DataStorage = require('./data-storage');
const CategoryMapper = require('./category-mapper');
const config = require('./config');

async function collectData() {
  console.log('마비노기 경매장 데이터 수집 시작');
  console.log(`시작 시간: ${new Date().toISOString()}`);
  
  // 컴포넌트 초기화
  const apiManager = new ApiManager();
  const dataProcessor = new DataProcessor();
  const dataStorage = new DataStorage();
  
  // 모든 카테고리 가져오기
  const categories = CategoryMapper.getAllCategories();
  console.log(`카테고리 수: ${categories.length}`);
  
  // 카테고리별 처리
  for (const category of categories) {
    console.log(`\n카테고리 처리 중: ${category.name} (${category.id})`);
    
    try {
      let allItems = [];
      let nextCursor = null;
      let pageCount = 0;
      let useExistingData = false;
      
      // 페이지 처리
      do {
        // API 호출
        const result = await apiManager.getItemsByCategory(category.id, nextCursor);
        
        // 기존 데이터 사용인 경우
        if (result.useExisting) {
          allItems = result.items;
          useExistingData = true;
          break;
        }
        
        // 아이템 추가
        if (result.items && result.items.length > 0) {
          allItems = allItems.concat(result.items);
        }
        
        // 다음 페이지 설정
        nextCursor = result.next_cursor;
        pageCount++;
        
        console.log(`  페이지 ${pageCount} 처리 완료: ${result.items?.length || 0}개 아이템, 현재 총 ${allItems.length}개`);
        
      } while (nextCursor);
      
      if (useExistingData) {
        console.log(`  기존 데이터 사용: ${allItems.length}개 아이템`);
      } else {
        console.log(`  카테고리 ${category.id} 수집 완료: 총 ${allItems.length}개 아이템`);
      }
      
      // 데이터 처리
      const processedItems = dataProcessor.processItems(allItems, category.id);
      
      // 아이템 데이터 저장
      dataStorage.saveItemsData(category.id, processedItems);
      
    } catch (error) {
      console.error(`  카테고리 ${category.id} 처리 중 오류:`, error);
    }
  }
  
  // 메타데이터 저장
  console.log('\n메타데이터 저장 중...');
  
  // 인챈트 데이터 저장
  const enchantData = dataProcessor.getEnchantData();
  dataStorage.saveEnchantData('prefix', enchantData.prefix);
  dataStorage.saveEnchantData('suffix', enchantData.suffix);
  
  // 세공 데이터 저장
  const reforgeData = dataProcessor.getReforgeData();
  dataStorage.saveReforgeData(reforgeData);
  
  // 에코스톤 데이터 저장
  const ecostoneData = dataProcessor.getEcostoneData();
  dataStorage.saveEcostoneData(ecostoneData);
  
  // 통계 출력
  const stats = apiManager.getStats();
  console.log('\n=== 실행 통계 ===');
  console.log(`API 호출 횟수: ${stats.apiCalls}`);
  console.log(`오류 횟수: ${stats.errors}`);
  console.log(`종료 시간: ${new Date().toISOString()}`);
  console.log('데이터 수집 완료');
}

// 스크립트 실행
collectData().catch(error => {
  console.error('치명적인 오류 발생:', error);
  process.exit(1);
});
