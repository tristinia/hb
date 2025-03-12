/**
 * 옵션 필터 관리 모듈
 * OptionRenderer와 연동하여 필터 상태 관리 및 필터링 처리
 */

const OptionFilterManager = (() => {
    // 필터 상태
    const state = {
        activeFilters: {},
        filterValues: {},
        optionStructure: null,
        currentCategory: null
    };
    
    /**
     * 초기화 함수
     */
    function init() {
        // 이벤트 리스너 설정
        setupEventListeners();
        
        console.log('OptionFilterManager 초기화 완료');
    }
    
    /**
     * 이벤트 리스너 설정
     */
    function setupEventListeners() {
        // 카테고리 변경 이벤트 리스너
        document.addEventListener('categoryChanged', (e) => {
            const { subCategory } = e.detail;
            
            if (subCategory) {
                // 카테고리 변경 시 필터 초기화
                state.currentCategory = subCategory;
                resetFilters();
            }
        });
        
        // 필터 값 변경 이벤트 리스너
        document.addEventListener('filterValueChanged', (e) => {
            const { filterId, filterValue } = e.detail;
            
            updateFilter(filterId, filterValue);
        });
        
        // 필터 초기화 이벤트 리스너
        document.addEventListener('searchReset', () => {
            resetFilters();
        });
        
        // 필터 제거 이벤트 위임 (선택된 필터 목록)
        const selectedFiltersList = document.getElementById('selected-filters');
        if (selectedFiltersList) {
            selectedFiltersList.addEventListener('click', (e) => {
                const removeButton = e.target.closest('.remove-filter');
                if (removeButton) {
                    const filterKey = removeButton.dataset.filterKey;
                    if (filterKey) {
                        removeFilter(filterKey);
                    }
                }
            });
        }
    }
    
    /**
     * 필터 업데이트
     * @param {string} filterId - 필터 ID
     * @param {Object} filterValue - 필터 값
     */
    function updateFilter(filterId, filterValue) {
        if (!filterId || !filterValue) return;
        
        // 빈 값인지 확인
        const isEmpty = isEmptyFilterValue(filterValue);
        
        if (isEmpty) {
            // 필터 제거
            delete state.activeFilters[filterId];
            delete state.filterValues[filterId];
        } else {
            // 필터 추가
            state.activeFilters[filterId] = true;
            state.filterValues[filterId] = filterValue;
        }
        
        // 선택된 필터 UI 업데이트
        updateSelectedFiltersUI();
        
        // 필터 변경 알림
        triggerFilterChanged();
    }
    
    /**
     * 필터 값이 비어있는지 확인
     * @param {Object} filterValue - 필터 값
     * @returns {boolean} 비어있는지 여부
     */
    function isEmptyFilterValue(filterValue) {
        if (!filterValue) return true;
        
        switch (filterValue.type) {
            case 'range':
                return (!filterValue.min || filterValue.min === '') && 
                       (!filterValue.max || filterValue.max === '');
            
            case 'select':
            case 'text':
            case 'set_effect':
                return !filterValue.value || filterValue.value === '';
            
            case 'composite':
                if (!filterValue.fields) return true;
                return Object.values(filterValue.fields).every(value => !value || value === '');
            
            case 'reforge':
                return !filterValue.name || filterValue.name === '';
            
            default:
                return true;
        }
    }
    
    /**
     * 필터 제거
     * @param {string} filterId - 필터 ID
     */
    function removeFilter(filterId) {
        if (!filterId) return;
        
        // 필터 상태에서 제거
        delete state.activeFilters[filterId];
        delete state.filterValues[filterId];
        
        // 필터 UI 업데이트
        resetFilterUI(filterId);
        
        // 선택된 필터 UI 업데이트
        updateSelectedFiltersUI();
        
        // 필터 변경 알림
        triggerFilterChanged();
    }
    
    /**
     * 단일 필터 UI 리셋
     * @param {string} filterId - 필터 ID
     */
    function resetFilterUI(filterId) {
        const filterContainer = document.querySelector(`.filter-container[data-filter-id="${filterId}"]`);
        if (!filterContainer) return;
        
        // 필터 타입 확인
        const filterType = filterContainer.className.match(/filter-type-(\w+)/);
        if (!filterType) return;
        
        const type = filterType[1];
        
        switch (type) {
            case 'range':
                // 범위 필터 초기화
                const minInput = filterContainer.querySelector('.min-value');
                const maxInput = filterContainer.querySelector('.max-value');
                
                if (minInput) minInput.value = '';
                if (maxInput) maxInput.value = '';
                break;
            
            case 'select':
                // 선택 필터 초기화
                const select = filterContainer.querySelector('.filter-select');
                if (select) select.value = '';
                break;
            
            case 'text':
                // 텍스트 필터 초기화
                const textInput = filterContainer.querySelector('.filter-text');
                if (textInput) textInput.value = '';
                break;
            
            case 'composite':
                // 복합 필터 초기화
                const fieldInputs = filterContainer.querySelectorAll('input, select');
                fieldInputs.forEach(input => {
                    input.value = '';
                });
                break;
            
            case 'reforge':
                // 세공 필터 초기화
                const reforgeSelect = filterContainer.querySelector('.reforge-select');
                const reforgeLevel = filterContainer.querySelector('.reforge-level');
                
                if (reforgeSelect) reforgeSelect.value = '';
                if (reforgeLevel) {
                    reforgeLevel.value = '';
                    reforgeLevel.disabled = true;
                }
                break;
            
            case 'set_effect':
                // 세트 효과 필터 초기화
                const setSelect = filterContainer.querySelector('.set-effect-select');
                if (setSelect) setSelect.value = '';
                break;
        }
    }
    
    /**
     * 모든 필터 초기화
     */
    function resetFilters() {
        // 필터 상태 초기화
        state.activeFilters = {};
        state.filterValues = {};
        
        // 모든 필터 UI 초기화
        const filterContainers = document.querySelectorAll('.filter-container');
        
        filterContainers.forEach(container => {
            const filterId = container.dataset.filterId;
            if (filterId) {
                resetFilterUI(filterId);
            }
        });
        
        // 선택된 필터 UI 업데이트
        updateSelectedFiltersUI();
        
        // 필터 변경 알림
        triggerFilterChanged();
    }
    
    /**
     * 선택된 필터 UI 업데이트
     */
    function updateSelectedFiltersUI() {
        const selectedFiltersList = document.getElementById('selected-filters');
        if (!selectedFiltersList) return;
        
        // 컨테이너 표시 설정
        const selectedFiltersContainer = document.querySelector('.selected-filters-container');
        
        // 필터가 없으면 표시 안함
        if (Object.keys(state.activeFilters).length === 0) {
            if (selectedFiltersContainer) {
                selectedFiltersContainer.style.display = 'none';
            }
            
            selectedFiltersList.innerHTML = '<li class="no-filters">선택된 필터가 없습니다.</li>';
            return;
        }
        
        // 컨테이너 표시
        if (selectedFiltersContainer) {
            selectedFiltersContainer.style.display = 'block';
        }
        
        // 필터 목록 생성
        selectedFiltersList.innerHTML = '';
        
        for (const filterId in state.activeFilters) {
            const filterValue = state.filterValues[filterId];
            const filterConfig = getFilterConfig(filterId);
            
            if (!filterValue || !filterConfig) continue;
            
            // 필터 이름 가져오기
            const filterName = filterConfig.filter?.name || filterConfig.id;
            
            // 필터 표시 값 생성
            const displayValue = getFilterDisplayValue(filterValue, filterConfig);
            
            // 필터 항목 생성
            const li = document.createElement('li');
            li.className = 'selected-filter';
            
            li.innerHTML = `
                <span class="filter-name">${filterName}:</span>
                <span class="filter-value">${displayValue}</span>
                <button class="remove-filter" data-filter-key="${filterId}">&times;</button>
            `;
            
            selectedFiltersList.appendChild(li);
        }
        
        // 모두 초기화 버튼 추가 (필터가 2개 이상인 경우)
        if (Object.keys(state.activeFilters).length > 1) {
            const resetAllButton = document.createElement('button');
            resetAllButton.className = 'reset-all-filters';
            resetAllButton.textContent = '필터 모두 초기화';
            resetAllButton.addEventListener('click', resetFilters);
            
            const resetContainer = document.createElement('li');
            resetContainer.className = 'reset-all-container';
            resetContainer.appendChild(resetAllButton);
            
            selectedFiltersList.appendChild(resetContainer);
        }
    }
    
    /**
     * 필터 표시 값 생성
     * @param {Object} filterValue - 필터 값
     * @param {Object} filterConfig - 필터 설정
     * @returns {string} 표시 값
     */
    function getFilterDisplayValue(filterValue, filterConfig) {
        if (!filterValue) return '';
        
        switch (filterValue.type) {
            case 'range':
                if (filterValue.min && filterValue.max) {
                    return `${filterValue.min} ~ ${filterValue.max}`;
                } else if (filterValue.min) {
                    return `${filterValue.min} 이상`;
                } else if (filterValue.max) {
                    return `${filterValue.max} 이하`;
                }
                return '';
            
            case 'select':
            case 'text':
            case 'set_effect':
                return filterValue.value || '';
            
            case 'composite':
                if (!filterValue.fields) return '';
                
                // 필드 값 결합
                const fieldValues = [];
                
                for (const [fieldName, fieldValue] of Object.entries(filterValue.fields)) {
                    if (fieldValue && fieldValue !== '') {
                        const fieldConfig = filterConfig.filter?.fields?.find(f => f.field === fieldName);
                        const fieldLabel = fieldConfig?.name || fieldName;
                        
                        fieldValues.push(`${fieldLabel}: ${fieldValue}`);
                    }
                }
                
                return fieldValues.join(', ') || '';
            
            case 'reforge':
                if (filterValue.name) {
                    if (filterValue.level) {
                        return `${filterValue.name} (${filterValue.level}레벨)`;
                    }
                    return filterValue.name;
                }
                return '';
            
            default:
                return '';
        }
    }
    
    /**
     * 필터 설정 가져오기
     * @param {string} filterId - 필터 ID
     * @returns {Object} 필터 설정
     */
    function getFilterConfig(filterId) {
        if (!filterId || !state.optionStructure) return null;
        
        const optionConfig = state.optionStructure.options;
        
        if (!optionConfig) return null;
        
        return optionConfig[filterId];
    }
    
    /**
     * 필터 변경 이벤트 발생
     */
    function triggerFilterChanged() {
        const event = new CustomEvent('filterChanged', {
            detail: {
                filters: { ...state.filterValues },
                category: state.currentCategory
            }
        });
        
        document.dispatchEvent(event);
    }
    
    /**
     * 옵션 구조 설정
     * @param {Object} structure - 옵션 구조 객체
     */
    function setOptionStructure(structure) {
        state.optionStructure = structure;
    }
    
    /**
     * 아이템이 필터 조건에 부합하는지 확인
     * @param {Object} item - 확인할 아이템
     * @returns {boolean} 필터 통과 여부
     */
    function itemPassesFilters(item) {
        // 필터가 없으면 항상 통과
        if (Object.keys(state.activeFilters).length === 0) {
            return true;
        }
        
        // 옵션이 없는 경우 통과 불가
        if (!item.item_option || !Array.isArray(item.item_option)) {
            return false;
        }
        
        // 모든 필터 조건 확인
        for (const filterId in state.activeFilters) {
            const filterValue = state.filterValues[filterId];
            const filterConfig = getFilterConfig(filterId);
            
            if (!filterValue || !filterConfig) continue;
            
            // 필터 타입에 따른 검사
            const passesFilter = checkFilterCondition(item, filterId, filterValue, filterConfig);
            
            // 하나라도 조건을 충족하지 않으면 실패
            if (!passesFilter) {
                return false;
            }
        }
        
        // 모든 필터 통과
        return true;
    }
    
    /**
     * 필터 조건 확인
     * @param {Object} item - 아이템 데이터
     * @param {string} filterId - 필터 ID
     * @param {Object} filterValue - 필터 값
     * @param {Object} filterConfig - 필터 설정
     * @returns {boolean} 조건 충족 여부
     */
    function checkFilterCondition(item, filterId, filterValue, filterConfig) {
        if (!filterValue || !filterConfig) return true;
        
        // 필터 타입에 따른 검사
        switch (filterValue.type) {
            case 'range':
                return checkRangeFilter(item, filterId, filterValue, filterConfig);
            
            case 'select':
            case 'text':
                return checkTextFilter(item, filterId, filterValue, filterConfig);
            
            case 'composite':
                return checkCompositeFilter(item, filterId, filterValue, filterConfig);
            
            case 'reforge':
                return checkReforgeFilter(item, filterId, filterValue, filterConfig);
            
            case 'set_effect':
                return checkSetEffectFilter(item, filterId, filterValue, filterConfig);
            
            default:
                return true;
        }
    }
    
    /**
     * 범위 필터 조건 확인
     * @param {Object} item - 아이템 데이터
     * @param {string} filterId - 필터 ID
     * @param {Object} filterValue - 필터 값
     * @param {Object} filterConfig - 필터 설정
     * @returns {boolean} 조건 충족 여부
     */
    function checkRangeFilter(item, filterId, filterValue, filterConfig) {
        const { min, max } = filterValue;
        
        // 빈 범위는 통과
        if ((!min || min === '') && (!max || max === '')) {
            return true;
        }
        
        // 필터링 필드 결정
        const field = filterConfig.filter?.field || 'value';
        
        // 옵션 찾기
        let optionValue = null;
        
        // 아이템 옵션에서 해당 필드 값 찾기
        for (const option of item.item_option) {
            if (option.option_type === filterId) {
                optionValue = option[`option_${field}`];
                break;
            }
        }
        
        // 값이 없으면 통과 불가
        if (optionValue === null || optionValue === undefined) {
            return false;
        }
        
        // 숫자로 변환
        let numValue = parseFloat(optionValue);
        
        // 변환 실패 시 텍스트에서 숫자 추출 시도
        if (isNaN(numValue) && typeof optionValue === 'string') {
            const matches = optionValue.match(/(\d+)/);
            if (matches) {
                numValue = parseFloat(matches[1]);
            }
        }
        
        // 숫자가 아니면 통과 불가
        if (isNaN(numValue)) {
            return false;
        }
        
        // 범위 검사
        const minValue = min ? parseFloat(min) : null;
        const maxValue = max ? parseFloat(max) : null;
        
        if (minValue !== null && numValue < minValue) {
            return false;
        }
        
        if (maxValue !== null && numValue > maxValue) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 텍스트 필터 조건 확인
     * @param {Object} item - 아이템 데이터
     * @param {string} filterId - 필터 ID
     * @param {Object} filterValue - 필터 값
     * @param {Object} filterConfig - 필터 설정
     * @returns {boolean} 조건 충족 여부
     */
    function checkTextFilter(item, filterId, filterValue, filterConfig) {
        const { value } = filterValue;
        
        // 빈 값은 통과
        if (!value || value === '') {
            return true;
        }
        
        // 옵션 찾기
        let found = false;
        
        // 아이템 옵션에서 해당 값 찾기
        for (const option of item.item_option) {
            if (option.option_type === filterId) {
                const optionValue = option.option_value;
                
                if (optionValue && optionValue.includes(value)) {
                    found = true;
                    break;
                }
            }
        }
        
        return found;
    }
    
    /**
     * 복합 필터 조건 확인
     * @param {Object} item - 아이템 데이터
     * @param {string} filterId - 필터 ID
     * @param {Object} filterValue - 필터 값
     * @param {Object} filterConfig - 필터 설정
     * @returns {boolean} 조건 충족 여부
     */
    function checkCompositeFilter(item, filterId, filterValue, filterConfig) {
        const { fields } = filterValue;
        
        // 빈 필드는 통과
        if (!fields || Object.keys(fields).length === 0) {
            return true;
        }
        
        // 옵션 찾기
        for (const option of item.item_option) {
            if (option.option_type === filterId) {
                // 모든 필드 검사
                let allFieldsMatch = true;
                
                for (const [fieldName, fieldValue] of Object.entries(fields)) {
                    // 빈 값은 검사 안함
                    if (!fieldValue || fieldValue === '') {
                        continue;
                    }
                    
                    // 필드 값 확인
                    const optionField = option[`option_${fieldName}`];
                    
                    if (!optionField || !optionField.includes(fieldValue)) {
                        allFieldsMatch = false;
                        break;
                    }
                }
                
                if (allFieldsMatch) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * 세공 필터 조건 확인
     * @param {Object} item - 아이템 데이터
     * @param {string} filterId - 필터 ID
     * @param {Object} filterValue - 필터 값
     * @param {Object} filterConfig - 필터 설정
     * @returns {boolean} 조건 충족 여부
     */
    function checkReforgeFilter(item, filterId, filterValue, filterConfig) {
        const { name, level } = filterValue;
        
        // 이름이 없으면 통과
        if (!name || name === '') {
            return true;
        }
        
        // 세공 옵션 찾기
        for (const option of item.item_option) {
            // 세공 옵션 타입 확인
            if (
                option.option_type === filterId || 
                option.option_type === '세공 옵션'
            ) {
                const optionValue = option.option_value;
                
                // 세공 이름 확인
                if (optionValue && optionValue.includes(name)) {
                    // 레벨 확인 (있는 경우)
                    if (level && level !== '') {
                        // 레벨 정보 추출
                        const levelMatch = optionValue.match(/(\d+)레벨/);
                        
                        if (levelMatch) {
                            const optionLevel = parseInt(levelMatch[1]);
                            const filterLevel = parseInt(level);
                            
                            // 레벨 일치 확인
                            if (optionLevel === filterLevel) {
                                return true;
                            }
                        }
                    } else {
                        // 레벨 검사 안함
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    /**
     * 세트 효과 필터 조건 확인
     * @param {Object} item - 아이템 데이터
     * @param {string} filterId - 필터 ID
     * @param {Object} filterValue - 필터 값
     * @param {Object} filterConfig - 필터 설정
     * @returns {boolean} 조건 충족 여부
     */
    function checkSetEffectFilter(item, filterId, filterValue, filterConfig) {
        const { value } = filterValue;
        
        // 빈 값은 통과
        if (!value || value === '') {
            return true;
        }
        
        // 세트 효과 옵션 찾기
        for (const option of item.item_option) {
            // 세트 효과 옵션 타입 확인
            if (
                option.option_type === filterId || 
                option.option_type === '세트 효과'
            ) {
                const optionValue = option.option_value;
                
                // 세트 효과 이름 확인
                if (optionValue && optionValue === value) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * 현재 필터 상태 가져오기
     * @returns {Object} 필터 상태
     */
    function getFilterState() {
        return {
            activeFilters: { ...state.activeFilters },
            filterValues: { ...state.filterValues },
            currentCategory: state.currentCategory
        };
    }
    
    // 공개 API
    return {
        init,
        setOptionStructure,
        updateFilter,
        removeFilter,
        resetFilters,
        itemPassesFilters,
        getFilterState
    };
})();
