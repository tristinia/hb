/**
 * search 서비스
 * 경매장 특화 검색 기능 및 자동완성 처리
 */

import Utils from './utils.js';
import apiClient from './api-client.js'; // apiClient 사용
import hangulMatch from './hangul-match.js';
import metadataService from './metadata.js';

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
        // 0. 서버 응답에 null/undefined나 이름이 없는 손상된 항목이 섞여 있을 수 있으므로 제거
        const validItems = Array.isArray(items) ? items.filter(item => item && item.name) : [];

        // 1. 아이템 인덱스에서 모든 고유 카테고리 이름을 동적으로 추출
        const dynamicCategories = new Set(validItems.map(item => item.category).filter(Boolean));

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
        return [...validItems, ...finalCategoryItems];
    }

    /**
     * 아이템 인덱스 로드
     */
    async function loadItemIndex() {
        const originalPlaceholder = elements.searchInput.placeholder;
        if (state.isIndexLoaded || state.isLoading) return;

        state.isLoading = true;
        elements.searchInput.placeholder = '로딩중...';

        // 메타데이터도 같은 시점에 로드
        metadataService.loadAll();

        try {
            console.log('[Search] 아이템 인덱스 초기 로딩 시작...');
            const { data, etag } = await apiClient.fetchItemIndex();

            // buildSearchableItems가 실패하면(손상된 응답 등) isIndexLoaded를 true로 만들지 않아,
            // 다음 포커스 때 재시도할 수 있도록 성공 이후에만 상태를 갱신한다.
            allItems = buildSearchableItems(data || []);
            console.log(`[Search] 최종 아이템/카테고리 목록: ${allItems.length}개`);

            if (data) {
                lastKnownETag = etag;
                state.isIndexLoaded = true;
                console.log(`[Search] 아이템 인덱스 로딩 완료: ${data.length}개, ETag: ${etag}`);
            }

            // 인덱스 로딩 후, 현재 입력창에 값이 있으면 바로 검색 실행
            if (elements.searchInput.value.trim()) {
                handleSearchInput();
            }
        } catch (error) {
            // 인덱스 로딩 실패는 자동완성만 일시적으로 못 쓰는 상황이므로, 검색 버튼 자체를
            // 영구적으로 잠그지 않는다 (isIndexLoaded가 false로 남아 다음 포커스 때 재시도됨).
            console.error("아이템 인덱스를 가져오는 데 실패했습니다:", error);
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
        if (!Array.isArray(allItems) || allItems.length === 0) {
            return [];
        }

        // 초성 및 자모 매칭 로직 호출
        const matchedItems = hangulMatch.match(searchTerm, allItems, { getText: item => item.name });

        // 카테고리 가중치 계산
        matchedItems.forEach(entry => {
            if (entry.item.isCategory && entry.score >= hangulMatch.MIN_SCORE) {
                entry.score += 5;
            }
        });

        // 점수 기반 중복 제거와 정렬 (동명 카테고리와 아이템 구분 위해 카테고리 여부 포함)
        const ranked = hangulMatch.rank(matchedItems, {
            key: entry => `${entry.item.name}::${!!entry.item.isCategory}`,
            comparator: (a, b) => {
                const aIsCategory = a.item.isCategory || false;
                const bIsCategory = b.item.isCategory || false;

                // 카테고리 여부를 최우선으로 정렬 (카테고리가 위로)
                if (aIsCategory !== bIsCategory) {
                    return bIsCategory - aIsCategory; // true는 1 false는 0이라 뺄셈 결과가 양수면 b가 앞으로 이동
                }

                // 카테고리 여부가 같으면 점수 높은 순으로 정렬
                if (b.score !== a.score) return b.score - a.score;

                // 점수도 같으면 이름 길이순으로 정렬
                return (a.item.name || '').length - (b.item.name || '').length;
            }
        });

        return ranked.slice(0, MAX_RESULTS).map(entry => entry.item);
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
            // 카테고리 선택 시 입력창/searchTerm에는 "카테고리: 이름" 표시용 라벨이 들어가므로,
            // 그 라벨과 일치하는 경우까지 다른 선택으로 오인해 초기화하지 않는다.
            const matchesCategoryLabel = state.selectedItem && state.selectedItem.isCategory &&
                state.searchTerm === `카테고리: ${state.selectedItem.name}`;
            if (state.selectedItem && state.selectedItem.name !== state.searchTerm && !matchesCategoryLabel) {
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
