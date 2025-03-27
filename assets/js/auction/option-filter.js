/**
 * 아이템 옵션 필터링 전용 모듈
 */

import metadataLoader from './metadata-loader.js';

class OptionFilter {
  constructor() {
    this.debug = false;
  }

  logDebug(...args) {
    if (this.debug) {
      console.log('[OptionFilter]', ...args);
    }
  }

  extractFilters(item) {
    const options = item.options || item.item_option || [];
    if (!Array.isArray(options)) return [];
    
    const filters = [];
    
    options.forEach(option => {
      const optionType = option.option_type;
      if (!optionType) return;
      
      // 옵션 타입별로 필터 정보 추출
      switch (optionType) {
        case '공격':
          filters.push({
            name: optionType,
            displayName: '최대 공격력',
            type: 'range',
            field: 'option_value2',
            option,
            definition: { type: 'range', field: 'option_value2' }
          });
          break;
          
        case '내구력':
          filters.push({
            name: optionType,
            displayName: '최대 내구력',
            type: 'range',
            field: 'option_value2',
            option,
            definition: { type: 'range', field: 'option_value2' }
          });
          break;
          
        case '밸런스':
          filters.push({
            name: optionType,
            displayName: '밸런스',
            type: 'range',
            field: 'option_value',
            isPercent: true,
            option,
            definition: { type: 'range', field: 'option_value', isPercent: true }
          });
          break;
          
        case '피어싱 레벨':
          filters.push({
            name: optionType,
            displayName: '피어싱 레벨',
            type: 'range',
            field: 'option_value',
            option,
            definition: { 
              type: 'range',
              getValue: (option) => {
                const baseLevel = parseInt(option.option_value || "0");
                const additionalLevel = option.option_value2 ? 
                  parseInt(option.option_value2.replace(/\+/g, '')) : 0;
                return baseLevel + additionalLevel;
              }
            }
          });
          break;
          
        case '인챈트':
          filters.push({
            name: optionType,
            displayName: '인챈트',
            type: 'enchant',
            subTypes: ['접두', '접미'],
            option,
            definition: { type: 'enchant', subTypes: ['접두', '접미'] }
          });
          break;
          
        case '특별 개조':
          filters.push({
            name: optionType,
            displayName: '특수 개조',
            type: 'special-mod',
            option,
            definition: { type: 'special-mod' }
          });
          break;
          
        case '에르그':
          filters.push({
            name: optionType,
            displayName: '에르그 레벨',
            type: 'range',
            field: 'option_value',
            option,
            definition: { type: 'range', field: 'option_value' }
          });
          break;
          
        case '세공 랭크':
          filters.push({
            name: optionType,
            displayName: '세공 상태',
            type: 'reforge-status',
            option,
            definition: { type: 'reforge-status' }
          });
          break;
          
        case '세공 옵션':
          filters.push({
            name: optionType,
            displayName: '세공 옵션',
            type: 'reforge-option',
            option,
            definition: { type: 'reforge-option' }
          });
          break;
          
        case '세트 효과':
          filters.push({
            name: optionType,
            displayName: '세트 효과',
            type: 'range',
            field: 'option_value2',
            category: '세트 효과',
            option,
            definition: { 
              type: 'range', 
              field: 'option_value2',
              category: '세트 효과'
            }
          });
          break;
          
        default:
          // 기본적으로 필터링 지원하지 않는 옵션은 추가하지 않음
          break;
      }
    });
    
    return filters;
  }

  itemPassesFilters(item, activeFilters) {
    if (!activeFilters || activeFilters.length === 0) {
      return true;
    }
    
    return activeFilters.every(filter => {
      switch (filter.type) {
        case 'range':
          return this.checkRangeFilter(item, filter);
        case 'select':
        case 'selection':
          return this.checkSelectionFilter(item, filter);
        case 'enchant':
          return this.checkEnchantFilter(item, filter);
        case 'reforge-option':
          return this.checkReforgeOptionFilter(item, filter);
        case 'reforge-rank':
          return this.checkReforgeRankFilter(item, filter);
        case 'reforge-count':
          return this.checkReforgeCountFilter(item, filter);
        case 'erg-grade':
          return this.checkErgGradeFilter(item, filter);
        case 'erg-level':
          return this.checkErgLevelFilter(item, filter);
        case 'special-mod':
          return this.checkSpecialModFilter(item, filter);
        case 'set-effect':
          return this.checkSetEffectFilter(item, filter);
        default:
          return true;
      }
    });
  }

  checkRangeFilter(item, filter) {
    const options = item.options || item.item_option || [];
      
    // 필터 필드 및 값 확인
    const optionType = filter.name;
    
    // 해당 옵션 찾기
    const option = options.find(opt => opt.option_type === optionType);
    
    // 옵션이 없으면 기본값으로 0 사용
    if (!option) {
      if (filter.min !== undefined && 0 < filter.min) {
        return false;
      }
      return true;
    }
    
    // 값 계산
    let value;
    
    // 특수 케이스 처리: 피어싱 레벨
    if (optionType === '피어싱 레벨') {
      const baseLevel = parseInt(option.option_value || "0");
      const additionalLevel = option.option_value2 ? 
        parseInt(option.option_value2.replace(/\+/g, '')) : 0;
      value = baseLevel + additionalLevel;
    } else {
      // 기본 방식으로 값 계산
      const field = filter.field || 'option_value';
      value = option[field];
      if (typeof value === 'string') {
        value = parseFloat(value.replace('%', ''));
      } else {
        value = parseFloat(value);
      }
    }
    
    // 숫자가 아니면 기본값 0 사용
    if (isNaN(value)) {
      value = 0;
    }
    
    // 범위 검사
    if (filter.min !== undefined && value < filter.min) {
      return false;
    }
    if (filter.max !== undefined && value > filter.max) {
      return false;
    }
    
    return true;
  }

  checkSelectionFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 해당 옵션 찾기
    const option = options.find(opt => opt.option_type === filter.name);
    
    // 옵션이 없으면 실패
    if (!option) {
      return false;
    }
    
    // 필드 및 값 확인
    const field = filter.field || 'option_value';
    const value = option[field];
    
    // 값 일치 확인
    return value === filter.value;
  }

  checkEnchantFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 인챈트 옵션 찾기
    const enchants = options.filter(opt => 
      opt.option_type === '인챈트' && 
      opt.option_sub_type === filter.enchantType
    );
    
    // 해당 타입의 인챈트가 없으면 실패
    if (enchants.length === 0) {
      return false;
    }
    
    // 인챈트 이름 및 랭크 확인
    for (const enchant of enchants) {
      const match = enchant.option_value.match(/(.*?)\s*\(랭크 (\d+)\)/);
      if (match) {
        const name = match[1].trim();
        const rank = parseInt(match[2]);
        
        // 이름 일치 확인
        if (name === filter.enchantName) {
          // 랭크 비교 (필터에 랭크가 지정된 경우만)
          if (filter.enchantRank !== undefined) {
            return rank >= filter.enchantRank;
          }
          return true;
        }
      }
    }
    
    return false;
  }

  checkReforgeRankFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 세공 랭크 옵션 찾기
    const reforgeRankOption = options.find(opt => opt.option_type === '세공 랭크');
    
    // 세공 랭크가 없으면 실패
    if (!reforgeRankOption) {
      return false;
    }
    
    // 랭크 일치 확인
    return reforgeRankOption.option_value === filter.rank;
  }
  
  checkReforgeCountFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 세공 옵션 찾기
    const reforgeOptions = options.filter(opt => opt.option_type === '세공 옵션');
    
    // 발현 수 확인
    return reforgeOptions.length >= filter.count;
  }
  
  checkReforgeOptionFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 세공 옵션 찾기
    const reforgeOptions = options.filter(opt => opt.option_type === '세공 옵션');
    
    // 옵션 이름으로 필터링
    const matchedOption = reforgeOptions.find(opt => {
      // "스매시 대미지(18레벨:180 % 증가)" 형식 파싱
      const match = opt.option_value.match(/(.*?)\((\d+)레벨:(.*)\)/);
      if (!match) return false;
      
      const name = match[1].trim();
      // 옵션 이름이 일치하는지 확인
      return name === filter.optionName;
    });
    
    // 일치하는 옵션이 없으면 실패
    if (!matchedOption) {
      return false;
    }
    
    // 범위 필터가 설정된 경우
    if (filter.min !== undefined || filter.max !== undefined) {
      // "스매시 대미지(18레벨:180 % 증가)" 형식 파싱
      const match = matchedOption.option_value.match(/(.*?)\((\d+)레벨:(.*)\)/);
      if (!match) return false;
      
      const level = parseInt(match[2]);
      
      // 범위 검사
      if (filter.min !== undefined && level < filter.min) {
        return false;
      }
      if (filter.max !== undefined && level > filter.max) {
        return false;
      }
    }
    
    return true;
  }
  
  checkErgGradeFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 에르그 옵션 찾기
    const ergOption = options.find(opt => opt.option_type === '에르그');
    
    // 에르그가 없으면 실패
    if (!ergOption) {
      return false;
    }
    
    // 등급 일치 확인
    return ergOption.option_sub_type === filter.grade;
  }
  
  checkErgLevelFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 에르그 옵션 찾기
    const ergOption = options.find(opt => opt.option_type === '에르그');
    
    // 에르그가 없으면 실패
    if (!ergOption) {
      return false;
    }
    
    // 레벨 확인
    const level = parseInt(ergOption.option_value);
    
    // 범위 검사
    if (filter.min !== undefined && level < filter.min) {
      return false;
    }
    if (filter.max !== undefined && level > filter.max) {
      return false;
    }
    
    return true;
  }
  
  checkSetEffectFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 세트 효과 옵션 찾기
    const setEffectOptions = options.filter(opt => 
      opt.option_type === '세트 효과' && 
      opt.option_value === filter.effectName
    );
    
    // 일치하는 세트 효과가 없으면 실패
    if (setEffectOptions.length === 0) {
      return false;
    }
    
    // 첫 번째 일치하는 세트 효과
    const setEffectOption = setEffectOptions[0];
    
    // 범위 필터가 설정된 경우
    if (filter.min !== undefined || filter.max !== undefined) {
      const value = parseInt(setEffectOption.option_value2);
      
      // 범위 검사
      if (filter.min !== undefined && value < filter.min) {
        return false;
      }
      if (filter.max !== undefined && value > filter.max) {
        return false;
      }
    }
    
    return true;
  }
  
  checkSpecialModFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 특별 개조 옵션 찾기
    const specialMod = options.find(opt => opt.option_type === '특별 개조');
    
    // 특별 개조가 없으면 실패
    if (!specialMod) {
      return false;
    }
    
    // 타입 필터 확인
    if (filter.modType && specialMod.option_sub_type !== filter.modType) {
      return false;
    }
    
    // 단계 확인
    if (filter.minLevel !== undefined || filter.maxLevel !== undefined) {
      const level = parseInt(specialMod.option_value);
      
      // 범위 검사
      if (filter.minLevel !== undefined && level < filter.minLevel) {
        return false;
      }
      if (filter.maxLevel !== undefined && level > filter.maxLevel) {
        return false;
      }
    }
    
    return true;
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const optionFilter = new OptionFilter();
export default optionFilter;
