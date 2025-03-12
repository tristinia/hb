// src/set-bonus-manager.js
const fs = require('fs-extra');
const path = require('path');
const { sanitizeFileName } = require('./storage-manager');
const config = require('./config');

/**
 * 세트 효과 메타데이터 수집 및 저장
 * @param {Array} itemsData - 아이템 데이터 배열
 * @param {string} categoryId - 카테고리 ID
 */
async function collectSetEffects(itemsData, categoryId) {
  if (!Array.isArray(itemsData)) {
    console.error(`유효하지 않은 아이템 데이터: ${categoryId}`);
    return;
  }

  // 세트 효과 메타데이터를 저장할 디렉토리 생성
  const setEffectsDir = path.join(config.DATA_DIR, 'meta', 'set_bonus');
  fs.ensureDirSync(setEffectsDir);

  // 카테고리별 세트 효과 저장 경로
  const safeFileName = sanitizeFileName(categoryId);
  const filePath = path.join(setEffectsDir, `${safeFileName}.json`);

  // 기존 세트 효과 데이터 로드 (있는 경우)
  let existingSetEffects = [];
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      existingSetEffects = JSON.parse(data);
      console.log(`기존 세트 효과 메타데이터 로드 완료: ${categoryId}`);
    }
  } catch (error) {
    console.warn(`기존 세트 효과 메타데이터 로드 실패: ${categoryId}`, error.message);
    existingSetEffects = [];
  }

  // 세트 효과 수집
  const setEffectsSet = new Set(existingSetEffects);
  let newCount = 0;

  for (const item of itemsData) {
    if (!item.item_option || !Array.isArray(item.item_option)) continue;

    // 아이템의 세트 효과만 필터링
    const setEffectOptions = item.item_option.filter(
      option => option.option_type === '세트 효과'
    );

    if (setEffectOptions.length === 0) continue;

    // 각 세트 효과 처리
    for (const option of setEffectOptions) {
      if (!option.option_value) continue;
      
      const setName = option.option_value;
      
      // 세트 효과가 이미 존재하는지 확인
      if (!setEffectsSet.has(setName)) {
        setEffectsSet.add(setName);
        newCount++;
      }
    }
  }

  // 배열로 변환하여 저장
  const updatedSetEffects = Array.from(setEffectsSet).sort();

  // 메타데이터 저장
  const updatedData = {
    "updated": new Date().toISOString(),
    "category": categoryId,
    "set_effects": updatedSetEffects
  };
  
  fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2));
  
  console.log(`세트 효과 메타데이터 저장 완료: ${categoryId}`);
  console.log(`- 새로 추가된 세트: ${newCount}`);
  console.log(`- 총 세트 효과 수: ${updatedSetEffects.length}`);
  
  return {
    newCount,
    totalCount: updatedSetEffects.length
  };
}

/**
 * 모든 카테고리의 세트 효과 목록 합치기
 * @returns {Object} 카테고리별 세트 효과 맵
 */
async function getAllSetEffects() {
  const setEffectsDir = path.join(config.DATA_DIR, 'meta', 'set_bonus');
  
  // 디렉토리 확인
  if (!fs.existsSync(setEffectsDir)) {
    console.warn('세트 효과 메타데이터 디렉토리가 존재하지 않습니다.');
    return {};
  }
  
  try {
    const files = fs.readdirSync(setEffectsDir);
    const categorySetEffects = {};
    
    // 각 카테고리별 파일 처리
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      const filePath = path.join(setEffectsDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (data.category && Array.isArray(data.set_effects)) {
        categorySetEffects[data.category] = data.set_effects;
      }
    }
    
    return categorySetEffects;
  } catch (error) {
    console.error('세트 효과 목록 조회 중 오류:', error);
    return {};
  }
}

module.exports = {
  collectSetEffects,
  getAllSetEffects
};
