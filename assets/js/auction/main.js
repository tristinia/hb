/**
 * main.js
 * 애플리케이션 메인 진입점
 */

import filterManager from './filter-manager.js';

// 메타데이터 로드
async function loadMetaData() {
  try {
    // 옵션 구조 데이터
    const optionStructureResponse = await fetch('../../data/option_structure.json');
    const optionStructure = await optionStructureResponse.json();
    
    // 세공 메타데이터
    const reforgesResponse = await fetch('../../data/meta/reforges/reforges.json');
    const reforges = await reforgesResponse.json();
    
    // 접두/접미 인챈트 데이터
    const prefixResponse = await fetch('../../data/meta/enchants/prefix.json');
    const prefixEnchants = await prefixResponse.json();
    
    const suffixResponse = await fetch('../../data/meta/enchants/suffix.json');
    const suffixEnchants = await suffixResponse.json();
    
    // 세트 효과 메타데이터 (카테고리별로 로드)
    const categories = ['검']; // 현재는 '검' 카테고리만 처리
    const setEffects = {};
    
    for (const category of categories) {
      try {
        const setEffectResponse = await fetch(`../../data/meta/set_bonus/${category}.json`);
        setEffects[category] = await setEffectResponse.json();
      } catch (err) {
        console.warn(`${category} 세트 효과 로드 실패:`, err);
      }
    }
    
    return {
      optionStructure,
      reforges,
      prefixEnchants,
      suffixEnchants,
      setEffects
    };
  } catch (err) {
    console.error('메타데이터 로드 실패:', err);
    return {
      optionStructure: {},
      reforges: { reforges: [] },
      prefixEnchants: [],
      suffixEnchants: [],
      setEffects: {}
    };
  }
}

// 데이터 유효성 검사
function validateItemData(item) {
  if (!item) return false;
  
  // 최소한의 필수 필드 검사
  if (!item.item_name && !item.item_display_name) {
    console.warn('아이템에 필수 필드(이름)가 없습니다:', item);
    return false;
  }
  
  // 옵션 배열 검사
  if (!Array.isArray(item.item_option) && !Array.isArray(item.options)) {
    console.warn('아이템에 옵션 배열이 없거나 배열이 아닙니다:', item);
    return false;
  }
  
  return true;
}

// 데이터 구조 정규화
function normalizeItems(items) {
  return items.map(item => {
    // 이름 필드 표준화
    if (!item.item_display_name && item.item_name) {
      item.item_display_name = item.item_name;
    }
    
    // 옵션 필드 표준화
    if (!item.options && item.item_option) {
      item.options = item.item_option;
    } else if (!item.item_option && item.options) {
      item.item_option = item.options;
    }
    
    return item;
  });
}

// 메인 초기화 함수
async function init() {
  try {
    // 로딩 표시
    const itemsContainer = document.getElementById('items-container');
    if (itemsContainer) {
      itemsContainer.innerHTML = '<div style="text-align: center; padding: 40px;">데이터를 불러오는 중입니다...</div>';
    }
    
    // 스타일 추가
    filterManager.addStyles();
    
    // DOM 요소 참조
    const filterContainer = document.getElementById('filter-container');
    
    if (!filterContainer || !itemsContainer) {
      console.error('필요한 DOM 요소를 찾을 수 없습니다.');
      return;
    }
    
    // 메타데이터 로드
    const metaData = await loadMetaData();
    
    // 아이템 데이터 로드
    try {
      // 카테고리에 맞는 아이템 데이터 로드 (현재는 '검' 카테고리만 처리)
      const category = '검'; // 현재 선택된 카테고리
      const itemsResponse = await fetch(`../../data/items/${category}.json`);
      const itemsData = await itemsResponse.json();
      const items = Array.isArray(itemsData) ? itemsData : (itemsData.items || []);
      
      // 유효한 아이템만 필터링 & 데이터 구조 정규화
      const validItems = normalizeItems(items.filter(validateItemData));
      
      // 필터 매니저 초기화
      filterManager.init(validItems, metaData, filterContainer, itemsContainer);
    } catch (err) {
      console.error('아이템 데이터 로드 실패:', err);
      itemsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c;">아이템 데이터를 로드할 수 없습니다.</div>';
    }
  } catch (err) {
    console.error('초기화 실패:', err);
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', init);
