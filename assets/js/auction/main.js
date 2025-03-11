/**
 * 메인 스크립트
 * 애플리케이션 초기화 및 모듈 간 조정
 */

// 전역 상태
const App = {
    // 페이지 로드 시 초기화
    init: function() {
        console.log('마비노기 경매장 앱 초기화...');
        
        // 각 모듈 초기화
        CategoryManager.init();
        SearchManager.init();
        FilterManager.init();
        ItemDisplay.init();
        PaginationManager.init();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        console.log('초기화 완료');
        // 추가 최적화 기능 초기화 (간소화 버전)
        try {
            // 다크 모드 초기화
            if (typeof ThemeManager !== 'undefined') {
                ThemeManager.init();
            }
            
            // URL 상태 관리자 초기화
            if (typeof StateManager !== 'undefined') {
                const state = StateManager.restoreFromUrl();
                
                // URL 파라미터가 있는 경우 관련 설정 적용
                if (state.searchTerm) {
                    SearchManager.setSearchTerm(state.searchTerm);
                }
                
                // 여기에 더 많은 상태 복원 로직을 추가할 수 있음...
            }
            
            console.log('추가 최적화 기능 초기화 완료');
        } catch (error) {
            console.warn('추가 기능 초기화 중 오류:', error);
            // 오류가 발생해도 앱 작동에 영향 없음
        }
    },
    
    // 글로벌 이벤트 리스너 설정
    setupEventListeners: function() {
        // 검색 이벤트
        document.addEventListener('search', this.handleSearch.bind(this));
        
        // 검색 초기화 이벤트
        document.addEventListener('searchReset', this.handleSearchReset.bind(this));
        
        // 페이지 변경 이벤트
        document.addEventListener('pageChanged', this.handlePageChange.bind(this));
        
        // ESC 키로 모달 닫기
        window.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                const modals = document.querySelectorAll('.modal-container, .option-modal-container');
                modals.forEach(modal => {
                    document.body.removeChild(modal);
                });
            }
        });
    },
    
    /**
     * 검색 처리
     * @param {CustomEvent} event - 검색 이벤트
     */
    handleSearch: async function(event) {
        const { searchTerm, selectedItem, mainCategory, subCategory } = event.detail;
        
        try {
            let searchResults;
            
            // 데이터베이스에 있는 아이템인지 확인
            const isSelectedItemValid = selectedItem && selectedItem.category;
            
            // 1. 소분류가 선택된 경우 카테고리 검색 사용 (우선순위 1)
            if (subCategory) {
                // 검색어 있는 경우 카테고리 + 아이템 이름으로 검색
                searchResults = await ApiClient.searchByCategory(mainCategory, subCategory, searchTerm);
            }
            // 2. 데이터베이스에 있는 아이템인 경우 카테고리 자동 선택 및 검색
            else if (isSelectedItemValid) {
                // 선택된 아이템 기반 카테고리 정보 추출
                const itemMainCategory = selectedItem.mainCategory || CategoryManager.findMainCategoryForSubCategory(selectedItem.category);
                const itemSubCategory = selectedItem.subCategory || selectedItem.category;
                
                if (itemMainCategory && itemSubCategory) {
                    // 카테고리 UI 자동 선택
                    const event = new CustomEvent('categoryChanged', {
                        detail: {
                            mainCategory: itemMainCategory,
                            subCategory: itemSubCategory
                        }
                    });
                    document.dispatchEvent(event);
                    
                    // 카테고리 + 아이템으로 검색
                    searchResults = await ApiClient.searchByCategory(
                        itemMainCategory,
                        itemSubCategory,
                        searchTerm
                    );
                } else {
                    // 카테고리 정보가 없는 경우 키워드 검색
                    searchResults = await ApiClient.searchByKeyword(searchTerm);
                }
            }
            // 3. 그 외에는 키워드로 검색
            else {
                searchResults = await ApiClient.searchByKeyword(searchTerm);
            }
            
            // 검색 결과 처리
            if (searchResults.error) {
                console.error('검색 오류:', searchResults.error);
                alert(searchResults.error);
                return;
            }
            
            // 검색 결과 설정
            this.setSearchResults(searchResults.items);
            
        } catch (error) {
            console.error('검색 처리 중 오류:', error);
            alert('검색 중 오류가 발생했습니다.');
        }
    },
    
    /**
     * 검색 초기화 처리
     */
    handleSearchReset: function() {
        // 카테고리 초기화
        CategoryManager.resetSelectedCategories();
        
        // 필터 초기화
        FilterManager.resetFilters();
        
        // 결과 초기화
        ItemDisplay.clearResults();
        
        // 페이지네이션 초기화
        PaginationManager.resetPagination(0);
    },
    
    /**
     * 페이지 변경 처리
     * @param {CustomEvent} event - 페이지 변경 이벤트
     */
    handlePageChange: function(event) {
        const { startIndex, endIndex } = event.detail;
        const itemDisplay = document.getElementById('results-body');
        
        if (!itemDisplay) return;
        
        // 테이블 행 숨기기/표시
        const rows = itemDisplay.querySelectorAll('.item-row');
        
        rows.forEach((row, index) => {
            if (index >= startIndex && index < endIndex) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    },
    
    /**
     * 검색 결과 설정
     * @param {Array} items - 검색 결과 아이템 목록
     */
    setSearchResults: function(items) {
        // 아이템 목록 표시
        ItemDisplay.setSearchResults(items);
        
        // 필터 적용
        ItemDisplay.applyLocalFiltering();
        
        // 페이지네이션 업데이트
        PaginationManager.resetPagination(items.length);
    }
};

// 페이지 로드 시 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
