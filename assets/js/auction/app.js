/**
 * app.js
 * 애플리케이션 메인 진입점 - 모듈 통합 및 초기화
 */

const App = (() => {
    // 이벤트 리스너 설정
    function setupEventListeners() {
        // 검색 이벤트
        document.addEventListener('search', handleSearch);
        
        // 검색 초기화 이벤트
        document.addEventListener('searchReset', handleSearchReset);
        
        // 카테고리 변경 이벤트
        document.addEventListener('categoryChanged', handleCategoryChanged);
        
        // 페이지 변경 이벤트
        document.addEventListener('pageChanged', handlePageChanged);
        
        // 아이템 선택 이벤트
        document.addEventListener('itemSelected', handleItemSelected);
        
        // 옵션 토글 버튼
        const toggleOptionsBtn = document.getElementById('toggle-options');
        if (toggleOptionsBtn) {
            toggleOptionsBtn.addEventListener('click', toggleOptions);
        }
    }
    
    // 검색 처리
    async function handleSearch(event) {
        const { searchTerm, selectedItem, mainCategory, subCategory } = event.detail;
        
        // 로딩 중 표시
        ApiClient.setLoading(true);
        
        try {
            let result;
            
            // 카테고리 기반 검색 또는 키워드 검색
            if (subCategory) {
                result = await ApiClient.searchByCategory(mainCategory, subCategory, searchTerm);
            } else if (searchTerm) {
                result = await ApiClient.searchByKeyword(searchTerm);
            } else {
                console.warn('검색어 또는 카테고리가 필요합니다.');
                ApiClient.setLoading(false);
                return;
            }
            
            // 검색 결과 처리
            if (result.error) {
                console.error('검색 오류:', result.error);
                showErrorMessage(result.error);
            } else {
                // 결과 표시
                ItemDisplay.setSearchResults(result.items || []);
                
                // 페이지네이션 설정
                PaginationManager.resetPagination(result.items?.length || 0);
            }
        } catch (error) {
            console.error('검색 처리 중 오류:', error);
            showErrorMessage('검색 처리 중 오류가 발생했습니다.');
        } finally {
            // 로딩 완료
            ApiClient.setLoading(false);
        }
    }
    
    // 검색 초기화 처리
    function handleSearchReset() {
        // 검색 결과 초기화
        ItemDisplay.clearResults();
        
        // 카테고리 선택 초기화
        CategoryManager.resetSelectedCategories();
        
        // 필터 초기화
        FilterManager.resetFilters();
    }
    
    // 카테고리 변경 처리
    async function handleCategoryChanged(event) {
        const { mainCategory, subCategory } = event.detail;
        
        // 카테고리가 선택되었고, 자동 검색이 활성화된 경우
        if (subCategory) {
            // 필터 업데이트
            FilterManager.updateFiltersForCategory(subCategory);
            
            // 자동 검색 수행
            const searchEvent = new CustomEvent('search', {
                detail: {
                    searchTerm: '',
                    mainCategory,
                    subCategory
                }
            });
            document.dispatchEvent(searchEvent);
        }
    }
    
    // 페이지 변경 처리
    function handlePageChanged(event) {
        const { startIndex, endIndex } = event.detail;
        
        // 페이지 변경에 따른 아이템 표시 업데이트
        ItemDisplay.renderItemsForPage(startIndex, endIndex);
    }
    
    // 아이템 선택 처리
    function handleItemSelected(event) {
        const { item } = event.detail;
        
        // 선택된 아이템에 대한 처리
        console.log('선택된 아이템:', item);
    }
    
    // 옵션 토글
    function toggleOptions() {
        const optionsPanel = document.getElementById('detail-options');
        const toggleBtn = document.getElementById('toggle-options');
        
        if (optionsPanel && toggleBtn) {
            const isExpanded = optionsPanel.classList.toggle('show');
            toggleBtn.classList.toggle('expanded', isExpanded);
        }
    }
    
    // 오류 메시지 표시
    function showErrorMessage(message) {
        const resultsBody = document.getElementById('results-body');
        
        if (resultsBody) {
            resultsBody.innerHTML = `
                <tr class="error-result">
                    <td colspan="3">
                        <div class="error-message">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            ${message}
                        </div>
                    </td>
                </tr>
            `;
        }
    }
    
    // 모듈 초기화
    function init() {
        console.log('애플리케이션 초기화 중...');
        
        // 다크 모드 감지 및 적용
        const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDarkMode) {
            document.body.classList.add('dark-mode');
        }
        
        // 이벤트 리스너 설정
        setupEventListeners();
        
        // 각 모듈 초기화
        PaginationManager.init();
        CategoryManager.init();
        SearchManager.init();
        FilterManager.init();
        ItemDisplay.init();
        
        // URL 파라미터 처리 (페이지 새로고침 시 상태 유지)
        const urlParams = Utils.parseURLParams();
        if (urlParams.search) {
            SearchManager.setSearchTerm(urlParams.search);
            SearchManager.handleSearch();
        }
        
        console.log('애플리케이션 초기화 완료');
    }
    
    // 공개 API
    return {
        init
    };
})();

// DOM 로드 완료 시 애플리케이션 초기화
document.addEventListener('DOMContentLoaded', App.init);
