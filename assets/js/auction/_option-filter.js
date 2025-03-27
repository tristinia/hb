/**
 * option-filter.js
 * 아이템 옵션 필터링 전용 모듈
 */

import optionDefinitions from './option-definitions.js';
import metadataLoader from './metadata-loader.js';

class OptionFilter {
  constructor() {
    this.debug = false;
  }

  /**
   * 디버그 로그 출력
   * @param {...any} args 로그 인자들
   */
  logDebug(...args) {
    if (this.debug) {
      console.log('[OptionFilter]', ...args);
    }
  }

  /**
   * 아이템에서 필터 정보 추출
   * @param {Object} item 아이템 데이터
   * @returns {Array} 필터 정보 배열
   */
  extractFilters(item) {
    const options = item.options || item.item_option || [];
    if (!Array.isArray(options)) return [];
    
    const filters = [];
    
    options.forEach(option => {
      const optionType = option.option_type;
      if (!optionType) return;
      
      const definition = optionDefinitions[optionType];
      if (!definition || !definition.filter) return;
      
      filters.push({
        name: optionType,
        displayName: definition.filter.displayName || optionType,
        type: definition.filter.type || 'range',
        field: definition.filter.field || 'option_value',
        option: option,
        definition: definition.filter
      });
    });
    
    return filters;
  }

  /**
   * 아이템이 필터를 통과하는지 확인
   * @param {Object} item 아이템 객체
   * @param {Array} activeFilters 적용할 필터 배열
   * @returns {boolean} 필터 통과 여부
   */
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
        case 'special-mod-type':
          return this.checkSpecialModTypeFilter(item, filter);
        case 'special-mod-range':
          return this.checkSpecialModRangeFilter(item, filter);
        case 'special-mod-none':
          return this.checkSpecialModNoneFilter(item);
        case 'set-effect':
          return this.checkSetEffectFilter(item, filter);
        default:
          return true;
      }
    });
  }

  /**
   * 범위 필터 검사
   * @param {Object} item 아이템 객체
   * @param {Object} filter 필터 객체
   * @returns {boolean} 필터 통과 여부
   */
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
      
      // 옵션 정의에서 커스텀 getValue 함수 확인
      const definition = optionDefinitions[optionType];
      if (definition && definition.filter && typeof definition.filter.getValue === 'function') {
          // 커스텀 계산 로직 사용 (피어싱 레벨 등)
          value = definition.filter.getValue(option);
      } else {
          // 기존 방식으로 값 계산
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

  /**
   * 선택형 필터 검사
   * @param {Object} item 아이템 객체
   * @param {Object} filter 필터 객체
   * @returns {boolean} 필터 통과 여부
   */
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

  /**
   * 인챈트 필터 검사
   * @param {Object} item 아이템 객체
   * @param {Object} filter 필터 객체
   * @returns {boolean} 필터 통과 여부
   */
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

  /**
   * 세공 랭크 필터 체크
   * @param {Object} item 아이템 객체
   * @param {Object} filter 필터 객체
   * @returns {boolean} 필터 통과 여부
   */
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
  
  /**
   * 세공 발현 수 필터 체크
   * @param {Object} item 아이템 객체
   * @param {Object} filter 필터 객체
   * @returns {boolean} 필터 통과 여부
   */
  checkReforgeCountFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 세공 옵션 찾기
    const reforgeOptions = options.filter(opt => opt.option_type === '세공 옵션');
    
    // 발현 수 확인
    return reforgeOptions.length >= filter.count;
  }
  
  /**
   * 세공 옵션 필터 체크
   * @param {Object} item 아이템 객체
   * @param {Object} filter 필터 객체
   * @returns {boolean} 필터 통과 여부
   */
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
  
  /**
   * 에르그 등급 필터 체크
   * @param {Object} item 아이템 객체
   * @param {Object} filter 필터 객체
   * @returns {boolean} 필터 통과 여부
   */
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
  
  /**
   * 에르그 레벨 필터 체크
   * @param {Object} item 아이템 객체
   * @param {Object} filter 필터 객체
   * @returns {boolean} 필터 통과 여부
   */
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
  
  /**
   * 세트 효과 필터 체크
   * @param {Object} item 아이템 객체
   * @param {Object} filter 필터 객체
   * @returns {boolean} 필터 통과 여부
   */
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
  
  /**
   * 특별 개조 타입 필터 검사
   * @param {Object} item 아이템 객체
   * @param {Object} filter 필터 객체
   * @returns {boolean} 필터 통과 여부
   */
  checkSpecialModTypeFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 특별 개조 옵션 찾기
    const specialMod = options.find(opt => opt.option_type === '특별 개조');
    
    // 특별 개조가 없으면 실패
    if (!specialMod) {
      return false;
    }
    
    // 타입 일치 확인
    return specialMod.option_sub_type === filter.modType;
  }
  
  /**
   * 특별 개조 범위 필터 검사
   * @param {Object} item 아이템 객체
   * @param {Object} filter 필터 객체
   * @returns {boolean} 필터 통과 여부
   */
  checkSpecialModRangeFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 특별 개조 옵션 찾기
    const specialMod = options.find(opt => opt.option_type === '특별 개조');
    
    // 특별 개조가 없으면 실패
    if (!specialMod) {
      return false;
    }
    
    // 레벨 확인
    const level = parseInt(specialMod.option_value);
    
    // 범위 검사
    if (filter.min !== undefined && level < filter.min) {
      return false;
    }
    if (filter.max !== undefined && level > filter.max) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 특별 개조 없음 필터 검사
   * @param {Object} item 아이템 객체
   * @returns {boolean} 필터 통과 여부
   */
  checkSpecialModNoneFilter(item) {
    const options = item.options || item.item_option || [];
    
    // 특별 개조 옵션 찾기
    const specialMod = options.find(opt => opt.option_type === '특별 개조');
    
    // 특별 개조가 없으면 통과
    return !specialMod;
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const optionFilter = new OptionFilter();
export default optionFilter;
