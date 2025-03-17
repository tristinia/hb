/**
 * 필터 관리 모듈
 * 필터 UI 및 필터 적용 로직 관리
 */

const FilterManager = (() => {
    // 필터 상태
    const state = {
        availableFilters: [],
        activeFilters: [],
        currentCategory: null,
        isInitialized: false
    };
    
    // DOM 요소 참조
    let elements = {
        filterSelector: null,
        activeFilters: null,
        selectedFilters: null
    };
    
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
            if (subCategory && subCategory !== state.currentCategory) {
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
        
        console.log('FilterManager 초기화 완료');
        state.isInitialized = true;
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
            
            // 필터 드롭다운 초기화
            elements.filterSelector.innerHTML = '<option value="">옵션 선택...</option>';
            
            // 가용 필터 설정
            state.availableFilters = filters;
            
            // 필터 옵션 추가
            filters.forEach(filter => {
                if (filter.visible !== false) {
                    const option = document.createElement('option');
                    option.value = filter.name;
                    option.textContent = filter.name;
                    elements.filterSelector.appendChild(option);
                }
            });
            
            // 활성 필터 초기화
            state.activeFilters = [];
            if (elements.activeFilters) {
                elements.activeFilters.innerHTML = '';
            }
            updateSelectedFiltersUI();
        } catch (error) {
            console.error('필터 업데이트 중 오류:', error);
            elements.filterSelector.innerHTML = '<option value="">옵션을 로드할 수 없습니다</option>';
        }
    }
    
    /**
     * 카테고리별 필터 옵션 로드
     * @param {string} category - 카테고리 ID
     * @returns {Promise<Array>} 필터 목록
     */
    async function loadFiltersForCategory(category) {
        try {
            // data/option_structure/카테고리별.json 로드
            const response = await fetch(`../../data/option_structure/${category}.json`);
            
            if (!response.ok) {
                throw new Error(`필터 구조 로드 실패: ${response.status}`);
            }
            
            const data = await response.json();
            return data.options || [];
        } catch (error) {
            console.error(`${category} 필터 로드 오류:`, error);
            
            // 대체 경로 시도
            try {
                const fallbackResponse = await fetch(`../../data/option_structure/default.json`);
                if (!fallbackResponse.ok) {
                    throw new Error('기본 필터 로드 실패');
                }
                
                const fallbackData = await fallbackResponse.json();
                return fallbackData.options || [];
            } catch (fallbackError) {
                console.error('기본 필터 로드 실패:', fallbackError);
                return [];
            }
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
        
        // 필터 헤더 (이름 + 삭제 버튼)
        const filterHeader = document.createElement('div');
        filterHeader.className = 'filter-header';
        
        const filterNameSpan = document.createElement('span');
        filterNameSpan.className = 'filter-name';
        filterNameSpan.textContent = filterName;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'filter-remove';
        removeBtn.innerHTML = '×';
        removeBtn.addEventListener('click', () => {
            filterItem.remove();
            removeActiveFilter(filterName);
        });
        
        filterHeader.appendChild(filterNameSpan);
        filterHeader.appendChild(removeBtn);
        filterItem.appendChild(filterHeader);
        
        // 필터 입력 컨텐츠
        const filterContent = document.createElement('div');
        filterContent.className = 'filter-content';
        
        // 필터 유형에 따른 입력 요소 생성
        if (filterInfo.type === 'range') {
            // 범위 입력 (최소, 최대)
            const minInput = document.createElement('input');
            minInput.type = 'number';
            minInput.className = 'filter-input min-value';
            minInput.placeholder = '최소값';
            minInput.min = 0;
            
            const separator = document.createElement('span');
            separator.className = 'filter-separator';
            separator.textContent = '~';
            
            const maxInput = document.createElement('input');
            maxInput.type = 'number';
            maxInput.className = 'filter-input max-value';
            maxInput.placeholder = '최대값';
            maxInput.min = 0;
            
            filterContent.appendChild(minInput);
            filterContent.appendChild(separator);
            filterContent.appendChild(maxInput);
        } else if (filterInfo.type === 'select' && filterInfo.options && filterInfo.options.length > 0) {
            // 선택형 입력 (드롭다운)
            const select = document.createElement('select');
            select.className = 'filter-input select-value';
            
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
            
            filterContent.appendChild(select);
        } else {
            // 기본 텍스트 입력
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'filter-input text-value';
            input.placeholder = '값 입력';
            
            filterContent.appendChild(input);
        }
        
        filterItem.appendChild(filterContent);
        
        // 적용 버튼
        const applyBtn = document.createElement('button');
        applyBtn.className = 'apply-filters';
        applyBtn.textContent = '필터 적용';
        applyBtn.addEventListener('click', () => {
            addActiveFilter(filterItem, filterInfo);
            applyFilters();
        });
        
        filterItem.appendChild(applyBtn);
        
        // 필터 컨테이너에 추가
        elements.activeFilters.appendChild(filterItem);
    }
    
    /**
     * 활성 필터 추가
     * @param {HTMLElement} filterItem - 필터 항목 요소
     * @param {Object} filterInfo - 필터 정보
     */
    function addActiveFilter(filterItem, filterInfo) {
        const filterName = filterInfo.name;
        
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
        if (!hasValidValues) return;
        
        // 같은 이름의 기존 필터 제거
        state.activeFilters = state.activeFilters.filter(f => f.name !== filterName);
        
        // 새 필터 추가
        state.activeFilters.push({
            name: filterName,
            type: filterInfo.type,
            field: filterInfo.field,
            ...filterValues
        });
        
        // 선택된 필터 UI 업데이트
        updateSelectedFiltersUI();
    }
    
    /**
     * 활성 필터 제거
     * @param {string} filterName - 필터 이름
     */
    function removeActiveFilter(filterName) {
        // 필터 제거
        state.activeFilters = state.activeFilters.filter(f => f.name !== filterName);
        
        // UI 업데이트
        updateSelectedFiltersUI();
        
        // 필터 적용
        applyFilters();
    }
    
    /**
     * 선택된 필터 UI 업데이트
     */
    function updateSelectedFiltersUI() {
        if (!elements.selectedFilters) return;
        
        // 선택된 필터 목록 초기화
        elements.selectedFilters.innerHTML = '';
        
        // 선택된 필터가 없는 경우
        if (state.activeFilters.length === 0) {
            elements.selectedFilters.innerHTML = '<li class="no-filters">적용된 필터가 없습니다</li>';
            return;
        }
        
        // 선택된 필터 목록 표시
        state.activeFilters.forEach(filter => {
            const filterItem = document.createElement('li');
            filterItem.className = 'selected-filter';
            
            // 필터 이름
            const nameSpan = document.createElement('span');
            nameSpan.className = 'filter-name';
            nameSpan.textContent = filter.name;
            
            // 필터 값
            const valueSpan = document.createElement('span');
            valueSpan.className = 'filter-value';
            valueSpan.textContent = formatFilterValue(filter);
            
            // 제거 버튼
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-filter';
            removeBtn.innerHTML = '×';
            removeBtn.addEventListener('click', () => {
                // 활성 필터에서 제거
                removeActiveFilter(filter.name);
                
                // 필터 항목도 DOM에서 제거
                const filterItem = elements.activeFilters?.querySelector(`[data-filter="${filter.name}"]`);
                if (filterItem) {
                    filterItem.remove();
                }
            });
            
            // 요소 조립
            filterItem.appendChild(nameSpan);
            filterItem.appendChild(valueSpan);
            filterItem.appendChild(removeBtn);
            
            elements.selectedFilters.appendChild(filterItem);
        });
    }
    
    /**
     * 필터 값 서식화
     * @param {Object} filter - 필터 객체
     * @returns {string} 서식화된 값
     */
    function formatFilterValue(filter) {
        switch (filter.type) {
            case 'range':
                let valueText = '';
                
                if (filter.min !== undefined && filter.max !== undefined) {
                    valueText = `${filter.min} ~ ${filter.max}`;
                } else if (filter.min !== undefined) {
                    valueText = `${filter.min} 이상`;
                } else if (filter.max !== undefined) {
                    valueText = `${filter.max} 이하`;
                }
                
                return valueText;
                
            case 'select':
                return filter.value || '';
                
            default:
                return filter.value || '';
        }
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
        
        if (!option) return false;
        
        // 값 확인
        const value = parseFloat(option[field]);
        
        // 범위 검사
        if (filter.min !== undefined && value < filter.min) return false;
        if (filter.max !== undefined && value > filter.max) return false;
        
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
        
        updateSelectedFiltersUI();
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
        updateFiltersForCategory,
        itemPassesFilters,
        resetFilters,
        getFilters
    };
})();
