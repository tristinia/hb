/**
 * API 클라이언트 모듈
 * 데이터 처리 및 API 호출 관리
 */
const ApiClient = (() => {
    // API 호출 상태
    const state = {
        isLoading: false,
        retryCount: 0,
        maxRetries: 3
    };
    
    // API 설정
    const API_CONFIG = {
        // Cloudflare Worker (auction-list)
        BASE_URL: "https://api.mabidb.com/api" // 사용자 지정 도메인 사용
    };
    
    /**
     * 로딩 상태 설정
     * @param {boolean} loading - 로딩 상태
     */
    function setLoading(loading) {
        state.isLoading = loading;
        const spinner = document.getElementById('loading-spinner');
        if (spinner) {
            spinner.style.display = loading ? 'flex' : 'none';
        }
    }
    
    /**
     * 통합 검색 API 호출
     * @param {Object} searchParams - 검색 파라미터 객체 (예: { itemName: '...', category: '...' })
     * @returns {Promise<Object>} 검색 결과 (items, availableFilters 포함)
     */
    async function search(searchParams) {
        if (!searchParams || Object.keys(searchParams).length === 0) {
            return { items: [], availableFilters: [], error: '검색어가 필요합니다.' };
        }

        try {
            setLoading(true);

            // URL 쿼리 파라미터로 검색 조건을 전달하도록 변경
            const url = new URL(`${API_CONFIG.BASE_URL}/search/`);
            Object.entries(searchParams).forEach(([key, value]) => {
                if (value) { // null이나 undefined가 아닌 값만 추가
                    url.searchParams.append(key, value);
                }
            });

            const response = await fetch(url.toString());

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `API 오류: ${response.status}`);
            }

            const data = await response.json();
            setLoading(false);
            return data; // { items: [...], availableFilters: [...] }
        } catch (error) {
            console.error('검색 API 오류:', error);
            setLoading(false);
            return {
                items: [],
                availableFilters: [],
                error: `검색 중 오류가 발생했습니다: ${error.message}`
            };
        }
    }

    /**
     * 클라이언트 사이드 검색을 위한 전체 아이템 인덱스를 가져옵니다.
     * @param {string} [etag] - 이전에 받은 ETag 값 (If-None-Match 헤더에 사용)
     * @returns {Promise<Object>} { data: Array, etag: string, modified: boolean } 형태의 객체
     */
    async function fetchItemIndex(etag) {
        try {
            const url = `${API_CONFIG.BASE_URL}/items/index`;
            const headers = {};
            if (etag) {
                headers['If-None-Match'] = etag;
            }

            const response = await fetch(url, { headers });

            // 304 Not Modified 응답 처리
            if (response.status === 304) {
                return { data: null, etag: etag, modified: false };
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `API 오류: ${response.status}`);
            }

            const newEtag = response.headers.get('etag');
            const data = await response.json();
            
            return { data, etag: newEtag, modified: true };

        } catch (error) {
            console.error('아이템 인덱스 API 오류:', error);
            // 오류 발생 시 데이터가 없는 것으로 처리
            return { data: null, etag: null, modified: false, error: error };
        }
    }

    // 공개 API
    return {
        search,
        fetchItemIndex,
        setLoading,
        getIsLoading: () => state.isLoading
    };
})();

export default ApiClient;
