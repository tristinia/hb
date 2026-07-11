/**
 * metadata.js
 * 게임 메타데이터(인챈트, 세공, 세트 효과 등) 로드 및 관리 모듈
 */

/** 
 * 메타데이터 서비스 클래스
 * 게임 관련 모든 메타데이터 로드 및 관리
 */

// 로컬 개발 환경에서는 상대 경로가 아닌, 배포된 워커의 전체 주소를 사용해야 합니다.
const API_BASE_URL = 'https://api.mabidb.com/api/meta'; // Pages Function 경로

class MetadataService {
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
      console.log('[MetadataService]', ...args);
    }
  }
  
  /**
   * 초기화 및 기본 메타데이터 로드
   */
  async initialize() {
    try {
      // 병렬로 메타데이터 로드
      await Promise.all([
        this.loadEnchantMetadata()
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
      // 제안된 아키텍처에 따라 병합된 엔드포인트 호출
      const response = await fetch(`${API_BASE_URL}/enchants`);
      if (!response.ok) {
        throw new Error(`인챈트 메타데이터 로드 실패: ${response.status}`);
      }
      const combinedData = await response.json();
      this.metadata.enchant.prefix = { enchants: combinedData.prefix };
      this.metadata.enchant.suffix = { enchants: combinedData.suffix };
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
    // 이 함수는 더 이상 사용되지 않습니다. 세공 데이터는 카테고리별로 동적으로 로드됩니다.
    this.metadata.reforge.isLoaded = true;
    this.logDebug('세공 메타데이터 서비스가 동적 로드 모드로 전환되었습니다.');
    return Promise.resolve(true);
  }

  /**
   * (신규) 카테고리별 세공 옵션 로드
   * @param {string} category - 카테고리명
   */
  async loadReforgeOptionsForCategory(category) {
    if (!this.metadata.reforge.data) this.metadata.reforge.data = { reforges: {} };
    if (this.metadata.reforge.data.reforges[category]) return; // 이미 로드됨

    try {
      const response = await fetch(`${API_BASE_URL}/reforges?category=${encodeURIComponent(category)}`);
      if (response.ok) {
        const data = await response.json(); // 데이터는 이제 배열 자체입니다.
        this.metadata.reforge.data.reforges[category] = data;
        this.logDebug(`카테고리 '${category}'의 세공 옵션 로드 완료`);
      }
    } catch (error) {
      console.error(`'${category}' 세공 옵션 로드 실패:`, error);
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
      const response = await fetch(`${API_BASE_URL}/set-effects?category=${encodeURIComponent(category)}`);
      if (response.ok) {
        const data = await response.json(); // 데이터는 이제 { set_effects: [...] }가 아닌 배열 자체입니다.
        this.metadata.setEffect.categories[category] = data;
        this.logDebug(`카테고리 ${category}의 세트 효과 메타데이터 로드 완료`);
        return data;
      }
    } catch (error) {
      console.warn(`카테고리 ${category}의 세트 효과 메타데이터 로드 실패:`, error);
      return false;
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
  async getReforgeOptionsForCategory(category) {
    if (!this.metadata.reforge.isLoaded || !category) return [];
    
    // 데이터가 없으면 동적으로 로드
    if (!this.metadata.reforge.data?.reforges[category]) {
      await this.loadReforgeOptionsForCategory(category);
    }

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
  async searchReforgeOptions(category, query) {
    if (!query || !this.metadata.reforge.isLoaded) return [];
    
    const options = await this.getReforgeOptionsForCategory(category);
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
    // 데이터는 이제 배열 그 자체입니다.
    return categoryData || [];
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
const metadataService = new MetadataService();
export default metadataService;
