/**
 * 아이템 옵션 필터링 모듈
 * option-filter-manager.js와 option-filter.js를 통합
 */

import optionRenderer from './option-renderer.js';
import metadataLoader from './metadata-loader.js';

class OptionFilter {
  constructor() {
    // 메타데이터 저장 (추후 로드)
    this.metaData = {
      reforges: [],
      setEffects: {}
    };
    
    // 디버그 모드 설정
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
   * 메타데이터 설정
   * @param {Object} metaData 메타데이터
   */
  setMetaData(metaData) {
    this.metaData = metaData;
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
            displayName: '에르그',
            type: 'erg',
            option,
            definition: { type: 'erg' }
          });
          break;
          
        case '세공 랭크':
          filters.push({
            name: optionType,
            displayName: '세공',
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
            type: 'set-effect',
            option,
            definition: { 
              type: 'set-effect'
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

  /**
   * 필터 적용
   * @param {Array} items 아이템 배열
   * @param {Array} activeFilters 활성화된 필터 배열
   * @returns {Array} 필터링된 아이템 배열
   */
  applyFilters(items, activeFilters) {
    if (!activeFilters || activeFilters.length === 0) {
      return items;
    }
    
    return items.filter(item => this.itemPassesFilters(item, activeFilters));
  }
  
  /**
   * 아이템이 필터를 통과하는지 확인
   * @param {Object} item 아이템 데이터
   * @param {Array} activeFilters 활성화된 필터 배열
   * @returns {boolean} 필터 통과 여부
   */
  itemPassesFilters(item, activeFilters) {
    // 필터가 없으면 항상 통과
    if (!activeFilters || activeFilters.length === 0) {
      return true;
    }
    
    // 각 필터를 모두 통과해야 함
    return activeFilters.every(filter => {
      switch (filter.type) {
        case 'range':
          return this.checkRangeFilter(item, filter);
        case 'selection':
        case 'select':
          return this.checkSelectionFilter(item, filter);
        case 'enchant':
          return this.checkEnchantFilter(item, filter);
        case 'reforge-option':
          return this.checkReforgeOptionFilter(item, filter);
        case 'reforge-status':
          return this.checkReforgeStatusFilter(item, filter);
        case 'erg':
          return this.checkErgFilter(item, filter);
        case 'special-mod':
          return this.checkSpecialModFilter(item, filter);
        case 'set-effect':
          return this.checkSetEffectFilter(item, filter);
        default:
          return true;
      }
    });
  }

  /**
   * 범위 필터 체크
   * @param {Object} item - 아이템 데이터
   * @param {Object} filter - 필터 정보
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

  /**
   * 선택 필터 체크
   * @param {Object} item - 아이템 데이터
   * @param {Object} filter - 필터 정보
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
   * 인챈트 필터 확인
   * @param {Object} item - 아이템 데이터
   * @param {Object} filter - 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkEnchantFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 접두 인챈트 필터
    if (filter.prefixEnchant && filter.prefixEnchant.trim() !== '') {
      const prefixEnchants = options.filter(opt => 
        opt.option_type === '인챈트' && opt.option_sub_type === '접두'
      );
      
      // 접두 인챈트가 없으면 실패
      if (prefixEnchants.length === 0) return false;
      
      // 접두 인챈트 검색 - 부분 일치로 변경
      const searchTerm = filter.prefixEnchant.toLowerCase().trim();
      const hasMatchingPrefix = prefixEnchants.some(enchant => {
        const value = (enchant.option_value || '').toLowerCase();
        return value.includes(searchTerm);
      });
      
      if (!hasMatchingPrefix) return false;
    }
    
    // 접미 인챈트 필터
    if (filter.suffixEnchant && filter.suffixEnchant.trim() !== '') {
      const suffixEnchants = options.filter(opt => 
        opt.option_type === '인챈트' && opt.option_sub_type === '접미'
      );
      
      // 접미 인챈트가 없으면 실패
      if (suffixEnchants.length === 0) return false;
      
      // 접미 인챈트 검색 - 부분 일치로 변경
      const searchTerm = filter.suffixEnchant.toLowerCase().trim();
      const hasMatchingSuffix = suffixEnchants.some(enchant => {
        const value = (enchant.option_value || '').toLowerCase();
        return value.includes(searchTerm);
      });
      
      if (!hasMatchingSuffix) return false;
    }
    
    return true;
  }

  /**
   * 세공 상태 필터 확인
   * @param {Object} item - 아이템 데이터
   * @param {Object} filter - 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkReforgeStatusFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 세공 랭크 옵션 찾기
    const reforgeRankOption = options.find(opt => opt.option_type === '세공 랭크');
    
    // 세공 랭크가 없으면 실패
    if (!reforgeRankOption) {
      return false;
    }
    
    // 세공 랭크 검사
    if (filter.rank) {
      const rank = parseInt(reforgeRankOption.option_value);
      const filterRank = parseInt(filter.rank);
      
      if (isNaN(rank) || rank !== filterRank) {
        return false;
      }
    }
    
    // 줄 수 검사
    if (filter.lineCount) {
      const reforgeOptions = options.filter(opt => opt.option_type === '세공 옵션');
      const lineCount = reforgeOptions.length;
      const filterLineCount = parseInt(filter.lineCount);
      
      if (lineCount !== filterLineCount) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * 에르그 필터 확인
   * @param {Object} item - 아이템 데이터
   * @param {Object} filter - 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkErgFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 에르그 옵션 찾기
    const ergOption = options.find(opt => opt.option_type === '에르그');
    
    // 에르그가 없으면 실패
    if (!ergOption) {
      return false;
    }
    
    // 등급 검사
    if (filter.grade && ergOption.option_sub_type !== filter.grade) {
      return false;
    }
    
    // 레벨 범위 검사
    const level = parseInt(ergOption.option_value || "0");
    
    // 최소 레벨 검사
    if (filter.minLevel) {
      const minLevel = parseInt(filter.minLevel);
      if (!isNaN(minLevel) && level < minLevel) {
        return false;
      }
    }
    
    // 최대 레벨 검사
    if (filter.maxLevel) {
      const maxLevel = parseInt(filter.maxLevel);
      if (!isNaN(maxLevel) && level > maxLevel) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * 세공 옵션 필터 확인
   * @param {Object} item - 아이템 데이터
   * @param {Object} filter - 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkReforgeOptionFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 세공 옵션 찾기
    const reforgeOptions = options.filter(opt => opt.option_type === '세공 옵션');
    
    // 세공 옵션이 없으면 실패
    if (reforgeOptions.length === 0) {
      return false;
    }
    
    // 각 필터 옵션에 대해 검사
    return filter.options.every(filterOption => {
      // 빈 필터 옵션은 무시
      if (!filterOption.name || filterOption.name.trim() === '') {
        return true;
      }
      
      // 옵션 이름으로 필터링 - 부분 일치로 변경
      const searchTerm = filterOption.name.toLowerCase().trim();
      const matchingOptions = reforgeOptions.filter(opt => {
        const optionValue = (opt.option_value || '').toLowerCase();
        return optionValue.includes(searchTerm);
      });
      
      // 일치하는 옵션이 없으면 실패
      if (matchingOptions.length === 0) {
        return false;
      }
      
      // 레벨 범위 검사가 없으면 성공
      if (!filterOption.minLevel && !filterOption.maxLevel) {
        return true;
      }
      
      // 최소 한 개의 옵션이 레벨 범위를 만족하면 성공
      return matchingOptions.some(opt => {
        // "(20레벨:40 증가)" 형식 파싱
        const match = opt.option_value && opt.option_value.match(/\((\d+)레벨:/);
        if (!match) return true; // 레벨 정보가 없으면 통과
        
        const level = parseInt(match[1]);
        
        // 최소 레벨 검사
        if (filterOption.minLevel && filterOption.minLevel.trim() !== '') {
          const minLevel = parseInt(filterOption.minLevel);
          if (!isNaN(minLevel) && level < minLevel) {
            return false;
          }
        }
        
        // 최대 레벨 검사
        if (filterOption.maxLevel && filterOption.maxLevel.trim() !== '') {
          const maxLevel = parseInt(filterOption.maxLevel);
          if (!isNaN(maxLevel) && level > maxLevel) {
            return false;
          }
        }
        
        return true;
      });
    });
  }
  
  /**
   * 세트 효과 필터 확인
   * @param {Object} item - 아이템 데이터
   * @param {Object} filter - 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkSetEffectFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 세트 효과 옵션 찾기
    const setEffectOptions = options.filter(opt => opt.option_type === '세트 효과');
    
    // 세트 효과가 없으면 실패
    if (setEffectOptions.length === 0) {
      return false;
    }
    
    // 각 필터 효과에 대해 검사
    return filter.effects.every(filterEffect => {
      // 빈 필터 효과는 무시
      if (!filterEffect.name || filterEffect.name.trim() === '') {
        return true;
      }
      
      // 효과 이름으로 필터링 - 부분 일치로 변경
      const searchTerm = filterEffect.name.toLowerCase().trim();
      const matchingEffects = setEffectOptions.filter(opt => {
        const effectValue = (opt.option_value || '').toLowerCase();
        return effectValue.includes(searchTerm);
      });
      
      // 일치하는 효과가 없으면 실패
      if (matchingEffects.length === 0) {
        return false;
      }
      
      // 수치 범위 검사가 없으면 성공
      if (!filterEffect.minValue && !filterEffect.maxValue) {
        return true;
      }
      
      // 최소 한 개의 효과가 수치 범위를 만족하면 성공
      return matchingEffects.some(opt => {
        const value = parseInt(opt.option_value2 || "0");
        
        // 최소값 검사
        if (filterEffect.minValue && filterEffect.minValue.trim() !== '') {
          const minValue = parseInt(filterEffect.minValue);
          if (!isNaN(minValue) && value < minValue) {
            return false;
          }
        }
        
        // 최대값 검사
        if (filterEffect.maxValue && filterEffect.maxValue.trim() !== '') {
          const maxValue = parseInt(filterEffect.maxValue);
          if (!isNaN(maxValue) && value > maxValue) {
            return false;
          }
        }
        
        return true;
      });
    });
  }
  
  /**
   * 특별 개조 필터 확인
   * @param {Object} item - 아이템 데이터
   * @param {Object} filter - 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
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
      if (!filter.minLevel && !filter.maxLevel) {
        return true;  // 필터 조건이 없으면 통과
      }
      
      // 최소 하나의 특별 개조가 범위를 만족하면 성공
      return specialMods.some(specialMod => {
        // 단계 값 구하기
        const level = parseInt(specialMod.option_value || "0");
        
        // 최소 단계 검사
        if (filter.minLevel) {
          const minLevel = parseInt(filter.minLevel);
          if (!isNaN(minLevel) && level < minLevel) {
            return false;
          }
        }
        
        // 최대 단계 검사
        if (filter.maxLevel) {
          const maxLevel = parseInt(filter.maxLevel);
          if (!isNaN(maxLevel) && level > maxLevel) {
            return false;
          }
        }
        
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
    if (!filter.minLevel && !filter.maxLevel) {
      return true;
    }
    
    // 최소 하나의 타입 일치 특별 개조가 범위를 만족하면 성공
    return typeFilteredMods.some(mod => {
      // 단계 값 구하기
      const level = parseInt(mod.option_value || "0");
      
      // 최소 단계 검사
      if (filter.minLevel) {
        const minLevel = parseInt(filter.minLevel);
        if (!isNaN(minLevel) && level < minLevel) {
          return false;
        }
      }
      
      // 최대 단계 검사
      if (filter.maxLevel) {
        const maxLevel = parseInt(filter.maxLevel);
        if (!isNaN(maxLevel) && level > maxLevel) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * 필터 분류 및 그룹화
   * @param {Array} filters 필터 배열
   * @returns {Object} 분류된 필터 정보
   */
  categorizeFilters(filters) {
    const basicFilters = filters;
    const advancedFilters = [];
    
    // 범주별 그룹화
    const categories = {
      '기본': [],
      '세공': [],
      '세트 효과': [],
      '특수': []
    };
    
    basicFilters.forEach(filter => {
      if (filter.category === '세공') {
        categories['세공'].push(filter);
      } else if (filter.category === '세트 효과') {
        categories['세트 효과'].push(filter);
      } else if (['특별개조 타입', '특별개조 단계', '에르그 등급', '에르그 레벨'].includes(filter.displayName || filter.name)) {
        categories['특수'].push(filter);
      } else {
        categories['기본'].push(filter);
      }
    });
    
    return {
      categories,
      advancedFilters
    };
  }
}

// 싱글톤 인스턴스 생성
const optionFilter = new OptionFilter();

// 하위 호환성을 위한 optionFilterManager 인스턴스도 동일 객체로 지정
const optionFilterManager = optionFilter;

// 두 인스턴스 모두 내보내기
export { optionFilter as default, optionFilterManager };
