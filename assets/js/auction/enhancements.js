/**
 * 경매장 애플리케이션 추가 최적화 및 개선 사항 - 간소화 버전
 * 
 * 이 파일은 전체 애플리케이션의 성능과 사용자 경험을 향상시키는 필수 기능만 포함합니다.
 * 불필요한 복잡성을 제거하고 핵심 기능만 유지했습니다.
 */

/**
 * 1. 아이템 렌더링 최적화 - 가상 스크롤링 구현
 * 대량의 아이템을 표시할 때 화면에 보이는 부분만 렌더링하여 성능 향상
 */
const VirtualScroller = (() => {
    let state = {
        container: null,
        items: [],
        itemHeight: 60, // 아이템 행 높이 (px)
        visibleItems: 0, // 한 번에 표시할 아이템 수
        totalHeight: 0,  // 전체 컨텐츠 높이
        scrollTop: 0,    // 현재 스크롤 위치
        renderBuffer: 5, // 위/아래 추가 렌더링할 아이템 수
        isActive: false  // 가상 스크롤링 활성화 여부
    };
    
    // 가상 스크롤러 초기화
    function init(container, itemHeight = 60) {
        state.container = container;
        state.itemHeight = itemHeight;
        
        // 컨테이너 크기로 표시 가능한 아이템 수 계산
        calculateVisibleItems();
        
        // 리사이즈 이벤트 리스너
        window.addEventListener('resize', debounce(() => {
            calculateVisibleItems();
            renderVisibleItems();
        }, 200));
        
        // 스크롤 이벤트 리스너
        container.addEventListener('scroll', throttle(() => {
            state.scrollTop = container.scrollTop;
            renderVisibleItems();
        }, 16)); // 약 60fps
    }
    
    // 표시 가능 아이템 수 계산
    function calculateVisibleItems() {
        if (!state.container) return;
        
        const containerHeight = state.container.clientHeight;
        state.visibleItems = Math.ceil(containerHeight / state.itemHeight) + (2 * state.renderBuffer);
    }
    
    // 아이템 설정 및 가상 스크롤링 시작
    function setItems(items) {
        state.items = items || [];
        state.totalHeight = state.items.length * state.itemHeight;
        
        // 아이템이 적으면 가상 스크롤링 비활성화
        state.isActive = state.items.length > 50;
        
        if (state.isActive) {
            setupVirtualScroll();
        } else {
            // 일반 렌더링 사용
            renderAllItems();
        }
    }
    
    // 가상 스크롤링 설정
    function setupVirtualScroll() {
        if (!state.container) return;
        
        // 실제 아이템이 들어갈 컨테이너
        const innerContainer = document.createElement('div');
        innerContainer.className = 'virtual-scroll-content';
        innerContainer.style.position = 'relative';
        innerContainer.style.height = `${state.totalHeight}px`;
        
        // 기존 내용 비우고 새 컨테이너 추가
        state.container.innerHTML = '';
        state.container.appendChild(innerContainer);
        
        // 초기 아이템 렌더링
        renderVisibleItems();
    }
    
    // 보이는 아이템만 렌더링
    function renderVisibleItems() {
        if (!state.isActive || !state.container) return;
        
        const innerContainer = state.container.querySelector('.virtual-scroll-content');
        if (!innerContainer) return;
        
        // 현재 스크롤 위치에 따른 표시 범위 계산
        const startIndex = Math.max(0, Math.floor(state.scrollTop / state.itemHeight) - state.renderBuffer);
        const endIndex = Math.min(
            state.items.length, 
            startIndex + state.visibleItems + state.renderBuffer
        );
        
        // 현재 표시된 아이템에 데이터 속성 추가
        innerContainer.querySelectorAll('.item-row').forEach(item => {
            item.dataset.virtual = 'true';
        });
        
        // 새 아이템 생성 및 배치
        for (let i = startIndex; i < endIndex; i++) {
            const item = state.items[i];
            if (!item) continue;
            
            // 이미 해당 인덱스의 아이템이 있는지 확인
            let itemElement = innerContainer.querySelector(`.item-row[data-index="${i}"]`);
            
            if (!itemElement) {
                // 새 아이템 생성
                itemElement = createItemElement(item, i);
                itemElement.style.position = 'absolute';
                itemElement.style.top = `${i * state.itemHeight}px`;
                itemElement.style.width = '100%';
                itemElement.style.height = `${state.itemHeight}px`;
                
                innerContainer.appendChild(itemElement);
            } else {
                // 이미 있는 아이템 재사용
                itemElement.dataset.virtual = 'false';
            }
        }
        
        // 화면에서 벗어난 아이템 제거 (메모리 최적화)
        innerContainer.querySelectorAll('.item-row[data-virtual="true"]').forEach(item => {
            innerContainer.removeChild(item);
        });
    }
    
    // 모든 아이템 일반 방식으로 렌더링 (가상 스크롤링 비활성화 시)
    function renderAllItems() {
        if (!state.container) return;
        
        // 컨테이너 초기화
        state.container.innerHTML = '';
        
        // 일반 테이블 방식으로 모든 아이템 추가
        const fragment = document.createDocumentFragment();
        
        state.items.forEach((item, index) => {
            const itemElement = createItemElement(item, index);
            fragment.appendChild(itemElement);
        });
        
        state.container.appendChild(fragment);
    }
    
    // 아이템 요소 생성 (테이블 행)
    function createItemElement(item, index) {
        const tr = document.createElement('tr');
        tr.className = 'item-row';
        tr.setAttribute('data-item-id', item.auction_item_no);
        tr.setAttribute('data-index', index);
        tr.setAttribute('data-item', JSON.stringify(item));
        
        tr.innerHTML = `
            <td>
                <div class="item-cell">
                    <div class="item-name">${item.item_name}</div>
                </div>
            </td>
            <td class="item-quantity">${item.item_count || 1}개</td>
            <td class="item-price">${Utils.formatNumber(item.auction_price_per_unit)}G</td>
        `;
        
        return tr;
    }
    
    // 유틸리티 함수: 디바운스
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }
    
    // 유틸리티 함수: 스로틀
    function throttle(func, limit) {
        let lastCall = 0;
        return function() {
            const now = Date.now();
            if (now - lastCall < limit) return;
            lastCall = now;
            func.apply(this, arguments);
        };
    }
    
    // 공개 API
    return {
        init,
        setItems
    };
})();

/**
 * 4. 데이터 공유 및 URL 공유 기능
 * URL 파라미터로 검색/필터 상태 저장하여 공유 가능한 링크 생성
 */
const StateManager = (() => {
    /**
     * 현재 상태를 URL로 인코딩
     * @param {Object} state - 현재 상태 객체
     * @returns {string} 인코딩된 URL
     */
    function encodeStateToUrl(state) {
        // 상태 객체에서 필요한 정보만 추출
        const shareableState = {
            s: state.searchTerm || '',                     // 검색어
            c: state.selectedCategory || '',               // 선택한 카테고리 ID
            mc: state.selectedMainCategory || '',          // 선택한 메인 카테고리 ID
            p: state.currentPage || 1,                     // 현재 페이지
            ps: state.pageSize || 20,                      // 페이지 크기
            f: compressFilters(state.filters || {}),       // 압축된 필터 정보
            sort: state.sortField || '',                   // 정렬 필드
            dir: state.sortDirection || 'asc'              // 정렬 방향
        };
        
        // 빈 값 제거
        Object.keys(shareableState).forEach(key => {
            if (
                shareableState[key] === '' || 
                shareableState[key] === null || 
                shareableState[key] === undefined ||
                (typeof shareableState[key] === 'object' && Object.keys(shareableState[key]).length === 0)
            ) {
                delete shareableState[key];
            }
        });
        
        // URL 쿼리 스트링으로 변환
        const queryString = new URLSearchParams(shareableState).toString();
        
        // 현재 URL 가져오기 (경로만)
        const currentUrl = window.location.pathname;
        
        // 새 URL 반환
        return `${currentUrl}?${queryString}`;
    }
    
    /**
     * URL에서 상태 디코딩
     * @param {string} url - 디코딩할 URL
     * @returns {Object} 디코딩된 상태 객체
     */
    function decodeStateFromUrl(url) {
        const urlObj = new URL(url || window.location.href);
        const params = new URLSearchParams(urlObj.search);
        
        // 상태 객체 구성
        const state = {
            searchTerm: params.get('s') || '',
            selectedCategory: params.get('c') || '',
            selectedMainCategory: params.get('mc') || '',
            currentPage: parseInt(params.get('p')) || 1,
            pageSize: parseInt(params.get('ps')) || 20,
            filters: decompressFilters(params.get('f') || ''),
            sortField: params.get('sort') || '',
            sortDirection: params.get('dir') || 'asc'
        };
        
        return state;
    }
    
    /**
     * 필터 객체 압축
     * @param {Object} filters - 압축할 필터 객체
     * @returns {string} 압축된 필터 문자열
     */
    function compressFilters(filters) {
        if (Object.keys(filters).length === 0) {
            return '';
        }
        
        // 간단한 형태로 직렬화
        const serialized = JSON.stringify(filters);
        
        // Base64 인코딩 (URL 안전 버전)
        return btoa(serialized).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    
    /**
     * 압축된 필터 문자열 복원
     * @param {string} compressed - 압축된 필터 문자열
     * @returns {Object} 복원된 필터 객체
     */
    function decompressFilters(compressed) {
        if (!compressed) {
            return {};
        }
        
        try {
            // Base64 디코딩 (URL 안전 버전 되돌리기)
            const base64 = compressed.replace(/-/g, '+').replace(/_/g, '/');
            
            // 필요 시 패딩 추가
            const padding = '='.repeat((4 - (base64.length % 4)) % 4);
            const padded = base64 + padding;
            
            // 디코딩 및 파싱
            const serialized = atob(padded);
            return JSON.parse(serialized);
        } catch (error) {
            console.error('필터 압축 해제 오류:', error);
            return {};
        }
    }
    
    /**
     * 공유 가능한 URL 생성
     * @returns {string} 공유 URL
     */
    function createShareableUrl() {
        // 현재 애플리케이션 상태 수집
        const appState = {
            searchTerm: SearchManager.getSearchState().searchTerm,
            selectedCategory: CategoryManager.getSelectedCategories().subCategory,
            selectedMainCategory: CategoryManager.getSelectedCategories().mainCategory,
            currentPage: PaginationManager.getState().currentPage,
            pageSize: PaginationManager.getState().itemsPerPage,
            filters: FilterManager.getFilters().advancedFilters
        };
        
        return encodeStateToUrl(appState);
    }
    
    /**
     * URL에서 상태 복원
     * @returns {Object} 복원된 상태
     */
    function restoreFromUrl() {
        return decodeStateFromUrl();
    }
    
    /**
     * 공유 URL 클립보드에 복사
     */
    function copyShareableUrl() {
        const url = createShareableUrl();
        
        try {
            // 새로운 방식 (Clipboard API)
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url)
                    .then(() => {
                        alert('URL이 클립보드에 복사되었습니다.');
                    })
                    .catch(err => {
                        fallbackCopy(url);
                    });
            } else {
                fallbackCopy(url);
            }
        } catch (error) {
            fallbackCopy(url);
        }
    }
    
    /**
     * 대체 복사 메서드 (Clipboard API 미지원 시)
     * @param {string} text - 복사할 텍스트
     */
    function fallbackCopy(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // 화면 밖에 위치시키지만 문서 내에 유지
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                alert('URL이 클립보드에 복사되었습니다.');
            } else {
                alert('URL 복사 실패. 수동으로 URL을 복사하세요: ' + text);
            }
        } catch (err) {
            alert('URL 복사 실패. 수동으로 URL을 복사하세요: ' + text);
        }
        
        document.body.removeChild(textArea);
    }
    
    // 공개 API
    return {
        createShareableUrl,
        restoreFromUrl,
        copyShareableUrl
    };
})();

/**
 * 5. 다크 모드 지원
 * 시스템 설정 및 사용자 선호에 따른 테마 전환
 */
const ThemeManager = (() => {
    const THEMES = {
        LIGHT: 'light',
        DARK: 'dark',
        AUTO: 'auto'
    };
    
    const STORAGE_KEY = 'theme-preference';
    
    let currentTheme = THEMES.AUTO;
    let systemPrefersDark = false;
    
    /**
     * 테마 초기화
     */
    function init() {
        // 저장된 사용자 선호 테마 불러오기
        const savedTheme = localStorage.getItem(STORAGE_KEY);
        if (savedTheme && Object.values(THEMES).includes(savedTheme)) {
            currentTheme = savedTheme;
        }
        
        // 시스템 테마 감지
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        systemPrefersDark = mediaQuery.matches;
        
        // 시스템 테마 변경 감지
        mediaQuery.addEventListener('change', event => {
            systemPrefersDark = event.matches;
            if (currentTheme === THEMES.AUTO) {
                applyTheme();
            }
        });
        
        // 초기 테마 적용
        applyTheme();
        
        // 테마 전환 버튼 추가
        addThemeToggleButton();
        
        console.log(`테마 관리자 초기화: ${currentTheme} (시스템: ${systemPrefersDark ? 'dark' : 'light'})`);
    }
    
    /**
     * 테마 설정 적용
     */
    function applyTheme() {
        // 실제 적용할 테마 결정
        const effectiveTheme = currentTheme === THEMES.AUTO
            ? (systemPrefersDark ? THEMES.DARK : THEMES.LIGHT)
            : currentTheme;
        
        // 문서 루트에 테마 속성 설정
        document.documentElement.setAttribute('data-theme', effectiveTheme);
        
        // HTML 클래스 업데이트
        document.documentElement.classList.remove(THEMES.LIGHT, THEMES.DARK);
        document.documentElement.classList.add(effectiveTheme);
        
        // 메타 테마 색상 업데이트 (모바일 브라우저용)
        updateMetaThemeColor(effectiveTheme);
        
        // 테마 전환 버튼 업데이트
        updateThemeToggleButton(effectiveTheme);
    }
    
    /**
     * 메타 테마 색상 업데이트
     * @param {string} theme - 적용할 테마
     */
    function updateMetaThemeColor(theme) {
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        
        // 메타 태그가 없으면 새로 생성
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }
        
        // 테마에 맞는 색상 설정
        const color = theme === THEMES.DARK ? '#121212' : '#ffffff';
        metaThemeColor.content = color;
    }
    
    /**
     * 테마 변경
     * @param {string} theme - 적용할 테마
     */
    function setTheme(theme) {
        if (!Object.values(THEMES).includes(theme)) {
            console.error(`잘못된 테마: ${theme}`);
            return;
        }
        
        currentTheme = theme;
        
        // 테마 저장
        localStorage.setItem(STORAGE_KEY, theme);
        
        // 테마 적용
        applyTheme();
    }
    
    /**
     * 테마 간 순환
     */
    function cycleTheme() {
        const themeOrder = [THEMES.LIGHT, THEMES.DARK, THEMES.AUTO];
        const currentIndex = themeOrder.indexOf(currentTheme);
        const nextIndex = (currentIndex + 1) % themeOrder.length;
        setTheme(themeOrder[nextIndex]);
    }
    
    /**
     * 테마 전환 버튼 추가
     */
    function addThemeToggleButton() {
        // 이미 있는지 확인
        if (document.getElementById('theme-toggle')) {
            return;
        }
        
        // 버튼 컨테이너 생성
        const container = document.createElement('div');
        container.className = 'theme-toggle-container';
        
        // 버튼 생성
        const button = document.createElement('button');
        button.id = 'theme-toggle';
        button.className = 'theme-toggle-button';
        button.setAttribute('aria-label', '테마 변경');
        button.innerHTML = `
            <svg class="theme-icon theme-icon-light" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg class="theme-icon theme-icon-dark" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
            <svg class="theme-icon theme-icon-auto" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"></path>
            </svg>
        `;
        
        // 클릭 이벤트
        button.addEventListener('click', cycleTheme);
        
        // DOM에 추가
        container.appendChild(button);
        document.body.appendChild(container);
    }
    
    /**
     * 테마 전환 버튼 업데이트
     * @param {string} activeTheme - 활성화된 테마
     */
    function updateThemeToggleButton(activeTheme) {
        const button = document.getElementById('theme-toggle');
        if (!button) return;
        
        // 모든 아이콘 숨기기
        button.querySelectorAll('.theme-icon').forEach(icon => {
            icon.style.display = 'none';
        });
        
        // 현재 테마에 맞는 아이콘 표시
        const activeIcon = button.querySelector(`.theme-icon-${currentTheme}`);
        if (activeIcon) {
            activeIcon.style.display = 'block';
        }
        
        // 버튼 제목 업데이트
        let title = '테마 변경';
        if (currentTheme === THEMES.LIGHT) {
            title = '라이트 모드 (클릭하여 변경)';
        } else if (currentTheme === THEMES.DARK) {
            title = '다크 모드 (클릭하여 변경)';
        } else if (currentTheme === THEMES.AUTO) {
            title = '시스템 테마 (클릭하여 변경)';
        }
        
        button.setAttribute('title', title);
    }
    
    // 공개 API
    return {
        init,
        setTheme,
        cycleTheme,
        THEMES
    };
})();
