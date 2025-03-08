// data-processor.js
class DataProcessor {
  constructor() {
    this.enchantData = { prefix: {}, suffix: {} };
    this.reforgeData = {};
    this.ecostoneData = {};
  }
  
  processItems(items, categoryId) {
    // 아이템 기본 정보만 추출
    const processedItems = items.map(item => {
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
          // 인챈트 여부 확인
          if (option.option_type === "인챈트") {
            processed.has_enchant = true;
            this.processEnchant(option);
          }
          
          // 세공 옵션 여부 확인
          if (option.option_type === "세공 옵션") {
            processed.has_reforge = true;
            this.processReforge(option, categoryId);
          }
          
          // 에코스톤 여부 확인
          if (option.option_type === "에코스톤 각성 능력") {
            processed.has_ecostone = true;
            this.processEcostone(option, item.item_name);
          }
        });
      }
      
      return processed;
    });
    
    return processedItems;
  }
  
  processEnchant(option) {
    // 접두/접미 구분
    const isPrefix = option.option_sub_type === "접두";
    const collection = isPrefix ? this.enchantData.prefix : this.enchantData.suffix;
    
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
        this.processEnchantEffect(collection[enchantName], effect.trim());
      });
    }
  }
  
  processEnchantEffect(enchant, effectText) {
    // 기존 효과 찾기
    const existingEffect = enchant.effects.find(e => e.text === effectText);
    
    if (!existingEffect) {
      // 새 효과 추가
      enchant.effects.push({ text: effectText });
      
      // 효과에서 숫자 값 추출 시도
      const numMatch = effectText.match(/(\d+)([%]?)\s*(?:증가|감소|회복)/);
      if (numMatch) {
        const value = parseInt(numMatch[1]);
        const isPercent = numMatch[2] === '%';
        
        const lastIndex = enchant.effects.length - 1;
        enchant.effects[lastIndex].value = value;
        enchant.effects[lastIndex].isPercent = isPercent;
        enchant.effects[lastIndex].min = value;
        enchant.effects[lastIndex].max = value;
      }
    } else {
      // 기존 효과 업데이트 (숫자 값이 있을 경우 범위 확장)
      if (existingEffect.value !== undefined) {
        const numMatch = effectText.match(/(\d+)([%]?)\s*(?:증가|감소|회복)/);
        if (numMatch) {
          const value = parseInt(numMatch[1]);
          
          if (value < existingEffect.min) existingEffect.min = value;
          if (value > existingEffect.max) existingEffect.max = value;
        }
      }
    }
  }
  
  processReforge(option, categoryId) {
    // "아이스볼트 최소 대미지(10레벨:15.00 증가)" 형식에서 옵션 이름 추출
    const nameMatch = option.option_value.match(/^(.*?)\s*\(/);
    if (!nameMatch) return;
    
    const reforgeOptionName = nameMatch[1].trim();
    
    // 카테고리별 세공 옵션 저장
    const categoryType = categoryId.split('_')[0]; // weapon, armor 등
    
    if (!this.reforgeData[categoryType]) {
      this.reforgeData[categoryType] = new Set();
    }
    
    this.reforgeData[categoryType].add(reforgeOptionName);
  }
  
  processEcostone(option, itemName) {
    // "마법 자동 방어 5 레벨" 형식에서 "마법 자동 방어" 부분 추출
    const abilityMatch = option.option_value.match(/^(.*?)\s+\d+\s+레벨$/);
    if (!abilityMatch) return;
    
    const abilityName = abilityMatch[1].trim();
    
    // 에코스톤 타입 추출 (블루 에코스톤 등)
    const ecostoneType = itemName.match(/^([\w가-힣]+)\s+에코스톤/)?.[1] || '기타';
    
    // 에코스톤 타입별 능력 저장
    if (!this.ecostoneData[ecostoneType]) {
      this.ecostoneData[ecostoneType] = new Set();
    }
    
    this.ecostoneData[ecostoneType].add(abilityName);
  }
  
  getEnchantData() {
    return {
      prefix: this.transformSetToArray(this.enchantData.prefix),
      suffix: this.transformSetToArray(this.enchantData.suffix)
    };
  }
  
  getReforgeData() {
    const result = {};
    
    for (const [category, options] of Object.entries(this.reforgeData)) {
      result[category] = Array.from(options);
    }
    
    return result;
  }
  
  getEcostoneData() {
    const result = {};
    
    for (const [type, abilities] of Object.entries(this.ecostoneData)) {
      result[type] = Array.from(abilities);
    }
    
    return result;
  }
  
  transformSetToArray(obj) {
    return obj;
  }
}

module.exports = DataProcessor;
