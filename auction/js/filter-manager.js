/**
 * 필터 관리 모듈
 * 세부 옵션 및 필터링 기능 관리
 */

const FilterManager = (() => {
    // 필터 상태
    const state = {
        advancedFilters: {},
        selectedFilters: {},
        showDetailOptions: false,
        optionStructure: {}
    };
    
    // DOM 요소 참조
    let elements = {
        toggleOptionsButton: null,
        detailOptionsList: null,
        detailOptionsContainer: null,
        selectedFiltersList: null
    };
    
    /**
     * 모듈 초기화
     */
    function init() {
        // DOM 요소 참조 가져오기
        elements.toggleOptionsButton = document.getElementById('toggle-options');
        elements.detailOptionsList = document.getElementById('detail-options-list');
        elements.detailOptionsContainer = document.getElementById('detail-options');
        elements.selectedFiltersList = document.getElementById('selected-filters');
        
        // 세부 옵션 토글 이벤트 리스너
        if (elements.toggleOptionsButton) {
            elements.toggleOptionsButton.addEventListener('click', toggleDetailOptions);
            updateToggleButton();
        }
        
        // 카테고리 변경 이벤트 리스너
        document.addEventListener('categoryChanged', (e) => {
            const { subCategory } = e.detail;
            if (subCategory) {
                loadOptionStructure(subCategory);
            } else {
                clearDetailOptions();
            }
        });
        
        // 검색 초기화 이벤트 리스너
        document.addEventListener('searchReset', () => {
            resetFilters();
        });
    }
    
    /**
     * 세부 옵션 토글
     */
    function toggleDetailOptions() {
        state.showDetailOptions = !state.showDetailOptions;
        
        if (elements.detailOptionsContainer) {
            elements.detailOptionsContainer.classList.toggle('show', state.showDetailOptions);
        }
        
        updateToggleButton();
    }
    
    /**
     * 토글 버튼 상태 업데이트
     */
    function updateToggleButton() {
        if (elements.toggleOptionsButton) {
            elements.toggleOptionsButton.classList.toggle('expanded', state.showDetailOptions);
            
            // 아이콘 회전 효과
            const icon = elements.toggleOptionsButton.querySelector('svg');
            if (icon) {
                icon.style.transform = state.showDetailOptions ? 'rotate(180deg)' : '';
            }
            
            // 버튼 텍스트 업데이트
            elements.toggleOptionsButton.title = state.showDetailOptions ? '세부 옵션 접기' : '세부 옵션 펼치기';
        }
    }
    
    /**
     * 카테고리에 맞는 세부 옵션 구조 로드
     * @param {string} subCategoryId - 서브 카테고리 ID
     */
    function loadOptionStructure(subCategoryId) {
        if (!subCategoryId) {
            clearDetailOptions();
            return;
        }
        
        // 옵션 구조 데이터 로드
        fetch(`../data/option_structure/${subCategoryId}.json`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('옵션 구조 파일을 찾을 수 없습니다.');
                }
                return response.json();
            })
            .then(data => {
                // 옵션 구조 업데이트
                state.optionStructure = data.option_structure || {};
                renderDetailOptions();
            })
            .catch(error => {
                console.error('옵션 구조 로드 실패:', error);
                // 오류 발생 시 빈 옵션 구조 사용
                state.optionStructure = {};
                renderDetailOptions();
            });
    }
    
    /**
     * 세부 옵션 렌더링
     */
    function renderDetailOptions() {
        // 세부 옵션 목록 초기화
        if (!elements.detailOptionsList) return;
        
        elements.detailOptionsList.innerHTML = '';
        
        if (Object.keys(state.optionStructure).length === 0) {
            elements.detailOptionsList.innerHTML = `
                <li class="no-options">이 카테고리에는 사용 가능한 세부 옵션이 없습니다.</li>
            `;
            return;
        }
        
        // 옵션 구조에 따른 드롭다운 옵션 생성
        Object.entries(state.optionStructure).forEach(([optionName, optionInfo]) => {
            const li = document.createElement('li');
            li.className = 'option-item';
            
            const optionButton = document.createElement('button');
            optionButton.className = 'option-button';
            optionButton.textContent = optionName;
            
            // 옵션 클릭 이벤트
            optionButton.addEventListener('click', () => {
                // 옵션 타입에 따른 입력 UI 생성 및 모달 표시
                showOptionInputModal(optionName, optionInfo);
            });
            
            li.appendChild(optionButton);
            elements.detailOptionsList.appendChild(li);
        });
    }
    
    /**
     * 옵션 입력 모달 표시
     * @param {string} optionName - 옵션 이름
     * @param {Object} optionInfo - 옵션 정보
     */
    function showOptionInputModal(optionName, optionInfo) {
        // 모달 생성
        const modalContainer = document.createElement('div');
        modalContainer.className = 'option-modal-container';
        
        let inputHtml = '';
        
        // 옵션 타입에 따른 입력 UI 생성
        if (optionInfo.value === "number") {
            if (optionInfo.value2) {
                // 범위 입력 (min-max)
                inputHtml = `
                    <div class="range-input">
                        <input type="number" id="option-min" placeholder="최소값" min="0">
                        <span>~</span>
                        <input type="number" id="option-max" placeholder="최대값" min="0">
                    </div>
                `;
            } else {
                // 단일 숫자 입력
                inputHtml = `
                    <input type="number" id="option-value" placeholder="값 입력" min="0">
                `;
            }
        } 
        else if (optionInfo.value === "rgb") {
            // 색상 선택
            inputHtml = `
                <div class="color-input">
                    <input type="color" id="option-value" value="#ffffff">
                    <span>색상 선택</span>
                </div>
            `;
        } 
        else if (optionInfo.value === "percentage") {
            // 백분율
            inputHtml = `
                <div class="percent-input">
                    <input type="number" id="option-value" min="0" max="100" placeholder="백분율">
                    <span>%</span>
                </div>
            `;
        } 
        else {
            // 텍스트 입력
            inputHtml = `
                <input type="text" id="option-value" placeholder="값 입력">
            `;
        }
        
        modalContainer.innerHTML = `
            <div class="option-modal">
                <div class="modal-header">
                    <h3>${optionName} 필터 설정</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    ${inputHtml}
                    <div class="modal-buttons">
                        <button class="cancel-button">취소</button>
                        <button class="apply-button">적용</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modalContainer);
        
        // 모달 닫기 버튼 이벤트
        const closeButton = modalContainer.querySelector('.close-modal');
        closeButton.addEventListener('click', () => {
            document.body.removeChild(modalContainer);
        });
        
        // 취소 버튼 이벤트
        const cancelButton = modalContainer.querySelector('.cancel-button');
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(modalContainer);
        });
        
        // 적용 버튼 이벤트
        const applyButton = modalContainer.querySelector('.apply-button');
        applyButton.addEventListener('click', () => {
            // 입력 값 가져오기
            let filterValue;
            
            if (optionInfo.value === "number" && optionInfo.value2) {
                // 범위 입력
                const minValue = modalContainer.querySelector('#option-min').value;
                const maxValue = modalContainer.querySelector('#option-max').value;
                
                if (!minValue && !maxValue) {
                    alert('최소값 또는 최대값을 입력해주세요.');
                    return;
                }
                
                // 최소값만 있는 경우
                if (minValue && !maxValue) {
                    filterValue = `>=${minValue}`;
                    state.advancedFilters[`min_${optionName}`] = minValue;
                    state.selectedFilters[optionName] = `${minValue} 이상`;
                }
                // 최대값만 있는 경우
                else if (!minValue && maxValue) {
                    filterValue = `<=${maxValue}`;
                    state.advancedFilters[`max_${optionName}`] = maxValue;
                    state.selectedFilters[optionName] = `${maxValue} 이하`;
                }
                // 둘 다 있는 경우
                else {
                    filterValue = `${minValue}~${maxValue}`;
                    state.advancedFilters[`min_${optionName}`] = minValue;
                    state.advancedFilters[`max_${optionName}`] = maxValue;
                    state.selectedFilters[optionName] = `${minValue}~${maxValue}`;
                }
            } else {
                // 단일 값 입력
                filterValue = modalContainer.querySelector('#option-value').value;
                
                if (!filterValue) {
                    alert('값을 입력해주세요.');
                    return;
                }
                
                state.advancedFilters[optionName] = filterValue;
                state.selectedFilters[optionName] = filterValue;
            }
            
            // 선택된 필터 UI 업데이트
            updateSelectedFilters();
            
            // 모달 닫기
            document.body.removeChild(modalContainer);
            
            // 필터 적용 이벤트 발생
            triggerFilterChange();
        });
        
        // 모달 바깥 클릭 시 닫기
        modalContainer.addEventListener('click', (e) => {
            if (e.target === modalContainer) {
                document.body.removeChild(modalContainer);
            }
        });
    }
    
    /**
     * 선택된 필터 목록 업데이트
     */
    function updateSelectedFilters() {
        if (!elements.selectedFiltersList) return;
        
        elements.selectedFiltersList.innerHTML = '';
        
        if (Object.keys(state.selectedFilters).length === 0) {
            elements.selectedFiltersList.innerHTML = '<li class="no-filters">선택된 필터가 없습니다.</li>';
            return;
        }
        
        Object.entries(state.selectedFilters).forEach(([key, value]) => {
            const li = document.createElement('li');
            li.className = 'selected-filter';
            
            li.innerHTML = `
                <span class="filter-name">${key}:</span>
                <span class="filter-value">${value}</span>
                <button class="remove-filter" data-filter-key="${key}">&times;</button>
            `;
            
            // 필터 제거 버튼 이벤트
            const removeButton = li.querySelector('.remove-filter');
            removeButton.addEventListener('click', () => {
                // 필터 제거
                delete state.selectedFilters[key];
                
                // 관련된 모든 필터 제거
                if (key.startsWith('min_') || key.startsWith('max_')) {
                    const baseKey = key.replace(/^(min_|max_)/, '');
                    delete state.advancedFilters[`min_${baseKey}`];
                    delete state.advancedFilters[`max_${baseKey}`];
                } else {
                    delete state.advancedFilters[key];
                }
                
                // UI 업데이트
                updateSelectedFilters();
                
                // 필터 적용 이벤트 발생
                triggerFilterChange();
            });
            
            elements.selectedFiltersList.appendChild(li);
        });
    }
    
    /**
     * 필터 변경 이벤트 발생
     */
    function triggerFilterChange() {
        const event = new CustomEvent('filterChanged', {
            detail: {
                filters: state.advancedFilters
            }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 세부 옵션 초기화
     */
    function clearDetailOptions() {
        if (!elements.detailOptionsList) return;
        
        elements.detailOptionsList.innerHTML = `
            <li class="no-options">카테고리를 선택하면 세부 옵션이 표시됩니다.</li>
        `;
        
        state.optionStructure = {};
    }
    
    /**
     * 모든 필터 초기화
     */
    function resetFilters() {
        state.advancedFilters = {};
        state.selectedFilters = {};
        updateSelectedFilters();
    }
    
    /**
     * 현재 필터 상태 가져오기
     * @returns {Object} 필터 상태 객체
     */
    function getFilters() {
        return {
            advancedFilters: { ...state.advancedFilters },
            selectedFilters: { ...state.selectedFilters }
        };
    }
    
    /**
     * 아이템에서 옵션 값 가져오기 (로컬 필터링용)
     * @param {Object} item - 아이템 데이터
     * @param {string} optionName - 옵션 이름
     * @returns {string|null} 옵션 값
     */
    function getItemOptionValue(item, optionName) {
        if (!item.item_option || !Array.isArray(item.item_option)) {
            return null;
        }
        
        const option = item.item_option.find(opt => opt.option_type === optionName);
        return option ? option.option_value : null;
    }
    
    /**
     * 아이템이 필터 조건에 부합하는지 확인
     * @param {Object} item - 확인할 아이템
     * @returns {boolean} 필터 통과 여부
     */
    function itemPassesFilters(item) {
        // 필터가 없으면 항상 통과
        if (Object.keys(state.advancedFilters).length === 0) {
            return true;
        }
        
        // 각 필터 타입별 처리
        for (const [filterKey, filterValue] of Object.entries(state.advancedFilters)) {
            // 필터 키가 min_ 또는 max_로 시작하는 경우 (범위 필터)
            if (filterKey.startsWith('min_')) {
                const optionName = filterKey.replace('min_', '');
                const optionValue = getItemOptionValue(item, optionName);
                
                if (optionValue !== null && parseFloat(optionValue) < parseFloat(filterValue)) {
                    return false;
                }
            }
            else if (filterKey.startsWith('max_')) {
                const optionName = filterKey.replace('max_', '');
                const optionValue = getItemOptionValue(item, optionName);
                
                if (optionValue !== null && parseFloat(optionValue) > parseFloat(filterValue)) {
                    return false;
                }
            }
            // 일반 필터
            else {
                const optionValue = getItemOptionValue(item, filterKey);
                if (optionValue === null || !optionValue.includes(filterValue)) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    // 공개 API
    return {
        init,
        resetFilters,
        getFilters,
        itemPassesFilters,
        updateSelectedFilters
    };
})();
