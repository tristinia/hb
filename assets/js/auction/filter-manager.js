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
async function init() {
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
    await metadataLoader.initialize();
    logDebug('메타데이터 로더 초기화 완료');
    
    // optionFilter 초기화
    await optionFilter.initialize();
    logDebug('옵션 필터 초기화 완료');
    
    // 초기 자동완성 데이터 로드
    await loadAllMetadata();
    
    state.isInitialized = true;
    logDebug('FilterManager 초기화 완료');
}

/**
 * 모든 메타데이터 로드
 */
async function loadAllMetadata() {
    try {
        // 자동완성 데이터 구성
        const metadata = optionFilter.metadata;
        
        if (metadata.enchants && metadata.enchants.prefix) {
            state.autoCompleteData.enchants.prefix = metadata.enchants.prefix;
        }
        
        if (metadata.enchants && metadata.enchants.suffix) {
            state.autoCompleteData.enchants.suffix = metadata.enchants.suffix;
        }
        
        if (metadata.reforges) {
            state.autoCompleteData.reforges = metadata.reforges;
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
            await loadCategoryMetadata(category);
        } else {
            // 카테고리가 없으면 모든 메타데이터 로드
            await loadAllMetadata();
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
        const setEffectData = await optionFilter.loadSetEffectMetadata(category);
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
 * 드롭다운에 필터 추가 (원래 순서 유지)
 */
function addFilterToDropdown(filterInfo) {
    if (!elements.filterSelector) return;
    
    // 이미 있는지 확인
    const existingOption = Array.from(elements.filterSelector.options).find(option => 
        option.value === filterInfo.name
    );
    
    if (existingOption) return;
    
    // 옵션 추가 - 원래 위치를 찾기 위해 availableFilters 배열 활용
    const option = document.createElement('option');
    option.value = filterInfo.name;
    option.textContent = filterInfo.displayName || filterInfo.name;
    
    // 원래 순서를 유지하기 위해 적절한 위치 찾기
    const availableFilterIndex = state.availableFilters.findIndex(f => f.name === filterInfo.name);
    
    if (availableFilterIndex === -1) {
        // 필터 정보를 찾을 수 없으면 맨 뒤에 추가
        elements.filterSelector.appendChild(option);
        return;
    }
    
    // 삽입 위치 결정
    let insertPosition = 1; // 첫 번째 옵션(기본 '옵션 선택...' 옵션) 다음부터 시작
    
    for (let i = 0; i < availableFilterIndex; i++) {
        const filter = state.availableFilters[i];
        // 이미 드롭다운에 있는 필터인지 확인
        const existingFilterOption = Array.from(elements.filterSelector.options).find(opt => 
            opt.value === filter.name
        );
        
        if (existingFilterOption) {
            insertPosition++;
        }
    }
    
    // 적절한 위치에 옵션 삽입
    const referenceOption = elements.filterSelector.options[insertPosition] || null;
    elements.filterSelector.insertBefore(option, referenceOption);
}

/**
 * 필터 적용
 */
function applyFilters() {
    // 로딩 스피너 표시하지 않음 (사용성 향상)
    
    // 페이지네이션 가시성 업데이트
    updatePaginationVisibility();
    
    // 필터 변경 이벤트 발생
    const event = new CustomEvent('filterChanged', {
        detail: {
            filters: state.activeFilters,
            hideLoading: true // 로딩 스피너 숨김 옵션 추가
        }
    });
    document.dispatchEvent(event);
    
    logDebug('필터 적용됨:', state.activeFilters);
}

/**
 * 페이지네이션 가시성 업데이트
 * 참고: 필터 상태와 관계없이 페이지네이션은 항상 표시되어야 함
 */
function updatePaginationVisibility() {
    // 페이지네이션 관리자 존재하는지 확인
    if (typeof PaginationManager === 'undefined') return;
    
    const paginationElement = document.getElementById('pagination');
    if (!paginationElement) return;
    
    // 페이지네이션은 항상 표시 (필터와 무관)
    paginationElement.style.display = '';
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
    rankLabel.textContent = '랭크';
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
    lineLabel.textContent = '발현';
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
    gradeLabel.textContent = '등급';
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
    levelLabel.textContent = '레벨';
    levelSection.appendChild(levelLabel);
    
    // 범위 입력 컨테이너
    const levelInputRow = document.createElement('div');
    levelInputRow.className = 'filter-input-row';
    
    // 최소값 입력
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.className = 'filter-input min-value erg-min-level';
    minInput.placeholder = '';
    minInput.min = 0;
    minInput.max = 50;  // 에르그 최대 레벨 50
    
    const separator = document.createElement('span');
    separator.className = 'filter-separator';
    separator.textContent = '~';
    
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.className = 'filter-input max-value erg-max-level';
    maxInput.placeholder = '';
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
    // 1. 특별 개조 타입 선택 섹션 (R, S 버튼) - 순서 변경
    const typeSection = document.createElement('div');
    typeSection.className = 'filter-section';
    
    // 타입 레이블
    const typeLabel = document.createElement('div');
    typeLabel.className = 'filter-section-label';
    typeLabel.textContent = '타입';
    typeSection.appendChild(typeLabel);
    
    // 타입 버튼 컨테이너
    const typeButtons = document.createElement('div');
    typeButtons.className = 'special-mod-buttons';
    
    // 타입 버튼: R, S (순서 변경)
    ['R', 'S'].forEach(type => {
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
    levelLabel.textContent = '단계';
    levelSection.appendChild(levelLabel);
    
    const levelInputRow = document.createElement('div');
    levelInputRow.className = 'filter-input-row';
    
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.className = 'filter-input min-value';
    minInput.placeholder = '';
    minInput.min = 1;
    minInput.max = 10;  // 특별 개조 최대 단계
    
    const separator = document.createElement('span');
    separator.className = 'filter-separator';
    separator.textContent = '~';
    
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.className = 'filter-input max-value';
    maxInput.placeholder = '';
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
    prefixSection.className = 'filter-section filter-row';
    
    // 레이블
    const prefixLabel = document.createElement('span');
    prefixLabel.className = 'filter-label';
    prefixLabel.textContent = '접두';
    
    // 입력 래퍼
    const prefixInputWrapper = document.createElement('div');
    prefixInputWrapper.className = 'input-with-clear';
    
    // 입력 필드
    const prefixInput = document.createElement('input');
    prefixInput.type = 'text';
    prefixInput.className = 'filter-input enchant-input prefix-enchant';
    
    // 자동완성 처리
    prefixInput.addEventListener('input', (e) => {
        handleEnchantAutocomplete(prefixInput, 'prefix');
    });
    
    // 입력 완료 후 필터링 적용
    prefixInput.addEventListener('change', () => {
        applyEnchantFilter(filterItem, filterInfo);
    });
    
    // 클리어 버튼
    const prefixClearBtn = document.createElement('button');
    prefixClearBtn.className = 'clear-input-btn';
    prefixClearBtn.innerHTML = '×';
    prefixClearBtn.style.display = 'none';
    prefixClearBtn.addEventListener('click', () => {
        prefixInput.value = '';
        prefixClearBtn.style.display = 'none';
        applyEnchantFilter(filterItem, filterInfo);
    });
    
    // 입력값에 따라 클리어 버튼 표시/숨김
    prefixInput.addEventListener('input', () => {
        prefixClearBtn.style.display = prefixInput.value ? 'block' : 'none';
    });
    
    prefixInputWrapper.appendChild(prefixInput);
    prefixInputWrapper.appendChild(prefixClearBtn);
    
    // 가로 배치
    prefixSection.appendChild(prefixLabel);
    prefixSection.appendChild(prefixInputWrapper);
    
    container.appendChild(prefixSection);
    
    // 자동완성 목록 컨테이너
    const prefixAutoCompleteList = document.createElement('div');
    prefixAutoCompleteList.className = 'autocomplete-list prefix-autocomplete';
    prefixAutoCompleteList.style.display = 'none';
    container.appendChild(prefixAutoCompleteList);
    
    // 접미 인챈트 입력 필드
    const suffixSection = document.createElement('div');
    suffixSection.className = 'filter-section filter-row';
    
    // 레이블
    const suffixLabel = document.createElement('span');
    suffixLabel.className = 'filter-label';
    suffixLabel.textContent = '접미';
    
    // 입력 래퍼
    const suffixInputWrapper = document.createElement('div');
    suffixInputWrapper.className = 'input-with-clear';
    
    // 입력 필드
    const suffixInput = document.createElement('input');
    suffixInput.type = 'text';
    suffixInput.className = 'filter-input enchant-input suffix-enchant';
    
    // 자동완성 처리
    suffixInput.addEventListener('input', (e) => {
        handleEnchantAutocomplete(suffixInput, 'suffix');
    });
    
    // 입력 완료 후 필터링 적용
    suffixInput.addEventListener('change', () => {
        applyEnchantFilter(filterItem, filterInfo);
    });
    
    // 클리어 버튼
    const suffixClearBtn = document.createElement('button');
    suffixClearBtn.className = 'clear-input-btn';
    suffixClearBtn.innerHTML = '×';
    suffixClearBtn.style.display = 'none';
    suffixClearBtn.addEventListener('click', () => {
        suffixInput.value = '';
        suffixClearBtn.style.display = 'none';
        applyEnchantFilter(filterItem, filterInfo);
    });
    
    // 입력값에 따라 클리어 버튼 표시/숨김
    suffixInput.addEventListener('input', () => {
        suffixClearBtn.style.display = suffixInput.value ? 'block' : 'none';
    });
    
    suffixInputWrapper.appendChild(suffixInput);
    suffixInputWrapper.appendChild(suffixClearBtn);
    
    // 가로 배치
    suffixSection.appendChild(suffixLabel);
    suffixSection.appendChild(suffixInputWrapper);
    
    container.appendChild(suffixSection);
    
    // 자동완성 목록 컨테이너
    const suffixAutoCompleteList = document.createElement('div');
    suffixAutoCompleteList.className = 'autocomplete-list suffix-autocomplete';
    suffixAutoCompleteList.style.display = 'none';
    container.appendChild(suffixAutoCompleteList);
}

/**
 * 인챈트 자동완성 처리 함수
 */
function handleEnchantAutocomplete(inputElement, type) {
    const query = inputElement.value.trim();
    
    // 자동완성 목록 엘리먼트 찾기
    const listElement = inputElement.closest('.filter-section')
        .nextElementSibling;
    
    // 검색어가 없으면 자동완성 숨김
    if (!query || query.length < 2) {
        listElement.style.display = 'none';
        return;
    }
    
    // 인챈트 검색
    const enchants = searchEnchantsByName(query, type);
    
    // 결과가 없으면 자동완성 숨김
    if (enchants.length === 0) {
        listElement.style.display = 'none';
        return;
    }
    
    // 자동완성 목록 렌더링
    renderEnchantAutoComplete(listElement, enchants, inputElement);
}

/**
 * 인챈트 이름으로 검색
 */
function searchEnchantsByName(query, type) {
    // 메타데이터에서 찾기
    const enchantData = state.autoCompleteData.enchants[type === 'prefix' ? 'prefix' : 'suffix'];
    
    if (!enchantData || !enchantData.enchants) {
        return [];
    }
    
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    // 검색어와 일치하는 인챈트 찾기
    for (const enchantName in enchantData.enchants) {
        if (enchantName.toLowerCase().includes(lowerQuery)) {
            const enchant = enchantData.enchants[enchantName];
            results.push({
                name: enchantName,
                rank: enchant.rank
            });
        }
    }
    
    // 최대 10개까지만 반환
    return results.slice(0, 10);
}

/**
 * 인챈트 자동완성 목록 렌더링
 */
function renderEnchantAutoComplete(listElement, enchants, inputElement) {
    listElement.innerHTML = '';
    
    // 각 인챈트에 대한 항목 생성
    enchants.forEach(enchant => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.textContent = `${enchant.name} (랭크 ${enchant.rank})`;
        
        // 클릭 이벤트
        item.addEventListener('click', () => {
            inputElement.value = enchant.name;
            listElement.style.display = 'none';
            
            // 클리어 버튼 표시
            const clearBtn = inputElement.nextElementSibling;
            if (clearBtn && clearBtn.classList.contains('clear-input-btn')) {
                clearBtn.style.display = 'block';
            }
            
            // 변경 이벤트 발생시켜 필터 적용
            inputElement.dispatchEvent(new Event('change'));
        });
        
        listElement.appendChild(item);
    });
    
    // 자동완성 목록 위치 조정 및 표시
    positionAutocompleteList(listElement, inputElement);
    listElement.style.display = 'block';
}

/**
 * 세공 옵션 필터 UI 생성
 */
function createReforgeOptionFilter(container, filterItem, filterInfo) {
    // 최대 3개의 세공 옵션 입력 필드 생성
    for (let i = 1; i <= 3; i++) {
        // 옵션 이름 섹션
        const optionSection = document.createElement('div');
        optionSection.className = 'filter-section filter-row';
        
        // 레이블
        const optionLabel = document.createElement('span');
        optionLabel.className = 'filter-label';
        optionLabel.textContent = '명칭';
        
        // 옵션 이름 입력 래퍼
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'input-with-clear';
        
        // 옵션 이름 입력
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = `filter-input reforge-option-name reforge-option-${i}`;
        
        // 클리어 버튼
        const clearBtn = document.createElement('button');
        clearBtn.className = 'clear-input-btn';
        clearBtn.innerHTML = '×';
        clearBtn.style.display = 'none';
        clearBtn.addEventListener('click', () => {
            nameInput.value = '';
            clearBtn.style.display = 'none';
            
            // 범위 섹션 숨기기
            const rangeSection = filterItem.querySelector(`.reforge-range-section-${i}`);
            if (rangeSection) {
                rangeSection.style.display = 'none';
            }
            
            applyReforgeOptionFilter(filterItem, filterInfo);
        });
        
        // 자동완성 기능
        nameInput.addEventListener('input', () => {
            // 클리어 버튼 표시/숨김
            clearBtn.style.display = nameInput.value ? 'block' : 'none';
            
            // 자동완성 처리
            handleReforgeOptionAutocomplete(nameInput);
            
            // 입력값이 있으면 범위 필터 표시, 없으면 숨김
            const hasValue = nameInput.value.trim() !== '';
            let rangeSection = filterItem.querySelector(`.reforge-range-section-${i}`);
            
            if (rangeSection) {
                rangeSection.style.display = hasValue ? 'flex' : 'none';
            } else if (hasValue) {
                // 범위 필터 섹션 생성
                createReforgeRangeSection(filterItem, i);
            }
        });
        
        // 입력 완료 이벤트
        nameInput.addEventListener('change', () => {
            applyReforgeOptionFilter(filterItem, filterInfo);
        });
        
        inputWrapper.appendChild(nameInput);
        inputWrapper.appendChild(clearBtn);
        
        // 가로 배치
        optionSection.appendChild(optionLabel);
        optionSection.appendChild(inputWrapper);
        
        container.appendChild(optionSection);
        
        // 자동완성 목록 컨테이너
        const autoCompleteList = document.createElement('div');
        autoCompleteList.className = 'autocomplete-list reforge-option-autocomplete';
        autoCompleteList.style.display = 'none';
        container.appendChild(autoCompleteList);
    }
}

/**
 * 세공 옵션 자동완성 처리
 */
function handleReforgeOptionAutocomplete(inputElement) {
    const query = inputElement.value.trim();
    
    // 현재 input의 인덱스 찾기 (reforge-option-1, reforge-option-2, reforge-option-3)
    const index = inputElement.className.match(/reforge-option-(\d+)/)[1];
    
    // 자동완성 목록 엘리먼트 찾기 - 각 input 바로 뒤에 위치하는 자동완성 목록
    const listElement = inputElement.closest('.filter-section')
        .nextElementSibling;
    
    // 검색어가 없으면 자동완성 숨김
    if (!query || query.length < 2) {
        listElement.style.display = 'none';
        return;
    }
    
    // 세공 옵션 검색
    const options = searchReforgeOptions(query);
    
    // 결과가 없으면 자동완성 숨김
    if (options.length === 0) {
        listElement.style.display = 'none';
        return;
    }
    
    // 자동완성 목록 렌더링
    renderReforgeOptionAutoComplete(listElement, options, inputElement);
}


/**
 * 세공 옵션 검색
 */
function searchReforgeOptions(query) {
    // 메타데이터에서 찾기
    const reforgeData = state.autoCompleteData.reforges;
    
    if (!reforgeData || !reforgeData.reforges) {
        return [];
    }
    
    const results = [];
    const lowerQuery = query.toLowerCase();
    const category = state.currentCategory || '';
    
    // 현재 카테고리 또는 모든 카테고리에서 검색
    let categories = [];
    
    if (reforgeData.reforges[category]) {
        categories.push(category);
    } else {
        // 모든 카테고리 검색
        categories = Object.keys(reforgeData.reforges);
    }
    
    // 각 카테고리에서 검색
    categories.forEach(cat => {
        const options = reforgeData.reforges[cat] || [];
        
        options.forEach(option => {
            if (option.toLowerCase().includes(lowerQuery) && 
                !results.includes(option)) {
                results.push(option);
            }
        });
    });
    
    // 최대 10개까지만 반환
    return results.slice(0, 10);
}

/**
 * 자동완성 목록 위치 조정
 */
function positionAutocompleteList(listElement, inputElement) {
    // 부모 요소 포지션 설정
    const parentElement = inputElement.closest('.filter-content');
    if (parentElement) {
        parentElement.style.position = 'relative';
    }
    
    listElement.style.position = 'absolute';
    listElement.style.width = inputElement.offsetWidth + 'px';
    listElement.style.left = '0';
    listElement.style.top = inputElement.offsetHeight + 5 + 'px';
    listElement.style.zIndex = '1000';
}

/**
 * 세공 옵션 자동완성 목록 렌더링
 */
function renderReforgeOptionAutoComplete(listElement, options, inputElement) {
    listElement.innerHTML = '';
    
    // 각 옵션에 대한 항목 생성
    options.forEach(option => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.textContent = option;
        
        // 클릭 이벤트
        item.addEventListener('click', () => {
            inputElement.value = option;
            listElement.style.display = 'none';
            
            // 클리어 버튼 표시
            const clearBtn = inputElement.nextElementSibling;
            if (clearBtn && clearBtn.classList.contains('clear-input-btn')) {
                clearBtn.style.display = 'block';
            }
            
            // 입력값 변경 이벤트 발생
            inputElement.dispatchEvent(new Event('input'));
            
            // 변경 이벤트 발생시켜 필터 적용
            inputElement.dispatchEvent(new Event('change'));
        });
        
        listElement.appendChild(item);
    });
    
    // 자동완성 목록 위치 조정 및 표시
    positionAutocompleteList(listElement, inputElement);
    listElement.style.display = 'block';
}

/**
 * 세공 옵션 범위 섹션 생성
 */
function createReforgeRangeSection(parentElement, index) {
    // 이미 있는지 확인
    if (parentElement.querySelector(`.reforge-range-section-${index}`)) {
        return;
    }
    
    const rangeSection = document.createElement('div');
    rangeSection.className = `filter-section filter-row reforge-range-section-${index}`;
    
    // 레이블
    const rangeLabel = document.createElement('span');
    rangeLabel.className = 'filter-label';
    rangeLabel.textContent = '범위';
    
    // 입력 컨테이너
    const inputRow = document.createElement('div');
    inputRow.className = 'filter-input-row';
    
    // 입력 필드들
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.className = `filter-input reforge-min-level reforge-min-level-${index}`;
    minInput.placeholder = '최소';
    minInput.min = 1;
    
    const separator = document.createElement('span');
    separator.className = 'filter-separator';
    separator.textContent = '~';
    
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.className = `filter-input reforge-max-level reforge-max-level-${index}`;
    maxInput.placeholder = '최대';
    maxInput.min = 1;
    
    // 입력 필드 추가
    inputRow.appendChild(minInput);
    inputRow.appendChild(separator);
    inputRow.appendChild(maxInput);
    
    // 가로 배치
    rangeSection.appendChild(rangeLabel);
    rangeSection.appendChild(inputRow);
    
    // 필터 아이템에 추가 (레이블 바로 아래에)
    const targetSection = parentElement.querySelector(`.reforge-option-${index}`).closest('.filter-section');
    targetSection.parentNode.insertBefore(rangeSection, targetSection.nextSibling);
}

/**
 * 세트 효과 필터 UI 생성
 */
function createSetEffectFilter(container, filterItem, filterInfo) {
    // 최대 3개의 세트 효과 입력 필드 생성
    for (let i = 1; i <= 3; i++) {
        // 효과 이름 섹션
        const effectSection = document.createElement('div');
        effectSection.className = 'filter-section filter-row';
        
        // 레이블
        const effectLabel = document.createElement('span');
        effectLabel.className = 'filter-label';
        effectLabel.textContent = '명칭';
        
        // 효과 이름 입력 래퍼
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'input-with-clear';
        
        // 효과 이름 입력
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = `filter-input set-effect-name set-effect-${i}`;
        
        // 클리어 버튼
        const clearBtn = document.createElement('button');
        clearBtn.className = 'clear-input-btn';
        clearBtn.innerHTML = '×';
        clearBtn.style.display = 'none';
        clearBtn.addEventListener('click', () => {
            nameInput.value = '';
            clearBtn.style.display = 'none';
            
            // 범위 섹션 숨기기
            const rangeSection = filterItem.querySelector(`.set-effect-range-section-${i}`);
            if (rangeSection) {
                rangeSection.style.display = 'none';
            }
            
            applySetEffectFilter(filterItem, filterInfo);
        });
        
        // 자동완성 기능
        nameInput.addEventListener('input', () => {
            // 클리어 버튼 표시/숨김
            clearBtn.style.display = nameInput.value ? 'block' : 'none';
            
            // 자동완성 처리
            handleSetEffectAutocomplete(nameInput);
            
            // 입력값이 있으면 범위 필터 표시, 없으면 숨김
            const hasValue = nameInput.value.trim() !== '';
            let rangeSection = filterItem.querySelector(`.set-effect-range-section-${i}`);
            
            if (rangeSection) {
                rangeSection.style.display = hasValue ? 'flex' : 'none';
            } else if (hasValue) {
                // 범위 필터 섹션 생성
                createSetEffectRangeSection(filterItem, i);
            }
        });
        
        // 입력 완료 이벤트
        nameInput.addEventListener('change', () => {
            applySetEffectFilter(filterItem, filterInfo);
        });
        
        inputWrapper.appendChild(nameInput);
        inputWrapper.appendChild(clearBtn);
        
        // 가로 배치
        effectSection.appendChild(effectLabel);
        effectSection.appendChild(inputWrapper);
        
        container.appendChild(effectSection);
        
        // 자동완성 목록 컨테이너
        const autoCompleteList = document.createElement('div');
        autoCompleteList.className = 'autocomplete-list set-effect-autocomplete';
        autoCompleteList.style.display = 'none';
        container.appendChild(autoCompleteList);
    }
}

/**
 * 세트 효과 자동완성 처리
 */
function handleSetEffectAutocomplete(inputElement) {
    const query = inputElement.value.trim();
    
    // 현재 input의 인덱스 찾기 (set-effect-1, set-effect-2, set-effect-3)
    const index = inputElement.className.match(/set-effect-(\d+)/)[1];
    
    // 자동완성 목록 엘리먼트 찾기
    const listElement = inputElement.closest('.filter-section')
        .nextElementSibling;
    
    // 검색어가 없으면 자동완성 숨김
    if (!query || query.length < 2) {
        listElement.style.display = 'none';
        return;
    }
    
    // 세트 효과 검색
    const effects = searchSetEffects(query);
    
    // 결과가 없으면 자동완성 숨김
    if (effects.length === 0) {
        listElement.style.display = 'none';
        return;
    }
    
    // 자동완성 목록 렌더링
    renderSetEffectAutoComplete(listElement, effects, inputElement);
}

/**
 * 세트 효과 검색
 */
function searchSetEffects(query) {
    // 세트 효과 메타데이터에서 찾기
    const category = state.currentCategory || '';
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    // 현재 카테고리 또는 모든 카테고리에서 검색
    let categories = [];
    
    if (state.autoCompleteData.setEffects[category]) {
        categories.push(category);
    } else {
        // 모든 카테고리 검색
        categories = Object.keys(state.autoCompleteData.setEffects);
    }
    
    // 각 카테고리에서 검색
    categories.forEach(cat => {
        const setEffectData = state.autoCompleteData.setEffects[cat];
        if (setEffectData && Array.isArray(setEffectData.set_effects)) {
            setEffectData.set_effects.forEach(effect => {
                if (effect.toLowerCase().includes(lowerQuery) && 
                    !results.includes(effect)) {
                    results.push(effect);
                }
            });
        }
    });
    
    // 최대 10개까지만 반환
    return results.slice(0, 10);
}

/**
 * 세트 효과 자동완성 목록 렌더링
 */
function renderSetEffectAutoComplete(listElement, effects, inputElement) {
    listElement.innerHTML = '';
    
    // 각 세트 효과에 대한 항목 생성
    effects.forEach(effect => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.textContent = effect;
        
        // 클릭 이벤트
        item.addEventListener('click', () => {
            inputElement.value = effect;
            listElement.style.display = 'none';
            
            // 클리어 버튼 표시
            const clearBtn = inputElement.nextElementSibling;
            if (clearBtn && clearBtn.classList.contains('clear-input-btn')) {
                clearBtn.style.display = 'block';
            }
            
            // 입력값 변경 이벤트 발생
            inputElement.dispatchEvent(new Event('input'));
            
            // 변경 이벤트 발생시켜 필터 적용
            inputElement.dispatchEvent(new Event('change'));
        });
        
        listElement.appendChild(item);
    });
    
    // 자동완성 목록 표시
    listElement.style.display = 'block';
}

/**
 * 세트 효과 범위 섹션 생성
 */
function createSetEffectRangeSection(parentElement, index) {
    // 이미 있는지 확인
    if (parentElement.querySelector(`.set-effect-range-section-${index}`)) {
        return;
    }
    
    const rangeSection = document.createElement('div');
    rangeSection.className = `filter-section filter-row set-effect-range-section-${index}`;
    
    // 레이블
    const rangeLabel = document.createElement('span');
    rangeLabel.className = 'filter-label';
    rangeLabel.textContent = '범위';
    
    // 입력 컨테이너
    const inputRow = document.createElement('div');
    inputRow.className = 'filter-input-row';
    
    // 입력 필드들
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.className = `filter-input set-effect-min-value set-effect-min-value-${index}`;
    minInput.min = 1;
    
    const separator = document.createElement('span');
    separator.className = 'filter-separator';
    separator.textContent = '~';
    
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.className = `filter-input set-effect-max-value set-effect-max-value-${index}`;
    maxInput.min = 1;
    
    // 레벨 변경 시 필터 적용
    minInput.addEventListener('change', () => {
        const filterItem = parentElement;
        const filterInfo = { name: '세트 효과', displayName: '세트 효과', type: 'set-effect' };
        applySetEffectFilter(filterItem, filterInfo);
    });
    
    maxInput.addEventListener('change', () => {
        const filterItem = parentElement;
        const filterInfo = { name: '세트 효과', displayName: '세트 효과', type: 'set-effect' };
        applySetEffectFilter(filterItem, filterInfo);
    });
    
    // 입력 필드 추가
    inputRow.appendChild(minInput);
    inputRow.appendChild(separator);
    inputRow.appendChild(maxInput);
    
    // 가로 배치
    rangeSection.appendChild(rangeLabel);
    rangeSection.appendChild(inputRow);
    
    // 필터 아이템에 추가 (레이블 바로 아래에)
    const targetSection = parentElement.querySelector(`.set-effect-${index}`).closest('.filter-section');
    targetSection.parentNode.insertBefore(rangeSection, targetSection.nextSibling);
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
 * 범위 필터 UI 생성
 */
function createRangeFilter(container, filterItem, filterInfo) {
    // 가로 배치를 위한 컨테이너
    const filterSection = document.createElement('div');
    filterSection.className = 'filter-section filter-row';
    
    // 레이블과 입력 필드를 같은 줄에 배치
    const labelSpan = document.createElement('span');
    labelSpan.className = 'filter-label';
    labelSpan.textContent = '범위';
    
    // 범위 입력 컨테이너
    const inputRow = document.createElement('div');
    inputRow.className = 'filter-input-row';
    
    // 최소값 입력
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.className = 'filter-input min-value';
    minInput.min = 0;
    minInput.setAttribute('aria-label', `${filterInfo.displayName || filterInfo.name} 최소값`);
    
    const separator = document.createElement('span');
    separator.className = 'filter-separator';
    separator.textContent = '~';
    
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.className = 'filter-input max-value';
    maxInput.min = 0;
    maxInput.setAttribute('aria-label', `${filterInfo.displayName || filterInfo.name} 최대값`);
    
    // 입력 후 자동 적용
    minInput.addEventListener('change', () => autoApplyFilter(filterItem, filterInfo));
    maxInput.addEventListener('change', () => autoApplyFilter(filterItem, filterInfo));
    
    inputRow.appendChild(minInput);
    inputRow.appendChild(separator);
    inputRow.appendChild(maxInput);
    
    // 가로 배치를 위해 레이블과 입력 필드 그룹 추가
    filterSection.appendChild(labelSpan);
    filterSection.appendChild(inputRow);
    
    container.appendChild(filterSection);
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
    // 입력 래퍼 생성
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'input-with-clear';
    
    // 기본 텍스트 입력
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'filter-input text-value';
    input.placeholder = '';
    input.setAttribute('aria-label', `${filterInfo.displayName || filterInfo.name} 값`);
    
    // 클리어 버튼
    const clearBtn = document.createElement('button');
    clearBtn.className = 'clear-input-btn';
    clearBtn.innerHTML = '×';
    clearBtn.style.display = 'none';
    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        autoApplyFilter(filterItem, filterInfo);
    });
    
    // 입력값에 따라 클리어 버튼 표시/숨김
    input.addEventListener('input', () => {
        clearBtn.style.display = input.value ? 'block' : 'none';
    });
    
    // 입력 후 자동 적용
    input.addEventListener('change', () => autoApplyFilter(filterItem, filterInfo));
    
    inputWrapper.appendChild(input);
    inputWrapper.appendChild(clearBtn);
    container.appendChild(inputWrapper);
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
