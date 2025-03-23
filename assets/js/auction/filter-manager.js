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
        debug: false, // 디버그 모드 (true로 설정하면 상세 로그 출력)
        reforgeData: null, // 세공 메타데이터
        setEffectData: null // 세트 효과 메타데이터
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
        
        // 세공 메타데이터 로드
        loadReforgeMetadata();
        
        // 세트 효과 메타데이터 로드
        loadSetEffectMetadata();
        
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
     * 세공 메타데이터 로드
     */
    async function loadReforgeMetadata() {
        try {
            const response = await fetch('../../data/meta/reforges/reforges.json');
            if (response.ok) {
                state.reforgeData = await response.json();
                logDebug('세공 메타데이터 로드 완료');
            }
        } catch (error) {
            console.error('세공 메타데이터 로드 실패:', error);
        }
    }
    
    /**
     * 세트 효과 메타데이터 로드
     */
    async function loadSetEffectMetadata() {
        try {
            // 현재 선택된 카테고리가 있으면 해당 카테고리의 세트 효과 로드
            if (state.currentCategory) {
                await loadSetEffectForCategory(state.currentCategory);
            }
        } catch (error) {
            console.error('세트 효과 메타데이터 로드 실패:', error);
        }
    }
    
    /**
     * 카테고리별 세트 효과 메타데이터 로드
     * @param {string} category - 카테고리명
     */
    async function loadSetEffectForCategory(category) {
        try {
            // 카테고리명 안전하게 변환 (/ -> _)
            const safeCategory = category.replace(/\//g, '_');
            
            const response = await fetch(`../../data/meta/set_bonus/${encodeURIComponent(safeCategory)}.json`);
            if (response.ok) {
                state.setEffectData = await response.json();
                logDebug(`카테고리 ${category}의 세트 효과 메타데이터 로드 완료`);
            }
        } catch (error) {
            console.warn(`카테고리 ${category}의 세트 효과 메타데이터 로드 실패:`, error);
            state.setEffectData = null;
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
            
            // 세트 효과 메타데이터 로드
            loadSetEffectForCategory(category);
            
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
        
        // 필터 유형에 따른 처리
        if (filterInfo.type === 'reforge-status') {
            // 세공 상태 필터 (랭크 + 발현 수)
            createReforgeStatusFilter(filterContent, filterItem, filterInfo);
        } else if (filterInfo.type === 'reforge-option') {
            // 세공 옵션 필터
            createReforgeOptionFilter(filterContent, filterItem, filterInfo);
        } else if (filterInfo.type === 'erg') {
            // 에르그 필터
            createErgFilter(filterContent, filterItem, filterInfo);
        } else if (filterInfo.type === 'set-effect') {
            // 세트 효과 필터
            createSetEffectFilter(filterContent, filterItem, filterInfo);
        } else if (filterInfo.name === '특별 개조') {
            // 특별 개조 필터 특별 처리
            createSpecialModFilter(filterContent, filterItem, filterInfo);
        } else if (filterInfo.type === 'enchant') {
            // 인챈트 검색 UI (접두/접미 별도 필드)
            createEnchantFilter(filterContent, filterItem, filterInfo);
        } else if (filterInfo.type === 'range') {
            // 범위 입력 컨테이너
            createRangeFilter(filterContent, filterItem, filterInfo);
        } else if (filterInfo.type === 'select' && filterInfo.options && filterInfo.options.length > 0) {
            // 선택형 입력 (드롭다운)
            createSelectFilter(filterContent, filterItem, filterInfo);
        } else {
            // 기본 텍스트 입력
            createTextFilter(filterContent, filterItem, filterInfo);
        }
        
        filterItem.appendChild(filterContent);
        
        // 필터 컨테이너에 추가
        elements.activeFilters.appendChild(filterItem);
    }
    
    /**
     * 세공 상태 필터 생성 (랭크 + 발현 수)
     * @param {HTMLElement} container - 필터 컨테이너
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function createReforgeStatusFilter(container, filterItem, filterInfo) {
        // 1. 세공 랭크 선택 섹션
        const rankSection = document.createElement('div');
        rankSection.className = 'filter-section';
        
        const rankLabel = document.createElement('div');
        rankLabel.className = 'filter-section-label';
        rankLabel.textContent = '세공 랭크:';
        rankSection.appendChild(rankLabel);
        
        // 랭크 버튼 컨테이너
        const rankButtons = document.createElement('div');
        rankButtons.className = 'special-mod-buttons';
        
        // 랭크 버튼 생성 (1, 2, 3)
        for (let i = 1; i <= 3; i++) {
            const button = document.createElement('button');
            button.className = 'special-mod-btn';
            button.textContent = i;
            button.setAttribute('data-rank', i);
            
            // 버튼 클릭 이벤트
            button.addEventListener('click', () => {
                // 토글 효과
                const isActive = button.classList.contains('active');
                button.classList.toggle('active', !isActive);
                
                // 필터 적용
                applyReforgeRankFilter(filterItem, filterInfo);
            });
            
            rankButtons.appendChild(button);
        }
        
        rankSection.appendChild(rankButtons);
        container.appendChild(rankSection);
        
        // 2. 발현 수 선택 섹션
        const countSection = document.createElement('div');
        countSection.className = 'filter-section';
        
        const countLabel = document.createElement('div');
        countLabel.className = 'filter-section-label';
        countLabel.textContent = '세공 발현 수:';
        countSection.appendChild(countLabel);
        
        // 발현 수 버튼 컨테이너
        const countButtons = document.createElement('div');
        countButtons.className = 'special-mod-buttons';
        
        // 발현 수 버튼 생성 (1, 2, 3)
        for (let i = 1; i <= 3; i++) {
            const button = document.createElement('button');
            button.className = 'special-mod-btn';
            button.textContent = i;
            button.setAttribute('data-count', i);
            
            // 버튼 클릭 이벤트
            button.addEventListener('click', () => {
                // 토글 효과
                const isActive = button.classList.contains('active');
                button.classList.toggle('active', !isActive);
                
                // 필터 적용
                applyReforgeCountFilter(filterItem, filterInfo);
            });
            
            countButtons.appendChild(button);
        }
        
        countSection.appendChild(countButtons);
        container.appendChild(countSection);
    }
    
    /**
     * 세공 옵션 필터 생성
     * @param {HTMLElement} container - 필터 컨테이너
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function createReforgeOptionFilter(container, filterItem, filterInfo) {
        // 현재 카테고리의 세공 옵션 가져오기
        const reforgeOptions = getReforgeOptionsForCategory(state.currentCategory);
        
        // 세공 옵션이 없는 경우
        if (!reforgeOptions || reforgeOptions.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'filter-message';
            emptyMessage.textContent = '현재 카테고리에 세공 옵션이 없습니다.';
            container.appendChild(emptyMessage);
            return;
        }
        
        // 3개의 세공 옵션 입력 필드 생성
        for (let i = 1; i <= 3; i++) {
            const optionContainer = document.createElement('div');
            optionContainer.className = 'reforge-option-container';
            
            // 입력 필드 생성
            const inputContainer = document.createElement('div');
            inputContainer.className = 'enchant-search-container';
            
            const inputLabel = document.createElement('label');
            inputLabel.className = 'enchant-label';
            inputLabel.textContent = `세공 옵션 ${i}:`;
            inputLabel.setAttribute('for', `reforge-option-${i}-${Date.now()}`);
            
            const input = document.createElement('input');
            input.id = `reforge-option-${i}-${Date.now()}`;
            input.className = 'filter-input reforge-option-input';
            input.placeholder = '세공 옵션 입력...';
            input.setAttribute('data-index', i);
            
            const suggestions = document.createElement('div');
            suggestions.className = 'enchant-suggestions';
            suggestions.style.display = 'none';
            
            inputContainer.appendChild(inputLabel);
            inputContainer.appendChild(input);
            inputContainer.appendChild(suggestions);
            optionContainer.appendChild(inputContainer);
            
            // 범위 필터 컨테이너 (처음에는 숨김)
            const rangeContainer = document.createElement('div');
            rangeContainer.className = 'range-filter-container';
            rangeContainer.style.display = 'none';
            rangeContainer.style.marginTop = '8px';
            
            optionContainer.appendChild(rangeContainer);
            container.appendChild(optionContainer);
            
            // 자동완성 설정
            setupReforgeOptionAutocomplete(input, suggestions, rangeContainer, filterItem, filterInfo);
        }
    }
    
    /**
     * 세공 옵션 자동완성 설정
     * @param {HTMLElement} input - 입력 필드
     * @param {HTMLElement} suggestions - 자동완성 컨테이너
     * @param {HTMLElement} rangeContainer - 범위 필터 컨테이너
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function setupReforgeOptionAutocomplete(input, suggestions, rangeContainer, filterItem, filterInfo) {
        // 입력 이벤트
        input.addEventListener('input', function() {
            const query = this.value.trim();
            const index = parseInt(this.getAttribute('data-index'));
            
            // 입력이 없으면 자동완성 숨김
            if (query.length < 1) {
                suggestions.innerHTML = '';
                suggestions.style.display = 'none';
                
                // 범위 필터도 숨김
                rangeContainer.style.display = 'none';
                return;
            }
            
            // 세공 옵션 검색
            const results = searchReforgeOptions(query);
            
            // 결과 없음
            if (results.length === 0) {
                suggestions.innerHTML = '<div class="enchant-suggestion-empty">검색 결과 없음</div>';
                suggestions.style.display = 'block';
                return;
            }
            
            // 결과 표시
            suggestions.innerHTML = '';
            
            // 최대 10개만 표시
            results.slice(0, 10).forEach(option => {
                const item = document.createElement('div');
                item.className = 'enchant-suggestion-item';
                item.textContent = option;
                
                // 클릭 이벤트
                item.addEventListener('click', () => {
                    // 입력 필드에 선택한 옵션 설정
                    input.value = option;
                    
                    // 자동완성 숨김
                    suggestions.style.display = 'none';
                    
                    // 범위 필터 표시
                    createReforgeOptionRangeFilter(rangeContainer, option, index, filterItem, filterInfo);
                    
                    // 필터 추가
                    addReforgeOptionFilter(filterItem, filterInfo, index, option);
                    
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
     * 세공 옵션 범위 필터 생성
     * @param {HTMLElement} container - 범위 필터 컨테이너
     * @param {string} option - 선택된 세공 옵션
     * @param {number} index - 세공 옵션 인덱스
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function createReforgeOptionRangeFilter(container, option, index, filterItem, filterInfo) {
        // 컨테이너 초기화
        container.innerHTML = '';
        container.style.display = 'block';
        
        // 레이블 생성
        const label = document.createElement('div');
        label.className = 'filter-section-label';
        label.textContent = `${option} 수치 범위:`;
        container.appendChild(label);
        
        // 범위 입력 생성
        const inputRow = document.createElement('div');
        inputRow.className = 'filter-input-row';
        
        // 최소값 입력
        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.className = 'filter-input min-value';
        minInput.placeholder = '최소값';
        minInput.min = 0;
        minInput.setAttribute('data-index', index);
        minInput.setAttribute('data-option', option);
        minInput.setAttribute('aria-label', `${option} 최소값`);
        
        const separator = document.createElement('span');
        separator.className = 'filter-separator';
        separator.textContent = '~';
        
        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.className = 'filter-input max-value';
        maxInput.placeholder = '최대값';
        maxInput.min = 0;
        maxInput.setAttribute('data-index', index);
        maxInput.setAttribute('data-option', option);
        maxInput.setAttribute('aria-label', `${option} 최대값`);
        
        // 범위 입력 이벤트
        minInput.addEventListener('change', () => updateReforgeOptionRange(filterItem, filterInfo, index, option, minInput, maxInput));
        maxInput.addEventListener('change', () => updateReforgeOptionRange(filterItem, filterInfo, index, option, minInput, maxInput));
        
        // 입력 행에 요소 추가
        inputRow.appendChild(minInput);
        inputRow.appendChild(separator);
        inputRow.appendChild(maxInput);
        
        // 컨테이너에 추가
        container.appendChild(inputRow);
    }
    
    /**
     * 세공 옵션 범위 업데이트
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {number} index - 세공 옵션 인덱스
     * @param {string} option - 세공 옵션 이름
     * @param {HTMLElement} minInput - 최소값 입력 필드
     * @param {HTMLElement} maxInput - 최대값 입력 필드
     */
    function updateReforgeOptionRange(filterItem, filterInfo, index, option, minInput, maxInput) {
        // 값 가져오기
        const min = minInput.value ? parseFloat(minInput.value) : undefined;
        const max = maxInput.value ? parseFloat(maxInput.value) : undefined;
        
        // 필터 업데이트
        updateReforgeOptionFilter(filterItem, filterInfo, index, option, min, max);
        
        // 필터 적용
        applyFilters();
    }
    
    /**
     * 에르그 필터 생성
     * @param {HTMLElement} container - 필터 컨테이너
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function createErgFilter(container, filterItem, filterInfo) {
        // 1. 에르그 등급 선택 섹션
        const gradeSection = document.createElement('div');
        gradeSection.className = 'filter-section';
        
        const gradeLabel = document.createElement('div');
        gradeLabel.className = 'filter-section-label';
        gradeLabel.textContent = '에르그 등급:';
        gradeSection.appendChild(gradeLabel);
        
        // 등급 버튼 컨테이너
        const gradeButtons = document.createElement('div');
        gradeButtons.className = 'special-mod-buttons';
        
        // 등급 버튼 생성 (S, A, B)
        const grades = ['S', 'A', 'B'];
        grades.forEach(grade => {
            const button = document.createElement('button');
            button.className = 'special-mod-btn';
            button.textContent = grade;
            button.setAttribute('data-grade', grade);
            
            // 버튼 클릭 이벤트
            button.addEventListener('click', () => {
                // 다른 버튼 비활성화
                gradeButtons.querySelectorAll('.special-mod-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // 현재 버튼 활성화/비활성화 토글
                const isActive = button.classList.contains('active');
                button.classList.toggle('active', !isActive);
                
                // 필터 적용
                applyErgGradeFilter(filterItem, filterInfo, !isActive ? grade : null);
            });
            
            gradeButtons.appendChild(button);
        });
        
        gradeSection.appendChild(gradeButtons);
        container.appendChild(gradeSection);
        
        // 2. 에르그 레벨 범위 섹션
        const levelSection = document.createElement('div');
        levelSection.className = 'filter-section';
        
        const levelLabel = document.createElement('div');
        levelLabel.className = 'filter-section-label';
        levelLabel.textContent = '에르그 레벨:';
        levelSection.appendChild(levelLabel);
        
        // 범위 입력 생성
        const inputRow = document.createElement('div');
        inputRow.className = 'filter-input-row';
        
        // 최소값 입력
        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.className = 'filter-input min-value';
        minInput.placeholder = '최소값';
        minInput.min = 0;
        minInput.max = 50;
        minInput.setAttribute('aria-label', '에르그 레벨 최소값');
        
        const separator = document.createElement('span');
        separator.className = 'filter-separator';
        separator.textContent = '~';
        
        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.className = 'filter-input max-value';
        maxInput.placeholder = '최대값';
        maxInput.min = 0;
        maxInput.max = 50;
        maxInput.setAttribute('aria-label', '에르그 레벨 최대값');
        
        // 범위 입력 이벤트
        minInput.addEventListener('change', () => applyErgLevelFilter(filterItem, filterInfo, minInput, maxInput));
        maxInput.addEventListener('change', () => applyErgLevelFilter(filterItem, filterInfo, minInput, maxInput));
        
        // 입력 행에 요소 추가
        inputRow.appendChild(minInput);
        inputRow.appendChild(separator);
        inputRow.appendChild(maxInput);
        
        // 컨테이너에 추가
        levelSection.appendChild(inputRow);
        container.appendChild(levelSection);
    }
    
    /**
     * 세트 효과 필터 생성
     * @param {HTMLElement} container - 필터 컨테이너
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function createSetEffectFilter(container, filterItem, filterInfo) {
        // 현재 카테고리의 세트 효과 가져오기
        const setEffects = getSetEffectsForCategory();
        
        // 세트 효과가 없는 경우
        if (!setEffects || setEffects.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'filter-message';
            emptyMessage.textContent = '현재 카테고리에 세트 효과가 없습니다.';
            container.appendChild(emptyMessage);
            return;
        }
        
        // 3개의 세트 효과 입력 필드 생성
        for (let i = 1; i <= 3; i++) {
            const effectContainer = document.createElement('div');
            effectContainer.className = 'set-effect-container';
            
            // 입력 필드 생성
            const inputContainer = document.createElement('div');
            inputContainer.className = 'enchant-search-container';
            
            const inputLabel = document.createElement('label');
            inputLabel.className = 'enchant-label';
            inputLabel.textContent = `세트 효과 ${i}:`;
            inputLabel.setAttribute('for', `set-effect-${i}-${Date.now()}`);
            
            const input = document.createElement('input');
            input.id = `set-effect-${i}-${Date.now()}`;
            input.className = 'filter-input set-effect-input';
            input.placeholder = '세트 효과 입력...';
            input.setAttribute('data-index', i);
            
            const suggestions = document.createElement('div');
            suggestions.className = 'enchant-suggestions';
            suggestions.style.display = 'none';
            
            inputContainer.appendChild(inputLabel);
            inputContainer.appendChild(input);
            inputContainer.appendChild(suggestions);
            effectContainer.appendChild(inputContainer);
            
            // 범위 필터 컨테이너 (처음에는 숨김)
            const rangeContainer = document.createElement('div');
            rangeContainer.className = 'range-filter-container';
            rangeContainer.style.display = 'none';
            rangeContainer.style.marginTop = '8px';
            
            effectContainer.appendChild(rangeContainer);
            container.appendChild(effectContainer);
            
            // 자동완성 설정
            setupSetEffectAutocomplete(input, suggestions, rangeContainer, filterItem, filterInfo);
        }
    }
    
    /**
     * 세트 효과 자동완성 설정
     * @param {HTMLElement} input - 입력 필드
     * @param {HTMLElement} suggestions - 자동완성 컨테이너
     * @param {HTMLElement} rangeContainer - 범위 필터 컨테이너
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function setupSetEffectAutocomplete(input, suggestions, rangeContainer, filterItem, filterInfo) {
        // 입력 이벤트
        input.addEventListener('input', function() {
            const query = this.value.trim();
            const index = parseInt(this.getAttribute('data-index'));
            
            // 입력이 없으면 자동완성 숨김
            if (query.length < 1) {
                suggestions.innerHTML = '';
                suggestions.style.display = 'none';
                
                // 범위 필터도 숨김
                rangeContainer.style.display = 'none';
                return;
            }
            
            // 세트 효과 검색
            const results = searchSetEffects(query);
            
            // 결과 없음
            if (results.length === 0) {
                suggestions.innerHTML = '<div class="enchant-suggestion-empty">검색 결과 없음</div>';
                suggestions.style.display = 'block';
                return;
            }
            
            // 결과 표시
            suggestions.innerHTML = '';
            
            // 최대 10개만 표시
            results.slice(0, 10).forEach(effect => {
                const item = document.createElement('div');
                item.className = 'enchant-suggestion-item';
                item.textContent = effect;
                
                // 클릭 이벤트
                item.addEventListener('click', () => {
                    // 입력 필드에 선택한 효과 설정
                    input.value = effect;
                    
                    // 자동완성 숨김
                    suggestions.style.display = 'none';
                    
                    // 범위 필터 표시
                    createSetEffectRangeFilter(rangeContainer, effect, index, filterItem, filterInfo);
                    
                    // 필터 추가
                    addSetEffectFilter(filterItem, filterInfo, index, effect);
                    
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
     * 세트 효과 범위 필터 생성
     * @param {HTMLElement} container - 범위 필터 컨테이너
     * @param {string} effect - 선택된 세트 효과
     * @param {number} index - 세트 효과 인덱스
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function createSetEffectRangeFilter(container, effect, index, filterItem, filterInfo) {
        // 컨테이너 초기화
        container.innerHTML = '';
        container.style.display = 'block';
        
        // 레이블 생성
        const label = document.createElement('div');
        label.className = 'filter-section-label';
        label.textContent = `${effect} 수치 범위:`;
        container.appendChild(label);
        
        // 범위 입력 생성
        const inputRow = document.createElement('div');
        inputRow.className = 'filter-input-row';
        
        // 최소값 입력
        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.className = 'filter-input min-value';
        minInput.placeholder = '최소값';
        minInput.min = 0;
        minInput.setAttribute('data-index', index);
        minInput.setAttribute('data-effect', effect);
        minInput.setAttribute('aria-label', `${effect} 최소값`);
        
        const separator = document.createElement('span');
        separator.className = 'filter-separator';
        separator.textContent = '~';
        
        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.className = 'filter-input max-value';
        maxInput.placeholder = '최대값';
        maxInput.min = 0;
        maxInput.setAttribute('data-index', index);
        maxInput.setAttribute('data-effect', effect);
        maxInput.setAttribute('aria-label', `${effect} 최대값`);
        
        // 범위 입력 이벤트
        minInput.addEventListener('change', () => updateSetEffectRange(filterItem, filterInfo, index, effect, minInput, maxInput));
        maxInput.addEventListener('change', () => updateSetEffectRange(filterItem, filterInfo, index, effect, minInput, maxInput));
        
        // 입력 행에 요소 추가
        inputRow.appendChild(minInput);
        inputRow.appendChild(separator);
        inputRow.appendChild(maxInput);
        
        // 컨테이너에 추가
        container.appendChild(inputRow);
    }
    
    /**
     * 세트 효과 범위 업데이트
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {number} index - 세트 효과 인덱스
     * @param {string} effect - 세트 효과 이름
     * @param {HTMLElement} minInput - 최소값 입력 필드
     * @param {HTMLElement} maxInput - 최대값 입력 필드
     */
    function updateSetEffectRange(filterItem, filterInfo, index, effect, minInput, maxInput) {
        // 값 가져오기
        const min = minInput.value ? parseInt(minInput.value) : undefined;
        const max = maxInput.value ? parseInt(maxInput.value) : undefined;
        
        // 필터 업데이트
        updateSetEffectFilter(filterItem, filterInfo, index, effect, min, max);
        
        // 필터 적용
        applyFilters();
    }
    
    /**
     * 특별 개조 필터 생성
     * @param {HTMLElement} container - 필터 컨테이너
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function createSpecialModFilter(container, filterItem, filterInfo) {
        // 버튼 그룹 컨테이너
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'special-mod-buttons';
        
        // S 버튼
        const sButton = document.createElement('button');
        sButton.className = 'special-mod-btn';
        sButton.textContent = 'S';
        sButton.setAttribute('data-type', 'S');
        
        // R 버튼
        const rButton = document.createElement('button');
        rButton.className = 'special-mod-btn';
        rButton.textContent = 'R';
        rButton.setAttribute('data-type', 'R');
        
        // X 버튼 (없음)
        const xButton = document.createElement('button');
        xButton.className = 'special-mod-btn';
        xButton.textContent = 'X';
        xButton.setAttribute('data-type', 'X');
        
        // 범위 필터 컨테이너 (기본적으로 숨김)
        const rangeContainer = document.createElement('div');
        rangeContainer.className = 'range-filter-container';
        rangeContainer.style.display = 'none';
        rangeContainer.style.marginTop = '8px';
        
        // 범위 입력 필드
        const inputRow = document.createElement('div');
        inputRow.className = 'filter-input-row';
        
        // 최소값 입력
        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.className = 'filter-input min-value';
        minInput.placeholder = '최소값';
        minInput.min = 0;
        minInput.setAttribute('aria-label', `${filterInfo.displayName} 최소값`);
        
        const separator = document.createElement('span');
        separator.className = 'filter-separator';
        separator.textContent = '~';
        
        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.className = 'filter-input max-value';
        maxInput.placeholder = '최대값';
        maxInput.min = 0;
        maxInput.setAttribute('aria-label', `${filterInfo.displayName} 최대값`);
        
        // 범위 입력 이벤트
        minInput.addEventListener('change', () => applySpecialModFilter(filterItem, filterInfo, rangeContainer));
        maxInput.addEventListener('change', () => applySpecialModFilter(filterItem, filterInfo, rangeContainer));
        
        // 범위 컨테이너에 요소 추가
        inputRow.appendChild(minInput);
        inputRow.appendChild(separator);
        inputRow.appendChild(maxInput);
        rangeContainer.appendChild(inputRow);
        
        // 버튼 이벤트 설정
        [sButton, rButton, xButton].forEach(button => {
            button.addEventListener('click', () => {
                const type = button.getAttribute('data-type');
                const isActive = button.classList.contains('active');
                
                // 모든 버튼 비활성화
                [sButton, rButton, xButton].forEach(btn => btn.classList.remove('active'));
                
                // 이미 활성화된 버튼을 다시 클릭하면 토글 오프
                if (isActive) {
                    rangeContainer.style.display = 'none';
                    // 필터 제거
                    removeSpecialModTypeFilter(filterInfo.name);
                    applyFilters();
                    return;
                }
                
                // 버튼 활성화
                button.classList.add('active');
                
                // X 버튼이면 범위 숨기고, 다른 버튼이면 범위 표시
                if (type === 'X') {
                    rangeContainer.style.display = 'none';
                    // 특별 개조 없음 필터 적용
                    applySpecialModNoneFilter(filterItem, filterInfo);
                } else {
                    rangeContainer.style.display = 'block';
                    // 타입 필터 적용
                    applySpecialModTypeFilter(filterItem, filterInfo, type);
                }
            });
        });
        
        // 버튼 그룹에 버튼 추가
        buttonGroup.appendChild(sButton);
        buttonGroup.appendChild(rButton);
        buttonGroup.appendChild(xButton);
        
        // 필터 컨텐츠에 버튼 그룹과 범위 컨테이너 추가
        container.appendChild(buttonGroup);
        container.appendChild(rangeContainer);
    }
    
    /**
     * 인챈트 필터 생성
     * @param {HTMLElement} container - 필터 컨테이너
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function createEnchantFilter(container, filterItem, filterInfo) {
        // 접두 입력 필드
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
        container.appendChild(prefixContainer);
        
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
        container.appendChild(suffixContainer);
        
        // 자동완성 설정
        setupEnchantAutocomplete(prefixInput, prefixSuggestions, filterItem, filterInfo);
        setupEnchantAutocomplete(suffixInput, suffixSuggestions, filterItem, filterInfo);
    }
    
    /**
     * 범위 필터 생성
     * @param {HTMLElement} container - 필터 컨테이너
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function createRangeFilter(container, filterItem, filterInfo) {
        // 범위 입력 컨테이너
        const inputRow = document.createElement('div');
        inputRow.className = 'filter-input-row';
        
        // 최소값 입력
        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.className = 'filter-input min-value';
        minInput.placeholder = '최소값';
        minInput.min = 0;
        minInput.setAttribute('aria-label', `${filterInfo.displayName || filterInfo.name} 최소값`);
        
        const separator = document.createElement('span');
        separator.className = 'filter-separator';
        separator.textContent = '~';
        
        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.className = 'filter-input max-value';
        maxInput.placeholder = '최대값';
        maxInput.min = 0;
        maxInput.setAttribute('aria-label', `${filterInfo.displayName || filterInfo.name} 최대값`);
        
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
        container.appendChild(inputRow);
    }
    
    /**
     * 선택형 필터 생성
     * @param {HTMLElement} container - 필터 컨테이너
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function createSelectFilter(container, filterItem, filterInfo) {
        // 선택형 입력 (드롭다운)
        const select = document.createElement('select');
        select.className = 'filter-input select-value';
        select.setAttribute('aria-label', `${filterInfo.displayName || filterInfo.name} 선택`);
        
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
        
        container.appendChild(select);
    }
    
    /**
     * 텍스트 필터 생성
     * @param {HTMLElement} container - 필터 컨테이너
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function createTextFilter(container, filterItem, filterInfo) {
        // 기본 텍스트 입력
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'filter-input text-value';
        input.placeholder = '값 입력';
        input.setAttribute('aria-label', `${filterInfo.displayName || filterInfo.name} 값`);
        
        // 입력 후 자동 적용
        input.addEventListener('change', () => autoApplyFilter(filterItem, filterInfo));
        
        container.appendChild(input);
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
     * 세공 옵션 검색
     * @param {string} query - 검색어
     * @returns {Array} 검색 결과
     */
    function searchReforgeOptions(query) {
        if (!query || !state.reforgeData) return [];
        
        const options = getReforgeOptionsForCategory(state.currentCategory);
        if (!options) return [];
        
        const lowerQuery = query.toLowerCase();
        
        // 옵션 중 검색어가 포함된 것만 반환
        return options.filter(option => 
            option.toLowerCase().includes(lowerQuery)
        );
    }
    
    /**
     * 세트 효과 검색
     * @param {string} query - 검색어
     * @returns {Array} 검색 결과
     */
    function searchSetEffects(query) {
        if (!query || !state.setEffectData) return [];
        
        const effects = getSetEffectsForCategory();
        if (!effects) return [];
        
        const lowerQuery = query.toLowerCase();
        
        // 효과 중 검색어가 포함된 것만 반환
        return effects.filter(effect => 
            effect.toLowerCase().includes(lowerQuery)
        );
    }
    
    /**
     * 현재 카테고리의 세공 옵션 목록 가져오기
     * @param {string} category - 카테고리명 (기본값은 현재 카테고리)
     * @returns {Array} 세공 옵션 목록
     */
    function getReforgeOptionsForCategory(category = state.currentCategory) {
        if (!state.reforgeData || !category) return [];
        
        const reforges = state.reforgeData.reforges;
        if (!reforges || !reforges[category]) return [];
        
        return reforges[category];
    }
    
    /**
     * 현재 카테고리의 세트 효과 목록 가져오기
     * @returns {Array} 세트 효과 목록
     */
    function getSetEffectsForCategory() {
        if (!state.setEffectData || !state.setEffectData.set_effects) return [];
        
        return state.setEffectData.set_effects;
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
     * 세공 랭크 필터 적용
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function applyReforgeRankFilter(filterItem, filterInfo) {
        // 활성화된 랭크 버튼들 가져오기
        const activeButtons = filterItem.querySelectorAll('.special-mod-btn[data-rank].active');
        
        // 활성화된 랭크가 없으면 필터 제거
        if (activeButtons.length === 0) {
            state.activeFilters = state.activeFilters.filter(f => 
                f.type !== 'reforge-rank'
            );
        } else {
            // 활성화된 랭크값 배열 생성
            const ranks = Array.from(activeButtons).map(btn => 
                parseInt(btn.getAttribute('data-rank'))
            );
            
            // 기존 랭크 필터 제거
            state.activeFilters = state.activeFilters.filter(f => 
                f.type !== 'reforge-rank'
            );
            
            // 새 랭크 필터 추가
            state.activeFilters.push({
                name: filterInfo.name,
                displayName: '세공 랭크',
                type: 'reforge-rank',
                ranks: ranks
            });
        }
        
        // 필터 적용
        applyFilters();
    }
    
    /**
     * 세공 발현 수 필터 적용
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function applyReforgeCountFilter(filterItem, filterInfo) {
        // 활성화된 발현 수 버튼들 가져오기
        const activeButtons = filterItem.querySelectorAll('.special-mod-btn[data-count].active');
        
        // 활성화된 발현 수가 없으면 필터 제거
        if (activeButtons.length === 0) {
            state.activeFilters = state.activeFilters.filter(f => 
                f.type !== 'reforge-count'
            );
        } else {
            // 활성화된 발현 수 배열 생성
            const counts = Array.from(activeButtons).map(btn => 
                parseInt(btn.getAttribute('data-count'))
            );
            
            // 기존 발현 수 필터 제거
            state.activeFilters = state.activeFilters.filter(f => 
                f.type !== 'reforge-count'
            );
            
            // 새 발현 수 필터 추가
            state.activeFilters.push({
                name: filterInfo.name,
                displayName: '세공 발현 수',
                type: 'reforge-count',
                counts: counts
            });
        }
        
        // 필터 적용
        applyFilters();
    }
    
    /**
     * 세공 옵션 필터 추가
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {number} index - 세공 옵션 인덱스
     * @param {string} option - 세공 옵션 이름
     */
    function addReforgeOptionFilter(filterItem, filterInfo, index, option) {
        // 같은 인덱스의 필터 제거
        state.activeFilters = state.activeFilters.filter(f => 
            !(f.type === 'reforge-option' && f.index === index)
        );
        
        // 새 필터 추가
        state.activeFilters.push({
            name: filterInfo.name,
            displayName: `세공 옵션 ${index}`,
            type: 'reforge-option',
            index: index,
            option: option
        });
    }
    
    /**
     * 세공 옵션 범위 필터 업데이트
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {number} index - 세공 옵션 인덱스
     * @param {string} option - 세공 옵션 이름
     * @param {number} min - 최소값
     * @param {number} max - 최대값
     */
    function updateReforgeOptionFilter(filterItem, filterInfo, index, option, min, max) {
        // 현재 인덱스의 필터 찾기
        const existingFilter = state.activeFilters.find(f => 
            f.type === 'reforge-option' && f.index === index
        );
        
        // 필터가 없으면 새로 추가
        if (!existingFilter) {
            addReforgeOptionFilter(filterItem, filterInfo, index, option);
        }
        
        // 범위 필터 추가/업데이트
        state.activeFilters = state.activeFilters.map(f => {
            if (f.type === 'reforge-option' && f.index === index) {
                return {
                    ...f,
                    min: min,
                    max: max
                };
            }
            return f;
        });
    }
    
    /**
     * 에르그 등급 필터 적용
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {string} grade - 에르그 등급 (S, A, B)
     */
    function applyErgGradeFilter(filterItem, filterInfo, grade) {
        // 기존 등급 필터 제거
        state.activeFilters = state.activeFilters.filter(f => 
            f.type !== 'erg-grade'
        );
        
        // 등급이 있으면 필터 추가
        if (grade) {
            state.activeFilters.push({
                name: filterInfo.name,
                displayName: `에르그 등급`,
                type: 'erg-grade',
                grade: grade
            });
        }
        
        // 필터 적용
        applyFilters();
    }
    
    /**
     * 에르그 레벨 필터 적용
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {HTMLElement} minInput - 최소값 입력 필드
     * @param {HTMLElement} maxInput - 최대값 입력 필드
     */
    function applyErgLevelFilter(filterItem, filterInfo, minInput, maxInput) {
        // 값 가져오기
        const min = minInput.value ? parseInt(minInput.value) : undefined;
        const max = maxInput.value ? parseInt(maxInput.value) : undefined;
        
        // 값이 모두 없으면 필터 제거
        if (min === undefined && max === undefined) {
            state.activeFilters = state.activeFilters.filter(f => 
                f.type !== 'erg-level'
            );
        } else {
            // 기존 레벨 필터 제거
            state.activeFilters = state.activeFilters.filter(f => 
                f.type !== 'erg-level'
            );
            
            // 새 레벨 필터 추가
            state.activeFilters.push({
                name: filterInfo.name,
                displayName: '에르그 레벨',
                type: 'erg-level',
                min: min,
                max: max
            });
        }
        
        // 필터 적용
        applyFilters();
    }
    
    /**
     * 세트 효과 필터 추가
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {number} index - 세트 효과 인덱스
     * @param {string} effect - 세트 효과 이름
     */
    function addSetEffectFilter(filterItem, filterInfo, index, effect) {
        // 같은 인덱스의 필터 제거
        state.activeFilters = state.activeFilters.filter(f => 
            !(f.type === 'set-effect' && f.index === index)
        );
        
        // 새 필터 추가
        state.activeFilters.push({
            name: filterInfo.name,
            displayName: `세트 효과 ${index}`,
            type: 'set-effect',
            index: index,
            effect: effect
        });
    }
    
    /**
     * 세트 효과 범위 필터 업데이트
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {number} index - 세트 효과 인덱스
     * @param {string} effect - 세트 효과 이름
     * @param {number} min - 최소값
     * @param {number} max - 최대값
     */
    function updateSetEffectFilter(filterItem, filterInfo, index, effect, min, max) {
        // 현재 인덱스의 필터 찾기
        const existingFilter = state.activeFilters.find(f => 
            f.type === 'set-effect' && f.index === index
        );
        
        // 필터가 없으면 새로 추가
        if (!existingFilter) {
            addSetEffectFilter(filterItem, filterInfo, index, effect);
        }
        
        // 범위 필터 추가/업데이트
        state.activeFilters = state.activeFilters.map(f => {
            if (f.type === 'set-effect' && f.index === index) {
                return {
                    ...f,
                    min: min,
                    max: max
                };
            }
            return f;
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
     * 특별 개조 타입 필터 적용
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {string} type - 특별 개조 타입 (S 또는 R)
     */
    function applySpecialModTypeFilter(filterItem, filterInfo, type) {
        // 같은 이름의 기존 필터 제거
        state.activeFilters = state.activeFilters.filter(f => f.name !== filterInfo.name);
        
        // 새 필터 추가
        const newFilter = {
            name: filterInfo.name,
            displayName: `특별개조 ${type}`,
            type: 'special-mod-type',
            modType: type
        };
        
        state.activeFilters.push(newFilter);
        applyFilters();
    }
    
    /**
     * 특별 개조 범위 필터 적용
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {HTMLElement} rangeContainer - 범위 필터 컨테이너
     */
    function applySpecialModFilter(filterItem, filterInfo, rangeContainer) {
        // 현재 활성화된 타입 버튼 찾기
        const activeBtn = filterItem.querySelector('.special-mod-btn.active');
        if (!activeBtn) return;
        
        const type = activeBtn.getAttribute('data-type');
        
        // 값 수집
        const minInput = rangeContainer.querySelector('.min-value');
        const maxInput = rangeContainer.querySelector('.max-value');
        
        let filterValues = {};
        
        if (minInput && minInput.value) {
            filterValues.min = parseFloat(minInput.value);
        }
        
        if (maxInput && maxInput.value) {
            filterValues.max = parseFloat(maxInput.value);
        }
        
        // 유효한 값이 없으면 타입만 유지
        if (Object.keys(filterValues).length === 0) {
            applySpecialModTypeFilter(filterItem, filterInfo, type);
            return;
        }
        
        // 같은 이름의 기존 필터 제거
        state.activeFilters = state.activeFilters.filter(f => f.name !== filterInfo.name);
        
        // 새 필터 추가 (타입 + 범위)
        const newFilter = {
            name: filterInfo.name,
            displayName: `특별개조 ${type}`,
            type: 'special-mod-range',
            modType: type,
            field: 'option_value',
            ...filterValues
        };
        
        state.activeFilters.push(newFilter);
        applyFilters();
    }
    
    /**
     * 특별 개조 없음 필터 적용
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function applySpecialModNoneFilter(filterItem, filterInfo) {
        // 같은 이름의 기존 필터 제거
        state.activeFilters = state.activeFilters.filter(f => f.name !== filterInfo.name);
        
        // 새 필터 추가
        const newFilter = {
            name: filterInfo.name,
            displayName: '특별개조 없음',
            type: 'special-mod-none'
        };
        
        state.activeFilters.push(newFilter);
        applyFilters();
    }
    
    /**
     * 특별 개조 타입 필터 제거
     * @param {string} filterName - 필터 이름
     */
    function removeSpecialModTypeFilter(filterName) {
        // 특별 개조 관련 필터 제거
        state.activeFilters = state.activeFilters.filter(f => 
            f.name !== filterName || 
            (f.type !== 'special-mod-type' && 
             f.type !== 'special-mod-range' &&
             f.type !== 'special-mod-none')
        );
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
            // 세공 관련 필터
            if (filter.type === 'reforge-rank') {
                return checkReforgeRankFilter(item, filter);
            } else if (filter.type === 'reforge-count') {
                return checkReforgeCountFilter(item, filter);
            } else if (filter.type === 'reforge-option') {
                return checkReforgeOptionFilter(item, filter);
            }
            
            // 에르그 관련 필터
            else if (filter.type === 'erg-grade') {
                return checkErgGradeFilter(item, filter);
            } else if (filter.type === 'erg-level') {
                return checkErgLevelFilter(item, filter);
            }
            
            // 세트 효과 필터
            else if (filter.type === 'set-effect') {
                return checkSetEffectFilter(item, filter);
            }
            
            // 특별 개조 필터
            else if (filter.type === 'special-mod-type') {
                return checkSpecialModTypeFilter(item, filter);
            } else if (filter.type === 'special-mod-range') {
                return checkSpecialModRangeFilter(item, filter);
            } else if (filter.type === 'special-mod-none') {
                return checkSpecialModNoneFilter(item);
            }
            
            // 인챈트 필터
            else if (filter.type === 'enchant') {
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
     * 세공 랭크 필터 적용
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function applyReforgeRankFilter(filterItem, filterInfo) {
        // 활성화된 랭크 버튼들 가져오기
        const activeButtons = filterItem.querySelectorAll('.special-mod-btn[data-rank].active');
        
        // 활성화된 랭크가 없으면 필터 제거
        if (activeButtons.length === 0) {
            state.activeFilters = state.activeFilters.filter(f => 
                f.type !== 'reforge-rank'
            );
        } else {
            // 활성화된 랭크값 배열 생성
            const ranks = Array.from(activeButtons).map(btn => 
                parseInt(btn.getAttribute('data-rank'))
            );
            
            // 기존 랭크 필터 제거
            state.activeFilters = state.activeFilters.filter(f => 
                f.type !== 'reforge-rank'
            );
            
            // 새 랭크 필터 추가
            state.activeFilters.push({
                name: filterInfo.name,
                displayName: '세공 랭크',
                type: 'reforge-rank',
                ranks: ranks
            });
        }
        
        // 필터 적용
        applyFilters();
    }
    
    /**
     * 세공 발현 수 필터 적용
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function applyReforgeCountFilter(filterItem, filterInfo) {
        // 활성화된 발현 수 버튼들 가져오기
        const activeButtons = filterItem.querySelectorAll('.special-mod-btn[data-count].active');
        
        // 활성화된 발현 수가 없으면 필터 제거
        if (activeButtons.length === 0) {
            state.activeFilters = state.activeFilters.filter(f => 
                f.type !== 'reforge-count'
            );
        } else {
            // 활성화된 발현 수 배열 생성
            const counts = Array.from(activeButtons).map(btn => 
                parseInt(btn.getAttribute('data-count'))
            );
            
            // 기존 발현 수 필터 제거
            state.activeFilters = state.activeFilters.filter(f => 
                f.type !== 'reforge-count'
            );
            
            // 새 발현 수 필터 추가
            state.activeFilters.push({
                name: filterInfo.name,
                displayName: '세공 발현 수',
                type: 'reforge-count',
                counts: counts
            });
        }
        
        // 필터 적용
        applyFilters();
    }
    
    /**
     * 세공 옵션 필터 추가
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {number} index - 세공 옵션 인덱스
     * @param {string} option - 세공 옵션 이름
     */
    function addReforgeOptionFilter(filterItem, filterInfo, index, option) {
        // 같은 인덱스의 필터 제거
        state.activeFilters = state.activeFilters.filter(f => 
            !(f.type === 'reforge-option' && f.index === index)
        );
        
        // 새 필터 추가
        state.activeFilters.push({
            name: filterInfo.name,
            displayName: `세공 옵션 ${index}`,
            type: 'reforge-option',
            index: index,
            option: option
        });
    }
    
    /**
     * 세공 옵션 범위 필터 업데이트
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {number} index - 세공 옵션 인덱스
     * @param {string} option - 세공 옵션 이름
     * @param {number} min - 최소값
     * @param {number} max - 최대값
     */
    function updateReforgeOptionFilter(filterItem, filterInfo, index, option, min, max) {
        // 현재 인덱스의 필터 찾기
        const existingFilter = state.activeFilters.find(f => 
            f.type === 'reforge-option' && f.index === index
        );
        
        // 필터가 없으면 새로 추가
        if (!existingFilter) {
            addReforgeOptionFilter(filterItem, filterInfo, index, option);
        }
        
        // 범위 필터 추가/업데이트
        state.activeFilters = state.activeFilters.map(f => {
            if (f.type === 'reforge-option' && f.index === index) {
                return {
                    ...f,
                    min: min,
                    max: max
                };
            }
            return f;
        });
    }
    
    /**
     * 에르그 등급 필터 적용
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {string} grade - 에르그 등급 (S, A, B)
     */
    function applyErgGradeFilter(filterItem, filterInfo, grade) {
        // 기존 등급 필터 제거
        state.activeFilters = state.activeFilters.filter(f => 
            f.type !== 'erg-grade'
        );
        
        // 등급이 있으면 필터 추가
        if (grade) {
            state.activeFilters.push({
                name: filterInfo.name,
                displayName: `에르그 등급`,
                type: 'erg-grade',
                grade: grade
            });
        }
        
        // 필터 적용
        applyFilters();
    }
    
    /**
     * 에르그 레벨 필터 적용
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {HTMLElement} minInput - 최소값 입력 필드
     * @param {HTMLElement} maxInput - 최대값 입력 필드
     */
    function applyErgLevelFilter(filterItem, filterInfo, minInput, maxInput) {
        // 값 가져오기
        const min = minInput.value ? parseInt(minInput.value) : undefined;
        const max = maxInput.value ? parseInt(maxInput.value) : undefined;
        
        // 값이 모두 없으면 필터 제거
        if (min === undefined && max === undefined) {
            state.activeFilters = state.activeFilters.filter(f => 
                f.type !== 'erg-level'
            );
        } else {
            // 기존 레벨 필터 제거
            state.activeFilters = state.activeFilters.filter(f => 
                f.type !== 'erg-level'
            );
            
            // 새 레벨 필터 추가
            state.activeFilters.push({
                name: filterInfo.name,
                displayName: '에르그 레벨',
                type: 'erg-level',
                min: min,
                max: max
            });
        }
        
        // 필터 적용
        applyFilters();
    }
    
    /**
     * 세트 효과 필터 추가
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {number} index - 세트 효과 인덱스
     * @param {string} effect - 세트 효과 이름
     */
    function addSetEffectFilter(filterItem, filterInfo, index, effect) {
        // 같은 인덱스의 필터 제거
        state.activeFilters = state.activeFilters.filter(f => 
            !(f.type === 'set-effect' && f.index === index)
        );
        
        // 새 필터 추가
        state.activeFilters.push({
            name: filterInfo.name,
            displayName: `세트 효과 ${index}`,
            type: 'set-effect',
            index: index,
            effect: effect
        });
    }
    
    /**
     * 세트 효과 범위 필터 업데이트
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {number} index - 세트 효과 인덱스
     * @param {string} effect - 세트 효과 이름
     * @param {number} min - 최소값
     * @param {number} max - 최대값
     */
    function updateSetEffectFilter(filterItem, filterInfo, index, effect, min, max) {
        // 현재 인덱스의 필터 찾기
        const existingFilter = state.activeFilters.find(f => 
            f.type === 'set-effect' && f.index === index
        );
        
        // 필터가 없으면 새로 추가
        if (!existingFilter) {
            addSetEffectFilter(filterItem, filterInfo, index, effect);
        }
        
        // 범위 필터 추가/업데이트
        state.activeFilters = state.activeFilters.map(f => {
            if (f.type === 'set-effect' && f.index === index) {
                return {
                    ...f,
                    min: min,
                    max: max
                };
            }
            return f;
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
     * 특별 개조 타입 필터 적용
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {string} type - 특별 개조 타입 (S 또는 R)
     */
    function applySpecialModTypeFilter(filterItem, filterInfo, type) {
        // 같은 이름의 기존 필터 제거
        state.activeFilters = state.activeFilters.filter(f => f.name !== filterInfo.name);
        
        // 새 필터 추가
        const newFilter = {
            name: filterInfo.name,
            displayName: `특별개조 ${type}`,
            type: 'special-mod-type',
            modType: type
        };
        
        state.activeFilters.push(newFilter);
        applyFilters();
    }
    
    /**
     * 특별 개조 범위 필터 적용
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     * @param {HTMLElement} rangeContainer - 범위 필터 컨테이너
     */
    function applySpecialModFilter(filterItem, filterInfo, rangeContainer) {
        // 현재 활성화된 타입 버튼 찾기
        const activeBtn = filterItem.querySelector('.special-mod-btn.active');
        if (!activeBtn) return;
        
        const type = activeBtn.getAttribute('data-type');
        
        // 값 수집
        const minInput = rangeContainer.querySelector('.min-value');
        const maxInput = rangeContainer.querySelector('.max-value');
        
        let filterValues = {};
        
        if (minInput && minInput.value) {
            filterValues.min = parseFloat(minInput.value);
        }
        
        if (maxInput && maxInput.value) {
            filterValues.max = parseFloat(maxInput.value);
        }
        
        // 유효한 값이 없으면 타입만 유지
        if (Object.keys(filterValues).length === 0) {
            applySpecialModTypeFilter(filterItem, filterInfo, type);
            return;
        }
        
        // 같은 이름의 기존 필터 제거
        state.activeFilters = state.activeFilters.filter(f => f.name !== filterInfo.name);
        
        // 새 필터 추가 (타입 + 범위)
        const newFilter = {
            name: filterInfo.name,
            displayName: `특별개조 ${type}`,
            type: 'special-mod-range',
            modType: type,
            field: 'option_value',
            ...filterValues
        };
        
        state.activeFilters.push(newFilter);
        applyFilters();
    }
    
    /**
     * 특별 개조 없음 필터 적용
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function applySpecialModNoneFilter(filterItem, filterInfo) {
        // 같은 이름의 기존 필터 제거
        state.activeFilters = state.activeFilters.filter(f => f.name !== filterInfo.name);
        
        // 새 필터 추가
        const newFilter = {
            name: filterInfo.name,
            displayName: '특별개조 없음',
            type: 'special-mod-none'
        };
        
        state.activeFilters.push(newFilter);
        applyFilters();
    }
    
    /**
     * 특별 개조 타입 필터 제거
     * @param {string} filterName - 필터 이름
     */
    function removeSpecialModTypeFilter(filterName) {
        // 특별 개조 관련 필터 제거
        state.activeFilters = state.activeFilters.filter(f => 
            f.name !== filterName || 
            (f.type !== 'special-mod-type' && 
             f.type !== 'special-mod-range' &&
             f.type !== 'special-mod-none')
        );
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
            // 세공 관련 필터
            if (filter.type === 'reforge-rank') {
                return checkReforgeRankFilter(item, filter);
            } else if (filter.type === 'reforge-count') {
                return checkReforgeCountFilter(item, filter);
            } else if (filter.type === 'reforge-option') {
                return checkReforgeOptionFilter(item, filter);
            }
            
            // 에르그 관련 필터
            else if (filter.type === 'erg-grade') {
                return checkErgGradeFilter(item, filter);
            } else if (filter.type === 'erg-level') {
                return checkErgLevelFilter(item, filter);
            }
            
            // 세트 효과 필터
            else if (filter.type === 'set-effect') {
                return checkSetEffectFilter(item, filter);
            }
            
            // 특별 개조 필터
            else if (filter.type === 'special-mod-type') {
                return checkSpecialModTypeFilter(item, filter);
            } else if (filter.type === 'special-mod-range') {
                return checkSpecialModRangeFilter(item, filter);
            } else if (filter.type === 'special-mod-none') {
                return checkSpecialModNoneFilter(item);
            }
            
            // 인챈트 필터
            else if (filter.type === 'enchant') {
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
     * 세공 랭크 필터 체크
     * @param {Object} item - 아이템 객체
     * @param {Object} filter - 필터 객체
     * @returns {boolean} 필터 통과 여부
     */
    function checkReforgeRankFilter(item, filter) {
        // 옵션 필드 표준화
        const options = item.options || item.item_option || [];
        
        // 세공 랭크 옵션 찾기
        const
        }
        
        // 값 확인
        const value = parseInt(specialModOption.option_value);
        
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
     * 특별 개조 없음 필터 체크
     * @param {Object} item - 아이템 객체
     * @returns {boolean} 필터 통과 여부
     */
    function checkSpecialModNoneFilter(item) {
        // 옵션 필드 표준화
        const options = item.options || item.item_option || [];
        
        // 특별 개조 옵션이 없어야 통과
        return !options.some(opt => opt.option_type === '특별 개조');
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
