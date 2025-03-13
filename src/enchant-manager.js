// src/enchant-manager.js
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
const { sanitizeFileName } = require('./storage-manager');

/**
 * 인챈트 효과 텍스트 파싱
 * @param {string} effectText - 인챈트 효과 텍스트
 * @returns {Object} 파싱된 효과 객체
 */
function parseEnchantEffect(effectText) {
  // 숫자 추출 (백분율 포함)
  const numberPattern = /(\d+(?:\.\d+)?)/;
  const match = effectText.match(numberPattern);
  
  if (!match) {
    return {
      template: effectText,
      min: null,
      max: null
    };
  }
  
  const value = parseFloat(match[1]);
  const isPercent = effectText.includes('%');
  
  // 효과 템플릿 생성 (실제 값을 {value}로 대체)
  const template = effectText.replace(numberPattern, '{value}' + (isPercent ? '%' : ''));
  
  return {
    template,
    min: value,
    max: value
  };
}

/**
 * 인챈트 이름과 랭크 파싱
 * @param {string} enchantStr - 인챈트 문자열 (예: "미티어로이드 (랭크 4)")
 * @returns {Object} 이름과 랭크 정보
 */
function parseEnchantNameAndRank(enchantStr) {
  const rankPattern = /\(랭크 (\d+)\)$/;
  const rankMatch = enchantStr.match(rankPattern);
  
  let rank = null;
  let name = enchantStr;
  
  if (rankMatch) {
    rank = parseInt(rankMatch[1]);
    name = enchantStr.replace(rankPattern, '').trim();
  }
  
  return { name, rank };
}

/**
 * 인챈트 메타데이터 수집
 * @param {Array} itemsData - 아이템 데이터 배열
 * @param {string} enchantType - 인챈트 타입 ('prefix' 또는 'suffix')
 */
async function collectEnchantMetadata(itemsData, enchantType) {
  if (!Array.isArray(itemsData)) {
    console.error(`유효하지 않은 아이템 데이터`);
    return;
  }

  // 인챈트 메타데이터를 저장할 디렉토리 생성
  const enchantDir = path.join(config.DATA_DIR, 'meta', 'enchants');
  fs.ensureDirSync(enchantDir);

  // 인챈트 타입별 파일 경로
  const filePath = path.join(enchantDir, `${enchantType}.json`);

  // 기존 메타데이터 로드 (있는 경우)
  let existingData = { updated: new Date().toISOString(), enchants: {} };
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      existingData = JSON.parse(data);
      console.log(`기존 인챈트 메타데이터 로드 완료: ${enchantType}`);
    }
  } catch (error) {
    console.warn(`기존 인챈트 메타데이터 로드 실패: ${enchantType}`, error.message);
    existingData = { updated: new Date().toISOString(), enchants: {} };
  }

  // 인챈트 데이터 수집
  let newCount = 0;
  let updateCount = 0;

  for (const item of itemsData) {
    if (!item.item_option || !Array.isArray(item.item_option)) continue;

    // 인챈트 옵션만 필터링 (접두 또는 접미)
    const enchantOptions = item.item_option.filter(
      option => option.option_type === '인챈트' && 
                option.option_sub_type === (enchantType === 'prefix' ? '접두' : '접미')
    );

    for (const option of enchantOptions) {
      if (!option.option_value || !option.option_desc) continue;
      
      // 인챈트 이름과 랭크 파싱
      const { name, rank } = parseEnchantNameAndRank(option.option_value);
      
      // 효과 텍스트 분리 및 파싱
      const effectsTexts = option.option_desc.split(',');
      const effects = effectsTexts.map(text => parseEnchantEffect(text.trim()));
      
      // 메타데이터에 없으면 추가
      if (!existingData.enchants[name]) {
        existingData.enchants[name] = {
          name,
          rank,
          effects
        };
        newCount++;
      } else {
        // 기존 인챈트 업데이트 (효과별 min/max 값 조정)
        const existingEnchant = existingData.enchants[name];
        
        // 랭크 업데이트
        if (rank && (!existingEnchant.rank || rank > existingEnchant.rank)) {
          existingEnchant.rank = rank;
        }
        
        // 새 효과 처리
        for (const newEffect of effects) {
          // 동일한 템플릿 효과 찾기
          const matchingEffect = existingEnchant.effects.find(
            e => e.template === newEffect.template
          );
          
          if (matchingEffect) {
            // min/max 값 업데이트
            if (newEffect.min !== null) {
              matchingEffect.min = Math.min(
                matchingEffect.min !== null ? matchingEffect.min : Infinity,
                newEffect.min
              );
            }
            
            if (newEffect.max !== null) {
              matchingEffect.max = Math.max(
                matchingEffect.max !== null ? matchingEffect.max : -Infinity,
                newEffect.max
              );
            }
          } else {
            // 새 효과 추가
            existingEnchant.effects.push(newEffect);
          }
        }
        updateCount++;
      }
    }
  }

  // 인챈트 이름 기준으로 정렬된 객체로 변환
  const sortedEnchants = {};
  Object.keys(existingData.enchants)
    .sort((a, b) => a.localeCompare(b, 'ko'))
    .forEach(key => {
      sortedEnchants[key] = existingData.enchants[key];
    });
  
  existingData.enchants = sortedEnchants;
  existingData.updated = new Date().toISOString();

  // 메타데이터 저장
  fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
  
  console.log(`인챈트 메타데이터 저장 완료: ${enchantType}`);
  console.log(`- 새로 추가된 인챈트: ${newCount}`);
  console.log(`- 업데이트된 인챈트: ${updateCount}`);
  console.log(`- 총 인챈트 수: ${Object.keys(existingData.enchants).length}`);
  
  return {
    newCount,
    updateCount,
    totalCount: Object.keys(existingData.enchants).length
  };
}

module.exports = {
  collectEnchantMetadata,
  parseEnchantEffect,
  parseEnchantNameAndRank
};
