/**
 * option-filter-manager.js
 * 아이템 옵션 필터링 관련 기능
 */

import optionRenderer from './option-renderer.js';

class OptionFilterManager {
  constructor() {
    // 메타데이터 저장 (추후 로드)
    this.metaData = {
      reforges: [],
      setEffects: {}
    };
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
    const filters = [];
    
    // 옵션 필드 표준화
    const options = item.options || item.item_option || [];
    
    // 기본 필터 수집
    if (Array.isArray(options)) {
      options.forEach(option => {
        const processedOption = optionRenderer.processOption(option);
        if (processedOption && processedOption.filter && processedOption.filter !== false) {
          filters.push(processedOption.filter);
        }
      });
      
      // 특수 필터 추가
      this.addSpecialFilters(item, filters);
      
      // 기본값 처리
      this.addDefaultValues(filters, item);
    }
    
    return filters;
  }
  
  /**
   * 특수 필터 추가 (세공, 세트 효과, 특별 개조 등)
   * @param {Object} item 아이템 데이터
   * @param {Array} filters 필터 배열
   */
  addSpecialFilters(item, filters) {
    // 옵션 필드 표준화
    const options = item.options || item.item_option || [];
    
    // 특별 개조 레벨 필터
    this.addSpecialModFilters(item, filters);
    
    // 에르그 필터
    this.addErgFilters(item, filters);
    
    // 세공 필터
    this.addReforgeFilters(item, filters);
    
    // 세트 효과 필터
    this.addSetEffectFilters(item, filters);
  }
  
  /**
   * 특별 개조 필터 추가
   * @param {Object} item 아이템 데이터
   * @param {Array} filters 필터 배열
   */
  addSpecialModFilters(item, filters) {
    const options = item.options || item.item_option || [];
    const specialModOption = options.find(opt => 
      opt.option_type === '특별개조'
    );
    
    if (!specialModOption) return;
    
    // 특별 개조 타입은 option-renderer.js에서 이미 추가
    
    // 특별 개조 단계 필터
    filters.push({
      name: '특별개조 단계',
      value: parseInt(specialModOption.option_value),
      type: 'range'
    });
  }
  
  /**
   * 에르그 필터 추가
   * @param {Object} item 아이템 데이터
   * @param {Array} filters 필터 배열
   */
  addErgFilters(item, filters) {
    const options = item.options || item.item_option || [];
    const ergOption = options.find(opt => 
      opt.option_type === '에르그'
    );
    
    if (!ergOption) return;
    
    // 에르그 등급은 option-renderer.js에서 이미 추가
    
    // 에르그 레벨 필터
    filters.push({
      name: '에르그 레벨',
      value: parseInt(ergOption.option_value),
      type: 'range'
    });
  }
  
  /**
   * 세공 필터 추가
   * @param {Object} item 아이템 데이터
   * @param {Array} filters 필터 배열
   */
  addReforgeFilters(item, filters) {
    const options = item.options || item.item_option || [];
    
    // 세공 옵션 찾기
    const reforgeOptions = options.filter(opt => 
      opt.option_type === '세공 옵션'
    );
    
    if (reforgeOptions.length === 0) return;
    
    reforgeOptions.forEach(opt => {
      // "스매시 대미지(18레벨:180 % 증가)" 형식 파싱
      const match = opt.option_value.match(/(.*?)\((\d+)레벨:(.*)\)/);
      if (!match) return;
      
      const name = match[1].trim();
      const level = parseInt(match[2]);
      
      filters.push({
        name: `세공: ${name}`,
        value: level,
        type: 'range',
        category: '세공'
      });
    });
  }
  
  /**
   * 세트 효과 필터 추가
   * @param {Object} item 아이템 데이터
   * @param {Array} filters 필터 배열
   */
  addSetEffectFilters(item, filters) {
    const options = item.options || item.item_option || [];
    const setEffects = options.filter(opt => 
      opt.option_type === '세트 효과'
    );
    
    if (setEffects.length === 0) return;
    
    setEffects.forEach(effect => {
      filters.push({
        name: `세트: ${effect.option_value}`,
        value: parseInt(effect.option_value2),
        type: 'range',
        category: '세트 효과'
      });
    });
  }
  
  /**
   * 기본값 처리
   * @param {Array} filters 필터 배열
   * @param {Object} item 아이템 데이터
   */
  addDefaultValues(filters, item) {
    // 부상률 기본값 (없으면 0)
    const hasInjury = filters.some(f => f.name === '최대부상률');
    if (!hasInjury) {
      filters.push({
        name: '최대부상률',
        value: 0,
        type: 'range',
        isPercent: true
      });
    }
    
    // 피어싱 레벨 기본값 (없으면 0)
    const hasPiercing = filters.some(f => f.name === '피어싱 레벨');
    if (!hasPiercing) {
      filters.push({
        name: '피어싱 레벨',
        value: 0,
        type: 'range'
      });
    }
    
    // 남은 전용 해제 가능 횟수 기본값 (없으면 8)
    const hasUnlock = filters.some(f => f.name === '남은 전용 해제 가능 횟수');
    if (!hasUnlock) {
      filters.push({
        name: '남은 전용 해제 가능 횟수',
        value: 8,
        type: 'range'
      });
    }
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
    
    return items.filter(item => {
      // 모든 활성 필터를 통과해야 함
      return activeFilters.every(filter => {
        // 필터 로직에 따라 처리
        switch (filter.type) {
          case 'range':
            return this.checkRangeFilter(item, filter);
          case 'selection':
            return this.checkSelectionFilter(item, filter);
          default:
            return true;
        }
      });
    });
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
          return this.checkSelectionFilter(item, filter);
        default:
          return true;
      }
    });
  }
  
  /**
   * 일반 필터 처리
   * @param {Object} item 아이템 데이터
   * @param {Object} filter 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkRangeFilter(item, filter) {
    // 특수 필터 처리
    if (filter.name.startsWith('세공:')) {
      return this.checkReforgeFilter(item, filter);
    } else if (filter.name.startsWith('세트:')) {
      return this.checkSetEffectFilter(item, filter);
    } else if (filter.name === '특별개조 단계') {
      return this.checkSpecialModLevelFilter(item, filter);
    } else if (filter.name === '에르그 레벨') {
      return this.checkErgLevelFilter(item, filter);
    }
    
    // 일반 필터 처리
    const itemFilters = this.extractFilters(item);
    const itemFilter = itemFilters.find(f => f.name === filter.name);
    
    if (!itemFilter) return false;
    
    const value = itemFilter.value;
    
    // 범위 검사
    if (filter.min !== undefined && value < filter.min) return false;
    if (filter.max !== undefined && value > filter.max) return false;
    
    return true;
  }
  
  /**
   * 선택형 필터 확인
   * @param {Object} item 아이템 데이터
   * @param {Object} filter 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkSelectionFilter(item, filter) {
    // 특수 필터 처리
    if (filter.name === '특별개조 타입') {
      return this.checkSpecialModTypeFilter(item, filter);
    } else if (filter.name === '에르그 등급') {
      return this.checkErgGradeFilter(item, filter);
    }
    
    // 일반 필터 처리
    const itemFilters = this.extractFilters(item);
    const itemFilter = itemFilters.find(f => f.name === filter.name);
    
    if (!itemFilter) return false;
    
    return itemFilter.value === filter.value;
  }
  
  /**
   * 세공 필터 확인
   * @param {Object} item 아이템 데이터
   * @param {Object} filter 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkReforgeFilter(item, filter) {
    const options = item.options || item.item_option || [];
    if (!Array.isArray(options)) return false;
    
    // 필터 이름에서 세공 이름 추출 ('세공: ' 제거)
    const reforgeName = filter.name.substring(4);
    
    // 세공 옵션 중 이름과 레벨이 조건에 맞는지 확인
    const reforgeOptions = options.filter(opt => 
      opt.option_type === '세공 옵션'
    );
    
    for (const opt of reforgeOptions) {
      const match = opt.option_value.match(/(.*?)\((\d+)레벨:(.*)\)/);
      if (!match) continue;
      
      const name = match[1].trim();
      const level = parseInt(match[2]);
      
      // 이름 일치 확인
      if (name !== reforgeName) continue;
      
      // 레벨 범위 확인
      if (filter.min !== undefined && level < filter.min) continue;
      if (filter.max !== undefined && level > filter.max) continue;
      
      return true;
    }
    
    return false;
  }
  
  /**
   * 세트 효과 필터 확인
   * @param {Object} item 아이템 데이터
   * @param {Object} filter 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkSetEffectFilter(item, filter) {
    const options = item.options || item.item_option || [];
    if (!Array.isArray(options)) return false;
    
    // 필터 이름에서 세트 효과 이름 추출 ('세트: ' 제거)
    const setEffectName = filter.name.substring(4);
    
    // 세트 효과 중 이름과 값이 조건에 맞는지 확인
    const setEffects = options.filter(opt => 
      opt.option_type === '세트 효과'
    );
    
    for (const effect of setEffects) {
      // 이름 일치 확인
      if (effect.option_value !== setEffectName) continue;
      
      const value = parseInt(effect.option_value2);
      
      // 값 범위 확인
      if (filter.min !== undefined && value < filter.min) continue;
      if (filter.max !== undefined && value > filter.max) continue;
      
      return true;
    }
    
    return false;
  }
  
  /**
   * 특별 개조 타입 필터 확인
   * @param {Object} item 아이템 데이터
   * @param {Object} filter 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkSpecialModTypeFilter(item, filter) {
    const options = item.options || item.item_option || [];
    if (!Array.isArray(options)) return false;
    
    const specialMod = options.find(opt => 
      opt.option_type === '특별개조'
    );
    
    if (!specialMod) return false;
    
    return specialMod.option_sub_type === filter.value;
  }
  
  /**
   * 특별 개조 레벨 필터 확인
   * @param {Object} item 아이템 데이터
   * @param {Object} filter 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkSpecialModLevelFilter(item, filter) {
    const options = item.options || item.item_option || [];
    if (!Array.isArray(options)) return false;
    
    const specialMod = options.find(opt => 
      opt.option_type === '특별개조'
    );
    
    if (!specialMod) return false;
    
    const level = parseInt(specialMod.option_value);
    
    // 범위 검사
    if (filter.min !== undefined && level < filter.min) return false;
    if (filter.max !== undefined && level > filter.max) return false;
    
    return true;
  }
  
  /**
   * 에르그 등급 필터 확인
   * @param {Object} item 아이템 데이터
   * @param {Object} filter 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkErgGradeFilter(item, filter) {
    const options = item.options || item.item_option || [];
    if (!Array.isArray(options)) return false;
    
    const ergOption = options.find(opt => 
      opt.option_type === '에르그'
    );
    
    if (!ergOption) return false;
    
    return ergOption.option_sub_type === filter.value;
  }
  
  /**
   * 에르그 레벨 필터 확인
   * @param {Object} item
  /**
   * 에르그 레벨 필터 확인
   * @param {Object} item 아이템 데이터
   * @param {Object} filter 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkErgLevelFilter(item, filter) {
    const options = item.options || item.item_option || [];
    if (!Array.isArray(options)) return false;
    
    const ergOption = options.find(opt => 
      opt.option_type === '에르그'
    );
    
    if (!ergOption) return false;
    
    const level = parseInt(ergOption.option_value);
    
    // 범위 검사
    if (filter.min !== undefined && level < filter.min) return false;
    if (filter.max !== undefined && level > filter.max) return false;
    
    return true;
  }
  
  /**
   * 필터 분류 및 그룹화
   * @param {Array} filters 필터 배열
   * @returns {Object} 분류된 필터 정보
   */
  categorizeFilters(filters) {
    // 고급 필터 분리
    const basicFilters = filters.filter(f => f.visible !== false);
    const advancedFilters = filters.filter(f => f.visible === false);
    
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
      } else if (['특별개조 타입', '특별개조 단계', '에르그 등급', '에르그 레벨'].includes(filter.name)) {
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

// 싱글톤 인스턴스 생성 및 내보내기
const optionFilterManager = new OptionFilterManager();
export default optionFilterManager;
