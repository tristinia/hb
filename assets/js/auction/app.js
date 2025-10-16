/**
 * app.js - 마비노기 도구모음 메인 스크립트
 */

// 필요한 모듈 가져오기
import CategoryManager from './category-manager.js';
import SearchManager from './search-manager.js';
import ItemDisplay from './item-display.js';
import FilterManager from './filter-manager.js';
import filterUI from './filter-ui.js';
import PaginationManager from './pagination.js';
import ApiClient from './api-client.js';
import Utils from './utils.js';
import ItemTooltip from './item-tooltip.js';
import AutocompleteEngine from '../common/autocomplete-engine.js';

/**
 * 애플리케이션 모듈
 * 전체 앱 라이프사이클 관리 및 모듈 통합
 */
const App = (() => {
    // 앱 상태 관리
    const state = {
        initialized: false,
        isSearchMode: false,
        isSearching: false,  // 중복 검색 방지를 위한 플래그
        modules: {
            search: false,
            filter: false,
            pagination: false,
            display: false
        },
        isLoading: false,
        hasError: false,
        lastSearch: {
            searchTerm: null,
            selectedItem: null,
            timestamp: 0
        },
        // 자동완성 캐시
        autocompleteCache: {
            searchTerm: null,
            selectedItem: null,
            category: null,
            mainCategory: null,
            isSpecialCategory: false,
            timestamp: 0
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
        resultsContainer: document.getElementById('results-container'),
        pagination: document.getElementById('pagination'),
        pageContent: document.getElementById('page-content')
    };
    
    /**
     * 이벤트 리스너 설정
     */
    function setupEventListeners() {
        // 검색 이벤트
        document.addEventListener('search', event => {
            if (event && event instanceof CustomEvent) {
                handleSearch(event);
            }
        });
        
        // 검색 초기화 이벤트
        document.addEventListener('searchReset', handleSearchReset);
        
        // 페이지 변경 이벤트
        document.addEventListener('pageChanged', handlePageChanged);
        
        // 아이템 선택 이벤트
        document.addEventListener('itemSelected', handleItemSelected);
        
        // 필터 변경 이벤트
        document.addEventListener('filterChanged', handleFilterChanged);
        
        // 자동완성 선택 이벤트
        document.addEventListener('autocompleteSelected', handleAutocompleteSelected);
        
        // 검색창 이벤트 리스너
        if (elements.searchButton) {
            elements.searchButton.addEventListener('click', triggerSearch);
        }
        
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', handleSearchInputChange);
            
            elements.searchInput.addEventListener('keydown', (e) => {
                // 자동완성이 표시되지 않은 상태에서만 엔터키로 검색 실행
                if (e.key === 'Enter' && !AutocompleteEngine.isSuggestionVisible()) {
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
        
        // 윈도우 리사이즈 이벤트
        window.addEventListener('resize', Utils.debounce(handleResize, 200));
    
        // 필터링된 검색 결과 수신 이벤트
        document.addEventListener('filteredSearchResults', handleFilteredSearchResults);
    
        // 검색 결과 수신 이벤트 처리
        document.addEventListener('searchResultsReceived', (e) => {
            const { results, searchTerm } = e.detail;
            // 카테고리 검색인지 확인
            const isCategorySearch = state.lastSearch && state.lastSearch.categorySearch;
            
            if (results && Array.isArray(results)) {
                // 분양 메달 필터링 적용 - 카테고리 검색이 아닌 경우에만 필터링
                const isPetMedalSearch = !isCategorySearch && state.lastSearch && 
                                       state.lastSearch.selectedItem && 
                                       SearchManager.isPetMedalCategory(state.lastSearch.selectedItem.subCategory);
                
                // 카테고리 검색인 경우 종족명만 추가하고 필터링은 하지 않음
                const shouldFilter = isPetMedalSearch;
                
                const processedResults = SearchManager.filterPetMedalResults(
                    results, 
                    shouldFilter ? searchTerm : null
                );
                
                // 결과 표시
                ItemDisplay.setSearchResults(processedResults);
                
                // silent 모드로 페이지네이션 업데이트 (로그 출력 안 함)
                PaginationManager.resetPagination(processedResults.length, true);
            }
        });
        
        // 모든 페이지 로드 완료 이벤트
        document.addEventListener('allPagesLoaded', (e) => {
            const { items, totalItems, totalPages } = e.detail;
            
            // 로딩 표시기 숨김
            hideLoading();
            
            // 검색 컨텍스트 확인
            const isCategorySearch = state.lastSearch && state.lastSearch.categorySearch;
            const isPetMedalSearch = !isCategorySearch && state.lastSearch && 
                                   state.lastSearch.selectedItem && 
                                   SearchManager.isPetMedalCategory(state.lastSearch.selectedItem.subCategory);
            
            // 분양 메달 필터링 적용
            let displayItems = items;
            if (isPetMedalSearch) {
                displayItems = SearchManager.filterPetMedalResults(
                    items, 
                    state.lastSearch ? state.lastSearch.searchTerm : ''
                );
            } else if (isCategorySearch && state.lastSearch && state.lastSearch.selectedItem && 
                     SearchManager.isPetMedalCategory(state.lastSearch.selectedItem.subCategory)) {
                // 카테고리 검색이지만 분양 메달 카테고리인 경우 종족명만 추가
                displayItems = SearchManager.filterPetMedalResults(items, null);
            }
            
            // 결과 없음 처리
            if (!displayItems || displayItems.length === 0) {
                ItemDisplay.showNoResults();
                return;
            }
            
            // 결과 표시
            ItemDisplay.setSearchResults(displayItems);
            
            // 페이지네이션 최종 업데이트 (정확한 전체 아이템 수)
            PaginationManager.resetPagination(displayItems.length);
        });
    
        // 페이지 로드 오류 이벤트
        document.addEventListener('pageLoadError', (e) => {
            const { error, loadedItems, loadedPages } = e.detail;
            
            // 로딩 표시기 숨김
            hideLoading();
            
            console.error('페이지 로드 오류:', error);
            
            // 오류 메시지 표시 (일부 결과만 로드된 경우에는 생략)
            if (!loadedItems || loadedItems.length === 0) {
                showErrorMessage(`데이터를 불러오는 중 오류가 발생했습니다.: ${error}`);
            } else {
                // 일부 결과만 로드된 경우 경고 메시지
                console.warn(`일부 페이지만 로드됨: ${loadedPages}페이지, ${loadedItems.length}개 항목`);
                
                // 일부 로드된 결과라도 표시
                const isCategorySearch = state.lastSearch && state.lastSearch.categorySearch;
                const isPetMedalSearch = !isCategorySearch && state.lastSearch && 
                                       state.lastSearch.selectedItem && 
                                       SearchManager.isPetMedalCategory(state.lastSearch.selectedItem.subCategory);
                
                // 분양 메달 필터링 적용
                let displayItems = loadedItems;
                if (isPetMedalSearch) {
                    displayItems = SearchManager.filterPetMedalResults(
                        loadedItems, 
                        state.lastSearch ? state.lastSearch.searchTerm : ''
                    );
                } else if (isCategorySearch && state.lastSearch && state.lastSearch.selectedItem && 
                         SearchManager.isPetMedalCategory(state.lastSearch.selectedItem.subCategory)) {
                    displayItems = SearchManager.filterPetMedalResults(loadedItems, null);
                }
                
                // 결과 표시
                ItemDisplay.setSearchResults(displayItems);
                
                // 페이지네이션 업데이트
                PaginationManager.resetPagination(displayItems.length);
            }
        });
    }
    
    /**
     * 자동완성 선택 처리
     */
    function handleAutocompleteSelected(event) {
        // 이벤트에서 데이터 추출
        const detail = event.detail || {};
        const item = detail.item || {};
        
        // 검색창 현재 값 가져오기
        const currentInputValue = elements.searchInput ? elements.searchInput.value : '';
        
        // 자동완성 캐시 갱신
        state.autocompleteCache = {
            searchTerm: currentInputValue, // 수정: item.name → currentInputValue
            selectedItem: item,
            category: item.subCategory || '',
            mainCategory: item.mainCategory || '',
            timestamp: Date.now(),
            isCategorySearch: item.isCategory || false
        };
        
        // 분양 메달 여부 확인
        if (SearchManager.isPetMedalCategory(item.subCategory)) {
            state.isPetMedalSearchActive = true;
            state.petMedalSearchTerm = elements.searchInput ? elements.searchInput.value : '';
        } else {
            state.isPetMedalSearchActive = false;
            state.petMedalSearchTerm = '';
        }
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
        
        // 캐시된 검색어와 다른 경우에만 캐시 초기화
        if (state.autocompleteCache && 
            state.autocompleteCache.searchTerm !== elements.searchInput.value.trim()) {
            state.autocompleteCache = null;
        }
    }
    
    /**
     * 로딩 표시기 표시
     */
    function showLoading() {
        const loader = document.getElementById('loading-spinner');
        if (loader) {
            loader.style.display = 'flex';
            
            // 로딩 메시지 초기화
            const loadingText = loader.querySelector('p');
            if (loadingText) {
                loadingText.textContent = '데이터를 불러오는 중...';
            }
        }
        state.isLoading = true;
    }
    
    /**
     * 로딩 표시기 숨김
     */
    function hideLoading() {
        const loader = document.getElementById('loading-spinner');
        if (loader) {
            loader.style.display = 'none';
        }
        state.isLoading = false;
    }
    
    /**
     * 검색 표시 업데이트
     * @param {string} searchTerm - 검색어
     */
    function updateSearchDisplay(searchTerm) {
        // 검색어가 있을 때만 클리어 버튼 표시
        if (elements.clearButton) {
            elements.clearButton.classList.toggle('visible', searchTerm && searchTerm.length > 0);
        }
        
        // 자동완성 닫기
        AutocompleteEngine.clearSuggestions();
        
        // 페이지 타이틀 업데이트
        document.title = searchTerm ? `${searchTerm} - 마비노기DB` : '마비노기DB';
    }
    
    /**
     * 검색 입력창 클리어
     */
    function clearSearchInput() {
        if (elements.searchInput) {
            elements.searchInput.value = '';
            elements.clearButton.classList.remove('visible');
            elements.searchInput.focus();
            
            // 자동완성 닫기
            AutocompleteEngine.clearSuggestions();
        }
    }
    
    /**
     * 윈도우 리사이즈 처리
     */
    function handleResize() {
        // 기본 반응형 처리
        if (window.innerWidth <= 768) {
            // 모바일 화면에서의 처리
        } else {
            // 데스크톱 화면에서의 처리
        }
    }

    /**
     * 검색 실행
     * @param {CustomEvent} event - 검색 이벤트 (옵션)
     */
    function handleSearch(event) {
        // 성능 측정 시작
        const startTime = performance.now();
        
        // 로딩 또는 오류 상태면 무시
        if (state.isLoading || state.hasError) return;
        
        // 이미 검색 중이면 중복 실행 방지
        if (state.isSearching) return;
        
        try {
            // 검색 중 상태로 설정
            state.isSearching = true;
    
            // 진행 중인 백그라운드 로딩 중단
            ApiClient.abortBackgroundLoading();
            
            // 이벤트에서 데이터 추출 또는 입력 필드에서 데이터 가져오기
            let searchTerm, selectedItem, mainCategory, subCategory;
            
            if (event && event.detail) {
                // 이벤트에서 데이터 추출
                ({ searchTerm, selectedItem, mainCategory, subCategory } = event.detail);
            } else {
                // 입력 필드에서 최신 검색어 가져오기
                if (elements.searchInput) {
                    searchTerm = elements.searchInput.value.trim();
                }
                
                // SearchManager에서 상태 가져오기
                const searchState = SearchManager.getSearchState();
                selectedItem = searchState.selectedItem;
                
                // 검색어와 선택된 아이템 이름이 다른 경우 선택된 아이템 초기화
                if (selectedItem && selectedItem.name !== searchTerm) {
                    selectedItem = null;
                }
            }
            
            // 검색어가 없는 경우 처리
            if (!searchTerm) {
                state.isSearching = false;
                return;
            }
            
            // 자동완성 캐시 확인
            const useCache = !selectedItem && state.autocompleteCache && 
                            state.autocompleteCache.searchTerm === searchTerm;
            
            // 캐시된 항목 정보 사용
            if (useCache) {
                selectedItem = state.autocompleteCache.selectedItem;
                subCategory = state.autocompleteCache.category;
                mainCategory = state.autocompleteCache.mainCategory;
            }
            
            // 검색 모드로 전환
            enterSearchMode();
            
            // 검색 결과 표시 영역 표시
            showResultsContainer();
            if (window.filterUI && typeof window.filterUI.adjustResultsContainerPosition === 'function') {
                window.filterUI.adjustResultsContainerPosition();
            }
            
            // 마지막 검색 정보 저장
            state.lastSearch = {
                searchTerm,
                selectedItem,
                timestamp: Date.now(),
                categorySearch: event && event.detail && event.detail.categorySearch
            };
            
            // 검색어 표시 업데이트
            updateSearchDisplay(searchTerm);
            
            // 로딩 스피너 표시
            showLoading();
            
            // 결과 영역 초기화
            ItemDisplay.clearResults();
            
            // API 호출 또는 로컬 데이터 검색 수행
            let apiPromise;
            
            // 자동완성 아이템 선택 혹은 캐시 존재 확인
            if ((selectedItem && selectedItem.subCategory) || subCategory) {
                const itemCategory = selectedItem ? selectedItem.subCategory : subCategory;
                const itemMainCategory = selectedItem ? selectedItem.mainCategory : mainCategory;
                
                // 카테고리 검색인지 확인
                const isCategorySearch = event && event.detail && event.detail.categorySearch;
                
                // 아이템 검색인지 카테고리 검색인지에 따라 분기
                if (isCategorySearch) {
                    // 카테고리 검색 - 모든 카테고리를 동일하게 처리
                    console.log(`카테고리 [${itemCategory}] 검색`);
                    apiPromise = ApiClient.searchByCategory(
                        itemMainCategory, 
                        itemCategory, 
                        null  // 카테고리 검색은 검색어 없이 진행
                    );
                } else {
                    // 특별 카테고리 확인
                    const isKeywordSearchCategory = SearchManager.isSpecialKeywordCategory(itemCategory);
                    const isPetMedalCategory = SearchManager.isPetMedalCategory(itemCategory);
                    
                    if (isKeywordSearchCategory) {
                        // 인챈트, 옷본, 도면 검색 처리
                        console.log(`아이템 [${searchTerm}] 검색`);
                        apiPromise = ApiClient.searchByKeyword(searchTerm);
                    } else if (isPetMedalCategory) {
                        // 분양 메달 검색 처리
                        console.log(`아이템 [분양 메달(${searchTerm})] 검색`);
                        apiPromise = ApiClient.searchByCategory(
                            itemMainCategory, 
                            itemCategory,
                            null
                        );
                    } else {
                        // 일반 아이템 검색 처리
                        console.log(`아이템 [${itemCategory}/${searchTerm}] 검색`);
                        apiPromise = ApiClient.searchByCategory(
                            itemMainCategory, 
                            itemCategory, 
                            searchTerm
                        );
                    }
                }
            } else {
                // 일반 키워드 검색 처리
                console.log(`아이템 [${searchTerm}] 검색`);
                apiPromise = ApiClient.searchByKeyword(searchTerm);
            }
            
            // API 응답 처리
            apiPromise
                .then(results => {
                    // 결과가 없는 경우 처리
                    if (!results || !results.items || results.items.length === 0) {
                        ItemDisplay.showNoResults();
                        hideLoading(); // 결과가 없을 때만 바로 로딩 숨김
                        console.log(`검색 완료: 결과 없음, ${Math.ceil(performance.now() - startTime)}ms`);
                    }
                })
                .catch(error => {
                    // 로딩 숨김
                    hideLoading();
                    
                    // 오류 처리
                    console.error('검색 요청 중 오류 발생:', error);
                    showErrorMessage('검색 결과를 불러올 수 없습니다.');
                })
                .finally(() => {
                    // 검색 상태 초기화
                    state.isSearching = false;
                });
        } catch (error) {
            // 로딩 숨김
            hideLoading();
            
            // 오류 상태 설정
            state.isSearching = false;
            
            // 오류 로깅 및 표시
            console.error('검색 처리 중 오류 발생:', error);
            showErrorMessage('검색을 처리할 수 없습니다.');
        }
    }
    
    /**
     * 검색 모드로 전환
     */
    function enterSearchMode() {
        if (state.isSearchMode) return;
        
        state.isSearchMode = true;
        
        // transitionend 이벤트 리스너 추가
        const transitionEndHandler = function() {
            // 필터 컨테이너 표시
            const filterContainer = document.getElementById('filter-container');
            if (filterContainer) {
                filterContainer.style.display = 'flex';
            }
            
            showResultsContainer();
            elements.pagination.classList.add('visible');
            
            // 이벤트 리스너 제거 (한 번만 실행)
            elements.searchContainer.removeEventListener('transitionend', transitionEndHandler);
        };
        
        // 트랜지션 이벤트 리스너 등록
        elements.searchContainer.addEventListener('transitionend', transitionEndHandler);
        
        // 검색 모드 클래스 추가 - 이게 트랜지션을 시작함
        elements.searchContainer.classList.add('search-mode');
    }
    
    /**
     * 초기 모드로 전환
     */
    function exitSearchMode() {
        if (!state.isSearchMode) return;
        
        state.isSearchMode = false;
        elements.searchContainer.classList.remove('search-mode');
        
        // 필터 컨테이너 숨김
        const filterContainer = document.getElementById('filter-container');
        if (filterContainer) {
            filterContainer.style.display = 'none';
        }
        
        hideResultsContainer();
        elements.pagination.classList.remove('visible');
    }
    
    /**
     * 결과 컨테이너 표시
     */
    function showResultsContainer() {
        elements.resultsContainer.classList.add('visible');
        elements.pagination.classList.add('visible');
        
        // 푸터 표시
        const footer = document.getElementById('site-footer');
        if (footer) {
            footer.classList.remove('hidden');
        }
        
        // 컨텐츠 영역에 푸터 여백 추가
        elements.pageContent.classList.add('with-footer');
        
        // 결과 컨테이너에 푸터 여백 추가
        elements.resultsContainer.classList.add('with-footer');
    }
    
    /**
     * 결과 컨테이너 숨기기
     */
    function hideResultsContainer() {
        elements.resultsContainer.classList.remove('visible');
        elements.pagination.classList.remove('visible');
        
        // 푸터 숨김
        const footer = document.getElementById('site-footer');
        if (footer) {
            footer.classList.add('hidden');
        }
        
        // 컨텐츠 영역 푸터 여백 제거
        elements.pageContent.classList.remove('with-footer');
        
        // 결과 컨테이너 푸터 여백 제거
        elements.resultsContainer.classList.remove('with-footer');
    }
    
    /**
     * 검색 실행 트리거
     */
    function triggerSearch() {
        // 로딩 또는 오류 상태면 무시
        if (state.isLoading || state.hasError || state.isSearching) return;
        
        // 자동완성이 표시된 상태인지 확인
        const isAutoCompleteVisible = AutocompleteEngine.isSuggestionVisible();
        const activeItem = isAutoCompleteVisible ? AutocompleteEngine.getActiveItem() : null;
        
        // 선택된 자동완성 항목이 있으면 그것으로 검색
        if (isAutoCompleteVisible && activeItem) {
            // 선택 이벤트를 발생시키고 리턴
            const selectEvent = new CustomEvent('autocompleteSelected', {
                detail: {
                    item: activeItem.item,
                    index: activeItem.index,
                    context: 'auction'
                }
            });
            document.dispatchEvent(selectEvent);
            return;
        }
        
        const searchTerm = elements.searchInput.value.trim();
    
        if (!searchTerm) {
            return;
        }
        
        // SearchManager에서 상태 가져오기
        const searchState = SearchManager.getSearchState();
        const selectedItem = searchState.selectedItem;
        
        // 검색어가 선택된 아이템과 동일한 경우 해당 아이템 정보 사용
        const useSelectedItem = selectedItem && (
            selectedItem.name === searchTerm || 
            `카테고리: ${selectedItem.name}` === searchTerm
        );
        
        // 검색 이벤트에 카테고리 검색 정보 추가
        const searchEvent = new CustomEvent('search', {
            detail: {
                searchTerm,
                selectedItem: useSelectedItem ? selectedItem : null,
                isPetMedalSearch: searchState.isPetMedalSearchActive,
                petMedalSearchTerm: searchState.petMedalSearchTerm,
                categorySearch: searchState.isCategorySearch
            }
        });
        document.dispatchEvent(searchEvent);
    }
    
    /**
     * 검색 초기화 처리
     */
    function resetSearch() {
        // 백그라운드 로딩 중단
        ApiClient.abortBackgroundLoading();
        
        // 필터 상태 초기화
        resetAllFilters();
        
        // 검색 입력창 초기화
        clearSearchInput();
        
        // 초기 모드로 전환
        exitSearchMode();
        
        // 검색 상태 초기화
        SearchManager.resetSearch();
        
        // 마지막 검색 정보 초기화
        state.lastSearch = {
            searchTerm: null,
            selectedItem: null,
            timestamp: 0
        };
        
        // 자동완성 캐시 초기화
        state.autocompleteCache = null;
        
        // 검색 초기화 이벤트 발생
        document.dispatchEvent(new CustomEvent('searchReset'));
        
        // 페이지 타이틀 초기화
         document.title = '마비노기DB';

        // 필터 UI 위치 재조정
        if (window.filterUI && typeof window.filterUI.adjustResultsContainerPosition === 'function') {
            window.filterUI.adjustResultsContainerPosition();
        }
    }
    
    /**
     * 검색 초기화 이벤트 핸들러
     */
    function handleSearchReset() {
        // 백그라운드 로딩 중단
        ApiClient.abortBackgroundLoading();
        
        // 결과 테이블 초기화
        ItemDisplay.clearResults();
        
        // 초기 모드로 전환
        exitSearchMode();
        
        // 로딩 표시기 숨김
        hideLoading();
               
        // 페이지 타이틀 초기화
        updateSearchDisplay('');
    }
    
    /**
     * 필터 변경 처리
     */
    function handleFilterChanged(event) {
        // 로컬 필터링 적용
        ItemDisplay.applyLocalFiltering();
    }
    
    /**
     * 페이지 변경 처리
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
        // 자동완성 리스트 닫기
        AutocompleteEngine.clearSuggestions();
        
        const { item } = event.detail;
        
        if (!item) {
            console.warn('선택된 아이템 정보가 없습니다.');
            return;
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
     */
    function showErrorMessage(message) {
        const resultsBody = document.getElementById('results-body');
        
        if (resultsBody) {
            const tr = document.createElement('tr');
            tr.className = 'empty-result';
            tr.innerHTML = `<td colspan="4">${message}</td>`;
            
            resultsBody.innerHTML = '';
            resultsBody.appendChild(tr);
            
            // 결과 컨테이너 표시
            showResultsContainer();
        }
    }

    /**
     * 키보드 이벤트 캡처 설정
     * 자동완성 및 검색 관련 키보드 이벤트 처리
     */
    function setupKeyboardCapture() {
        const searchInput = document.getElementById('search-input');
        if (!searchInput) return;
        
        // 키보드 이벤트는 AutocompleteEngine에서 주로 처리
        // 여기서는 AutocompleteEngine과 충돌하지 않는 동작만 처리
        searchInput.addEventListener('keydown', function(e) {
            // 자동완성 상태 확인
            const isSuggestionVisible = AutocompleteEngine.isSuggestionVisible();
            
            // 자동완성이 표시되지 않은 상태에서만 Enter 키 처리
            if (e.key === 'Enter' && !isSuggestionVisible) {
                triggerSearch();
            }
        }, true);
    }

    /**
     * 필터링된 검색 결과 처리
     */
    function handleFilteredSearchResults(event) {
        const { results, searchTerm, isFiltered } = event.detail;
        
        if (results && Array.isArray(results)) {
            // 이미 처리된 결과이므로 다시 필터링하지 않음
            const processedResults = results;
            
            // 결과가 없는 경우
            if (processedResults.length === 0) {
                ItemDisplay.showNoResults();
                console.log('검색 결과: 일치하는 항목 없음');
                return;
            }
            
            // 검색 결과 표시
            ItemDisplay.setSearchResults(processedResults);
            
            // 일반 모드로 페이지네이션 업데이트 (로그 표시)
            PaginationManager.resetPagination(processedResults.length, false);
        }
    }
    
    /**
     * 모듈 초기화 진행 표시
     */
    function markModuleInitialized(moduleName) {
        if (state.modules.hasOwnProperty(moduleName)) {
            state.modules[moduleName] = true;
            
            // 모든 모듈이 초기화되었는지 확인
            const allInitialized = Object.values(state.modules).every(value => value === true);
            if (allInitialized && !state.initialized) {
                state.initialized = true;
                console.log('모듈 초기화 완료');
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
    
            // 키보드 이벤트 캡처 설정
            setupKeyboardCapture();
                    
            // 기본 UI 상태 설정
            elements.clearButton.classList.remove('visible');
            hideResultsContainer();
            elements.pagination.classList.remove('visible');
            
            // 검색 관리자 초기화
            await initSearchManager();
            
            // 병렬 초기화 (남은 모듈)
            await Promise.all([
                initFilterManager(),
                initPaginationManager(),
                initItemDisplay()
            ]);
            
            // 필터 UI 초기화
            filterUI.init();
            
            ItemTooltip.init();
    
            // 반응형 레이아웃 초기 설정
            handleResize();
            
            console.log('애플리케이션 초기화 완료');
        } catch (error) {
            console.error('애플리케이션 초기화 중 오류 발생:', error);
            showInitError('애플리케이션 초기화 중 오류가 발생했습니다.');
        }
    }

    /**
     * 검색 관리자 초기화
     */
    async function initSearchManager() {
        try {
            SearchManager.init();
            markModuleInitialized('search');
            return true;
        } catch (error) {
            console.error('검색 관리자 초기화 실패:', error);
            return false;
        }
    }
    
    /**
     * 필터 관리자 초기화
     */
    async function initFilterManager() {
        try {
            await FilterManager.init();
            markModuleInitialized('filter');
            return true;
        } catch (error) {
            console.error('필터 관리자 초기화 실패:', error);
            return false;
        }
    }
    
    /**
     * 페이지네이션 관리자 초기화
     */
    async function initPaginationManager() {
        try {
            PaginationManager.init();
            markModuleInitialized('pagination');
            return true;
        } catch (error) {
            console.error('페이지네이션 관리자 초기화 실패:', error);
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
     * 초기화 오류 표시
     */
    function showInitError(message) {
        // 검색 입력창에 오류 메시지 표시
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            // 전달된 메시지 사용
            searchInput.placeholder = message;
            searchInput.classList.add('search-error');
            
            // 검색 버튼 비활성화
            const searchButton = document.querySelector('.search-button');
            if (searchButton) {
                searchButton.setAttribute('disabled', 'true');
            }
        }
    }

    /**
     * 모든 필터 초기화
     */
    function resetAllFilters() {
        // FilterManager 초기화
        FilterManager.resetFilters();
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
    App.init();
});
