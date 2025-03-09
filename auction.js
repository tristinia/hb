
// Firebase Functions URL 설정
const FIREBASE_FUNCTIONS = {
  SEARCH_KEYWORD: 'https://us-central1-mabinogi-auction-api.cloudfunctions.net/searchByKeyword',
  SEARCH_CATEGORY: 'https://us-central1-mabinogi-auction-api.cloudfunctions.net/searchByCategory'
};

// 기본 설정 및 상태 변수
const state = {
    searchTerm: '',
    suggestions: [],
    activeSuggestion: -1,
    selectedItem: null,
    selectedMainCategory: null,
    selectedSubCategory: null,
    expandedMainCategory: null,
    searchResults: [],
    advancedFilters: {},
    selectedFilters: {}, // 선택된 필터를 저장
    showDetailOptions: false,
    isLoading: false,
    categories: {
        mainCategories: [],
        subCategories: []
    },
    // 페이지네이션 관련 상태
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 1
};

// 한글 초성 검색을 위한 유틸리티
const HANGUL_START = 44032; // '가'의 유니코드
const HANGUL_END = 55203; // '힣'의 유니코드
const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const JUNGSUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JONGSUNG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

// 영한 오타 매핑
const engToKorMap = {
    'q': 'ㅂ', 'w': 'ㅈ', 'e': 'ㄷ', 'r': 'ㄱ', 't': 'ㅅ',
    'y': 'ㅛ', 'u': 'ㅕ', 'i': 'ㅑ', 'o': 'ㅐ', 'p': 'ㅔ',
    'a': 'ㅁ', 's': 'ㄴ', 'd': 'ㅇ', 'f': 'ㄹ', 'g': 'ㅎ',
    'h': 'ㅗ', 'j': 'ㅓ', 'k': 'ㅏ', 'l': 'ㅣ',
    'z': 'ㅋ', 'x': 'ㅌ', 'c': 'ㅊ', 'v': 'ㅍ', 'b': 'ㅠ',
    'n': 'ㅜ', 'm': 'ㅡ'
};

// DOM 참조 요소
const elements = {};

// 초기화 함수
async function init() {
    // DOM 요소 참조
    elements.searchInput = document.getElementById('search-input');
    elements.searchButton = document.querySelector('.search-button');
    elements.resetButton = document.getElementById('reset-button');
    elements.suggestionsList = document.getElementById('suggestions');
    elements.mainCategoriesList = document.getElementById('main-categories');
    elements.resultsBody = document.getElementById('results-body');
    elements.toggleOptionsButton = document.getElementById('toggle-options');
    elements.detailOptionsList = document.getElementById('detail-options-list');
    elements.selectedFiltersList = document.getElementById('selected-filters');
    elements.pagination = document.getElementById('pagination');
    
    // 로딩 스피너 요소
    elements.loadingSpinner = document.getElementById('loading-spinner');
    
    // 카테고리 데이터 가져오기
    await loadCategories();
    
    // 이벤트 리스너 등록
    setupEventListeners();
    
    // 데이터베이스에서 자동완성 데이터 로드
    loadAutocompleteData();
}

// 카테고리 데이터 로드 - 간소화 버전
async function loadCategories() {
    try {
        // category-manager.js 파일에서 직접 로드
        const response = await fetch('data/web/category-data.json');
        
        if (response.ok) {
            const data = await response.json();
            state.categories.mainCategories = data.mainCategories || [];
            state.categories.subCategories = data.subCategories || [];
            console.log('카테고리 데이터 로드 성공:', 
                state.categories.mainCategories.length + '개 대분류,',
                state.categories.subCategories.length + '개 소분류');
        } else {
            // 카테고리 데이터를 로드할 수 없는 경우
            console.error('카테고리 데이터를 로드할 수 없습니다.');
            
            // 카테고리 로드 실패 메시지 표시
            const categoryPanel = document.querySelector('.category-panel');
            if (categoryPanel) {
                categoryPanel.innerHTML = `
                    <div class="category-error">
                        <p>카테고리 데이터를 로드할 수 없습니다.</p>
                        <p>검색 기능을 이용해주세요.</p>
                    </div>
                `;
            }
        }
        
        // 카테고리 초기화
        renderMainCategories();
    } catch (error) {
        console.error('카테고리 로드 중 오류 발생:', error);
        
        // 카테고리 로드 실패 메시지 표시
        const categoryPanel = document.querySelector('.category-panel');
        if (categoryPanel) {
            categoryPanel.innerHTML = `
                <div class="category-error">
                    <p>카테고리 데이터를 로드할 수 없습니다.</p>
                    <p>검색 기능을 이용해주세요.</p>
                </div>
            `;
        }
    }
}

// 특정 메인 카테고리에 속하는 서브카테고리 가져오기
function getSubCategoriesByMainCategory(mainCategory) {
    return state.categories.subCategories.filter(cat => cat.mainCategory === mainCategory);
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 검색어 입력 이벤트
    elements.searchInput.addEventListener('input', debounce(handleSearchInput, 300));
    
    // 키보드 이벤트 (화살표, Enter 등)
    elements.searchInput.addEventListener('keydown', handleKeyDown);
    
    // 검색 버튼 클릭
    elements.searchButton.addEventListener('click', handleSearch);
    
    // 초기화 버튼 클릭
    elements.resetButton.addEventListener('click', resetSearch);
    
    // 세부 옵션 토글
    elements.toggleOptionsButton.addEventListener('click', toggleDetailOptions);
    
    // 클릭 이벤트 처리 (바깥 영역 클릭 시 자동완성 닫기)
    document.addEventListener('click', handleDocumentClick);
}

// 자동완성 데이터 로드 (데이터베이스에서)
function loadAutocompleteData() {
    console.log('데이터베이스에서 자동완성 데이터 로드 중...');
    fetch('data/database/items.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('데이터베이스 로드 실패');
            }
            return response.json();
        })
        .then(data => {
            if (data && Array.isArray(data.items) && data.items.length > 0) {
                // 로컬 스토리지에 저장
                localStorage.setItem('auctionAutocompleteData', JSON.stringify(data.items));
                console.log('자동완성 데이터 로드 완료: ', data.items.length + '개 항목');
            } else {
                throw new Error('유효한 데이터가 없습니다');
            }
        })
        .catch(error => {
            console.error('자동완성 데이터 로드 오류:', error);
            // 실패 시 기존 캐시 데이터 사용
            const cachedData = localStorage.getItem('auctionAutocompleteData');
            if (!cachedData) {
                console.warn('캐시된 자동완성 데이터가 없습니다. 기능이 제한될 수 있습니다.');
            }
        });
}

// 메인 카테고리 렌더링
function renderMainCategories() {
    // 카테고리가 없으면 표시하지 않음
    if (state.categories.mainCategories.length === 0) {
        return;
    }
    
    elements.mainCategoriesList.innerHTML = '';
    
    state.categories.mainCategories.forEach(category => {
        const li = document.createElement('li');
        li.className = 'category-item';
        
        const button = document.createElement('button');
        button.className = `category-button ${state.selectedMainCategory === category.id ? 'active' : ''}`;
        button.textContent = category.name;
        button.setAttribute('data-category-id', category.id);
        button.addEventListener('click', () => handleMainCategoryClick(category));
        
        li.appendChild(button);
        
        // 확장된 카테고리인 경우 소분류 목록 추가
        if (state.expandedMainCategory === category.id) {
            const subList = document.createElement('ul');
            subList.className = 'subcategory-list expanded';
            
            const subCategories = getSubCategoriesByMainCategory(category.id);
            subCategories.forEach(subCategory => {
                const subLi = document.createElement('li');
                subLi.className = 'subcategory-item';
                
                const subButton = document.createElement('button');
                subButton.className = `subcategory-button ${state.selectedSubCategory === subCategory.id ? 'active' : ''}`;
                subButton.textContent = subCategory.name;
                subButton.setAttribute('data-category-id', subCategory.id);
                subButton.addEventListener('click', () => handleSubCategoryClick(subCategory));
                
                subLi.appendChild(subButton);
                subList.appendChild(subLi);
            });
            
            li.appendChild(subList);
        }
        
        elements.mainCategoriesList.appendChild(li);
    });
}

// 메인 카테고리 클릭 처리 - API 호출 제거
function handleMainCategoryClick(category) {
    // 이미 선택된 카테고리인 경우 토글
    if (state.expandedMainCategory === category.id) {
        state.expandedMainCategory = null;
        state.selectedMainCategory = null;
    } else {
        state.expandedMainCategory = category.id;
        state.selectedMainCategory = category.id;
    }
    
    // 하위 카테고리 선택 초기화
    state.selectedSubCategory = null;
    
    // 세부 옵션 초기화
    clearDetailOptions();
    
    // 카테고리 UI 업데이트
    renderMainCategories();
    
    // 중요: 대분류 클릭 시에는 API 호출하지 않음
    // 결과 패널 리셋
    elements.resultsBody.innerHTML = '<tr class="empty-result"><td colspan="4">검색어를 입력하세요.</td></tr>';
    // 페이지네이션 숨기기
    elements.pagination.innerHTML = '';
}

// 소분류 클릭 처리
function handleSubCategoryClick(subCategory) {
    // 이미 선택된 서브 카테고리인 경우 토글
    if (state.selectedSubCategory === subCategory.id) {
        state.selectedSubCategory = null;
        
        // 카테고리 UI 업데이트
        renderMainCategories();
        
        // 결과 패널 리셋
        elements.resultsBody.innerHTML = '<tr class="empty-result"><td colspan="4">검색어를 입력하세요.</td></tr>';
        // 페이지네이션 숨기기
        elements.pagination.innerHTML = '';
        
        // 세부 옵션 초기화
        clearDetailOptions();
        
        return;
    }
    
    state.selectedSubCategory = subCategory.id;
    
    // 카테고리 UI 업데이트
    renderMainCategories();
    
    // 소분류에 맞는 세부 옵션 로드
    loadOptionStructure(subCategory.id);
    
    // 선택된 소분류로 검색
    searchByCategory(state.selectedMainCategory, state.selectedSubCategory);
}

// 카테고리 검색
function searchByCategory(mainCategory, subCategory = null) {
    // 소분류가 없으면 검색할 수 없음
    if (!subCategory) {
        // 대분류만 선택한 경우 UI만 업데이트하고 검색은 하지 않음
        if (mainCategory) {
            console.log("대분류만 선택됨:", mainCategory);
            // 소분류를 선택하라는 메시지 표시
            elements.resultsBody.innerHTML = '<tr class="empty-result"><td colspan="4">소분류를 선택하세요.</td></tr>';
            // 페이지네이션 숨기기
            elements.pagination.innerHTML = '';
        }
        return;
    }
    
    // 로딩 시작
    setLoading(true);
    
    // 검색 상태 초기화
    state.searchResults = [];
    state.currentPage = 1;
    
    console.log(`카테고리 검색: ${mainCategory} > ${subCategory}`);
    
    // 중요: API에는 소분류(subCategory)를 카테고리로 전달
    searchWithCategoryAndItem(mainCategory, subCategory, state.searchTerm);
}

// 한글 분해 함수
function decomposeHangul(str) {
    return str.split('').map(char => {
        const charCode = char.charCodeAt(0);
        if (charCode < HANGUL_START || charCode > HANGUL_END) {
            return char; // 한글이 아니면 그대로 반환
        }
        
        const chosungIndex = Math.floor((charCode - HANGUL_START) / (21 * 28));
        const jungsungIndex = Math.floor(((charCode - HANGUL_START) % (21 * 28)) / 28);
        const jongsungIndex = (charCode - HANGUL_START) % 28;
        
        return CHOSUNG[chosungIndex] + JUNGSUNG[jungsungIndex] + (jongsungIndex > 0 ? JONGSUNG[jongsungIndex] : '');
    }).join('');
}

// 초성 추출 함수
function getChosung(str) {
    return str.split('').map(char => {
        const charCode = char.charCodeAt(0);
        if (charCode < HANGUL_START || charCode > HANGUL_END) {
            return char; // 한글이 아니면 그대로 반환
        }
        
        const chosungIndex = Math.floor((charCode - HANGUL_START) / (21 * 28));
        return CHOSUNG[chosungIndex];
    }).join('');
}

// 디바운스 함수 (연속 호출 방지)
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

// 검색어 입력 처리
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

// 자동완성 추천 생성 - 정확도 향상
function getSuggestions(searchTerm) {
    if (!searchTerm) return [];
    
    const normalizedTerm = searchTerm.toLowerCase();
    const chosungTerm = getChosung(normalizedTerm);
    
    // 영->한 오타 수정 시도
    let koreanFromEng = '';
    for (let i = 0; i < normalizedTerm.length; i++) {
        const char = normalizedTerm[i];
        koreanFromEng += engToKorMap[char] || char;
    }
    
    // 로컬 스토리지에서 자동완성 데이터 가져오기
    let autocompleteItems = [];
    const cachedSuggestions = localStorage.getItem('auctionAutocompleteData');
    
    if (cachedSuggestions) {
        try {
            autocompleteItems = JSON.parse(cachedSuggestions);
        } catch (error) {
            console.error('자동완성 데이터 파싱 오류:', error);
        }
    }
    
    // 데이터가 없으면 빈 배열 반환
    if (!Array.isArray(autocompleteItems) || autocompleteItems.length === 0) {
        return [];
    }
    
    // 검색 정확도 점수 계산 함수
    function calculateScore(item) {
        if (!item || !item.name) return 0;
        
        const itemName = item.name.toLowerCase();
        let score = 0;
        
        // 정확히 일치하면 최고 점수
        if (itemName === normalizedTerm) {
            score += 100;
        }
        // 시작 부분이 일치하면 높은 점수
        else if (itemName.startsWith(normalizedTerm)) {
            score += 80;
        }
        // 단어 중간에 포함되면 중간 점수
        else if (itemName.includes(normalizedTerm)) {
            score += 60;
        }
        // 초성이 일치하면 낮은 점수
        else if (getChosung(itemName).includes(chosungTerm)) {
            score += 40;
        }
        // 영한 변환 결과가 포함되면 매우 낮은 점수
        else if (koreanFromEng && itemName.includes(koreanFromEng)) {
            score += 20;
        }
        else {
            // 일치하는 부분이 없으면 후보에서 제외
            return 0;
        }
        
        // 아이템 이름이 짧을수록 더 관련성이 높을 가능성이 있음
        score += Math.max(0, 30 - itemName.length);
        
        return score;
    }
    
    // 정확도 기반 필터링 및 정렬
    const scoredItems = autocompleteItems
        .map(item => ({
            item,
            score: calculateScore(item)
        }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10) // 최대 10개만 표시
        .map(entry => entry.item);
    
    return scoredItems;
}

// 자동완성 렌더링
function renderSuggestions() {
    // 기존 추천 초기화
    elements.suggestionsList.innerHTML = '';
    
    // 추천 목록 표시
    state.suggestions.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = `suggestion-item ${index === state.activeSuggestion ? 'active' : ''}`;
        
        // 아이템 카테고리 정보 표시
        let categoryInfo = '';
        if (item.category || item.mainCategory) {
            const mainCategory = item.mainCategory || item.category || '';
            const subCategory = item.subCategory || '';
            categoryInfo = `<div class="suggestion-category">${mainCategory}${subCategory ? ' > ' + subCategory : ''}</div>`;
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
}

// 자동완성 선택 처리 - 카테고리 자동 선택 추가
function handleSelectSuggestion(item, index) {
    // ... 기존 코드 ...
    
    // 카테고리 정보가 있으면, 해당 카테고리 자동 선택
    if (item.mainCategory || item.category) {
        // 메인 카테고리 설정 (UI 그룹화용)
        const mainCategory = item.mainCategory || findMainCategoryForSubCategory(item.category);
        
        // 서브 카테고리 설정 (실제 API 검색용)
        const subCategory = item.subCategory || item.category;
        
        if (mainCategory) {
            state.selectedMainCategory = mainCategory;
            state.expandedMainCategory = mainCategory;
            
            // 서브 카테고리 설정 - 실제 API 검색에 중요
            if (subCategory) {
                const subCategoryObj = state.categories.subCategories.find(cat => 
                    cat.id === subCategory || cat.name === subCategory);
                
                if (subCategoryObj) {
                    state.selectedSubCategory = subCategoryObj.id;
                }
            }
            
            // 카테고리 UI 업데이트
            renderMainCategories();
            
            // 세부 옵션 로드
            if (state.selectedSubCategory) {
                loadOptionStructure(state.selectedSubCategory);
            }
        }
    }
    
    // 자동완성 닫기
    clearSuggestions();
    
    // 선택된 아이템으로 검색 실행
    handleSearch();
}

// 서브 카테고리에 해당하는 메인 카테고리 찾기
function findMainCategoryForSubCategory(subCategoryId) {
    if (!subCategoryId) return null;
    
    const subCategory = state.categories.subCategories.find(cat => 
        cat.id === subCategoryId || cat.name === subCategoryId);
    
    return subCategory ? subCategory.mainCategory : null;
}

// 검색 초기화
function resetSearch() {
    // 검색어 초기화
    elements.searchInput.value = '';
    state.searchTerm = '';
    state.selectedItem = null;
    
    // 카테고리 선택 초기화
    state.selectedMainCategory = null;
    state.selectedSubCategory = null;
    state.expandedMainCategory = null;
    
    // 필터 초기화
    state.advancedFilters = {};
    state.selectedFilters = {};
    
    // UI 업데이트
    renderMainCategories();
    updateSelectedFilters();
    clearDetailOptions();
    
    // 결과 초기화
    elements.resultsBody.innerHTML = '<tr class="empty-result"><td colspan="4">검색어를 입력하세요.</td></tr>';
    
    // 페이지네이션 초기화
    elements.pagination.innerHTML = '';
    
    // 자동완성 닫기
    clearSuggestions();
}

// 자동완성 목록 비우기
function clearSuggestions() {
    elements.suggestionsList.innerHTML = '';
    elements.suggestionsList.classList.remove('show');
    state.suggestions = [];
    state.activeSuggestion = -1;
}

// 키보드 탐색 처리 - 스크롤 기능 추가
function handleKeyDown(e) {
    // 자동완성 목록이 표시된 경우에만 처리
    if (!elements.suggestionsList.classList.contains('show')) return;
    
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

// 선택된 자동완성 항목이 보이도록 스크롤
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

// 활성화된 자동완성 업데이트
function updateActiveSuggestion() {
    const items = elements.suggestionsList.querySelectorAll('.suggestion-item');
    
    items.forEach((item, index) => {
        item.classList.toggle('active', index === state.activeSuggestion);
    });
}

// 로딩 표시 설정
function setLoading(isLoading) {
    state.isLoading = isLoading;
    elements.loadingSpinner.style.display = isLoading ? 'flex' : 'none';
    elements.searchButton.disabled = isLoading;
    elements.resetButton.disabled = isLoading;
}

// 검색 실행
function handleSearch() {
    // ... 기존 코드 ...
    
    // 소분류가 선택된 경우만 카테고리 검색 사용
    if (state.selectedSubCategory) {
        const mainCat = state.selectedMainCategory;
        const subCat = state.selectedSubCategory;
        console.log(`카테고리 + 검색어로 검색: ${mainCat ? mainCat + ' > ' : ''}${subCat}, ${state.searchTerm || '전체'}`);
        searchWithCategoryAndItem(mainCat, subCat, state.searchTerm);
    }
    // 대분류만 선택된 경우 검색 불가
    else if (state.selectedMainCategory) {
        console.log(`대분류만 선택됨: ${state.selectedMainCategory}`);
        elements.resultsBody.innerHTML = '<tr class="empty-result"><td colspan="4">소분류를 선택하세요.</td></tr>';
        elements.pagination.innerHTML = '';
        setLoading(false);
    }
    
    // 로딩 시작
    setLoading(true);
    
    // 초기화
    state.searchResults = [];
    state.currentPage = 1;
    
    // 데이터베이스에서 검색어 존재 여부 확인
    const isInDatabase = checkSearchTermInDatabase(state.searchTerm);
    
    // 카테고리가 선택되어 있는 경우 (카테고리 + 아이템 이름 검색)
    if (state.selectedMainCategory || state.selectedSubCategory) {
        const mainCat = state.selectedMainCategory;
        const subCat = state.selectedSubCategory;
        console.log(`카테고리 + 검색어로 검색: ${mainCat}${subCat ? ' > ' + subCat : ''}, ${state.searchTerm || '전체'}`);
        searchWithCategoryAndItem(mainCat, subCat, state.searchTerm);
    }
    // 카테고리 없이 검색어만 있는 경우
    else if (state.searchTerm) {
        // 데이터베이스에 있으면 일반 검색, 없으면 키워드 검색
        if (isInDatabase && state.selectedItem) {
            console.log(`데이터베이스 히트: ${state.searchTerm}`);
            // 아이템이 데이터베이스에 있음 - 카테고리 자동 선택 및 보여주기
            const mainCategory = getMainCategoryFromItem(state.selectedItem);
            const subCategory = getSubCategoryFromItem(state.selectedItem);
            
            if (mainCategory) {
                state.selectedMainCategory = mainCategory;
                state.expandedMainCategory = mainCategory;
                
                if (subCategory) {
                    state.selectedSubCategory = subCategory;
                }
                
                // 카테고리 UI 업데이트
                renderMainCategories();
                
                searchWithCategoryAndItem(mainCategory, subCategory, state.searchTerm);
            } else {
                // 카테고리 정보가 없는 경우 키워드 검색
                console.log(`키워드로 검색: ${state.searchTerm}`);
                searchWithKeyword(state.searchTerm);
            }
        } else {
            // 데이터베이스에 없음 - 키워드 검색
            console.log(`키워드로 검색: ${state.searchTerm}`);
            searchWithKeyword(state.searchTerm);
        }
    }
    
    // 자동완성 닫기
    clearSuggestions();
}

// 데이터베이스에서 검색어 확인
function checkSearchTermInDatabase(searchTerm) {
    if (!searchTerm) return false;
    
    const cachedData = localStorage.getItem('auctionAutocompleteData');
    if (!cachedData) return false;
    
    try {
        const items = JSON.parse(cachedData);
        const normalizedTerm = searchTerm.toLowerCase();
        
        return items.some(item => 
            typeof item.name === 'string' && 
            item.name.toLowerCase() === normalizedTerm
        );
    } catch (error) {
        console.error('데이터베이스 검색 오류:', error);
        return false;
    }
}

// 아이템에서 메인 카테고리 추출
function getMainCategoryFromItem(item) {
    if (!item) return null;
    
    // 아이템에 메인 카테고리 정보가 직접 있는 경우
    if (item.mainCategory) {
        return item.mainCategory;
    }
    
    // 아이템에 카테고리 정보가 있는 경우 (서브 카테고리일 수 있음)
    if (item.category) {
        // 해당 카테고리가 메인 카테고리인지 확인
        const isMainCategory = state.categories.mainCategories.some(
            cat => cat.id === item.category || cat.name === item.category
        );
        
        if (isMainCategory) {
            return item.category;
        }
        
        // 서브 카테고리에서 메인 카테고리 찾기
        return findMainCategoryForSubCategory(item.category);
    }
    
    return null;
}

// 아이템에서 서브 카테고리 추출
function getSubCategoryFromItem(item) {
    if (!item) return null;
    
    // 아이템에 서브 카테고리 정보가 직접 있는 경우
    if (item.subCategory) {
        return item.subCategory;
    }
    
    // 아이템의 카테고리가 서브 카테고리인지 확인
    if (item.category) {
        const isSubCategory = state.categories.subCategories.some(
            cat => cat.id === item.category || cat.name === item.category
        );
        
        if (isSubCategory) {
            return item.category;
        }
    }
    
    return null;
}

// 키워드로 검색 (Firebase Function 호출)
async function searchWithKeyword(keyword) {
    if (!keyword) {
        setLoading(false);
        return;
    }
    
    try {
        const url = `${FIREBASE_FUNCTIONS.SEARCH_KEYWORD}?keyword=${encodeURIComponent(keyword)}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('API 호출 실패: ' + response.status);
        }
        
        const data = await response.json();
        
        // 검색 결과 저장
        state.searchResults = data.items || [];
        state.totalItems = state.searchResults.length;
        state.totalPages = Math.ceil(state.totalItems / state.itemsPerPage);
        
        // 검색 결과가 있고 카테고리 정보가 없는 경우, 첫 번째 아이템의 카테고리 정보 활용
        if (state.searchResults.length > 0 && !state.selectedMainCategory && !state.selectedSubCategory) {
            // 카테고리 정보 추출 및 표시
            const firstItem = state.searchResults[0];
            if (firstItem.auction_item_category) {
                showCategoryPath(firstItem);
            }
        }
        
        // 페이지네이션 및 결과 렌더링
        renderCurrentPage();
        renderPagination();
    } catch (error) {
        console.error('검색 오류:', error);
        showError('검색 중 오류가 발생했습니다: ' + error.message);
    } finally {
        setLoading(false);
    }
}

// 아이템의 카테고리 경로 표시
function showCategoryPath(item) {
    if (!item || !item.auction_item_category) return;
    
    // 메인 카테고리 찾기
    const mainCategory = item.auction_item_category;
    const mainCategoryObj = state.categories.mainCategories.find(cat => 
        cat.id === mainCategory || cat.name === mainCategory);
    
    if (mainCategoryObj) {
        // 메인 카테고리 UI만 업데이트 (API 호출 없이)
        // 실제 state는 변경하지 않음 - 화면 표시용
        
        // 카테고리 경로 패널 표시
        const categoryPathPanel = document.createElement('div');
        categoryPathPanel.className = 'category-path-panel';
        categoryPathPanel.innerHTML = `
            <div class="category-path">
                <span class="category-path-label">카테고리:</span>
                <span class="category-path-main">${mainCategoryObj.name}</span>
                ${item.item_option && item.item_option.some(opt => opt.option_type === '분류') ? 
                    `<span class="category-path-separator">></span>
                     <span class="category-path-sub">${item.item_option.find(opt => opt.option_type === '분류').option_value}</span>` 
                    : ''}
            </div>
        `;
        
        // 결과 패널에 삽입
        const resultsPanel = document.querySelector('.results-panel');
        const resultStats = document.querySelector('.result-stats-container');
        
        if (resultsPanel && resultStats) {
            resultsPanel.insertBefore(categoryPathPanel, resultStats.nextSibling);
        }
    }
}

// 카테고리 + 아이템으로 검색 (Firebase Function 호출)
async function searchWithCategoryAndItem(mainCategory, subCategory, itemName = null) {
    try {
        // 소분류가 없으면 검색할 수 없음
        if (!subCategory) {
            setLoading(false);
            return;
        }
        
        // URL 구성 - 소분류가 실제 API 카테고리
        let url = `${FIREBASE_FUNCTIONS.SEARCH_CATEGORY}?subCategory=${encodeURIComponent(subCategory)}`;
        
        // 대분류도 함께 전달 (UI 표시용)
        if (mainCategory) {
            url += `&category=${encodeURIComponent(mainCategory)}`;
        }
        
        // 아이템 이름이 있는 경우 추가
        if (itemName) {
            url += `&itemName=${encodeURIComponent(itemName)}`;
        }
        
        // 필터 추가
        if (Object.keys(state.advancedFilters).length > 0) {
            const filterParams = new URLSearchParams();
            for (const [key, value] of Object.entries(state.advancedFilters)) {
                filterParams.append(`filter_${key}`, value);
            }
            url += `&${filterParams.toString()}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('API 호출 실패: ' + response.status);
        }
        
        const data = await response.json();
        
        // 검색 결과 저장
        state.searchResults = data.items || [];
        state.totalItems = state.searchResults.length;
        state.totalPages = Math.ceil(state.totalItems / state.itemsPerPage);
        
        // 페이지네이션 및 결과 렌더링
        renderCurrentPage();
        renderPagination();
    } catch (error) {
        console.error('검색 오류:', error);
        showError('검색 중 오류가 발생했습니다: ' + error.message);
    } finally {
        setLoading(false);
    }
}

// 오류 메시지 표시
function showError(message) {
    // 간단한 오류 메시지 표시
    alert(message);
}

// 현재 페이지 렌더링
function renderCurrentPage() {
    // 현재 페이지에 표시할 아이템 계산
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = Math.min(startIndex + state.itemsPerPage, state.totalItems);
    const currentPageItems = state.searchResults.slice(startIndex, endIndex);
    
    // 결과 테이블 초기화
    elements.resultsBody.innerHTML = '';
    
    // 결과가 없는 경우
    if (currentPageItems.length === 0) {
        const tr = document.createElement('tr');
        tr.className = 'empty-result';
        tr.innerHTML = `<td colspan="4">검색 결과가 없습니다. 다른 키워드로 검색해보세요.</td>`;
        elements.resultsBody.appendChild(tr);
        return;
    }
    
    // 현재 페이지 아이템 표시
    currentPageItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'item-row';
        tr.setAttribute('data-item-id', item.auction_item_no);
        
        // 카테고리 정보 추출
        let category = item.auction_item_category || '기타';
        let subCategory = '';
        if (item.item_option && item.item_option.length > 0) {
            const categoryOption = item.item_option.find(opt => opt.option_type === '분류');
            if (categoryOption) {
                subCategory = categoryOption.option_value || '';
            }
        }
        
        // 레벨 정보 추출
        let level = '-';
        if (item.item_option && item.item_option.length > 0) {
            const levelOption = item.item_option.find(opt => 
                opt.option_type === '레벨' || 
                opt.option_type === '요구 레벨' || 
                opt.option_type === '아이템 레벨'
            );
            if (levelOption) {
                level = levelOption.option_value || '-';
            }
        }
        
        tr.innerHTML = `
            <td>
                <div class="item-cell">
                    <div class="item-name">${item.item_name}</div>
                </div>
            </td>
            <td>${category}${subCategory ? ' > ' + subCategory : ''}</td>
            <td>${level}</td>
            <td class="item-price">${item.auction_price_per_unit.toLocaleString()}G</td>
        `;
        
        // 아이템 클릭 이벤트 - 상세 정보 조회
        tr.addEventListener('click', () => {
            showItemDetails(item);
        });
        
        elements.resultsBody.appendChild(tr);
    });
    
    // 검색 결과 통계 업데이트
    const resultStats = document.getElementById('result-stats');
    if (resultStats) {
        resultStats.textContent = `총 ${state.totalItems}개 결과 중 ${startIndex + 1}-${endIndex}`;
    }
}

// 페이지네이션 렌더링
function renderPagination() {
    // 페이지네이션 컨테이너 초기화
    elements.pagination.innerHTML = '';
    
    // 페이지가 1개 이하면 페이지네이션 표시하지 않음
    if (state.totalPages <= 1) return;
    
    // 페이지 번호 계산 (현재 페이지 기준 전후로 최대 5개 페이지 표시)
    const maxPagesToShow = 5;
    let startPage = Math.max(1, state.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(state.totalPages, startPage + maxPagesToShow - 1);
    
    // 시작 페이지 재조정
    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    // 페이지네이션 UI 생성
    const paginationUl = document.createElement('ul');
    paginationUl.className = 'pagination-list';
    
    // 이전 페이지 버튼
    if (state.currentPage > 1) {
        const prevLi = document.createElement('li');
        prevLi.className = 'pagination-item';
        
        const prevButton = document.createElement('button');
        prevButton.className = 'pagination-link';
        prevButton.innerHTML = '&laquo;';
        prevButton.addEventListener('click', () => goToPage(state.currentPage - 1));
        
        prevLi.appendChild(prevButton);
        paginationUl.appendChild(prevLi);
    }
    
    // 페이지 번호 버튼
    for (let i = startPage; i <= endPage; i++) {
        const pageLi = document.createElement('li');
        pageLi.className = 'pagination-item';
        
        const pageButton = document.createElement('button');
        pageButton.className = `pagination-link ${i === state.currentPage ? 'active' : ''}`;
        pageButton.textContent = i;
        pageButton.addEventListener('click', () => goToPage(i));
        
        pageLi.appendChild(pageButton);
        paginationUl.appendChild(pageLi);
    }
    
    // 다음 페이지 버튼
    if (state.currentPage < state.totalPages) {
        const nextLi = document.createElement('li');
        nextLi.className = 'pagination-item';
        
        const nextButton = document.createElement('button');
        nextButton.className = 'pagination-link';
        nextButton.innerHTML = '&raquo;';
        nextButton.addEventListener('click', () => goToPage(state.currentPage + 1));
        
        nextLi.appendChild(nextButton);
        paginationUl.appendChild(nextLi);
    }
    
    elements.pagination.appendChild(paginationUl);
}

// 페이지 이동 함수
function goToPage(pageNumber) {
    if (pageNumber < 1 || pageNumber > state.totalPages) return;
    
    // 페이지 번호 업데이트
    state.currentPage = pageNumber;
    
    // 현재 페이지 렌더링
    renderCurrentPage();
    
    // 페이지네이션 업데이트
    renderPagination();
    
    // 페이지 상단으로 스크롤
    const resultsPanel = document.querySelector('.results-panel');
    if (resultsPanel) {
        resultsPanel.scrollIntoView({ behavior: 'smooth' });
    }
}

// 아이템 상세 정보 표시 (모달 방식)
function showItemDetails(item) {
    // 간단한 상세 정보 모달 구현
    let optionsHtml = '';
    
    if (item.item_option && item.item_option.length > 0) {
        item.item_option.forEach(option => {
            if (option.option_type && option.option_value) {
                optionsHtml += `
                    <div class="item-option">
                        <strong>${option.option_type}:</strong> ${option.option_value}
                    </div>
                `;
            }
        });
    }
    
    const modalHtml = `
        <div class="item-detail-modal">
            <div class="modal-header">
                <h3>${item.item_name}</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="item-basic-info">
                    <p><strong>카테고리:</strong> ${item.auction_item_category || '정보 없음'}</p>
                    <p><strong>가격:</strong> ${item.auction_price_per_unit.toLocaleString()}G</p>
                    <p><strong>판매 수량:</strong> ${item.auction_count || 1}개</p>
                </div>
                <div class="item-options">
                    <h4>아이템 옵션</h4>
                    ${optionsHtml || '<p>옵션 정보가 없습니다.</p>'}
                </div>
            </div>
        </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal-container';
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    // 모달 닫기 버튼 이벤트
    const closeButton = modalContainer.querySelector('.close-modal');
    closeButton.addEventListener('click', () => {
        document.body.removeChild(modalContainer);
    });
    
    // 모달 바깥 클릭 시 닫기
    modalContainer.addEventListener('click', (e) => {
        if (e.target === modalContainer) {
            document.body.removeChild(modalContainer);
        }
    });
}

// 세부 옵션 토글
function toggleDetailOptions() {
    state.showDetailOptions = !state.showDetailOptions;
    
    const detailOptionsContainer = document.getElementById('detail-options');
    detailOptionsContainer.classList.toggle('show', state.showDetailOptions);
    elements.toggleOptionsButton.textContent = state.showDetailOptions ? '접기' : '펼치기';
}

// 세부 옵션 구조 로드
function loadOptionStructure(subCategoryId) {
    if (!subCategoryId) {
        clearDetailOptions();
        return;
    }
    
    // 옵션 구조 데이터 로드 (data/option_structure 경로에서)
    fetch(`data/option_structure/${subCategoryId}.json`)
        .then(response => {
            if (!response.ok) {
                throw new Error('옵션 구조 파일을 찾을 수 없습니다.');
            }
            return response.json();
        })
        .then(data => {
            // 옵션 구조 업데이트
            renderDetailOptions(data.option_structure || {});
        })
        .catch(error => {
            console.error('옵션 구조 로드 실패:', error);
            // 오류 발생 시 기본 옵션 구조 사용
            renderDetailOptions({});
        });
}

// 세부 옵션 렌더링
function renderDetailOptions(optionStructure) {
    // 세부 옵션 목록 초기화
    elements.detailOptionsList.innerHTML = '';
    
    if (Object.keys(optionStructure).length === 0) {
        elements.detailOptionsList.innerHTML = `
            <li class="no-options">이 카테고리에는 사용 가능한 세부 옵션이 없습니다.</li>
        `;
        return;
    }
    
    // 옵션 구조에 따른 드롭다운 옵션 생성
    Object.entries(optionStructure).forEach(([optionName, optionInfo]) => {
        const li = document.createElement('li');
        li.className = 'option-item';
        
        const optionButton = document.createElement('button');
        optionButton.className = 'option-button';
        optionButton.textContent = optionName;
        
        // 옵션 클릭 이벤트
        optionButton.addEventListener('click', () => {
            // 옵션 타입에 따른 입력 UI 생성 및 모달 표시
            showOptionInputModal(optionName, optionInfo);
        });
        
        li.appendChild(optionButton);
        elements.detailOptionsList.appendChild(li);
    });
}

// 선택된 필터 목록 업데이트
function updateSelectedFilters() {
    elements.selectedFiltersList.innerHTML = '';
    
    if (Object.keys(state.selectedFilters).length === 0) {
        elements.selectedFiltersList.innerHTML = '<li class="no-filters">선택된 필터가 없습니다.</li>';
        return;
    }
    
    Object.entries(state.selectedFilters).forEach(([key, value]) => {
        const li = document.createElement('li');
        li.className = 'selected-filter';
        
        li.innerHTML = `
            <span class="filter-name">${key}:</span>
            <span class="filter-value">${value}</span>
            <button class="remove-filter" data-filter-key="${key}">&times;</button>
        `;
        
        // 필터 제거 버튼 이벤트
        const removeButton = li.querySelector('.remove-filter');
        removeButton.addEventListener('click', () => {
            // 필터 제거
            delete state.selectedFilters[key];
            delete state.advancedFilters[key];
            
            // UI 업데이트
            updateSelectedFilters();
            
            // 검색 다시 실행
            if (state.selectedMainCategory) {
                searchByCategory(state.selectedMainCategory, state.selectedSubCategory);
            } else if (state.searchTerm) {
                handleSearch();
            }
        });
        
        elements.selectedFiltersList.appendChild(li);
    });
}

// 옵션 입력 모달 표시
function showOptionInputModal(optionName, optionInfo) {
    // 모달 생성
    const modalContainer = document.createElement('div');
    modalContainer.className = 'option-modal-container';
    
    let inputHtml = '';
    
    // 옵션 타입에 따른 입력 UI 생성
    if (optionInfo.value === "number") {
        if (optionInfo.value2) {
            // 범위 입력 (min-max)
            inputHtml = `
                <div class="range-input">
                    <input type="number" id="option-min" placeholder="최소값" min="0">
                    <span>~</span>
                    <input type="number" id="option-max" placeholder="최대값" min="0">
                </div>
            `;
        } else {
            // 단일 숫자 입력
            inputHtml = `
                <input type="number" id="option-value" placeholder="값 입력" min="0">
            `;
        }
    } 
    else if (optionInfo.value === "rgb") {
        // 색상 선택
        inputHtml = `
            <div class="color-input">
                <input type="color" id="option-value" value="#ffffff">
                <span>색상 선택</span>
            </div>
        `;
    } 
    else if (optionInfo.value === "percentage") {
        // 백분율
        inputHtml = `
            <div class="percent-input">
                <input type="number" id="option-value" min="0" max="100" placeholder="백분율">
                <span>%</span>
            </div>
        `;
    } 
    else {
        // 텍스트 입력
        inputHtml = `
            <input type="text" id="option-value" placeholder="값 입력">
        `;
    }
    
    modalContainer.innerHTML = `
        <div class="option-modal">
            <div class="modal-header">
                <h3>${optionName} 필터 설정</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                ${inputHtml}
                <div class="modal-buttons">
                    <button class="cancel-button">취소</button>
                    <button class="apply-button">적용</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalContainer);
    
    // 모달 닫기 버튼 이벤트
    const closeButton = modalContainer.querySelector('.close-modal');
    closeButton.addEventListener('click', () => {
        document.body.removeChild(modalContainer);
    });
    
    // 취소 버튼 이벤트
    const cancelButton = modalContainer.querySelector('.cancel-button');
    cancelButton.addEventListener('click', () => {
        document.body.removeChild(modalContainer);
    });
    
    // 적용 버튼 이벤트
    const applyButton = modalContainer.querySelector('.apply-button');
    applyButton.addEventListener('click', () => {
        // 입력 값 가져오기
        let filterValue;
        
        if (optionInfo.value === "number" && optionInfo.value2) {
            // 범위 입력
            const minValue = modalContainer.querySelector('#option-min').value;
            const maxValue = modalContainer.querySelector('#option-max').value;
            
            if (!minValue && !maxValue) {
                alert('최소값 또는 최대값을 입력해주세요.');
                return;
            }
            
            // 최소값만 있는 경우
            if (minValue && !maxValue) {
                filterValue = `>=${minValue}`;
                state.advancedFilters[`min_${optionName}`] = minValue;
                state.selectedFilters[optionName] = `${minValue} 이상`;
            }
            // 최대값만 있는 경우
            else if (!minValue && maxValue) {
                filterValue = `<=${maxValue}`;
                state.advancedFilters[`max_${optionName}`] = maxValue;
                state.selectedFilters[optionName] = `${maxValue} 이하`;
            }
            // 둘 다 있는 경우
            else {
                filterValue = `${minValue}~${maxValue}`;
                state.advancedFilters[`min_${optionName}`] = minValue;
                state.advancedFilters[`max_${optionName}`] = maxValue;
                state.selectedFilters[optionName] = `${minValue}~${maxValue}`;
            }
        } else {
            // 단일 값 입력
            filterValue = modalContainer.querySelector('#option-value').value;
            
            if (!filterValue) {
                alert('값을 입력해주세요.');
                return;
            }
            
            state.advancedFilters[optionName] = filterValue;
            state.selectedFilters[optionName] = filterValue;
        }
        
        // 선택된 필터 UI 업데이트
        updateSelectedFilters();
        
        // 모달 닫기
        document.body.removeChild(modalContainer);
        
        // 검색 다시 실행
        if (state.selectedMainCategory) {
            searchByCategory(state.selectedMainCategory, state.selectedSubCategory);
        } else if (state.searchTerm) {
            handleSearch();
        }
    });
    
    // 모달 바깥 클릭 시 닫기
    modalContainer.addEventListener('click', (e) => {
        if (e.target === modalContainer) {
            document.body.removeChild(modalContainer);
        }
    });
}

// 세부 옵션 초기화
function clearDetailOptions() {
    elements.detailOptionsList.innerHTML = '';
    elements.detailOptionsList.innerHTML = `
        <li class="no-options">카테고리를 선택하면 세부 옵션이 표시됩니다.</li>
    `;
    
    // 선택된 필터 초기화
    state.advancedFilters = {};
    state.selectedFilters = {};
    updateSelectedFilters();
}

// 문서 클릭 이벤트 처리 (외부 클릭 시 패널 닫기)
function handleDocumentClick(event) {
    // 자동완성 외부 클릭 시 닫기
    if (
        !elements.searchInput.contains(event.target) && 
        !elements.suggestionsList.contains(event.target)
    ) {
        clearSuggestions();
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', init);
