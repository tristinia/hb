/**
 * 필터 관리 모듈
 * 필터 UI 및 필터 적용 로직 관리
 */

import optionRenderer from './option-renderer.js';

const FilterManager = (() => {
    // 필터 상태
    const state = {
        availableFilters: [],
        activeFilters: [],
        currentCategory: null,
        isInitialized: false,
        debug: false // 디버그 모드 (true로 설정하면 상세 로그 출력)
    };
    
    // 인챈트 메타데이터
    const enchantData = {
        prefix: null,
        suffix: null,
        isLoaded: false
    };
    
    // DOM 요소 참조
    let elements = {
        filterSelector: null,
        activeFilters: null,
        selectedFilters: null
    };
    
    /**
     * 디버그 로그 출력
     * @param {...any} args 로그 인자들
     */
    function logDebug(...args) {
        if (state.debug) {
            console.log(...args);
        }
    }
    
    /**
     * 모듈 초기화
     */
    function init() {
        // DOM 요소 참조 가져오기
        elements.filterSelector = document.getElementById('filter-selector');
        elements.activeFilters = document.getElementById('active-filters');
        elements.selectedFilters = document.getElementById('selected-filters');
        
        // 카테고리 변경 이벤트 리스너
        document.addEventListener('categoryChanged', (e) => {
            const { subCategory } = e.detail;
            if (subCategory !== state.currentCategory) {
                state.currentCategory = subCategory;
                updateFiltersForCategory(subCategory);
            }
        });
        
        // 필터 셀렉터 변경 이벤트 리스너
        if (elements.filterSelector) {
            elements.filterSelector.addEventListener('change', (e) => {
                const selectedValue = e.target.value;
                if (selectedValue) {
                    addFilterItem(selectedValue);
                    e.target.value = ''; // 선택 초기화
                }
            });
        }
        
        // 인챈트 메타데이터 로드
        loadEnchantMetadata();
        
        state.isInitialized = true;
        logDebug('FilterManager 초기화 완료');
    }
    
    /**
     * 인챈트 메타데이터 로드
     */
    async function loadEnchantMetadata() {
        try {
            // 접두사 데이터 로드
            const prefixResponse = await fetch('../../data/meta/enchants/prefix.json');
            if (prefixResponse.ok) {
                enchantData.prefix = await prefixResponse.json();
            }
            
            // 접미사 데이터 로드
            const suffixResponse = await fetch('../../data/meta/enchants/suffix.json');
            if (suffixResponse.ok) {
                enchantData.suffix = await suffixResponse.json();
            }
            
            enchantData.isLoaded = true;
            logDebug('인챈트 메타데이터 로드 완료');
        } catch (error) {
            console.error('인챈트 메타데이터 로드 실패:', error);
        }
    }
    
    /**
     * 필터 드롭다운 업데이트
     */
    function updateFilterDropdown() {
      if (!elements.filterSelector) return;
      
      // 필터 드롭다운 초기화
      elements.filterSelector.innerHTML = '<option value="">옵션 선택...</option>';
      
      // 필터 옵션 추가
      state.availableFilters.forEach(filter => {
        const option = document.createElement('option');
        option.value = filter.name;
        option.textContent = filter.displayName || filter.name;
        
        elements.filterSelector.appendChild(option);
      });
    }

    /**
     * 필터 UI에 스타일 추가
     */
    function addStyles() {
        // 필터 관련 스타일이 필요한 경우 여기에 추가
        // 현재는 auction.css에서 관리
    }
    
    /**
     * 현재 카테고리에 맞는 필터 옵션 업데이트
     * @param {string} category - 카테고리 ID
     */
    async function updateFiltersForCategory(category) {
        if (!elements.filterSelector) return;
        state.currentCategory = category;
        
        try {
            // 카테고리에 맞는 옵션 구조 로드
            const filters = await loadFiltersForCategory(category);
            
            // 가용 필터 설정
            state.availableFilters = filters;
            
            // 필터 드롭다운 업데이트
            updateFilterDropdown();
            
            // 활성 필터 초기화
            state.activeFilters = [];
            if (elements.activeFilters) {
                elements.activeFilters.innerHTML = '';
            }
            updateSelectedFiltersUI();
            
            logDebug(`카테고리 ${category}의 필터 옵션 업데이트 완료: ${filters.length}개 필터`);
        } catch (error) {
            console.error('필터 업데이트 중 오류:', error);
            
            // 필터 오류 메시지 표시
            elements.filterSelector.innerHTML = '<option value="">옵션을 로드할 수 없습니다</option>';
            
            // 필터 상태 초기화
            state.availableFilters = [];
            state.activeFilters = [];
            
            if (elements.activeFilters) {
                elements.activeFilters.innerHTML = '<div class="filter-error">필터 옵션을 로드할 수 없습니다. 페이지를 새로고침해 주세요.</div>';
            }
        }
    }
    
    /**
     * 카테고리별 필터 옵션 로드
     * @param {string} category - 카테고리 ID
     * @returns {Promise<Array>} 필터 목록
     */
    async function loadFiltersForCategory(category) {
        try {
            // 카테고리 없는 경우 빈 배열 반환
            if (!category) {
                return [];
            }
            
            // 카테고리명 안전하게 변환 (/ -> _)
            const safeCategory = category.replace(/\//g, '_');
            
            // 카테고리별 옵션 로드
            const response = await fetch(`../../data/option_structure/${encodeURIComponent(safeCategory)}.json`);
            
            // 카테고리별 파일이 없는 경우 빈 배열 반환
            if (!response.ok) {  
                return [];
            }
            
            const data = await response.json();
            
            // 옵션 타입을 필터 옵션 형식으로 변환
            const filters = data.option_types.map(optionType => {
                // 기본 필터 구조 생성
                const filterBase = {
                    name: optionType,
                    displayName: optionType,
                    type: 'range',
                    visible: true
                };
                
                try {
                    // 안전하게 옵션 핸들러 접근
                    if (optionRenderer.optionHandlers && 
                        optionType in optionRenderer.optionHandlers) {
                        
                        const handler = optionRenderer.optionHandlers[optionType];
                        
                        // 핸들러가 있고 필터 정보가 있으면 결합
                        if (handler && handler.filter) {
                            // 필터가 객체인 경우 (대부분의 경우)
                            if (typeof handler.filter === 'object') {
                                return {
                                    ...filterBase,
                                    ...handler.filter,
                                    name: optionType // 이름은 항상 원래 옵션 타입 유지
                                };
                            }
                            // 필터가 false인 경우 (필터링 비활성화)
                            else if (handler.filter === false) {
                                return {
                                    ...filterBase,
                                    visible: false
                                };
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`옵션 핸들러 로드 오류 (${optionType}):`, e);
                }
                
                return filterBase;
            });
            
            return filters;
        } catch (error) {
            throw error; // 오류 전파
        }
    }
    
    /**
     * 필터 항목 추가
     * @param {string} filterName - 필터 이름
     */
    function addFilterItem(filterName) {
        if (!elements.activeFilters) return;
        
        // 이미 추가된 필터인지 확인
        if (elements.activeFilters.querySelector(`[data-filter="${filterName}"]`)) {
            return;
        }
        
        // 필터 정보 찾기
        const filterInfo = state.availableFilters.find(f => f.name === filterName);
        if (!filterInfo) return;
        
        // 필터 아이템 생성
        const filterItem = document.createElement('div');
        filterItem.className = 'filter-item';
        filterItem.setAttribute('data-filter', filterName);
        filterItem.setAttribute('data-filter-name', filterInfo.name);
        
        // 필터 헤더 (이름 + 삭제 버튼)
        const filterHeader = document.createElement('div');
        filterHeader.className = 'filter-header';
        
        const filterNameSpan = document.createElement('span');
        filterNameSpan.className = 'filter-name';
        filterNameSpan.textContent = filterInfo.displayName || filterName;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'filter-remove';
        removeBtn.innerHTML = '×';
        removeBtn.setAttribute('aria-label', `${filterInfo.displayName || filterName} 필터 제거`);
        removeBtn.addEventListener('click', () => {
            filterItem.remove();
            removeActiveFilter(filterName);
            applyFilters(); // 필터 즉시 적용
        });
        
        filterHeader.appendChild(filterNameSpan);
        filterHeader.appendChild(removeBtn);
        filterItem.appendChild(filterHeader);
        
        // 필터 입력 컨텐츠
        const filterContent = document.createElement('div');
        filterContent.className = 'filter-content';
        
        // 필터 유형에 따른 입력 요소 생성
        if (filterInfo.type === 'enchant') {
            // 인챈트 검색 UI (접두/접미 별도 필드)
            const prefixContainer = document.createElement('div');
            prefixContainer.className = 'enchant-search-container';
            
            const prefixLabel = document.createElement('label');
            prefixLabel.className = 'enchant-label';
            prefixLabel.textContent = '접두';
            prefixLabel.setAttribute('for', `prefix-search-${Date.now()}`);
            
            const prefixInput = document.createElement('input');
            prefixInput.id = `prefix-search-${Date.now()}`;
            prefixInput.type = 'text';
            prefixInput.className = 'filter-input enchant-input';
            prefixInput.placeholder = '접두 인챈트...';
            prefixInput.setAttribute('data-type', '접두');
            
            const prefixSuggestions = document.createElement('div');
            prefixSuggestions.className = 'enchant-suggestions';
            prefixSuggestions.style.display = 'none';
            
            prefixContainer.appendChild(prefixLabel);
            prefixContainer.appendChild(prefixInput);
            prefixContainer.appendChild(prefixSuggestions);
            filterContent.appendChild(prefixContainer);
            
            // 접미사 입력 필드
            const suffixContainer = document.createElement('div');
            suffixContainer.className = 'enchant-search-container';
            
            const suffixLabel = document.createElement('label');
            suffixLabel.className = 'enchant-label';
            suffixLabel.textContent = '접미';
            suffixLabel.setAttribute('for', `suffix-search-${Date.now()}`);
            
            const suffixInput = document.createElement('input');
            suffixInput.id = `suffix-search-${Date.now()}`;
            suffixInput.type = 'text';
            suffixInput.className = 'filter-input enchant-input';
            suffixInput.placeholder = '접미 인챈트...';
            suffixInput.setAttribute('data-type', '접미');
            
            const suffixSuggestions = document.createElement('div');
            suffixSuggestions.className = 'enchant-suggestions';
            suffixSuggestions.style.display = 'none';
            
            suffixContainer.appendChild(suffixLabel);
            suffixContainer.appendChild(suffixInput);
            suffixContainer.appendChild(suffixSuggestions);
            filterContent.appendChild(suffixContainer);
            
            // 자동완성 설정
            setupEnchantAutocomplete(prefixInput, prefixSuggestions, filterItem, filterInfo);
            setupEnchantAutocomplete(suffixInput, suffixSuggestions, filterItem, filterInfo);
            
        } else if (filterInfo.type === 'range') {
            // 범위 입력 컨테이너
            const inputRow = document.createElement('div');
            inputRow.className = 'filter-input-row';
            
            // 최소값 입력
            const minInput = document.createElement('input');
            minInput.type = 'number';
            minInput.className = 'filter-input min-value';
            minInput.placeholder = '최소값';
            minInput.min = 0;
            minInput.setAttribute('aria-label', `${filterInfo.displayName || filterName} 최소값`);
            
            const separator = document.createElement('span');
            separator.className = 'filter-separator';
            separator.textContent = '~';
            
            const maxInput = document.createElement('input');
            maxInput.type = 'number';
            maxInput.className = 'filter-input max-value';
            maxInput.placeholder = '최대값';
            maxInput.min = 0;
            maxInput.setAttribute('aria-label', `${filterInfo.displayName || filterName} 최대값`);
            
            // 퍼센트 필터에 대한 특별 처리
            if (filterInfo.isPercent) {
                // 최소값 포커스 이벤트
                minInput.addEventListener('focus', function() {
                    this.value = this.value.replace('%', '');
                });
                
                // 최소값 블러 이벤트
                minInput.addEventListener('blur', function() {
                    if (this.value && !this.value.includes('%')) {
                        this.value = this.value + '%';
                    }
                });
                
                // 최대값 동일하게 처리
                maxInput.addEventListener('focus', function() {
                    this.value = this.value.replace('%', '');
                });
                
                maxInput.addEventListener('blur', function() {
                    if (this.value && !this.value.includes('%')) {
                        this.value = this.value + '%';
                    }
                });
            }
            
            // 입력 후 자동 적용
            minInput.addEventListener('change', () => autoApplyFilter(filterItem, filterInfo));
            maxInput.addEventListener('change', () => autoApplyFilter(filterItem, filterInfo));
            
            inputRow.appendChild(minInput);
            inputRow.appendChild(separator);
            inputRow.appendChild(maxInput);
            filterContent.appendChild(inputRow);
        } else if (filterInfo.type === 'select' && filterInfo.options && filterInfo.options.length > 0) {
            // 선택형 입력 (드롭다운)
            const select = document.createElement('select');
            select.className = 'filter-input select-value';
            select.setAttribute('aria-label', `${filterInfo.displayName || filterName} 선택`);
            
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '선택하세요';
            select.appendChild(defaultOption);
            
            filterInfo.options.forEach(option => {
                const optionEl = document.createElement('option');
                optionEl.value = option;
                optionEl.textContent = option;
                select.appendChild(optionEl);
            });
            
            // 선택 후 자동 적용
            select.addEventListener('change', () => autoApplyFilter(filterItem, filterInfo));
            
            filterContent.appendChild(select);
        } else {
            // 기본 텍스트 입력
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'filter-input text-value';
            input.placeholder = '값 입력';
            input.setAttribute('aria-label', `${filterInfo.displayName || filterName} 값`);
            
            // 입력 후 자동 적용
            input.addEventListener('change', () => autoApplyFilter(filterItem, filterInfo));
            
            filterContent.appendChild(input);
        }
        
        filterItem.appendChild(filterContent);
        
        // 필터 컨테이너에 추가
        elements.activeFilters.appendChild(filterItem);
    }
    
    /**
     * 인챈트 자동완성 설정
     * @param {HTMLElement} input - 입력 필드
     * @param {HTMLElement} suggestions - 자동완성 컨테이너
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function setupEnchantAutocomplete(input, suggestions, filterItem, filterInfo) {
        // 입력 이벤트
        input.addEventListener('input', function() {
            const query = this.value.trim();
            const type = this.getAttribute('data-type');
            
            // 입력이 없으면 자동완성 숨김
            if (query.length < 1) {
                suggestions.innerHTML = '';
                suggestions.style.display = 'none';
                return;
            }
            
            // 메타데이터 체크
            if (!enchantData.isLoaded) {
                suggestions.innerHTML = '<div class="enchant-suggestion-loading">데이터 로딩 중...</div>';
                suggestions.style.display = 'block';
                return;
            }
            
            // 인챈트 검색
            const results = searchEnchants(type, query);
            
            // 결과 없음
            if (results.length === 0) {
                suggestions.innerHTML = '<div class="enchant-suggestion-empty">검색 결과 없음</div>';
                suggestions.style.display = 'block';
                return;
            }
            
            // 결과 표시
            suggestions.innerHTML = '';
            
            // 최대 5개만 표시
            results.slice(0, 5).forEach(enchant => {
                const item = document.createElement('div');
                item.className = 'enchant-suggestion-item';
                item.textContent = `${enchant.name} (랭크 ${enchant.rank})`;
                
                // 클릭 이벤트
                item.addEventListener('click', () => {
                    // 입력 필드에 선택한 인챈트 설정
                    input.value = enchant.name;
                    
                    // 자동완성 숨김
                    suggestions.style.display = 'none';
                    
                    // 필터 추가
                    addEnchantFilter(filterItem, filterInfo, type, enchant.name, enchant.rank);
                    
                    // 필터 적용
                    applyFilters();
                });
                
                suggestions.appendChild(item);
            });
            
            suggestions.style.display = 'block';
        });
        
        // 포커스 이벤트 (입력창 클릭 시 자동완성 표시)
        input.addEventListener('focus', function() {
            if (this.value.trim().length > 0) {
                const event = new Event('input');
                this.dispatchEvent(event);
            }
        });
        
        // 외부 클릭 시 자동완성 숨김
        document.addEventListener('click', function(e) {
            if (!input.contains(e.target) && !suggestions.contains(e.target)) {
                suggestions.style.display = 'none';
            }
        });
    }
    
    /**
     * 인챈트 검색
     * @param {string} type - 인챈트 타입 (접두 or 접미)
     * @param {string} query - 검색어
     * @returns {Array} 검색 결과
     */
    function searchEnchants(type, query) {
        if (!query || !enchantData.isLoaded) return [];
        
        const source = type === '접두' ? enchantData.prefix : enchantData.suffix;
        if (!source) return [];
        
        const results = [];
        const lowerQuery = query.toLowerCase();
        
        // 객체 순회
        for (const name in source) {
            if (name.toLowerCase().includes(lowerQuery)) {
                const info = source[name];
                results.push({
                    name: name,
                    rank: info.rank
                });
            }
        }
        
        return results;
    }
    
    /**
     * 인챈트 필터 추가
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {string} type - 인챈트 타입 (접두 or 접미)
     * @param {string} name - 인챈트 이름
     * @param {number} rank - 인챈트 랭크
     */
    function addEnchantFilter(filterItem, filterInfo, type, name, rank) {
        // 동일 타입의 인챈트 필터는 하나만 유지
        state.activeFilters = state.activeFilters.filter(f => 
            !(f.type === 'enchant' && f.enchantType === type)
        );
        
        // 인챈트 필터 추가
        state.activeFilters.push({
            name: filterInfo.name,
            displayName: `인챈트 [${type}]`,
            type: 'enchant',
            enchantType: type,
            enchantName: name,
            enchantRank: rank
        });
    }
    
    /**
     * 자동 필터 적용 (입력/선택 완료 시)
     * @param {HTMLElement} filterItem - 필터 항목 요소 
     * @param {Object} filterInfo - 필터 정보
     */
    function autoApplyFilter(filterItem, filterInfo) {
        // 활성 필터에 추가
        addActiveFilter(filterItem, filterInfo);
        
        // 필터 적용
        applyFilters();
    }
    
    /**
     * 활성 필터 추가
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function addActiveFilter(filterItem, filterInfo) {
        const filterName = filterInfo.name;
        logDebug('필터 추가 시작:', filterName);
        
        // 값 수집
        let filterValues = {};
        
        if (filterInfo.type === 'range') {
            const minInput = filterItem.querySelector('.min-value');
            const maxInput = filterItem.querySelector('.max-value');
            
            if (minInput && minInput.value) {
                filterValues.min = parseFloat(minInput.value);
            }
            
            if (maxInput && maxInput.value) {
                filterValues.max = parseFloat(maxInput.value);
            }
        } else if (filterInfo.type === 'select') {
            const select = filterItem.querySelector('.select-value');
            if (select && select.value) {
                filterValues.value = select.value;
            }
        } else {
            const input = filterItem.querySelector('.text-value');
            if (input && input.value) {
                filterValues.value = input.value;
            }
        }
        
        // 유효한 값이 있는지 확인
        const hasValidValues = Object.keys(filterValues).length > 0;
        if (!hasValidValues) {
            logDebug('필터 값 없음, 추가 취소');
            return;
        }
        
        // 같은 이름의 기존 필터 제거
        state.activeFilters = state.activeFilters.filter(f => f.name !== filterName);
        
        // 새 필터 추가
        const newFilter = {
            name: filterName,
            displayName: filterInfo.displayName || filterName,
            type: filterInfo.type,
            field: filterInfo.field,
            ...filterValues
        };
        
        state.activeFilters.push(newFilter);
        logDebug('필터 추가 완료:', newFilter);
    }
    
    /**
     * 활성 필터 제거
     * @param {string} filterName - 필터 이름
     */
    function removeActiveFilter(filterName) {
        // 필터 제거
        state.activeFilters = state.activeFilters.filter(f => f.name !== filterName);
        logDebug(`필터 제거: ${filterName}`);
    }
    
    /**
     * 선택된 필터 UI 업데이트
     */
    function updateSelectedFiltersUI() {
        // 선택된 필터 UI를 별도로 표시하지 않음 (요청에 따라 제거)
    }
    
    /**
     * 필터 적용
     */
    function applyFilters() {
        // 필터 이벤트 발생
        const event = new CustomEvent('filterChanged', {
            detail: {
                filters: state.activeFilters
            }
        });
        
        document.dispatchEvent(event);
        logDebug('필터 변경 이벤트 발생:', state.activeFilters);
    }
    
    /**
     * 아이템이 필터를 통과하는지 확인
     * @param {Object} item - 아이템 객체
     * @returns {boolean} 필터 통과 여부
     */
    function itemPassesFilters(item) {
        // 활성 필터가 없으면 모든 아이템 통과
        if (state.activeFilters.length === 0) {
            return true;
        }
        
        // 모든 필터를 통과해야 함
        return state.activeFilters.every(filter => {
            // 인챈트 필터 특별 처리
            if (filter.type === 'enchant') {
                return checkEnchantFilter(item, filter);
            }
            
            // 아이템 옵션 필드 표준화
            const options = item.options || item.item_option || [];
            
            // 필터 유형에 따른 검사
            switch (filter.type) {
                case 'range':
                    return checkRangeFilter(options, filter);
                    
                case 'select':
                    return checkSelectFilter(options, filter);
                    
                default:
                    return checkTextFilter(options, filter);
            }
        });
    }
    
    /**
     * 인챈트 필터 체크
     * @param {Object} item - 아이템 객체
     * @param {Object} filter - 필터 객체
     * @returns {boolean} 필터 통과 여부
     */
    function checkEnchantFilter(item, filter) {
        // 옵션 필드 표준화
        const options = item.options || item.item_option || [];
        
        // 인챈트 옵션 찾기
        const enchantOptions = options.filter(opt => 
            opt.option_type === '인챈트' && 
            opt.option_sub_type === filter.enchantType
        );
        
        // 인챈트가 없으면 실패
        if (enchantOptions.length === 0) {
            return false;
        }
        
        // 인챈트 이름 체크
        return enchantOptions.some(option => {
            // "충돌의 (랭크 4)" 형식 파싱
            const nameMatch = option.option_value.match(/(.*?)\s*\(랭크 (\d+)\)/);
            if (!nameMatch) return false;
            
            const enchantName = nameMatch[1].trim();
            const enchantRank = parseInt(nameMatch[2]);
            
            // 이름 일치 확인
            return enchantName === filter.enchantName;
        });
    }
    
    /**
     * 범위 필터 체크
     * @param {Array} options - 아이템 옵션 배열
     * @param {Object} filter - 필터 객체
     * @returns {boolean} 필터 통과 여부
     */
    function checkRangeFilter(options, filter) {
        // 필터 필드 가져오기
        const field = filter.field || 'option_value';
        
        // 옵션 찾기 (이름으로)
        const option = options.find(opt => 
            (opt.option_type === filter.name) || 
            (opt.option_name === filter.name)
        );
        
        if (!option) {
            return false;
        }
        
        // 값 확인
        let value;
        if (field in option) {
            // % 제거 처리
            const rawValue = option[field];
            value = typeof rawValue === 'string' 
                ? parseFloat(rawValue.replace('%', '')) 
                : parseFloat(rawValue);
        } else {
            return false;
        }
        
        // 숫자 변환 실패 시
        if (isNaN(value)) {
            return false;
        }
        
        // 범위 검사
        if (filter.min !== undefined && value < filter.min) {
            return false;
        }
        if (filter.max !== undefined && value > filter.max) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 선택 필터 체크
     * @param {Array} options - 아이템 옵션 배열
     * @param {Object} filter - 필터 객체
     * @returns {boolean} 필터 통과 여부
     */
    function checkSelectFilter(options, filter) {
        // 옵션 찾기
        const option = options.find(opt => 
            (opt.option_type === filter.name) || 
            (opt.option_name === filter.name)
        );
        
        if (!option) return false;
        
        // 값 확인
        return option.option_value === filter.value ||
               option.option_sub_type === filter.value;
    }
    
    /**
     * 텍스트 필터 체크
     * @param {Array} options - 아이템 옵션 배열
     * @param {Object} filter - 필터 객체
     * @returns {boolean} 필터 통과 여부
     */
    function checkTextFilter(options, filter) {
        // 옵션 찾기
        const option = options.find(opt => 
            (opt.option_type === filter.name) || 
            (opt.option_name === filter.name)
        );
        
        if (!option) return false;
        
        // 값 확인 (부분 일치)
        return option.option_value && 
               option.option_value.toString().toLowerCase().includes(filter.value.toLowerCase());
    }
    
    /**
     * 필터 초기화
     */
    function resetFilters() {
        state.activeFilters = [];
        
        // 활성 필터 UI 초기화
        if (elements.activeFilters) {
            elements.activeFilters.innerHTML = '';
        }
        
        logDebug('필터 초기화 완료');
    }
    
    /**
     * 현재 필터 상태 가져오기
     * @returns {Object} 필터 상태
     */
    function getFilters() {
        return {
            availableFilters: state.availableFilters,
            activeFilters: state.activeFilters
        };
    }
    
    // 공개 API
    return {
        init,
        addStyles,
        updateFiltersForCategory,
        itemPassesFilters,
        resetFilters,
        getFilters
    };
})();

export default FilterManager;
