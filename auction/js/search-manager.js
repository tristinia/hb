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
        
        // 여러 경로 시도 (경로 변경 대응)
        const paths = [
            '../data/database/items.json',
            '/data/database/items.json',
            'data/database/items.json'
        ];
        
        // 첫 번째 경로 시도
        tryLoadPath(0);
        
        // 경로 순차적으로 시도하는 함수
        function tryLoadPath(index) {
            if (index >= paths.length) {
                console.error('모든 경로에서 자동완성 데이터 로드 실패');
                checkLocalStorage();
                return;
            }
            
            fetch(paths[index])
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`경로 ${paths[index]} 로드 실패: ${response.status}`);
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
                    console.error(`경로 ${paths[index]} 시도 중 오류:`, error);
                    // 다음 경로 시도
                    tryLoadPath(index + 1);
                });
        }
        
        // 로컬 스토리지 확인
        function checkLocalStorage() {
            const cachedData = localStorage.getItem('auctionAutocompleteData');
            if (!cachedData) {
                console.warn('캐시된 자동완성 데이터가 없습니다. 기능이 제한될 수 있습니다.');
            } else {
                console.log('캐시된 자동완성 데이터를 사용합니다.');
            }
        }
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
        
        // 검색어가 너무 짧으면 초성 검색 비활성화
        const chosungTerm = normalizedTerm.length >= 2 ? Utils.getChosung(normalizedTerm) : '';
        
        // 영->한 오타 수정 시도 (마찬가지로 최소 길이 조건 추가)
        const koreanFromEng = normalizedTerm.length >= 2 ? Utils.engToKor(normalizedTerm) : '';
        
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
        
        // 점수 계산 및 필터링
        const scoredItems = autocompleteItems
            .map(item => ({
                item,
                score: calculateScore(item, normalizedTerm, chosungTerm, koreanFromEng)
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
    function calculateScore(item, normalizedTerm, chosungTerm, koreanFromEng) {
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
        
        // 아래 초성 및 영한 변환 매칭은 최소 검색어 길이 조건 추가 (1글자 검색은 제외)
        if (normalizedTerm.length >= 2) {
            // 초성이 일치하면 낮은 점수 (점수 하향 조정)
            const chosungMatch = Utils.getChosung(itemName).includes(chosungTerm);
            if (chosungMatch) {
                // 초성 매칭 점수 대폭 하향 조정 
                // (최소 10, 최대 15 - 이전 최대 30에서 절반으로 줄임)
                score += Math.min(10 + (chosungTerm.length * 2.5), 15);
            }
            
            // 영한 변환 결과가 포함되면 매우 낮은 점수
            if (koreanFromEng && itemName.includes(koreanFromEng)) {
                score += 10; // 이전 15에서 10으로 감소
            }
        }
        
        // 검색 결과 관련성이 특정 임계값 이하면 제외 (최소 점수 기준 추가)
        if (score < 20) {
            return 0;  // 점수가 너무 낮으면 자동완성 제안에서 제외
        }
        
        // 아이템 이름이 짧을수록 더 관련성이 높을 가능성이 있음
        score += Math.max(0, 15 - itemName.length); // 20에서 15로 감소
        
        // 유사도 보너스 점수 (레벤슈타인 거리 기반) - 가중치 감소
        const similarity = Utils.similarityScore(normalizedTerm, itemName);
        score += similarity * 20; // 30에서 20으로 가중치 감소
        
        return score;
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
                const categories = CategoryManager.getSelectedCategories();
                const mainCategoryObj = categories.mainCategories?.find(cat => cat.id === mainCategory);
                if (mainCategoryObj) {
                    mainCategoryName = mainCategoryObj.name;
                }
                
                // 서브 카테고리 이름 찾기
                const subCategory = item.subCategory || item.category || '';
                let subCategoryName = subCategory;
                const subCategoryObj = categories.subCategories?.find(cat => cat.id === subCategory);
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
