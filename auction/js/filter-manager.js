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
        optionStructure: {},
        optionCache: new Map(), // 옵션 조회 결과 캐시
        filterHistory: [], // 최근 사용 필터 기록
        activeItemCount: 0 // 필터 적용 후 아이템 수
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
        
        // 필터 컨테이너 초기 상태 설정
        const selectedFiltersContainer = document.querySelector('.selected-filters-container');
        if (selectedFiltersContainer) {
            selectedFiltersContainer.style.display = 'none';
        }
        
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
        
        // 저장된 필터 상태 복원 (세션 스토리지)
        restoreFilterState();
        
        console.log('FilterManager 초기화 완료');
    }
    
    /**
     * 필터 상태 저장 (세션 스토리지)
     */
    function saveFilterState() {
        try {
            const filterState = {
                advancedFilters: state.advancedFilters,
                selectedFilters: state.selectedFilters,
                showDetailOptions: state.showDetailOptions
            };
            
            sessionStorage.setItem('filterState', JSON.stringify(filterState));
        } catch (error) {
            console.warn('필터 상태 저장 실패:', error);
        }
    }
    
    /**
     * 필터 상태 복원 (세션 스토리지)
     */
    function restoreFilterState() {
        try {
            const savedState = sessionStorage.getItem('filterState');
            if (savedState) {
                const parsedState = JSON.parse(savedState);
                
                // 상태 복원
                state.advancedFilters = parsedState.advancedFilters || {};
                state.selectedFilters = parsedState.selectedFilters || {};
                state.showDetailOptions = parsedState.showDetailOptions || false;
                
                // UI 업데이트
                updateSelectedFilters();
                
                if (state.showDetailOptions) {
                    if (elements.detailOptionsContainer) {
                        elements.detailOptionsContainer.classList.toggle('show', true);
                    }
                    updateToggleButton();
                }
                
                console.log('필터 상태 복원 완료');
            }
        } catch (error) {
            console.warn('필터 상태 복원 실패:', error);
        }
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
        
        // 상태 저장
        saveFilterState();
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
     * 카테고리에 맞는 세부 옵션 구조 로드 (최적화)
     * @param {string} subCategoryId - 서브 카테고리 ID
     */
    function loadOptionStructure(subCategoryId) {
        if (!subCategoryId) {
            clearDetailOptions();
            return;
        }
        
        // 로딩 상태 표시
        if (elements.detailOptionsList) {
            elements.detailOptionsList.innerHTML = '<li class="loading-options">옵션 로드 중...</li>';
        }
        
        // 파일명 안전하게 변환
        const safeCategoryId = sanitizeFileName(subCategoryId);
        
        // 여러 경로 패턴
        const paths = [
            `/data/option_structure/${safeCategoryId}.json`,
            `../data/option_structure/${safeCategoryId}.json`,
            `data/option_structure/${safeCategoryId}.json`,
            `./data/option_structure/${safeCategoryId}.json`
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
        
        // 첫 번째 성공한 응답 처리
        Promise.all(fetchPromises)
            .then(results => {
                clearTimeout(timeoutId);
                
                // 성공한 응답 찾기
                const successResult = results.find(result => result.response && result.response.ok);
                
                if (!successResult) {
                    throw new Error('옵션 구조 파일을 찾을 수 없습니다.');
                }
                
                return successResult.response.json();
            })
            .then(data => {
                // 옵션 구조 업데이트
                state.optionStructure = data.option_structure || {};
                
                // 옵션 캐시 초기화 (새 구조에 맞춰야 함)
                state.optionCache.clear();
                
                // UI 업데이트
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
     * 파일명으로 사용할 수 없는 특수문자 처리
     * @param {string} id 원본 ID
     * @return {string} 파일명으로 사용 가능한 ID
     */
    function sanitizeFileName(id) {
        // 파일 시스템에서 문제가 될 수 있는 특수 문자들을 대체
        return id.replace(/[\/\\:*?"<>|]/g, '_');
    }
    
    /**
     * 세부 옵션 렌더링 (최적화)
     */
    function renderDetailOptions() {
        // 세부 옵션 목록 초기화
        if (!elements.detailOptionsList) return;
        
        elements.detailOptionsList.innerHTML = '';
        
        // 옵션이 없는 경우
        if (Object.keys(state.optionStructure).length === 0) {
            elements.detailOptionsList.innerHTML = `
                <li class="no-options">이 카테고리에는 사용 가능한 세부 옵션이 없습니다.</li>
            `;
            return;
        }
        
        // DocumentFragment 사용하여 DOM 조작 최소화
        const fragment = document.createDocumentFragment();
        
        // 옵션 그룹화 및 정렬 (사용자 경험 향상)
        const groupedOptions = groupAndSortOptions(state.optionStructure);
        
        // 옵션 그룹 순회
        Object.entries(groupedOptions).forEach(([groupName, options]) => {
            // 그룹 헤더 (있는 경우)
            if (groupName !== 'default') {
                const groupHeader = document.createElement('li');
                groupHeader.className = 'option-group-header';
                groupHeader.textContent = groupName;
                fragment.appendChild(groupHeader);
            }
            
            // 해당 그룹의 옵션들
            options.forEach(([optionName, optionInfo]) => {
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
                fragment.appendChild(li);
            });
        });
        
        // 한 번에 DOM에 추가
        elements.detailOptionsList.appendChild(fragment);
        
        // 선택한 필터 UI 업데이트 
        updateSelectedFilters();
    }
    
    /**
     * 옵션 그룹화 및 정렬
     * @param {Object} optionStructure - 옵션 구조 객체
     * @returns {Object} 그룹화된 옵션 객체
     */
    function groupAndSortOptions(optionStructure) {
        // 그룹 정의
        const groups = {
            'default': [],       // 기본 그룹
            '속성': [],           // 속성 관련 옵션
            '장비': [],           // 장비 관련 옵션
            '외형': [],           // 색상, 스타일 등
            '스탯': []            // 스탯 관련 옵션
        };
        
        // 옵션별 그룹 할당 규칙
        const groupingRules = {
            // 속성 관련
            '속성': /속성|내구도|레벨|rank|등급|별|색상/i,
            // 장비 관련
            '장비': /무기|장비|방어|갑옷|공격|사용|제작|세공|개조|분류/i,
            // 외형 관련
            '외형': /색상|외형|스타일|모양|디자인|염색/i,
            // 스탯 관련
            '스탯': /힘|민첩|지능|의지|체력|마법|크리티컬|데미지|방어력|명중|회피|저항/i
        };
        
        // 옵션 항목 루프
        Object.entries(optionStructure).forEach(entry => {
            const [optionName, optionInfo] = entry;
            
            // 그룹 결정
            let assigned = false;
            for (const [groupName, pattern] of Object.entries(groupingRules)) {
                if (pattern.test(optionName)) {
                    groups[groupName].push(entry);
                    assigned = true;
                    break;
                }
            }
            
            // 할당되지 않은 옵션은 기본 그룹으로
            if (!assigned) {
                groups['default'].push(entry);
            }
        });
        
        // 각 그룹 내 정렬 및 빈 그룹 제거
        return Object.fromEntries(
            Object.entries(groups)
                .filter(([_, options]) => options.length > 0)
                .map(([groupName, options]) => [
                    groupName,
                    // 옵션 이름 기준 정렬
                    options.sort((a, b) => a[0].localeCompare(b[0], 'ko'))
                ])
        );
    }
    
    /**
     * 옵션 입력 모달 표시 (사용성 개선)
     * @param {string} optionName - 옵션 이름
     * @param {Object} optionInfo - 옵션 정보
     */
    function showOptionInputModal(optionName, optionInfo) {
        // 모달 생성
        const modalContainer = document.createElement('div');
        modalContainer.className = 'option-modal-container';
        
        let inputHtml = '';
        let defaultValueMin = '';
        let defaultValueMax = '';
        let defaultValue = '';
        
        // 기존 값이 있는 경우 초기값으로 설정
        if (state.selectedFilters[optionName]) {
            if (typeof state.selectedFilters[optionName] === 'string' && 
                state.selectedFilters[optionName].includes('~')) {
                // 범위 값
                const [min, max] = state.selectedFilters[optionName].split('~');
                defaultValueMin = min;
                defaultValueMax = max;
            } else {
                // 단일 값
                defaultValue = state.selectedFilters[optionName];
            }
        } else {
            // 최소/최대 값이 별도로 있는지 확인
            if (state.selectedFilters[`min_${optionName}`]) {
                defaultValueMin = state.selectedFilters[`min_${optionName}`];
            }
            if (state.selectedFilters[`max_${optionName}`]) {
                defaultValueMax = state.selectedFilters[`max_${optionName}`];
            }
        }
        
        // 옵션 타입에 따른 입력 UI 생성
        if (optionInfo.value === "number") {
            if (optionInfo.value2) {
                // 범위 입력 (min-max)
                inputHtml = `
                    <div class="range-input">
                        <input type="number" id="option-min" placeholder="최소값" min="0" value="${defaultValueMin}">
                        <span>~</span>
                        <input type="number" id="option-max" placeholder="최대값" min="0" value="${defaultValueMax}">
                    </div>
                `;
            } else {
                // 단일 숫자 입력
                inputHtml = `
                    <input type="number" id="option-value" placeholder="값 입력" min="0" value="${defaultValue}">
                `;
            }
        } 
        else if (optionInfo.value === "rgb") {
            // 색상 선택
            inputHtml = `
                <div class="color-input">
                    <input type="color" id="option-value" value="${defaultValue || '#ffffff'}">
                    <span>색상 선택</span>
                </div>
            `;
        } 
        else if (optionInfo.value === "percentage") {
            // 백분율
            inputHtml = `
                <div class="percent-input">
                    <input type="number" id="option-value" min="0" max="100" placeholder="백분율" value="${defaultValue}">
                    <span>%</span>
                </div>
            `;
        } 
        else {
            // 텍스트 입력
            inputHtml = `
                <input type="text" id="option-value" placeholder="값 입력" value="${defaultValue}">
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
        
        // 모달에 포커스 (더 나은 사용자 경험)
        setTimeout(() => {
            const firstInput = modalContainer.querySelector('input');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);
        
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
            
            // 필터 상태 저장
            saveFilterState();
            
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
        
        // ESC 키로 모달 닫기
        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modalContainer);
                document.removeEventListener('keydown', keyHandler);
            } else if (e.key === 'Enter') {
                applyButton.click();
                document.removeEventListener('keydown', keyHandler);
            }
        };
        
        document.addEventListener('keydown', keyHandler);
    }
    
    /**
     * 선택된 필터 목록 업데이트
     */
    function updateSelectedFilters() {
        if (!elements.selectedFiltersList) return;
        
        const selectedFiltersContainer = document.querySelector('.selected-filters-container');
        
        // 선택된 필터가 없을 때 컨테이너 숨기기
        if (Object.keys(state.selectedFilters).length === 0) {
            if (selectedFiltersContainer) {
                selectedFiltersContainer.style.display = 'none';
            }
            elements.selectedFiltersList.innerHTML = '<li class="no-filters">선택된 필터가 없습니다.</li>';
            return;
        }
        
        // 선택된 필터가 있을 때 컨테이너 표시
        if (selectedFiltersContainer) {
            selectedFiltersContainer.style.display = 'block';
        }
        
        // DocumentFragment 사용하여 DOM 조작 최소화
        const fragment = document.createDocumentFragment();
        
        // 필터 목록 생성
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
                    delete state.advancedFilters[`min_${key}`];
                    delete state.advancedFilters[`max_${key}`];
                }
                
                // UI 업데이트
                updateSelectedFilters();
                
                // 필터 상태 저장
                saveFilterState();
                
                // 필터 적용 이벤트 발생
                triggerFilterChange();
            });
            
            fragment.appendChild(li);
        });
        
        // 필터 항목 초기화 후 새로운 항목 추가
        elements.selectedFiltersList.innerHTML = '';
        elements.selectedFiltersList.appendChild(fragment);
        
        // 필터 전체 초기화 버튼 추가
        if (Object.keys(state.selectedFilters).length > 1) {
            const resetAllButton = document.createElement('button');
            resetAllButton.className = 'reset-all-filters';
            resetAllButton.textContent = '필터 모두 초기화';
            resetAllButton.addEventListener('click', resetFilters);
            
            const resetContainer = document.createElement('li');
            resetContainer.className = 'reset-all-container';
            resetContainer.appendChild(resetAllButton);
            
            elements.selectedFiltersList.appendChild(resetContainer);
        }
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
        
        // UI 업데이트
        updateSelectedFilters();
        
        // 필터 상태 저장 (초기화 상태)
        saveFilterState();
        
        // 필터 변경 이벤트 발생
        triggerFilterChange();
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
     * 로컬 필터링 적용 (최적화)
     * @param {Array} items - 필터링할 아이템 목록
     * @returns {Array} 필터링된 아이템 목록
     */
    function applyFiltering(items) {
        // 필터가 없으면 전체 결과 반환
        if (Object.keys(state.advancedFilters).length === 0) {
            return items;
        }
        
        // 성능 측정 시작
        const startTime = performance.now();
        
        // 필터 조건 추출 (캐시 외부에서 한 번만)
        const filterConditions = [];
        for (const [filterKey, filterValue] of Object.entries(state.advancedFilters)) {
            // 필터 키가 min_ 또는 max_로 시작하는 경우 (범위 필터)
            if (filterKey.startsWith('min_')) {
                const optionName = filterKey.replace('min_', '');
                filterConditions.push({
                    type: 'min',
                    optionName,
                    value: parseFloat(filterValue)
                });
            }
            else if (filterKey.startsWith('max_')) {
                const optionName = filterKey.replace('max_', '');
                filterConditions.push({
                    type: 'max',
                    optionName,
                    value: parseFloat(filterValue)
                });
            }
            // 일반 필터
            else {
                filterConditions.push({
                    type: 'text',
                    optionName: filterKey,
                    value: filterValue
                });
            }
        }
        
        // 결과 배열 (메모리 효율성 개선)
        const filteredResults = [];
        const totalItems = items.length;
        
        // 옵션값 캐시 재사용 (반복 가져오기 최소화)
        state.optionCache.clear();
        
        // 각 아이템 필터링
        for (let i = 0; i < totalItems; i++) {
            const item = items[i];
            
            // 옵션이 없는 경우 빠르게 제외
            if (!item.item_option || !Array.isArray(item.item_option)) {
                continue;
            }
            
            // 모든 필터 조건 확인
            let passesAllFilters = true;
            
            for (const condition of filterConditions) {
                // 캐시에서 옵션값 찾기
                const cacheKey = `${item.auction_item_no}_${condition.optionName}`;
                
                let optionValue;
                if (state.optionCache.has(cacheKey)) {
                    optionValue = state.optionCache.get(cacheKey);
                } else {
                    // 옵션값 찾기
                    const option = item.item_option.find(opt => opt.option_type === condition.optionName);
                    optionValue = option ? option.option_value : null;
                    
                    // 캐시에 저장
                    state.optionCache.set(cacheKey, optionValue);
                }
                
                // 옵션값이 없으면 필터 불통과
                if (optionValue === null) {
                    passesAllFilters = false;
                    break;
                }
                
                // 필터 타입에 따른 처리
                switch (condition.type) {
                    case 'min':
                        if (parseFloat(optionValue) < condition.value) {
                            passesAllFilters = false;
                        }
                        break;
                    case 'max':
                        if (parseFloat(optionValue) > condition.value) {
                            passesAllFilters = false;
                        }
                        break;
                    case 'text':
                        if (!optionValue.includes(condition.value)) {
                            passesAllFilters = false;
                        }
                        break;
                }
                
                // 이미 불통과인 경우 남은 조건 검사 생략
                if (!passesAllFilters) {
                    break;
                }
            }
            
            // 모든 조건 통과 시 결과에 추가
            if (passesAllFilters) {
                filteredResults.push(item);
            }
        }
        
        // 성능 측정 종료
        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);
        
        // 필터 적용 결과 통계
        state.activeItemCount = filteredResults.length;
        console.log(`필터링 완료: ${totalItems}개 중 ${filteredResults.length}개 항목 (${duration}ms)`);
        
        return filteredResults;
    }
    
    /**
     * 아이템이 필터 조건에 부합하는지 확인 (단일 아이템용)
     * @param {Object} item - 확인할 아이템
     * @returns {boolean} 필터 통과 여부
     */
    function itemPassesFilters(item) {
        // 필터가 없으면 항상 통과
        if (Object.keys(state.advancedFilters).length === 0) {
            return true;
        }
        
        // 옵션이 없는 경우 통과 불가
        if (!item.item_option || !Array.isArray(item.item_option)) {
            return false;
        }
        
        // 각 필터 타입별 처리
        for (const [filterKey, filterValue] of Object.entries(state.advancedFilters)) {
            // 필터 키가 min_ 또는 max_로 시작하는 경우 (범위 필터)
            if (filterKey.startsWith('min_')) {
                const optionName = filterKey.replace('min_', '');
                const optionValue = getItemOptionValue(item, optionName);
                
                if (optionValue === null || parseFloat(optionValue) < parseFloat(filterValue)) {
                    return false;
                }
            }
            else if (filterKey.startsWith('max_')) {
                const optionName = filterKey.replace('max_', '');
                const optionValue = getItemOptionValue(item, optionName);
                
                if (optionValue === null || parseFloat(optionValue) > parseFloat(filterValue)) {
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
        
        // 모든 필터 통과
        return true;
    }
    
    /**
     * 아이템 옵션에서 값 가져오기
     * @param {Object} item - 아이템 데이터
     * @param {string} optionName - 옵션 이름
     * @returns {string|null} 옵션 값
     */
    function getItemOptionValue(item, optionName) {
        // 캐시 확인 (있을 경우)
        const cacheKey = `${item.auction_item_no}_${optionName}`;
        if (state.optionCache.has(cacheKey)) {
            return state.optionCache.get(cacheKey);
        }
        
        // 옵션이 없는 경우
        if (!item.item_option || !Array.isArray(item.item_option)) {
            return null;
        }
        
        // 옵션 찾기
        const option = item.item_option.find(opt => opt.option_type === optionName);
        const value = option ? option.option_value : null;
        
        // 캐시 저장
        if (value !== null) {
            state.optionCache.set(cacheKey, value);
        }
        
        return value;
    }
    
    // 공개 API
    return {
        init,
        resetFilters,
        getFilters,
        itemPassesFilters,
        updateSelectedFilters,
        applyFiltering,
        getActiveItemCount: () => state.activeItemCount
    };
})();
