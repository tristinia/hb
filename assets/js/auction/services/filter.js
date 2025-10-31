/**
 * 필터 관리 모듈
 * 아이템 옵션 필터링 처리 및 관리
 */

import optionFilter from './option-filter.js';
import metadataLoader from '../services/metadata-loader.js';

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
    } catch (error) {
        console.error('필터 모듈 초기화 오류:', error);
        return false;
    }
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
 * 현재 카테고리에 맞는 필터 옵션 업데이트
 */
async function updateFiltersForCategory(category) {
    state.currentCategory = category;
    
    try {
        // 카테고리에 맞는 옵션 구조 로드
        const filters = await loadFiltersForCategory(category);
        
        // 가용 필터 설정
        state.availableFilters = filters;
        
        // 활성 필터 초기화
        state.activeFilters = [];
        
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
        
        // 필터 상태 초기화
        state.availableFilters = [];
        state.activeFilters = [];
    }
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
 * 카테고리별 사용 가능한 필터 옵션 가져오기
 */
function getAvailableFiltersForCategory(category) {
    // 이미 로드된 필터 옵션 있으면 사용
    if (state.availableFilters.length > 0) {
        return state.availableFilters;
    }
    
    // 카테고리에 맞는 옵션 구조 로드
    try {
        return loadFiltersForCategory(category);
    } catch (error) {
        console.error('필터 옵션 로드 실패:', error);
        return [];
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
    getFilters,
    getAvailableFiltersForCategory,
    addFilterOption,
    removeFilterOption,
    updateFilterOption,
    applyFilters
};
