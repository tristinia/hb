/**
 * filter-manager.js
 * 필터 UI 관리 및 사용자 상호작용 처리
 */

import optionFilter from './option-filter.js';
import metadataLoader from './metadata-loader.js';
import optionDefinitions from './option-definitions.js';

// 필터 상태
const state = {
    availableFilters: [],
    activeFilters: [],
    currentCategory: null,
    isInitialized: false,
    debug: false
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
        console.log('[FilterManager]', ...args);
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
    
    // 메타데이터 로더 초기화
    metadataLoader.initialize().then(() => {
        logDebug('메타데이터 로더 초기화 완료');
    });
    
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
        const option = document.createElement('option');
        option.value = filter.name;
        option.textContent = filter.displayName || filter.name;
        
        elements.filterSelector.appendChild(option);
    });
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
        
        // 세트 효과 메타데이터 로드
        metadataLoader.loadSetEffectForCategory(category);
        
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
        
        // 메타데이터 로더를 통해 필터 옵션 구조 로드
        const data = await metadataLoader.loadFilterOptionsForCategory(category);
        
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
                // 안전하게 옵션 정의 접근
                const definition = optionDefinitions[optionType];
                
                if (definition && definition.filter) {
                    // 필터가 객체인 경우 (대부분의 경우)
                    if (typeof definition.filter === 'object') {
                        return {
                            ...filterBase,
                            ...definition.filter,
                            name: optionType // 이름은 항상 원래 옵션 타입 유지
                        };
                    }
                    // 필터가 false인 경우 (필터링 비활성화)
                    else if (definition.filter === false) {
                        return {
                            ...filterBase,
                            visible: false
                        };
                    }
                }
            } catch (e) {
                console.warn(`옵션 정의 로드 오류 (${optionType}):`, e);
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
 * 필터 적용
 */
function applyFilters() {
    // 필터 변경 이벤트 발생
    const event = new CustomEvent('filterChanged', {
        detail: {
            filters: state.activeFilters
        }
    });
    document.dispatchEvent(event);
    
    logDebug('필터 적용됨:', state.activeFilters);
}

/**
 * 활성 필터 제거
 * @param {string} filterName - 제거할 필터 이름
 */
function removeActiveFilter(filterName) {
    state.activeFilters = state.activeFilters.filter(filter => 
        filter.name !== filterName
    );
    
    logDebug(`필터 제거: ${filterName}`);
}

/**
 * 필터 자동 적용
 * @param {HTMLElement} filterItem - 필터 항목 요소
 * @param {Object} filterInfo - 필터 정보
 */
function autoApplyFilter(filterItem, filterInfo) {
    // 필터 타입에 따른 값 추출
    const type = filterInfo.type || 'range';
    
    if (type === 'range') {
        const minInput = filterItem.querySelector('.min-value');
        const maxInput = filterItem.querySelector('.max-value');
        
        const min = minInput && minInput.value ? parseFloat(minInput.value.replace('%', '')) : undefined;
        const max = maxInput && maxInput.value ? parseFloat(maxInput.value.replace('%', '')) : undefined;
        
        // 이미 존재하는 동일 필터 제거
        state.activeFilters = state.activeFilters.filter(f => 
            f.name !== filterInfo.name
        );
        
        // 새 필터 추가
        if (min !== undefined || max !== undefined) {
            state.activeFilters.push({
                name: filterInfo.name,
                displayName: filterInfo.displayName || filterInfo.name,
                type: 'range',
                field: filterInfo.field || 'option_value',
                min,
                max,
                isPercent: filterInfo.isPercent
            });
        }
    } else if (type === 'select') {
        const select = filterItem.querySelector('.select-value');
        const value = select ? select.value : '';
        
        if (value) {
            // 이미 존재하는 동일 필터 제거
            state.activeFilters = state.activeFilters.filter(f => 
                f.name !== filterInfo.name
            );
            
            // 새 필터 추가
            state.activeFilters.push({
                name: filterInfo.name,
                displayName: filterInfo.displayName || filterInfo.name,
                type: 'select',
                value
            });
        }
    } else {
        const input = filterItem.querySelector('.text-value');
        const value = input ? input.value : '';
        
        if (value) {
            // 이미 존재하는 동일 필터 제거
            state.activeFilters = state.activeFilters.filter(f => 
                f.name !== filterInfo.name
            );
            
            // 새 필터 추가
            state.activeFilters.push({
                name: filterInfo.name,
                displayName: filterInfo.displayName || filterInfo.name,
                type: 'text',
                value
            });
        }
    }
    
    // 필터 적용
    applyFilters();
}

// 필터 생성 함수들
function createReforgeStatusFilter(container, filterItem, filterInfo) {
    // (구현은 기존 코드와 동일)
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

function createReforgeOptionFilter(container, filterItem, filterInfo) {
    // 현재 카테고리의 세공 옵션 가져오기
    const reforgeOptions = metadataLoader.getReforgeOptionsForCategory(state.currentCategory);
    
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

// 나머지 필터 생성 함수들과 핼퍼 함수들
// ...

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
    
    // 입력 후 자동 적용
    minInput.addEventListener('change', () => autoApplyFilter(filterItem, filterInfo));
    maxInput.addEventListener('change', () => autoApplyFilter(filterItem, filterInfo));
    
    inputRow.appendChild(minInput);
    inputRow.appendChild(separator);
    inputRow.appendChild(maxInput);
    container.appendChild(inputRow);
}

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
        const results = metadataLoader.searchReforgeOptions(state.currentCategory, query);
        
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
 * 아이템 필터링 체크
 * @param {Object} item - 아이템 객체
 * @returns {boolean} 필터 통과 여부
 */
function itemPassesFilters(item) {
    return optionFilter.itemPassesFilters(item, state.activeFilters);
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

// 모듈 내보내기
export default {
    init,
    updateFiltersForCategory,
    itemPassesFilters,
    resetFilters,
    getFilters
};
