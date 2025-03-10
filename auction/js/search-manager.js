/**
 * 검색 관리 모듈
 * 검색 입력, 자동완성 관리
 */

const SearchManager = (() => {
    // 검색 상태
    const state = {
        searchTerm: '',
        suggestions: [],
        activeSuggestion: -1,
        selectedItem: null,
        isSuggestionVisible: false,
        loadedCategories: new Set()  // 이미 로드한 카테고리 추적
    };
    
    // 자동완성 데이터
    const autocompleteData = [];
    
    // DOM 요소 참조
    let elements = {
        searchInput: null,
        searchButton: null,
        resetButton: null,
        suggestionsList: null
    };
    
    /**
     * 모듈 초기화
     */
    function init() {
        // DOM 요소 참조 가져오기
        elements.searchInput = document.getElementById('search-input');
        elements.searchButton = document.querySelector('.search-button');
        elements.resetButton = document.getElementById('reset-button');
        elements.suggestionsList = document.getElementById('suggestions');
        
        // 이벤트 리스너 설정
        setupEventListeners();
        
        // 자동완성 데이터 로드
        loadAutocompleteData();
    }
    
    /**
     * 이벤트 리스너 설정
     */
    function setupEventListeners() {
        if (elements.searchInput) {
            // 검색어 입력 이벤트
            elements.searchInput.addEventListener('input', Utils.debounce(handleSearchInput, 300));
            
            // 키보드 이벤트 (화살표, Enter 등)
            elements.searchInput.addEventListener('keydown', handleKeyDown);
        }
        
        if (elements.searchButton) {
            // 검색 버튼 클릭
            elements.searchButton.addEventListener('click', handleSearch);
        }
        
        if (elements.resetButton) {
            // 초기화 버튼 클릭
            elements.resetButton.addEventListener('click', resetSearch);
        }
        
        // 문서 클릭 이벤트 (외부 클릭 시 자동완성 닫기)
        document.addEventListener('click', handleDocumentClick);
    }
    
    /**
     * 여러 카테고리에서 자동완성 데이터 로드
     */
    async function loadAutocompleteData() {
        console.log('카테고리별 자동완성 데이터 로드 중...');
        
        try {
            // 로컬 스토리지에서 캐시된 데이터 확인
            const cachedData = localStorage.getItem('autocompleteDataWithCategories');
            const cachedTimestamp = localStorage.getItem('autocompleteDataTimestamp');
            
            // 캐시가 24시간 이내에 생성된 경우 사용
            const now = new Date().getTime();
            if (cachedData && cachedTimestamp && (now - parseInt(cachedTimestamp) < 24 * 60 * 60 * 1000)) {
                const parsedData = JSON.parse(cachedData);
                autocompleteData.push(...parsedData);
                console.log(`캐시에서 자동완성 데이터 로드 완료: ${autocompleteData.length}개 항목`);
                return;
            }
            
            // 1. 카테고리 정보 가져오기
            await waitForCategoryManager();
            const { subCategories } = CategoryManager.getSelectedCategories();
            
            if (!subCategories || subCategories.length === 0) {
                console.warn('카테고리 정보가 아직 로드되지 않았습니다.');
                // 백그라운드에서 나중에 다시 시도
                setTimeout(loadAutocompleteData, 1000);
                return;
            }
            
            // 2. 우선순위 카테고리 목록 (가장 많이 사용하는 카테고리 먼저)
            const priorityCategories = [
                '검', '한손 장비', '양손 장비', '갑옷', '경갑옷', '천옷', 
                '액세서리', '악기', '모자/가발', '장갑', '신발'
            ];
            
            // 우선순위가 높은 카테고리를 먼저 정렬
            const sortedCategories = [...subCategories].sort((a, b) => {
                const aIndex = priorityCategories.indexOf(a.id);
                const bIndex = priorityCategories.indexOf(b.id);
                
                if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;
                return 0;
            });
            
            // 3. 카테고리 파일 순차적 로드 (부하 분산을 위해)
            for (const category of sortedCategories) {
                await loadCategoryItems(category);
                
                // 처음 5개 카테고리를 로드한 후 사용자가 검색을 시작할 수 있게 약간의 지연
                if (autocompleteData.length > 0 && state.loadedCategories.size === 5) {
                    // 나머지 카테고리는 백그라운드에서 계속 로드
                    setTimeout(() => {
                        continueCategoryLoading(sortedCategories.slice(5));
                    }, 100);
                    break;
                }
            }
            
            // 4. 캐시 저장
            if (autocompleteData.length > 0) {
                try {
                    localStorage.setItem('autocompleteDataWithCategories', JSON.stringify(autocompleteData));
                    localStorage.setItem('autocompleteDataTimestamp', now.toString());
                } catch (error) {
                    console.warn('자동완성 데이터 캐싱 실패:', error);
                }
            }
            
            console.log(`자동완성 데이터 로드 완료: ${autocompleteData.length}개 항목`);
        } catch (error) {
            console.error('자동완성 데이터 로드 중 오류:', error);
        }
    }
    
    /**
     * CategoryManager가 초기화될 때까지 대기
     */
    function waitForCategoryManager() {
        return new Promise((resolve) => {
            const check = () => {
                const { subCategories } = CategoryManager.getSelectedCategories();
                if (subCategories && subCategories.length > 0) {
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
    
    /**
     * 나머지 카테고리 백그라운드 로드
     */
    async function continueCategoryLoading(remainingCategories) {
        for (const category of remainingCategories) {
            await loadCategoryItems(category);
        }
    }
    
    /**
 * 단일 카테고리 아이템 로드
 */
async function loadCategoryItems(category) {
    if (state.loadedCategories.has(category.id)) return;
    
    try {
        // 카테고리 ID 안전하게 변환 (여기에 추가)
        const safeCategoryId = sanitizeFileName(category.id);
        
        // 카테고리 파일 경로 (여러 가능성 시도)
        const paths = [
            `../data/items/${safeCategoryId}.json`,
            `/data/items/${safeCategoryId}.json`,
            `data/items/${safeCategoryId}.json`
        ];
        
        let response = null;
        let validPath = null;
        
        // 유효한 경로 찾기
        for (const path of paths) {
            try {
                const resp = await fetch(path);
                if (resp.ok) {
                    response = resp;
                    validPath = path;
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!response || !validPath) {
            console.warn(`카테고리 ${category.id} 파일을 찾을 수 없습니다.`);
            return;
        }
        
        const data = await response.json();
        const items = data.items || [];
        
        // 각 아이템에 카테고리 정보 추가
        items.forEach(item => {
            if (item.name) {
                autocompleteData.push({
                    name: item.name,
                    price: item.price,
                    date: item.date,
                    mainCategory: category.mainCategory,
                    subCategory: category.id
                });
            }
        });
        
        // 로드 완료 표시
        state.loadedCategories.add(category.id);
        console.log(`카테고리 ${category.id} 로드 완료: ${items.length}개 아이템`);
    } catch (error) {
        console.warn(`카테고리 ${category.id} 로드 중 오류:`, error);
    }
}

/**
 * 파일명으로 사용할 수 없는 특수문자 처리
 * @param {string} id 원본 ID
 * @return {string} 파일명으로 사용 가능한 ID
 */
function sanitizeFileName(id) {
    // 파일 시스템에서 문제가 될 수 있는 특수 문자들을 대체
    return id.replace(/[\/\\:*?"<>|]/g, '_');
}
    
    /**
     * 검색어 입력 처리
     */
    function handleSearchInput() {
        state.searchTerm = elements.searchInput.value.trim();
        
        if (state.searchTerm === '') {
            clearSuggestions();
            return;
        }
        
        // 자동완성 추천 생성
        const suggestions = getSuggestions(state.searchTerm);
        
        if (suggestions.length > 0) {
            state.suggestions = suggestions;
            renderSuggestions();
        } else {
            clearSuggestions();
        }
    }
    
    /**
     * 검색어 기반 자동완성 추천 생성
     * @param {string} searchTerm - 검색어
     * @returns {Array} 추천 목록
     */
    function getSuggestions(searchTerm) {
        if (!searchTerm) return [];
        
        const normalizedTerm = searchTerm.toLowerCase();
        
        // 초성 검색 활성화 여부 확인 (입력값이 전부 초성인 경우에만)
        const isChosungOnly = isAllChosung(normalizedTerm);
        const chosungTerm = isChosungOnly ? normalizedTerm : '';
        
        // 영->한 오타 수정 시도 (최소 길이 조건 추가)
        const koreanFromEng = normalizedTerm.length >= 2 ? Utils.engToKor(normalizedTerm) : '';
        
        // 데이터가 없으면 빈 배열 반환
        if (!Array.isArray(autocompleteData) || autocompleteData.length === 0) {
            return [];
        }
        
        // 점수 계산 및 필터링
        const scoredItems = autocompleteData
            .map(item => ({
                item,
                score: calculateScore(item, normalizedTerm, chosungTerm, koreanFromEng, isChosungOnly)
            }))
            .filter(entry => entry.score > 0) // 점수가 0 이상인 항목만 포함
            .sort((a, b) => b.score - a.score) // 높은 점수순으로 정렬
            .slice(0, 10) // 최대 10개만 표시
            .map(entry => entry.item);
        
        return scoredItems;
    }
    
    /**
     * 검색 정확도 점수 계산 함수 - 개선된 버전
     */
    function calculateScore(item, normalizedTerm, chosungTerm, koreanFromEng, isChosungOnly) {
        if (!item || !item.name) return 0;
        
        const itemName = item.name.toLowerCase();
        let score = 0;
        
        // 정확히 일치하면 최고 점수
        if (itemName === normalizedTerm) {
            score += 100;
            return score; // 정확히 일치하면 바로 최고 점수 반환
        }
        
        // 시작 부분이 일치하면 높은 점수 (prefix matching)
        if (itemName.startsWith(normalizedTerm)) {
            score += 80;
            
            // 길이가 비슷할수록 더 관련성이 높음
            const lengthDiff = Math.abs(itemName.length - normalizedTerm.length);
            if (lengthDiff <= 3) {
                score += 15;
            }
        }
        // 정확한 단어 포함 (공백으로 구분된 단어)
        else if (itemName.includes(` ${normalizedTerm} `) || 
                itemName.startsWith(`${normalizedTerm} `) || 
                itemName.endsWith(` ${normalizedTerm}`)) {
            score += 70;
        }
        // 단어 중간에 포함되면 중간 점수 (substring matching)
        else if (itemName.includes(normalizedTerm)) {
            score += 60;
            
            // 정확한 매칭에 더 높은 가중치 부여
            if (normalizedTerm.length > 2) {
                score += 10; // 정확한 부분 문자열 매칭에 보너스 점수
            }
        }
        
        // 초성 검색은 입력값이 전부 초성인 경우에만 적용
        if (isChosungOnly && chosungTerm.length >= 2) {
            const itemChosung = Utils.getChosung(itemName);
            
            // 초성이 일치하는 경우
            if (itemChosung.includes(chosungTerm)) {
                score += 60; // 초성 검색 점수 상향 (직접 검색한 경우니까)
            } else if (itemChosung.startsWith(chosungTerm)) {
                score += 50; // 시작 부분 초성 일치
            }
        }
        
        // 영한 변환 결과가 포함되면 중간 점수
        if (koreanFromEng && itemName.includes(koreanFromEng)) {
            score += 40; // 영한 변환 점수 상향 (자주 발생하는 실수이므로)
        }
        
        // 검색 결과 관련성이 특정 임계값 이하면 제외 (최소 점수 기준 추가)
        if (score < 20) {
            return 0;  // 점수가 너무 낮으면 자동완성 제안에서 제외
        }
        
        // 아이템 이름이 짧을수록 더 관련성이 높을 가능성이 있음
        score += Math.max(0, 15 - itemName.length);
        
        // 유사도 보너스 점수 (레벤슈타인 거리 기반)
        const similarity = Utils.similarityScore(normalizedTerm, itemName);
        score += similarity * 20;
        
        return score;
    }
    
    /**
     * 문자열이 모두 한글 초성인지 확인
     * @param {string} str - 확인할 문자열
     * @returns {boolean} 모두 초성인지 여부
     */
    function isAllChosung(str) {
        if (!str || str.length === 0) return false;
        
        // 한글 초성 목록
        const chosungList = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
        
        // 모든 문자가 초성인지 확인
        for (let i = 0; i < str.length; i++) {
            if (!chosungList.includes(str[i])) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 자동완성 렌더링
     */
    function renderSuggestions() {
        // 기존 추천 초기화
        elements.suggestionsList.innerHTML = '';
        
        // 추천 목록 표시
        state.suggestions.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = `suggestion-item ${index === state.activeSuggestion ? 'active' : ''}`;
            
            // 아이템 카테고리 정보 표시
            let categoryInfo = '';
            if (item.mainCategory || item.subCategory) {
                // 메인 카테고리 이름 찾기
                let mainCategoryName = item.mainCategory;
                const categories = CategoryManager.getSelectedCategories();
                const mainCategoryObj = categories.mainCategories?.find(cat => cat.id === item.mainCategory);
                if (mainCategoryObj) {
                    mainCategoryName = mainCategoryObj.name;
                }
                
                // 서브 카테고리 이름 찾기
                let subCategoryName = item.subCategory;
                const subCategoryObj = categories.subCategories?.find(cat => cat.id === item.subCategory);
                if (subCategoryObj) {
                    subCategoryName = subCategoryObj.name;
                }
                
                categoryInfo = `<div class="suggestion-category">${mainCategoryName}${subCategoryName ? ' > ' + subCategoryName : ''}</div>`;
            }
            
            li.innerHTML = `
                <div class="suggestion-name">${item.name}</div>
                ${categoryInfo}
            `;
            
            li.addEventListener('click', () => handleSelectSuggestion(item, index));
            
            elements.suggestionsList.appendChild(li);
        });
        
        // 목록 표시
        elements.suggestionsList.classList.add('show');
        state.isSuggestionVisible = true;
    }
    
    /**
     * 자동완성 선택 처리
     * @param {Object} item - 선택한 아이템
     * @param {number} index - 선택한 인덱스
     */
    function handleSelectSuggestion(item, index) {
        // 선택된 아이템을 검색창에 설정
        elements.searchInput.value = item.name;
        state.searchTerm = item.name;
        state.selectedItem = item;
        
        // 카테고리 자동 선택 (이제 아이템에 카테고리 정보가 있음)
        if (item.mainCategory && item.subCategory) {
            // 카테고리 UI 자동 선택을 위한 이벤트 발생
            const categoryEvent = new CustomEvent('categoryChanged', {
                detail: {
                    mainCategory: item.mainCategory,
                    subCategory: item.subCategory,
                    autoSelected: true
                }
            });
            document.dispatchEvent(categoryEvent);
        }
        
        // 자동완성 닫기
        clearSuggestions();
        
        // 선택된 아이템 정보를 이벤트로 알림
        const event = new CustomEvent('itemSelected', {
            detail: {
                item: state.selectedItem
            }
        });
        document.dispatchEvent(event);
        
        // 자동 검색 실행 제거 (사용자가 직접 검색 버튼 클릭)
        // handleSearch();
    }
    
    /**
     * 키보드 탐색 처리
     * @param {KeyboardEvent} e - 키보드 이벤트
     */
    function handleKeyDown(e) {
        // 자동완성 목록이 표시된 경우에만 처리
        if (!state.isSuggestionVisible) return;
        
        const totalSuggestions = state.suggestions.length;
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                state.activeSuggestion = (state.activeSuggestion < totalSuggestions - 1) 
                    ? state.activeSuggestion + 1 
                    : totalSuggestions - 1;
                updateActiveSuggestion();
                scrollSuggestionIntoView();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                state.activeSuggestion = (state.activeSuggestion > 0) 
                    ? state.activeSuggestion - 1 
                    : 0;
                updateActiveSuggestion();
                scrollSuggestionIntoView();
                break;
                
            case 'Enter':
                e.preventDefault();
                if (state.activeSuggestion >= 0 && state.activeSuggestion < totalSuggestions) {
                    handleSelectSuggestion(state.suggestions[state.activeSuggestion], state.activeSuggestion);
                } else {
                    handleSearch();
                }
                break;
                
            case 'Escape':
                clearSuggestions();
                break;
        }
    }
    
    /**
     * 선택된 자동완성 항목이 보이도록 스크롤
     */
    function scrollSuggestionIntoView() {
        if (state.activeSuggestion < 0) return;
        
        const activeItem = elements.suggestionsList.querySelector(`.suggestion-item.active`);
        if (activeItem) {
            // 부드러운 스크롤로 항목을 보이게 함
            activeItem.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }
    
    /**
     * 활성화된 자동완성 업데이트
     */
    function updateActiveSuggestion() {
        const items = elements.suggestionsList.querySelectorAll('.suggestion-item');
        
        items.forEach((item, index) => {
            item.classList.toggle('active', index === state.activeSuggestion);
        });
    }
    
    /**
     * 자동완성 목록 비우기
     */
    function clearSuggestions() {
        elements.suggestionsList.innerHTML = '';
        elements.suggestionsList.classList.remove('show');
        state.suggestions = [];
        state.activeSuggestion = -1;
        state.isSuggestionVisible = false;
    }
    
    /**
     * 검색 실행
     */
    function handleSearch() {
        // 검색어 또는 선택된 카테고리가 없는 경우 처리
        const { mainCategory, subCategory } = CategoryManager.getSelectedCategories();
        
        if (!state.searchTerm && !subCategory) {
            alert('검색어를 입력하거나 카테고리를 선택해주세요.');
            return;
        }
        
        // 검색 이벤트 발생
        const event = new CustomEvent('search', {
            detail: {
                searchTerm: state.searchTerm,
                selectedItem: state.selectedItem,
                mainCategory,
                subCategory
            }
        });
        
        document.dispatchEvent(event);
        
        // 자동완성 닫기
        clearSuggestions();
    }
    
    /**
     * 검색 초기화
     */
    function resetSearch() {
        // 검색어 초기화
        elements.searchInput.value = '';
        state.searchTerm = '';
        state.selectedItem = null;
        
        // 이벤트 발생
        const event = new CustomEvent('searchReset');
        document.dispatchEvent(event);
        
        // 자동완성 닫기
        clearSuggestions();
    }
    
    /**
     * 문서 클릭 이벤트 처리
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function handleDocumentClick(event) {
        // 자동완성 외부 클릭 시 닫기
        if (
            elements.searchInput && 
            elements.suggestionsList &&
            !elements.searchInput.contains(event.target) && 
            !elements.suggestionsList.contains(event.target)
        ) {
            clearSuggestions();
        }
    }
    
    /**
     * 현재 검색어 가져오기
     * @returns {Object} 검색 상태
     */
    function getSearchState() {
        return {
            searchTerm: state.searchTerm,
            selectedItem: state.selectedItem
        };
    }
    
    /**
     * 검색어 설정하기
     * @param {string} term - 검색어
     */
    function setSearchTerm(term) {
        if (elements.searchInput) {
            elements.searchInput.value = term;
            state.searchTerm = term;
        }
    }
    
    // 공개 API
    return {
        init,
        handleSearch,
        resetSearch,
        getSearchState,
        setSearchTerm,
        clearSuggestions
    };
})();
