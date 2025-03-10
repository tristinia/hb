/**
 * 페이지네이션 관리 모듈
 * 페이지 분할 및 네비게이션 처리
 */

const PaginationManager = (() => {
    // 페이지네이션 상태
    const state = {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: 0,
        totalPages: 1
    };
    
    // DOM 요소 참조
    let elements = {
        paginationContainer: null
    };
    
    /**
     * 모듈 초기화
     */
    function init() {
        // DOM 요소 참조 가져오기
        elements.paginationContainer = document.getElementById('pagination');
    }
    
    /**
     * 페이지네이션 업데이트
     * @param {number} totalItems - 전체 아이템 수
     */
    function updatePagination(totalItems) {
        state.totalItems = totalItems;
        state.totalPages = Math.ceil(totalItems / state.itemsPerPage);
        
        // 현재 페이지가 전체 페이지 수를 초과하면 조정
        if (state
