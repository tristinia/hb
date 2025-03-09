// storage-manager.js - 데이터 저장 담당 (간소화 버전)
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
const dataProcessor = require('./data-processor'); // 수정된 data-processor 모듈 참조

// 필요한 디렉토리 초기화
function initDirectories() {
  // 데이터 디렉토리 생성
  fs.ensureDirSync(config.DATA_DIR);
  fs.ensureDirSync(path.join(config.DATA_DIR, 'items'));
  
  // 통합 아이템 데이터베이스를 위한 디렉토리
  fs.ensureDirSync(path.join(config.DATA_DIR, 'database'));
  
  // 옵션 구조를 위한 디렉토리 추가
  fs.ensureDirSync(path.join(config.DATA_DIR, 'option_structure'));
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
 * 아이템 데이터 저장 (카테고리별)
 */
function saveItemsData(categoryId, items) {
  // 파일명으로 사용할 수 없는 특수문자 처리
  const safeFileName = sanitizeFileName(categoryId);
  const filePath = path.join(config.DATA_DIR, 'items', `${safeFileName}.json`);
  
  const data = {
    updated: new Date().toISOString(),
    count: items.length,
    items: items
  };
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`아이템 데이터 저장 완료: ${categoryId} (${items.length}개)`);
  
  // 아이템 데이터베이스 업데이트
  updateItemDatabase(items);
}

/**
 * 통합 아이템 데이터베이스 업데이트
 */
function updateItemDatabase(newItems) {
  const dbFilePath = path.join(config.DATA_DIR, 'database', 'items.json');
  
  try {
    // 기존 데이터베이스 파일 확인
    let existingItems = [];
    
    if (fs.existsSync(dbFilePath)) {
      const existingData = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
      existingItems = existingData.items || [];
    }
    
    // 새 아이템과 기존 아이템 병합
    const mergedItems = dataProcessor.mergeWithExistingData(newItems, existingItems);
    
    // 데이터베이스 파일 저장
    const dbData = {
      updated: new Date().toISOString(),
      count: mergedItems.length,
      items: mergedItems
    };
    
    fs.writeFileSync(dbFilePath, JSON.stringify(dbData, null, 2));
    console.log(`통합 아이템 데이터베이스 업데이트 완료: 총 ${mergedItems.length}개 아이템`);
    
  } catch (error) {
    console.error('아이템 데이터베이스 업데이트 중 오류:', error.message);
  }
}

/**
 * 옵션 구조 데이터 저장 (카테고리별)
 */
function saveOptionStructure(categoryId, optionStructure) {
  // 파일명으로 사용할 수 없는 특수문자 처리
  const safeFileName = sanitizeFileName(categoryId);
  const filePath = path.join(config.DATA_DIR, 'option_structure', `${safeFileName}.json`);
  
  // 기존 데이터 확인
  let existingData = {};
  if (fs.existsSync(filePath)) {
    try {
      existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      existingData = existingData.option_structure || {};
    } catch (error) {
      console.error(`기존 옵션 구조 파일 로드 실패: ${categoryId}`, error.message);
    }
  }
  
  // 기존 데이터와 신규 데이터 병합
  const mergedStructure = { ...existingData };
  
  // 새 옵션 타입 추가 및 기존 타입 필드 업데이트
  Object.keys(optionStructure).forEach(optionType => {
    if (!mergedStructure[optionType]) {
      // 신규 옵션 타입
      mergedStructure[optionType] = optionStructure[optionType];
    } else {
      // 기존 옵션 타입 업데이트
      Object.keys(optionStructure[optionType]).forEach(field => {
        if (!mergedStructure[optionType][field]) {
          mergedStructure[optionType][field] = optionStructure[optionType][field];
        }
      });
    }
  });
  
  // 최종 데이터 저장
  const data = {
    updated: new Date().toISOString(),
    category: categoryId,
    option_structure: mergedStructure
  };
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`옵션 구조 데이터 저장 완료: ${categoryId}`);
}

module.exports = {
  initDirectories,
  saveItemsData,
  sanitizeFileName,
  updateItemDatabase,
  saveOptionStructure
};
