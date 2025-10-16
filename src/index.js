// src/index.js - 메인 스크립트
const apiClient = require('./api-client');
const dataProcessor = require('./data-processor');
const storageManager = require('./storage-manager');
const categoryManager = require('./category-manager');
const setBonusManager = require('./set-bonus-manager');
const enchantManager = require('./enchant-manager');

/**
 * 메인 함수
 */
async function main() {
  console.log('마비노기 경매장 데이터 수집 시작');
  console.log(`시작 시간: ${new Date().toISOString()}`);
  
  try {
    // 디렉토리 초기화
    storageManager.initDirectories();
    
    // 세트 효과 메타데이터 디렉토리 생성
    storageManager.ensureDir('meta/set_bonus');
    
    // 인챈트 메타데이터 디렉토리 생성
    storageManager.ensureDir('meta/enchants');
    
    // 카테고리 데이터 확인
    if (!storageManager.checkCategoriesExist()) {
      throw new Error('data/categories.json이 존재하지 않습니다.');
    }
    
    // API 연결 테스트
    console.log('API 연결 테스트 중...');
    try {
      const testCategory = categoryManager.categories[0];
      console.log(`카테고리 '${testCategory.name}'으로 API 테스트 중...`);
      
      const testItems = await apiClient.collectCategoryItems(testCategory);
      console.log(`API 테스트 성공: ${testItems.length}개 아이템 수신`);
      
      // 첫 테스트 결과 처리
      if (testItems.length > 0) {
        const processedItems = dataProcessor.processItems(testItems, testCategory.id);
        storageManager.saveItemsData(testCategory.id, processedItems);
        
        // 세트 효과 및 인챈트 메타데이터 수집
        await setBonusManager.collectSetEffects(testItems, testCategory.id);
        await enchantManager.collectEnchantMetadata(testItems, 'prefix');
        await enchantManager.collectEnchantMetadata(testItems, 'suffix');
      }
    } catch (error) {
      console.error('API 테스트 실패:', error);
      process.exit(1);
    }
    
    // 세트 효과 통계
    const setEffectsStats = {
      totalCategories: 0,
      totalSets: 0,
      newSets: 0
    };
    
    // 인챈트 통계
    const enchantStats = {
      prefix: { totalCount: 0, newCount: 0, updateCount: 0 },
      suffix: { totalCount: 0, newCount: 0, updateCount: 0 }
    };
    
    // 나머지 카테고리 처리
    for (let i = 1; i < categoryManager.categories.length; i++) {
      const category = categoryManager.categories[i];
      try {
        // 아이템 수집
        const items = await apiClient.collectCategoryItems(category);
        
        // 데이터 처리
        const processedItems = dataProcessor.processItems(items, category.id);
        
        // 카테고리별 아이템 데이터 저장
        storageManager.saveItemsData(category.id, processedItems);
        
        // 세트 효과 메타데이터 수집
        if (items.length > 0) {
          const setStats = await setBonusManager.collectSetEffects(items, category.id);
          
          if (setStats) {
            setEffectsStats.totalCategories++;
            setEffectsStats.totalSets += setStats.totalCount;
            setEffectsStats.newSets += setStats.newCount;
          }
          
          // 인챈트 메타데이터 수집 (접두)
          const prefixStats = await enchantManager.collectEnchantMetadata(items, 'prefix');
          if (prefixStats) {
            enchantStats.prefix.totalCount = prefixStats.totalCount;
            enchantStats.prefix.newCount += prefixStats.newCount;
            enchantStats.prefix.updateCount += prefixStats.updateCount;
          }
          
          // 인챈트 메타데이터 수집 (접미)
          const suffixStats = await enchantManager.collectEnchantMetadata(items, 'suffix');
          if (suffixStats) {
            enchantStats.suffix.totalCount = suffixStats.totalCount;
            enchantStats.suffix.newCount += suffixStats.newCount;
            enchantStats.suffix.updateCount += suffixStats.updateCount;
          }
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
    console.log(`\n=== 세트 효과 통계 ===`);
    console.log(`처리된 카테고리: ${setEffectsStats.totalCategories}`);
    console.log(`총 세트 효과 수: ${setEffectsStats.totalSets}`);
    console.log(`새로 추가된 세트: ${setEffectsStats.newSets}`);
    console.log(`\n=== 인챈트 통계 ===`);
    console.log(`접두어 인챈트 총 수: ${enchantStats.prefix.totalCount}`);
    console.log(`접두어 인챈트 신규: ${enchantStats.prefix.newCount}`);
    console.log(`접두어 인챈트 업데이트: ${enchantStats.prefix.updateCount}`);
    console.log(`접미어 인챈트 총 수: ${enchantStats.suffix.totalCount}`);
    console.log(`접미어 인챈트 신규: ${enchantStats.suffix.newCount}`);
    console.log(`접미어 인챈트 업데이트: ${enchantStats.suffix.updateCount}`);
    console.log(`\n종료 시간: ${new Date().toISOString()}`);
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
