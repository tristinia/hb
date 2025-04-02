/**
 * metadata-loader.js
 * 게임 메타데이터(인챈트, 세공, 세트 효과 등) 로드 및 관리 모듈
 */

/**
 * 메타데이터 로더 클래스
 * 게임 관련 모든 메타데이터 로드 및 관리
 */
class MetadataLoader {
  constructor() {
    // 메타데이터 저장 객체
    this.metadata = {
      enchant: {
        prefix: null,
        suffix: null,
        isLoaded: false
      },
      reforge: {
        data: null,
        isLoaded: false
      },
      setEffect: {
        categories: {},
        isLoaded: false
      }
    };
    
    this.debug = false;
  }
  
  /**
   * 디버그 로그 출력
   * @param {...any} args 로그 인자들
   */
  logDebug(...args) {
    if (this.debug) {
      console.log('[MetadataLoader]', ...args);
    }
  }
  
  /**
   * 초기화 및 기본 메타데이터 로드
   */
  async initialize() {
    try {
      // 병렬로 메타데이터 로드
      await Promise.all([
        this.loadEnchantMetadata(),
        this.loadReforgeMetadata()
      ]);
      
      this.logDebug('모든 기본 메타데이터 로드 완료');
      return true;
    } catch (error) {
      console.error('메타데이터 로드 중 오류 발생:', error);
      return false;
    }
  }
  
  /**
   * 인챈트 메타데이터 로드
   */
  async loadEnchantMetadata() {
    try {
      // 접두사 데이터 로드
      const prefixResponse = await fetch('../data/meta/enchants/prefix.json');
      if (prefixResponse.ok) {
        this.metadata.enchant.prefix = await prefixResponse.json();
      }
      
      // 접미사 데이터 로드
      const suffixResponse = await fetch('../data/meta/enchants/suffix.json');
      if (suffixResponse.ok) {
        this.metadata.enchant.suffix = await suffixResponse.json();
      }
      
      this.metadata.enchant.isLoaded = true;
      this.logDebug('인챈트 메타데이터 로드 완료');
      return true;
    } catch (error) {
      console.error('인챈트 메타데이터 로드 실패:', error);
      return false;
    }
  }
  
  /**
   * 세공 메타데이터 로드
   */
  async loadReforgeMetadata() {
    try {
      const response = await fetch('../data/meta/reforges/reforges.json');
      if (response.ok) {
        this.metadata.reforge.data = await response.json();
        this.metadata.reforge.isLoaded = true;
        this.logDebug('세공 메타데이터 로드 완료');
        return true;
      }
    } catch (error) {
      console.error('세공 메타데이터 로드 실패:', error);
      return false;
    }
  }
  
  /**
   * 카테고리별 세트 효과 메타데이터 로드
   * @param {string} category - 카테고리명
   */
  async loadSetEffectForCategory(category) {
    if (!category) return null;
    
    // 이미 로드된 경우 캐시된 데이터 반환
    if (this.metadata.setEffect.categories[category]) {
      return this.metadata.setEffect.categories[category];
    }
    
    try {
      // 카테고리명 안전하게 변환 (/ -> _)
      const safeCategory = category.replace(/\//g, '_');
      
      const response = await fetch(`../data/meta/set_bonus/${encodeURIComponent(safeCategory)}.json`);
      if (response.ok) {
        const data = await response.json();
        this.metadata.setEffect.categories[category] = data;
        this.logDebug(`카테고리 ${category}의 세트 효과 메타데이터 로드 완료`);
        return data;
      }
    } catch (error) {
      console.warn(`카테고리 ${category}의 세트 효과 메타데이터 로드 실패:`, error);
      return null;
    }
  }
  
  /**
   * 카테고리별 필터 옵션 구조 로드
   * @param {string} category - 카테고리명
   * @returns {Promise<Object>} 필터 구조 객체
   */
  async loadFilterOptionsForCategory(category) {
    if (!category) return null;
    
    try {
      // 카테고리명 안전하게 변환 (/ -> _)
      const safeCategory = category.replace(/\//g, '_');
      
      const response = await fetch(`../data/option_structure/${encodeURIComponent(safeCategory)}.json`);
      
      // 카테고리별 파일이 없는 경우 빈 객체 반환
      if (!response.ok) {  
        return { category, option_types: [] };
      }
      
      const data = await response.json();
      this.logDebug(`카테고리 ${category}의 필터 옵션 구조 로드 완료`);
      return data;
    } catch (error) {
      console.error(`카테고리 ${category}의 필터 옵션 구조 로드 실패:`, error);
      return { category, option_types: [] };
    }
  }
  
  /**
   * 인챈트 메타데이터 검색
   * @param {string} type - 인챈트 타입 ('접두' 또는 '접미')
   * @param {string} name - 인챈트 이름
   * @returns {Object|null} 인챈트 메타데이터
   */
  getEnchantMetadata(type, name) {
    if (!this.metadata.enchant.isLoaded) return null;
    
    const source = type === '접두' ? 'prefix' : 'suffix';
    const data = this.metadata.enchant[source];
    
    // 데이터가 없으면 null 반환
    if (!data || !data.enchants) return null;
    
    // enchants 객체 내에서 인챈트 찾기
    return data.enchants && data.enchants[name] ? data.enchants[name] : null;
  }
  
  /**
   * 인챈트 검색
   * @param {string} type - 인챈트 타입 (접두 or 접미)
   * @param {string} query - 검색어
   * @returns {Array} 검색 결과
   */
  searchEnchants(type, query) {
    if (!query || !this.metadata.enchant.isLoaded) return [];
    
    const source = type === '접두' ? this.metadata.enchant.prefix : this.metadata.enchant.suffix;
    if (!source || !source.enchants) return [];
    
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    // 객체 순회
    for (const name in source.enchants) {
      if (name.toLowerCase().includes(lowerQuery)) {
        const info = source.enchants[name];
        results.push({
          name: name,
          rank: info.rank
        });
      }
    }
    
    return results;
  }
  
  /**
   * 현재 카테고리의 세공 옵션 목록 가져오기
   * @param {string} category - 카테고리명
   * @returns {Array} 세공 옵션 목록
   */
  getReforgeOptionsForCategory(category) {
    if (!this.metadata.reforge.isLoaded || !category) return [];
    
    const reforges = this.metadata.reforge.data?.reforges;
    if (!reforges || !reforges[category]) return [];
    
    return reforges[category];
  }
  
  /**
   * 세공 옵션 검색
   * @param {string} category - 카테고리명
   * @param {string} query - 검색어
   * @returns {Array} 검색 결과
   */
  searchReforgeOptions(category, query) {
    if (!query || !this.metadata.reforge.isLoaded) return [];
    
    const options = this.getReforgeOptionsForCategory(category);
    if (!options) return [];
    
    const lowerQuery = query.toLowerCase();
    
    // 옵션 중 검색어가 포함된 것만 반환
    return options.filter(option => 
      option.toLowerCase().includes(lowerQuery)
    );
  }
  
  /**
   * 현재 카테고리의 세트 효과 목록 가져오기
   * @param {string} category - 카테고리명
   * @returns {Array} 세트 효과 목록
   */
  getSetEffectsForCategory(category) {
    const categoryData = this.metadata.setEffect.categories[category];
    if (!categoryData || !categoryData.set_effects) return [];
    
    return categoryData.set_effects;
  }
  
  /**
   * 세트 효과 검색
   * @param {string} category - 카테고리명
   * @param {string} query - 검색어
   * @returns {Array} 검색 결과
   */
  async searchSetEffects(category, query) {
    if (!query) return [];
    
    // 필요 시 카테고리 데이터 로드
    if (!this.metadata.setEffect.categories[category]) {
      await this.loadSetEffectForCategory(category);
    }
    
    const effects = this.getSetEffectsForCategory(category);
    if (!effects) return [];
    
    const lowerQuery = query.toLowerCase();
    
    // 효과 중 검색어가 포함된 것만 반환
    return effects.filter(effect => 
      effect.toLowerCase().includes(lowerQuery)
    );
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const metadataLoader = new MetadataLoader();
export default metadataLoader;
