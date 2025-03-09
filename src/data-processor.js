// data-processor.js - 데이터 가공 담당 (간소화 버전)
// 중복 제거 및 최저가만 저장하는 버전

// 현재 날짜 객체
const currentDate = new Date();
// 날짜 포맷팅 (YYYY-MM-DD)
const today = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

/**
 * 아이템 목록 처리 - 간소화 버전
 * 중복 제거 및 최저가만 저장
 */
function processItems(items, categoryId) {
  // 중복 제거를 위한 맵 생성
  const uniqueItems = new Map();
  
  // 모든 아이템 처리
  items.forEach(item => {
    const itemName = item.item_name;
    const price = item.auction_price_per_unit;
    
    // 간소화된 아이템 객체
    const processedItem = {
      name: itemName,
      price: price,
      date: today
    };
    
    // 이미 있는 아이템인지 확인
    if (uniqueItems.has(itemName)) {
      const existingItem = uniqueItems.get(itemName);
      
      // 최저가 업데이트
      if (price < existingItem.price) {
        existingItem.price = price;
        existingItem.date = today;
      }
    } else {
      // 새 아이템 추가
      uniqueItems.set(itemName, processedItem);
    }
  });
  
  // Map을 배열로 변환하여 반환
  return Array.from(uniqueItems.values());
}

/**
 * 기존 데이터와 병합
 * 새 정보 추가 또는 최저가 업데이트
 */
function mergeWithExistingData(newItems, existingItems) {
  // 중복 제거를 위한 맵 생성
  const mergedItems = new Map();
  
  // 기존 아이템 먼저 맵에 추가
  if (existingItems && Array.isArray(existingItems)) {
    existingItems.forEach(item => {
      if (item.name) {
        mergedItems.set(item.name, item);
      }
    });
  }
  
  // 새 아이템 처리
  newItems.forEach(newItem => {
    if (!newItem.name) return;
    
    // 이미 있는 아이템인지 확인
    if (mergedItems.has(newItem.name)) {
      const existingItem = mergedItems.get(newItem.name);
      
      // 최저가 업데이트
      if (newItem.price < existingItem.price) {
        existingItem.price = newItem.price;
        existingItem.date = newItem.date;
      }
    } else {
      // 새 아이템 추가
      mergedItems.set(newItem.name, newItem);
    }
  });
  
  // Map을 배열로 변환하여 반환
  return Array.from(mergedItems.values());
}

/**
 * 아이템 옵션의 구조 분석
 * @param {Array} items - 아이템 목록
 * @returns {Object} 옵션 구조 메타데이터
 */
function analyzeOptionStructure(items) {
  // 옵션 구조를 저장할 객체
  const optionStructure = {};
  
  // 아이템 순회
  items.forEach(item => {
    // 옵션이 없는 경우 건너뜀
    if (!item.item_option || !Array.isArray(item.item_option)) return;
    
    // 아이템의 모든 옵션 순회
    item.item_option.forEach(option => {
      const optionType = option.option_type;
      if (!optionType) return;
      
      // 옵션 타입이 처음 나오는 경우 초기화
      if (!optionStructure[optionType]) {
        optionStructure[optionType] = {};
      }
      
      const structure = optionStructure[optionType];
      
      // 서브타입 정보 추가
      if (option.option_sub_type !== null) {
        structure.sub_type = determineValueFormat(option.option_sub_type);
      }
      
      // 값 정보 추가
      if (option.option_value !== null) {
        structure.value = determineValueFormat(option.option_value);
      }
      
      // 값2 정보 추가
      if (option.option_value2 !== null) {
        structure.value2 = determineValueFormat(option.option_value2);
      }
      
      // 설명 정보 추가
      if (option.option_desc !== null) {
        structure.desc = determineValueFormat(option.option_desc);
      }
    });
  });
  
  return optionStructure;
}

/**
 * 값의 형식 분석
 * @param {string} value - 분석할 값
 * @returns {string} 값 형식
 */
function determineValueFormat(value) {
  // 값이 없으면 null 반환
  if (value === null || value === undefined) return null;
  
  // RGB 색상 형식 (3개의 숫자가 콤마로 구분)
  if (typeof value === 'string' && /^\d+,\d+,\d+$/.test(value)) {
    return "rgb";
  }
  
  // 백분율
  if (typeof value === 'string' && value.endsWith('%')) {
    return "percentage";
  }
  
  // 랭크 정보 포함
  if (typeof value === 'string' && value.includes('랭크')) {
    return "rank";
  }
  
  // 레벨 또는 증가 정보 포함 (복합 정보)
  if (typeof value === 'string' && (value.includes('레벨') || value.includes('증가'))) {
    return "compound";
  }
  
  // 순수 숫자
  if (!isNaN(Number(value))) {
    return "number";
  }
  
  // 기본값은 텍스트로 처리
  return "text";
}

module.exports = {
  processItems,
  mergeWithExistingData,
  analyzeOptionStructure,
  determineValueFormat
};
