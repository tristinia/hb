// category-manager.js - 카테고리 관리
module.exports = {
  // 마비노기 API 카테고리 목록 (대분류 및 소분류)
  mainCategories: [
    { id: '근거리 장비', name: '근거리 장비' },
    { id: '원거리 장비', name: '원거리 장비' },
    { id: '마법 장비', name: '마법 장비' },
    { id: '갑옷', name: '갑옷' },
    { id: '방어 장비', name: '방어 장비' },
    { id: '액세서리', name: '액세서리' },
    { id: '특수 장비', name: '특수 장비' },
    { id: '설치물', name: '설치물' },
    { id: '인챈트 용품', name: '인챈트 용품' },
    { id: '스크롤', name: '스크롤' },
    { id: '마기그래피 용품', name: '마기그래피 용품' },
    { id: '서적', name: '서적' },
    { id: '소모품', name: '소모품' },
    { id: '토템', name: '토템' },
    { id: '생활 재료', name: '생활 재료' },
    { id: '기타', name: '기타' }
  ],
  
  // 각 대분류에 속한 소분류 목록
  categories: [
    // 근거리 장비
    { id: '한손 장비', name: '한손 장비', mainCategory: '근거리 장비' },
    { id: '양손 장비', name: '양손 장비', mainCategory: '근거리 장비' },
    { id: '검', name: '검', mainCategory: '근거리 장비' },
    { id: '도끼', name: '도끼', mainCategory: '근거리 장비' },
    { id: '둔기', name: '둔기', mainCategory: '근거리 장비' },
    { id: '랜스', name: '랜스', mainCategory: '근거리 장비' },
    { id: '핸들', name: '핸들', mainCategory: '근거리 장비' },
    { id: '너클', name: '너클', mainCategory: '근거리 장비' },
    { id: '체인 블레이드', name: '체인 블레이드', mainCategory: '근거리 장비' },
    
    // 원거리 장비
    { id: '활', name: '활', mainCategory: '원거리 장비' },
    { id: '석궁', name: '석궁', mainCategory: '원거리 장비' },
    { id: '듀얼건', name: '듀얼건', mainCategory: '원거리 장비' },
    { id: '수리검', name: '수리검', mainCategory: '원거리 장비' },
    { id: '아틀라틀', name: '아틀라틀', mainCategory: '원거리 장비' },
    { id: '원거리 소모품', name: '원거리 소모품', mainCategory: '원거리 장비' },
    
    // 마법 장비
    { id: '실린더', name: '실린더', mainCategory: '마법 장비' },
    { id: '스태프', name: '스태프', mainCategory: '마법 장비' },
    { id: '원드', name: '원드', mainCategory: '마법 장비' },
    { id: '마도서', name: '마도서', mainCategory: '마법 장비' },
    { id: '오브', name: '오브', mainCategory: '마법 장비' },
    
    // 갑옷
    { id: '중갑옷', name: '중갑옷', mainCategory: '갑옷' },
    { id: '경갑옷', name: '경갑옷', mainCategory: '갑옷' },
    { id: '천옷', name: '천옷', mainCategory: '갑옷' },
    
    // 방어 장비
    { id: '장갑', name: '장갑', mainCategory: '방어 장비' },
    { id: '신발', name: '신발', mainCategory: '방어 장비' },
    { id: '모자/가발', name: '모자/가발', mainCategory: '방어 장비' },
    { id: '방패', name: '방패', mainCategory: '방어 장비' },
    { id: '로브', name: '로브', mainCategory: '방어 장비' },
    
    // 액세서리
    { id: '얼굴 장식', name: '얼굴 장식', mainCategory: '액세서리' },
    { id: '액세서리', name: '액세서리', mainCategory: '액세서리' },
    { id: '날개', name: '날개', mainCategory: '액세서리' },
    { id: '꼬리', name: '꼬리', mainCategory: '액세서리' },
    
    // 특수 장비
    { id: '악기', name: '악기', mainCategory: '특수 장비' },
    { id: '생활 도구', name: '생활 도구', mainCategory: '특수 장비' },
    { id: '마리오네트', name: '마리오네트', mainCategory: '특수 장비' },
    { id: '에코스톤', name: '에코스톤', mainCategory: '특수 장비' },
    { id: '에이도스', name: '에이도스', mainCategory: '특수 장비' },
    { id: '유물', name: '유물', mainCategory: '특수 장비' },
    { id: '기타 장비', name: '기타 장비', mainCategory: '특수 장비' },
    
    // 설치물
    { id: '의자/사물', name: '의자/사물', mainCategory: '설치물' },
    { id: '낭만농장/달빛섬', name: '낭만농장/달빛섬', mainCategory: '설치물' },
    
    // 인챈트 용품
    { id: '인챈트 스크롤', name: '인챈트 스크롤', mainCategory: '인챈트 용품' },
    { id: '마법가루', name: '마법가루', mainCategory: '인챈트 용품' },
    
    // 스크롤
    { id: '도면', name: '도면', mainCategory: '스크롤' },
    { id: '옷본', name: '옷본', mainCategory: '스크롤' },
    { id: '마족 스크롤', name: '마족 스크롤', mainCategory: '스크롤' },
    { id: '기타 스크롤', name: '기타 스크롤', mainCategory: '스크롤' },
    
    // 마기그래피 용품
    { id: '마기그래프', name: '마기그래프', mainCategory: '마기그래피 용품' },
    { id: '마기그래프 도안', name: '마기그래프 도안', mainCategory: '마기그래피 용품' },
    { id: '기타 재료', name: '기타 재료', mainCategory: '마기그래피 용품' },
    
    // 서적
    { id: '책', name: '책', mainCategory: '서적' },
    { id: '마비노벨', name: '마비노벨', mainCategory: '서적' },
    { id: '페이지', name: '페이지', mainCategory: '서적' },
    
    // 소모품
    { id: '포션', name: '포션', mainCategory: '소모품' },
    { id: '음식', name: '음식', mainCategory: '소모품' },
    { id: '허브', name: '허브', mainCategory: '소모품' },
    { id: '던전 통행증', name: '던전 통행증', mainCategory: '소모품' },
    { id: '알반 훈련석', name: '알반 훈련석', mainCategory: '소모품' },
    { id: '개조석', name: '개조석', mainCategory: '소모품' },
    { id: '보석', name: '보석', mainCategory: '소모품' },
    { id: '변신 메달', name: '변신 메달', mainCategory: '소모품' },
    { id: '염색 앰플', name: '염색 앰플', mainCategory: '소모품' },
    { id: '스케치', name: '스케치', mainCategory: '소모품' },
    { id: '핀즈비즈', name: '핀즈비즈', mainCategory: '소모품' },
    { id: '기타 소모품', name: '기타 소모품', mainCategory: '소모품' },
    
    // 토템
    { id: '토템', name: '토템', mainCategory: '토템' },
    
    // 생활 재료
    { id: '주머니', name: '주머니', mainCategory: '생활 재료' },
    { id: '천옷/방직', name: '천옷/방직', mainCategory: '생활 재료' },
    { id: '제련/블랙스미스', name: '제련/블랙스미스', mainCategory: '생활 재료' },
    { id: '힐웬 공학', name: '힐웬 공학', mainCategory: '생활 재료' },
    { id: '매직 크래프트', name: '매직 크래프트', mainCategory: '생활 재료' },
    
    // 기타
    { id: '제스처', name: '제스처', mainCategory: '기타' },
    { id: '말풍선 스티커', name: '말풍선 스티커', mainCategory: '기타' },
    { id: '피니 펫', name: '피니 펫', mainCategory: '기타' },
    { id: '불타래', name: '불타래', mainCategory: '기타' },
    { id: '퍼퓸', name: '퍼퓸', mainCategory: '기타' },
    { id: '분양 메달', name: '분양 메달', mainCategory: '기타' },
    { id: '뷰티 쿠폰', name: '뷰티 쿠폰', mainCategory: '기타' },
    { id: '기타', name: '기타', mainCategory: '기타' }
  ],
  
  // 특정 카테고리 정보 가져오기
  getCategoryById(id) {
    return this.categories.find(cat => cat.id === id);
  },
  
  // 메인 카테고리별 카테고리 목록 가져오기
  getCategoriesByMainCategory(mainCategory) {
    return this.categories.filter(cat => cat.mainCategory === mainCategory);
  },
  
  // 모든 메인 카테고리 가져오기
  getAllMainCategories() {
    return this.mainCategories;
  }
};
