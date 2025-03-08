// data-storage.js
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');

class DataStorage {
  constructor() {
    // 필요한 디렉토리 생성
    this.ensureDirectories();
  }
  
  ensureDirectories() {
    const dirs = [
      config.DATA_DIR,
      config.ITEMS_DIR,
      path.join(config.META_DIR, 'enchants'),
      path.join(config.META_DIR, 'reforges'),
      path.join(config.META_DIR, 'ecostones')
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`디렉토리 생성: ${dir}`);
      }
    });
  }
  
  // 카테고리별 아이템 데이터 저장
  saveItemsData(categoryId, items) {
    const filePath = path.join(config.ITEMS_DIR, `${categoryId}.json`);
    
    const data = {
      updated: new Date().toISOString(),
      count: items.length,
      items: items
    };
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`아이템 데이터 저장 완료: ${categoryId} (${items.length}개)`);
  }
  
  // 인챈트 데이터 저장 - 기존 데이터와 병합
  saveEnchantData(type, data) {
    const filePath = path.join(config.META_DIR, 'enchants', `${type}.json`);
    
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
    const mergedData = this.mergeEnchantData(existingData, data);
    
    // 저장
    fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2));
    console.log(`인챈트 데이터 저장 완료: ${type}`);
  }
  
  // 세공 데이터 저장 - 배열 병합
  saveReforgeData(data) {
    const filePath = path.join(config.META_DIR, 'reforges', 'reforges.json');
    
    // 기존 데이터 로드 (있으면)
    let existingData = {};
    try {
      if (fs.existsSync(filePath)) {
        existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
      const newValues = data[category] || [];
      
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
  
  // 에코스톤 데이터 저장 - 배열 병합
  saveEcostoneData(data) {
    const filePath = path.join(config.META_DIR, 'ecostones', 'abilities.json');
    
    // 기존 데이터 로드 (있으면)
    let existingData = {};
    try {
      if (fs.existsSync(filePath)) {
        existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
      const newValues = data[type] || [];
      
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
  
  // 인챈트 데이터 병합
  mergeEnchantData(existing, newData) {
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
}

module.exports = DataStorage;
