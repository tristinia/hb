/**
 * @module shared/item-identity
 * @summary 아이템 정체성 키(대표 이름) 생성 규칙.
 * mabinogi-metadata-processor(D1 저장 시 사용하는 대표 이름)와 mabinogi-auction-list(자동완성
 * 검색 결과 필터링)가 동일한 기준을 공유해야 한다 — 두 곳이 서로 다른 기준으로 "같은 아이템"을
 * 판단하면 검색 결과와 실제 저장된 시세가 어긋난다 (이슈 #29).
 */

// 아이템 대표 이름(정체성 키) 생성 규칙 예외 처리 카테고리
export const ITEM_NAME_RULES = {
    // '뷰티 쿠폰', '기타'는 item_name이 Nexon API에서 "(Unknown)"으로 오는 사례가 확인되어 추가
    // (이중 안전망: 카테고리 화이트리스트 + 아래 getRepresentativeItemName의 값 자체 검증)
    USE_DISPLAY_NAME_CATEGORIES: ['인챈트 스크롤', '도면', '옷본', '뷰티 쿠폰', '기타'],
    PET_MEDAL_CATEGORY: '분양 메달',
};

/**
 * 아이템의 대표 이름(정체성 키) 생성 (예외 처리 규칙 적용)
 * @param {object} item - item_name, item_display_name, auction_item_category 등을 포함한 아이템 객체
 * @returns {string} 생성된 대표 이름
 */
export function getRepresentativeItemName(item) {
    const category = item.auction_item_category;

    // 같은 아이템이 '@' 유무로 서로 다른 정체성 키로 쪼개지는 것을 방지
    const rawName = item.item_name || '';
    const normalizedName = rawName.startsWith('@') ? rawName.slice(1) : rawName;

    // 신뢰 불가 이름값 방어: item_name이 비어있거나 "(Unknown)"이면(Nexon API가 이름 해석에
    // 실패한 경우로 추정), 카테고리 화이트리스트와 무관하게 item_display_name을 우선 사용
    if (!normalizedName || normalizedName === '(Unknown)') {
        return item.item_display_name || normalizedName;
    }

    // '분양 메달'은 '아이템 이름 - 펫 종족명' 형식으로 조합
    if (category === ITEM_NAME_RULES.PET_MEDAL_CATEGORY) {
        const options = item.item_option || [];
        const petRaceOption = options.find(opt => opt.option_type === '펫 정보' && opt.option_sub_type === '종족명');
        return petRaceOption && petRaceOption.option_value ? `${normalizedName} - ${petRaceOption.option_value}` : normalizedName;
    }

    // '인챈트 스크롤', '도면', '옷본', '뷰티 쿠폰', '기타'는 item_display_name 사용
    if (ITEM_NAME_RULES.USE_DISPLAY_NAME_CATEGORIES.includes(category)) {
        return item.item_display_name || normalizedName;
    }

    return normalizedName;
}
