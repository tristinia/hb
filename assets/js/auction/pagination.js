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
        visiblePageCount: 5, // 한 번에 표시할 페이지 버튼 수
        pageJumpSize: 10,    // 건너뛰기 크기
        isRendering: false,   // 렌더링 상태 플래그
        sessionKey: 'paginationState' // 세션 저장 키
    };
    
    // DOM 요소 참조
    let elements = {
        paginationContainer: null,
        paginationInfo: null  // 페이지 정보 표시 요소
    };
    
    /**
     * 모듈 초기화
     */
    function init() {
        // DOM 요소 참조 가져오기
        elements.paginationContainer = document.getElementById('pagination');
        
        // 페이지 정보 컨테이너 생성 (없는 경우)
        if (!document.getElementById('pagination-info')) {
            const paginationInfo = document.createElement('div');
            paginationInfo.id = 'pagination-info';
            paginationInfo.className = 'pagination-info';
            if (elements.paginationContainer && elements.paginationContainer.parentNode) {
                elements.paginationContainer.parentNode.insertBefore(paginationInfo, elements.paginationContainer);
            }
            elements.paginationInfo = paginationInfo;
        } else {
            elements.paginationInfo = document.getElementById('pagination-info');
        }
        
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
        
        // 페이지 정보 업데이트
        updatePageInfo();
        
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
     * 페이지 정보 텍스트 업데이트
     */
    function updatePageInfo() {
        if (!elements.paginationInfo) return;
        
        // 현재 아이템 범위 계산
        const startItem = state.totalItems > 0 ? (state.currentPage - 1) * state.itemsPerPage + 1 : 0;
        const endItem = Math.min(startItem + state.itemsPerPage - 1, state.totalItems);
        
        // 페이지 위치 정보 표시
        const pageInfoText = state.totalItems > 0 
            ? `${startItem}-${endItem} / 총 ${state.totalItems}개 항목`
            : `0 / 총 0개 항목`;
            
        // 페이지 정보 컨테이너 내용 업데이트 (중복 생성 방지)
        const pageInfoElement = elements.paginationInfo.querySelector('.page-info') 
            || document.createElement('div');
            
        if (!pageInfoElement.classList.contains('page-info')) {
            pageInfoElement.className = 'page-info';
            elements.paginationInfo.insertBefore(pageInfoElement, elements.paginationInfo.firstChild);
        }
        
        pageInfoElement.textContent = pageInfoText;
    }
    
    /**
     * 페이지네이션 UI 렌더링 (최적화)
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
        
        // 처음 페이지 버튼 (현재 페이지가 2 이상인 경우만)
        if (state.currentPage > 1) {
            appendPageButton(ul, 1, '처음', '&laquo;');
        }
        
        // 이전 페이지 버튼
        if (state.currentPage > 1) {
            appendPageButton(ul, state.currentPage - 1, '이전 페이지', '&lsaquo;');
        }
        
        // 페이지 번호 버튼 - 현재 페이지 주변 표시
        const halfVisibleCount = Math.floor(state.visiblePageCount / 2);
        let startPage = Math.max(1, state.currentPage - halfVisibleCount);
        let endPage = Math.min(state.totalPages, startPage + state.visiblePageCount - 1);
        
        // 표시 페이지 범위 조정 (끝 페이지가 적은 경우)
        if (endPage - startPage + 1 < state.visiblePageCount) {
            startPage = Math.max(1, endPage - state.visiblePageCount + 1);
        }
        
        // 첫 페이지와 건너뛰기 표시 (필요한 경우)
        if (startPage > 1) {
            appendPageNumberButtons(ul, 1, Math.min(1, startPage - 1));
            
            if (startPage > 2) {
                appendEllipsis(ul);
            }
        }
        
        // 현재 페이지 주변 번호 표시
        appendPageNumberButtons(ul, startPage, endPage);
        
        // 마지막 페이지와 건너뛰기 표시 (필요한 경우)
        if (endPage < state.totalPages) {
            if (endPage < state.totalPages - 1) {
                appendEllipsis(ul);
            }
            
            appendPageNumberButtons(ul, Math.max(endPage + 1, state.totalPages), state.totalPages);
        }
        
        // 다음 페이지 버튼
        if (state.currentPage < state.totalPages) {
            appendPageButton(ul, state.currentPage + 1, '다음 페이지', '&rsaquo;');
        }
        
        // 마지막 페이지 버튼 (현재 페이지가 마지막 페이지가 아닌 경우만)
        if (state.currentPage < state.totalPages) {
            appendPageButton(ul, state.totalPages, '마지막', '&raquo;');
        }
        
        // 전체 결과를 DOM에 한 번에 추가
        fragment.appendChild(ul);
        elements.paginationContainer.innerHTML = '';
        elements.paginationContainer.appendChild(fragment);
        
        // 렌더링 상태 해제
        state.isRendering = false;
    }
    
    /**
     * 페이지 번호 버튼 추가 (특정 범위)
     * @param {HTMLElement} container - 버튼 컨테이너
     * @param {number} start - 시작 페이지
     * @param {number} end - 종료 페이지
     */
    function appendPageNumberButtons(container, start, end) {
        for (let i = start; i <= end; i++) {
            const li = document.createElement('li');
            li.className = 'pagination-item';
            
            const button = document.createElement('button');
            button.className = `pagination-link ${i === state.currentPage ? 'active' : ''}`;
            button.setAttribute('data-page', i);
            button.setAttribute('aria-label', `${i} 페이지`);
            button.textContent = i;
            
            // 클릭 이벤트 (이벤트 위임 사용)
            if (i !== state.currentPage) {
                button.addEventListener('click', () => handlePageClick(i));
            }
            
            li.appendChild(button);
            container.appendChild(li);
        }
    }
    
    /**
     * 특수 페이지 버튼 추가 (처음, 이전, 다음, 마지막)
     * @param {HTMLElement} container - 버튼 컨테이너
     * @param {number} page - 연결될 페이지 번호
     * @param {string} label - 접근성 레이블
     * @param {string} html - 버튼 내용 HTML
     */
    function appendPageButton(container, page, label, html) {
        const li = document.createElement('li');
        li.className = 'pagination-item';
        
        const button = document.createElement('button');
        button.className = 'pagination-link';
        button.setAttribute('data-page', page);
        button.setAttribute('aria-label', label);
        button.innerHTML = html;
        
        // 클릭 이벤트
        button.addEventListener('click', () => handlePageClick(page));
        
        li.appendChild(button);
        container.appendChild(li);
    }
    
    /**
     * 생략 표시 추가 (...)
     * @param {HTMLElement} container - 버튼 컨테이너
     */
    function appendEllipsis(container) {
        const li = document.createElement('li');
        li.className = 'pagination-item pagination-ellipsis';
        li.textContent = '...';
        container.appendChild(li);
    }
    
    /**
     * 페이지 클릭 이벤트 처리
     * @param {number} page - 클릭한 페이지 번호
     */
    function handlePageClick(page) {
        // 현재 페이지와 같으면 무시
        if (page === state.currentPage) return;
        
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
        updatePageInfo();
        
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
