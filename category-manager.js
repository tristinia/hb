// category-manager.js - 카테고리 관리
module.exports = {
  // 마비노기 API 카테고리 목록 (한글 이름)
  categories: [
    // 근거리 무기
    { id: '검', name: '검', mainCategory: '근거리 장비' },
    { id: '둔기', name: '둔기', mainCategory: '근거리 장비' },
    { id: '랜스', name: '랜스', mainCategory: '근거리 장비' },
    { id: '도끼', name: '도끼', mainCategory: '근거리 장비' },
    { id: '너클', name: '너클', mainCategory: '근거리 장비' },
    
    // 원거리 무기
    { id: '석궁', name: '석궁', mainCategory: '원거리 장비' },
    { id: '활', name: '활', mainCategory: '원거리 장비' },
    { id: '듀얼건', name: '듀얼건', mainCategory: '원거리 장비' },
    { id: '수리검', name: '수리검', mainCategory: '원거리 장비' },
    
    // 마법 장비
    { id: '실린더', name: '실린더', mainCategory: '마법 장비' },
    { id: '원드', name: '원드', mainCategory: '마법 장비' },
    { id: '스태프', name: '스태프', mainCategory: '마법 장비' },
    
    // 방어구
    { id: '경갑옷', name: '경갑옷', mainCategory: '갑옷' },
    { id: '중갑옷', name: '중갑옷', mainCategory: '갑옷' },
    { id: '로브', name: '로브', mainCategory: '방어 장비' },
    { id: '투구', name: '투구', mainCategory: '방어 장비' },
    { id: '장갑', name: '장갑', mainCategory: '방어 장비' },
    { id: '신발', name: '신발', mainCategory: '방어 장비' },
    { id: '방패', name: '방패', mainCategory: '방어 장비' },
    
    // 액세서리
    { id: '귀걸이', name: '귀걸이', mainCategory: '액세서리' },
    { id: '반지', name: '반지', mainCategory: '액세서리' },
    { id: '목걸이', name: '목걸이', mainCategory: '액세서리' },
    
    // 특수 장비
    { id: '에코스톤', name: '에코스톤', mainCategory: '특수 장비' },
    { id: '인챈트 스크롤', name: '인챈트 스크롤', mainCategory: '인챈트 용품' }
  ],
  
  // 특정 카테고리 정보 가져오기
  getCategoryById(id) {
    return this.categories.find(cat => cat.id === id);
  },
  
  // 메인 카테고리별 카테고리 목록 가져오기
  getCategoriesByMainCategory(mainCategory) {
    return this.categories.filter(cat => cat.mainCategory === mainCategory);
  }
};
