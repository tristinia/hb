// storage-manager.js - 데이터 저장 담당
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');

// 필요한 디렉토리 초기화
function initDirectories() {
  // 데이터 디렉토리 생성
  fs.ensureDirSync(config.DATA_DIR);
  fs.ensureDirSync(path.join(config.DATA_DIR, 'items'));
  fs.ensureDirSync(path.join(config.DATA_DIR, 'meta'));
  fs.ensureDirSync(path.join(config.DATA_DIR, 'meta/enchants'));
  fs.ensureDirSync(path.join(config.DATA_DIR, 'meta/reforges'));
  fs.ensureDirSync(path.join(config.DATA_DIR, 'meta/ecostones'));
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
 * 인챈트 데이터 저장
 */
function saveEnchantData(type, data) {
  const filePath = path.join(config.DATA_DIR, 'meta', 'enchants', `${sanitizeFileName(type)}.json`);
  
  // 기존 데이터 로드 (있으면)
  let existingData = {};
  try {
    if (fs.existsSync(filePath)) {
      existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (error) {
    console.warn(`기존 인챈트 데이터 로드 실패: ${error.message}`);
  }
  
  // 데이터 병합
  const mergedData = mergeEnchantData(existingData, data);
  
  // 저장
  fs.writeFileSync(filePath, JSON.stringify({
    updated: new Date().toISOString(),
    enchants: mergedData
  }, null, 2));
  
  console.log(`인챈트 데이터 저장 완료: ${type}`);
}

/**
 * 세공 데이터 저장
 */
function saveReforgeData(data) {
  const filePath = path.join(config.DATA_DIR, 'meta', 'reforges', 'reforges.json');
  
  // 기존 데이터 로드 (있으면)
  let existingData = {};
  try {
    if (fs.existsSync(filePath)) {
      existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'))?.reforges || {};
    }
  } catch (error) {
    console.warn(`기존 세공 데이터 로드 실패: ${error.message}`);
  }
  
  // 카테고리별로 병합
  const mergedData = {};
  
  // 모든 카테고리 처리
  const allCategories = new Set([
    ...Object.keys(existingData),
    ...Object.keys(data)
  ]);
  
  allCategories.forEach(category => {
    // 기존 값과 신규 값 합치기
    const existing = existingData[category] || [];
    const newValues = Array.from(data[category] || []);
    
    // 중복 제거하여 병합
    mergedData[category] = Array.from(new Set([...existing, ...newValues])).sort();
  });
  
  // 저장
  fs.writeFileSync(filePath, JSON.stringify({
    updated: new Date().toISOString(),
    reforges: mergedData
  }, null, 2));
  
  console.log(`세공 데이터 저장 완료`);
}

/**
 * 에코스톤 데이터 저장
 */
function saveEcostoneData(data) {
  const filePath = path.join(config.DATA_DIR, 'meta', 'ecostones', 'abilities.json');
  
  // 기존 데이터 로드 (있으면)
  let existingData = {};
  try {
    if (fs.existsSync(filePath)) {
      existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'))?.ecostones || {};
    }
  } catch (error) {
    console.warn(`기존 에코스톤 데이터 로드 실패: ${error.message}`);
  }
  
  // 타입별로 병합
  const mergedData = {};
  
  // 모든 타입 처리
  const allTypes = new Set([
    ...Object.keys(existingData),
    ...Object.keys(data)
  ]);
  
  allTypes.forEach(type => {
    // 기존 값과 신규 값 합치기
    const existing = existingData[type] || [];
    const newValues = Array.from(data[type] || []);
    
    // 중복 제거하여 병합
    mergedData[type] = Array.from(new Set([...existing, ...newValues])).sort();
  });
  
  // 저장
  fs.writeFileSync(filePath, JSON.stringify({
    updated: new Date().toISOString(),
    ecostones: mergedData
  }, null, 2));
  
  console.log(`에코스톤 데이터 저장 완료`);
}

/**
 * 아이템 데이터 저장
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
}

/**
 * 인챈트 데이터 병합
 */
function mergeEnchantData(existing, newData) {
  const result = { ...existing };
  
  // 새 데이터 반복
  for (const [enchantName, enchantData] of Object.entries(newData)) {
    // 기존 데이터에 없으면 추가
    if (!result[enchantName]) {
      result[enchantName] = { ...enchantData };
      continue;
    }
    
    // 랭크 업데이트
    if (enchantData.rank) {
      result[enchantName].rank = enchantData.rank;
    }
    
    // 효과 병합
    if (enchantData.effects && enchantData.effects.length > 0) {
      // 기존 효과가 없으면 초기화
      if (!result[enchantName].effects) {
        result[enchantName].effects = [];
      }
      
      // 새 효과 추가 또는 업데이트
      enchantData.effects.forEach(newEffect => {
        // 동일 효과 찾기
        const existingEffect = result[enchantName].effects.find(
          e => e.text === newEffect.text
        );
        
        if (!existingEffect) {
          // 새 효과 추가
          result[enchantName].effects.push({ ...newEffect });
        } else {
          // 범위 업데이트
          if (newEffect.min !== undefined && existingEffect.min !== undefined) {
            existingEffect.min = Math.min(existingEffect.min, newEffect.min);
          }
          
          if (newEffect.max !== undefined && existingEffect.max !== undefined) {
            existingEffect.max = Math.max(existingEffect.max, newEffect.max);
          }
        }
      });
    }
  }
  
  return result;
}

module.exports = {
  initDirectories,
  saveEnchantData,
  saveReforgeData,
  saveEcostoneData,
  saveItemsData,
  sanitizeFileName
};
