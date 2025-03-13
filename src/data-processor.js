// data-processor.js - 데이터 가공 담당
// 중복 제거 및 최저가만 저장하는 버전

// 현재 날짜 객체
const currentDate = new Date();
// 날짜 포맷팅 (YYYY-MM-DD)
const today = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

/**
 * 아이템 목록 처리
 * 중복 제거 및 최저가 저장
 */
function processItems(items, categoryId) {
  // 유효한 아이템만 필터링
  const validItems = items.filter(item => 
    item && 
    item.item_name // 아이템 이름만 있으면 충분
  );

  // 중복 제거를 위한 맵 생성
  const uniqueItems = new Map();
  
  // 모든 유효한 아이템 처리
  validItems.forEach(item => {
    const itemName = item.item_name;
    const price = item.auction_price_per_unit;
    
    // 간소화된 아이템 객체
    const processedItem = {
      name: itemName,
      price: price,
      date: today
    };
    
    // 최저가 처리 로직
    if (uniqueItems.has(itemName)) {
      const existingItem = uniqueItems.get(itemName);
      
      if (price < existingItem.price) {
        existingItem.price = price;
        existingItem.date = today;
      }
    } else {
      uniqueItems.set(itemName, processedItem);
    }
  });
  
  // 정렬해서 반환
  return Array.from(uniqueItems.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
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
  return Array.from(mergedItems.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

module.exports = {
  processItems,
  mergeWithExistingData
};
