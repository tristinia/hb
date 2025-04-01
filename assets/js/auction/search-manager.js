/**
 * 검색 관리 모듈
 * 검색 입력, 자동완성 관리
 */

import Utils from './utils.js';
import CategoryManager from './category-manager.js';

const SearchManager = (() => {
    // 검색 상태
    const state = {
        searchTerm: '',
        suggestions: [],
        activeSuggestion: -1,
        selectedItem: null,
        isSuggestionVisible: false,
        loadedItemFiles: new Set(),  // 이미 로드한 아이템 파일 추적
        isInitialized: false, // 초기화 상태 추적
        isLoading: false, // 로딩 상태
        hasError: false, // 오류 상태
        categoryManagerReady: false, // CategoryManager 준비 상태
        dataLoadStats: {
            total: 0,
            loaded: 0,
            lastLoggedPercent: 0
        }
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
        try {
            // DOM 요소 참조 가져오기
            elements.searchInput = document.getElementById('search-input');
            elements.searchButton = document.querySelector('.search-button');
            elements.resetButton = document.getElementById('reset-button');
            elements.suggestionsList = document.getElementById('suggestions');
    
            // 로딩 상태 표시
            if (elements.searchInput) {
                elements.searchInput.placeholder = "데이터 로딩 중...";
                state.isLoading = true;
            }
            
            // 이벤트 리스너 설정
            setupEventListeners();
            
            // 카테고리 초기화 완료 이벤트 리스너 추가
            document.addEventListener('categoriesLoaded', () => {
                state.categoryManagerReady = true;
                
                // 약간의 지연 후 데이터 로드
                setTimeout(() => {
                    loadAutocompleteData().catch(error => {
                        console.error('아이템 목록 로드 실패:', error);
                        showSearchInputError('데이터를 불러올 수 없습니다. 페이지를 새로고침 해주세요.');
                    });
                }, 100);
            });
            
            // CategoryManager 준비 상태 확인
            checkCategoryManagerAndLoadData();
            
            state.isInitialized = true;
        } catch (error) {
            console.error('검색 관리자 초기화 오류:', error);
            state.hasError = true;
            
            if (elements.searchInput) {
                showSearchInputError('검색 기능을 초기화할 수 없습니다. 페이지를 새로고침 해주세요.');
            }
        }
    }
    
    /**
     * CategoryManager 상태 확인 및 데이터 로드
     */
    function checkCategoryManagerAndLoadData() {
        try {
            if (CategoryManager.getSelectedCategories && 
                typeof CategoryManager.getSelectedCategories === 'function') {
                
                const categories = CategoryManager.getSelectedCategories();
                if (categories && categories.subCategories && categories.subCategories.length > 0) {
                    state.categoryManagerReady = true;
                    
                    // 자동완성 데이터 로드
                    loadAutocompleteData().catch(error => {
                        console.error('자동완성 데이터 로드 실패:', error);
                        showSearchInputError('데이터를 불러올 수 없습니다. 페이지를 새로고침 해주세요.');
                    });
                }
            }
        } catch (error) {
            console.log('CategoryManager 상태 확인 중 오류:', error);
        }
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
    
        // 카테고리 변경
        document.addEventListener('categoryChanged', (e) => {
            const { maintainSearchTerm } = e.detail;
            
            // 카테고리 변경 시 자동완성 캐시 초기화
            state.autocompleteCache = null;
            
            // maintainSearchTerm 플래그가 true면 검색어 유지, 그렇지 않으면 초기화
            if (!maintainSearchTerm) {
                state.selectedItem = null;
            } else {
                state.selectedItem = null;
            }
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

        // 카테고리 변경
        document.addEventListener('categoryChanged', (e) => {
            const { maintainSearchTerm } = e.detail;
            
            // maintainSearchTerm 플래그가 true면 검색어 유지, 그렇지 않으면 자동완성 처리
            if (!maintainSearchTerm) {
                // 검색어와 선택된 아이템 모두 초기화
                state.selectedItem = null;
                // 검색창의 텍스트도 초기화하는 경우 추가 가능
                // if (elements.searchInput) elements.searchInput.value = '';
                // state.searchTerm = '';
            } else {
                // 검색어는 유지하고 선택된 아이템만 초기화
                state.selectedItem = null;
            }
        });
    }

    /**
     * 아이템 데이터 처리 및 자동완성 데이터 형식으로 변환
     * @param {Array} items - JSON에서 가져온 아이템 목록
     * @param {Object} category - 카테고리 정보
     */
    function processItems(items, category) {
      if (!Array.isArray(items) || items.length === 0) return;
      
      // 자동완성 데이터 형식으로 변환하여 추가
      items.forEach(item => {
        autocompleteData.push({
          name: item.name,
          price: item.price || 0,
          date: item.date || '',
          mainCategory: category.mainCategory,
          subCategory: category.id
        });
      });
      
      // 로드 완료 표시
      state.loadedItemFiles.add(category.id);
      
      // 진행 상황 업데이트
      state.dataLoadStats.loaded++;
      updateLoadingProgress();
    }
    
    /**
     * 진행 상황 업데이트 및 로그 표시
     */
    function updateLoadingProgress() {
        if (state.dataLoadStats.total === 0) return;
        
        const percent = Math.round((state.dataLoadStats.loaded / state.dataLoadStats.total) * 100);
        
        // 검색창 placeholder 업데이트
        if (elements.searchInput) {
            elements.searchInput.placeholder = `데이터 로드 중... (${percent}%)`;
        }
        
        // 중요 진행률(25%, 50%, 75%, 100%)에서만 로그 출력
        const significantPercents = [25, 50, 75, 100];
        const currentSignificantPercent = significantPercents.find(p => 
            percent >= p && state.dataLoadStats.lastLoggedPercent < p
        );
        
        if (currentSignificantPercent) {
            console.log(`${currentSignificantPercent}% 진행: ${autocompleteData.length}개 항목 로드됨`);
            state.dataLoadStats.lastLoggedPercent = currentSignificantPercent;
            
            // 로컬 스토리지에 현재 상태 저장
            if (autocompleteData.length > 0) {
                try {
                    localStorage.setItem('autocompleteData', JSON.stringify(autocompleteData));
                } catch (error) {
                    console.warn(`캐시 저장 실패:`, error);
                }
            }
        }
    }
    
    /**
     * 카테고리에서 자동완성 데이터 로드
     */
    async function loadAutocompleteData() {       
        try {
            // 이미 로드되었으면 스킵
            if (autocompleteData.length > 0) {
                enableSearchInput();
                return;
            }
            
            // 카테고리에서 데이터 로드
            await loadItemListsByCategory();
            
        } catch (error) {
            console.error('자동완성 데이터 로드 중 오류:', error);
            showSearchInputError('데이터를 불러올 수 없습니다. 페이지를 새로고침 해주세요.');
            throw error;
        }
    }
    
    /**
     * 검색 입력창 활성화
     */
    function enableSearchInput() {
        if (!elements.searchInput) return;
        
        // 검색 입력창 활성화
        elements.searchInput.placeholder = "아이템 이름을 입력하세요...";
        elements.searchInput.classList.remove('search-error');
        
        // 검색 버튼 활성화
        if (elements.searchButton) {
            elements.searchButton.removeAttribute('disabled');
        }
        
        state.isLoading = false;
        state.hasError = false;
    }

    /**
     * 카테고리별 아이템 목록 로드
     */
    async function loadItemListsByCategory() {
        try {
            // CategoryManager가 준비되지 않았으면 대기
            if (!state.categoryManagerReady) {
                // 5번 시도하고 실패하면 오류
                let retryCount = 0;
                const maxRetries = 5;
                const retryInterval = 200; // ms
                
                while (!state.categoryManagerReady && retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, retryInterval));
                    retryCount++;
                    
                    // 다시 확인
                    checkCategoryManagerAndLoadData();
                    
                    // 준비되었는지 확인
                    if (CategoryManager.getSelectedCategories && 
                        typeof CategoryManager.getSelectedCategories === 'function') {
                        try {
                            const categories = CategoryManager.getSelectedCategories();
                            if (categories && categories.subCategories && categories.subCategories.length > 0) {
                                state.categoryManagerReady = true;
                                break;
                            }
                        } catch (error) {
                            console.log('CategoryManager 상태 확인 중 오류:', error);
                        }
                    }
                }
                
                if (!state.categoryManagerReady) {
                    throw new Error('카테고리 관리자가 준비되지 않았습니다.');
                }
            }
            
            // 카테고리 정보 가져오기
            const categories = await getCategoryInfo();
            
            if (!categories.subCategories || categories.subCategories.length === 0) {
                console.warn('카테고리 정보가 로드되지 않았습니다.');
                showSearchInputError('카테고리 정보를 불러올 수 없습니다.');
                return;
            }
            
            // 전체 카테고리 개수 설정
            state.dataLoadStats.total = categories.subCategories.length;
            state.dataLoadStats.loaded = 0;
            state.dataLoadStats.lastLoggedPercent = 0;
            
            // 로딩 상태 표시
            if (elements.searchInput) {
                elements.searchInput.placeholder = "데이터 로드 중... (0%)";
            }
            
            // 작업자 풀 설정 - 카테고리 병렬 로드
            const CONCURRENT_REQUESTS = 5; // 동시에 처리할 요청 수
            
            // 로드 프로세스 시작
            console.log(`총 ${state.dataLoadStats.total}개 카테고리 로드 시작`);
            
            // 작업자 풀 구현 (동시 요청 제한)
            const processCategoryBatch = async (categoryBatch) => {
                // 배치 내에서는 병렬 처리
                await Promise.all(categoryBatch.map(category => 
                    loadItemListFromFile(category)
                        .catch(error => {
                            console.error(`카테고리 ${category.id} 로드 실패:`, error);
                            state.dataLoadStats.loaded++; // 실패해도 진행률 업데이트
                            updateLoadingProgress();
                        })
                ));
            };
            
            // 카테고리를 배치로 나누기
            const batches = [];
            for (let i = 0; i < state.dataLoadStats.total; i += CONCURRENT_REQUESTS) {
                batches.push(categories.subCategories.slice(i, i + CONCURRENT_REQUESTS));
            }
            
            // 배치 순차 처리 (각 배치 내 병렬 처리)
            for (const batch of batches) {
                await processCategoryBatch(batch);
                
                // UI 렌더링을 위한 작은 지연
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            // 모든 카테고리 로드 완료
            console.log(`데이터 로드 완료: 총 ${autocompleteData.length}개 항목`);
            
            // 검색 입력창 활성화
            enableSearchInput();
            
        } catch (error) {
            console.error('아이템 목록 로드 중 오류:', error);
            showSearchInputError('아이템 목록을 불러올 수 없습니다.');
            throw error;
        }
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
     * 파일에서 아이템 목록 로드
     * @param {Object} category - 카테고리 정보
     */
    async function loadItemListFromFile(category) {
      // 이미 로드한 경우 중복 로드 방지
      if (state.loadedItemFiles.has(category.id)) return;
      
      try {
        // 카테고리 ID의 슬래시를 언더스코어로 변환
        const safeFileName = category.id.replace(/\//g, '_');
        const url = `../../data/items/${encodeURIComponent(safeFileName)}.json`;
        
        // 각 파일의 타임스탬프 확인
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP 오류: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 캐시 유효성 검사
        const cachedTimestamp = localStorage.getItem(`category_${safeFileName}_timestamp`);
        
        // 타임스탬프 비교
        if (cachedTimestamp === data.updated) {
          // 캐시 활용
          const cachedItems = JSON.parse(localStorage.getItem(`category_${safeFileName}_items`) || '[]');
          if (cachedItems.length > 0) {
            cachedItems.forEach(item => autocompleteData.push(item));
            state.loadedItemFiles.add(category.id);
            state.dataLoadStats.loaded++;
            updateLoadingProgress();
            return;
          }
        }
        
        // 캐시가 없거나 만료된 경우 데이터 처리
        const items = data.items || [];
        processItems(items, category);
        
        // 캐시 저장
        localStorage.setItem(`category_${safeFileName}_timestamp`, data.updated);
        localStorage.setItem(`category_${safeFileName}_items`, JSON.stringify(
          items.map(item => ({
            name: item.name,
            price: item.price || 0,
            date: item.date || '',
            mainCategory: category.mainCategory,
            subCategory: category.id
          }))
        ));
        
      } catch (error) {
        console.warn(`카테고리 ${category.id} 아이템 목록 로드 실패:`, error);
        state.loadedItemFiles.add(category.id); // 오류 발생해도 다시 시도하지 않음
        throw error;
      }
    }
    
    /**
     * 검색어 입력 처리
     */
    function handleSearchInput() {
        // 로딩 또는 오류 상태면 무시
        if (state.isLoading || state.hasError) return;
        
        // 이전 검색어와 다르면 선택된 아이템 초기화
        const newSearchTerm = elements.searchInput.value.trim();
        if (newSearchTerm !== state.searchTerm && state.selectedItem) {
            // 검색어가 변경되면 선택된 아이템 초기화
            state.selectedItem = null;
        }
        
        state.searchTerm = newSearchTerm;
        
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
     * 자동완성 렌더링
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
                try {
                    // 메인 카테고리 이름 찾기
                    let mainCategoryName = item.mainCategory;
                    const categories = CategoryManager.getSelectedCategories();
                    if (!categories || !categories.mainCategories) {
                        throw new Error('카테고리 정보를 가져올 수 없습니다');
                    }
                    
                    const mainCategoryObj = categories.mainCategories.find(cat => cat.id === item.mainCategory);
                    if (mainCategoryObj) {
                        mainCategoryName = mainCategoryObj.name;
                    }
                    
                    // 서브 카테고리 이름 찾기
                    let subCategoryName = item.subCategory;
                    const subCategoryObj = categories.subCategories.find(cat => cat.id === item.subCategory);
                    if (subCategoryObj) {
                        subCategoryName = subCategoryObj.name;
                    }
                    
                    categoryInfo = `<div class="suggestion-category">${mainCategoryName}${subCategoryName ? ' > ' + subCategoryName : ''}</div>`;
                } catch (error) {
                    console.error('카테고리 정보 렌더링 중 오류:', error);
                    elements.suggestionsList.classList.remove('show');
                    state.isSuggestionVisible = false;
                    return;
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
        
        // 특별 카테고리 확인
        const isSpecialCategory = ['인챈트 스크롤', '도면', '옷본'].includes(item.subCategory);
    
        // 자동완성 캐시 업데이트 이벤트 발생
        const cacheEvent = new CustomEvent('autocompleteSelected', {
            detail: {
                searchTerm: item.name,
                selectedItem: item,
                category: item.subCategory,
                mainCategory: item.mainCategory,
                isSpecialCategory
            }
        });
        document.dispatchEvent(cacheEvent);
        
        const categoryEvent = new CustomEvent('categoryChanged', {
            detail: {
                mainCategory: item.mainCategory,
                subCategory: item.subCategory,
                autoSelected: true,
                itemName: item.name
            }
        });
        document.dispatchEvent(categoryEvent);
    
        // 자동완성 닫기
        clearSuggestions();
    }
    
    /**
     * 키보드 탐색 처리
     * @param {KeyboardEvent} e - 키보드 이벤트
     */
    function handleKeyDown(e) {
        // 로딩 또는 오류 상태면 무시
        if (state.isLoading || state.hasError) return;
        
        // 자동완성 목록이 표시된 경우에만 처리
        if (!state.isSuggestionVisible) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
            }
            return;
        }
        
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
        if (!elements.suggestionsList) return;
        
        // 페이드 아웃 애니메이션 시작
        elements.suggestionsList.classList.add('hide');
        elements.suggestionsList.classList.remove('show');
        
        // 애니메이션 완료 후 내용 지우기
        setTimeout(() => {
            elements.suggestionsList.innerHTML = '';
            state.suggestions = [];
            state.activeSuggestion = -1;
            state.isSuggestionVisible = false;
            
            elements.suggestionsList.classList.remove('hide');
        }, 300);
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
            }
            
            // 이전 자동완성 선택된 아이템 확인
            // 검색어와 선택된 아이템 이름이 다른 경우에만 초기화
            if (state.selectedItem && state.selectedItem.name !== state.searchTerm) {
                state.selectedItem = null;
            }
            
            // 카테고리 정보 가져오기
            const { mainCategory, subCategory } = CategoryManager.getSelectedCategories();
            
            // 검색어 또는 선택된 카테고리가 없는 경우
            if (!state.searchTerm && !subCategory) {
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
            selectedItem: state.selectedItem,
            isLoading: state.isLoading,
            hasError: state.hasError
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
        }
    }
    
    /**
     * 자동완성 데이터 캐시 지우기
     */
    function clearCache() {
        try {
            localStorage.removeItem('autocompleteData');
            
            // 카테고리별 캐시 지우기
            const categories = CategoryManager.getSelectedCategories()?.subCategories || [];
            categories.forEach(category => {
                const safeFileName = category.id.replace(/\//g, '_');
                localStorage.removeItem(`category_${safeFileName}_timestamp`);
                localStorage.removeItem(`category_${safeFileName}_items`);
            });
            
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
        clearCache,
    };
})();

export default SearchManager;
