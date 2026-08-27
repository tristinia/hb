/**
 * 필터 관리 모듈
 * 아이템 옵션 필터링 처리 및 관리
 */

import optionFilter from './option-filter.js';

// 필터 상태
const state = {
    availableFilters: [],
    activeFilters: [],
    currentCategories: [],
    isInitialized: false,
    debug: false,
    autoCompleteData: {
        enchants: {},
        reforges: {},
        setEffects: {}
    }
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
    try {
        // optionFilter 초기화
        await optionFilter.initialize();
        logDebug('옵션 필터 초기화 완료');
        
        state.isInitialized = true;
        logDebug('FilterManager 초기화 완료');
    } catch (error) {
        console.error('필터 모듈 초기화 오류:', error);
        return false;
    }
}

/**
 * 필터 옵션 업데이트
 */
function updateFilterOption(filterId, filterOption) {
    if (!filterId || !filterOption) return;
    
    // 기존 필터 옵션 검색
    const existingFilterIndex = state.activeFilters.findIndex(f => f.name === filterId);
    
    if (existingFilterIndex !== -1) {
        // 기존 옵션 업데이트
        state.activeFilters[existingFilterIndex] = {
            ...state.activeFilters[existingFilterIndex],
            ...filterOption
        };
    } else {
        // 없으면 새로 추가
        state.activeFilters.push({
            name: filterId,
            ...filterOption
        });
    }
    
    // 필터 적용
    applyFilters();
}

/**
 * 필터 적용
 */
function applyFilters() {
    // 필터 변경 이벤트 발생
    const event = new CustomEvent('filterChanged', {
        detail: {
            filters: state.activeFilters,
            hideLoading: true
        }
    });
    document.dispatchEvent(event);
}

/**
 * 필터 옵션 추가
 */
function addFilterOption(filterId, filterOption) {
    if (!filterId || !filterOption) return;
    
    if (!filterId) return;
    
    // 이미 존재하는 필터 제거
    state.activeFilters = state.activeFilters.filter(f => f.name !== filterId);
    
    state.activeFilters.push({
        name: filterId,
        displayName: filterOption.displayName || filterOption.name,
        type: filterOption.type || 'range',
        ...filterOption
    });
    
    // 필터 적용
    applyFilters();
}

/**
 * 필터 옵션 제거
 */
function removeFilterOption(filterId) {
    if (!filterId) return;
    
    // 해당 ID를 가진 필터 제거
    state.activeFilters = state.activeFilters.filter(filter => filter.name !== filterId);
    
    // 필터 적용
    applyFilters();
}

/**
 * 검색 결과에 등장하는 아이템 옵션을 추출 (필터 패널에 표시할 필터 종류 결정)
 * @param {Array} items
 * @returns {string[]}
 */
function computeAvailableFilters(items) {
    const foundOptionTypes = new Set();
    if (!items || items.length === 0) {
        return [];
    }

    for (const item of items) {
        if (item.item_option && Array.isArray(item.item_option)) {
            for (const option of item.item_option) {
                if (option.option_type === '펫 정보' && option.option_sub_type && option.option_sub_type !== '종족명') {
                    foundOptionTypes.add(`펫 정보: ${option.option_sub_type}`);
                }
                else if (option.option_type && option.option_type !== '펫 정보') {
                    foundOptionTypes.add(option.option_type);
                }
            }
        }
    }

    return Array.from(foundOptionTypes);
}

/**
 * 검색 결과에 등장하는 카테고리를 추출
 * @param {Array} items
 * @returns {string[]}
 */
function computeAvailableCategories(items) {
    const foundCategories = new Set();
    if (!items || items.length === 0) {
        return [];
    }

    for (const item of items) {
        if (item.auction_item_category) {
            foundCategories.add(item.auction_item_category);
        }
    }

    return Array.from(foundCategories);
}

/**
 * 검색 결과에 등장한 카테고리만 기록 (세공 및 세트효과 메타데이터는 이미 전체 로드 상태)
 * @param {string[]} categories
 */
function setCurrentCategories(categories) {
    state.currentCategories = Array.isArray(categories) ? categories.filter(Boolean) : [];
}

/**
 * 현재 검색 결과 카테고리 목록 반환
 * @returns {string[]}
 */
function getCurrentCategories() {
    return state.currentCategories;
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
 * 필터 초기화
 */
function resetFilters() {
    state.activeFilters = [];
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
    resetFilters,
    getFilters,
    addFilterOption,
    removeFilterOption,
    updateFilterOption,
    applyFilters,
    setCurrentCategories,
    getCurrentCategories,
    computeAvailableFilters,
    computeAvailableCategories
};
