/**
 * metadata.js
 * 메타데이터 로드 및 관리 모듈
 */

/**
 * 메타데이터 서비스 클래스
 * 게임 관련 모든 메타데이터 로드 및 관리
 */

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
      },
      ecostone: {
        data: {},
        isLoaded: false
      }
    };

    this.loadStarted = false; // 세션당 1회만 로드
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
   * 메타데이터 병렬 로드
   */
  async loadAll() {
    if (this.loadStarted) return;
    this.loadStarted = true;

    await Promise.all([
      this.loadEnchantMetadata(),
      this.loadReforgeMetadata(),
      this.loadSetEffectMetadata(),
      this.loadEcostoneMetadata()
    ]);
  }

  /**
   * 인챈트 메타데이터 로드
   */
  async loadEnchantMetadata() {
    try {
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
    try {
      const response = await fetch(`${API_BASE_URL}/reforges`);
      if (!response.ok) {
        throw new Error(`세공 메타데이터 로드 실패: ${response.status}`);
      }
      const data = await response.json(); // { [category]: string[] }
      this.metadata.reforge.data = { reforges: data };
      this.metadata.reforge.isLoaded = true;
      this.logDebug('세공 메타데이터 로드 완료');
      return true;
    } catch (error) {
      console.error('세공 메타데이터 로드 실패:', error);
      return false;
    }
  }

  /**
   * 세트 효과 메타데이터 로드
   */
  async loadSetEffectMetadata() {
    try {
      const response = await fetch(`${API_BASE_URL}/set-effects`);
      if (!response.ok) {
        throw new Error(`세트 효과 메타데이터 로드 실패: ${response.status}`);
      }
      const data = await response.json(); // { [category]: string[] }
      this.metadata.setEffect.categories = data;
      this.metadata.setEffect.isLoaded = true;
      this.logDebug('세트 효과 메타데이터 로드 완료');
      return true;
    } catch (error) {
      console.error('세트 효과 메타데이터 로드 실패:', error);
      return false;
    }
  }

  /**
   * 에코스톤 메타데이터 로드
   */
  async loadEcostoneMetadata() {
    try {
      const response = await fetch(`${API_BASE_URL}/ecostones`);
      if (!response.ok) {
        throw new Error(`에코스톤 메타데이터 로드 실패: ${response.status}`);
      }
      const data = await response.json(); // { [type]: string[] }
      this.metadata.ecostone.data = data;
      this.metadata.ecostone.isLoaded = true;
      this.logDebug('에코스톤 메타데이터 로드 완료');
      return true;
    } catch (error) {
      console.error('에코스톤 메타데이터 로드 실패:', error);
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
}

// 싱글톤 인스턴스 생성 및 내보내기
const metadataService = new MetadataService();
export default metadataService;
