/**
 * 필터 관리 모듈
 * 아이템 옵션 필터링 처리 및 관리
 */

import optionFilter from './option-filter.js';
import metadataService from '../services/metadata.js';

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
        // 메타데이터 서비스 초기화
        await metadataService.initialize();
        logDebug('메타데이터 서비스 초기화 완료');
        
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
 * 카테고리별 메타데이터 로드
 */
async function loadCategoryMetadata(category) {
    try {
        // metadataService를 통해 카테고리별 데이터 로드
        await metadataService.loadSetEffectForCategory(category);
        await metadataService.loadReforgeOptionsForCategory(category);
        
        // 데이터는 metadataService.metadata에 저장됩니다.
        logDebug(`카테고리 ${category}의 메타데이터 로드 완료`);
    } catch (error) {
        console.error(`카테고리 ${category} 메타데이터 로드 중 오류:`, error);
    }
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
    applyFilters
};
