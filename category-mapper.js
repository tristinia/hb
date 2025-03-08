// category-mapper.js
const categories = [
  // 근거리 장비
  { id: 'weapon_blade', name: '검', mainCategory: '근거리 장비' },
  { id: 'weapon_blunt', name: '둔기', mainCategory: '근거리 장비' },
  { id: 'weapon_lance', name: '랜스', mainCategory: '근거리 장비' },
  { id: 'weapon_axe', name: '도끼', mainCategory: '근거리 장비' },
  { id: 'weapon_handle', name: '핸들', mainCategory: '근거리 장비' },
  { id: 'weapon_knuckle', name: '너클', mainCategory: '근거리 장비' },
  { id: 'weapon_chain_blade', name: '체인 블레이드', mainCategory: '근거리 장비' },
  
  // 원거리 장비
  { id: 'weapon_bow', name: '활', mainCategory: '원거리 장비' },
  { id: 'weapon_crossbow', name: '석궁', mainCategory: '원거리 장비' },
  { id: 'weapon_dualgun', name: '듀얼건', mainCategory: '원거리 장비' },
  { id: 'weapon_shuriken', name: '수리검', mainCategory: '원거리 장비' },
  { id: 'weapon_atlatl', name: '아틀라틀', mainCategory: '원거리 장비' },
  { id: 'weapon_ranged_item', name: '원거리 소모품', mainCategory: '원거리 장비' },
  
  // 마법 장비
  { id: 'weapon_cylinder', name: '실린더', mainCategory: '마법 장비' },
  { id: 'weapon_staff', name: '스태프', mainCategory: '마법 장비' },
  { id: 'weapon_wand', name: '원드', mainCategory: '마법 장비' },
  { id: 'weapon_spell_book', name: '마도서', mainCategory: '마법 장비' },
  { id: 'weapon_orb', name: '오브', mainCategory: '마법 장비' },
  
  // 갑옷
  { id: 'armor_heavy', name: '중갑옷', mainCategory: '갑옷' },
  { id: 'armor_light', name: '경갑옷', mainCategory: '갑옷' },
  { id: 'armor_cloth', name: '천옷', mainCategory: '갑옷' },
  
  // 방어 장비
  { id: 'armor_glove', name: '장갑', mainCategory: '방어 장비' },
  { id: 'armor_shoe', name: '신발', mainCategory: '방어 장비' },
  { id: 'armor_helmet', name: '모자/가발', mainCategory: '방어 장비' },
  { id: 'armor_shield', name: '방패', mainCategory: '방어 장비' },
  { id: 'armor_robe', name: '로브', mainCategory: '방어 장비' },
  
  // 액세서리
  { id: 'accessory_face', name: '얼굴 장식', mainCategory: '액세서리' },
  { id: 'accessory_accessory', name: '액세서리', mainCategory: '액세서리' },
  { id: 'accessory_wing', name: '날개', mainCategory: '액세서리' },
  { id: 'accessory_tail', name: '꼬리', mainCategory: '액세서리' },
  
  // 특수 장비
  { id: 'special_instrument', name: '악기', mainCategory: '특수 장비' },
  { id: 'special_life_tool', name: '생활도구', mainCategory: '특수 장비' },
  { id: 'special_puppet', name: '마리오네트', mainCategory: '특수 장비' },
  { id: 'special_ecostone', name: '에코스톤', mainCategory: '특수 장비' },
  { id: 'special_aidos', name: '에이도스', mainCategory: '특수 장비' },
  { id: 'special_relic', name: '유물', mainCategory: '특수 장비' },
  { id: 'special_etc', name: '기타장비', mainCategory: '특수 장비' },
  
  // 설치물
  { id: 'install_chair', name: '의자/사물', mainCategory: '설치물' },
  { id: 'install_farm', name: '낭만농장/달빛섬', mainCategory: '설치물' },
  
  // 인챈트 용품
  { id: 'enchant_scroll', name: '인챈트 스크롤', mainCategory: '인챈트 용품' },
  { id: 'enchant_powder', name: '마법가루', mainCategory: '인챈트 용품' },
  
  // 스크롤
  { id: 'scroll_blueprint', name: '도면', mainCategory: '스크롤' },
  { id: 'scroll_pattern', name: '옷본', mainCategory: '스크롤' },
  { id: 'scroll_demon', name: '마족 스크롤', mainCategory: '스크롤' },
  { id: 'scroll_etc', name: '기타 스크롤', mainCategory: '스크롤' },
  
  // 마기그래피 용품
  { id: 'magicraft_magi', name: '마기그래프', mainCategory: '마기그래피 용품' },
  { id: 'magicraft_design', name: '마기그래프 도안', mainCategory: '마기그래피 용품' },
  { id: 'magicraft_material', name: '기타 재료', mainCategory: '마기그래피 용품' },
  
  // 서적
  { id: 'book_book', name: '책', mainCategory: '서적' },
  { id: 'book_mabinobel', name: '마비노벨', mainCategory: '서적' },
  { id: 'book_page', name: '페이지', mainCategory: '서적' },
  
  // 소모품
  { id: 'consume_potion', name: '포션', mainCategory: '소모품' },
  { id: 'consume_food', name: '음식', mainCategory: '소모품' },
  { id: 'consume_herb', name: '허브', mainCategory: '소모품' },
  { id: 'consume_pass', name: '던전 통행증', mainCategory: '소모품' },
  { id: 'consume_alban_stone', name: '알반 훈련석', mainCategory: '소모품' },
  { id: 'consume_upgrade_stone', name: '개조석', mainCategory: '소모품' },
  { id: 'consume_gem', name: '보석', mainCategory: '소모품' },
  { id: 'consume_transformation', name: '변신메달', mainCategory: '소모품' },
  { id: 'consume_dye', name: '염색앰플', mainCategory: '소모품' },
  { id: 'consume_sketch', name: '스케치', mainCategory: '소모품' },
  { id: 'consume_pinzbee', name: '핀즈비즈', mainCategory: '소모품' },
  { id: 'consume_etc', name: '기타 소모품', mainCategory: '소모품' },
  
  // 토템
  { id: 'totem_totem', name: '토템', mainCategory: '토템' },
  
  // 생활 재료
  { id: 'life_material_bag', name: '주머니', mainCategory: '생활 재료' },
  { id: 'life_material_cloth', name: '천옷/방직', mainCategory: '생활 재료' },
  { id: 'life_material_refine', name: '제련/블랙스미스', mainCategory: '생활 재료' },
  { id: 'life_material_hillwen', name: '힐웬공학', mainCategory: '생활 재료' },
  { id: 'life_material_magic', name: '매직크래프트', mainCategory: '생활 재료' },
  
  // 기타
  { id: 'etc_gesture', name: '제스처', mainCategory: '기타' },
  { id: 'etc_balloon', name: '말풍선 스티커', mainCategory: '기타' },
  { id: 'etc_fynni_pet', name: '피니펫', mainCategory: '기타' },
  { id: 'etc_fate_string', name: '불타래', mainCategory: '기타' },
  { id: 'etc_perfume', name: '퍼퓸', mainCategory: '기타' },
  { id: 'etc_adoption', name: '분양 메달', mainCategory: '기타' },
  { id: 'etc_beauty', name: '뷰티 쿠폰', mainCategory: '기타' },
  { id: 'etc_etc', name: '기타', mainCategory: '기타' }
];

module.exports = {
  getAllCategories: () => categories,
  
  getCategoryById: (id) => categories.find(cat => cat.id === id),
  
  getCategoriesByMainCategory: (mainCategory) => 
    categories.filter(cat => cat.mainCategory === mainCategory)
};
