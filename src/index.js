// src/index.js - 메인 스크립트
const apiClient = require('./api-client');
const dataProcessor = require('./data-processor');
const storageManager = require('./storage-manager');
const categoryManager = require('./category-manager');
const path = require('path');
const fs = require('fs-extra');
const config = require('./config');

/**
 * 메인 함수
 */
async function main() {
  console.log('마비노기 경매장 데이터 수집 시작');
  console.log(`시작 시간: ${new Date().toISOString()}`);
  
  try {
    // 디렉토리 초기화
    storageManager.initDirectories();
    
    // API 유효성 검증 (간소화된 API 테스트)
    const apiValidationResult = await apiClient.validateApi();
    if (!apiValidationResult) {
      console.error('API 유효성 검증 실패. 수집을 중단합니다.');
      process.exit(1);
    }
    
    // 카테고리별 처리
    for (const category of categoryManager.categories) {
      try {
        // 아이템 수집
        const items = await apiClient.collectCategoryItems(category);
        
        // 데이터 처리
        const processedItems = dataProcessor.processItems(items, category.id);
        
        // 아이템 데이터 저장
        storageManager.saveItemsData(category.id, processedItems);
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
    
    // 메타데이터 저장
    console.log('\n메타데이터 저장 중...');
    
    // 처리 데이터 가져오기
    const processedData = dataProcessor.getData();
    
    // 인챈트 데이터 저장
    storageManager.saveEnchantData('prefix', processedData.enchants.prefix);
    storageManager.saveEnchantData('suffix', processedData.enchants.suffix);
    
    // 세공 데이터 저장
    storageManager.saveReforgeData(processedData.reforges);
    
    // 에코스톤 데이터 저장
    storageManager.saveEcostoneData(processedData.ecostones);
    
    // 웹 데이터 파일 이동 (spiritLiqueur.json, effectCard.json, titleEffect.json)
    storageManager.moveWebDataFiles();
    
    // 실행 통계
    const stats = apiClient.getStats();
    
    // 전체 아이템 개수 계산
    let totalItems = 0;
    try {
      // data/items 폴더의 모든 JSON 파일 읽기
      const itemsDir = path.join(config.DATA_DIR, 'items');
      const files = fs.readdirSync(itemsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(itemsDir, file);
          const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          totalItems += fileData.count || 0;
        }
      }
    } catch (error) {
      console.error('총 아이템 개수 계산 중 오류:', error.message);
    }
    
    console.log('\n=== 실행 통계 ===');
    console.log(`API 호출 횟수: ${stats.apiCalls}`);
    console.log(`수집한 총 아이템 개수: ${totalItems}개`);
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
