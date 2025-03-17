/**
 * API 클라이언트 모듈
 * Firebase Functions 호출 및 데이터 처리
 */

const ApiClient = (() => {
    // API 호출 상태
    const state = {
        isLoading: false,
        retryCount: 0,
        maxRetries: 3,
        lastQuery: null
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
     * 키워드로 검색 API 호출
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
            
            // 기존 코드 그대로 사용 (Firebase 설정 유지)
            const url = `https://us-central1-${firebase.app().options.projectId}.cloudfunctions.net/searchByKeyword?keyword=${encodeURIComponent(keyword)}`;
            console.log("API 호출 중...");
            
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API 오류:', response.status, errorText);
                throw new Error(`API 호출 실패: ${response.status}`);
            }
            
            const data = await response.json();
            return {
                items: data.items || [],
                totalCount: data.items?.length || 0
            };
        } catch (error) {
            console.error('검색 API 오류:', error);
            return { 
                items: [], 
                error: `검색 중 오류가 발생했습니다: ${error.message}` 
            };
        } finally {
            setLoading(false);
        }
    }
    
    /**
     * 카테고리로 검색 API 호출
     * @param {string} mainCategory - 메인 카테고리 ID (옵션)
     * @param {string} subCategory - 서브 카테고리 ID (필수)
     * @param {string} itemName - 아이템 이름 (옵션)
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
            
            // 기존 코드 그대로 사용 (Firebase 설정 유지)
            let url = `https://us-central1-${firebase.app().options.projectId}.cloudfunctions.net/searchByCategory?subCategory=${encodeURIComponent(subCategory)}`;
            
            // 대분류도 함께 전달 (UI 표시용)
            if (mainCategory) {
                url += `&category=${encodeURIComponent(mainCategory)}`;
            }
            
            // 아이템 이름이 있는 경우 추가
            if (itemName) {
                url += `&itemName=${encodeURIComponent(itemName)}`;
            }
            
            console.log("API 호출 중...");
            
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API 오류:', response.status, errorText);
                throw new Error(`API 호출 실패: ${response.status}`);
            }
            
            const data = await response.json();
            return {
                items: data.items || [],
                totalCount: data.items?.length || 0
            };
        } catch (error) {
            console.error('카테고리 검색 API 오류:', error);
            return { 
                items: [], 
                error: `검색 중 오류가 발생했습니다: ${error.message}` 
            };
        } finally {
            setLoading(false);
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
        getIsLoading: () => state.isLoading
    };
})();
