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
        
        state.isInitialized = true;
        logDebug('FilterManager 초기화 완료');
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
            if (filter.visible !== false) {
                const option = document.createElement('option');
                option.value = filter.name;
                option.textContent = filter.displayName || filter.name;
                
                // 설명이 있으면 title 속성에 추가
                if (filter.description) {
                    option.title = filter.description;
                }
                
                elements.filterSelector.appendChild(option);
            }
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
        // 실제 필터 이름도 저장 (필터링에 사용될 이름)
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
        if (filterInfo.type === 'range') {
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
