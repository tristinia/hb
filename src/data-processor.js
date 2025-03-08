// src/data-processor.js - 데이터 가공 담당
// 데이터 처리 상태
const state = {
  enchants: {
    prefix: {},
    suffix: {}
  },
  reforges: {},
  ecostones: {}
};

/**
 * 아이템 목록 처리
 */
function processItems(items, categoryId) {
  return items.map(item => {
    // 기본 필드 추출
    const processed = {
      name: item.item_name,
      display_name: item.item_display_name,
      price: item.auction_price_per_unit,
      has_enchant: false,
      has_reforge: false,
      has_ecostone: false
    };
    
    // 옵션 처리
    if (item.item_option && Array.isArray(item.item_option)) {
      item.item_option.forEach(option => {
        // 인챈트 처리
        if (option.option_type === "인챈트") {
          processed.has_enchant = true;
          processEnchant(option);
        }
        
        // 세공 옵션 처리
        if (option.option_type === "세공 옵션") {
          processed.has_reforge = true;
          processReforge(option, categoryId);
        }
        
        // 에코스톤 처리
        if (option.option_type === "에코스톤 각성 능력") {
          processed.has_ecostone = true;
          processEcostone(option, item.item_name);
        }
      });
    }
    
    return processed;
  });
}

/**
 * 인챈트 정보 처리
 */
function processEnchant(option) {
  // 접두/접미 구분
  const isPrefix = option.option_sub_type === "접두";
  const collection = isPrefix ? state.enchants.prefix : state.enchants.suffix;
  
  // "오피서의 (랭크 5)" 형식에서 이름과 랭크 추출
  const matches = option.option_value.match(/^(.*?)\s*\(랭크\s*(\d+)\)$/);
  if (!matches) return;
  
  const enchantName = matches[1].trim();
  const rank = parseInt(matches[2]);
  
  // 인챈트 데이터 초기화
  if (!collection[enchantName]) {
    collection[enchantName] = {
      name: enchantName,
      rank: rank,
      effects: []
    };
  }
  
  // 효과 파싱 및 저장
  if (option.option_desc) {
    const effects = option.option_desc.split(',');
    
    effects.forEach(effect => {
      processEnchantEffect(collection[enchantName], effect.trim());
    });
  }
}

/**
 * 인챈트 효과 처리 - 타입별 병합
 */
function processEnchantEffect(enchant, effectText) {
  // 효과 타입 추출 (숫자 제외) - 예: "지력 17 증가" -> "지력 증가"
  const effectType = getEffectType(effectText);
  
  // 동일 효과 타입 찾기
  const existingEffect = enchant.effects.find(e => getEffectType(e.text) === effectType);
  
  if (!existingEffect) {
    // 새 효과 추가
    const newEffect = { text: effectText };
    
    // 효과에서 숫자 값 추출
    const numMatch = effectText.match(/(\d+)([%]?)\s*(?:증가|감소|회복)/);
    if (numMatch) {
      const value = parseInt(numMatch[1]);
      const isPercent = numMatch[2] === '%';
      
      newEffect.value = value;
      newEffect.isPercent = isPercent;
      newEffect.min = value;
      newEffect.max = value;
    }
    
    enchant.effects.push(newEffect);
  } else {
    // 범위 업데이트
    if (existingEffect.value !== undefined) {
      const numMatch = effectText.match(/(\d+)([%]?)\s*(?:증가|감소|회복)/);
      if (numMatch) {
        const value = parseInt(numMatch[1]);
        
        if (value < existingEffect.min) {
          existingEffect.min = value;
        }
        if (value > existingEffect.max) {
          existingEffect.max = value;
          // 값이 높은 효과 텍스트로 업데이트
          existingEffect.text = effectText;
          existingEffect.value = value;
        }
      }
    }
  }
}

/**
 * 효과 텍스트에서 타입 추출 (숫자 제외)
 */
function getEffectType(effectText) {
  return effectText.replace(/\d+(\.\d+)?/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * 세공 옵션 처리
 */
function processReforge(option, categoryId) {
  // "아이스볼트 최소 대미지(10레벨:15.00 증가)" 형식에서 옵션 이름 추출
  const nameMatch = option.option_value.match(/^(.*?)\s*\(/);
  if (!nameMatch) return;
  
  const reforgeOptionName = nameMatch[1].trim();
  
  // 카테고리별 세공 옵션 저장
  const categoryType = categoryId.split('_')[0] || categoryId;
  
  if (!state.reforges[categoryType]) {
    state.reforges[categoryType] = new Set();
  }
  
  state.reforges[categoryType].add(reforgeOptionName);
}

/**
 * 에코스톤 능력 처리
 */
function processEcostone(option, itemName) {
  // "마법 자동 방어 5 레벨" 형식에서 "마법 자동 방어" 부분 추출
  const abilityMatch = option.option_value.match(/^(.*?)\s+\d+\s+레벨$/);
  if (!abilityMatch) return;
  
  const abilityName = abilityMatch[1].trim();
  
  // 에코스톤 타입 추출 (블루 에코스톤 등)
  const ecostoneType = itemName.match(/^([\w가-힣]+)\s+에코스톤/)?.[1] || '기타';
  
  // 에코스톤 타입별 능력 저장
  if (!state.ecostones[ecostoneType]) {
    state.ecostones[ecostoneType] = new Set();
  }
  
  state.ecostones[ecostoneType].add(abilityName);
}

module.exports = {
  processItems,
  getData: () => ({
    enchants: state.enchants,
    reforges: state.reforges,
    ecostones: state.ecostones
  })
};
