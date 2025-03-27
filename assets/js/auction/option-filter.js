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
      if ((filter.min !== undefined && filter.min !== null && filter.min !== '' && parseFloat(filter.min) > 0) ||
          (filter.max !== undefined && filter.max !== null && filter.max !== '' && parseFloat(filter.max) > 0)) {
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
      
      // 값이 없는 경우 처리
      if (option[field] === undefined || option[field] === null) {
        value = 0;
      } else {
        // 문자열이면 숫자로 변환, '%' 제거
        if (typeof option[field] === 'string') {
          // '%' 제거하고 숫자로 변환
          value = parseFloat(option[field].replace(/[^0-9.-]/g, ''));
        } else {
          value = parseFloat(option[field]);
        }
      }
    }
    
    // 숫자가 아니면 기본값 0 사용
    if (isNaN(value)) {
      value = 0;
    }
    
    // 범위 검사 - 문자열이 아닌 숫자로 비교하도록 확실하게 변환
    const minValue = filter.min !== undefined && filter.min !== null && filter.min !== '' ? parseFloat(filter.min) : undefined;
    const maxValue = filter.max !== undefined && filter.max !== null && filter.max !== '' ? parseFloat(filter.max) : undefined;
    
    if (minValue !== undefined && value < minValue) {
      return false;
    }
    if (maxValue !== undefined && value > maxValue) {
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
      (filter.enchantType ? opt.option_sub_type === filter.enchantType : true)
    );
    
    // 해당 타입의 인챈트가 없으면 실패
    if (enchants.length === 0) {
      return false;
    }
    
    // 인챈트 이름이 지정되지 않았으면 성공 (타입만 일치)
    if (!filter.enchantName) {
      return true;
    }
    
    // 인챈트 이름 및 랭크 확인
    for (const enchant of enchants) {
      const match = enchant.option_value && enchant.option_value.match(/(.*?)\s*\(랭크 (\d+)\)/);
      if (match) {
        const name = match[1].trim();
        const rank = parseInt(match[2]);
        
        // 이름이 포함되는지 확인 (부분 일치)
        if (name.includes(filter.enchantName)) {
          // 랭크 비교 (필터에 랭크가 지정된 경우만)
          if (filter.enchantRank !== undefined && filter.enchantRank !== null && filter.enchantRank !== '') {
            const minRank = parseInt(filter.enchantRank);
            return !isNaN(minRank) ? rank >= minRank : true;
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
    
    // 옵션 이름이 지정되지 않았으면 옵션 존재만 확인
    if (!filter.optionName) {
      return reforgeOptions.length > 0;
    }
    
    // 옵션 이름으로 필터링
    const matchedOptions = reforgeOptions.filter(opt => {
      // 옵션 텍스트 파싱
      const optionText = opt.option_value || '';
      
      // 옵션 이름이 포함되는지 확인 (부분 일치)
      return optionText.includes(filter.optionName);
    });
    
    // 일치하는 옵션이 없으면 실패
    if (matchedOptions.length === 0) {
      return false;
    }
    
    // 범위 필터가 없으면 성공
    if ((filter.min === undefined || filter.min === null || filter.min === '') && 
        (filter.max === undefined || filter.max === null || filter.max === '')) {
      return true;
    }
    
    // 최소 한 개의 옵션이 범위를 만족하면 성공
    return matchedOptions.some(opt => {
      // "최대 공격력(20레벨:40 증가)" 형식 파싱
      const match = opt.option_value && opt.option_value.match(/\((\d+)레벨:/);
      if (!match) return false;
      
      const level = parseInt(match[1]);
      
      // 범위 검사
      const minLevel = filter.min !== undefined && filter.min !== null && filter.min !== '' ? 
                     parseInt(filter.min) : undefined;
      const maxLevel = filter.max !== undefined && filter.max !== null && filter.max !== '' ? 
                     parseInt(filter.max) : undefined;
      
      if (minLevel !== undefined && isNaN(minLevel)) return true;
      if (maxLevel !== undefined && isNaN(maxLevel)) return true;
      
      if (minLevel !== undefined && level < minLevel) return false;
      if (maxLevel !== undefined && level > maxLevel) return false;
      
      return true;
    });
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
    const level = parseInt(ergOption.option_value || "0");
    
    // 범위 검사
    const minLevel = filter.min !== undefined && filter.min !== null && filter.min !== '' ? 
                   parseInt(filter.min) : undefined;
    const maxLevel = filter.max !== undefined && filter.max !== null && filter.max !== '' ? 
                   parseInt(filter.max) : undefined;
    
    if (minLevel !== undefined && isNaN(minLevel)) return true;
    if (maxLevel !== undefined && isNaN(maxLevel)) return true;
    
    if (minLevel !== undefined && level < minLevel) return false;
    if (maxLevel !== undefined && level > maxLevel) return false;
    
    return true;
  }
  
  checkSetEffectFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 세트 효과 옵션 찾기
    const setEffectOptions = options.filter(opt => opt.option_type === '세트 효과');
    
    // 세트 효과가 없으면 실패
    if (setEffectOptions.length === 0) {
      return false;
    }
    
    // 세트 효과 이름이 지정되지 않았으면 효과 존재만 확인
    if (!filter.effectName) {
      return true;
    }
    
    // 이름으로 필터링
    const matchedEffects = setEffectOptions.filter(opt => 
      opt.option_value && opt.option_value.includes(filter.effectName)
    );
    
    // 일치하는 세트 효과가 없으면 실패
    if (matchedEffects.length === 0) {
      return false;
    }
    
    // 범위 필터가 없으면 성공
    if ((filter.min === undefined || filter.min === null || filter.min === '') && 
        (filter.max === undefined || filter.max === null || filter.max === '')) {
      return true;
    }
    
    // 최소 한 개의 세트 효과가 범위를 만족하면 성공
    return matchedEffects.some(opt => {
      const value = parseInt(opt.option_value2 || "0");
      
      // 범위 검사
      const minValue = filter.min !== undefined && filter.min !== null && filter.min !== '' ? 
                     parseInt(filter.min) : undefined;
      const maxValue = filter.max !== undefined && filter.max !== null && filter.max !== '' ? 
                     parseInt(filter.max) : undefined;
      
      if (minValue !== undefined && isNaN(minValue)) return true;
      if (maxValue !== undefined && isNaN(maxValue)) return true;
      
      if (minValue !== undefined && value < minValue) return false;
      if (maxValue !== undefined && value > maxValue) return false;
      
      return true;
    });
  }
  
  checkSpecialModFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 특별 개조 옵션 찾기
    const specialMods = options.filter(opt => opt.option_type === '특별 개조');
    
    // 특별 개조가 없으면 실패
    if (specialMods.length === 0) {
      return false;
    }
    
    // 타입 필터가 없으면 모든 특별 개조 옵션 고려
    if (!filter.modType) {
      // 단계 범위 필터만 검사
      if ((filter.minLevel === undefined || filter.minLevel === null || filter.minLevel === '') &&
          (filter.maxLevel === undefined || filter.maxLevel === null || filter.maxLevel === '')) {
        return true;  // 필터 조건이 없으면 통과
      }
      
      // 최소 하나의 특별 개조가 범위를 만족하면 성공
      return specialMods.some(specialMod => {
        // 단계 값 구하기
        const level = parseInt(specialMod.option_value || "0");
        
        // 범위 검사
        const minLevel = filter.minLevel !== undefined && filter.minLevel !== null && filter.minLevel !== '' ? 
                       parseInt(filter.minLevel) : undefined;
        const maxLevel = filter.maxLevel !== undefined && filter.maxLevel !== null && filter.maxLevel !== '' ? 
                       parseInt(filter.maxLevel) : undefined;
        
        if (minLevel !== undefined && isNaN(minLevel)) return true;
        if (maxLevel !== undefined && isNaN(maxLevel)) return true;
        
        if (minLevel !== undefined && level < minLevel) return false;
        if (maxLevel !== undefined && level > maxLevel) return false;
        
        return true;
      });
    }
    
    // 타입 필터가 있으면 해당 타입만 필터링
    const typeFilteredMods = specialMods.filter(mod => 
      mod.option_sub_type === filter.modType
    );
    
    // 타입 일치하는 특별 개조가 없으면 실패
    if (typeFilteredMods.length === 0) {
      return false;
    }
    
    // 단계 범위 필터가 없으면 성공
    if ((filter.minLevel === undefined || filter.minLevel === null || filter.minLevel === '') &&
        (filter.maxLevel === undefined || filter.maxLevel === null || filter.maxLevel === '')) {
      return true;
    }
    
    // 최소 하나의 타입 일치 특별 개조가 범위를 만족하면 성공
    return typeFilteredMods.some(mod => {
      // 단계 값 구하기
      const level = parseInt(mod.option_value || "0");
      
      // 범위 검사
      const minLevel = filter.minLevel !== undefined && filter.minLevel !== null && filter.minLevel !== '' ? 
                     parseInt(filter.minLevel) : undefined;
      const maxLevel = filter.maxLevel !== undefined && filter.maxLevel !== null && filter.maxLevel !== '' ? 
                     parseInt(filter.maxLevel) : undefined;
      
      if (minLevel !== undefined && isNaN(minLevel)) return true;
      if (maxLevel !== undefined && isNaN(maxLevel)) return true;
      
      if (minLevel !== undefined && level < minLevel) return false;
      if (maxLevel !== undefined && level > maxLevel) return false;
      
      return true;
    });
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const optionFilter = new OptionFilter();
export default optionFilter;
