/**
 * 경매장 검색 관리 모듈
 * 경매장 특화 검색 기능 및 자동완성 처리
 */

import Utils from '../common/utils.js';
import SearchCore from '../common/search-core.js';
import AutocompleteEngine from '../common/autocomplete-engine.js';
import FilterManager from './filter-manager.js';
import CategoryManager from './category-manager.js';

const MAX_RESULTS = 30;
const MIN_SCORE = 40;

// 특별 카테고리 정의
const SPECIAL_CATEGORIES = {
    KEYWORD_SEARCH: ['인챈트 스크롤', '도면', '옷본'],
    PET_MEDAL: '분양 메달'
};

const SearchManager = (() => {
    // 경매장 검색 상태
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
        dataLoadStats: {
            total: 0,
            loaded: 0,
            lastLoggedPercent: 0
        },
        lastSearchTerm: '', // 마지막 검색어 저장
        lastSearchResults: [], // 마지막 검색 결과 저장
        isPetMedalSearchActive: false, // 분양 메달 특별 검색 모드
        petMedalSearchTerm: '', // 분양 메달 필터링용 검색어
        isCategorySearch: false
    };
    
    // 자동완성 데이터
    const autocompleteData = [];
    
    // 초성 캐시 (아이템명 → 초성 맵핑)
    const chosungCache = new Map();
    
    // 겹받침-초성 매핑
    const COMPOUND_CHOSUNG_MAP = {
        'ㄳ': ['ㄱ', 'ㅅ'],
        'ㄵ': ['ㄴ', 'ㅈ'],
        'ㄶ': ['ㄴ', 'ㅎ'],
        'ㄺ': ['ㄹ', 'ㄱ'],
        'ㄻ': ['ㄹ', 'ㅁ'],
        'ㄼ': ['ㄹ', 'ㅂ'],
        'ㄽ': ['ㄹ', 'ㅅ'],
        'ㄾ': ['ㄹ', 'ㅌ'],
        'ㄿ': ['ㄹ', 'ㅍ'],
        'ㅀ': ['ㄹ', 'ㅎ'],
        'ㅄ': ['ㅂ', 'ㅅ']
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
        try {
            // DOM 요소 참조 가져오기
            elements.searchInput = document.getElementById('search-input');
            elements.searchButton = document.querySelector('.search-button');
            elements.resetButton = document.getElementById('reset-button');
            elements.suggestionsList = document.getElementById('suggestions');
    
            // 로딩 상태 표시
            if (elements.searchInput) {
                elements.searchInput.spellcheck = false;
                elements.searchInput.placeholder = "데이터 로딩 중...";
                state.isLoading = true;
            }
            
            // 핵심 검색 모듈 초기화
            SearchCore.init({
                context: 'auction',
                onSearch: handleSearch,
                onReset: resetSearch
            });
            
            // 자동완성 엔진 초기화
            AutocompleteEngine.init({
                context: 'auction',
                dataSource: getSuggestions,
                onSelect: handleAutocompleteSelect
            });
            
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
      // 이미 로드된 경우 중복 실행 방지
      if (autocompleteData.length > 0 || state.isLoading === false) {
        return;
      }
      
      console.log('자동완성 데이터 직접 로드 시작');
      state.isLoading = true;
      
      // CategoryManager 의존성을 제거하고 직접 데이터 로드
      loadAutocompleteData().catch(error => {
        console.error('자동완성 데이터 로드 실패:', error);
        showSearchInputError('데이터를 불러올 수 없습니다.');
      });
    }
    
    /**
     * 이벤트 리스너 설정
     */
    function setupEventListeners() {
        // 검색 입력창 이벤트
        if (elements.searchInput) {
            // 입력 이벤트
            elements.searchInput.addEventListener('input', handleSearchInput);
        }
        
        if (elements.searchButton) {
            // 검색 버튼 클릭
            elements.searchButton.addEventListener('click', handleSearch);
        }
        
        if (elements.resetButton) {
            // 초기화 버튼 클릭
            elements.resetButton.addEventListener('click', resetSearch);
        }
    
        // 검색 결과 수신 리스너
        document.addEventListener('searchResultsReceived', (e) => {
            const { results, searchTerm } = e.detail;
        });
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
     * 자동완성 선택 처리 (콜백 함수)
     * @param {Object} item - 선택한 아이템
     * @param {number} index - 선택한 인덱스
     */
    function handleAutocompleteSelect(item, index) {
        // 카테고리 아이템인 경우 특별 처리
        if (item.isCategory) {
            handleCategorySelect(item);
            state.isCategorySearch = true;
            return;
        }
        
        state.isCategorySearch = false; // 일반 아이템 검색
        // 일반 아이템 선택 처리
        handleSelectSuggestion(item, index);
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
     * 아이템 데이터 처리 및 자동완성 데이터 형식으로 변환
     * @param {Array} items - JSON에서 가져온 아이템 목록
     * @param {Object} category - 카테고리 정보
     */
    function processItems(items, category) {
      if (!Array.isArray(items) || items.length === 0) return;
      
      // 자동완성 데이터 형식으로 변환하여 추가
      items.forEach(item => {
        // 아이템 객체 생성 - 필드 제거
        const autocompleteItem = {
          name: item.name,
          price: item.price || 0,
          date: item.date || '',
          mainCategory: category.mainCategory,
          subCategory: category.id
        };
        
        // 초성 미리 계산하여 저장
        const itemName = item.name || '';
        const noSpaceItemName = Utils.removeSpaces(itemName.toLowerCase());
        const itemChosung = Utils.getChosung(noSpaceItemName);
        
        // 초성 캐시에 저장
        chosungCache.set(itemName, itemChosung);
        
        // 자동완성 데이터에 추가
        autocompleteData.push(autocompleteItem);
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
            
            // 카테고리에서 아이템 목록 로드
            await loadItemListsByCategory();
            
            // 카테고리 목록 로드
            await loadCategoryData();
            
        } catch (error) {
            console.error('자동완성 데이터 로드 중 오류:', error);
            showSearchInputError('데이터를 불러올 수 없습니다.');
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
     * 카테고리 목록 로드
     */
    async function loadCategoryData() {
      try {
        // CategoryManager 대신 loadItemListsByCategory에서 가져온 데이터 사용
        // 이 시점에서는 categories.json이 이미 로드되어 있음
        const response = await fetch('data/categories.json');
        if (!response.ok) {
          throw new Error(`카테고리 데이터 로드 실패: ${response.status}`);
        }
        
        // 카테고리 데이터 직접 파싱
        const data = await response.json();
        const subCategories = data.categories || [];
        const mainCategories = data.mainCategories || [];
        
        if (!subCategories || subCategories.length === 0) {
          console.error('유효한 카테고리 정보가 없습니다.');
          return;
        }
        
        // 이미 로드된 경우 중복 추가 방지
        if (autocompleteData.some(item => item.isCategory)) {
          return;
        }
        
        // 모든 카테고리를 자동완성 데이터에 추가
        subCategories.forEach(category => {
          const categoryItem = {
            name: category.name,
            isCategory: true,
            mainCategory: category.mainCategory,
            subCategory: category.id
          };
          
          // 자동완성 데이터에 추가
          autocompleteData.push(categoryItem);
        });
        
      } catch (error) {
        console.error('카테고리 데이터 캐시 로드 중 오류:', error);
      }
    }
    
    /**
     * 카테고리별 아이템 목록 로드
     */
    async function loadItemListsByCategory() {
        try {
            // 모든 카테고리 데이터 로드를 위한 경로 사용
            const response = await fetch('data/categories.json');
            
            if (!response.ok) {
                throw new Error(`카테고리 데이터 로드 실패: ${response.status}`);
            }
            
            // JSON 데이터 파싱
            const data = await response.json();
            
            // 카테고리 데이터 추출
            const categories = {
                mainCategories: data.mainCategories || [],
                subCategories: data.categories || []
            };
            
            if (!categories.subCategories || categories.subCategories.length === 0) {
                console.warn('카테고리 정보가 로드되지 않았습니다.');
                showSearchInputError('카테고리 정보를 불러올 수 없습니다.');
                return;
            }
            
            // 전체 카테고리 개수 설정
            state.dataLoadStats.total = categories.subCategories.length;
            state.dataLoadStats.loaded = 0;
            
            // 로딩 상태 표시
            if (elements.searchInput) {
                elements.searchInput.placeholder = "데이터 로드 중... (0%)";
            }
            
            // 캐시 누락 감지
            checkAndRepairMissingCache(categories.subCategories);
            
            // 병렬 처리
            await Promise.all(categories.subCategories.map(category => 
                loadItemListFromFileWithETag(category)
                    .catch(error => {
                        console.error(`카테고리 ${category.id} 로드 실패:`, error);
                        state.dataLoadStats.loaded++;
                        updateLoadingProgress();
                    })
            ));
            
            // 검색 입력창 활성화
            enableSearchInput();
            
        } catch (error) {
            console.error('아이템 목록 로드 중 오류:', error);
            showSearchInputError('아이템 목록을 불러올 수 없습니다.');
            throw error;
        }
    }

    /**
     * CategoryManager 준비 상태 확인
     */
    async function ensureCategoryManagerReady() {
      let retryCount = 0;
      const maxRetries = 5;
      const retryInterval = 200; // ms
      
      while (!state.categoryManagerReady && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryInterval));
        retryCount++;
        
        checkCategoryManagerAndLoadData();
        
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

    /**
     * 누락된 캐시 감지 및 복구
     */
    function checkAndRepairMissingCache(categories) {
      categories.forEach(category => {
        const safeFileName = category.id.replace(/\//g, '_');
        const hasETag = localStorage.getItem(`category_${safeFileName}_etag`);
        const hasItems = localStorage.getItem(`category_${safeFileName}_items`);
        
        // 캐시 데이터 불일치 감지
        if (hasETag && !hasItems) {
          localStorage.removeItem(`category_${safeFileName}_etag`);
          localStorage.removeItem(`category_${safeFileName}_items`);
        }
      });
    }

    /**
     * ETag를 활용한 조건부 요청
     */
    async function loadItemListFromFileWithETag(category) {
      // 이미 로드한 경우 중복 로드 방지
      if (state.loadedItemFiles.has(category.id)) return;
      
      // 카테고리 ID의 슬래시를 언더스코어로 변환
      const safeFileName = category.id.replace(/\//g, '_');
      const url = `data/items/${encodeURIComponent(safeFileName)}.json`;
      
      // 재시도 횟수를 추적하기 위한 변수
      let retryCount = 0;
      const maxRetries = 1; // 최대 1회 재시도
    
      async function attemptLoad(useCache = true) {
        try {
          // 저장된 ETag 가져오기
          const cachedETag = useCache ? localStorage.getItem(`category_${safeFileName}_etag`) : null;
          
          // HTTP 요청 헤더 설정
          const headers = new Headers();
          if (cachedETag) {
            // ETag 기반 조건부 요청
            headers.append('If-None-Match', cachedETag);
          }
          
          // 조건부 요청 수행
          const response = await fetch(url, { headers });
          
          if (response.status === 304) { // 304 Not Modified - 캐시가 최신 상태
            // 캐시된 데이터 사용
            const cachedItems = JSON.parse(localStorage.getItem(`category_${safeFileName}_items`) || '[]');
              if (cachedItems.length > 0) {
                  // 캐시된 아이템 추가 전 불필요 필드 무시하는 접근 필요
                  cachedItems.forEach(item => {
                      // 필요한 필드만 autocompleteData에 추가
                      autocompleteData.push({
                          name: item.name,
                          price: item.price || 0,
                          date: item.date || '',
                          mainCategory: item.mainCategory,
                          subCategory: item.subCategory,
                          isCategory: item.isCategory || false
                      });
                      
                      // 초성 추출 및 캐싱
                      if (item.name && !chosungCache.has(item.name)) {
                          const noSpaceItemName = Utils.removeSpaces(item.name.toLowerCase());
                          chosungCache.set(item.name, Utils.getChosung(noSpaceItemName));
                      }
                  });
              }
              return; // 캐시 사용 완료
          }
          
          // 캐시 없음 또는 변경됨 (200 OK)
          if (!response.ok) {
            throw new Error(`서버 응답 오류: ${response.status}`);
          }
          
          // 응답 본문을 텍스트로 먼저 받기
          const responseText = await response.text();
          
          // 빈 응답인지 확인
          if (!responseText || responseText.trim() === '') {
            throw new Error('빈 응답 받음');
          }
          
          // JSON으로 파싱 시도
          let data;
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            // JSON 파싱 실패 시 캐시 삭제 후 재시도 트리거
            if (retryCount < maxRetries) {
              // 캐시 삭제
              localStorage.removeItem(`category_${safeFileName}_etag`);
              localStorage.removeItem(`category_${safeFileName}_items`);
              
              // 재시도 횟수 증가
              retryCount++;
              
              // 캐시 없이 재시도
              return await attemptLoad(false);
            }
            
            // 최대 재시도 횟수 초과 시 원래 오류 발생
            throw parseError;
          }
          
          // 새 ETag 저장
          const newETag = response.headers.get('ETag');
          if (newETag) {
            localStorage.setItem(`category_${safeFileName}_etag`, newETag);
          }
          
          // 데이터 처리
          const items = data.items || [];
          processItems(items, category);
          
          // 캐시 저장
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
          // 첫 번째 시도에서 JSON 파싱 오류가 발생하고 재시도하지 않은 경우
          if (error instanceof SyntaxError && useCache && retryCount < maxRetries) {
            // 캐시 삭제
            localStorage.removeItem(`category_${safeFileName}_etag`);
            localStorage.removeItem(`category_${safeFileName}_items`);
            
            // 재시도 횟수 증가
            retryCount++;
            
            // 캐시 없이 재시도
            return await attemptLoad(false);
          }
          
          console.warn(`카테고리 ${category.id} 아이템 목록 로드 실패:`, error);
          state.loadedItemFiles.add(category.id);
          
          // 오류가 발생해도 로드 진행 상태는 업데이트
          state.dataLoadStats.loaded++;
          updateLoadingProgress();
          
          throw error;
        }
      }
      
      // 초기 로드 시도
      await attemptLoad();
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
        
        // 검색어 변경 이벤트 발생
        const event = new CustomEvent('searchTermChanged', {
            detail: {
                term: state.searchTerm,
                context: 'auction'
            }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 겹받침을 포함한 초성 문자열 처리
     * @param {string} chosungStr - 초성 문자열
     * @returns {string} 겹받침이 분해된 초성 문자열
     */
    function processCompoundChosung(chosungStr) {
        if (!chosungStr) return '';
        
        let result = '';
        for (let i = 0; i < chosungStr.length; i++) {
            const char = chosungStr[i];
            // 겹받침인지 확인
            if (COMPOUND_CHOSUNG_MAP[char]) {
                // 겹받침을 분해하여 각 초성으로 변환
                result += COMPOUND_CHOSUNG_MAP[char].join('');
            } else {
                result += char;
            }
        }
        
        return result;
    }
    
    /**
     * 검색어 기반 자동완성 추천 생성
     * @param {string} searchTerm - 검색어
     * @returns {Array} 추천 목록
     */
    function getSuggestions(searchTerm) {
        if (!searchTerm) return [];
        
        const normalizedTerm = searchTerm.toLowerCase();
        const noSpaceTerm = Utils.removeSpaces(normalizedTerm);
        
        if (!Array.isArray(autocompleteData) || autocompleteData.length === 0) {
            return [];
        }
        
        const matchedItems = [];
        
        // 초성 검색인지 확인
        const isChosungSearch = Utils.isAllChosung(noSpaceTerm);
        
        // 검색어 처리 (초성인 경우 겹받침 분해)
        const processedTerm = isChosungSearch ? processCompoundChosung(noSpaceTerm) : noSpaceTerm;
        
        // 검색 수행
        if (processedTerm.length === 1) {
            handleSingleCharSearch(processedTerm, matchedItems);
        } else {
            // 초성 검색과 일반 검색 구분
            if (isChosungSearch) {
                handleChosungMultiSearch(processedTerm, matchedItems);
            } else {
                handleMultiCharSearch(processedTerm, matchedItems);
            }
        }
        
        // 분양 메달 관련 자동완성 처리
        if (state.isPetMedalSearchActive && normalizedTerm) {
            handlePetMedalSearch(normalizedTerm, matchedItems);
        }
        
        // 카테고리 항목과 일반 항목 분리
        const categoryMatches = matchedItems.filter(item => item.item.isCategory);
        const itemMatches = matchedItems.filter(item => !item.item.isCategory);
        
        // 카테고리는 이미 함수 내에서 +5 보너스를 받았음
        // 여기서는 UI 표시를 위해 더 큰 보너스를 추가하여 항상 상단에 표시되도록 함
        categoryMatches.forEach(item => {
            item.score += 100; // 개별 함수에서 이미 +5를 받았으므로 여기서는 +100만 추가
        });
        
        // 각 그룹 내에서 점수, 이름 길이 순으로 정렬
        const sortedCategories = categoryMatches
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return a.itemName.length - b.itemName.length;
            })
            .slice(0, 5) // 최대 5개 카테고리만 표시
            .map(entry => entry.item);
        
        const sortedItems = itemMatches
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return a.itemName.length - b.itemName.length;
            })
            .slice(0, MAX_RESULTS - sortedCategories.length) // 남은 공간만큼 아이템 표시
            .map(entry => entry.item);
        
        // 최종 결과: 카테고리 결과 + 일반 아이템 결과
        return [...sortedCategories, ...sortedItems];
    }
    
    /**
     * 분양 메달 특별 검색 처리
     * @param {string} searchTerm - 검색어
     * @param {Array} matchedItems - 결과 저장 배열
     */
    function handlePetMedalSearch(searchTerm, matchedItems) {
        // 분양 메달 카테고리 아이템만 필터링
        const petMedalItems = autocompleteData.filter(item => 
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
        for (const item of autocompleteData) {
            if (!item.name) continue;
            
            const itemName = item.name.toLowerCase();
            const noSpaceItemName = Utils.removeSpaces(itemName);
            
            // 초성 캐시에서 가져오기
            let itemChosung = chosungCache.get(item.name);
            
            // 캐시에 없는 경우 계산
            if (!itemChosung) {
                itemChosung = Utils.getChosung(noSpaceItemName);
                chosungCache.set(item.name, itemChosung);
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
        const itemsArray = itemsToSearch || autocompleteData;
        
        // 겹받침 확인 및 분해
        const processedChosung = processCompoundChosung(chosung);
        
        for (const item of itemsArray) {
            if (!item.name) continue;
            
            // 검색 대상 텍스트 결정 (카테고리/일반 아이템)
            const itemText = item.name;
            const itemLower = itemText.toLowerCase();
            const noSpaceItemText = Utils.removeSpaces(itemLower);
            
            // 초성 캐시에서 가져오기
            let itemChosung = chosungCache.get(itemText);
            
            // 캐시에 없는 경우만 계산
            if (!itemChosung) {
                itemChosung = Utils.getChosung(noSpaceItemText);
                chosungCache.set(itemText, itemChosung);
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
        for (const item of autocompleteData) {
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
            if (score < 65 && Utils.COMPOUND_JUNGSUNG_MAP[analysis.jungsung]) {
                const possibleCompoundJungsung = Utils.COMPOUND_JUNGSUNG_MAP[analysis.jungsung];
                
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
        for (const item of autocompleteData) {
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
        for (const item of autocompleteData) {
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
        for (const item of autocompleteData) {
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
        for (const item of autocompleteData) {
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
        if (Utils.COMPOUND_JUNGSUNG_MAP[lastCharAnalysis.jungsung]) {
          const possibleCompoundJungsung = Utils.COMPOUND_JUNGSUNG_MAP[lastCharAnalysis.jungsung];
          
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
      
      // 위치 정보만 추출하여 배열에 추가
      const lastPosArray = lastCharPositions.map(item => item.pos);
      charPositions.push(lastPosArray);
      
      // 가능한 모든 경로 탐색 (순차적이지만 연속적일 필요는 없음)
      if (hasValidSequence(charPositions)) {
        // 마지막 글자 매칭 가중치 기반 보너스 계산
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
      if (!positionsArray.length) return false;
      
      // 첫 번째 글자의 모든 위치에서 시작
      const paths = positionsArray[0].map(pos => [pos]);
      
      // 두 번째 글자부터 경로 확장
      for (let i = 1; i < positionsArray.length; i++) {
        const newPaths = [];
        
        // 기존 각 경로에서 확장 가능한 경로 찾기
        for (const path of paths) {
          const lastPos = path[path.length - 1];
          
          // 현재 글자의 위치가 이전 글자 위치보다 뒤에 있어야 함
          for (const nextPos of positionsArray[i]) {
            if (nextPos > lastPos) {
              newPaths.push([...path, nextPos]);
              
              // 효율성을 위해 모든 경로를 찾을 필요 없이
              // 마지막 글자까지 유효한 경로를 찾으면 성공
              if (i === positionsArray.length - 1) {
                return true;
              }
            }
          }
        }
        
        // 더 이상 경로를 확장할 수 없으면 실패
        if (newPaths.length === 0) {
          return false;
        }
        
        // 새 경로로 업데이트
        paths.length = 0;
        paths.push(...newPaths);
      }
      
      // 끝까지 유효한 경로가 있으면 성공
      return paths.length > 0;
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
        
        // 분양 메달 여부 확인 - 새로운 함수 사용
        const isPetMedalItem = isPetMedalCategory(item.subCategory);
        
        // 분양 메달 관련 상태 설정
        if (isPetMedalItem) {
            state.isPetMedalSearchActive = true;
            state.petMedalSearchTerm = elements.searchInput ? elements.searchInput.value : '';
        } else {
            state.isPetMedalSearchActive = false;
            state.petMedalSearchTerm = '';
        }
        
        // 자동완성 선택 이벤트 발생 - 특별 카테고리 플래그 제거
        const autocompleteEvent = new CustomEvent('autocompleteSelected', {
            detail: {
                searchTerm: state.searchTerm,
                selectedItem: item,
                category: item.subCategory,
                mainCategory: item.mainCategory
            }
        });
        document.dispatchEvent(autocompleteEvent);
        
        // 필터 업데이트 호출
        if (item.subCategory) {
            FilterManager.updateFiltersForCategory(item.subCategory).catch(err => {
                console.error('필터 업데이트 실패:', err);
            });
        }
        
        // 검색 이벤트 즉시 발생
        const searchEvent = new CustomEvent('search', {
            detail: {
                searchTerm: item.name,
                selectedItem: item,
                mainCategory: item.mainCategory,
                subCategory: item.subCategory,
                isPetMedalSearch: state.isPetMedalSearchActive,
                petMedalSearchTerm: state.petMedalSearchTerm
            }
        });
        document.dispatchEvent(searchEvent);
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
            const isAutoCompleteVisible = AutocompleteEngine.isSuggestionVisible();
            const activeItem = isAutoCompleteVisible ? AutocompleteEngine.getActiveItem() : null;
            
            if (isAutoCompleteVisible && activeItem) {
                // 선택된 자동완성 항목으로 검색
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
        
        // 분양 메달 모드 초기화
        state.isPetMedalSearchActive = false;
        state.petMedalSearchTerm = '';
        
        // 초기화에 따른 상태 변수 정리
        state.lastSearchTerm = '';
        state.lastSearchResults = [];
        
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
            isSuggestionVisible: AutocompleteEngine.isSuggestionVisible(),
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
        AutocompleteEngine.clearSuggestions();
    }
    
    /**
     * 자동완성 데이터 캐시 지우기
     */
    function clearCache() {
        try {
            localStorage.removeItem('autocompleteData');
            
            // 카테고리별 캐시 초기화
            const categories = CategoryManager.getSelectedCategories()?.subCategories || [];
            categories.forEach(category => {
                const safeFileName = category.id.replace(/\//g, '_');
                localStorage.removeItem(`category_${safeFileName}_etag`);
                localStorage.removeItem(`category_${safeFileName}_items`);
            });
            
            chosungCache.clear();
            console.log('자동완성 캐시 삭제 완료');
            return true;
        } catch (error) {
            console.error('캐시 삭제 실패:', error);
            return false;
        }
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
        clearCache,
        filterPetMedalResults,
        isSpecialKeywordCategory,
        isPetMedalCategory
    };
})();

export default SearchManager;
