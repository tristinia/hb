/**
 * search 서비스
 * 경매장 특화 검색 기능 및 자동완성 처리 (클라이언트 사이드 인덱스 검색 방식으로 변경)
 */

import Utils from './utils.js';
import apiClient from './api-client.js'; // apiClient 사용

const MAX_RESULTS = 30;
const MIN_SCORE = 40;
// 특별 카테고리 정의
const SPECIAL_CATEGORIES = {
    KEYWORD_SEARCH: ['인챈트 스크롤', '도면', '옷본'],
    PET_MEDAL: '분양 메달'
};

const search = (() => {
    // 경매장 검색 상태
    const state = {
        searchTerm: '',
        suggestions: [],
        activeSuggestion: -1, // 자동완성 활성 인덱스
        selectedItem: null,
        isSuggestionVisible: false, // 자동완성 표시 여부
        isLoading: false, // 로딩 상태
        hasError: false, // 오류 상태
        isPetMedalSearchActive: false, // 분양 메달 특별 검색 모드
        petMedalSearchTerm: '', // 분양 메달 필터링용 검색어
        isCategorySearch: false,
        showViaDownArrow: false, // 방향키로 자동완성 열었는지 여부
        isIndexLoaded: false, // 아이템 인덱스 로딩 완료 여부
    };
    
    // 자동완성 데이터
    let allItems = []; // 전체 아이템 목록 (인덱스)
    let lastKnownETag = null; // 아이템 인덱스의 ETag
    const chosungCache = new Map(); // 초성 변환 결과 캐시 (모듈 스코프로 이동)
    const UPDATE_INTERVAL = 5 * 60 * 1000; // 5분
    
    // DOM 요소 참조
    let elements = {
        searchInput: null,
        searchButton: null,
        resetButton: null,
        suggestionsList: null,
        suggestionsContainer: null
    };
    
    /**
     * 모듈 초기화
     */
    function init() {
        try {
            // DOM 요소 참조 가져오기
            elements.searchInput = document.getElementById('search-input');
            elements.searchButton = document.querySelector('.search-button');
            elements.resetButton = document.getElementById('reset-button');
            elements.suggestionsList = document.getElementById('suggestions'); // 자동완성 목록
            elements.suggestionsContainer = document.getElementById('suggestions-container'); // 자동완성 컨테이너
    
            if (elements.searchInput) {
                elements.searchInput.spellcheck = false;
                elements.searchInput.placeholder = "아이템 이름을 입력하세요...";
            }
            
            // 이벤트 리스너 설정
            setupEventListeners();

            // 백그라운드 업데이트 시작
            setInterval(checkIndexForUpdates, UPDATE_INTERVAL);

        } catch (error) {
            console.error('검색 관리자 초기화 오류:', error);
            state.hasError = true;
            
            if (elements.searchInput) {
                showSearchInputError('검색 기능을 초기화할 수 없습니다. 페이지를 새로고침 해주세요.');
            }
        }
    }
    
    /**
     * 이벤트 리스너 설정
     */
    function setupEventListeners() {
        // 검색 입력창 이벤트
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', handleSearchInput); // Debounce 제거, 즉각 반응
            elements.searchInput.addEventListener('keydown', handleKeyDown, true);
            elements.searchInput.addEventListener('click', handleSearchInputClick);
            elements.searchInput.addEventListener('focus', loadItemIndex); // 포커스 시 인덱스 로딩
        }
        
        if (elements.searchButton) {
            elements.searchButton.addEventListener('click', handleSearch);
        }
        
        if (elements.resetButton) {
            elements.resetButton.addEventListener('click', resetSearch);
        }

        // 문서 클릭 시 자동완성 닫기
        document.addEventListener('click', handleDocumentClick, true);

        // 검색 완료 시 자동완성 닫기
        document.addEventListener('search', clearSuggestions);

        // 검색 결과 수신 리스너
        document.addEventListener('searchResultsReceived', (e) => {
            const { results, searchTerm } = e.detail;
        });

        // 자동완성 컨테이너 위치 조정을 위한 이벤트
        if (window.ResizeObserver) {
            const searchContainerObserver = new ResizeObserver(() => {
                if (state.isSuggestionVisible) {
                    updateSuggestionsPosition();
                }
            });
            const searchContainer = document.querySelector('.search-container');
            if (searchContainer) {
                searchContainerObserver.observe(searchContainer);
            }
        }
        window.addEventListener('resize', () => {
            if (state.isSuggestionVisible) updateSuggestionsPosition();
        });
        window.addEventListener('scroll', () => {
            if (state.isSuggestionVisible) updateSuggestionsPosition();
        });
    }

    /**
     * 자동완성 목록 위치 동적 계산
     */
    function updateSuggestionsPosition() {
        if (!state.isSuggestionVisible || !elements.searchInput) return;
        
        const searchWrapper = document.querySelector('.search-wrapper');
        if (!searchWrapper) return;
        
        const searchRect = searchWrapper.getBoundingClientRect();
        const topPosition = searchRect.bottom + 10;
        
        elements.suggestionsContainer.style.position = 'fixed';
        elements.suggestionsContainer.style.top = `${topPosition}px`;
        elements.suggestionsContainer.style.width = `${searchRect.width}px`;
        elements.suggestionsContainer.style.left = `${searchRect.left}px`;
        elements.suggestionsContainer.style.transform = 'none';
        elements.suggestionsContainer.style.maxWidth = 'none';
        elements.suggestionsContainer.style.padding = '0';
        
        elements.suggestionsList.style.position = 'relative';
        elements.suggestionsList.style.left = '0';
        elements.suggestionsList.style.transform = 'none';
        elements.suggestionsList.style.width = '100%';
        elements.suggestionsList.style.maxWidth = '100%';
        elements.suggestionsList.style.margin = '0';
        
        elements.suggestionsContainer.classList.add('visible');
    }

    /**
     * 검색창 클릭 이벤트 처리
     */
    function handleSearchInputClick(e) {
        if (elements.searchInput && elements.searchInput.value.trim()) {
            handleSearchInput();
            e.stopPropagation();
        }
    }
    
    function handleDocumentClick(event) {
        if (elements.searchInput && elements.suggestionsList &&
            !elements.searchInput.contains(event.target) &&
            !elements.suggestionsList.contains(event.target)) {
            clearSuggestions();
        }
    }

    /**
     * 분양 메달 검색 결과 필터링
     * @param {Array} results - 검색 결과 배열
     * @param {string} searchTerm - 필터링 검색어 (null이면 필터링 없이 종족명만 추가)
     * @returns {Array} 필터링된 결과
     */
    function filterPetMedalResults(results, searchTerm) {
        if (!results || !Array.isArray(results)) {
            return [];
        }
        
        // 모든 분양 메달 아이템에 종족명 추가
        const processedResults = results.map(item => {
            const newItem = {...item};
            
            // 분양 메달 카테고리 확인
            if (newItem.auction_item_category === '분양 메달') {
                // 기본 이름으로 초기화 (API 응답 기준)
                newItem.item_display_name = newItem.item_name;
                
                // 펫 정보 종족명 찾기
                const options = newItem.item_option || newItem.options;
                if (options && Array.isArray(options)) {
                    const petRaceOption = options.find(option => 
                        option.option_type === '펫 정보' && 
                        option.option_sub_type === '종족명'
                    );
                    
                    // 종족명 추가
                    if (petRaceOption && petRaceOption.option_value) {
                        newItem.item_display_name = `${newItem.item_display_name} - ${petRaceOption.option_value}`;
                    }
                }
            }
            return newItem;
        });
        
        // searchTerm이 있는 경우에만 필터링 적용
        if (searchTerm) {
            // 정확히 일치하는 항목만 반환
            return processedResults.filter(item => 
                item.item_display_name === searchTerm
            );
        }
        
        // 아니면 종족명만 추가된 전체 결과 반환
        return processedResults;
    }
    
    /**
     * 카테고리 선택 처리 함수
     * @param {Object} categoryItem - 선택된 카테고리 항목
     */
    function handleCategorySelect(categoryItem) {
        // 표시할 이름 설정
        const displayName = `카테고리: ${categoryItem.name}`;
        
        // 검색창 업데이트
        if (elements.searchInput) {
            elements.searchInput.value = displayName;
        }
        
        // 검색 상태 업데이트
        state.searchTerm = displayName; // 수정: categoryItem.name → displayName
        state.selectedItem = categoryItem;
        
        // 이벤트 발생
        const event = new CustomEvent('search', {
            detail: {
                searchTerm: displayName, // 수정: categoryItem.name → displayName
                selectedItem: categoryItem,
                categorySearch: true,
                mainCategory: categoryItem.mainCategory,
                subCategory: categoryItem.subCategory
            }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 카테고리 정보 가져오기
     * @returns {Promise<Object>} 카테고리 정보
     */
    async function getCategoryInfo() {
        return new Promise((resolve, reject) => {
            try {
                // getSelectedCategories 메서드 존재 확인
                if (!CategoryManager.getSelectedCategories || 
                    typeof CategoryManager.getSelectedCategories !== 'function') {
                    reject(new Error('CategoryManager.getSelectedCategories 메서드가 없습니다'));
                    return;
                }
                
                // 메서드 호출
                const categories = CategoryManager.getSelectedCategories();
                
                // 카테고리 데이터 확인
                if (!categories) {
                    reject(new Error('CategoryManager가 유효한 데이터를 반환하지 않았습니다'));
                    return;
                }
                
                if (!categories.subCategories || !Array.isArray(categories.subCategories) || categories.subCategories.length === 0) {
                    reject(new Error('카테고리 정보가 유효하지 않습니다'));
                    return;
                }
                
                // 유효한 카테고리 정보 반환
                resolve(categories);
            } catch (error) {
                reject(new Error(`카테고리 정보 가져오기 실패: ${error.message}`));
            }
        });
    }
    
    /**
     * 순수 아이템 배열에 카테고리 항목(동적 추출 + categories.json 정적 정보 병합)을 합쳐
     * 자동완성 전체 대상 배열을 만든다. 최초 로딩과 백그라운드 갱신이 공통으로 사용하며,
     * 이 함수를 거치지 않고 allItems를 직접 대입하면 카테고리 자동완성이 누락된다.
     * @param {Array} items - 서버에서 받은 순수 아이템 배열
     * @returns {Array} 아이템 + 카테고리가 합쳐진 배열
     */
    function buildSearchableItems(items) {
        // 1. 아이템 인덱스에서 모든 고유 카테고리 이름을 동적으로 추출
        const dynamicCategories = new Set(items.map(item => item.category).filter(Boolean));

        // 2. categories.json의 정적 카테고리 정보 로드
        let staticCategories = [];
        if (window.CategoryManager) {
            staticCategories = window.CategoryManager.getSelectedCategories().subCategories;
            staticCategories.forEach(cat => dynamicCategories.add(cat.name)); // 정적 목록도 포함 보장
        }

        // 3. 동적/정적 카테고리를 병합하여 최종 카테고리 목록 생성
        const staticCategoryMap = new Map(staticCategories.map(cat => [cat.name, cat]));
        const finalCategoryItems = Array.from(dynamicCategories).map(name => {
            const staticInfo = staticCategoryMap.get(name);
            return {
                name: name,
                mainCategory: staticInfo ? staticInfo.mainCategory : '', // 정보가 없으면 빈칸
                isCategory: true
            };
        });

        // 4. 아이템 목록과 최종 카테고리 목록을 합쳐서 전체 검색 대상 생성
        return [...items, ...finalCategoryItems];
    }

    /**
     * 서버로부터 전체 아이템 인덱스를 비동기적으로 가져옵니다. (최초 1회만 실행)
     */
    async function loadItemIndex() {
        const originalPlaceholder = elements.searchInput.placeholder;
        if (state.isIndexLoaded || state.isLoading) return;

        state.isLoading = true;
        elements.searchInput.placeholder = '로딩중...';
        try {
            console.log('[Search] 아이템 인덱스 초기 로딩 시작...');
            const { data, etag } = await apiClient.fetchItemIndex();

            if (data) {
                lastKnownETag = etag;
                state.isIndexLoaded = true;
                console.log(`[Search] 아이템 인덱스 로딩 완료: ${data.length}개, ETag: ${etag}`);
            }

            allItems = buildSearchableItems(data || []);
            console.log(`[Search] 최종 아이템/카테고리 목록: ${allItems.length}개`);

            // 인덱스 로딩 후, 현재 입력창에 값이 있으면 바로 검색 실행
            if (elements.searchInput.value.trim()) {
                handleSearchInput();
            }
        } catch (error) {
            console.error("아이템 인덱스를 가져오는 데 실패했습니다:", error);
            state.hasError = true;
            showSearchInputError('검색 데이터를 불러올 수 없습니다.');
        } finally {
            state.isLoading = false;
            elements.searchInput.placeholder = originalPlaceholder;
        }
    }

    /**
     * 백그라운드에서 아이템 인덱스 업데이트를 확인하고 적용합니다.
     */
    async function checkIndexForUpdates() {
        if (!state.isIndexLoaded) return; // 아직 초기 로드가 안됐으면 실행 안함

        console.log(`[Search] 백그라운드 업데이트 확인 시작... (ETag: ${lastKnownETag})`);
        try {
            const { data, etag, modified } = await apiClient.fetchItemIndex(lastKnownETag);

            if (modified && data) {
                console.log(`[Search] 새로운 아이템 인덱스 발견! 데이터 갱신. (New ETag: ${etag})`);
                allItems = buildSearchableItems(data);
                lastKnownETag = etag;
            } else {
                console.log('[Search] 아이템 인덱스 변경 없음. 갱신 건너뜀.');
            }
        } catch (error) {
            console.error('[Search] 백그라운드 업데이트 중 오류 발생:', error);
        }
    }

    /**
     * 검색어 입력 처리
     */
    async function handleSearchInput() {
        // 인덱스가 로드되지 않았다면 로딩을 시도하고, 로딩이 끝나면 이 함수가 다시 호출될 것입니다.
        if (!state.isIndexLoaded) {
            await loadItemIndex();
            return;
        }

        const searchTerm = elements.searchInput.value;

        // 검색어가 비어있으면 자동완성 닫기
        if (!searchTerm.trim()) {
            clearSuggestions();
            return;
        }
        
        updateSuggestions(searchTerm);
    }
    
    /**
     * 겹받침을 포함한 초성 문자열 처리
     * @param {string} chosungStr - 초성 문자열
     * @returns {string} 겹받침이 분해된 초성 문자열
     */
    
    function handleKeyDown(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (!state.isSuggestionVisible) {
                    if (elements.searchInput && elements.searchInput.value.trim()) {
                        state.showViaDownArrow = true;
                        handleSearchInput();
                    }
                } else {
                    const totalSuggestions = state.suggestions.length;
                    state.activeSuggestion = (state.activeSuggestion < totalSuggestions - 1) 
                        ? state.activeSuggestion + 1 
                        : totalSuggestions - 1;
                    updateActiveSuggestion();
                    scrollSuggestionIntoView();
                }
                break;
                
            case 'ArrowUp':
                if (state.isSuggestionVisible) {
                    e.preventDefault();
                    state.activeSuggestion = (state.activeSuggestion > 0) 
                        ? state.activeSuggestion - 1 
                        : 0;
                    updateActiveSuggestion();
                    scrollSuggestionIntoView();
                }
                break;
                
            case 'Enter':
                if (state.isSuggestionVisible && state.activeSuggestion >= 0 && state.activeSuggestion < state.suggestions.length) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelectSuggestion(state.suggestions[state.activeSuggestion], state.activeSuggestion);
                    return false;
                } else if (state.isSuggestionVisible) {
                    clearSuggestions();
                }
                break;
                
            case 'Escape':
                if (state.isSuggestionVisible) {
                    e.preventDefault();
                    clearSuggestions();
                }
                break;
        }
    }

    function updateActiveSuggestion() {
        const items = elements.suggestionsList.querySelectorAll('.suggestion-item');
        items.forEach((item, index) => {
            item.classList.toggle('active', index === state.activeSuggestion);
        });
    }

    function scrollSuggestionIntoView() {
        if (state.activeSuggestion < 0) return;
        const activeItem = elements.suggestionsList.querySelector(`.suggestion-item.active`);
        if (activeItem) {
            activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /**
     * 검색어 기반 자동완성 추천 생성
     * @param {string} searchTerm - 검색어
     * @returns {Array} 추천 목록
     */
    function updateSuggestions(searchTerm) {
        if (!searchTerm.trim() || allItems.length === 0) {
            clearSuggestions();
            return;
        }
        
        // generateSuggestions를 통해 지능형 검색 실행
        const suggestions = generateSuggestions(searchTerm.trim());

        if (suggestions.length > 0) {
            state.suggestions = suggestions;
            renderSuggestions();
        } else {
            clearSuggestions();
        }
    }
    
    function generateSuggestions(searchTerm) {
        // 이 함수는 이제 서버에서 처리되므로 클라이언트에서는 단순 필터링 또는 그대로 반환
        const normalizedTerm = searchTerm.toLowerCase();
        const noSpaceTerm = Utils.removeSpaces(normalizedTerm);
        if (!Array.isArray(allItems) || allItems.length === 0) {
            return [];
        }
        
        const matchedItems = [];
        
        // --- 기존의 지능형 한글 검색 로직을 여기에 적용 ---
        const isAllChosung = Utils.isAllChosung(noSpaceTerm);
        let termToProcess = noSpaceTerm;

        // 겹자음 초성이 포함된 경우, 이를 분해하여 처리
        const hasCompoundConsonant = [...termToProcess].some(char => Utils.COMPOUND_JONGSUNG_MAP[char]);

        if (hasCompoundConsonant) {
            termToProcess = [...termToProcess].map(char => {
                // 겹자음(종성) 맵에 해당 문자가 있으면 분해된 초성으로 변환
                return Utils.COMPOUND_JONGSUNG_MAP[char] ? Utils.COMPOUND_JONGSUNG_MAP[char].join('') : char;
            }).join('');
        }

        // isAllChosung을 분해된 검색어 기준으로 다시 판단하거나, 겹자음이 있었으면 초성 검색으로 간주
        if (isAllChosung || hasCompoundConsonant) {
            // 1. 초성만으로 이루어진 검색어 처리 (e.g., "ㅋㅌㅅ")
            handleChosungMultiSearch(termToProcess, matchedItems);
        } else if (noSpaceTerm.length === 1) { // 원본 검색어 기준
            // 2. 한 글자 검색 처리 (e.g., "ㅋ", "켈", "켍")
            handleSingleCharSearch(noSpaceTerm, matchedItems);
        } else {
            // 3. 두 글자 이상 검색 처리 (e.g., "켈티", "켈틱")
            handleMultiCharSearch(noSpaceTerm, matchedItems);
        }
        
        // 점수 기반으로 중복 제거 및 정렬
        const uniqueItems = new Map();
        matchedItems.forEach(entry => {
            if (!uniqueItems.has(entry.item.name) || uniqueItems.get(entry.item.name).score < entry.score) {
                uniqueItems.set(entry.item.name, entry);
            }
        });

        const sortedSuggestions = Array.from(uniqueItems.values())
            .sort((a, b) => {
                const aIsCategory = a.item.isCategory || false;
                const bIsCategory = b.item.isCategory || false;

                // 1. 카테고리 여부를 최우선으로 정렬 (카테고리가 위로)
                if (aIsCategory !== bIsCategory) {
                    return bIsCategory - aIsCategory; // true (1) - false (0) = 1 -> b가 앞으로
                }

                // 2. 카테고리 여부가 같으면 점수 높은 순으로 정렬
                if (b.score !== a.score) return b.score - a.score;

                // 3. 점수도 같으면 이름 길이순으로 정렬
                return (a.item.name || '').length - (b.item.name || '').length;
            })
            .slice(0, MAX_RESULTS)
            .map(entry => entry.item);

        return sortedSuggestions;
    }

    /**
     * 추천 목록 렌더링
     */
    function renderSuggestions() {
        if (!elements.suggestionsList) return;
        
        elements.suggestionsList.innerHTML = '';
        
        if (state.suggestions.length === 0) {
            elements.suggestionsContainer.classList.remove('visible');
            state.isSuggestionVisible = false;
            return;
        }
        
        elements.suggestionsList.classList.remove('hide');
        const fragment = document.createDocumentFragment();
        
        state.suggestions.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = `suggestion-item ${index === state.activeSuggestion ? 'active' : ''}`;
            
            let content = '';
            if (typeof item === 'object') {
                const mainCat = item.mainCategory || '';
                const subCat = item.isCategory ? item.name : (item.category || '');
                const categoryInfo = (mainCat || subCat) ? 
                    `<div class="suggestion-category">${mainCat}${mainCat && subCat ? ' > ' : ''}${subCat}</div>` : '';
                
                if (item.isCategory) {
                    content = `<div class="suggestion-name">카테고리: <span class="item-orange">${item.name}</span></div>${categoryInfo}`;
                } else {
                    content = `<div class="suggestion-name">${item.name || item.text || ''}</div>${categoryInfo}`;
                }
            } else {
                content = `<div class="suggestion-name">${item}</div>`;
            }
            
            li.innerHTML = content;
            li.addEventListener('click', () => handleSelectSuggestion(item, index));
            fragment.appendChild(li);
        });
        
        elements.suggestionsList.appendChild(fragment);
        elements.suggestionsContainer.classList.add('visible');
        state.isSuggestionVisible = true;
    
        if (state.showViaDownArrow) {
            state.activeSuggestion = 0;
            state.showViaDownArrow = false;
            updateActiveSuggestion();
        }
        
        setTimeout(() => {
            elements.suggestionsList.classList.add('show');
        }, 10);
        
        elements.suggestionsList.classList.toggle('scrollable', state.suggestions.length > 10);
        
        updateSuggestionsPosition();
    }
    
    /**
     * 분양 메달 특별 검색 처리
     * @param {string} searchTerm - 검색어
     * @param {Array} matchedItems - 결과 저장 배열
     */
    function handlePetMedalSearch(searchTerm, matchedItems) {
        // 분양 메달 카테고리 아이템만 필터링
        const petMedalItems = allItems.filter(item => 
            item.subCategory === '분양 메달'
        );
        
        // 검색어 정규화
        const normalizedTerm = searchTerm.toLowerCase();
        
        // 검색어로 분양 메달 아이템 검색
        for (const item of petMedalItems) {
            const itemName = item.name.toLowerCase();
            
            // 아이템 이름에 검색어가 포함된 경우 추가
            if (itemName.includes(normalizedTerm)) {
                const score = itemName.startsWith(normalizedTerm) ? 98 : 90;
                
                matchedItems.push({
                    item,
                    score,
                    itemName
                });
            }
        }
    }
    
    /**
     * 초성 전용 다중 글자 검색 처리
     * @param {string} chosungTerm - 초성 검색어
     * @param {Array} matchedItems - 결과 저장 배열
     */
    function handleChosungMultiSearch(chosungTerm, matchedItems) {
        for (const item of allItems) {
            if (!item.name) continue;
            
            const itemName = item.name.toLowerCase();
            const noSpaceItemName = Utils.removeSpaces(itemName);
            
            // 초성 캐시 확인 및 계산
            let itemChosung = chosungCache.get(noSpaceItemName);
            if (!itemChosung) {
                itemChosung = Utils.getChosung(noSpaceItemName);
                chosungCache.set(noSpaceItemName, itemChosung);
            }

            let score = 0;
            
            // 1. 완전 일치 - 초성이 정확히 일치 (가장 높은 점수)
            if (itemChosung === chosungTerm) {
                score = 100;
            }
            // 2. 시작 부분 일치 - 초성이 검색어로 시작 (높은 점수)
            else if (itemChosung.startsWith(chosungTerm)) {
                score = 95;
            }
            // 3. 포함 관계 - 초성에 검색어가 포함 (중간 점수)
            else if (itemChosung.includes(chosungTerm)) {
                score = 80;
            }
            // 4. 서브시퀀스 검색 - 초성이 순서대로 포함, 중간에 다른 문자가 있어도 됨
            else if (isSubsequence(chosungTerm, itemChosung)) {
                // 서브시퀀스 일치도에 따라 점수 계산
                const subsequenceScore = calculateSubsequenceScore(chosungTerm, itemChosung);
                score = Math.max(score, subsequenceScore);
            }
            // 5. 단어별 초성 매칭 (띄어쓰기 있는 경우)
            else if (itemName.includes(' ')) {
                const words = itemName.split(' ');
                const wordChosungs = words.map(word => Utils.getChosung(Utils.removeSpaces(word)));
                
                // 각 단어의 초성만 모아서 검색어와 비교
                const combinedWordInitials = wordChosungs.map(chosung => chosung.charAt(0)).join('');
                
                if (combinedWordInitials.includes(chosungTerm)) {
                    score = 60;
                }
                // 각 단어의 초성 전체를 검색어와 비교
                else {
                    for (const wordChosung of wordChosungs) {
                        if (wordChosung.includes(chosungTerm)) {
                            score = 55;
                            break;
                        }
                    }
                    
                    // 서브시퀀스 매칭 시도
                    if (score < MIN_SCORE) {
                        const allWordChosungs = wordChosungs.join('');
                        if (isSubsequence(chosungTerm, allWordChosungs)) {
                            score = 50;
                        }
                    }
                }
            }
            
            // 최소 점수 이상인 경우만 추가
            if (score >= MIN_SCORE) {
                matchedItems.push({
                    item,
                    score,
                    itemName
                });
            }
        }
    }
    
    /**
     * 문자열이 다른 문자열의 서브시퀀스인지 확인
     * @param {string} sub - 서브시퀀스 후보
     * @param {string} main - 메인 문자열
     * @returns {boolean} 서브시퀀스 여부
     */
    function isSubsequence(sub, main) {
        if (!sub || !main) return false;
        if (sub.length > main.length) return false;
        
        let j = 0;
        for (let i = 0; i < main.length && j < sub.length; i++) {
            if (sub[j] === main[i]) {
                j++;
            }
        }
        
        return j === sub.length;
    }
    
    /**
     * 서브시퀀스 매칭 점수 계산
     * @param {string} sub - 서브시퀀스 (검색어)
     * @param {string} main - 메인 문자열 (아이템 초성)
     * @returns {number} 매칭 점수
     */
    function calculateSubsequenceScore(sub, main) {
        if (!isSubsequence(sub, main)) return 0;
        
        // 기본 점수
        let score = 45;
        
        // 연속된 매칭 문자 찾기
        let maxConsecutive = 0;
        let currentConsecutive = 0;
        let j = 0;
        
        for (let i = 0; i < main.length && j < sub.length; i++) {
            if (main[i] === sub[j]) {
                currentConsecutive++;
                j++;
                maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
            } else {
                currentConsecutive = 0;
            }
        }
        
        // 연속 매칭 보너스
        score += Math.min(maxConsecutive * 3, 15);
        
        // 처음 위치에서 시작하는 경우 보너스
        if (main.startsWith(sub[0])) {
            score += 5;
        }
        
        // 문자 간 거리가 가까울수록 높은 점수
        const mainLength = main.length;
        const subLength = sub.length;
        const gapPenalty = Math.max(0, mainLength - subLength - 2);
        score -= Math.min(gapPenalty * 1.5, 15);
        
        return Math.max(MIN_SCORE, score);
    }
    
    /**
     * 단일 글자 검색 처리
     * @param {string} char - 검색 글자
     * @param {Array} matchedItems - 결과 저장 배열
     */
    function handleSingleCharSearch(char, matchedItems) {
        const charAnalysis = Utils.analyzeHangulChar(char);
        
        // 초성인 경우
        if (charAnalysis.type === 'chosung') {
            handleChosungSearch(char, matchedItems);
            return;
        }
        
        // 완성형 한글인 경우
        if (charAnalysis.type.includes('syllable')) {
            if (charAnalysis.type === 'syllable_no_jongsung') {
                handleSyllableNoJongsungSearch(char, charAnalysis, matchedItems);
                return;
            }
            
            if (charAnalysis.type === 'syllable_with_jongsung') {
                handleSyllableWithJongsungSearch(char, charAnalysis, matchedItems);
                return;
            }
            
            if (charAnalysis.type === 'syllable_compound_jongsung') {
                handleCompoundJongsungSearch(char, charAnalysis, matchedItems);
                return;
            }
        }
        
        // 기타 일반 문자 (영문, 숫자 등)
        handleBasicCharSearch(char, matchedItems);
    }
    
    /**
     * 초성 검색 처리 - 통합 버전 ('ㅋ')
     * @param {string} chosung - 초성 문자
     * @param {Array} matchedItems - 결과 저장 배열
     * @param {Array} [itemsToSearch] - 검색 대상 아이템 목록 (없으면 전체 데이터)
     */
    function handleChosungSearch(chosung, matchedItems, itemsToSearch) {
        const itemsArray = itemsToSearch || allItems;
        
        // 겹받침 확인 및 분해
        const processedChosung = chosung.split('').map(char => {
            // Utils에 있는 겹받침 맵을 사용
            if (Utils.COMPOUND_JONGSUNG_MAP[char]) {
                return Utils.COMPOUND_JONGSUNG_MAP[char].join('');
            }
            return char;
        }).join('');
        
        for (const item of itemsArray) {
            if (!item.name) continue;
            
            // 검색 대상 텍스트 결정 (카테고리/일반 아이템)
            const itemText = item.name;
            const itemLower = itemText.toLowerCase();
            const noSpaceItemText = Utils.removeSpaces(itemLower);
            
            // 초성 캐시 확인 및 계산
            let itemChosung = chosungCache.get(noSpaceItemText);
            
            if (!itemChosung) {
                itemChosung = Utils.getChosung(noSpaceItemText);
                chosungCache.set(noSpaceItemText, itemChosung);
            }
            
            let score = 0;
            
            // 초성으로 시작하는 경우 (높은 점수)
            if (itemChosung.startsWith(processedChosung)) {
                score = 95;
            } 
            // 초성이 포함된 경우 (중간 점수)
            else if (itemChosung.includes(processedChosung)) {
                score = 70;
            }
            // 겹받침이 분해되어 확장된 경우 (원래 입력은 ㄵ 이지만 처리 후 ㄴㅈ로 확장)
            else if (processedChosung.length > chosung.length && itemChosung.includes(processedChosung)) {
                score = 65;
            }
            
            // 카테고리인 경우 카테고리 보너스 점수 부여
            if (item.isCategory && score >= MIN_SCORE) {
                score += 5;
            }
            
            // 최소 점수 이상인 경우만 추가
            if (score >= MIN_SCORE) {
                matchedItems.push({
                    item,
                    score,
                    itemName: itemText
                });
            }
        }
    }
    
    /**
     * 받침 없는 완성형 한글 검색 처리 ('케') - 통합 버전
     * @param {string} char - 검색 글자
     * @param {Object} analysis - 글자 분석 결과
     * @param {Array} matchedItems - 결과 저장 배열
     */
    function handleSyllableNoJongsungSearch(char, analysis, matchedItems) {
        for (const item of allItems) {
            if (!item.name) continue;
            
            // 검색 대상 텍스트 결정 (카테고리/일반 아이템)
            const itemText = item.name;
            const itemLower = itemText.toLowerCase();
            const noSpaceItemText = Utils.removeSpaces(itemLower);
            let score = 0;
            
            // 1순위: 정확한 글자 일치 ("케" 검색 시 "케"가 포함된 단어)
            if (noSpaceItemText.includes(char)) {
                score = noSpaceItemText.startsWith(char) ? 95 : 75;
            }
            
            // 2순위: 같은 초성+중성이지만 받침이 있는 경우 ("케" 검색 시 "켁", "켄", "켈" 등 포함)
            if (score < 70) {
                for (let i = 0; i < noSpaceItemText.length; i++) {
                    const itemChar = noSpaceItemText[i];
                    const itemAnalysis = Utils.analyzeHangulChar(itemChar);
                    
                    if (itemAnalysis.type.includes('syllable') && 
                        itemAnalysis.chosung === analysis.chosung && 
                        itemAnalysis.jungsung === analysis.jungsung && 
                        itemAnalysis.jongsung) {
                        
                        score = i === 0 ? 68 : 65;
                        break;
                    }
                }
            }
            
            // 3순위: 겹모음 확인 (현재 중성이 기본 모음인 경우)
            if (score < 65 && Utils.getCompoundJungsung(analysis.jungsung).length > 0) {
                const possibleCompoundJungsung = Utils.getCompoundJungsung(analysis.jungsung);
                
                for (let i = 0; i < noSpaceItemText.length; i++) {
                    const itemChar = noSpaceItemText[i];
                    const itemCharAnalysis = Utils.analyzeHangulChar(itemChar);
                    
                    if (itemCharAnalysis.type.includes('syllable') && 
                        itemCharAnalysis.chosung === analysis.chosung && 
                        possibleCompoundJungsung.includes(itemCharAnalysis.jungsung)) {
                        
                        score = i === 0 ? 60 : 55;
                        break;
                    }
                }
            }
            
            // 카테고리인 경우 카테고리 보너스 점수 부여
            if (item.isCategory && score >= MIN_SCORE) {
                score += 5;
            }
            
            // 최소 점수 이상인 경우만 추가
            if (score >= MIN_SCORE) {
                matchedItems.push({
                    item,
                    score,
                    itemName: itemText
                });
            }
        }
    }
    
    /**
     * 받침 있는 완성형 한글 검색 처리 ('켈') - 통합 버전
     * @param {string} char - 검색 글자
     * @param {Object} analysis - 글자 분석 결과
     * @param {Array} matchedItems - 결과 저장 배열
     */
    function handleSyllableWithJongsungSearch(char, analysis, matchedItems) {
        for (const item of allItems) {
            if (!item.name) continue;
            
            // 검색 대상 텍스트 결정 (카테고리/일반 아이템)
            const itemText = item.name;
            const itemLower = itemText.toLowerCase();
            const noSpaceItemText = Utils.removeSpaces(itemLower);
            let score = 0;
            
            // 1순위: 정확한 글자 일치 ("켈" 검색 시 "켈"이 포함된 단어)
            if (noSpaceItemText.includes(char)) {
                // 아이템 이름 시작 부분이면 더 높은 점수
                if (noSpaceItemText.startsWith(char) || 
                    itemLower.includes(' ' + char)) {
                    score = 95;
                } else {
                    score = 75;
                }
            }
            
            // 2순위: "케+ㄹ" 패턴 검색 (띄어쓰기 허용)
            if (score < 70) {
                const baseChar = analysis.syllableWithoutJongsung;
                const jongsung = analysis.jongsung;
                
                // 띄어쓰기가 있는 원본 아이템 이름 사용
                let foundMatch = false;
                
                for (let i = 0; i < itemLower.length - 1; i++) {
                    // 기본 글자 일치 확인
                    if (itemLower[i] === baseChar) {
                        // 다음 글자 바로 확인
                        if (i + 1 < itemLower.length) {
                            const nextChar = itemLower[i + 1];
                            const nextCharChosung = Utils.getChosung(nextChar);
                            
                            if (nextCharChosung === jongsung) {
                                // 단어 시작 부분인 경우 더 높은 점수
                                if (i === 0 || itemLower[i-1] === ' ') {
                                    score = Math.max(score, 70);
                                } else {
                                    score = Math.max(score, 65);
                                }
                                foundMatch = true;
                            }
                        }
                        
                        // 띄어쓰기 이후의 글자 확인
                        const spaceAfterBasePos = itemLower.indexOf(' ', i);
                        if (spaceAfterBasePos !== -1 && spaceAfterBasePos + 1 < itemLower.length) {
                            const afterSpaceChar = itemLower[spaceAfterBasePos + 1];
                            const afterSpaceChosung = Utils.getChosung(afterSpaceChar);
                            
                            if (afterSpaceChosung === jongsung) {
                                // 단어 경계를 넘는 매칭은 점수 낮게
                                score = Math.max(score, 60);
                                foundMatch = true;
                            }
                        }
                    }
                }
            }
            
            // 카테고리인 경우 카테고리 보너스 점수 부여
            if (item.isCategory && score >= MIN_SCORE) {
                score += 5;
            }
            
            // 최소 점수 이상인 경우만 추가
            if (score >= MIN_SCORE) {
                matchedItems.push({
                    item,
                    score,
                    itemName: itemText
                });
            }
        }
    }
    
    /**
     * 겹받침 한글 검색 처리 ('켍') - 통합 버전
     * @param {string} char - 검색 글자
     * @param {Object} analysis - 글자 분석 결과
     * @param {Array} matchedItems - 결과 저장 배열
     */
    function handleCompoundJongsungSearch(char, analysis, matchedItems) {
        for (const item of allItems) {
            if (!item.name) continue;
            
            // 검색 대상 텍스트 결정 (카테고리/일반 아이템)
            const itemText = item.name;
            const itemLower = itemText.toLowerCase();
            const noSpaceItemText = Utils.removeSpaces(itemLower);
            let score = 0;
            
            // 1순위: 정확한 글자 일치 ("켍" 검색 시 "켍"이 포함된 단어)
            if (noSpaceItemText.includes(char)) {
                score = noSpaceItemText.startsWith(char) ? 95 : 75;
            }
            
            // 2순위: "켈+ㄱ" 패턴 검색 (첫번째 받침 + 두번째 받침 모양)
            if (score < 70) {
                const baseChar = analysis.syllableWithFirstJong;
                const secondJongsung = analysis.secondJongsung;
                
                for (let i = 0; i < noSpaceItemText.length - 1; i++) {
                    if (noSpaceItemText[i] === baseChar) {
                        const nextChar = noSpaceItemText[i + 1];
                        const nextCharChosung = Utils.getChosung(nextChar);
                        
                        if (nextCharChosung === secondJongsung) {
                            score = i === 0 ? 70 : 65;
                            break;
                        }
                    }
                }
            }
            
            // 카테고리인 경우 카테고리 보너스 점수 부여
            if (item.isCategory && score >= MIN_SCORE) {
                score += 5;
            }
            
            // 최소 점수 이상인 경우만 추가
            if (score >= MIN_SCORE) {
                matchedItems.push({
                    item,
                    score,
                    itemName: itemText
                });
            }
        }
    }
    
    /**
     * 일반 문자(영문/숫자 등) 검색 처리 - 통합 버전
     * @param {string} char - 검색 글자
     * @param {Array} matchedItems - 결과 저장 배열
     */
    function handleBasicCharSearch(char, matchedItems) {
        for (const item of allItems) {
            if (!item.name) continue;
            
            // 검색 대상 텍스트 결정 (카테고리/일반 아이템)
            const itemText = item.name;
            const itemLower = itemText.toLowerCase();
            const noSpaceItemText = Utils.removeSpaces(itemLower);
            let score = 0;
            
            // 글자가 포함된 경우 점수 부여
            if (noSpaceItemText.includes(char)) {
                score = noSpaceItemText.startsWith(char) ? 95 : 70;
            }
            
            // 카테고리인 경우 카테고리 보너스 점수 부여
            if (item.isCategory && score >= MIN_SCORE) {
                score += 5;
            }
            
            // 최소 점수 이상인 경우만 추가
            if (score >= MIN_SCORE) {
                matchedItems.push({
                    item,
                    score,
                    itemName: itemText
                });
            }
        }
    }
    
    /**
     * 다중 글자 검색 처리 (2글자 이상) - 통합 버전
     * @param {string} term - 검색어
     * @param {Array} matchedItems - 결과 저장 배열
     */
    function handleMultiCharSearch(term, matchedItems) {
        for (const item of allItems) {
            if (!item.name) continue;
            
            // 검색 대상 텍스트 결정 (카테고리/일반 아이템)
            const itemText = item.name;
            const itemLower = itemText.toLowerCase();
            const noSpaceItemText = Utils.removeSpaces(itemLower);
            let score = 0;
            
            // 1순위: 전체 검색어가 정확히 포함된 경우
            if (noSpaceItemText.includes(term)) {
                score = noSpaceItemText.startsWith(term) ? 98 : 90;
            }
            
            // 2순위: 연속되지 않은 글자 순차적 검색
            if (score < 60) {
                const sequentialMatchScore = checkSequentialMatch(term, itemLower);
                if (sequentialMatchScore > 0) {
                    score = Math.max(score, sequentialMatchScore);
                }
            }
            
            // 카테고리인 경우 카테고리 보너스 점수 부여
            if (item.isCategory && score >= MIN_SCORE) {
                score += 5;
            }
            
            // 최소 점수 이상인 경우만 추가
            if (score >= MIN_SCORE) {
                matchedItems.push({
                    item,
                    score,
                    itemName: itemText
                });
            }
        }
    }
    
    /**
     * 연속되지 않은 글자 순차적 검색 - 향상된 버전
     * @param {string} term - 검색어
     * @param {string} itemName - 아이템 이름
     * @returns {number} 매칭 점수
     */
    function checkSequentialMatch(term, itemName) {
      if (!term || !itemName) return 0;
      
      // 공백 제거된 아이템 이름
      const noSpaceItemName = Utils.removeSpaces(itemName);
      
      // 마지막 글자와 나머지 부분 분리
      const lastChar = term[term.length - 1];
      const prefix = term.slice(0, -1);
      const lastCharAnalysis = Utils.analyzeHangulChar(lastChar);
      
      // 1순위: 전체 검색어가 정확히 포함된 경우 (가장 높은 점수)
      if (noSpaceItemName.includes(term)) {
        return noSpaceItemName.startsWith(term) ? 98 : 90;
      }
      
      // 모든 글자 위치 정보를 저장할 배열
      const charPositions = [];
      
      // 접두사(마지막 글자 제외) 각 글자 위치 찾기
      for (let i = 0; i < prefix.length; i++) {
        const prefixChar = prefix[i];
        const positions = [];
        
        // 접두사 글자가 초성인 경우 - 해당 초성을 가진 글자 위치 찾기
        if (Utils.isAllChosung(prefixChar)) {
          for (let j = 0; j < noSpaceItemName.length; j++) {
            if (Utils.getChosung(noSpaceItemName[j]) === prefixChar) {
              positions.push(j);
            }
          }
        } 
        // 일반 글자인 경우 - 동일 글자 위치 찾기
        else {
          let pos = -1;
          while ((pos = noSpaceItemName.indexOf(prefixChar, pos + 1)) !== -1) {
            positions.push(pos);
          }
        }
        
        // 해당 글자가 하나도 발견되지 않으면 점수 0
        if (positions.length === 0) {
          return 0;
        }
        
        charPositions.push(positions);
      }
      
      // 마지막 글자 처리 (타입에 따라 다른 접근법)
      const lastCharPositions = [];
      
      // ------------- 마지막 글자 처리 (5가지 케이스) -------------
      
      // 케이스 1: 마지막 글자가 초성인 경우 (ㅋ)
      if (lastCharAnalysis.type === 'chosung') {
        for (let j = 0; j < noSpaceItemName.length; j++) {
          if (Utils.getChosung(noSpaceItemName[j]) === lastChar) {
            lastCharPositions.push({
              pos: j,
              type: 'chosung',
              weight: 1.0
            });
          }
        }
      }
      
      // 케이스 2: 받침 없는 완성형 한글 (케)
      else if (lastCharAnalysis.type === 'syllable_no_jongsung') {
        // 정확한 글자 일치 (높은 가중치)
        let pos = -1;
        while ((pos = noSpaceItemName.indexOf(lastChar, pos + 1)) !== -1) {
          lastCharPositions.push({
            pos: pos,
            type: 'exact',
            weight: 1.0
          });
        }
        
        // 같은 초성+중성이지만 받침이 있는 경우 (중간 가중치)
        for (let j = 0; j < noSpaceItemName.length; j++) {
          const itemChar = noSpaceItemName[j];
          const itemCharAnalysis = Utils.analyzeHangulChar(itemChar);
          
          if (itemCharAnalysis.type.includes('syllable') && 
              itemCharAnalysis.chosung === lastCharAnalysis.chosung && 
              itemCharAnalysis.jungsung === lastCharAnalysis.jungsung && 
              itemCharAnalysis.jongsung) {
            
            lastCharPositions.push({
              pos: j,
              type: 'partial_with_batchim',
              weight: 0.9
            });
          }
        }
        
        // 겹모음 확인 (낮은 가중치)
        if (Utils.getCompoundJungsung(lastCharAnalysis.jungsung).length > 0) {
          const possibleCompoundJungsung = Utils.getCompoundJungsung(lastCharAnalysis.jungsung);
          
          for (let j = 0; j < noSpaceItemName.length; j++) {
            const itemChar = noSpaceItemName[j];
            const itemCharAnalysis = Utils.analyzeHangulChar(itemChar);
            
            if (itemCharAnalysis.type.includes('syllable') && 
                itemCharAnalysis.chosung === lastCharAnalysis.chosung && 
                possibleCompoundJungsung.includes(itemCharAnalysis.jungsung)) {
              
              lastCharPositions.push({
                pos: j,
                type: 'compound_vowel',
                weight: 0.8
              });
            }
          }
        }
      }
      
      // 케이스 3: 받침 있는 완성형 한글 (켈)
      else if (lastCharAnalysis.type === 'syllable_with_jongsung') {
        // 정확한 글자 일치 (높은 가중치)
        let pos = -1;
        while ((pos = noSpaceItemName.indexOf(lastChar, pos + 1)) !== -1) {
          lastCharPositions.push({
            pos: pos,
            type: 'exact',
            weight: 1.0
          });
        }
        
        // "케+ㄹ" 패턴 검색 - 중요: 두 글자가 떨어져 있어도 됨
        const baseChar = lastCharAnalysis.syllableWithoutJongsung;
        const jongsung = lastCharAnalysis.jongsung;
        
        // 먼저 베이스 글자(받침 없는 형태) 찾기
        let basePos = -1;
        while ((basePos = itemName.indexOf(baseChar, basePos + 1)) !== -1) {
          // 이후 ㄹ(초성)이 있는지 찾기 (떨어져 있어도 됨)
          let found = false;
          
          // 바로 다음 글자 확인
          if (basePos + 1 < itemName.length) {
            const nextChar = itemName[basePos + 1];
            const nextCharChosung = Utils.getChosung(nextChar);
            
            if (nextCharChosung === jongsung) {
              lastCharPositions.push({
                pos: basePos,
                type: 'split_adjacent',
                weight: 0.9
              });
              found = true;
            }
          }
          
          // 떨어진 글자들도 확인 (예: "케트로" - "켈")
          if (!found) {
            for (let afterPos = basePos + 1; afterPos < itemName.length; afterPos++) {
              const afterChar = itemName[afterPos];
              const afterChosung = Utils.getChosung(afterChar);
              
              if (afterChosung === jongsung) {
                lastCharPositions.push({
                  pos: basePos,
                  type: 'split_distant',
                  weight: 0.8
                });
                break;
              }
            }
          }
        }
      }
      
      // 케이스 4: 겹받침 한글 (켍)
      else if (lastCharAnalysis.type === 'syllable_compound_jongsung') {
        // 정확한 글자 일치
        let pos = -1;
        while ((pos = noSpaceItemName.indexOf(lastChar, pos + 1)) !== -1) {
          lastCharPositions.push({
            pos: pos,
            type: 'exact',
            weight: 1.0
          });
        }
        
        // "켈+ㅅ" 패턴 검색 (첫번째 받침 + 두번째 받침 모양)
        const baseChar = lastCharAnalysis.syllableWithFirstJong;
        const secondJongsung = lastCharAnalysis.secondJongsung;
        
        // 베이스 글자 위치 찾기
        let basePos = -1;
        while ((basePos = noSpaceItemName.indexOf(baseChar, basePos + 1)) !== -1) {
          // 이후 두번째 받침이 초성인 글자 찾기 (떨어져 있어도 됨)
          let found = false;
          
          // 바로 다음 글자 확인
          if (basePos + 1 < noSpaceItemName.length) {
            const nextChar = noSpaceItemName[basePos + 1];
            const nextCharChosung = Utils.getChosung(nextChar);
            
            if (nextCharChosung === secondJongsung) {
              lastCharPositions.push({
                pos: basePos,
                type: 'compound_split_adjacent',
                weight: 0.9
              });
              found = true;
            }
          }
          
          // 떨어진 글자들도 확인
          if (!found) {
            for (let afterPos = basePos + 1; afterPos < noSpaceItemName.length; afterPos++) {
              const afterChar = noSpaceItemName[afterPos];
              const afterChosung = Utils.getChosung(afterChar);
              
              if (afterChosung === secondJongsung) {
                lastCharPositions.push({
                  pos: basePos,
                  type: 'compound_split_distant',
                  weight: 0.8
                });
                break;
              }
            }
          }
        }
      }
      
      // 케이스 5: 일반 문자 (영문, 숫자 등)
      else {
        let pos = -1;
        while ((pos = noSpaceItemName.indexOf(lastChar, pos + 1)) !== -1) {
          lastCharPositions.push({
            pos: pos,
            type: 'regular',
            weight: 1.0
          });
        }
      }
      
      // 마지막 글자가 하나도 발견되지 않으면 점수 0
      if (lastCharPositions.length === 0) {
        return 0;
      }
      
      // 마지막 글자를 찾지 못했다면, 순차적 매칭은 불가능하므로 즉시 실패 처리합니다.
      if (lastCharPositions.length === 0) {
        return 0;
      }

      // 위치 정보만 추출하여 배열에 추가
      const lastPosArray = lastCharPositions.map(item => item.pos);
      charPositions.push(lastPosArray);
      
      // 가능한 모든 경로 탐색 (순차적이지만 연속적일 필요는 없음)
      if (hasValidSequence(charPositions)) {
        let matchBonus = 0;
        
        // 가장 높은 가중치 찾기
        const highestWeight = Math.max(...lastCharPositions.map(p => p.weight));
        matchBonus += highestWeight * 10;
        
        // 첫 글자가 아이템 시작 부분에 있는지 확인 (추가 보너스)
        if (charPositions[0].includes(0)) {
          matchBonus += 5;
        }
        
        // 최종 점수 계산
        return Math.min(85, 65 + matchBonus);
      }
      
      return 0;
    }
    
    /**
     * 순차적인 경로 탐색 개선 (순서는 맞지만 연속적일 필요는 없음)
     * @param {Array} positionsArray - 각 글자별 위치 배열
     * @returns {boolean} 유효한 경로 존재 여부
     */
    function hasValidSequence(positionsArray) {
        if (!positionsArray || positionsArray.length === 0) return false;

        // 재귀적으로 경로를 찾는 헬퍼 함수
        function findPath(level, lastPosition) {
            // 마지막 레벨(검색어 끝)까지 도달했다면 유효한 경로가 존재함
            if (level === positionsArray.length) {
                return true;
            }

            const currentPositions = positionsArray[level];

            for (const currentPosition of currentPositions) {
                if (currentPosition > lastPosition) {
                    // 다음 레벨에서 유효한 경로를 하나라도 찾으면 즉시 true 반환하고 모든 탐색 중단
                    if (findPath(level + 1, currentPosition)) {
                        return true;
                    }
                }
            }

            return false;
        }

        // 0번째 글자부터 탐색 시작 (이전 위치는 -1로 설정하여 항상 통과)
        return findPath(0, -1);
    }
    
    /**
     * 한글 자모 유사도 계산
     * @param {string} search - 검색어
     * @param {string} target - 대상 문자열
     * @returns {number} 유사도 점수 (0-100)
     */
    function calculateHangulSimilarity(search, target) {
        if (!search || !target) return 0;
        
        // 띄어쓰기 제거
        const noSpaceSearch = Utils.removeSpaces(search);
        const noSpaceTarget = Utils.removeSpaces(target);
        
        // 1. 초성 비교
        const searchChosung = Utils.getChosung(noSpaceSearch);
        const targetChosung = Utils.getChosung(noSpaceTarget);
        
        // 초성이 포함되는지 확인
        let score = 0;
        
        // 초성으로 시작하는 경우 (높은 점수)
        if (targetChosung.startsWith(searchChosung)) {
            score = 60 + Math.min(searchChosung.length * 2, 10);
        } 
        // 초성이 단어 경계에서 일치하는 경우
        else if (target.includes(' ') && target.split(' ').some(word => 
            Utils.getChosung(word).startsWith(searchChosung))) {
            score = 55;
        }
        // 초성이 포함되는 경우 (낮은 점수)
        else if (targetChosung.includes(searchChosung) && searchChosung.length >= 2) {
            score = 50;
        }
        
        // 2. 유사 낱자 매칭
        if (score < 60 && noSpaceSearch.length >= 2 && noSpaceTarget.startsWith(noSpaceSearch.substring(0, 2))) {
            // 앞 2글자가 일치하고 나머지 부분의 초성 또는 자모가 유사한 경우
            const searchLen = Math.min(noSpaceSearch.length, noSpaceTarget.length);
            let matchCount = 0;
            
            for (let i = 0; i < searchLen; i++) {
                if (noSpaceSearch[i] === noSpaceTarget[i]) {
                    matchCount++;
                } else if (i > 0 && Utils.getChosung(noSpaceSearch[i]) === Utils.getChosung(noSpaceTarget[i])) {
                    matchCount += 0.5;
                }
            }
            
            const matchRatio = matchCount / searchLen;
            if (matchRatio > 0.7) {
                // 일치율에 따라 60-70점 부여
                const similarityScore = 60 + (matchRatio * 10);
                score = Math.max(score, similarityScore);
            }
        }
        
        return score;
    }
    
    /**
     * 자동완성 선택 처리 (마우스 클릭용)
     * @param {Object} item - 선택한 아이템
     * @param {number} index - 선택한 인덱스
     */
    function handleSelectSuggestion(item, index) {
        // 선택된 아이템을 검색창에 설정
        elements.searchInput.value = item.name;
        state.searchTerm = item.name;
        state.selectedItem = item;
        
        // 카테고리 아이템인 경우 특별 처리
        if (item.isCategory) {
            handleCategorySelect(item);
            state.isCategorySearch = true;
            return;
        }
        state.isCategorySearch = false; // 일반 아이템 검색

        // 분양 메달 여부 확인
        const isPetMedalItem = isPetMedalCategory(item.category);
        
        // 분양 메달 관련 상태 설정
        if (isPetMedalItem) {
            state.isPetMedalSearchActive = true;
            state.petMedalSearchTerm = elements.searchInput ? elements.searchInput.value : '';
        } else {
            state.isPetMedalSearchActive = false;
            state.petMedalSearchTerm = '';
        }
        
        // 자동완성 닫기
        clearSuggestions();

        // 자동완성 선택 이벤트 발생 - 특별 카테고리 플래그 제거
        const autocompleteEvent = new CustomEvent('autocompleteSelected', {
            detail: {
                searchTerm: state.searchTerm,
                selectedItem: item,
                category: item.category,
                mainCategory: item.mainCategory
            }
        });
        document.dispatchEvent(autocompleteEvent);
        
        // 검색 이벤트 즉시 발생
        const searchEvent = new CustomEvent('search', {
            detail: {
                searchTerm: item.name,
                selectedItem: item,
                mainCategory: item.mainCategory,
                subCategory: item.category,
                isPetMedalSearch: state.isPetMedalSearchActive,
                petMedalSearchTerm: state.petMedalSearchTerm
            }
        });
        document.dispatchEvent(searchEvent);
    }
    
    /**
     * 활성화된 자동완성 아이템 가져오기
     * @returns {Object|null} 활성화된 아이템 정보
     */
    function getActiveItem() {
        if (state.isSuggestionVisible && state.activeSuggestion >= 0 && state.activeSuggestion < state.suggestions.length) {
            return {
                item: state.suggestions[state.activeSuggestion],
                index: state.activeSuggestion
            };
        }
        return null;
    }

    /**
     * 검색 실행
     */
    function handleSearch() {
        // 로딩 또는 오류 상태면 무시
        if (state.isLoading || state.hasError) return;
        
        try {
            // 입력 필드에서 최신 검색어 가져오기
            if (elements.searchInput) {
                state.searchTerm = elements.searchInput.value.trim();
                
                // 분양 메달 모드인 경우 필터링 검색어 업데이트
                if (state.isPetMedalSearchActive) {
                    state.petMedalSearchTerm = state.searchTerm;
                }
            }
            
            // 자동완성이 활성화되어 있고 선택된 항목이 있는지 확인
            if (state.isSuggestionVisible && state.activeSuggestion >= 0) {
                // 선택된 자동완성 항목으로 검색
                const activeItem = state.suggestions[state.activeSuggestion];
                handleSelectSuggestion(activeItem.item, activeItem.index);
                return;
            }
            
            // 이전 자동완성 선택된 아이템 확인
            // 검색어와 선택된 아이템 이름이 다른 경우에만 초기화
            if (state.selectedItem && state.selectedItem.name !== state.searchTerm) {
                state.selectedItem = null;
            }
            
            // 검색어가 없는 경우
            if (!state.searchTerm) {
                return;
            }
            
            // 검색 이벤트 발생
            const event = new CustomEvent('search', {
                detail: {
                    searchTerm: state.searchTerm,
                    selectedItem: state.selectedItem,
                    isPetMedalSearch: state.isPetMedalSearchActive,
                    petMedalSearchTerm: state.petMedalSearchTerm,
                    categorySearch: state.isCategorySearch
                }
            });
            
            document.dispatchEvent(event);
        } catch (error) {
            console.error('검색 처리 중 오류:', error);
            alert('검색을 처리할 수 없습니다.');
        }
    }
    
    /**
     * 검색 초기화
     */
    function resetSearch() {
        // 검색어 초기화
        if (elements.searchInput) {
            elements.searchInput.value = '';
        }
        
        state.searchTerm = '';
        state.selectedItem = null;
        
        // 이벤트 발생
        const event = new CustomEvent('searchReset');
        document.dispatchEvent(event);
    }
    
    /**
     * 현재 검색어 가져오기
     * @returns {Object} 검색 상태
     */
    function getSearchState() {
        return {
            searchTerm: state.searchTerm,
            selectedItem: state.selectedItem,
            isLoading: state.isLoading,
            hasError: state.hasError,
            isSuggestionVisible: state.isSuggestionVisible,
            isPetMedalSearchActive: state.isPetMedalSearchActive,
            petMedalSearchTerm: state.petMedalSearchTerm,
            isCategorySearch: state.isCategorySearch
        };
    }
    
    /**
     * 검색어 설정하기
     * @param {string} term - 검색어
     */
    function setSearchTerm(term) {
        if (elements.searchInput && !state.isLoading && !state.hasError) {
            elements.searchInput.value = term;
            state.searchTerm = term;
            
            // 분양 메달 모드인 경우 필터링 검색어도 업데이트
            if (state.isPetMedalSearchActive) {
                state.petMedalSearchTerm = term;
            }
        }
    }
    
    /**
     * 자동완성 목록 비우기
     */
    function clearSuggestions() {
        if (!elements.suggestionsList || !state.isSuggestionVisible) return;

        elements.suggestionsList.classList.add('hide');
        elements.suggestionsList.classList.remove('show');
        
        state.isSuggestionVisible = false;
        elements.suggestionsContainer.classList.remove('visible');
        
        setTimeout(() => {
            elements.suggestionsList.innerHTML = '';
            state.suggestions = [];
            state.activeSuggestion = -1;
            elements.suggestionsList.classList.remove('hide');
        }, 300);
    }
    
    /**
     * 검색 입력창에 오류 표시
     * @param {string} message - 오류 메시지
     */
    function showSearchInputError(message) {
        if (!elements.searchInput) return;
        
        elements.searchInput.placeholder = message;
        elements.searchInput.classList.add('search-error');

        // 검색 버튼 비활성화
        if (elements.searchButton) {
            elements.searchButton.setAttribute('disabled', 'true');
        }
        
        state.isLoading = false;
        state.hasError = true;
    }
    
    /**
     * 키워드 검색 카테고리 여부 확인
     * @param {string} category - 카테고리명
     * @returns {boolean} 키워드 검색 카테고리 여부
     */
    function isSpecialKeywordCategory(category) {
        if (!category) return false;
        return SPECIAL_CATEGORIES.KEYWORD_SEARCH.includes(category);
    }
    
    /**
     * 분양 메달 카테고리 여부 확인
     * @param {string} category - 카테고리명
     * @returns {boolean} 분양 메달 카테고리 여부
     */
    function isPetMedalCategory(category) {
        if (!category) return false;
        return category === SPECIAL_CATEGORIES.PET_MEDAL;
    }
    
    // 공개 API
    return {
        init,
        handleSearch,
        handleSearchInput,
        resetSearch,
        getSearchState,
        setSearchTerm,
        clearSuggestions,
        filterPetMedalResults,
        loadItemIndex, // 외부에서 호출할 수 있도록 노출
        isSpecialKeywordCategory,
        isPetMedalCategory,
        getActiveItem
    };
})();

export default search;
