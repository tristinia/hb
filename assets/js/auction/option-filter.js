/**
 * OptionFilter 모듈
 * 
 * 아이템 옵션 기반 필터링 처리를 위한 통합 모듈
 * 옵션 추출, 메타데이터 관리, 필터 적용 기능 제공
 */

import metadataLoader from './metadata-loader.js';

class OptionFilter {
  constructor() {
    this.metadata = {
      reforges: null,
      setEffects: {},
      enchants: {
        prefix: null,
        suffix: null
      }
    };
    
    this.filterRegistry = {
      'range': this.checkRangeFilter.bind(this),
      'selection': this.checkSelectionFilter.bind(this),
      'select': this.checkSelectionFilter.bind(this),
      'enchant': this.checkEnchantFilter.bind(this),
      'reforge-option': this.checkReforgeOptionFilter.bind(this),
      'reforge-status': this.checkReforgeStatusFilter.bind(this),
      'erg': this.checkErgFilter.bind(this),
      'special-mod': this.checkSpecialModFilter.bind(this),
      'set-effect': this.checkSetEffectFilter.bind(this)
    };
    
    this.debug = false;
  }

  /**
   * 모듈 초기화
   * @param {Object} options 초기화 옵션
   * @returns {Promise<boolean>} 초기화 성공 여부
   */
  async initialize(options = {}) {
    try {
      if (options.debug !== undefined) {
        this.debug = !!options.debug;
      }
      
      // 필수 메타데이터 로드
      await Promise.all([
        this.loadEnchantMetadata(),
        this.loadReforgeMetadata()
      ]);
      
      this.log('필터 모듈 초기화 완료');
      return true;
    } catch (error) {
      console.error('필터 모듈 초기화 오류:', error);
      return false;
    }
  }
  
  /**
   * 인챈트 메타데이터 로드
   * @returns {Promise<void>}
   */
  async loadEnchantMetadata() {
    try {
      this.metadata.enchants.prefix = await metadataLoader.loadEnchantMetadata('prefix');
      this.metadata.enchants.suffix = await metadataLoader.loadEnchantMetadata('suffix');
      this.log('인챈트 메타데이터 로드 완료');
    } catch (error) {
      this.log('인챈트 메타데이터 로드 실패:', error);
    }
  }
  
  /**
   * 세공 메타데이터 로드
   * @returns {Promise<void>}
   */
  async loadReforgeMetadata() {
    try {
      this.metadata.reforges = await metadataLoader.loadReforgeMetadata();
      this.log('세공 메타데이터 로드 완료');
    } catch (error) {
      this.log('세공 메타데이터 로드 실패:', error);
    }
  }
  
  /**
   * 카테고리별 세트 효과 메타데이터 로드
   * @param {string} category 카테고리명
   * @returns {Promise<Object>} 세트 효과 메타데이터
   */
  async loadSetEffectMetadata(category) {
    if (!category) return null;
    
    if (this.metadata.setEffects[category]) {
      return this.metadata.setEffects[category];
    }
    
    try {
      const data = await metadataLoader.loadSetEffectForCategory(category);
      if (data) {
        this.metadata.setEffects[category] = data;
        this.log(`카테고리 ${category} 세트 효과 로드 완료`);
      }
      return data;
    } catch (error) {
      this.log(`카테고리 ${category} 세트 효과 로드 실패:`, error);
      return null;
    }
  }
  
  /**
   * 디버그 로그 출력
   * @param {...any} args 로그 인자들
   */
  log(...args) {
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
    if (!Array.isArray(options) || options.length === 0) {
      return [];
    }
    
    const filters = [];
    const extractors = {
      '공격': (option) => ({
        name: '공격',
        displayName: '최대 공격력',
        type: 'range',
        field: 'option_value2'
      }),
      
      '내구력': (option) => ({
        name: '내구력',
        displayName: '최대 내구력',
        type: 'range',
        field: 'option_value2'
      }),
      
      '밸런스': (option) => ({
        name: '밸런스',
        displayName: '밸런스',
        type: 'range',
        field: 'option_value',
        isPercent: true
      }),
      
      '방어력': (option) => ({
        name: '방어력',
        displayName: '방어력',
        type: 'range',
        field: 'option_value'
      }),
      
      '보호': (option) => ({
        name: '보호',
        displayName: '보호',
        type: 'range',
        field: 'option_value'
      }),
      
      '마법 방어력': (option) => ({
        name: '마법 방어력',
        displayName: '마법 방어력',
        type: 'range',
        field: 'option_value'
      }),
      
      '마법 보호': (option) => ({
        name: '마법 보호',
        displayName: '마법 보호',
        type: 'range',
        field: 'option_value'
      }),
      
      '크리티컬': (option) => ({
        name: '크리티컬',
        displayName: '크리티컬',
        type: 'range',
        field: 'option_value'
      }),
      
      '피어싱 레벨': (option) => ({
        name: '피어싱 레벨',
        displayName: '피어싱 레벨',
        type: 'range'
      }),
      
      '인챈트': (option) => ({
        name: '인챈트',
        displayName: '인챈트',
        type: 'enchant',
        subTypes: ['접두', '접미']
      }),
      
      '특별 개조': (option) => ({
        name: '특별 개조',
        displayName: '특수 개조',
        type: 'special-mod'
      }),
      
      '에르그': (option) => ({
        name: '에르그',
        displayName: '에르그',
        type: 'erg'
      }),
      
      '세공 랭크': (option) => ({
        name: '세공 랭크',
        displayName: '세공',
        type: 'reforge-status'
      }),
      
      '세공 옵션': (option) => ({
        name: '세공 옵션',
        displayName: '세공 옵션',
        type: 'reforge-option'
      }),
      
      '세트 효과': (option) => ({
        name: '세트 효과',
        displayName: '세트 효과',
        type: 'set-effect'
      })
    };
    
    options.forEach(option => {
      const optionType = option.option_type;
      if (!optionType || !extractors[optionType]) {
        return;
      }
      
      // 옵션 추출 함수 실행
      const filterInfo = extractors[optionType](option);
      
      // 원본 옵션 참조 추가
      filterInfo.option = option;
      
      filters.push(filterInfo);
    });
    
    return filters;
  }

  /**
   * 필터 적용
   * @param {Array} items 아이템 배열
   * @param {Array} filters 적용할 필터 배열
   * @returns {Array} 필터링된 아이템 배열
   */
  applyFilters(items, filters) {
    if (!filters || filters.length === 0) {
      return items;
    }
    
    if (!items || !Array.isArray(items)) {
      return [];
    }
    
    return items.filter(item => this.itemPassesFilters(item, filters));
  }

  /**
   * 아이템이 모든 필터를 통과하는지 확인
   * @param {Object} item 아이템 정보
   * @param {Array} filters 적용할 필터 배열
   * @returns {boolean} 필터 통과 여부
   */
  itemPassesFilters(item, filters) {
    if (!filters || filters.length === 0) {
      return true;
    }
    
    return filters.every(filter => {
      const handler = this.filterRegistry[filter.type];
      
      if (typeof handler === 'function') {
        return handler(item, filter);
      }
      
      return true;
    });
  }

  /**
   * 범위 필터 체크
   * @param {Object} item 아이템 데이터
   * @param {Object} filter 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkRangeFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 해당 옵션 찾기
    const option = options.find(opt => opt.option_type === filter.name);
    
    // 옵션이 없는 경우 처리 - 필터 값이 있으면 실패, 없으면 통과
    if (!option) {
      if ((filter.min !== undefined && filter.min !== null && filter.min !== '' && parseFloat(filter.min) > 0) ||
          (filter.max !== undefined && filter.max !== null && filter.max !== '' && parseFloat(filter.max) > 0)) {
        return false;
      }
      return true;
    }
    
    // 값 계산
    let value;
    
    // 특수 케이스: 피어싱 레벨
    if (filter.name === '피어싱 레벨') {
      const baseLevel = parseInt(option.option_value || "0");
      const additionalLevel = option.option_value2 ? 
        parseInt(option.option_value2.replace(/\+/g, '')) : 0;
      value = baseLevel + additionalLevel;
    } else {
      // 일반 케이스
      const field = filter.field || 'option_value';
      
      if (option[field] === undefined || option[field] === null) {
        value = 0;
      } else {
        // 문자열 값 정리 (%, 기타 문자 제거)
        if (typeof option[field] === 'string') {
          value = parseFloat(option[field].replace(/[^0-9.-]/g, ''));
        } else {
          value = parseFloat(option[field]);
        }
      }
    }
    
    // 유효한 숫자로 변환
    value = isNaN(value) ? 0 : value;
    
    // 범위 검사
    const minValue = filter.min !== undefined && filter.min !== null && filter.min !== '' 
      ? parseFloat(filter.min) : undefined;
      
    const maxValue = filter.max !== undefined && filter.max !== null && filter.max !== '' 
      ? parseFloat(filter.max) : undefined;
    
    if (minValue !== undefined && value < minValue) {
      return false;
    }
    
    if (maxValue !== undefined && value > maxValue) {
      return false;
    }
    
    return true;
  }

  /**
   * 선택형 필터 체크
   * @param {Object} item 아이템 데이터
   * @param {Object} filter 필터 정보
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
    
    // 필드 및 값 검사
    const field = filter.field || 'option_value';
    const value = option[field];
    
    return value === filter.value;
  }

  /**
   * 인챈트 필터 체크
   * @param {Object} item 아이템 데이터
   * @param {Object} filter 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkEnchantFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 접두 인챈트 검사
    if (filter.prefixEnchant && filter.prefixEnchant.trim() !== '') {
      const prefixEnchants = options.filter(opt => 
        opt.option_type === '인챈트' && opt.option_sub_type === '접두'
      );
      
      if (prefixEnchants.length === 0) {
        return false;
      }
      
      const searchTerm = filter.prefixEnchant.toLowerCase().trim();
      const hasMatchingPrefix = prefixEnchants.some(enchant => {
        const value = (enchant.option_value || '').toLowerCase();
        return value.includes(searchTerm);
      });
      
      if (!hasMatchingPrefix) {
        return false;
      }
    }
    
    // 접미 인챈트 검사
    if (filter.suffixEnchant && filter.suffixEnchant.trim() !== '') {
      const suffixEnchants = options.filter(opt => 
        opt.option_type === '인챈트' && opt.option_sub_type === '접미'
      );
      
      if (suffixEnchants.length === 0) {
        return false;
      }
      
      const searchTerm = filter.suffixEnchant.toLowerCase().trim();
      const hasMatchingSuffix = suffixEnchants.some(enchant => {
        const value = (enchant.option_value || '').toLowerCase();
        return value.includes(searchTerm);
      });
      
      if (!hasMatchingSuffix) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 세공 상태 필터 체크
   * @param {Object} item 아이템 데이터
   * @param {Object} filter 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkReforgeStatusFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 세공 랭크 옵션 찾기
    const reforgeRankOption = options.find(opt => opt.option_type === '세공 랭크');
    
    if (!reforgeRankOption) {
      return false;
    }
    
    // 랭크 검사
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
   * 에르그 필터 체크
   * @param {Object} item 아이템 데이터
   * @param {Object} filter 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkErgFilter(item, filter) {
    const options = item.options || item.item_option || [];
    
    // 에르그 옵션 찾기
    const ergOption = options.find(opt => opt.option_type === '에르그');
    
    if (!ergOption) {
      return false;
    }
    
    // 등급 검사
    if (filter.grade && ergOption.option_sub_type !== filter.grade) {
      return false;
    }
    
    // 레벨 검사
    const level = parseInt(ergOption.option_value || "0");
    
    // 최소 레벨
    if (filter.minLevel) {
      const minLevel = parseInt(filter.minLevel);
      if (!isNaN(minLevel) && level < minLevel) {
        return false;
      }
    }
    
    // 최대 레벨
    if (filter.maxLevel) {
      const maxLevel = parseInt(filter.maxLevel);
      if (!isNaN(maxLevel) && level > maxLevel) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 세공 옵션 필터 체크
   * @param {Object} item 아이템 데이터
   * @param {Object} filter 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkReforgeOptionFilter(item, filter) {
    const options = item.options || item.item_option || [];
    const reforgeOptions = options.filter(opt => opt.option_type === '세공 옵션');
    
    if (reforgeOptions.length === 0) {
      return false;
    }
    
    // 필터 옵션이 없거나 배열이 아닌 경우 처리
    if (!filter.options || !Array.isArray(filter.options)) {
      return true;
    }
    
    // 각 필터 옵션 검사
    return filter.options.every(filterOption => {
      // 빈 필터 옵션은 무시
      if (!filterOption.name || filterOption.name.trim() === '') {
        return true;
      }
      
      // 옵션 이름 검색
      const searchTerm = filterOption.name.toLowerCase().trim();
      const matchingOptions = reforgeOptions.filter(opt => {
        const optionValue = (opt.option_value || '').toLowerCase();
        return optionValue.includes(searchTerm);
      });
      
      if (matchingOptions.length === 0) {
        return false;
      }
      
      // 레벨 범위 검사가 없으면 통과
      if (!filterOption.minLevel && !filterOption.maxLevel) {
        return true;
      }
      
      // 하나 이상의 옵션이 레벨 범위를 만족하는지 확인
      return matchingOptions.some(opt => {
        // "(20레벨:40 증가)" 형식에서 레벨 추출
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
   * 세트 효과 필터 체크
   * @param {Object} item 아이템 데이터
   * @param {Object} filter 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkSetEffectFilter(item, filter) {
    const options = item.options || item.item_option || [];
    const setEffectOptions = options.filter(opt => opt.option_type === '세트 효과');
    
    if (setEffectOptions.length === 0) {
      return false;
    }
    
    // 필터 효과가 없거나 배열이 아닌 경우 처리
    if (!filter.effects || !Array.isArray(filter.effects)) {
      return true;
    }
    
    // 각 필터 효과 검사
    return filter.effects.every(filterEffect => {
      // 빈 필터 효과는 무시
      if (!filterEffect.name || filterEffect.name.trim() === '') {
        return true;
      }
      
      // 효과 이름 검색
      const searchTerm = filterEffect.name.toLowerCase().trim();
      const matchingEffects = setEffectOptions.filter(opt => {
        const effectValue = (opt.option_value || '').toLowerCase();
        return effectValue.includes(searchTerm);
      });
      
      if (matchingEffects.length === 0) {
        return false;
      }
      
      // 수치 범위 검사가 없으면 통과
      if (!filterEffect.minValue && !filterEffect.maxValue) {
        return true;
      }
      
      // 하나 이상의 효과가 수치 범위를 만족하는지 확인
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
   * 특별 개조 필터 체크
   * @param {Object} item 아이템 데이터
   * @param {Object} filter 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkSpecialModFilter(item, filter) {
    const options = item.options || item.item_option || [];
    const specialMods = options.filter(opt => opt.option_type === '특별 개조');
    
    if (specialMods.length === 0) {
      return false;
    }
    
    // 타입 필터가 없는 경우
    if (!filter.modType) {
      // 단계 범위 필터도 없으면 통과
      if (!filter.minLevel && !filter.maxLevel) {
        return true;
      }
      
      // 하나라도 단계 범위를 만족하면 통과
      return specialMods.some(mod => this.checkSpecialModLevel(mod, filter));
    }
    
    // 타입 필터가 있는 경우
    const typeFilteredMods = specialMods.filter(mod => 
      mod.option_sub_type === filter.modType
    );
    
    if (typeFilteredMods.length === 0) {
      return false;
    }
    
    // 단계 범위 필터가 없으면 통과
    if (!filter.minLevel && !filter.maxLevel) {
      return true;
    }
    
    // 하나라도 단계 범위를 만족하면 통과
    return typeFilteredMods.some(mod => this.checkSpecialModLevel(mod, filter));
  }
  
  /**
   * 특별 개조 단계 확인
   * @param {Object} mod 특별 개조 옵션
   * @param {Object} filter 필터 정보
   * @returns {boolean} 레벨 통과 여부
   */
  checkSpecialModLevel(mod, filter) {
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
  }

  /**
   * 필터 분류 및 그룹화
   * @param {Array} filters 필터 배열
   * @returns {Object} 분류된 필터 정보
   */
  categorizeFilters(filters) {
    // 기본 필터 카테고리
    const categories = {
      '기본': [],
      '세공': [],
      '세트 효과': [],
      '특수': []
    };
    
    filters.forEach(filter => {
      // 필터 카테고리 결정
      if (filter.category === '세공' || 
          ['세공 랭크', '세공 옵션'].includes(filter.name)) {
        categories['세공'].push(filter);
      } 
      else if (filter.category === '세트 효과' || 
               filter.name === '세트 효과') {
        categories['세트 효과'].push(filter);
      } 
      else if (['특별 개조', '에르그'].includes(filter.name) || 
               ['특별개조 타입', '특별개조 단계', '에르그 등급', '에르그 레벨'].includes(filter.displayName)) {
        categories['특수'].push(filter);
      } 
      else {
        categories['기본'].push(filter);
      }
    });
    
    return {
      categories,
      advancedFilters: []
    };
  }
}

// 싱글톤 인스턴스 생성
const optionFilter = new OptionFilter();

export default optionFilter;
