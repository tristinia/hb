/**
 * app.js - 마비노기 경매장 메인 스크립트
 */

// 기존 모듈 가져오기
import CategoryManager from './category-manager.js';
import SearchManager from './search-manager.js';
import ItemDisplay from './item-display.js';
import FilterManager from './filter-manager.js';
import PaginationManager from './pagination.js';
import ApiClient from './api-client.js';
import Utils from './utils.js';
import ItemTooltip from './item-tooltip.js';

/**
 * 애플리케이션 모듈
 * 전체 앱 라이프사이클 관리 및 모듈 통합
 */
const App = (() => {
    // 앱 상태 관리
    const state = {
        initialized: false,
        isSearchMode: false,
        modules: {
            category: false,
            search: false,
            filter: false,
            pagination: false,
            display: false
        },
        sidebarState: {
            isCollapsed: true,
            activeTab: 'category'
        }
    };

    // DOM 요소 참조
    const elements = {
        mainContainer: document.getElementById('main-container'),
        searchContainer: document.getElementById('search-container'),
        searchInput: document.getElementById('search-input'),
        searchButton: document.getElementById('search-button'),
        clearButton: document.getElementById('clear-button'),
        logoButton: document.getElementById('logo-button'),
        toggleSidebarBtn: document.getElementById('toggle-sidebar'),
        contentSidebarToggle: document.getElementById('content-sidebar-toggle'),
        sidebarBackdrop: document.getElementById('sidebar-backdrop'),
        sidebarTabs: document.querySelectorAll('.sidebar-tab'),
        sidebarPanels: document.querySelectorAll('.sidebar-panel'),
        resultsContainer: document.getElementById('results-container'),
        pagination: document.getElementById('pagination')
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
        
        // 검색창 이벤트 리스너
        if (elements.searchButton) {
            elements.searchButton.addEventListener('click', triggerSearch);
        }
        
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', handleSearchInputChange);
            elements.searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    triggerSearch();
                }
            });
        }
        
        if (elements.clearButton) {
            elements.clearButton.addEventListener('click', clearSearchInput);
        }
        
        if (elements.logoButton) {
            elements.logoButton.addEventListener('click', resetSearch);
        }
        
        // 사이드바 토글 버튼들
        if (elements.toggleSidebarBtn) {
            elements.toggleSidebarBtn.addEventListener('click', toggleSidebar);
        }
        
        if (elements.contentSidebarToggle) {
            elements.contentSidebarToggle.addEventListener('click', toggleSidebar);
        }
        
        // 사이드바 백드롭 클릭 시 닫기
        if (elements.sidebarBackdrop) {
            elements.sidebarBackdrop.addEventListener('click', closeSidebar);
        }
        
        // 사이드바 탭 이벤트 리스너
        elements.sidebarTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                activateTab(tabName);
            });
        });

        // 윈도우 리사이즈 이벤트
        window.addEventListener('resize', Utils.debounce(handleResize, 200));

        console.log('앱 이벤트 리스너 설정 완료');
    }
    
    /**
     * 검색 입력창 변경 처리
     */
    function handleSearchInputChange() {
        // 검색어가 있으면 클리어 버튼 표시, 없으면 숨김
        if (elements.searchInput.value) {
            elements.clearButton.classList.add('visible');
        } else {
            elements.clearButton.classList.remove('visible');
        }
    }
    
    /**
     * 사이드바 토글
     */
    function toggleSidebar() {
        state.sidebarState.isCollapsed = !state.sidebarState.isCollapsed;
        elements.mainContainer.classList.toggle('sidebar-collapsed', state.sidebarState.isCollapsed);
        
        // 사이드바를 열 때 검색 상태에 따라 적절한 탭 활성화
        if (!state.sidebarState.isCollapsed) {
            // 검색 모드인 경우 필터 탭 활성화, 아닌 경우 카테고리 탭 활성화
            if (state.isSearchMode) {
                activateTab('filter');
            } else {
                activateTab('category');
            }
        }
    }
    
    /**
     * 사이드바 닫기
     */
    function closeSidebar() {
        state.sidebarState.isCollapsed = true;
        elements.mainContainer.classList.add('sidebar-collapsed');
    }
    
    /**
     * 사이드바 열기
     */
    function openSidebar() {
        if (state.sidebarState.isCollapsed) {
            state.sidebarState.isCollapsed = false;
            elements.mainContainer.classList.remove('sidebar-collapsed');
        }
    }
    
    /**
     * 사이드바 탭 활성화
     * @param {string} tabName - 활성화할 탭 이름
     */
    function activateTab(tabName) {
        // 모든 탭 비활성화
        elements.sidebarTabs.forEach(tab => {
            tab.classList.remove('active');
        });
        
        // 선택한 탭 활성화
        const selectedTab = document.querySelector(`.sidebar-tab[data-tab="${tabName}"]`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }
        
        // 모든 패널 숨기기
        elements.sidebarPanels.forEach(panel => {
            panel.classList.remove('active');
        });
        
        // 선택한 패널 표시
        const selectedPanel = document.getElementById(`${tabName}-panel`);
        if (selectedPanel) {
            selectedPanel.classList.add('active');
        }
        
        // 사이드바 상태 업데이트
        state.sidebarState.activeTab = tabName;
    }
    
    /**
     * 검색 입력창 클리어
     */
    function clearSearchInput() {
        if (elements.searchInput) {
            elements.searchInput.value = '';
            elements.clearButton.classList.remove('visible');
            elements.searchInput.focus();
        }
    }
    
    /**
     * 윈도우 리사이즈 처리
     */
    function handleResize() {
        // 반응형 처리 필요한 경우 여기에 추가
        if (window.innerWidth > 768 && !state.sidebarState.isCollapsed) {
            // 상태 유지, 큰 화면에서는 사이드바를 열어둠
        } else if (window.innerWidth <= 768) {
            // 모바일 화면에서는 사이드바 접기
            state.sidebarState.isCollapsed = true;
            elements.mainContainer.classList.add('sidebar-collapsed');
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
    
        // 검색 모드로 전환
        enterSearchMode();
        
        // 검색 결과가 있을 때 세부 옵션 탭 활성화
        if (!state.sidebarState.isCollapsed) {
            activateTab('filter');
        }
    
        ApiClient.setLoading(true);
    
        try {
            let result;
            
            // 자동완성 검색 처리
            if (selectedItem && selectedItem.name) {
                const category = selectedItem.subCategory || subCategory;
                const mainCat = selectedItem.mainCategory || mainCategory;
                
                console.log('아이템 검색: ', {
                    mainCategory: mainCat,
                    subCategory: category,
                    itemName: selectedItem.name
                });
                
                // 특별 카테고리 확인 (인챈트 스크롤, 도면, 옷본)
                const isSpecialCategory = ['인챈트 스크롤', '도면', '옷본'].includes(category);
                
                if (isSpecialCategory) {
                    // 특별 카테고리는 먼저 카테고리 검색 후 클라이언트 측 필터링
                    result = await ApiClient.searchByCategory(mainCat, category);
                    
                    // 클라이언트 측 필터링 - 선택된 아이템 이름과 일치하는 항목만 필터링
                    if (result.items && result.items.length > 0) {
                        const filteredItems = result.items.filter(item => 
                            item.item_display_name === selectedItem.name
                        );
                        result.items = filteredItems;
                        result.totalCount = filteredItems.length;
                    }
                } else {
                    // 일반 카테고리는 기존 방식으로 처리
                    result = await ApiClient.searchByCategory(
                        mainCat, 
                        category, 
                        selectedItem.name
                    );
                }
            }
            // 카테고리 검색 처리
            else if (subCategory) {
                // 카테고리 검색 수행
                console.log('카테고리 검색: ', {
                    mainCategory,
                    subCategory
                });
                
                // 카테고리 검색만 수행
                result = await ApiClient.searchByCategory(mainCategory, subCategory);
            }
            // 키워드 검색 처리
            else if (searchTerm) {
                console.log('키워드 검색: ', { searchTerm });
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
                showResultsContainer();
            }
        } catch (error) {
            console.error('검색 처리 중 오류:', error);
            showErrorMessage('검색 처리 중 오류가 발생했습니다.');
        } finally {
            ApiClient.setLoading(false);
        }
    }

    /**
     * 검색 모드로 전환
     */
    function enterSearchMode() {
        if (state.isSearchMode) return;
        
        state.isSearchMode = true;
        elements.searchContainer.classList.add('search-mode');
        showResultsContainer();
        elements.pagination.classList.add('visible');
    }
    
    /**
     * 초기 모드로 전환
     */
    function exitSearchMode() {
        if (!state.isSearchMode) return;
        
        state.isSearchMode = false;
        elements.searchContainer.classList.remove('search-mode');
        hideResultsContainer();
        elements.pagination.classList.remove('visible');
    }
    
    /**
     * 결과 컨테이너 표시
     */
    function showResultsContainer() {
        elements.resultsContainer.classList.add('visible');
        elements.pagination.classList.add('visible');
    }
    
    /**
     * 결과 컨테이너 숨기기
     */
    function hideResultsContainer() {
        elements.resultsContainer.classList.remove('visible');
        elements.pagination.classList.remove('visible');
    }
    
    /**
     * 검색 실행 트리거
     */
    function triggerSearch() {
        const searchTerm = elements.searchInput.value.trim();
        
        if (!searchTerm) return;
        
        const searchEvent = new CustomEvent('search', {
            detail: {
                searchTerm,
                selectedItem: null,
                mainCategory: null,
                subCategory: null
            }
        });
        
        document.dispatchEvent(searchEvent);
    }
    
    /**
     * 검색 초기화 처리
     */
    function resetSearch() {
        // 검색 입력창 초기화
        clearSearchInput();
        
        // 초기 모드로 전환
        exitSearchMode();
        
        // 카테고리 선택 초기화
        CategoryManager.resetSelectedCategories();
        
        // 필터 초기화
        FilterManager.resetFilters();
        
        // 사이드바 탭 상태 - 카테고리 탭 활성화
        if (!state.sidebarState.isCollapsed) {
            activateTab('category');
        }
        
        // 검색 초기화 이벤트 발생
        document.dispatchEvent(new CustomEvent('searchReset'));
    }
    
    /**
     * 검색 초기화 이벤트 핸들러
     */
    function handleSearchReset() {
        // 결과 테이블 초기화
        ItemDisplay.clearResults();
        
        // 초기 모드로 전환
        exitSearchMode();
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
                        subCategory,
                        // 아이템 이름이 있는 경우 선택된 아이템으로 간주
                        selectedItem: itemName ? {
                            name: itemName,
                            mainCategory,
                            subCategory
                        } : null
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
     * 오류 메시지 표시
     * @param {string} message - 오류 메시지
     */
    function showErrorMessage(message) {
        const resultsBody = document.getElementById('results-body');
        
        if (resultsBody) {
            resultsBody.innerHTML = `
                <tr class="error-result">
                    <td colspan="4">
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
            
            // 결과 컨테이너 표시
            showResultsContainer();
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
     * 애플리케이션 초기화
     */
    async function init() {
        try {
            // 이벤트 리스너 설정
            setupEventListeners();
            
            // 기본 UI 상태 설정
            elements.mainContainer.classList.add('sidebar-collapsed');
            elements.clearButton.classList.remove('visible');
            hideResultsContainer();
            elements.pagination.classList.remove('visible');
            
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
            
            ItemTooltip.init();

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
            // 검색어 설정
            if (elements.searchInput) {
                elements.searchInput.value = searchTerm;
                handleSearchInputChange();
            }
            
            // 검색 실행
            triggerSearch();
        } else if (category) {
            // 카테고리 선택 처리
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
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.margin = '2rem';
        errorDiv.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            ${message} <button class="reload-btn">새로고침</button>
        `;
        
        // 검색 컨테이너에 오류 메시지 추가
        elements.searchContainer.appendChild(errorDiv);
        
        // 새로고침 버튼 이벤트
        const reloadBtn = errorDiv.querySelector('.reload-btn');
        if (reloadBtn) {
            reloadBtn.addEventListener('click', () => {
                window.location.reload();
            });
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
