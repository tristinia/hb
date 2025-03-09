/**
 * 마비노기 경매장 JavaScript
 */

// Firebase Functions URL 설정
const FIREBASE_FUNCTIONS = {
  SEARCH_KEYWORD: 'https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/searchByKeyword',
  SEARCH_CATEGORY: 'https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/searchByCategory',
  ITEM_DETAIL: 'https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/getItemDetail'
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
    optionStructure: {},
    advancedFilters: {},
    showDetailOptions: false,
    isLoading: false,
    loadingPage: false,
    hasMoreResults: false,
    nextCursor: null,
    searchType: null // 'keyword' 또는 'category'
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

// 카테고리별 소분류 가져오기
function getCategoriesByMainCategory(mainCategory) {
    return categories.filter(cat => cat.mainCategory === mainCategory);
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

// 초기화 함수
function init() {
    // DOM 요소 참조
    elements.searchInput = document.getElementById('search-input');
    elements.searchButton = document.querySelector('.search-button');
    elements.suggestionsList = document.getElementById('suggestions');
    elements.mainCategoriesList = document.getElementById('main-categories');
    elements.resultsBody = document.getElementById('results-body');
    elements.toggleOptionsButton = document.getElementById('toggle-options');
    elements.detailOptions = document.getElementById('detail-options');
    elements.applyFiltersButton = document.getElementById('apply-filters');
    elements.minLevelInput = document.getElementById('min-level');
    elements.maxLevelInput = document.getElementById('max-level');
    elements.itemTypeSelect = document.getElementById('item-type');
    elements.loadMoreButton = document.createElement('button');
    elements.loadMoreButton.id = 'load-more-button';
    elements.loadMoreButton.className = 'load-more-button';
    elements.loadMoreButton.textContent = '더 보기';
    elements.loadMoreButton.style.display = 'none';
    elements.loadMoreButton.addEventListener('click', loadMoreResults);
    
    // 결과 패널에 더 보기 버튼 추가
    const resultsPanel = document.querySelector('.results-panel');
    resultsPanel.appendChild(elements.loadMoreButton);
    
    // 로딩 스피너 요소 생성
    elements.loadingSpinner = document.createElement('div');
    elements.loadingSpinner.className = 'loading-spinner';
    elements.loadingSpinner.innerHTML = '<div class="spinner"></div><p>데이터를 불러오는 중...</p>';
    elements.loadingSpinner.style.display = 'none';
    document.body.appendChild(elements.loadingSpinner);
    
    // 카테고리 초기화
    renderMainCategories();
    
    // 이벤트 리스너 등록
    setupEventListeners();
    
    // 로컬 스토리지에서 자동완성 데이터 로드
    loadAutocompleteSuggestions();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 검색어 입력 이벤트
    elements.searchInput.addEventListener('input', debounce(handleSearchInput, 300));
    
    // 키보드 이벤트 (화살표, Enter 등)
    elements.searchInput.addEventListener('keydown', handleKeyDown);
    
    // 검색 버튼 클릭
    elements.searchButton.addEventListener('click', handleSearch);
    
    // 세부 옵션 토글
    elements.toggleOptionsButton.addEventListener('click', toggleDetailOptions);
    
    // 필터 적용 버튼
    elements.applyFiltersButton.addEventListener('click', applyFilters);
    
    // 클릭 이벤트 처리 (바깥 영역 클릭 시 자동완성 닫기)
    document.addEventListener('click', handleDocumentClick);
}

// 자동완성 데이터 로드 (로컬 스토리지에서)
function loadAutocompleteSuggestions() {
    // 로컬 스토리지에서 자동완성 데이터 로드
    const cachedSuggestions = localStorage.getItem('auctionAutocompleteData');
    if (cachedSuggestions) {
        try {
            const parsedData = JSON.parse(cachedSuggestions);
            if (parsedData && Array.isArray(parsedData) && parsedData.length > 0) {
                console.log('로컬 스토리지에서 자동완성 데이터 로드: ', parsedData.length + '개 항목');
                return;
            }
        } catch (error) {
            console.error('자동완성 데이터 파싱 오류:', error);
        }
    }
    
    // 로컬 데이터가 없거나 유효하지 않은 경우, 서버에서 로드
    console.log('서버에서 자동완성 데이터 로드 중...');
    fetchAutocompleteSuggestions();
}

// 서버에서 자동완성 데이터 가져오기
async function fetchAutocompleteSuggestions() {
    try {
        // data/web 디렉토리에서 자동완성 데이터 가져오기
        const response = await fetch('data/web/autocomplete.json');
        if (!response.ok) {
            throw new Error('자동완성 데이터를 가져오는데 실패했습니다');
        }
        
        const data = await response.json();
        if (data && Array.isArray(data.items) && data.items.length > 0) {
            // 로컬 스토리지에 저장
            localStorage.setItem('auctionAutocompleteData', JSON.stringify(data.items));
            console.log('자동완성 데이터 로드 완료: ', data.items.length + '개 항목');
        }
    } catch (error) {
        console.error('자동완성 데이터 로드 오류:', error);
    }
}

// 검색어 입력 처리
function handleSearchInput() {
    state.searchTerm = elements.searchInput.value.trim();
    
    if (state.searchTerm === '') {
        clearSuggestions();
        return;
    }
    
    // 자동완성 추천 생성
    const suggestions = getSuggestions();
    
    if (suggestions.length > 0) {
        state.suggestions = suggestions;
        renderSuggestions();
    } else {
        clearSuggestions();
    }
}

// 자동완성 추천 생성
function getSuggestions() {
    const normalizedTerm = state.searchTerm.toLowerCase();
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
    
    return autocompleteItems.filter(item => {
        const itemName = item.name.toLowerCase();
        
        // 일반 검색
        if (itemName.includes(normalizedTerm)) {
            return true;
        }
        
        // 초성 검색
        if (getChosung(itemName).includes(chosungTerm)) {
            return true;
        }
        
        // 분해된 한글 검색
        if (decomposeHangul(itemName).includes(normalizedTerm)) {
            return true;
        }
        
        // 영->한 오타 수정 검색
        if (koreanFromEng && itemName.includes(koreanFromEng)) {
            return true;
        }
        
        return false;
    }).slice(0, 10); // 최대 10개만 표시
}

// 자동완성 렌더링
function renderSuggestions() {
    // 기존 추천 초기화
    elements.suggestionsList.innerHTML = '';
    
    // 추천 목록 표시
    state.suggestions.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = `suggestion-item ${index === state.activeSuggestion ? 'active' : ''}`;
        li.innerHTML = `
            <div class="suggestion-name">${item.name}</div>
            <div class="suggestion-category">${item.category} > ${item.subcategory}</div>
        `;
        
        li.addEventListener('click', () => handleSelectSuggestion(item, index));
        
        elements.suggestionsList.appendChild(li);
    });
    
    // 목록 표시
    elements.suggestionsList.classList.add('show');
}

// 자동완성 선택 처리
function handleSelectSuggestion(item, index) {
    elements.searchInput.value = item.name;
    state.searchTerm = item.name;
    state.selectedItem = item;
    state.activeSuggestion = index;
    
    // 카테고리 및 서브카테고리 자동 설정
    state.selectedMainCategory = item.category;
    state.selectedSubCategory = item.subcategory;
    
    // 카테고리 UI 업데이트
    updateCategoryUI();
    
    // 아이템에 해당하는 옵션 구조 로드
    loadOptionStructure(item.subcategory);
    
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

// 키보드 탐색 처리
function handleKeyDown(e) {
    // 자동완성 목록이 표시된 경우에만 처리
    if (!elements.suggestionsList.classList.contains('show')) return;
    
    const totalSuggestions = state.suggestions.length;
    
    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            state.activeSuggestion = (state.activeSuggestion < totalSuggestions - 1) 
                ? state.activeSuggestion + 1 
                : state.activeSuggestion;
            updateActiveSuggestion();
            break;
            
        case 'ArrowUp':
            e.preventDefault();
            state.activeSuggestion = (state.activeSuggestion > 0) 
                ? state.activeSuggestion - 1 
                : 0;
            updateActiveSuggestion();
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
    elements.applyFiltersButton.disabled = isLoading;
}

// 검색 실행
function handleSearch() {
    // 검색어가 없으면 중단
    if (!state.searchTerm && !state.selectedMainCategory) {
        alert('검색어를 입력하거나 카테고리를 선택해주세요.');
        return;
    }
    
    // 로딩 시작
    setLoading(true);
    
    // 초기화
    state.searchResults = [];
    state.nextCursor = null;
    state.hasMoreResults = false;
    elements.loadMoreButton.style.display = 'none';
    
    // 자동완성을 통해 선택한 아이템이 있는 경우 (카테고리 + 아이템 이름 검색)
    if (state.selectedItem && state.selectedMainCategory) {
        console.log('카테고리 + 아이템으로 검색:', state.selectedMainCategory, state.selectedItem.name);
        state.searchType = 'category';
        searchWithCategoryAndItem(state.selectedMainCategory, state.selectedItem.name);
    }
    // 카테고리만 선택된 경우
    else if (state.selectedMainCategory) {
        console.log('카테고리로 검색:', state.selectedMainCategory);
        state.searchType = 'category';
        searchWithCategoryAndItem(state.selectedMainCategory);
    }
    // 키워드 검색
    else {
        console.log('키워드로 검색:', state.searchTerm);
        state.searchType = 'keyword';
        searchWithKeyword(state.searchTerm);
    }
    
    // 자동완성 닫기
    clearSuggestions();
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
        
        // 검색 결과 및 추가 정보 저장
        state.searchResults = data.items || [];
        state.hasMoreResults = data.hasMore;
        state.nextCursor = data.nextCursor;
        
        // 더 보기 버튼 표시 설정
        elements.loadMoreButton.style.display = state.hasMoreResults ? 'block' : 'none';
        
        // 결과 렌더링
        renderSearchResults();
    } catch (error) {
        console.error('검색 오류:', error);
        showError('검색 중 오류가 발생했습니다: ' + error.message);
    } finally {
        setLoading(false);
    }
}

// 카테고리 + 아이템으로 검색 (Firebase Function 호출)
async function searchWithCategoryAndItem(category, itemName = null) {
    try {
        let url = `${FIREBASE_FUNCTIONS.SEARCH_CATEGORY}?category=${encodeURIComponent(category)}`;
        if (itemName) {
            url += `&itemName=${encodeURIComponent(itemName)}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('API 호출 실패: ' + response.status);
        }
        
        const data = await response.json();
        
        // 검색 결과 및 추가 정보 저장
        state.searchResults = data.items || [];
        state.hasMoreResults = data.hasMore;
        state.nextCursor = data.nextCursor;
        
        // 더 보기 버튼 표시 설정
        elements.loadMoreButton.style.display = state.hasMoreResults ? 'block' : 'none';
        
        // 결과 렌더링
        renderSearchResults();
    } catch (error) {
        console.error('검색 오류:', error);
        showError('검색 중 오류가 발생했습니다: ' + error.message);
    } finally {
        setLoading(false);
    }
}

// 더 많은 결과 로드
async function loadMoreResults() {
    if (!state.hasMoreResults || state.loadingPage) return;
    
    state.loadingPage = true;
    elements.loadMoreButton.textContent = '로딩 중...';
    
    try {
        let url;
        
        if (state.searchType === 'keyword') {
            url = `${FIREBASE_FUNCTIONS.SEARCH_KEYWORD}?keyword=${encodeURIComponent(state.searchTerm)}&cursor=${state.nextCursor}`;
        } else {
            url = `${FIREBASE_FUNCTIONS.SEARCH_CATEGORY}?category=${encodeURIComponent(state.selectedMainCategory)}`;
            
            if (state.selectedItem && state.selectedItem.name) {
                url += `&itemName=${encodeURIComponent(state.selectedItem.name)}`;
            }
            
            url += `&cursor=${state.nextCursor}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('API 호출 실패: ' + response.status);
        }
        
        const data = await response.json();
        
        // 새 결과 추가
        const newItems = data.items || [];
        state.searchResults = [...state.searchResults, ...newItems];
        
        // 다음 페이지 정보 업데이트
        state.hasMoreResults = data.hasMore;
        state.nextCursor = data.nextCursor;
        
        // 결과 렌더링 (추가 모드)
        renderSearchResults(true);
        
        // 더 보기 버튼 표시 업데이트
        elements.loadMoreButton.style.display = state.hasMoreResults ? 'block' : 'none';
    } catch (error) {
        console.error('추가 데이터 로드 오류:', error);
        showError('추가 데이터 로드 중 오류가 발생했습니다.');
    } finally {
        state.loadingPage = false;
        elements.loadMoreButton.textContent = '더 보기';
    }
}

// 오류 메시지 표시
function showError(message) {
    // 간단한 오류 메시지 표시
    alert(message);
}

// 검색 결과 렌더링
function renderSearchResults(append = false) {
    if (!append) {
        elements.resultsBody.innerHTML = '';
    }
    
    if (state.searchResults.length === 0) {
        const tr = document.createElement('tr');
        tr.className = 'empty-result';
        tr.innerHTML = `<td colspan="4">검색 결과가 없습니다. 다른 키워드로 검색해보세요.</td>`;
        elements.resultsBody.appendChild(tr);
        return;
    }
    
    state.searchResults.forEach(item => {
        // 이미 표시된 아이템은 건너뛰기 (append 모드에서)
        if (append && document.querySelector(`.item-row[data-item-id="${item.auction_item_no}"]`)) {
            return;
        }
        
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
                    <div class="item-image">
                        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" alt="${item.item_name}">
                    </div>
                    <div class="item-name">${item.item_name}</div>
                </div>
            </td>
            <td>${category}${subCategory ? ' > ' + subCategory : ''}</td>
            <td>${level}</td>
            <td class="item-price">${item.auction_price_per_unit.toLocaleString()}G</td>
        `;
        
        // 아이템 클릭 이벤트 - 상세 정보 조회
        tr.addEventListener('click', () => {
            fetchItemDetail(item.auction_item_no);
        });
        
        elements.resultsBody.appendChild(tr);
    });
}

// 아이템 상세 정보 조회
async function fetchItemDetail(auctionItemNo) {
    setLoading(true);
    
    try {
        const url = `${FIREBASE_FUNCTIONS.ITEM_DETAIL}?auctionItemNo=${auctionItemNo}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('API 호출 실패: ' + response.status);
        }
        
        const data = await response.json();
        
        // 상세 정보 모달 표시
        showItemDetailModal(data);
    } catch (error) {
        console.error('아이템 상세 정보 조회 오류:', error);
        showError('아이템 상세 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
        setLoading(false);
    }
}

// 아이템 상세 정보 모달 표시
function showItemDetailModal(itemData) {
    // 모달 구현 (간단한 예시)
    alert(`아이템 상세 정보: ${itemData.item_name || '알 수 없음'}\n이 기능은 아직 구현 중입니다.`);
    console.log('아이템 상세 정보:', itemData);
    
    // TODO: 실제 모달 구현
}

// 메인 카테고리 렌더링
function renderMainCategories() {
    elements.mainCategoriesList.innerHTML = '';
    
    mainCategories.forEach(category => {
        const li = document.createElement('li');
        li.className = 'category-item';
        
        const button = document.createElement('button');
        button.className = `category-button ${state.selectedMainCategory === category.id ? 'active' : ''}`;
        button.textContent = category.name;
        button.addEventListener('click', () => handleMainCategoryClick(category));
        
        li.appendChild(button);
        
        // 확장된 카테고리인 경우 소분류 목록 추가
        if (state.expandedMainCategory === category.id) {
            const subList = document.createElement('ul');
            subList.className = 'subcategory-list expanded';
            
            const subCategories = getCategoriesByMainCategory(category.id);
            subCategories.forEach(subCategory => {
                const subLi = document.createElement('li');
                subLi.className = 'subcategory-item';
                
                const subButton = document.createElement('button');
                subButton.className = `subcategory-button ${state.selectedSubCategory === subCategory.id ? 'active' : ''}`;
                subButton.textContent = subCategory.name;
                subButton.addEventListener('click', () => handleSubCategoryClick(subCategory));
                
                subLi.appendChild(subButton);
                subList.appendChild(subLi);
            });
            
            li.appendChild(subList);
        }
        
        elements.mainCategoriesList.appendChild(li);
    });
}

// 메인 카테고리 클릭 처리
function handleMainCategoryClick(category) {
    // 이미 선택된 카테고리인 경우 토글
    if (state.expandedMainCategory === category.id) {
        state.expandedMainCategory = null;
    } else {
        state.expandedMainCategory = category.id;
        state.selectedMainCategory = category.id;
        state.selectedSubCategory = null;
        
        // 하위 카테고리가 선택되지 않았으므로 옵션 구조 초기화
        state.optionStructure = {};
        renderDetailOptions();
    }
    
    // 카테고리 UI 업데이트
    renderMainCategories();
}

// 소분류 클릭 처리
function handleSubCategoryClick(subCategory) {
    state.selectedSubCategory = subCategory.id;
    
    // 카테고리 UI 업데이트
    renderMainCategories();
    
    // 아이템 검색 (해당 카테고리의 아이템 불러오기)
    searchByCategory(state.selectedMainCategory, state.selectedSubCategory);
    
    // 아이템에 해당하는 옵션 구조 로드
    loadOptionStructure(subCategory.id);
}

// 카테고리 검색
function searchByCategory(mainCategory, subCategory) {
    if (!mainCategory) return;
    
    // 검색어 초기화
    state.searchTerm = '';
    elements.searchInput.value = '';
    state.selectedItem = null;
    
    // Firebase Function 호출
    state.searchType = 'category';
    searchWithCategoryAndItem(mainCategory);
}

// 카테고리 UI 업데이트
function updateCategoryUI() {
    // 카테고리 확장
    state.expandedMainCategory = state.selectedMainCategory;
    
    // 카테고리 UI 업데이트
    renderMainCategories();
}

// 옵션 구조 로드
function loadOptionStructure(subCategory) {
    if (!subCategory) {
        state.optionStructure = {};
        renderDetailOptions();
        return;
    }
    
    // 옵션 구조 데이터 로드
    fetch(`data/option_structure/${subCategory}.json`)
        .then(response => {
            if (!response.ok) {
                throw new Error('옵션 구조 파일을 찾을 수 없습니다.');
            }
            return response.json();
        })
        .then(data => {
            state.optionStructure = data.option_structure || {};
            renderDetailOptions();
        })
        .catch(error => {
            console.error('옵션 구조 로드 실패:', error);
            
            // 오류 발생 시 기본 옵션 구조 사용
            state.optionStructure = {
                "기본 옵션": {
                    "value": "text"
                }
            };
            
            renderDetailOptions();
        });
}

// 세부 옵션 렌더링
function renderDetailOptions() {
    elements.detailOptions.innerHTML = '';
    
    if (Object.keys(state.optionStructure).length === 0) {
        elements.detailOptions.innerHTML = `
            <div class="empty-options">
                카테고리를 선택하면 세부 옵션이 표시됩니다.
            </div>
        `;
        return;
    }
    
    // 옵션 구조에 따른 동적 필터 생성
    Object.entries(state.optionStructure).forEach(([optionName, optionInfo]) => {
        const div = document.createElement('div');
        div.className = 'filter-group';
        
        // 라벨
        const label = document.createElement('label');
        label.textContent = optionName;
        div.appendChild(label);
        
        // 옵션 타입에 따른 입력 UI 생성
        if (optionInfo.value === "number") {
            if (optionInfo.value2) {
                // 범위 입력 (min-max)
                const rangeDiv = document.createElement('div');
                rangeDiv.className = 'range-input';
                
                const minInput = document.createElement('input');
                minInput.type = 'number';
                minInput.name = `min_${optionName}`;
                minInput.placeholder = '최소';
                minInput.value = state.advancedFilters[`min_${optionName}`] || '';
                minInput.addEventListener('change', e => {
                    state.advancedFilters[`min_${optionName}`] = e.target.value;
                });
                
                const separator = document.createElement('span');
                separator.textContent = '~';
                
                const maxInput = document.createElement('input');
                maxInput.type = 'number';
                maxInput.name = `max_${optionName}`;
                maxInput.placeholder = '최대';
                maxInput.value = state.advancedFilters[`max_${optionName}`] || '';
                maxInput.addEventListener('change', e => {
                    state.advancedFilters[`max_${optionName}`] = e.target.value;
                });
                
                rangeDiv.appendChild(minInput);
                rangeDiv.appendChild(separator);
                rangeDiv.appendChild(maxInput);
                div.appendChild(rangeDiv);
            } else {
                // 단일 숫자 입력
                const input = document.createElement('input');
                input.type = 'number';
                input.name = optionName;
                input.value = state.advancedFilters[optionName] || '';
                input.addEventListener('change', e => {
                    state.advancedFilters[optionName] = e.target.value;
                });
                div.appendChild(input);
            }
        } 
        else if (optionInfo.value === "rgb") {
            // 색상 선택
            const colorDiv = document.createElement('div');
            colorDiv.className = 'color-option';
            
            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.name = optionName;
            colorInput.value = state.advancedFilters[optionName] || '#ffffff';
            colorInput.addEventListener('change', e => {
                state.advancedFilters[optionName] = e.target.value;
            });
            
            const colorText = document.createElement('span');
            colorText.textContent = '색상 선택';
            colorText.className = 'color-label';
            
            colorDiv.appendChild(colorInput);
            colorDiv.appendChild(colorText);
            div.appendChild(colorDiv);
        } 
        else if (optionInfo.value === "percentage") {
            // 백분율
            const percentDiv = document.createElement('div');
            percentDiv.className = 'percent-input';
            
            const input = document.createElement('input');
            input.type = 'number';
            input.name = optionName;
            input.min = '0';
            input.max = '100';
            input.value = state.advancedFilters[optionName] || '';
            input.addEventListener('change', e => {
                state.advancedFilters[optionName] = e.target.value;
            });
            
            const percentSign = document.createElement('span');
            percentSign.textContent = '%';
            
            percentDiv.appendChild(input);
            percentDiv.appendChild(percentSign);
            div.appendChild(percentDiv);
        } 
        else if (optionInfo.value === "text" || optionInfo.value === "rank") {
            // 텍스트 또는 랭크 선택
            if (optionInfo.sub_type === "text") {
                // 일반 텍스트 입력
                const input = document.createElement('input');
                input.type = 'text';
                input.name = optionName;
                input.value = state.advancedFilters[optionName] || '';
                input.addEventListener('change', e => {
                    state.advancedFilters[optionName] = e.target.value;
                });
                div.appendChild(input);
            } else {
                // 선택 옵션
                const select = document.createElement('select');
                select.name = optionName;
                select.value = state.advancedFilters[optionName] || '';
                select.addEventListener('change', e => {
                    state.advancedFilters[optionName] = e.target.value;
                });
                
                // 기본 옵션
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = '선택하세요';
                select.appendChild(defaultOption);
                
                // 옵션 추가 (실제 구현에서는 API에서 가져온 목록 사용)
                const options = ['option1', 'option2', 'option3'];
                options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    select.appendChild(option);
                });
                
                div.appendChild(select);
            }
        }
        
        elements.detailOptions.appendChild(div);
    });
}

// 세부 옵션 토글
function toggleDetailOptions() {
    state.showDetailOptions = !state.showDetailOptions;
    
    elements.detailOptions.classList.toggle('show', state.showDetailOptions);
    elements.toggleOptionsButton.textContent = state.showDetailOptions ? '접기' : '펼치기';
}

// 필터 적용
function applyFilters() {
    console.log('필터 적용:', state.advancedFilters);
    
    // 필터 적용 시 원래 결과에서 필터링 (서버에 재요청하지 않음)
    let filteredResults = [...state.searchResults];
    
    // 기본 필터 적용
    const minLevel = elements.minLevelInput.value;
    const maxLevel = elements.maxLevelInput.value;
    const itemType = elements.itemTypeSelect.value;
    
    // 로딩 중 상태로 변경
    setLoading(true);
    
    // 클라이언트 측 필터링 적용
    try {
        if (minLevel) {
            filteredResults = filteredResults.filter(item => {
                // 아이템 레벨 찾기
                if (item.item_option && item.item_option.length > 0) {
                    const levelOption = item.item_option.find(opt => 
                        opt.option_type === '레벨' || 
                        opt.option_type === '요구 레벨' || 
                        opt.option_type === '아이템 레벨'
                    );
                    if (levelOption && levelOption.option_value) {
                        return parseInt(levelOption.option_value) >= parseInt(minLevel);
                    }
                }
                // 레벨 정보가 없으면 false 반환
                return false;
            });
        }
        
        if (maxLevel) {
            filteredResults = filteredResults.filter(item => {
                // 아이템 레벨 찾기
                if (item.item_option && item.item_option.length > 0) {
                    const levelOption = item.item_option.find(opt => 
                        opt.option_type === '레벨' || 
                        opt.option_type === '요구 레벨' || 
                        opt.option_type === '아이템 레벨'
                    );
                    if (levelOption && levelOption.option_value) {
                        return parseInt(levelOption.option_value) <= parseInt(maxLevel);
                    }
                }
                // 레벨 정보가 없으면 false 반환
                return false;
            });
        }
        
        if (itemType && itemType !== 'all') {
            filteredResults = filteredResults.filter(item => {
                if (item.item_option && item.item_option.length > 0) {
                    const typeOption = item.item_option.find(opt => 
                        opt.option_type === '분류' || 
                        opt.option_type === '아이템 유형'
                    );
                    if (typeOption && typeOption.option_value) {
                        return typeOption.option_value.includes(itemType);
                    }
                }
                return false;
            });
        }
        
        // 고급 필터 적용
        // 실제 구현에서는 각 필터 타입에 맞게 처리
        for (const [key, value] of Object.entries(state.advancedFilters)) {
            if (!value) continue;
            
            if (key.startsWith('min_')) {
                const optionName = key.substring(4);
                filteredResults = filteredResults.filter(item => {
                    if (item.item_option && item.item_option.length > 0) {
                        const option = item.item_option.find(opt => opt.option_type === optionName);
                        if (option && option.option_value) {
                            return parseInt(option.option_value) >= parseInt(value);
                        }
                    }
                    return false;
                });
            } 
            else if (key.startsWith('max_')) {
                const optionName = key.substring(4);
                filteredResults = filteredResults.filter(item => {
                    if (item.item_option && item.item_option.length > 0) {
                        const option = item.item_option.find(opt => opt.option_type === optionName);
                        if (option && option.option_value) {
                            return parseInt(option.option_value) <= parseInt(value);
                        }
                    }
                    return false;
                });
            } 
            else {
                // 일반 옵션 필터
                filteredResults = filteredResults.filter(item => {
                    if (item.item_option && item.item_option.length > 0) {
                        const option = item.item_option.find(opt => opt.option_type === key);
                        if (option) {
                            if (typeof value === 'string' && value.startsWith('#')) {
                                // 색상 필터 (RGB 비교)
                                // 색상 구현은 복잡하므로 여기서는 간단히 처리
                                return true;
                            } else {
                                return option.option_value == value || 
                                       option.option_value.includes(value);
                            }
                        }
                    }
                    return false;
                });
            }
        }
        
        // 임시 저장 (원래 결과는 유지)
        const originalResults = state.searchResults;
        state.searchResults = filteredResults;
        
        // 결과 표시
        renderSearchResults();
        
        // 더 보기 버튼 숨기기 (필터링 결과에서는 더 보기 사용하지 않음)
        elements.loadMoreButton.style.display = 'none';
        
        // 필터 결과 개수 표시
        console.log(`필터링 결과: ${filteredResults.length}개 아이템 (원래: ${originalResults.length}개)`);
        
    } catch (error) {
        console.error('필터 적용 중 오류:', error);
        showError('필터를 적용하는 중 오류가 발생했습니다.');
    } finally {
        setLoading(false);
    }
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

// 스타일 추가: 로딩 스피너와 더 보기 버튼
const style = document.createElement('style');
style.textContent = `
    .loading-spinner {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    
    .spinner {
        width: 50px;
        height: 50px;
        border: 5px solid #f3f3f3;
        border-top: 5px solid #333;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .loading-spinner p {
        color: white;
        margin-top: 10px;
    }
    
    .load-more-button {
        display: block;
        width: 100%;
        padding: 10px;
        margin-top: 10px;
        background-color: var(--color-black);
        color: var(--color-yellow);
        border: none;
        border-radius: 4px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .load-more-button:hover {
        background-color: #222;
    }
    
    .item-row {
        cursor: pointer;
        transition: background-color 0.2s ease;
    }
    
    .item-row:hover {
        background-color: #f0f0f0;
    }
`;
document.head.appendChild(style);
