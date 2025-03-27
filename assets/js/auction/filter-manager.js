/**
 * 필터 UI 관리 및 사용자 상호작용 처리
 */

import optionFilter from './option-filter.js';
import metadataLoader from './metadata-loader.js';

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
 */
async function loadFiltersForCategory(category) {
    try {
        // 카테고리 없는 경우, 모든 필터 옵션 반환
        if (!category) {
            return getAllPossibleFilters();
        }
        
        // 기본 필터 정보를 직접 정의
        const baseFilters = defineBaseFilters(category);
        
        // 메타데이터 기반 추가 필터 로드 (세트 효과 등)
        const additionalFilters = await loadAdditionalFilters(category);
        
        // 기본 필터와 추가 필터 병합
        const allFilters = [...baseFilters, ...additionalFilters];
        
        // 가시성 필터링: visible이 명시적으로 false인 항목 제외
        return allFilters.filter(filter => filter.visible !== false);
        
    } catch (error) {
        throw error; // 오류 전파
    }
}

/**
 * 모든 필터 옵션 반환
 */
function getAllPossibleFilters() {
    // 모든 필터 옵션을 포함하는 배열
    return [
        {
            name: '공격',
            displayName: '최대 공격력',
            type: 'range',
            field: 'option_value2',
            visible: true
        },
        {
            name: '크리티컬',
            displayName: '크리티컬',
            type: 'range',
            field: 'option_value',
            visible: true
        },
        {
            name: '밸런스',
            displayName: '밸런스',
            type: 'range',
            field: 'option_value',
            isPercent: true,
            visible: true
        },
        {
            name: '방어력',
            displayName: '방어력',
            type: 'range',
            field: 'option_value',
            visible: true
        },
        {
            name: '보호',
            displayName: '보호',
            type: 'range',
            field: 'option_value',
            visible: true
        },
        {
            name: '내구력',
            displayName: '최대 내구력',
            type: 'range',
            field: 'option_value2',
            visible: true
        },
        {
            name: '인챈트',
            displayName: '인챈트',
            type: 'enchant',
            subTypes: ['접두', '접미'],
            visible: true
        },
        {
            name: '피어싱 레벨',
            displayName: '피어싱 레벨',
            type: 'range',
            visible: true,
            getValue: (option) => {
                const baseLevel = parseInt(option.option_value || "0");
                const additionalLevel = option.option_value2 ? 
                    parseInt(option.option_value2.replace(/\+/g, '')) : 0;
                return baseLevel + additionalLevel;
            }
        },
        {
            name: '특별 개조',
            displayName: '특수 개조',
            type: 'special-mod',
            visible: true
        },
        {
            name: '에르그',
            displayName: '에르그 레벨',
            type: 'range',
            field: 'option_value',
            visible: true
        },
        {
            name: '세공 랭크',
            displayName: '세공 상태',
            type: 'reforge-status',
            visible: true
        },
        {
            name: '세공 옵션',
            displayName: '세공 옵션',
            type: 'reforge-option',
            visible: true
        },
        {
            name: '세트 효과',
            displayName: '세트 효과',
            type: 'range',
            field: 'option_value2',
            category: '세트 효과',
            visible: true
        }
    ];
}

/**
 * 기본 필터 정의
 */
function defineBaseFilters(category) {
    // 기본 필터 목록
    const filters = [];
    
    // 카테고리에 관계없이 표시할 수 있는 기본 필터들
    
    // 공격력 필터 (무기류 카테고리)
    if (isWeaponCategory(category)) {
        filters.push({
            name: '공격',
            displayName: '최대 공격력',
            type: 'range',
            field: 'option_value2',
            visible: true
        });
        
        filters.push({
            name: '크리티컬',
            displayName: '크리티컬',
            type: 'range',
            field: 'option_value',
            visible: true
        });
        
        filters.push({
            name: '밸런스',
            displayName: '밸런스',
            type: 'range',
            field: 'option_value',
            isPercent: true,
            visible: true
        });
    }
    
    // 방어구 관련 필터 (방어구 카테고리)
    if (isArmorCategory(category)) {
        filters.push({
            name: '방어력',
            displayName: '방어력',
            type: 'range',
            field: 'option_value',
            visible: true
        });
        
        filters.push({
            name: '보호',
            displayName: '보호',
            type: 'range',
            field: 'option_value',
            visible: true
        });
    }
    
    // 공통 필터
    filters.push({
        name: '내구력',
        displayName: '최대 내구력',
        type: 'range',
        field: 'option_value2',
        visible: true
    });
    
    // 인챈트 관련 필터
    if (supportsEnchant(category)) {
        filters.push({
            name: '인챈트',
            displayName: '인챈트',
            type: 'enchant',
            subTypes: ['접두', '접미'],
            visible: true
        });
    }
    
    // 피어싱 관련 필터 (특정 장비 카테고리)
    if (supportsPiercing(category)) {
        filters.push({
            name: '피어싱 레벨',
            displayName: '피어싱 레벨',
            type: 'range',
            visible: true,
            getValue: (option) => {
                const baseLevel = parseInt(option.option_value || "0");
                const additionalLevel = option.option_value2 ? 
                    parseInt(option.option_value2.replace(/\+/g, '')) : 0;
                return baseLevel + additionalLevel;
            }
        });
    }
    
    // 특별 개조 필터 (무기, 방어구 등)
    if (supportsSpecialMod(category)) {
        filters.push({
            name: '특별 개조',
            displayName: '특수 개조',
            type: 'special-mod',
            visible: true
        });
    }
    
    // 에르그 필터 (특정 장비)
    if (supportsErg(category)) {
        filters.push({
            name: '에르그',
            displayName: '에르그 레벨',
            type: 'range',
            field: 'option_value',
            visible: true
        });
    }
    
    // 세공 관련 필터 (무기, 장갑, 신발 등)
    if (supportsReforge(category)) {
        filters.push({
            name: '세공 랭크',
            displayName: '세공 상태',
            type: 'reforge-status',
            visible: true
        });
        
        filters.push({
            name: '세공 옵션',
            displayName: '세공 옵션',
            type: 'reforge-option',
            visible: true
        });
    }
    
    // 세트 효과 필터
    filters.push({
        name: '세트 효과',
        displayName: '세트 효과',
        type: 'range',
        field: 'option_value2',
        category: '세트 효과',
        visible: true
    });
    
    return filters;
}

/**
 * 추가 필터 로드 (세트 효과 등 메타데이터 기반)
 */
async function loadAdditionalFilters(category) {
    const additionalFilters = [];
    
    // 필요한 경우 여기에 카테고리별 특수 필터 추가
    
    return additionalFilters;
}

/**
 * 카테고리가 무기류인지 확인
 */
function isWeaponCategory(category) {
    const weaponCategories = [
        '검', '둔기', '도끼', '랜스', '활', '석궁', '아틀라틀', '듀얼건', 
        '너클', '체인 블레이드', '수리검', '원드', '스태프', '마도서', '오브', '핸들'
    ];
    return weaponCategories.includes(category);
}

/**
 * 카테고리가 방어구류인지 확인
 */
function isArmorCategory(category) {
    const armorCategories = [
        '천옷', '경갑옷', '중갑옷', '로브', '모자/가발', '장갑', '신발'
    ];
    return armorCategories.includes(category);
}

/**
 * 카테고리가 인챈트를 지원하는지 확인
 */
function supportsEnchant(category) {
    const enchantableCategories = [
        '검', '둔기', '도끼', '랜스', '활', '석궁', '아틀라틀', '듀얼건', 
        '너클', '체인 블레이드', '수리검', '원드', '스태프', '마도서', '오브', '핸들',
        '천옷', '경갑옷', '중갑옷', '로브', '모자/가발', '장갑', '신발'
    ];
    return enchantableCategories.includes(category);
}

/**
 * 카테고리가 피어싱을 지원하는지 확인
 */
function supportsPiercing(category) {
    const piercingCategories = [
        '검', '둔기', '도끼', '랜스', '활', '석궁', '아틀라틀', '듀얼건', 
        '너클', '체인 블레이드', '수리검'
    ];
    return piercingCategories.includes(category);
}

/**
 * 카테고리가 특별 개조를 지원하는지 확인
 */
function supportsSpecialMod(category) {
    const specialModCategories = [
        '검', '둔기', '도끼', '랜스', '활', '석궁', '듀얼건', '너클', 
        '체인 블레이드', '수리검', '천옷', '경갑옷', '중갑옷', '로브', '장갑', '신발'
    ];
    return specialModCategories.includes(category);
}

/**
 * 카테고리가 에르그를 지원하는지 확인
 */
function supportsErg(category) {
    const ergCategories = [
        '검', '둔기', '도끼', '랜스', '활', '석궁', '아틀라틀', '듀얼건', 
        '너클', '체인 블레이드', '수리검', '원드', '스태프', '마도서', '오브'
    ];
    return ergCategories.includes(category);
}

/**
 * 카테고리가 세공을 지원하는지 확인
 */
function supportsReforge(category) {
    const reforgeCategories = [
        '검', '둔기', '도끼', '랜스', '활', '석궁', '아틀라틀', '듀얼건', 
        '너클', '체인 블레이드', '수리검', '원드', '스태프', '마도서', '오브',
        '천옷', '경갑옷', '중갑옷', '로브', '모자/가발', '장갑', '신발'
    ];
    return reforgeCategories.includes(category);
}

/**
 * 필터 항목 추가
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
    } else if (filterInfo.type === 'special-mod') {
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
 */
function removeActiveFilter(filterName) {
    state.activeFilters = state.activeFilters.filter(filter => 
        filter.name !== filterName
    );
    
    logDebug(`필터 제거: ${filterName}`);
}

/**
 * 필터 자동 적용
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
    } else if (type === 'special-mod') {
        // 특별 개조 필터 처리
        applySpecialModFilter(filterItem, filterInfo);
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

/**
 * 특별 개조 필터 UI 생성
 */
function createSpecialModFilter(container, filterItem, filterInfo) {
    // 1. 특별 개조 타입 선택 섹션 (S, R 버튼)
    const typeSection = document.createElement('div');
    typeSection.className = 'filter-section';
    
    // 타입 레이블
    const typeLabel = document.createElement('div');
    typeLabel.className = 'filter-section-label';
    typeLabel.textContent = '타입:';
    typeSection.appendChild(typeLabel);
    
    // 타입 버튼 컨테이너
    const typeButtons = document.createElement('div');
    typeButtons.className = 'special-mod-buttons';
    
    // 타입 버튼: S, R
    ['S', 'R'].forEach(type => {
        const button = document.createElement('button');
        button.className = 'special-mod-btn';
        button.textContent = type;
        button.setAttribute('data-type', type);
        
        // 버튼 클릭 이벤트
        button.addEventListener('click', () => {
            // 다른 타입 버튼 비활성화
            typeButtons.querySelectorAll('.active').forEach(activeBtn => {
                if (activeBtn !== button) {
                    activeBtn.classList.remove('active');
                }
            });
            
            // 토글 효과
            const isActive = button.classList.contains('active');
            button.classList.toggle('active', !isActive);
            
            // 필터 적용
            applySpecialModFilter(filterItem, filterInfo);
        });
        
        typeButtons.appendChild(button);
    });
    
    typeSection.appendChild(typeButtons);
    container.appendChild(typeSection);
    
    // 2. 특별 개조 단계 범위 섹션
    createRangeFilter(container, filterItem, {
        name: '특별개조단계',
        displayName: '단계',
        type: 'range'
    });
    
    // 범위 필터의 입력 필드에 이벤트 추가
    const inputs = container.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            applySpecialModFilter(filterItem, filterInfo);
        });
    });
}

/**
 * 특별 개조 필터 적용
 */
function applySpecialModFilter(filterItem, filterInfo) {
    // 이미 존재하는 동일 필터 제거
    state.activeFilters = state.activeFilters.filter(f => 
        f.name !== filterInfo.name
    );
    
    // 타입 버튼 확인
    const typeButtons = filterItem.querySelectorAll('.special-mod-btn');
    let selectedType = null;
    
    typeButtons.forEach(button => {
        if (button.classList.contains('active')) {
            selectedType = button.getAttribute('data-type');
        }
    });
    
    // 범위 입력 확인
    const minInput = filterItem.querySelector('.min-value');
    const maxInput = filterItem.querySelector('.max-value');
    
    const min = minInput && minInput.value ? parseInt(minInput.value) : undefined;
    const max = maxInput && maxInput.value ? parseInt(maxInput.value) : undefined;
    
    // 특별 개조 필터 추가
    const filter = {
        name: filterInfo.name,
        displayName: filterInfo.displayName || filterInfo.name,
        type: 'special-mod',
        modType: selectedType,
        minLevel: min,
        maxLevel: max
    };
    
    // 값이 있는 경우만 필터 추가
    if (selectedType || min !== undefined || max !== undefined) {
        state.activeFilters.push(filter);
    }
    
    // 필터 적용
    applyFilters();
}

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

/**
 * 아이템 필터링 체크
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
