/**
 * app.js
 * 애플리케이션 메인 통합 모듈 - 모든 하위 모듈 관리 및 초기화
 */

// 모듈 가져오기
import CategoryManager from './category-manager.js';
import SearchManager from './search-manager.js';
import ItemDisplay from './item-display.js';
import FilterManager from './filter-manager.js';
import PaginationManager from './pagination.js';
import ApiClient from './api-client.js';
import Utils from './utils.js';

/**
 * 애플리케이션 모듈
 * 전체 앱 라이프사이클 관리 및 모듈 통합
 */
const App = (() => {
    // 앱 상태 관리
    const state = {
        initialized: false,
        modules: {
            category: false,
            search: false,
            filter: false,
            pagination: false,
            display: false
        }
    };

    /**
     * 이벤트 리스너 설정
     */
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
        
        // 필터 변경 이벤트
        document.addEventListener('filterChanged', handleFilterChanged);
        
        // 옵션 토글 버튼
        const toggleOptionsBtn = document.getElementById('toggle-options');
        if (toggleOptionsBtn) {
            toggleOptionsBtn.addEventListener('click', toggleOptions);
        }

        // 윈도우 리사이즈 이벤트
        window.addEventListener('resize', Utils.debounce(handleResize, 200));

        console.log('앱 이벤트 리스너 설정 완료');
    }
    
    /**
     * 윈도우 리사이즈 처리
     */
    function handleResize() {
        // 반응형 레이아웃 조정을 위한 플래그 설정
        const isMobile = window.innerWidth < 768;
        document.body.classList.toggle('mobile-view', isMobile);
        
        // 필요한 UI 업데이트 호출
        if (CategoryManager && typeof CategoryManager.handleResponsiveChange === 'function') {
            CategoryManager.handleResponsiveChange({ matches: isMobile });
        }
    }

    /**
     * 검색어로 아이템 목록 필터링
     * @param {Array} items - 아이템 목록
     * @param {string} searchTerm - 검색어
     * @returns {Array} 필터링된 아이템 목록
     */
    function filterItemsBySearchTerm(items, searchTerm) {
        if (!searchTerm || !Array.isArray(items)) {
            return items;
        }
        
        const normalizedTerm = searchTerm.toLowerCase();
        
        return items.filter(item => {
            // 아이템 이름 필드 확인
            const itemName = (item.item_name || '').toLowerCase();
            const displayName = (item.item_display_name || '').toLowerCase();
            
            // 검색어 포함 여부 확인
            return itemName.includes(normalizedTerm) || 
                   displayName.includes(normalizedTerm);
        });
    }
    
    /**
     * 검색 처리
     * @param {CustomEvent} event - 검색 이벤트
     */
        async function handleSearch(event) {
        const { searchTerm, selectedItem, mainCategory, subCategory } = event.detail;
    
        ApiClient.setLoading(true);
    
        try {
            let result;
            
            // 자동완성 검색 처리
            if (selectedItem && selectedItem.name && selectedItem.subCategory) {
                result = await ApiClient.searchByCategory(
                    selectedItem.mainCategory, 
                    selectedItem.subCategory, 
                    selectedItem.name
                );
            }
            // 카테고리 검색 처리
            else if (subCategory) {
                result = await ApiClient.searchByCategory(mainCategory, subCategory);
                
                // 검색어 존재시 클라이언트 측 필터링
                if (searchTerm && result.items && result.items.length > 0) {
                    const filteredItems = filterItemsBySearchTerm(result.items, searchTerm);
                    result.items = filteredItems;
                    result.totalCount = filteredItems.length;
                }
            }
            // 키워드 검색 처리
            else if (searchTerm) {
                result = await ApiClient.searchByKeyword(searchTerm);
            } 
            else {
                ApiClient.setLoading(false);
                return;
            }
            
            // 결과 처리
            if (result.error) {
                showErrorMessage(result.error);
            } else if (!result.items || result.items.length === 0) {
                showErrorMessage('검색 결과가 없습니다.');
            } else {
                ItemDisplay.setSearchResults(result.items);
                PaginationManager.resetPagination(result.items.length || 0);
            }
        } catch (error) {
            console.error('검색 처리 중 오류:', error);
            showErrorMessage('검색 처리 중 오류가 발생했습니다.');
        } finally {
            ApiClient.setLoading(false);
        }
    }
    
    /**
     * 검색 초기화 처리
     */
    function handleSearchReset() {
        // 검색 결과 초기화
        ItemDisplay.clearResults();
        
        // 카테고리 선택 초기화
        CategoryManager.resetSelectedCategories();
        
        // 필터 초기화
        FilterManager.resetFilters();
    }
    
    /**
     * 카테고리 변경 처리
     * @param {CustomEvent} event - 카테고리 변경 이벤트
     */
    async function handleCategoryChanged(event) {
        const { mainCategory, subCategory, autoSelected, itemName } = event.detail;
    
        // 카테고리가 선택된 경우
        if (subCategory) {
            try {
                // 필터 업데이트
                await FilterManager.updateFiltersForCategory(subCategory);
            
                // 자동 검색을 요청하지 않은 경우는 중단
                if (autoSelected === false) return;
            
                // 검색 이벤트 생성 및 발생
                const searchEvent = new CustomEvent('search', {
                    detail: {
                        searchTerm: itemName || '',
                        mainCategory,
                        subCategory
                    }
                });
                document.dispatchEvent(searchEvent);
            } catch (error) {
                console.error('카테고리 변경 처리 오류:', error);
                showErrorMessage('카테고리 정보를 불러오는 중 오류가 발생했습니다.');
            }
        }
    }
    
    /**
     * 필터 변경 처리
     * @param {CustomEvent} event - 필터 변경 이벤트
     */
    function handleFilterChanged(event) {
        // 로컬 필터링 적용
        ItemDisplay.applyLocalFiltering();
    }
    
    /**
     * 페이지 변경 처리
     * @param {CustomEvent} event - 페이지 변경 이벤트
     */
    function handlePageChanged(event) {
        const { startIndex, endIndex } = event.detail;
        
        // 페이지 변경에 따른 아이템 표시 업데이트
        ItemDisplay.renderItemsForPage(startIndex, endIndex);
    }
    
    /**
     * 아이템 선택 처리
     * @param {CustomEvent} event - 아이템 선택 이벤트
     */
    function handleItemSelected(event) {
        const { item } = event.detail;
        
        if (!item) {
            console.warn('선택된 아이템 정보가 없습니다.');
            return;
        }
        
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
        
        // 검색 이벤트 발생
        const searchEvent = new CustomEvent('search', {
            detail: {
                searchTerm: item.item_name || item.name,
                selectedItem: item
            }
        });
        document.dispatchEvent(searchEvent);
    }
    
    /**
     * 옵션 패널 토글
     */
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
    
    /**
     * 오류 메시지 표시
     * @param {string} message - 오류 메시지
     */
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
        
        // 페이지네이션 초기화
        const paginationContainer = document.getElementById('pagination');
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
        }
        
        // 결과 통계 초기화
        const resultStats = document.getElementById('result-stats');
        if (resultStats) {
            resultStats.textContent = '';
        }
    }
    
    /**
     * 모듈 초기화 진행 표시
     * @param {string} moduleName - 모듈 이름
     */
    function markModuleInitialized(moduleName) {
        if (state.modules.hasOwnProperty(moduleName)) {
            state.modules[moduleName] = true;
            
            // 모든 모듈이 초기화되었는지 확인
            const allInitialized = Object.values(state.modules).every(value => value === true);
            if (allInitialized && !state.initialized) {
                state.initialized = true;
                console.log('모든 모듈 초기화 완료');
            }
        }
    }
    
    /**
     * 애플리케이션 초기화 함수
     */
    async function init() {
        try {
            // 이벤트 리스너 설정
            setupEventListeners();
            
            // 순차적 초기화 (의존성 있는 모듈)
            console.log('CategoryManager 초기화 시작...');
            await initCategoryManager();
            
            console.log('SearchManager 초기화 시작...');
            await initSearchManager();
            
            // 병렬 초기화 (남은 모듈)
            await Promise.all([
                initFilterManager(),
                initPaginationManager(),
                initItemDisplay()
            ]);
            
            // 반응형 레이아웃 초기 설정
            handleResize();
            
            // URL 파라미터 처리
            processUrlParameters();
            
            console.log('애플리케이션 초기화 완료');
        } catch (error) {
            console.error('애플리케이션 초기화 중 오류 발생:', error);
            showInitError('애플리케이션 초기화 중 오류가 발생했습니다.');
        }
    }
    
    /**
     * 카테고리 매니저 초기화
     */
    async function initCategoryManager() {
        try {
            CategoryManager.init();
            markModuleInitialized('category');
            return true;
        } catch (error) {
            console.error('카테고리 매니저 초기화 실패:', error);
            return false;
        }
    }
    
    /**
     * 검색 매니저 초기화
     */
    async function initSearchManager() {
        try {
            SearchManager.init();
            markModuleInitialized('search');
            return true;
        } catch (error) {
            console.error('검색 매니저 초기화 실패:', error);
            return false;
        }
    }
    
    /**
     * 필터 매니저 초기화
     */
    async function initFilterManager() {
        try {
            FilterManager.init();
            markModuleInitialized('filter');
            return true;
        } catch (error) {
            console.error('필터 매니저 초기화 실패:', error);
            return false;
        }
    }
    
    /**
     * 페이지네이션 매니저 초기화
     */
    async function initPaginationManager() {
        try {
            PaginationManager.init();
            markModuleInitialized('pagination');
            return true;
        } catch (error) {
            console.error('페이지네이션 매니저 초기화 실패:', error);
            return false;
        }
    }
    
    /**
     * 아이템 디스플레이 초기화
     */
    async function initItemDisplay() {
        try {
            ItemDisplay.init();
            markModuleInitialized('display');
            return true;
        } catch (error) {
            console.error('아이템 디스플레이 초기화 실패:', error);
            return false;
        }
    }
    
    /**
     * URL 파라미터 처리
     */
    function processUrlParameters() {
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
     * 초기화 오류 표시
     * @param {string} message - 오류 메시지
     */
    function showInitError(message) {
        // 헤더 아래에 오류 메시지 표시
        const headerSection = document.querySelector('.header-section');
        if (headerSection) {
            const errorBox = document.createElement('div');
            errorBox.className = 'init-error';
            errorBox.innerHTML = `
                <div class="error-message">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    ${message} <button class="reload-btn">새로고침</button>
                </div>
            `;
            
            headerSection.appendChild(errorBox);
            
            // 새로고침 버튼 이벤트
            const reloadBtn = errorBox.querySelector('.reload-btn');
            if (reloadBtn) {
                reloadBtn.addEventListener('click', () => {
                    window.location.reload();
                });
            }
        }
    }
    
    /**
     * 카테고리 ID로 정보 찾기
     * @param {string} id - 카테고리 ID
     * @returns {Object|null} 카테고리 정보
     */
    function findCategoryById(id) {
        if (!id || typeof CategoryManager === 'undefined' || !CategoryManager.getSelectedCategories) {
            return null;
        }
        
        const { subCategories } = CategoryManager.getSelectedCategories();
        return subCategories.find(cat => cat.id === id) || null;
    }
    
    // 공개 API
    return {
        init,
        showErrorMessage
    };
})();

export default App;

// DOM 로드 완료 시 애플리케이션 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 로드 완료, 애플리케이션 초기화 시작');
    App.init();
});
