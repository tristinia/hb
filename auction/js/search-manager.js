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
        isSuggestionVisible: false
    };
    
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
     * 자동완성 데이터 로드
     */
    function loadAutocompleteData() {
        console.log('데이터베이스에서 자동완성 데이터 로드 중...');
        fetch('../data/database/items.json')
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
        const chosungTerm = Utils.getChosung(normalizedTerm);
        
        // 영->한 오타 수정 시도
        const koreanFromEng = Utils.engToKor(normalizedTerm);
        
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
        
        // 검색 정확도 점수 계산 함수 - 개선된 버전
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
                
                // 길이가 비슷할수록 더 관련성이 높음
                const lengthDiff = Math.abs(itemName.length - normalizedTerm.length);
                if (lengthDiff <= 3) {
                    score += 15;
                }
            }
            // 정확한 단어 포함 (공백으로 구분)
            else if (itemName.includes(` ${normalizedTerm} `) || 
                    itemName.startsWith(`${normalizedTerm} `) || 
                    itemName.endsWith(` ${normalizedTerm}`)) {
                score += 70;
            }
            // 단어 중간에 포함되면 중간 점수
            else if (itemName.includes(normalizedTerm)) {
                score += 60;
                
                // 정확한 매칭에 더 높은 가중치 부여
                if (normalizedTerm.length > 2) {
                    score += 10; // 정확한 부분 문자열 매칭에 보너스 점수
                }
            }
            // 초성이 일치하면 낮은 점수
            else if (Utils.getChosung(itemName).includes(chosungTerm)) {
                // 2글자 이상 초성 매칭 시 더 높은 점수
                score += (chosungTerm.length >= 2) ? 30 : 20;
            }
            // 영한 변환 결과가 포함되면 매우 낮은 점수
            else if (koreanFromEng && itemName.includes(koreanFromEng)) {
                score += 15;
            }
            else {
                // 일치하는 부분이 없으면 후보에서 제외
                return 0;
            }
            
            // 아이템 이름이 짧을수록 더 관련성이 높을 가능성이 있음
            score += Math.max(0, 20 - itemName.length);
            
            // 유사도 보너스 점수 (레벤슈타인 거리 기반)
            const similarity = Utils.similarityScore(normalizedTerm, itemName);
            score += similarity * 30;
            
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
            if (item.category || item.mainCategory) {
                const mainCategory = item.mainCategory || CategoryManager.findMainCategoryForSubCategory(item.category) || '';
                
                // 메인 카테고리 이름 찾기
                let mainCategoryName = mainCategory;
                const mainCategoryObj = CategoryManager.getSelectedCategories().mainCategories?.find(cat => cat.id === mainCategory);
                if (mainCategoryObj) {
                    mainCategoryName = mainCategoryObj.name;
                }
                
                // 서브 카테고리 이름 찾기
                const subCategory = item.subCategory || item.category || '';
                let subCategoryName = subCategory;
                const subCategoryObj = CategoryManager.getSelectedCategories().subCategories?.find(cat => cat.id === subCategory);
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
        
        // 자동완성 닫기
        clearSuggestions();
        
        // 선택된 아이템 정보를 이벤트로 알림
        const event = new CustomEvent('itemSelected', {
            detail: {
                item: state.selectedItem
            }
        });
        document.dispatchEvent(event);
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
