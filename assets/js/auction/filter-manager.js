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
        detailOptions: null,
        selectedFilters: null
    };
    
    /**
     * 모듈 초기화
     */
    function init() {
        // DOM 요소 참조 가져오기
        elements.detailOptions = document.getElementById('detail-options');
        elements.selectedFilters = document.getElementById('selected-filters');
        
        console.log('FilterManager 초기화 완료');
        state.isInitialized = true;
    }
    
    /**
     * 현재 카테고리에 맞는 필터 옵션 업데이트
     * @param {string} category - 카테고리 ID
     */
    async function updateFiltersForCategory(category) {
        if (!elements.detailOptions || !elements.selectedFilters) return;
        if (state.currentCategory === category) return;
        
        state.currentCategory = category;
        
        try {
            // 카테고리에 맞는 옵션 구조 로드
            let optionStructure;
            
            try {
                const response = await fetch(`../../data/option_structure.json`);
                if (!response.ok) {
                    throw new Error(`옵션 구조 로드 실패: ${response.status}`);
                }
                optionStructure = await response.json();
            } catch (error) {
                console.error('옵션 구조 로드 오류:', error);
                elements.detailOptions.innerHTML = '<div class="no-options">필터 옵션을 로드할 수 없습니다.</div>';
                return;
            }
            
            // 옵션 구조에서 해당 카테고리와 관련된 필터 추출
            const categoryFilters = extractCategoryFilters(optionStructure, category);
            
            // 가용 필터 설정
            state.availableFilters = categoryFilters;
            
            // 필터 UI 렌더링
            renderFilterOptions();
        } catch (error) {
            console.error('필터 업데이트 중 오류:', error);
            elements.detailOptions.innerHTML = '<div class="no-options">필터 옵션을 로드할 수 없습니다.</div>';
        }
    }
    
    /**
     * 카테고리 필터 추출
     * @param {Object} optionStructure - 옵션 구조 객체
     * @param {string} category - 카테고리 ID
     * @returns {Array} 필터 객체 배열
     */
    function extractCategoryFilters(optionStructure, category) {
        const filters = [];
        
        // 옵션 블록 순회
        for (const blockKey in optionStructure.blocks) {
            const block = optionStructure.blocks[blockKey];
            
            // 각 블록의 옵션 확인
            for (const optionKey in optionStructure.options) {
                const option = optionStructure.options[optionKey];
                
                // 해당 블록에 속한 옵션인지 확인
                if (option.block === blockKey) {
                    // 필터 설정이 있는 경우만 추가
                    if (option.filter) {
                        // 해당 카테고리에 적용 가능한 옵션인지 확인
                        // 여기서는 모든 옵션이 모든 카테고리에 적용 가능하다고 가정
                        // 실제로는 카테고리별 호환성 검사 필요
                        filters.push({
                            name: option.filter.name || optionKey,
                            type: option.filter.type || 'range',
                            field: option.filter.field,
                            default: option.filter.default_value,
                            options: option.filter.options,
                            visible: option.filter.visible !== false,
                            multi_select: option.filter.multi_select === true,
                            max_selections: option.filter.max_selections || 1,
                            block: block.title || blockKey
                        });
                    }
                }
            }
        }
        
        return filters;
    }
    
    /**
     * 필터 옵션 UI 렌더링
     */
    function renderFilterOptions() {
        if (!elements.detailOptions) return;
        
        // 옵션 컨테이너 초기화
        elements.detailOptions.innerHTML = '';
        
        // 사용 가능한 필터가 없는 경우
        if (state.availableFilters.length === 0) {
            elements.detailOptions.innerHTML = '<div class="no-options">이 카테고리에 사용 가능한 필터가 없습니다.</div>';
            return;
        }
        
        // 필터를 블록 별로 그룹화
        const blockGroups = {};
        
        state.availableFilters.forEach(filter => {
            if (filter.visible) {
                if (!blockGroups[filter.block]) {
                    blockGroups[filter.block] = [];
                }
                blockGroups[filter.block].push(filter);
            }
        });
        
        // 각 블록 별로 필터 목록 생성
        for (const blockName in blockGroups) {
            if (blockGroups[blockName].length > 0) {
                // 블록 헤더 추가
                const blockHeader = document.createElement('div');
                blockHeader.className = 'filter-block-header';
                blockHeader.textContent = blockName;
                elements.detailOptions.appendChild(blockHeader);
                
                // 필터 목록 추가
                const filterList = document.createElement('ul');
                filterList.className = 'detail-options-list';
                
                blockGroups[blockName].forEach(filter => {
                    const filterItem = createFilterItem(filter);
                    filterList.appendChild(filterItem);
                });
                
                elements.detailOptions.appendChild(filterList);
            }
        }
    }
    
    /**
     * 필터 항목 생성
     * @param {Object} filter - 필터 객체
     * @returns {HTMLElement} 필터 항목 요소
     */
    function createFilterItem(filter) {
        const item = document.createElement('li');
        item.className = 'option-item';
        
        const button = document.createElement('button');
        button.className = 'option-button';
        button.textContent = filter.name;
        button.onclick = () => showFilterModal(filter);
        
        item.appendChild(button);
        return item;
    }
    
    /**
     * 필터 모달 표시
     * @param {Object} filter - 필터 객체
     */
    function showFilterModal(filter) {
        // 기존 모달 제거
        const existingModal = document.querySelector('.option-modal-container');
        if (existingModal) {
            document.body.removeChild(existingModal);
        }
        
        // 모달 컨테이너 생성
        const modalContainer = document.createElement('div');
        modalContainer.className = 'option-modal-container';
        
        // 모달 내용
        const modalContent = `
            <div class="option-modal">
                <div class="modal-header">
                    <h3>${filter.name} 필터</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    ${createFilterInputs(filter)}
                    <div class="modal-buttons">
                        <button class="cancel-button">취소</button>
                        <button class="apply-button">적용</button>
                    </div>
                </div>
            </div>
        `;
        
        modalContainer.innerHTML = modalContent;
        document.body.appendChild(modalContainer);
        
        // 이벤트 리스너 설정
        const closeBtn = modalContainer.querySelector('.close-modal');
        const cancelBtn = modalContainer.querySelector('.cancel-button');
        const applyBtn = modalContainer.querySelector('.apply-button');
        
        closeBtn.addEventListener('click', () => document.body.removeChild(modalContainer));
        cancelBtn.addEventListener('click', () => document.body.removeChild(modalContainer));
        
        applyBtn.addEventListener('click', () => {
            // 필터 값 수집
            const filterValues = collectFilterValues(filter, modalContainer);
            
            // 활성 필터에 추가
            addActiveFilter(filter, filterValues);
            
            // 모달 닫기
            document.body.removeChild(modalContainer);
            
            // 필터 UI 업데이트
            updateSelectedFiltersUI();
            
            // 필터 적용
            applyFilters();
        });
        
        // 모달 외부 클릭 시 닫기
        modalContainer.addEventListener('click', (event) => {
            if (event.target === modalContainer) {
                document.body.removeChild(modalContainer);
            }
        });
    }
    
    /**
     * 필터 입력 요소 생성
     * @param {Object} filter - 필터 객체
     * @returns {string} 필터 입력 HTML
     */
    function createFilterInputs(filter) {
        switch (filter.type) {
            case 'range':
                return `
                    <div class="range-input">
                        <input type="number" class="min-input" placeholder="최소값">
                        <span>~</span>
                        <input type="number" class="max-input" placeholder="최대값">
                    </div>
                `;
                
            case 'select':
                if (!filter.options || filter.options.length === 0) {
                    return '<p>선택 옵션이 없습니다.</p>';
                }
                
                let optionsHtml = filter.options.map(option => 
                    `<option value="${option}">${option}</option>`
                ).join('');
                
                return `
                    <div class="select-input">
                        <select class="filter-select">
                            <option value="">선택하세요</option>
                            ${optionsHtml}
                        </select>
                    </div>
                `;
                
            case 'reforge':
                return `
                    <div class="reforge-input">
                        <input type="text" class="reforge-name" placeholder="세공 이름">
                        <div class="range-input">
                            <input type="number" class="min-level" placeholder="최소 레벨">
                            <span>~</span>
                            <input type="number" class="max-level" placeholder="최대 레벨">
                        </div>
                    </div>
                `;
                
            default:
                return `<p>지원하지 않는 필터 유형입니다.</p>`;
        }
    }
    
    /**
     * 필터 값 수집
     * @param {Object} filter - 필터 객체
     * @param {HTMLElement} modalContainer - 모달 컨테이너
     * @returns {Object} 수집된 필터 값
     */
    function collectFilterValues(filter, modalContainer) {
        const values = {};
        
        switch (filter.type) {
            case 'range':
                const minInput = modalContainer.querySelector('.min-input');
                const maxInput = modalContainer.querySelector('.max-input');
                
                if (minInput && minInput.value) {
                    values.min = parseFloat(minInput.value);
                }
                
                if (maxInput && maxInput.value) {
                    values.max = parseFloat(maxInput.value);
                }
                break;
                
            case 'select':
                const select = modalContainer.querySelector('.filter-select');
                if (select && select.value) {
                    values.value = select.value;
                }
                break;
                
            case 'reforge':
                const nameInput = modalContainer.querySelector('.reforge-name');
                const minLevel = modalContainer.querySelector('.min-level');
                const maxLevel = modalContainer.querySelector('.max-level');
                
                if (nameInput && nameInput.value) {
                    values.name = nameInput.value;
                    
                    if (minLevel && minLevel.value) {
                        values.minLevel = parseFloat(minLevel.value);
                    }
                    
                    if (maxLevel && maxLevel.value) {
                        values.maxLevel = parseFloat(maxLevel.value);
                    }
                }
                break;
        }
        
        return values;
    }
    
    /**
     * 활성 필터 추가
     * @param {Object} filter - 필터 객체
     * @param {Object} values - 필터 값
     */
    function addActiveFilter(filter, values) {
        // 유효한 값이 있는지 확인
        const hasValidValues = Object.keys(values).length > 0;
        if (!hasValidValues) return;
        
        // 같은 이름의 기존 필터 제거
        state.activeFilters = state.activeFilters.filter(f => f.name !== filter.name);
        
        // 새 필터 추가
        state.activeFilters.push({
            name: filter.name,
            type: filter.type,
            field: filter.field,
            ...values
        });
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
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => removeFilter(filter.name);
            
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
                
            case 'reforge':
                let reforgeText = filter.name || '';
                
                if (filter.minLevel !== undefined && filter.maxLevel !== undefined) {
                    reforgeText += ` (${filter.minLevel}~${filter.maxLevel}레벨)`;
                } else if (filter.minLevel !== undefined) {
                    reforgeText += ` (${filter.minLevel}레벨 이상)`;
                } else if (filter.maxLevel !== undefined) {
                    reforgeText += ` (${filter.maxLevel}레벨 이하)`;
                }
                
                return reforgeText;
                
            default:
                return '';
        }
    }
    
    /**
     * 필터 제거
     * @param {string} filterName - 필터 이름
     */
    function removeFilter(filterName) {
        // 필터 제거
        state.activeFilters = state.activeFilters.filter(f => f.name !== filterName);
        
        // UI 업데이트
        updateSelectedFiltersUI();
        
        // 필터 적용
        applyFilters();
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
                    
                case 'reforge':
                    return checkReforgeFilter(options, filter);
                    
                default:
                    return true;
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
     * 세공 필터 체크
     * @param {Array} options - 아이템 옵션 배열
     * @param {Object} filter - 필터 객체
     * @returns {boolean} 필터 통과 여부
     */
    function checkReforgeFilter(options, filter) {
        // 세공 옵션 찾기
        const reforgeOptions = options.filter(opt => 
            opt.option_type === '세공 옵션'
        );
        
        if (reforgeOptions.length === 0) return false;
        
        // 적어도 하나의 세공 옵션이 조건을 만족해야 함
        return reforgeOptions.some(opt => {
            // 이름 패턴 확인
            const match = opt.option_value.match(/(.+?)\((\d+)레벨:(.+)\)/);
            if (!match) return false;
            
            const [_, name, level] = match;
            const reforgeLevel = parseInt(level);
            
            // 이름 확인
            if (filter.name && !name.includes(filter.name)) return false;
            
            // 레벨 확인
            if (filter.minLevel !== undefined && reforgeLevel < filter.minLevel) return false;
            if (filter.maxLevel !== undefined && reforgeLevel > filter.maxLevel) return false;
            
            return true;
        });
    }
    
    /**
     * 필터 초기화
     */
    function resetFilters() {
        state.activeFilters = [];
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
