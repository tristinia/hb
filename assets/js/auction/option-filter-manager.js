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
    
    // 디버그 모드 설정
    this.debug = false;
  }

  /**
   * 디버그 로그 출력
   * @param {...any} args 로그 인자들
   */
  logDebug(...args) {
    if (this.debug) {
      console.log(...args);
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
    // 옵션 렌더러를 통해 필터 정보 추출
    return optionRenderer.extractFilters(item);
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
        default:
          return true;
      }
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
    if (!Array.isArray(options)) return false;
    
    // 옵션 찾기 (이름으로)
    const option = options.find(opt => opt.option_type === filter.name);
    if (!option) return false;
    
    // 필터 필드 결정 (기본값은 option_value)
    const field = filter.field || 'option_value';
    
    // 값 추출 및 파싱
    let value;
    if (field in option) {
      const rawValue = option[field];
      // 문자열이면 % 제거 후 숫자로 변환
      value = typeof rawValue === 'string' 
        ? parseFloat(rawValue.replace('%', '')) 
        : parseFloat(rawValue);
    } else {
      return false;
    }
    
    // 숫자 변환 실패 시
    if (isNaN(value)) {
      return false;
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
   * 선택형 필터 체크
   * @param {Object} item 아이템 데이터
   * @param {Object} filter 필터 정보
   * @returns {boolean} 필터 통과 여부
   */
  checkSelectionFilter(item, filter) {
    const options = item.options || item.item_option || [];
    if (!Array.isArray(options)) return false;
    
    // 옵션 찾기 (이름으로)
    const option = options.find(opt => opt.option_type === filter.name);
    if (!option) return false;
    
    // 필터 필드 결정 (기본값은 option_value)
    const field = filter.field || 'option_value';
    
    // 값 비교
    return option[field] === filter.value;
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

// 싱글톤 인스턴스 생성 및 내보내기
const optionFilterManager = new OptionFilterManager();
export default optionFilterManager;
