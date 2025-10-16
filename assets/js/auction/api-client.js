/**
 * API 클라이언트 모듈
 * 데이터 처리 및 API 호출 관리
 */
const ApiClient = (() => {
    // API 호출 상태
    const state = {
        isLoading: false,
        retryCount: 0,
        maxRetries: 3,
        lastQuery: null,
        abortController: null // 검색 중단 컨트롤러
    };
    
    // API 설정
    const API_CONFIG = {
        // Cloudflare Worker
        BASE_URL: "https://mabinogi-auction-api.tristinia.workers.dev",
        // 병렬 API 호출 관련 설정
        MAX_CONCURRENT_REQUESTS: 5, // 병렬 요청 수
        MAX_PAGES: 100, // 최대 페이지 수
        DELAY_MS: 50 // API 호출 간 최소 딜레이
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
     * URL에 매개변수 추가 함수
     * @param {string} url - 기본 URL
     * @param {string} paramName - 파라미터 이름
     * @param {string} paramValue - 파라미터 값
     * @returns {string} 파라미터가 추가된 URL
     */
    function addParamToUrl(url, paramName, paramValue) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}${paramName}=${encodeURIComponent(paramValue)}`;
    }
    
    /**
     * 백그라운드 로딩 중단
     */
    function abortBackgroundLoading() {
        if (state.abortController) {
            state.abortController.abort();
            state.abortController = null;
        }
    }
    
    /**
     * 모든 페이지 데이터 수집 (모든 페이지가 로드될 때까지 기다린 후 결과 반환)
     * @param {string} initialUrl - 초기 API URL
     * @returns {Promise<Object>} 모든 페이지 결과를 합친 데이터
     */
    async function fetchAllPages(initialUrl) {
        // 기존 로딩 중단
        abortBackgroundLoading();
        
        let allItems = [];
        let pageCount = 0;
        
        try {
            // 로딩 컨트롤러 생성
            state.abortController = new AbortController();
            const signal = state.abortController.signal;
            
            // 현재 처리 중인 URL
            let currentUrl = initialUrl;
            
            // 모든 페이지 데이터를 수집할 때까지 반복
            while (currentUrl && pageCount < API_CONFIG.MAX_PAGES && !signal.aborted) {
                // 페이지 수 증가
                pageCount++;
                
                // API 요청 사이의 지연 (페이지 > 1인 경우에만)
                if (pageCount > 1) {
                    await new Promise(resolve => setTimeout(resolve, API_CONFIG.DELAY_MS));
                }
                
                // 페이지 요청
                console.log(`페이지 ${pageCount} 요청`);
                const response = await fetch(currentUrl, { signal });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `API 오류: ${response.status}`);
                }
                
                // 페이지 데이터 파싱
                const pageData = await response.json();
                
                // 아이템 추가
                if (pageData.auction_item && pageData.auction_item.length > 0) {
                    allItems = allItems.concat(pageData.auction_item);
                }
                
                // 다음 페이지 URL 설정 (수정된 부분)
                if (pageData.next_cursor) {
                    // 기존 URL에 커서 파라미터 추가 또는 갱신
                    const nextUrl = new URL(currentUrl);
                    nextUrl.searchParams.delete('cursor'); // 기존 커서값 제거
                    nextUrl.searchParams.append('cursor', pageData.next_cursor);
                    currentUrl = nextUrl.toString();
                } else {
                    currentUrl = null; // 다음 페이지가 없으면 종료
                }
            }
            
            // 모든 페이지 로드 완료
            console.log(`모든 페이지 요청 완료`);
            
            // 완료 이벤트 발생
            const completeEvent = new CustomEvent('allPagesLoaded', {
                detail: {
                    items: allItems,
                    totalItems: allItems.length,
                    totalPages: pageCount
                }
            });
            document.dispatchEvent(completeEvent);
            
            // 로딩 표시 숨김
            setLoading(false);
            
            // 결과 반환
            return {
                items: allItems,
                totalCount: allItems.length,
                totalPages: pageCount,
                hasMorePages: false
            };
            
        } catch (error) {
            // 중단 신호로 인한 오류는 무시
            if (error.name === 'AbortError') {
                console.log('페이지 로딩이 중단되었습니다.');
                return { items: [], totalCount: 0, totalPages: 0 };
            }
            
            console.error("데이터 수집 오류:", error);
            
            // 로딩 표시 숨김
            setLoading(false);
            
            // 오류 이벤트 발생
            const errorEvent = new CustomEvent('pageLoadError', {
                detail: {
                    error: error.message,
                    loadedItems: allItems,
                    loadedPages: pageCount
                }
            });
            document.dispatchEvent(errorEvent);
            
            throw error;
        }
    }
    
    /**
     * 키워드로 검색
     * @param {string} keyword - 검색 키워드
     * @returns {Promise<Object>} 검색 결과
     */
    async function searchByKeyword(keyword) {
        if (!keyword) {
            return { items: [], error: '검색어가 필요합니다.' };
        }
        
        try {
            setLoading(true);
            state.lastQuery = { type: 'keyword', keyword };
            
            // Cloudflare Worker URL로 변경
            const url = `${API_CONFIG.BASE_URL}/searchByKeyword?keyword=${encodeURIComponent(keyword)}`;
            
            try {
                // 모든 페이지 수집 함수 호출
                return await fetchAllPages(url);
            } catch (fetchError) {
                throw new Error(`검색 서버 연결에 실패했습니다: ${fetchError.message}`);
            }
            
        } catch (error) {
            console.error('검색 API 오류:', error);
            setLoading(false);
            return { 
                items: [], 
                error: `검색 중 오류가 발생했습니다: ${error.message}` 
            };
        }
    }
    
    /**
     * 카테고리로 검색
     * @param {string} mainCategory - 메인 카테고리 ID
     * @param {string} subCategory - 서브 카테고리 ID (필수)
     * @param {string} itemName - 아이템 이름
     * @returns {Promise<Object>} 검색 결과
     */
    async function searchByCategory(mainCategory, subCategory, itemName = null) {
        if (!subCategory) {
            return { items: [], error: '카테고리 정보가 필요합니다.' };
        }
        
        try {
            setLoading(true);
            state.lastQuery = { 
                type: 'category', 
                mainCategory, 
                subCategory, 
                itemName 
            };
            
            // Cloudflare Worker URL로 변경
            let url = `${API_CONFIG.BASE_URL}/searchByCategory?subCategory=${encodeURIComponent(subCategory)}`;
            
            if (itemName) {
                url = addParamToUrl(url, 'itemName', itemName);
            }
            
            try {
                // 모든 페이지 수집 함수 호출
                return await fetchAllPages(url);
            } catch (fetchError) {
                throw new Error(`카테고리 검색 서버 연결에 실패했습니다: ${fetchError.message}`);
            }
            
        } catch (error) {
            console.error('카테고리 검색 API 오류:', error);
            setLoading(false);
            return { 
                items: [], 
                error: `검색 중 오류가 발생했습니다: ${error.message}` 
            };
        }
    }
    
    /**
     * 마지막 검색 쿼리 재실행
     * @returns {Promise<Object>} 검색 결과
     */
    async function retryLastQuery() {
        if (!state.lastQuery) {
            return { items: [], error: '이전 검색 정보가 없습니다.' };
        }
        
        if (state.lastQuery.type === 'keyword') {
            return searchByKeyword(state.lastQuery.keyword);
        } else if (state.lastQuery.type === 'category') {
            return searchByCategory(
                state.lastQuery.mainCategory,
                state.lastQuery.subCategory,
                state.lastQuery.itemName
            );
        }
        
        return { items: [], error: '알 수 없는 검색 유형입니다.' };
    }
    
    // 공개 API
    return {
        searchByKeyword,
        searchByCategory,
        retryLastQuery,
        setLoading,
        getIsLoading: () => state.isLoading,
        abortBackgroundLoading
    };
})();

export default ApiClient;
