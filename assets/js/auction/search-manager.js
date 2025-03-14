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
        loadedCategories: new Set(),  // 이미 로드한 카테고리 추적
        isInitialized: false // 초기화 상태 추적
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

        // 로딩 상태 표시
        if (elements.searchInput) {
            elements.searchInput.placeholder = "데이터 로딩 중...";
        }
        
        // 이벤트 리스너 설정
        setupEventListeners();
        
        // 자동완성 데이터 로드 (초기화 완료 후)
        waitForInitialization().then(() => {
            loadAutocompleteData();
        });
    }
    
    /**
     * CategoryManager 초기화 대기 (최적화)
     */
    function waitForInitialization() {
        return new Promise((resolve) => {
            // 이미 초기화되었는지 확인
            if (typeof CategoryManager !== 'undefined' && 
                CategoryManager.getSelectedCategories && 
                typeof CategoryManager.getSelectedCategories === 'function') {
                
                // 카테고리 데이터가 있는지 확인
                const { subCategories } = CategoryManager.getSelectedCategories();
                if (subCategories && subCategories.length > 0) {
                    resolve();
                    return;
                }
            }
            
            console.log('CategoryManager 초기화 대기 중...');
            
            // 1초마다 최대 10초 동안 확인
            let attempts = 0;
            const maxAttempts = 10;
            
            const checkInterval = setInterval(() => {
                attempts++;
                
                // CategoryManager 존재 확인
                if (typeof CategoryManager !== 'undefined' && 
                    CategoryManager.getSelectedCategories && 
                    typeof CategoryManager.getSelectedCategories === 'function') {
                    
                    // 카테고리 데이터 확인
                    const { subCategories } = CategoryManager.getSelectedCategories();
                    if (subCategories && subCategories.length > 0) {
                        clearInterval(checkInterval);
                        console.log('CategoryManager 초기화 완료');
                        resolve();
                        return;
                    }
                }
                
                // 최대 시도 횟수 초과
                if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    console.warn('CategoryManager 초기화 타임아웃. 기본 모드로 진행');
                    resolve(); // 실패해도 진행
                }
            }, 1000);
        });
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
     * 여러 카테고리에서 자동완성 데이터 로드 (성능 개선)
     */
    async function loadAutocompleteData() {
        console.log('자동완성 데이터 로드 시작...');
        
        try {
            // 이미 로드되었으면 스킵
            if (autocompleteData.length > 0) {
                console.log(`이미 자동완성 데이터가 로드됨: ${autocompleteData.length}개 항목`);
                
                // 검색 입력창 활성화
                if (elements.searchInput) {
                    elements.searchInput.placeholder = "아이템 이름을 입력하세요...";
                }
                
                return;
            }
            
            // 로컬 스토리지에서 캐시된 데이터 확인
            try {
                const cachedData = localStorage.getItem('autocompleteData');
                const cachedTimestamp = localStorage.getItem('autocompleteDataTimestamp');
                const cachedVersion = localStorage.getItem('autocompleteDataVersion') || '1.0';
                
                // 캐시가 24시간 이내에 생성된 경우 사용 (버전도 확인)
                const now = new Date().getTime();
                const CACHE_VERSION = '1.1'; // 데이터 형식이 변경될 때마다 버전 업데이트
                
                if (cachedData && cachedTimestamp && 
                    (now - parseInt(cachedTimestamp) < 24 * 60 * 60 * 1000) &&
                    cachedVersion === CACHE_VERSION) {
                    console.log('캐시된 자동완성 데이터 로드 중...');
                    
                    // 비동기로 데이터 파싱 (대용량 JSON 파싱이 메인 스레드 블로킹 방지)
                    setTimeout(() => {
                        try {
                            const parsedData = JSON.parse(cachedData);
                            if (Array.isArray(parsedData) && parsedData.length > 0) {
                                autocompleteData.push(...parsedData);
                                console.log(`캐시에서 자동완성 데이터 로드 완료: ${autocompleteData.length}개 항목`);
                                
                                // 검색 입력창 활성화
                                if (elements.searchInput) {
                                    elements.searchInput.placeholder = "아이템 이름을 입력하세요...";
                                }
                            } else {
                                // 캐시 데이터 이상 - 새로 로드
                                localStorage.removeItem('autocompleteData');
                                localStorage.removeItem('autocompleteDataTimestamp');
                                localStorage.removeItem('autocompleteDataVersion');
                                loadFromCategories();
                            }
                        } catch (parseError) {
                            console.warn('캐시 데이터 파싱 실패:', parseError);
                            localStorage.removeItem('autocompleteData');
                            localStorage.removeItem('autocompleteDataTimestamp');
                            localStorage.removeItem('autocompleteDataVersion');
                            loadFromCategories();
                        }
                    }, 0);
                    
                    return;
                } else {
                    console.log('캐시 만료 또는 버전 불일치. 새로운 데이터 로드 중...');
                }
            } catch (cacheError) {
                console.warn('캐시 로드 실패, 데이터를 새로 로드합니다:', cacheError);
            }
            
            // 카테고리에서 데이터 로드 (캐시가 없거나 만료된 경우)
            loadFromCategories();
            
        } catch (error) {
            console.error('자동완성 데이터 로드 중 오류:', error);
            
            // 오류 시에도 검색 입력창 활성화
            if (elements.searchInput) {
                elements.searchInput.placeholder = "아이템 이름을 입력하세요...";
            }
        }
    }

    /**
     * 카테고리에서 자동완성 데이터 로드 (최적화)
     */
    async function loadFromCategories() {
        try {
            // 카테고리 정보 가져오기 (초기화 대기)
            await waitForCategoryManager();
            const { subCategories } = CategoryManager.getSelectedCategories();
            
            if (!subCategories || subCategories.length === 0) {
                console.warn('카테고리 정보가 로드되지 않았습니다.');
                
                // 검색 입력창 활성화
                if (elements.searchInput) {
                    elements.searchInput.placeholder = "아이템 이름을 입력하세요...";
                }
                
                return;
            }
            
            // 로딩 상태 표시
            if (elements.searchInput) {
                elements.searchInput.placeholder = "데이터 로드 중... (0%)";
            }
            
            // 작업자 풀 설정 - 카테고리 병렬 로드
            const CONCURRENT_REQUESTS = 5; // 동시에 처리할 요청 수
            let completedCategories = 0;
            const totalCategories = subCategories.length;
            
            // 데이터 로드 진행률 업데이트 함수
            const updateProgress = () => {
                completedCategories++;
                const percent = Math.round((completedCategories / totalCategories) * 100);
                
                if (elements.searchInput) {
                    elements.searchInput.placeholder = `데이터 로드 중... (${percent}%)`;
                }
                
                // 25%, 50%, 75% 및 100%에서 중간 캐시 저장
                if (percent === 25 || percent === 50 || percent === 75 || percent === 100) {
                    saveCacheSnapshot(percent);
                }
            };
            
            // 중간 캐시 저장
            const saveCacheSnapshot = (percent) => {
                if (autocompleteData.length > 0) {
                    try {
                        const now = new Date().getTime();
                        localStorage.setItem('autocompleteData', JSON.stringify(autocompleteData));
                        localStorage.setItem('autocompleteDataTimestamp', now.toString());
                        localStorage.setItem('autocompleteDataVersion', '1.1');
                        console.log(`${percent}% 진행 시점 캐시 저장: ${autocompleteData.length}개 항목`);
                    } catch (error) {
                        console.warn(`${percent}% 진행 시점 캐시 저장 실패:`, error);
                    }
                }
            };
            
            // 로드 프로세스 시작
            console.log(`${totalCategories}개 카테고리 로드 시작`);
            
            // 작업자 풀 구현 (동시 요청 제한)
            const processCategoryBatch = async (categories) => {
                // 배치 내에서는 병렬 처리
                await Promise.all(categories.map(category => 
                    loadCategoryItems(category)
                        .then(() => updateProgress())
                        .catch(error => {
                            console.error(`카테고리 ${category.id} 로드 실패:`, error);
                            updateProgress(); // 실패해도 진행률 업데이트
                        })
                ));
            };
            
            // 카테고리를 배치로 나누기
            const batches = [];
            for (let i = 0; i < totalCategories; i += CONCURRENT_REQUESTS) {
                batches.push(subCategories.slice(i, i + CONCURRENT_REQUESTS));
            }
            
            // 배치 순차 처리 (각 배치 내 병렬 처리)
            for (const batch of batches) {
                await processCategoryBatch(batch);
                
                // UI 렌더링을 위한 작은 지연
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            // 모든 카테고리 로드 완료
            console.log(`모든 카테고리 로드 완료: 총 ${autocompleteData.length}개 항목`);
            
            // 최종 캐시 업데이트
            try {
                const now = new Date().getTime();
                localStorage.setItem('autocompleteData', JSON.stringify(autocompleteData));
                localStorage.setItem('autocompleteDataTimestamp', now.toString());
                localStorage.setItem('autocompleteDataVersion', '1.1');
                console.log(`최종 자동완성 데이터 캐싱 완료: ${autocompleteData.length}개 항목`);
            } catch (error) {
                console.warn('최종 자동완성 데이터 캐싱 실패:', error);
            }
            
            // 검색 입력창 활성화
            if (elements.searchInput) {
                elements.searchInput.placeholder = "아이템 이름을 입력하세요...";
            }
            
        } catch (error) {
            console.error('카테고리 로드 중 오류:', error);
            
            // 오류 시에도 검색 입력창 활성화
            if (elements.searchInput) {
                elements.searchInput.placeholder = "아이템 이름을 입력하세요...";
            }
        }
    }
    
    /**
     * CategoryManager 초기화 대기
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
     * 단일 카테고리 아이템 로드 (성능 개선)
     */
    async function loadCategoryItems(category) {
        if (state.loadedCategories.has(category.id)) return;
        
        try {
            // 카테고리 ID 안전하게 변환
            const safeCategoryId = sanitizeFileName(category.id);
            
            // 동적 로딩 경로
            const paths = [
                `../../data/items/${safeCategoryId}.json`,
                `../../data/items/${safeCategoryId}.json`,
                `../../data/items/${safeCategoryId}.json`,
                `../../data/items/${safeCategoryId}.json`
            ];
            
            // AbortController로 타임아웃 처리
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃
            
            // 모든 경로 병렬 시도 (Race)
            const fetchPromises = paths.map(path => 
                fetch(path, { signal: controller.signal })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`${path} 경로 실패: ${response.status}`);
                        }
                        return { response, path };
                    })
                    .catch(error => {
                        if (error.name === 'AbortError') {
                            throw new Error('요청 타임아웃');
                        }
                        return { error, path }; // 오류를 반환하되 중단하지 않음
                    })
            );
            
            // 첫 번째 성공한 응답 사용
            const results = await Promise.all(fetchPromises);
            clearTimeout(timeoutId);
            
            // 성공한 응답 찾기
            const successResult = results.find(result => result.response && result.response.ok);
            
            if (!successResult) {
                // 모든 경로 실패 - 오류 로그
                console.warn(`카테고리 ${category.id}의 파일을 찾을 수 없습니다. 시도한 경로:`, 
                    paths.join(', '));
                state.loadedCategories.add(category.id); // 실패 기록
                return;
            }
            
            // 성공한 경로 로그
            console.log(`카테고리 ${category.id} 로드 경로: ${successResult.path}`);
            
            // JSON 파싱
            const data = await successResult.response.json();
            const items = data.items || [];
            
            // 메모리 최적화: 필요한 필드만 추출
            items.forEach(item => {
                if (item.name) {
                    autocompleteData.push({
                        name: item.name,
                        price: item.price || 0,
                        date: item.date || '',
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
            state.loadedCategories.add(category.id); // 오류 발생해도 다시 시도하지 않음
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
     * 검색어 기반 자동완성 추천 생성 (최적화)
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
        
        // 2단계 검색 알고리즘: 1차 필터링 후 세부 점수 계산
        // 1차 필터링: 기본 점수 계산 (빠른 검색)
        const firstPassItems = [];
        
        for (const item of autocompleteData) {
            if (!item.name) continue;
            
            const itemName = item.name.toLowerCase();
            let score = 0;
            
            // 빠른 점수 계산 (정확한 일치, 접두사 일치, 포함 여부)
            if (itemName === normalizedTerm) {
                score = 100; // 정확히 일치
            } else if (itemName.startsWith(normalizedTerm)) {
                score = 80; // 시작 부분 일치
            } else if (itemName.includes(` ${normalizedTerm} `) || 
                       itemName.startsWith(`${normalizedTerm} `) || 
                       itemName.endsWith(` ${normalizedTerm}`)) {
                score = 70; // 정확한 단어 일치
            } else if (itemName.includes(normalizedTerm)) {
                score = 60; // 부분 문자열 포함
            } else if (isChosungOnly && chosungTerm.length >= 2) {
                // 초성 검색 (비용이 높은 연산이므로 나중에 실행)
                const itemChosung = Utils.getChosung(itemName);
                if (itemChosung.startsWith(chosungTerm)) {
                    score = 50; // 초성이 일치하는 경우
                } else if (itemChosung.includes(chosungTerm)) {
                    score = 40; // 초성이 포함된 경우
                }
            } else if (koreanFromEng && itemName.includes(koreanFromEng)) {
                score = 40; // 영한 변환 결과가 포함된 경우
            }
            
            if (score > 0) {
                firstPassItems.push({ item, score, itemName });
            }
        }
        
        // 기본 점수가 있는 항목만 정렬하여 상위 50개 선택
        const candidates = firstPassItems
            .sort((a, b) => b.score - a.score)
            .slice(0, 50);
        
        // 2차 필터링: 상세 점수 계산 (정밀 검색)
        const scoredItems = candidates.map(entry => {
            // 상위 점수 항목은 그대로 유지
            if (entry.score >= 80) return entry;
            
            let finalScore = entry.score;
            
            // 이름 길이에 따른 보너스 (짧을수록 유리)
            finalScore += Math.max(0, 15 - entry.itemName.length);
            
            // 비용이 높은 유사도 계산은 필요한 경우만
            if (entry.score < 70) {
                const similarity = Utils.similarityScore(normalizedTerm, entry.itemName);
                finalScore += similarity * 20;
            }
            
            return { ...entry, score: finalScore };
        })
        .filter(entry => entry.score >= 20) // 최소 점수 기준
        .sort((a, b) => b.score - a.score) // 다시 정렬
        .slice(0, 10) // 최대 10개만
        .map(entry => entry.item);
        
        return scoredItems;
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
     * 자동완성 렌더링 (최적화)
     */
    function renderSuggestions() {
        // 기존 추천 초기화
        elements.suggestionsList.innerHTML = '';
        
        // 추천 목록이 없으면 숨김
        if (state.suggestions.length === 0) {
            elements.suggestionsList.classList.remove('show');
            state.isSuggestionVisible = false;
            return;
        }
        
        // DocumentFragment 사용하여 DOM 조작 최소화
        const fragment = document.createDocumentFragment();
        
        // 추천 목록 표시
        state.suggestions.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = `suggestion-item ${index === state.activeSuggestion ? 'active' : ''}`;
            
            // 아이템 카테고리 정보 표시
            let categoryInfo = '';
            if (item.mainCategory || item.subCategory) {
                // CategoryManager 안전 확인
                if (typeof CategoryManager !== 'undefined' && 
                    CategoryManager.getSelectedCategories && 
                    typeof CategoryManager.getSelectedCategories === 'function') {
                    
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
                } else {
                    // 기본 카테고리 정보
                    categoryInfo = `<div class="suggestion-category">${item.mainCategory}${item.subCategory ? ' > ' + item.subCategory : ''}</div>`;
                }
            }
            
            li.innerHTML = `
                <div class="suggestion-name">${item.name}</div>
                ${categoryInfo}
            `;
            
            li.addEventListener('click', () => handleSelectSuggestion(item, index));
            
            fragment.appendChild(li);
        });
        
        // 한 번에 DOM에 추가
        elements.suggestionsList.appendChild(fragment);
        
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
    
    /**
     * 자동완성 데이터 캐시 지우기
     */
    function clearCache() {
        try {
            localStorage.removeItem('autocompleteData');
            localStorage.removeItem('autocompleteDataTimestamp');
            localStorage.removeItem('autocompleteDataVersion');
            console.log('자동완성 데이터 캐시가 지워졌습니다.');
            return true;
        } catch (error) {
            console.error('캐시 삭제 실패:', error);
            return false;
        }
    }
    
    // 공개 API
    return {
        init,
        handleSearch,
        resetSearch,
        getSearchState,
        setSearchTerm,
        clearSuggestions,
        clearCache
    };
})();
