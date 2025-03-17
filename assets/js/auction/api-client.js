/**
 * API 클라이언트 모듈
 * 데이터 처리 (Firebase 의존성 제거)
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
     * 키워드로 검색 (로컬 데이터 처리)
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
            
            // 로컬 데이터 처리 (임시 구현)
            // JSON 파일에서 데이터를 가져오는 방식 (JSON 서버가 있을 경우)
            const items = await fetchLocalData();
            
            // 키워드로 필터링
            const filteredItems = items.filter(item => 
                item.item_name?.toLowerCase().includes(keyword.toLowerCase()) ||
                item.item_display_name?.toLowerCase().includes(keyword.toLowerCase())
            );
            
            return {
                items: filteredItems || [],
                totalCount: filteredItems?.length || 0
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
     * 카테고리로 검색 (로컬 데이터 처리)
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
            
            // 카테고리별 데이터 로드 (예: /data/items/검.json)
            const items = await fetchCategoryData(subCategory);
            
            // 아이템 이름이 있는 경우 추가 필터링
            let filteredItems = items;
            if (itemName) {
                filteredItems = items.filter(item => 
                    item.item_name?.toLowerCase().includes(itemName.toLowerCase()) ||
                    item.item_display_name?.toLowerCase().includes(itemName.toLowerCase())
                );
            }
            
            return {
                items: filteredItems || [],
                totalCount: filteredItems?.length || 0
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
     * 로컬 데이터 가져오기 (임시 구현)
     * @returns {Promise<Array>} 아이템 배열
     */
    async function fetchLocalData() {
        try {
            // 임시 데이터 (실제로는 JSON 파일이나 API에서 가져오는 것이 좋음)
            return [
                {
                    "item_name": "나이트브링어 워로드",
                    "item_display_name": "신성한 충돌의 미티어로이드 나이트브링어 워로드",
                    "item_count": 1,
                    "auction_price_per_unit": 2050000000,
                    "date_auction_expire": "2025-03-15T16:39:00.000Z",
                    "item_option": [
                        {
                            "option_type": "공격",
                            "option_sub_type": null,
                            "option_value": "107",
                            "option_value2": "251",
                            "option_desc": null
                        },
                        {
                            "option_type": "부상률",
                            "option_sub_type": null,
                            "option_value": "35%",
                            "option_value2": "60%",
                            "option_desc": null
                        },
                        {
                            "option_type": "크리티컬",
                            "option_sub_type": null,
                            "option_value": "76%",
                            "option_value2": null,
                            "option_desc": null
                        }
                    ]
                },
                {
                    "item_name": "라이트닝 스태프",
                    "item_display_name": "라이트닝 스태프",
                    "item_count": 1,
                    "auction_price_per_unit": 500000,
                    "date_auction_expire": "2025-03-20T12:00:00.000Z",
                    "item_option": [
                        {
                            "option_type": "마법 공격력",
                            "option_sub_type": null,
                            "option_value": "80",
                            "option_value2": "120",
                            "option_desc": null
                        }
                    ]
                }
            ];
        } catch (error) {
            console.error('로컬 데이터 로드 오류:', error);
            return [];
        }
    }
    
    /**
     * 카테고리별 데이터 가져오기
     * @param {string} category - 카테고리 ID
     * @returns {Promise<Array>} 아이템 배열
     */
    async function fetchCategoryData(category) {
        try {
            // 실제 구현에서는 해당 카테고리의 JSON 파일을 로드
            // 현재는 임시 데이터 반환
            return fetchLocalData();
        } catch (error) {
            console.error(`${category} 데이터 로드 오류:`, error);
            return [];
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
