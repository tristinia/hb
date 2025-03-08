// src/storage-manager.js - 데이터 저장 담당
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
  fs.ensureDirSync(path.join(config.DATA_DIR, 'web'));
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
  let existingEnchants = {};
  try {
    if (fs.existsSync(filePath)) {
      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      existingEnchants = fileData.enchants || {};
    }
  } catch (error) {
    console.warn(`기존 인챈트 데이터 로드 실패: ${error.message}`);
  }
  
  // 데이터 병합
  const mergedEnchants = mergeEnchantData(existingEnchants, data);
  
  // 저장
  fs.writeFileSync(filePath, JSON.stringify({
    updated: new Date().toISOString(),
    enchants: mergedEnchants
  }, null, 2));
  
  console.log(`인챈트 데이터 저장 완료: ${type}`);
}

/**
 * 세공 데이터 저장
 */
function saveReforgeData(data) {
  const filePath = path.join(config.DATA_DIR, 'meta', 'reforges', 'reforges.json');
  
  // 기존 데이터 로드 (있으면)
  let existingReforges = {};
  try {
    if (fs.existsSync(filePath)) {
      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      existingReforges = fileData.reforges || {};
    }
  } catch (error) {
    console.warn(`기존 세공 데이터.reforges 로드 실패: ${error.message}`);
  }
  
  // 카테고리별로 병합
  const mergedReforges = {};
  
  // 모든 카테고리 처리
  const allCategories = new Set([
    ...Object.keys(existingReforges),
    ...Object.keys(data)
  ]);
  
  allCategories.forEach(category => {
    // 기존 값과 신규 값 합치기
    const existing = existingReforges[category] || [];
    const newValues = Array.from(data[category] || []);
    
    // 중복 제거하여 병합
    mergedReforges[category] = Array.from(new Set([...existing, ...newValues])).sort();
  });
  
  // 저장
  fs.writeFileSync(filePath, JSON.stringify({
    updated: new Date().toISOString(),
    reforges: mergedReforges
  }, null, 2));
  
  console.log(`세공 데이터 저장 완료`);
}

/**
 * 에코스톤 데이터 저장
 */
function saveEcostoneData(data) {
  const filePath = path.join(config.DATA_DIR, 'meta', 'ecostones', 'abilities.json');
  
  // 기존 데이터 로드 (있으면)
  let existingEcostones = {};
  try {
    if (fs.existsSync(filePath)) {
      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      existingEcostones = fileData.ecostones || {};
    }
  } catch (error) {
    console.warn(`기존 에코스톤 데이터 로드 실패: ${error.message}`);
  }
  
  // 타입별로 병합
  const mergedEcostones = {};
  
  // 모든 타입 처리
  const allTypes = new Set([
    ...Object.keys(existingEcostones),
    ...Object.keys(data)
  ]);
  
  allTypes.forEach(type => {
    // 기존 값과 신규 값 합치기
    const existing = existingEcostones[type] || [];
    const newValues = Array.from(data[type] || []);
    
    // 중복 제거하여 병합
    mergedEcostones[type] = Array.from(new Set([...existing, ...newValues])).sort();
  });
  
  // 저장
  fs.writeFileSync(filePath, JSON.stringify({
    updated: new Date().toISOString(),
    ecostones: mergedEcostones
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
 * 인챈트 데이터 병합 (효과 타입별로 정리)
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
        // 효과 타입 추출 (숫자 제외)
        const effectType = getEffectType(newEffect.text);
        
        // 동일 효과 타입 찾기
        const existingEffect = result[enchantName].effects.find(
          e => getEffectType(e.text) === effectType
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
          
          // 최신 텍스트로 업데이트
          if (parseFloat(newEffect.value) > parseFloat(existingEffect.value)) {
            existingEffect.text = newEffect.text;
            existingEffect.value = newEffect.value;
          }
        }
      });
    }
  }
  
  return result;
}

/**
 * 효과 텍스트에서 효과 타입 추출 (숫자 제외)
 * 예: "지력 17 증가" -> "지력 증가"
 */
function getEffectType(effectText) {
  return effectText.replace(/\d+(\.\d+)?/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * 웹 데이터 파일 이동 (spiritLiqueur.json, effectCard.json, titleEffect.json)
 * 원래 경로의 파일을 data/web/ 폴더로 이동
 */
function moveWebDataFiles() {
  const webDataDir = path.join(config.DATA_DIR, 'web');
  fs.ensureDirSync(webDataDir);
  
  // 이동할 파일 목록
  const filesToMove = [
    { name: 'spiritLiqueur.json', source: 'spiritLiqueur.json', dest: path.join(webDataDir, 'spiritLiqueur.json') },
    { name: 'effectCard.json', source: 'data/effectCard.json', dest: path.join(webDataDir, 'effectCard.json') },
    { name: 'titleEffect.json', source: 'data/titleEffect.json', dest: path.join(webDataDir, 'titleEffect.json') }
  ];
  
  // 각 파일 이동
  filesToMove.forEach(file => {
    try {
      if (fs.existsSync(file.source)) {
        // 파일 복사 후 원본은 삭제하지 않음 (중요한 데이터일 수 있으므로)
        fs.copySync(file.source, file.dest);
        console.log(`${file.name} 파일을 data/web/ 폴더로 복사했습니다.`);
      } else {
        console.warn(`${file.name} 파일이 원래 위치에 존재하지 않습니다.`);
      }
    } catch (error) {
      console.error(`${file.name} 파일 이동 중 오류:`, error.message);
    }
  });
}

module.exports = {
  initDirectories,
  saveEnchantData,
  saveReforgeData,
  saveEcostoneData,
  saveItemsData,
  sanitizeFileName,
  moveWebDataFiles
};
