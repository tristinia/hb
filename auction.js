/**
 * 마비노기 경매장 JavaScript
 */

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
    showDetailOptions: false
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

// 마비노기 API 카테고리 목록 (src/category-manager.js 데이터)
const mainCategories = [
    { id: '근거리 장비', name: '근거리 장비' },
    { id: '원거리 장비', name: '원거리 장비' },
    { id: '마법 장비', name: '마법 장비' },
    { id: '갑옷', name: '갑옷' },
    { id: '방어 장비', name: '방어 장비' },
    { id: '액세서리', name: '액세서리' },
    { id: '특수 장비', name: '특수 장비' },
    { id: '설치물', name: '설치물' },
    { id: '인챈트 용품', name: '인챈트 용품' },
    { id: '스크롤', name: '스크롤' },
    { id: '마기그래피 용품', name: '마기그래피 용품' },
    { id: '서적', name: '서적' },
    { id: '소모품', name: '소모품' },
    { id: '토템', name: '토템' },
    { id: '생활 재료', name: '생활 재료' },
    { id: '기타', name: '기타' }
];

// 카테고리 데이터 (소분류)
const categories = [
    // 근거리 장비
    { id: '한손 장비', name: '한손 장비', mainCategory: '근거리 장비' },
    { id: '양손 장비', name: '양손 장비', mainCategory: '근거리 장비' },
    { id: '검', name: '검', mainCategory: '근거리 장비' },
    { id: '도끼', name: '도끼', mainCategory: '근거리 장비' },
    { id: '둔기', name: '둔기', mainCategory: '근거리 장비' },
    { id: '랜스', name: '랜스', mainCategory: '근거리 장비' },
    { id: '핸들', name: '핸들', mainCategory: '근거리 장비' },
    { id: '너클', name: '너클', mainCategory: '근거리 장비' },
    { id: '체인 블레이드', name: '체인 블레이드', mainCategory: '근거리 장비' },
    
    // 원거리 장비
    { id: '활', name: '활', mainCategory: '원거리 장비' },
    { id: '석궁', name: '석궁', mainCategory: '원거리 장비' },
    { id: '듀얼건', name: '듀얼건', mainCategory: '원거리 장비' },
    { id: '수리검', name: '수리검', mainCategory: '원거리 장비' },
    { id: '아틀라틀', name: '아틀라틀', mainCategory: '원거리 장비' },
    { id: '원거리 소모품', name: '원거리 소모품', mainCategory: '원거리 장비' },
    
    // 마법 장비
    { id: '실린더', name: '실린더', mainCategory: '마법 장비' },
    { id: '스태프', name: '스태프', mainCategory: '마법 장비' },
    { id: '원드', name: '원드', mainCategory: '마법 장비' },
    { id: '마도서', name: '마도서', mainCategory: '마법 장비' },
    { id: '오브', name: '오브', mainCategory: '마법 장비' },
    
    // 갑옷
    { id: '중갑옷', name: '중갑옷', mainCategory: '갑옷' },
    { id: '경갑옷', name: '경갑옷', mainCategory: '갑옷' },
    { id: '천옷', name: '천옷', mainCategory: '갑옷' },
    
    // 방어 장비
    { id: '장갑', name: '장갑', mainCategory: '방어 장비' },
    { id: '신발', name: '신발', mainCategory: '방어 장비' },
    { id: '모자/가발', name: '모자/가발', mainCategory: '방어 장비' },
    { id: '방패', name: '방패', mainCategory: '방어 장비' },
    { id: '로브', name: '로브', mainCategory: '방어 장비' },
    
    // 액세서리
    { id: '얼굴 장식', name: '얼굴 장식', mainCategory: '액세서리' },
    { id: '액세서리', name: '액세서리', mainCategory: '액세서리' },
    { id: '날개', name: '날개', mainCategory: '액세서리' },
    { id: '꼬리', name: '꼬리', mainCategory: '액세서리' },
    
    // 특수 장비
    { id: '악기', name: '악기', mainCategory: '특수 장비' },
    { id: '생활 도구', name: '생활 도구', mainCategory: '특수 장비' },
    { id: '마리오네트', name: '마리오네트', mainCategory: '특수 장비' },
    { id: '에코스톤', name: '에코스톤', mainCategory: '특수 장비' },
    { id: '에이도스', name: '에이도스', mainCategory: '특수 장비' },
    { id: '유물', name: '유물', mainCategory: '특수 장비' },
    { id: '기타 장비', name: '기타 장비', mainCategory: '특수 장비' },
    
    // 설치물
    { id: '의자/사물', name: '의자/사물', mainCategory: '설치물' },
    { id: '낭만농장/달빛섬', name: '낭만농장/달빛섬', mainCategory: '설치물' },
    
    // 인챈트 용품
    { id: '인챈트 스크롤', name: '인챈트 스크롤', mainCategory: '인챈트 용품' },
    { id: '마법가루', name: '마법가루', mainCategory: '인챈트 용품' },
    
    // 스크롤
    { id: '도면', name: '도면', mainCategory: '스크롤' },
    { id: '옷본', name: '옷본', mainCategory: '스크롤' },
    { id: '마족 스크롤', name: '마족 스크롤', mainCategory: '스크롤' },
    { id: '기타 스크롤', name: '기타 스크롤', mainCategory: '스크롤' },
    
    // 마기그래피 용품
    { id: '마기그래프', name: '마기그래프', mainCategory: '마기그래피 용품' },
    { id: '마기그래프 도안', name: '마기그래프 도안', mainCategory: '마기그래피 용품' },
    { id: '기타 재료', name: '기타 재료', mainCategory: '마기그래피 용품' },
    
    // 서적
    { id: '책', name: '책', mainCategory: '서적' },
    { id: '마비노벨', name: '마비노벨', mainCategory: '서적' },
    { id: '페이지', name: '페이지', mainCategory: '서적' },
    
    // 소모품
    { id: '포션', name: '포션', mainCategory: '소모품' },
    { id: '음식', name: '음식', mainCategory: '소모품' },
    { id: '허브', name: '허브', mainCategory: '소모품' },
    { id: '던전 통행증', name: '던전 통행증', mainCategory: '소모품' },
    { id: '알반 훈련석', name: '알반 훈련석', mainCategory: '소모품' },
    { id: '개조석', name: '개조석', mainCategory: '소모품' },
    { id: '보석', name: '보석', mainCategory: '소모품' },
    { id: '변신 메달', name: '변신 메달', mainCategory: '소모품' },
    { id: '염색 앰플', name: '염색 앰플', mainCategory: '소모품' },
    { id: '스케치', name: '스케치', mainCategory: '소모품' },
    { id: '핀즈비즈', name: '핀즈비즈', mainCategory: '소모품' },
    { id: '기타 소모품', name: '기타 소모품', mainCategory: '소모품' },
    
    // 토템
    { id: '토템', name: '토템', mainCategory: '토템' },
    
    // 생활 재료
    { id: '주머니', name: '주머니', mainCategory: '생활 재료' },
    { id: '천옷/방직', name: '천옷/방직', mainCategory: '생활 재료' },
    { id: '제련/블랙스미스', name: '제련/블랙스미스', mainCategory: '생활 재료' },
    { id: '힐웬 공학', name: '힐웬 공학', mainCategory: '생활 재료' },
    { id: '매직 크래프트', name: '매직 크래프트', mainCategory: '생활 재료' },
    
    // 기타
    { id: '제스처', name: '제스처', mainCategory: '기타' },
    { id: '말풍선 스티커', name: '말풍선 스티커', mainCategory: '기타' },
    { id: '피니 펫', name: '피니 펫', mainCategory: '기타' },
    { id: '불타래', name: '불타래', mainCategory: '기타' },
    { id: '퍼퓸', name: '퍼퓸', mainCategory: '기타' },
    { id: '분양 메달', name: '분양 메달', mainCategory: '기타' },
    { id: '뷰티 쿠폰', name: '뷰티 쿠폰', mainCategory: '기타' },
    { id: '기타', name: '기타', mainCategory: '기타' }
];

// 더미 아이템 데이터 (실제 구현 시 API에서 받아옴)
const dummyItems = [
    { id: 1, name: '워로드의 갑옷', category: '갑옷', subcategory: '중갑옷', meta: { level: 50, type: '방어구' } },
    { id: 2, name: '워로드의 투구', category: '방어 장비', subcategory: '모자/가발', meta: { level: 45, type: '방어구' } },
    { id: 3, name: '워로드의 검', category: '근거리 장비', subcategory: '검', meta: { level: 48, type: '무기' } },
    { id: 4, name: '워로드의 망토', category: '방어 장비', subcategory: '로브', meta: { level: 40, type: '방어구' } },
    { id: 5, name: '대형 힐링 포션', category: '소모품', subcategory: '포션', meta: { type: '소비품' } },
    { id: 6, name: '중형 마나 포션', category: '소모품', subcategory: '포션', meta: { type: '소비품' } },
    { id: 7, name: '골드 링', category: '액세서리', subcategory: '액세서리', meta: { level: 35, type: '장신구' } },
    { id: 8, name: '실버 이어링', category: '액세서리', subcategory: '액세서리', meta: { level: 30, type: '장신구' } },
    { id: 9, name: '마법사의 지팡이', category: '마법 장비', subcategory: '스태프', meta: { level: 55, type: '무기' } },
    { id: 10, name: '레인저의 활', category: '원거리 장비', subcategory: '활', meta: { level: 52, type: '무기' } },
];

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
    
    // 카테고리 초기화
    renderMainCategories();
    
    // 이벤트 리스너 등록
    setupEventListeners();
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
    
    return dummyItems.filter(item => {
        // 일반 검색
        if (item.name.toLowerCase().includes(normalizedTerm)) {
            return true;
        }
        
        // 초성 검색
        if (getChosung(item.name.toLowerCase()).includes(chosungTerm)) {
            return true;
        }
        
        // 분해된 한글 검색
        if (decomposeHangul(item.name.toLowerCase()).includes(normalizedTerm)) {
            return true;
        }
        
        // 영->한 오타 수정 검색
        if (koreanFromEng && item.name.toLowerCase().includes(koreanFromEng)) {
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

// 검색 실행
function handleSearch() {
    // 자동완성을 통해 선택한 아이템이 있는 경우
    if (state.selectedItem) {
        console.log('자동완성 아이템으로 검색:', state.selectedItem);
        searchWithItem(state.selectedItem);
    }
    // 키워드 검색
    else {
        console.log('키워드로 검색:', state.searchTerm);
        searchWithKeyword(state.searchTerm);
    }
    
    // 자동완성 닫기
    clearSuggestions();
}

// 아이템으로 검색
function searchWithItem(item) {
    // 실제 구현에서는 해당 아이템의 상세 정보 API 호출
    state.searchResults = [item];
    renderSearchResults();
}

// 키워드로 검색
function searchWithKeyword(keyword) {
    if (!keyword) return;
    
    // 실제 구현에서는 API 호출
    // 더미 데이터로 대체
    const results = dummyItems.filter(item => 
        item.name.toLowerCase().includes(keyword.toLowerCase())
    );
    
    state.searchResults = results;
    renderSearchResults();
}

// 검색 결과 렌더링
function renderSearchResults() {
    elements.resultsBody.innerHTML = '';
    
    if (state.searchResults.length === 0) {
        const tr = document.createElement('tr');
        tr.className = 'empty-result';
        tr.innerHTML = `<td colspan="4">검색 결과가 없습니다. 다른 키워드로 검색해보세요.</td>`;
        elements.resultsBody.appendChild(tr);
        return;
    }
    
    state.searchResults.forEach(item => {
        const tr = document.createElement('tr');
        
        // 랜덤 가격 생성 (실제 구현에서는 API에서 가져옴)
        const price = Math.floor(Math.random() * 100000);
        
        tr.innerHTML = `
            <td>
                <div class="item-cell">
                    <div class="item-image">이미지</div>
                    <div class="item-name">${item.name}</div>
                </div>
            </td>
            <td>${item.category} > ${item.subcategory}</td>
            <td>${item.meta.level || '-'}</td>
            <td class="item-price">${price.toLocaleString()}G</td>
        `;
        
        elements.resultsBody.appendChild(tr);
    });
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

// 카테고리 UI 업데이트
function updateCategoryUI() {
    // 카테고리 확장
    state.expandedMainCategory = state.selectedMainCategory;
    
    // 카테고리 UI 업데이트
    renderMainCategories();
}

// 카테고리로 검색
function searchByCategory(mainCategory, subCategory) {
    // 실제 구현에서는 API 호출
    // 더미 데이터로 대체
    const results = dummyItems.filter(item => 
        (!mainCategory || item.category === mainCategory) && 
        (!subCategory || item.subcategory === subCategory)
    );
    
    state.searchResults = results;
    renderSearchResults();
}

// 옵션 구조 로드
function loadOptionStructure(subCategory) {
    if (!subCategory) {
        state.optionStructure = {};
        renderDetailOptions();
        return;
    }
    
    // 실제 구현에서는 fetch API로 JSON 파일 로드
    // 더미 데이터로 대체
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
            
            // 오류 발생 시 기본 옵션 구조 사용 (예시)
            if (subCategory === '검') {
                state.optionStructure = {
                    "공격": {
                        "value": "number",
                        "value2": "number"
                    },
                    "크리티컬": {
                        "value": "percentage"
                    },
                    "숙련": {
                        "value": "number"
                    },
                    "내구력": {
                        "value": "number",
                        "value2": "number"
                    },
                    "아이템 색상": {
                        "sub_type": "text",
                        "value": "rgb",
                        "desc": "text"
                    }
                };
            } else if (subCategory === '포션') {
                state.optionStructure = {
                    "남은 거래 횟수": {
                        "value": "number"
                    },
                    "품질": {
                        "value": "number"
                    },
                    "색상": {
                        "value": "rgb"
                    }
                };
            } else {
                state.optionStructure = {};
            }
            
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
    
    // 이전 검색 결과나 카테고리별 아이템 리스트에 필터 적용
    let filteredResults = [...dummyItems];
    
    // 카테고리 필터
    if (state.selectedMainCategory) {
        filteredResults = filteredResults.filter(item => item.category === state.selectedMainCategory);
    }
    
    // 서브카테고리 필터
    if (state.selectedSubCategory) {
        filteredResults = filteredResults.filter(item => item.subcategory === state.selectedSubCategory);
    }
    
    // 기본 필터 적용
    const minLevel = elements.minLevelInput.value;
    const maxLevel = elements.maxLevelInput.value;
    const itemType = elements.itemTypeSelect.value;
    
    if (minLevel) {
        filteredResults = filteredResults.filter(item => 
            item.meta && item.meta.level && item.meta.level >= parseInt(minLevel)
        );
    }
    
    if (maxLevel) {
        filteredResults = filteredResults.filter(item => 
            item.meta && item.meta.level && item.meta.level <= parseInt(maxLevel)
        );
    }
    
    if (itemType && itemType !== 'all') {
        filteredResults = filteredResults.filter(item => 
            item.meta && item.meta.type === itemType
        );
    }
    
    // 고급 필터 적용
    // 실제 구현에서는 각 필터 타입에 맞게 처리
    
    // 결과 업데이트
    state.searchResults = filteredResults;
    renderSearchResults();
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
