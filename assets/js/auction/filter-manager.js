/**
 * 필터 UI 관리 및 사용자 상호작용 처리
 */

import optionFilter from './option-filter.js';
import metadataLoader from './metadata-loader.js';
import PaginationManager from './pagination.js';

// 필터 상태
const state = {
    availableFilters: [],
    activeFilters: [],
    currentCategory: null,
    isInitialized: false,
    debug: false,
    autoCompleteData: {
        enchants: {},
        reforges: {},
        setEffects: {}
    }
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
                
                // 드롭다운에서 선택된 필터 제거
                removeFilterFromDropdown(selectedValue);
            }
        });
    }
    
    // 메타데이터 로더 초기화
    metadataLoader.initialize().then(() => {
        logDebug('메타데이터 로더 초기화 완료');
        // 초기 자동완성 데이터 로드
        loadAllMetadata();
    });
    
    state.isInitialized = true;
    logDebug('FilterManager 초기화 완료');
}

/**
 * 모든 메타데이터 로드
 */
async function loadAllMetadata() {
    try {
        // 인챈트 메타데이터 로드
        const prefixData = await metadataLoader.loadEnchantMetadata();
        if (prefixData && prefixData.prefix) {
            state.autoCompleteData.enchants.prefix = prefixData.prefix;
        }
        
        const suffixData = await metadataLoader.loadEnchantMetadata();
        if (suffixData && suffixData.suffix) {
            state.autoCompleteData.enchants.suffix = suffixData.suffix;
        }
        
        // 세공 메타데이터 로드
        const reforgeData = await metadataLoader.loadReforgeMetadata();
        if (reforgeData && reforgeData.data) {
            state.autoCompleteData.reforges = reforgeData.data;
        }
        
        logDebug('모든 메타데이터 로드 완료');
    } catch (error) {
        console.error('메타데이터 로드 중 오류:', error);
    }
}

/**
 * 드롭다운에서 선택된 필터 제거
 */
function removeFilterFromDropdown(filterName) {
    if (!elements.filterSelector) return;
    
    const optionToRemove = Array.from(elements.filterSelector.options).find(option => 
        option.value === filterName
    );
    
    if (optionToRemove) {
        elements.filterSelector.removeChild(optionToRemove);
    }
}

/**
 * 필터 드롭다운 업데이트
 */
function updateFilterDropdown() {
    if (!elements.filterSelector) return;
    
    // 필터 드롭다운 초기화
    elements.filterSelector.innerHTML = '<option value="">옵션 선택...</option>';
    
    // 활성화된 필터 목록 가져오기
    const activeFilterNames = Array.from(elements.activeFilters.querySelectorAll('.filter-item'))
        .map(item => item.getAttribute('data-filter-name'));
    
    // 필터 옵션 추가 (이미 활성화된 필터는 제외)
    state.availableFilters.forEach(filter => {
        // 이미 활성화된 필터면 건너뛰기
        if (activeFilterNames.includes(filter.name)) {
            return;
        }
        
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
        
        // 페이지네이션 업데이트 (필터 초기화 시 페이지네이션 숨김)
        updatePaginationVisibility();
        
        // 세트 효과 메타데이터 로드
        if (category) {
            loadCategoryMetadata(category);
        } else {
            // 카테고리가 없으면 모든 메타데이터 로드
            loadAllMetadata();
        }
        
        logDebug(`카테고리 ${category || '전체'}의 필터 옵션 업데이트 완료: ${filters.length}개 필터`);
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
 * 카테고리별 메타데이터 로드
 */
async function loadCategoryMetadata(category) {
    try {
        // 세트 효과 메타데이터 로드
        const setEffectData = await metadataLoader.loadSetEffectForCategory(category);
        if (setEffectData) {
            state.autoCompleteData.setEffects[category] = setEffectData;
        }
        
        // 세공 메타데이터는 이미 전체 로드되어 있음
        logDebug(`카테고리 ${category}의 메타데이터 로드 완료`);
    } catch (error) {
        console.error(`카테고리 ${category} 메타데이터 로드 중 오류:`, error);
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
            displayName: '에르그',
            type: 'erg',
            visible: true
        },
        {
            name: '세공 랭크',
            displayName: '세공',
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
            type: 'set-effect',
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
            displayName: '에르그',
            type: 'erg',
            visible: true
        });
    }
    
    // 세공 관련 필터 (무기, 장갑, 신발 등)
    if (supportsReforge(category)) {
        filters.push({
            name: '세공 랭크',
            displayName: '세공',
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
        type: 'set-effect',
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
        
        // 드롭다운에 필터 다시 추가
        addFilterToDropdown(filterInfo);
        
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
    } else if (filterInfo.type === 'erg') {
        // 에르그 필터 (등급 + 레벨)
        createErgFilter(filterContent, filterItem, filterInfo);
    } else if (filterInfo.type === 'reforge-option') {
        // 세공 옵션 필터
        createReforgeOptionFilter(filterContent, filterItem, filterInfo);
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
 * 드롭다운에 필터 추가
 */
function addFilterToDropdown(filterInfo) {
    if (!elements.filterSelector) return;
    
    // 이미 있는지 확인
    const existingOption = Array.from(elements.filterSelector.options).find(option => 
        option.value === filterInfo.name
    );
    
    if (existingOption) return;
    
    // 옵션 추가
    const option = document.createElement('option');
    option.value = filterInfo.name;
    option.textContent = filterInfo.displayName || filterInfo.name;
    
    elements.filterSelector.appendChild(option);
}

/**
 * 필터 적용
 */
function applyFilters() {
    // 페이지네이션 가시성 업데이트
    updatePaginationVisibility();
    
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
 * 페이지네이션 가시성 업데이트
 */
function updatePaginationVisibility() {
    // 페이지네이션 관리자 존재하는지 확인
    if (typeof PaginationManager === 'undefined') return;
    
    const paginationElement = document.getElementById('pagination');
    if (!paginationElement) return;
    
    // 필터가 없거나 빈 상태일 때 페이지네이션 숨김
    const hasActiveFilters = state.activeFilters.length > 0;
    
    if (!hasActiveFilters) {
        paginationElement.style.display = 'none';
    } else {
        paginationElement.style.display = '';
    }
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
 * 자동 필터 적용 함수
 */
function autoApplyFilter(filterItem, filterInfo) {
    // 필터 타입에 따른 값 추출
    const type = filterInfo.type || 'range';
    
    if (type === 'range') {
        const minInput = filterItem.querySelector('.min-value');
        const maxInput = filterItem.querySelector('.max-value');
        
        // 입력값 얻기
        let min = minInput ? minInput.value.trim() : '';
        let max = maxInput ? maxInput.value.trim() : '';
        
        // 이미 존재하는 동일 필터 제거
        state.activeFilters = state.activeFilters.filter(f => 
            f.name !== filterInfo.name
        );
        
        // 새 필터 추가
        if (min !== '' || max !== '') {
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
    } else if (type === 'enchant') {
        // 인챈트 필터 처리
        applyEnchantFilter(filterItem, filterInfo);
    } else if (type === 'reforge-option') {
        // 세공 옵션 필터 처리
        applyReforgeOptionFilter(filterItem, filterInfo);
    } else if (type === 'set-effect') {
        // 세트 효과 필터 처리
        applySetEffectFilter(filterItem, filterInfo);
    } else if (type === 'erg') {
        // 에르그 필터 처리
        applyErgFilter(filterItem, filterInfo);
    } else if (type === 'reforge-status') {
        // 세공 상태 필터 처리
        applyReforgeStatusFilter(filterItem, filterInfo);
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
 * 세공 상태 필터 UI 생성 (버튼+버튼)
 */
function createReforgeStatusFilter(container, filterItem, filterInfo) {
    // 1. 세공 랭크 버튼 섹션
    const rankSection = document.createElement('div');
    rankSection.className = 'filter-section';
    
    const rankLabel = document.createElement('div');
    rankLabel.className = 'filter-section-label';
    rankLabel.textContent = '세공 랭크:';
    rankSection.appendChild(rankLabel);
    
    // 랭크 버튼 컨테이너
    const rankButtons = document.createElement('div');
    rankButtons.className = 'special-mod-buttons';
    
    // 랭크 버튼: 1, 2, 3
    [1, 2, 3].forEach(rank => {
        const button = document.createElement('button');
        button.className = 'special-mod-btn';
        button.textContent = rank.toString();
        button.setAttribute('data-rank', rank);
        
        // 버튼 클릭 이벤트
        button.addEventListener('click', () => {
            // 다른 버튼 비활성화
            rankButtons.querySelectorAll('.active').forEach(activeBtn => {
                if (activeBtn !== button) {
                    activeBtn.classList.remove('active');
                }
            });
            
            // 토글 효과
            button.classList.toggle('active');
            
            // 필터 적용
            applyReforgeStatusFilter(filterItem, filterInfo);
        });
        
        rankButtons.appendChild(button);
    });
    
    rankSection.appendChild(rankButtons);
    container.appendChild(rankSection);
    
    // 2. 세공 줄 수 버튼 섹션
    const lineSection = document.createElement('div');
    lineSection.className = 'filter-section';
    
    const lineLabel = document.createElement('div');
    lineLabel.className = 'filter-section-label';
    lineLabel.textContent = '줄 수:';
    lineSection.appendChild(lineLabel);
    
    // 줄 수 버튼 컨테이너
    const lineButtons = document.createElement('div');
    lineButtons.className = 'special-mod-buttons';
    
    // 줄 수 버튼: 1, 2, 3
    [1, 2, 3].forEach(line => {
        const button = document.createElement('button');
        button.className = 'special-mod-btn';
        button.textContent = line.toString();
        button.setAttribute('data-line', line);
        
        // 버튼 클릭 이벤트
        button.addEventListener('click', () => {
            // 다른 버튼 비활성화
            lineButtons.querySelectorAll('.active').forEach(activeBtn => {
                if (activeBtn !== button) {
                    activeBtn.classList.remove('active');
                }
            });
            
            // 토글 효과
            button.classList.toggle('active');
            
            // 필터 적용
            applyReforgeStatusFilter(filterItem, filterInfo);
        });
        
        lineButtons.appendChild(button);
    });
    
    lineSection.appendChild(lineButtons);
    container.appendChild(lineSection);
}

/**
 * 에르그 필터 UI 생성 (버튼+범위)
 */
function createErgFilter(container, filterItem, filterInfo) {
    // 1. 에르그 등급 버튼 섹션
    const gradeSection = document.createElement('div');
    gradeSection.className = 'filter-section';
    
    const gradeLabel = document.createElement('div');
    gradeLabel.className = 'filter-section-label';
    gradeLabel.textContent = '에르그 등급:';
    gradeSection.appendChild(gradeLabel);
    
    // 등급 버튼 컨테이너
    const gradeButtons = document.createElement('div');
    gradeButtons.className = 'special-mod-buttons';
    
    // 등급 버튼: S, A, B
    ['S', 'A', 'B'].forEach(grade => {
        const button = document.createElement('button');
        button.className = 'special-mod-btn';
        button.textContent = grade;
        button.setAttribute('data-grade', grade);
        
        // 버튼 클릭 이벤트
        button.addEventListener('click', () => {
            // 다른 버튼 비활성화
            gradeButtons.querySelectorAll('.active').forEach(activeBtn => {
                if (activeBtn !== button) {
                    activeBtn.classList.remove('active');
                }
            });
            
            // 토글 효과
            button.classList.toggle('active');
            
            // 필터 적용
            applyErgFilter(filterItem, filterInfo);
        });
        
        gradeButtons.appendChild(button);
    });
    
    gradeSection.appendChild(gradeButtons);
    container.appendChild(gradeSection);
    
    // 2. 에르그 레벨 범위 필터
    const levelSection = document.createElement('div');
    levelSection.className = 'filter-section';
    
    const levelLabel = document.createElement('div');
    levelLabel.className = 'filter-section-label';
    levelLabel.textContent = '에르그 레벨:';
    levelSection.appendChild(levelLabel);
    
    // 범위 입력 컨테이너
    const levelInputRow = document.createElement('div');
    levelInputRow.className = 'filter-input-row';
    
    // 최소값 입력
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.className = 'filter-input min-value erg-min-level';
    minInput.placeholder = '최소 레벨';
    minInput.min = 0;
    minInput.max = 50;  // 에르그 최대 레벨 50
    
    const separator = document.createElement('span');
    separator.className = 'filter-separator';
    separator.textContent = '~';
    
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.className = 'filter-input max-value erg-max-level';
    maxInput.placeholder = '최대 레벨';
    maxInput.min = 0;
    maxInput.max = 50;  // 에르그 최대 레벨 50
    
    // 이벤트 리스너
    minInput.addEventListener('change', () => {
        applyErgFilter(filterItem, filterInfo);
    });
    
    maxInput.addEventListener('change', () => {
        applyErgFilter(filterItem, filterInfo);
    });
    
    levelInputRow.appendChild(minInput);
    levelInputRow.appendChild(separator);
    levelInputRow.appendChild(maxInput);
    levelSection.appendChild(levelInputRow);
    container.appendChild(levelSection);
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
    const levelSection = document.createElement('div');
    levelSection.className = 'filter-section';
    
    const levelLabel = document.createElement('div');
    levelLabel.className = 'filter-section-label';
    levelLabel.textContent = '단계 범위:';
    levelSection.appendChild(levelLabel);
    
    const levelInputRow = document.createElement('div');
    levelInputRow.className = 'filter-input-row';
    
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.className = 'filter-input min-value';
    minInput.placeholder = '최소 단계';
    minInput.min = 1;
    minInput.max = 10;  // 특별 개조 최대 단계
    
    const separator = document.createElement('span');
    separator.className = 'filter-separator';
    separator.textContent = '~';
    
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.className = 'filter-input max-value';
    maxInput.placeholder = '최대 단계';
    maxInput.min = 1;
    maxInput.max = 10;  // 특별 개조 최대 단계
    
    // 이벤트 리스너
    minInput.addEventListener('change', () => {
        applySpecialModFilter(filterItem, filterInfo);
    });
    
    maxInput.addEventListener('change', () => {
        applySpecialModFilter(filterItem, filterInfo);
    });
    
    levelInputRow.appendChild(minInput);
    levelInputRow.appendChild(separator);
    levelInputRow.appendChild(maxInput);
    levelSection.appendChild(levelInputRow);
    container.appendChild(levelSection);
}

/**
 * 인챈트 필터 UI 생성
 */
function createEnchantFilter(container, filterItem, filterInfo) {
    // 접두 인챈트 입력 필드
    const prefixSection = document.createElement('div');
    prefixSection.className = 'enchant-search-container';
    
    const prefixLabel = document.createElement('div');
    prefixLabel.className = 'enchant-label';
    prefixLabel.textContent = '접두:';
    prefixSection.appendChild(prefixLabel);
    
    const prefixInput = document.createElement('input');
    prefixInput.type = 'text';
    prefixInput.className = 'filter-input enchant-input prefix-enchant';
    prefixInput.placeholder = '접두 인챈트';
    
    // 입력 완료 후 필터링 적용
    prefixInput.addEventListener('change', () => {
        applyEnchantFilter(filterItem, filterInfo);
    });
    
    prefixSection.appendChild(prefixInput);
    container.appendChild(prefixSection);
    
    // 접미 인챈트 입력 필드
    const suffixSection = document.createElement('div');
    suffixSection.className = 'enchant-search-container';
    
    const suffixLabel = document.createElement('div');
    suffixLabel.className = 'enchant-label';
    suffixLabel.textContent = '접미:';
    suffixSection.appendChild(suffixLabel);
    
    const suffixInput = document.createElement('input');
    suffixInput.type = 'text';
    suffixInput.className = 'filter-input enchant-input suffix-enchant';
    suffixInput.placeholder = '접미 인챈트';
    
    // 입력 완료 후 필터링 적용
    suffixInput.addEventListener('change', () => {
        applyEnchantFilter(filterItem, filterInfo);
    });
    
    suffixSection.appendChild(suffixInput);
    container.appendChild(suffixSection);
}

/**
 * 세공 옵션 필터 UI 생성
 */
function createReforgeOptionFilter(container, filterItem, filterInfo) {
    // 최대 3개의 세공 옵션 입력 필드 생성
    for (let i = 1; i <= 3; i++) {
        const optionSection = document.createElement('div');
        optionSection.className = 'filter-section';
        
        const optionLabel = document.createElement('div');
        optionLabel.className = 'filter-section-label';
        optionLabel.textContent = `옵션 ${i}:`;
        optionSection.appendChild(optionLabel);
        
        // 옵션 이름 입력
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = `filter-input reforge-option-name reforge-option-${i}`;
        nameInput.placeholder = '세공 옵션 이름';
        
        // 입력 변경 이벤트
        nameInput.addEventListener('input', () => {
            // 입력값이 있으면 범위 필터 표시, 없으면 숨김
            const hasValue = nameInput.value.trim() !== '';
            const rangeSection = optionSection.querySelector('.reforge-range-section');
            
            if (rangeSection) {
                rangeSection.style.display = hasValue ? 'block' : 'none';
            } else if (hasValue) {
                // 범위 필터 섹션 생성
                createReforgeRangeSection(optionSection, i);
            }
        });
        
        // 입력 완료 이벤트
        nameInput.addEventListener('change', () => {
            applyReforgeOptionFilter(filterItem, filterInfo);
        });
        
        optionSection.appendChild(nameInput);
        container.appendChild(optionSection);
    }
}

/**
 * 세공 옵션 범위 섹션 생성
 */
function createReforgeRangeSection(parentSection, index) {
    const rangeSection = document.createElement('div');
    rangeSection.className = 'reforge-range-section';
    rangeSection.style.marginTop = '8px';
    
    const rangeLabel = document.createElement('div');
    rangeLabel.className = 'filter-section-label';
    rangeLabel.textContent = '레벨 범위:';
    rangeSection.appendChild(rangeLabel);
    
    const inputRow = document.createElement('div');
    inputRow.className = 'filter-input-row';
    
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.className = `filter-input reforge-min-level reforge-min-level-${index}`;
    minInput.placeholder = '최소 레벨';
    minInput.min = 1;
    
    const separator = document.createElement('span');
    separator.className = 'filter-separator';
    separator.textContent = '~';
    
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.className = `filter-input reforge-max-level reforge-max-level-${index}`;
    maxInput.placeholder = '최대 레벨';
    maxInput.min = 1;
    
    inputRow.appendChild(minInput);
    inputRow.appendChild(separator);
    inputRow.appendChild(maxInput);
    rangeSection.appendChild(inputRow);
    
    // 초기에는 숨김 상태
    rangeSection.style.display = 'none';
    
    parentSection.appendChild(rangeSection);
}

/**
 * 세트 효과 필터 UI 생성
 */
function createSetEffectFilter(container, filterItem, filterInfo) {
    // 최대 3개의 세트 효과 입력 필드 생성
    for (let i = 1; i <= 3; i++) {
        const effectSection = document.createElement('div');
        effectSection.className = 'filter-section';
        
        const effectLabel = document.createElement('div');
        effectLabel.className = 'filter-section-label';
        effectLabel.textContent = `효과 ${i}:`;
        effectSection.appendChild(effectLabel);
        
        // 효과 이름 입력
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = `filter-input set-effect-name set-effect-${i}`;
        nameInput.placeholder = '세트 효과 이름';
        
        // 입력 변경 이벤트
        nameInput.addEventListener('input', () => {
            // 입력값이 있으면 범위 필터 표시, 없으면 숨김
            const hasValue = nameInput.value.trim() !== '';
            const rangeSection = effectSection.querySelector('.set-effect-range-section');
            
            if (rangeSection) {
                rangeSection.style.display = hasValue ? 'block' : 'none';
            } else if (hasValue) {
                // 범위 필터 섹션 생성
                createSetEffectRangeSection(effectSection, i);
            }
        });
        
        // 입력 완료 이벤트
        nameInput.addEventListener('change', () => {
            applySetEffectFilter(filterItem, filterInfo);
        });
        
        effectSection.appendChild(nameInput);
        container.appendChild(effectSection);
    }
}

/**
 * 세트 효과 범위 섹션 생성
 */
function createSetEffectRangeSection(parentSection, index) {
    const rangeSection = document.createElement('div');
    rangeSection.className = 'set-effect-range-section';
    rangeSection.style.marginTop = '8px';
    
    const rangeLabel = document.createElement('div');
    rangeLabel.className = 'filter-section-label';
    rangeLabel.textContent = '수치 범위:';
    rangeSection.appendChild(rangeLabel);
    
    const inputRow = document.createElement('div');
    inputRow.className = 'filter-input-row';
    
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.className = `filter-input set-effect-min-value set-effect-min-value-${index}`;
    minInput.placeholder = '최소값';
    minInput.min = 1;
    
    const separator = document.createElement('span');
    separator.className = 'filter-separator';
    separator.textContent = '~';
    
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.className = `filter-input set-effect-max-value set-effect-max-value-${index}`;
    maxInput.placeholder = '최대값';
    maxInput.min = 1;
    
    inputRow.appendChild(minInput);
    inputRow.appendChild(separator);
    inputRow.appendChild(maxInput);
    rangeSection.appendChild(inputRow);
    
    // 초기에는 숨김 상태
    rangeSection.style.display = 'none';
    
    parentSection.appendChild(rangeSection);
}

/**
 * 에르그 필터 적용
 */
function applyErgFilter(filterItem, filterInfo) {
    // 이미 존재하는 동일 필터 제거
    state.activeFilters = state.activeFilters.filter(f => 
        f.name !== filterInfo.name
    );
    
    // 등급 버튼 확인
    const gradeButtons = filterItem.querySelectorAll('.special-mod-btn[data-grade]');
    let selectedGrade = null;
    
    gradeButtons.forEach(button => {
        if (button.classList.contains('active')) {
            selectedGrade = button.getAttribute('data-grade');
        }
    });
    
    // 레벨 범위 입력 확인
    const minInput = filterItem.querySelector('.erg-min-level');
    const maxInput = filterItem.querySelector('.erg-max-level');
    
    const minLevel = minInput ? minInput.value.trim() : '';
    const maxLevel = maxInput ? maxInput.value.trim() : '';
    
    // 에르그 필터 추가
    const filter = {
        name: filterInfo.name,
        displayName: filterInfo.displayName || filterInfo.name,
        type: 'erg',
        grade: selectedGrade,
        minLevel,
        maxLevel
    };
    
    // 등급이나 범위 중 하나라도 값이 있는 경우 필터 추가
    if (selectedGrade || minLevel !== '' || maxLevel !== '') {
        state.activeFilters.push(filter);
    }
    
    // 필터 적용
    applyFilters();
}

/**
 * 세공 상태 필터 적용
 */
function applyReforgeStatusFilter(filterItem, filterInfo) {
    // 이미 존재하는 동일 필터 제거
    state.activeFilters = state.activeFilters.filter(f => 
        f.name !== filterInfo.name
    );
    
    // 랭크 버튼 확인
    const rankButtons = filterItem.querySelectorAll('.special-mod-btn[data-rank]');
    let selectedRank = null;
    
    rankButtons.forEach(button => {
        if (button.classList.contains('active')) {
            selectedRank = button.getAttribute('data-rank');
        }
    });
    
    // 줄 수 버튼 확인
    const lineButtons = filterItem.querySelectorAll('.special-mod-btn[data-line]');
    let selectedLine = null;
    
    lineButtons.forEach(button => {
        if (button.classList.contains('active')) {
            selectedLine = button.getAttribute('data-line');
        }
    });
    
    // 세공 상태 필터 추가
    const filter = {
        name: filterInfo.name,
        displayName: filterInfo.displayName || filterInfo.name,
        type: 'reforge-status',
        rank: selectedRank,
        lineCount: selectedLine
    };
    
    // 랭크나 줄 수 중 하나라도 값이 있는 경우 필터 추가
    if (selectedRank || selectedLine) {
        state.activeFilters.push(filter);
    }
    
    // 필터 적용
    applyFilters();
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
    const typeButtons = filterItem.querySelectorAll('.special-mod-btn[data-type]');
    let selectedType = null;
    
    typeButtons.forEach(button => {
        if (button.classList.contains('active')) {
            selectedType = button.getAttribute('data-type');
        }
    });
    
    // 범위 입력 확인
    const minInput = filterItem.querySelector('.min-value');
    const maxInput = filterItem.querySelector('.max-value');
    
    const minLevel = minInput ? minInput.value.trim() : '';
    const maxLevel = maxInput ? maxInput.value.trim() : '';
    
    // 특별 개조 필터 추가
    const filter = {
        name: filterInfo.name,
        displayName: filterInfo.displayName || filterInfo.name,
        type: 'special-mod',
        modType: selectedType,
        minLevel,
        maxLevel
    };
    
    // 타입이나 범위 중 하나라도 값이 있는 경우 필터 추가
    if (selectedType || minLevel !== '' || maxLevel !== '') {
        state.activeFilters.push(filter);
    }
    
    // 필터 적용
    applyFilters();
}

/**
 * 인챈트 필터 적용
 */
function applyEnchantFilter(filterItem, filterInfo) {
    // 이미 존재하는 동일 필터 제거
    state.activeFilters = state.activeFilters.filter(f => 
        f.name !== filterInfo.name
    );
    
    // 접두 인챈트 입력 가져오기
    const prefixInput = filterItem.querySelector('.prefix-enchant');
    const prefixEnchant = prefixInput ? prefixInput.value.trim() : '';
    
    // 접미 인챈트 입력 가져오기
    const suffixInput = filterItem.querySelector('.suffix-enchant');
    const suffixEnchant = suffixInput ? suffixInput.value.trim() : '';
    
    // 인챈트 필터 추가
    if (prefixEnchant !== '' || suffixEnchant !== '') {
        state.activeFilters.push({
            name: filterInfo.name,
            displayName: filterInfo.displayName || filterInfo.name,
            type: 'enchant',
            prefixEnchant,
            suffixEnchant
        });
    }
    
    // 필터 적용
    applyFilters();
}

/**
 * 세공 옵션 필터 적용
 */
function applyReforgeOptionFilter(filterItem, filterInfo) {
    // 이미 존재하는 동일 필터 제거
    state.activeFilters = state.activeFilters.filter(f => 
        f.name !== filterInfo.name
    );
    
    // 각 세공 옵션 입력 확인
    const options = [];
    
    for (let i = 1; i <= 3; i++) {
        const nameInput = filterItem.querySelector(`.reforge-option-${i}`);
        if (!nameInput) continue;
        
        const optionName = nameInput.value.trim();
        if (optionName === '') continue;
        
        // 레벨 범위 입력 확인
        const minInput = filterItem.querySelector(`.reforge-min-level-${i}`);
        const maxInput = filterItem.querySelector(`.reforge-max-level-${i}`);
        
        const minLevel = minInput ? minInput.value.trim() : '';
        const maxLevel = maxInput ? maxInput.value.trim() : '';
        
        // 옵션 추가
        options.push({
            name: optionName,
            minLevel,
            maxLevel
        });
    }
    
    // 옵션이 하나라도 있으면 필터 추가
    if (options.length > 0) {
        state.activeFilters.push({
            name: filterInfo.name,
            displayName: filterInfo.displayName || filterInfo.name,
            type: 'reforge-option',
            options
        });
    }
    
    // 필터 적용
    applyFilters();
}

/**
 * 세트 효과 필터 적용
 */
function applySetEffectFilter(filterItem, filterInfo) {
    // 이미 존재하는 동일 필터 제거
    state.activeFilters = state.activeFilters.filter(f => 
        f.name !== filterInfo.name
    );
    
    // 각 세트 효과 입력 확인
    const effects = [];
    
    for (let i = 1; i <= 3; i++) {
        const nameInput = filterItem.querySelector(`.set-effect-${i}`);
        if (!nameInput) continue;
        
        const effectName = nameInput.value.trim();
        if (effectName === '') continue;
        
        // 수치 범위 입력 확인
        const minInput = filterItem.querySelector(`.set-effect-min-value-${i}`);
        const maxInput = filterItem.querySelector(`.set-effect-max-value-${i}`);
        
        const minValue = minInput ? minInput.value.trim() : '';
        const maxValue = maxInput ? maxInput.value.trim() : '';
        
        // 효과 추가
        effects.push({
            name: effectName,
            minValue,
            maxValue
        });
    }
    
    // 효과가 하나라도 있으면 필터 추가
    if (effects.length > 0) {
        state.activeFilters.push({
            name: filterInfo.name,
            displayName: filterInfo.displayName || filterInfo.name,
            type: 'set-effect',
            effects
        });
    }
    
    // 필터 적용
    applyFilters();
}

/**
 * 단순 범위 필터 UI 생성
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
    
    // 입력 후 자동 적용
    minInput.addEventListener('change', () => autoApplyFilter(filterItem, filterInfo));
    maxInput.addEventListener('change', () => autoApplyFilter(filterItem, filterInfo));
    
    inputRow.appendChild(minInput);
    inputRow.appendChild(separator);
    inputRow.appendChild(maxInput);
    container.appendChild(inputRow);
}

/**
 * 선택형 필터 UI 생성
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
 * 텍스트 필터 UI 생성
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
    
    // 필터 드롭다운 초기화
    updateFilterDropdown();
    
    // 페이지네이션 가시성 업데이트
    updatePaginationVisibility();
    
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
