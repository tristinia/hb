/**
 * 페이지네이션 관리 모듈
 * 페이지 분할 및 네비게이션 처리
 */

const PaginationManager = (() => {
    // 페이지네이션 상태
    const state = {
        currentPage: 1,
        itemsPerPage: 10, // 항상 10개로 고정
        totalItems: 0,
        totalPages: 1,
        pageJumpSize: 10,    // 건너뛰기 크기
        isRendering: false,   // 렌더링 상태 플래그
        sessionKey: 'paginationState' // 세션 저장 키
    };
    
    // DOM 요소 참조
    let elements = {
        paginationContainer: null,
    };
    
    /**
     * 모듈 초기화
     */
    function init() {
        // DOM 요소 참조 가져오기
        elements.paginationContainer = document.getElementById('pagination');
        
        // 스크롤 복원 이벤트 리스너
        document.addEventListener('pageChanged', (e) => {
            restoreScrollPosition();
        });
        
        // URL 해시 변경 감지
        window.addEventListener('hashchange', handleHashChange);
        
        // 세션 저장 페이지 상태 복원
        restorePageState();
        
        // URL 해시에서 페이지 추출
        handleHashChange();
        
        console.log('PaginationManager 초기화 완료');
    }
    
    /**
     * URL 해시 변경 처리
     */
    function handleHashChange() {
        // URL에서 페이지 파라미터 추출
        const hash = window.location.hash;
        const match = hash.match(/page=(\d+)/);
        
        if (match && match[1]) {
            const pageFromHash = parseInt(match[1], 10);
            
            // 유효한 페이지 번호인 경우 페이지 변경
            if (!isNaN(pageFromHash) && pageFromHash > 0 && pageFromHash <= state.totalPages) {
                // 현재 페이지와 다른 경우에만 변경
                if (pageFromHash !== state.currentPage) {
                    changePage(pageFromHash, false);
                }
            }
        }
    }
    
    /**
     * URL 해시 업데이트
     */
    function updateUrlHash() {
        // 현재 URL 해시 분석
        const hash = window.location.hash;
        
        // page 파라미터 패턴
        const pagePattern = /page=\d+/;
        
        // 새 해시 생성
        let newHash;
        
        if (hash && hash.length > 1) {
            if (pagePattern.test(hash)) {
                // 기존 page 파라미터 교체
                newHash = hash.replace(pagePattern, `page=${state.currentPage}`);
            } else {
                // page 파라미터 추가
                newHash = `${hash}&page=${state.currentPage}`;
            }
        } else {
            // 새 해시 생성
            newHash = `#page=${state.currentPage}`;
        }
        
        // URL 히스토리 변경 (pushState 대신 replaceState 사용)
        try {
            window.history.replaceState(null, '', newHash);
        } catch (error) {
            console.warn('URL 해시 업데이트 실패:', error);
        }
    }
    
    /**
     * 페이지 상태 저장 (세션 스토리지)
     */
    function savePageState() {
        try {
            const pageState = {
                currentPage: state.currentPage,
                scrollPosition: window.scrollY
            };
            sessionStorage.setItem(state.sessionKey, JSON.stringify(pageState));
        } catch (error) {
            console.warn('페이지 상태 저장 실패:', error);
        }
    }
    
    /**
     * 페이지 상태 복원 (세션 스토리지)
     */
    function restorePageState() {
        try {
            const savedState = sessionStorage.getItem(state.sessionKey);
            if (savedState) {
                const parsedState = JSON.parse(savedState);
                
                // 현재 페이지 복원 (유효한 경우에만)
                if (parsedState.currentPage && parsedState.currentPage > 0) {
                    state.currentPage = parsedState.currentPage;
                }
                
                console.log('페이지 상태 복원 완료');
            }
        } catch (error) {
            console.warn('페이지 상태 복원 실패:', error);
        }
    }
    
    /**
     * 스크롤 위치 복원
     */
    function restoreScrollPosition() {
        try {
            const savedState = sessionStorage.getItem(state.sessionKey);
            if (savedState) {
                const parsedState = JSON.parse(savedState);
                
                // 스크롤 위치 복원 (약간의 지연으로 렌더링 이후 적용)
                if (parsedState.scrollPosition) {
                    setTimeout(() => {
                        window.scrollTo({
                            top: parsedState.scrollPosition,
                            behavior: 'auto' // smooth로 하면 사용자 경험 저하
                        });
                    }, 100);
                }
            }
        } catch (error) {
            console.warn('스크롤 위치 복원 실패:', error);
        }
    }
    
    /**
     * 페이지네이션 업데이트
     * @param {number} totalItems - 전체 아이템 수
     */
    function updatePagination(totalItems) {
        // 성능 측정 시작
        const startTime = performance.now();
        
        // 새로운 총 아이템 수 저장
        state.totalItems = totalItems;
        
        // 페이지 수 계산
        const oldTotalPages = state.totalPages;
        state.totalPages = Math.max(1, Math.ceil(totalItems / state.itemsPerPage));
        
        // 현재 페이지가 전체 페이지 수를 초과하면 조정
        if (state.currentPage > state.totalPages) {
            state.currentPage = Math.max(1, state.totalPages);
        }
        
        // 페이지 변경 또는 총 페이지 수 변경 시에만 페이지네이션 렌더링
        if (oldTotalPages !== state.totalPages) {
            renderPagination();
        }
        
        // 현재 페이지에 표시될 아이템 업데이트
        updatePageDisplay();
        
        // 페이지 상태 저장
        savePageState();
        
        // URL 해시 업데이트 (페이지 번호 추가)
        updateUrlHash();
        
        // 성능 측정 종료
        const endTime = performance.now();
        console.log(`페이지네이션 업데이트 완료: ${totalItems}개 항목, ${Math.ceil(endTime - startTime)}ms`);
    }
    
    /**
     * 페이지네이션 UI 렌더링
     */
    function renderPagination() {
        if (!elements.paginationContainer) return;
        
        // 중복 렌더링 방지
        if (state.isRendering) return;
        state.isRendering = true;
        
        // 표시할 아이템이 없거나 한 페이지면 페이지네이션 숨기기
        if (state.totalItems <= state.itemsPerPage || state.totalPages <= 1) {
            elements.paginationContainer.innerHTML = '';
            state.isRendering = false;
            return;
        }
        
        // DocumentFragment 사용하여 DOM 조작 최소화
        const fragment = document.createDocumentFragment();
        const ul = document.createElement('ul');
        ul.className = 'pagination-list';
        
        // 첫 페이지 이동 버튼 (|<)
        const firstPageButton = createPageButton('first-page', '첫 페이지', '|<', 1);
        
        // 10페이지 뒤로 이동 버튼 (<<)
        const prevTenButton = createPageButton('prev-ten', '10페이지 뒤로', '<<', Math.max(1, state.currentPage - state.pageJumpSize));
        
        // 이전 페이지 버튼 (<)
        const prevButton = createPageButton('prev-page', '이전 페이지', '<', state.currentPage - 1);
        
        // 현재 페이지 / 전체 페이지 ([ 1 / 15 ])
        const currentPageItem = document.createElement('li');
        currentPageItem.className = 'pagination-item pagination-current';
        
        const currentPageSpan = document.createElement('span');
        currentPageSpan.className = 'pagination-current-page';
        currentPageSpan.setAttribute('aria-label', `현재 페이지 ${state.currentPage} / 전체 ${state.totalPages}`);
        currentPageSpan.textContent = `[ ${state.currentPage} / ${state.totalPages} ]`;
        
        currentPageItem.appendChild(currentPageSpan);
        
        // 다음 페이지 버튼 (>)
        const nextButton = createPageButton('next-page', '다음 페이지', '>', state.currentPage + 1);
        
        // 10페이지 앞으로 이동 버튼 (>>)
        const nextTenButton = createPageButton('next-ten', '10페이지 앞으로', '>>', Math.min(state.totalPages, state.currentPage + state.pageJumpSize));
        
        // 마지막 페이지 이동 버튼 (>|)
        const lastPageButton = createPageButton('last-page', '마지막 페이지', '>|', state.totalPages);
        
        // 버튼 비활성화 처리
        if (state.currentPage === 1) {
            // 첫 페이지인 경우 이전 버튼들 비활성화
            disableButton(firstPageButton);
            disableButton(prevTenButton);
            disableButton(prevButton);
        }
        
        if (state.currentPage === state.totalPages) {
            // 마지막 페이지인 경우 다음 버튼들 비활성화
            disableButton(nextButton);
            disableButton(nextTenButton);
            disableButton(lastPageButton);
        }
        
        // 모든 버튼을 순서대로 추가
        ul.appendChild(firstPageButton);  // |<
        ul.appendChild(prevTenButton);    // <<
        ul.appendChild(prevButton);       // <
        ul.appendChild(currentPageItem);  // [ 1 / 15 ]
        ul.appendChild(nextButton);       // >
        ul.appendChild(nextTenButton);    // >>
        ul.appendChild(lastPageButton);   // >|
        
        // 전체 결과를 DOM에 한 번에 추가
        fragment.appendChild(ul);
        elements.paginationContainer.innerHTML = '';
        elements.paginationContainer.appendChild(fragment);
        
        // 렌더링 상태 해제
        state.isRendering = false;
    }
    
    /**
     * 페이지 버튼 생성 헬퍼 함수
     * @param {string} className - 버튼 클래스 이름
     * @param {string} ariaLabel - 접근성 레이블
     * @param {string} text - 버튼 텍스트
     * @param {number} page - 연결될 페이지 번호
     * @returns {HTMLElement} 생성된 버튼 요소
     */
    function createPageButton(className, ariaLabel, text, page) {
        const li = document.createElement('li');
        li.className = 'pagination-item';
        
        const button = document.createElement('button');
        button.className = `pagination-link ${className}`;
        button.setAttribute('data-page', page);
        button.setAttribute('aria-label', ariaLabel);
        button.textContent = text;
        
        // 현재 페이지와 같지 않은 경우에만 클릭 이벤트 추가
        if (page !== state.currentPage) {
            button.addEventListener('click', () => handlePageClick(page));
        }
        
        li.appendChild(button);
        return li;
    }
    
    /**
     * 버튼 비활성화 함수
     * @param {HTMLElement} buttonItem - 버튼 요소
     */
    function disableButton(buttonItem) {
        const button = buttonItem.querySelector('button');
        if (button) {
            button.disabled = true;
            button.classList.add('disabled');
            // 이벤트 리스너 제거
            button.removeEventListener('click', handlePageClick);
        }
        buttonItem.classList.add('disabled');
    }
    
    /**
     * 페이지 클릭 이벤트 처리
     * @param {number} page - 클릭한 페이지 번호
     */
    function handlePageClick(page) {
        // 현재 페이지와 같으면 무시
        if (page === state.currentPage) return;
        
        // 유효한 페이지 범위 확인
        if (page < 1 || page > state.totalPages) return;
        
        // 스크롤 위치 저장
        saveScrollPosition();
        
        // 페이지 변경
        changePage(page);
    }
    
    /**
     * 현재 스크롤 위치 저장
     */
    function saveScrollPosition() {
        try {
            // 현재 세션 상태 가져오기
            let pageState = {};
            const savedState = sessionStorage.getItem(state.sessionKey);
            
            if (savedState) {
                pageState = JSON.parse(savedState);
            }
            
            // 스크롤 위치 업데이트
            pageState.scrollPosition = window.scrollY;
            
            // 저장
            sessionStorage.setItem(state.sessionKey, JSON.stringify(pageState));
        } catch (error) {
            console.warn('스크롤 위치 저장 실패:', error);
        }
    }
    
    /**
     * 페이지 변경
     * @param {number} page - 새 페이지 번호
     * @param {boolean} updateHash - URL 해시 업데이트 여부
     */
    function changePage(page, updateHash = true) {
        // 유효한 페이지 범위 확인
        if (page < 1 || page > state.totalPages) {
            return;
        }
        
        // 성능 측정 시작
        const startTime = performance.now();
        
        // 현재 페이지 업데이트
        state.currentPage = page;
        
        // UI 업데이트
        renderPagination();
        updatePageDisplay();
        
        // 페이지 상태 저장
        savePageState();
        
        // URL 해시 업데이트 (요청된 경우만)
        if (updateHash) {
            updateUrlHash();
        }
        
        // 성능 측정 종료
        const endTime = performance.now();
        console.log(`페이지 변경 완료: ${page} 페이지, ${Math.ceil(endTime - startTime)}ms`);
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
                endIndex,
                itemsPerPage: state.itemsPerPage
            }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 페이지네이션 초기화
     * @param {number} totalItems - 전체 아이템 수
     */
    function resetPagination(totalItems) {
        // 페이지 1로 재설정
        state.currentPage = 1;
        
        // 페이지네이션 업데이트
        updatePagination(totalItems);
    }
    
    /**
     * 현재 페이지네이션 상태 가져오기
     * @returns {Object} 페이지네이션 상태
     */
    function getState() {
        return { 
            currentPage: state.currentPage,
            itemsPerPage: state.itemsPerPage,
            totalItems: state.totalItems,
            totalPages: state.totalPages
        };
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

export default PaginationManager;
