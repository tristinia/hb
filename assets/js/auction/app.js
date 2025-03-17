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
        const { mainCategory, subCategory, autoSelected } = event.detail;
        
        // 카테고리가 선택되었고, 자동 검색이 활성화된 경우
        if (subCategory) {
            try {
                // 필터 업데이트
                await FilterManager.updateFiltersForCategory(subCategory);
                
                // 자동 검색을 요청하지 않은 경우는 중단
                if (autoSelected === false) return;
                
                // 검색 이벤트 생성 및 발생
                const searchEvent = new CustomEvent('search', {
                    detail: {
                        searchTerm: '',
                        mainCategory,
                        subCategory
                    }
                });
                document.dispatchEvent(searchEvent);
            } catch (error) {
                console.error('카테고리 변경 처리 오류:', error);
            }
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
        
        // 카테고리 자동 선택
        if (item.category || item.subCategory) {
            // 해당 아이템의 카테고리 정보를 찾아 선택
            const subCategory = item.category || item.subCategory;
            let mainCategory = item.mainCategory;
            
            // 메인 카테고리가 없는 경우 찾기
            if (!mainCategory && typeof CategoryManager !== 'undefined') {
                mainCategory = CategoryManager.findMainCategoryForSubCategory(subCategory);
            }
            
            // 카테고리 변경 이벤트 발생 (자동 검색은 활성화하지 않음)
            const categoryEvent = new CustomEvent('categoryChanged', {
                detail: {
                    mainCategory,
                    subCategory,
                    autoSelected: false
                }
            });
            
            document.dispatchEvent(categoryEvent);
        }
        
        // 여기서 검색은 별도로 처리
        const searchEvent = new CustomEvent('search', {
            detail: {
                searchTerm: item.name,
                selectedItem: item
            }
        });
        document.dispatchEvent(searchEvent);
    }
    
    // 옵션 패널 토글
    function toggleOptions() {
        const optionsPanel = document.querySelector('.options-panel');
        const toggleBtn = document.getElementById('toggle-options');
        
        if (optionsPanel && toggleBtn) {
            const isExpanded = optionsPanel.classList.toggle('expanded');
            toggleBtn.classList.toggle('expanded', isExpanded);
            toggleBtn.title = isExpanded ? '옵션 접기' : '옵션 펼치기';
            
            // 아이콘 회전 효과
            const icon = toggleBtn.querySelector('svg');
            if (icon) {
                icon.style.transform = isExpanded ? 'rotate(180deg)' : '';
            }
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
    
    /**
     * 애플리케이션 초기화 함수
     */
    function init() {
        // 기본 모듈 초기화
        CategoryManager.init();
        SearchManager.init();
        ItemDisplay.init();
        FilterManager.init();
        PaginationManager.init();
        
        // 필터 스타일 적용
        FilterManager.addStyles();
        
        // 이벤트 리스너 설정
        setupEventListeners();
        
        // URL 파라미터 처리
        const urlParams = new URLSearchParams(window.location.search);
        const searchTerm = urlParams.get('search');
        const category = urlParams.get('category');
        
        // 검색어나 카테고리가 URL에 있는 경우 자동 검색
        if (searchTerm) {
            SearchManager.setSearchTerm(searchTerm);
            SearchManager.handleSearch();
        } else if (category) {
            // 카테고리 선택 처리
            // 해당 카테고리 정보 찾기
            const categoryInfo = findCategoryById(category);
            if (categoryInfo) {
                // 카테고리 자동 선택
                const event = new CustomEvent('categoryChanged', {
                    detail: {
                        mainCategory: categoryInfo.mainCategory,
                        subCategory: categoryInfo.id,
                        autoSelected: true
                    }
                });
                document.dispatchEvent(event);
            }
        }
    }
    
    /**
     * 카테고리 ID로 정보 찾기
     * @param {string} id - 카테고리 ID
     * @returns {Object|null} 카테고리 정보
     */
    function findCategoryById(id) {
        const { subCategories } = CategoryManager.getSelectedCategories();
        return subCategories.find(cat => cat.id === id) || null;
    }
    
    // 공개 API
    return {
        init
    };
})();

// DOM 로드 완료 시 애플리케이션 초기화
document.addEventListener('DOMContentLoaded', App.init);
