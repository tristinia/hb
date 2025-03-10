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
        if (state.currentPage > state.totalPages) {
            state.currentPage = Math.max(1, state.totalPages);
        }
        
        renderPagination();
        updatePageDisplay();
    }
    
    /**
     * 페이지네이션 UI 렌더링
     */
    function renderPagination() {
        if (!elements.paginationContainer) return;
        
        // 표시할 아이템이 없거나 한 페이지면 페이지네이션 숨기기
        if (state.totalItems <= state.itemsPerPage || state.totalPages <= 1) {
            elements.paginationContainer.innerHTML = '';
            return;
        }
        
        // 페이지네이션 HTML 생성
        let paginationHTML = '<ul class="pagination-list">';
        
        // 이전 페이지 버튼
        if (state.currentPage > 1) {
            paginationHTML += `
                <li class="pagination-item">
                    <button class="pagination-link" data-page="${state.currentPage - 1}" aria-label="이전 페이지">
                        &lt;
                    </button>
                </li>
            `;
        }
        
        // 페이지 번호 버튼
        // 표시할 페이지 범위 계산 (현재 페이지 주변 5개)
        const maxVisiblePages = 5;
        let startPage = Math.max(1, state.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(state.totalPages, startPage + maxVisiblePages - 1);
        
        // 시작 페이지 조정
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        // 첫 페이지 버튼 (생략 표시가 필요한 경우)
        if (startPage > 1) {
            paginationHTML += `
                <li class="pagination-item">
                    <button class="pagination-link" data-page="1" aria-label="첫 페이지">1</button>
                </li>
            `;
            
            if (startPage > 2) {
                paginationHTML += `
                    <li class="pagination-item pagination-ellipsis">...</li>
                `;
            }
        }
        
        // 페이지 번호 버튼 생성
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <li class="pagination-item">
                    <button class="pagination-link ${i === state.currentPage ? 'active' : ''}" 
                            data-page="${i}" aria-label="${i} 페이지">${i}</button>
                </li>
            `;
        }
        
        // 마지막 페이지 버튼 (생략 표시가 필요한 경우)
        if (endPage < state.totalPages) {
            if (endPage < state.totalPages - 1) {
                paginationHTML += `
                    <li class="pagination-item pagination-ellipsis">...</li>
                `;
            }
            
            paginationHTML += `
                <li class="pagination-item">
                    <button class="pagination-link" data-page="${state.totalPages}" 
                            aria-label="마지막 페이지">${state.totalPages}</button>
                </li>
            `;
        }
        
        // 다음 페이지 버튼
        if (state.currentPage < state.totalPages) {
            paginationHTML += `
                <li class="pagination-item">
                    <button class="pagination-link" data-page="${state.currentPage + 1}" 
                            aria-label="다음 페이지">&gt;</button>
                </li>
            `;
        }
        
        paginationHTML += '</ul>';
        
        // 페이지네이션 HTML 설정
        elements.paginationContainer.innerHTML = paginationHTML;
        
        // 페이지 버튼 이벤트 리스너 설정
        const pageButtons = elements.paginationContainer.querySelectorAll('.pagination-link');
        pageButtons.forEach(button => {
            button.addEventListener('click', handlePageClick);
        });
    }
    
    /**
     * 페이지 클릭 이벤트 처리
     * @param {Event} event - 클릭 이벤트
     */
    function handlePageClick(event) {
        const page = parseInt(event.currentTarget.getAttribute('data-page'), 10);
        if (!isNaN(page) && page !== state.currentPage) {
            changePage(page);
        }
    }
    
    /**
     * 페이지 변경
     * @param {number} page - 새 페이지 번호
     */
    function changePage(page) {
        // 유효한 페이지 범위 확인
        if (page < 1 || page > state.totalPages) {
            return;
        }
        
        // 현재 페이지 업데이트
        state.currentPage = page;
        
        // UI 업데이트
        renderPagination();
        updatePageDisplay();
        
        // 페이지 변경 이벤트 발생
        const startIndex = (state.currentPage - 1) * state.itemsPerPage;
        const endIndex = Math.min(startIndex + state.itemsPerPage, state.totalItems);
        
        const event = new CustomEvent('pageChanged', {
            detail: {
                page: state.currentPage,
                startIndex,
                endIndex
            }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 페이지 표시 업데이트
     */
    function updatePageDisplay() {
        // 현재 표시할 항목 범위 계산
        const startIndex = (state.currentPage - 1) * state.itemsPerPage;
        const endIndex = Math.min(startIndex + state.itemsPerPage, state.totalItems);
        
        // 페이지 변경 이벤트 발생
        const event = new CustomEvent('pageChanged', {
            detail: {
                page: state.currentPage,
                startIndex,
                endIndex
            }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 페이지네이션 초기화
     * @param {number} totalItems - 전체 아이템 수
     */
    function resetPagination(totalItems) {
        state.currentPage = 1;
        updatePagination(totalItems);
    }
    
    /**
     * 현재 페이지네이션 상태 가져오기
     * @returns {Object} 페이지네이션 상태
     */
    function getState() {
        return { ...state };
    }
    
    // 공개 API
    return {
        init,
        updatePagination,
        resetPagination,
        changePage,
        getState
    };
})();
