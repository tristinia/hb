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
    
    const options = item.options || item.item_option || [];
    
    return activeFilters.every(filter => {
      switch (filter.type) {
        case 'range':
          return this.checkRangeFilter(options, filter);
        case 'select':
        case 'selection':
          return this.checkSelectionFilter(options, filter);
        case 'enchant':
          return this.checkEnchantFilter(item, filter);
        case 'reforge-option':
          return this.checkReforgeOptionFilter(item, filter);
        case 'reforge-status':
          return this.checkReforgeStatusFilter(item, filter);
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
   * @param {Array} options 아이템 옵션 배열
   * @param {Object} filter 필터 객체
   * @returns {boolean} 필터 통과 여부
   */
  checkRangeFilter(options, filter) {
    const field = filter.field || 'option_value';
    const optionType = filter.name;
    
    const option = options.find(opt => opt.option_type === optionType);
    
    // 옵션이 없으면 기본값으로 0 사용
    if (!option) {
      return filter.min === undefined || 0 >= filter.min;
    }
    
    let value = option[field];
    if (typeof value === 'string') {
      value = parseFloat(value.replace('%', ''));
    } else {
      value = parseFloat(value);
    }
    
    if (isNaN(value)) value = 0;
    
    if (filter.min !== undefined && value < filter.min) {
      return false;
    }
    
    if (filter.max !== undefined && value > filter.max) {
      return false;
    }
    
    return true;
  }

  // 여기에 다른 필터 타입 검사 메서드들 추가
  // checkSelectionFilter, checkEnchantFilter, checkReforgeOptionFilter 등...
  
  checkSelectionFilter(options, filter) {
    const option = options.find(opt => opt.option_type === filter.name);
    if (!option) return false;
    
    const field = filter.field || 'option_value';
    return option[field] === filter.value;
  }
  
  checkEnchantFilter(item, filter) {
    const options = item.options || item.item_option || [];
    const enchants = options.filter(opt => 
      opt.option_type === '인챈트' && opt.option_sub_type === filter.enchantType
    );
    
    if (enchants.length === 0) return false;
    
    for (const enchant of enchants) {
      const match = enchant.option_value.match(/(.*?)\s*\(랭크 (\d+)\)/);
      if (match) {
        const name = match[1].trim();
        const rank = parseInt(match[2]);
        
        if (name === filter.enchantName) {
          if (filter.enchantRank !== undefined) {
            return rank >= filter.enchantRank;
          }
          return true;
        }
      }
    }
    
    return false;
  }
  
  // 기타 필터 체크 메서드들...
}

// 싱글톤 인스턴스 생성 및 내보내기
const optionFilter = new OptionFilter();
export default optionFilter;
