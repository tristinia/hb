/**
 * router.js
 * SPA 형태의 라우팅 처리 모듈
 */

const Router = (() => {
    // 라우터 상태
    const state = {
        currentRoute: '',
        routes: {
            'search/auction': {
                title: '경매장 검색',
                content: 'auction-page'
            },
            'search/pouch': {
                title: '주머니 검색',
                content: 'placeholder-page'
            },
            'calculate/auction-fee': {
                title: '경매장 수수료 계산',
                content: 'placeholder-page'
            },
            'calculate/training-stone': {
                title: '일반 훈련석 계산',
                content: 'placeholder-page'
            },
            'fashion/spirit-transform': {
                title: '정령형변',
                content: 'placeholder-page'
            },
            'fashion/effect-card': {
                title: '이펙트카드',
                content: 'placeholder-page'
            },
            'fashion/title': {
                title: '타이틀',
                content: 'placeholder-page'
            }
        }
    };
    
    /**
     * 라우터 초기화
     */
    function init() {
        // URL에서 현재 경로 파악
        parseUrl();
        
        // 초기 페이지 로드
        navigateTo(state.currentRoute || 'search/auction');
        
        // 브라우저 뒤로가기/앞으로가기 처리
        window.addEventListener('popstate', (e) => {
            parseUrl();
            updateUI();
        });
        
        // 메뉴 클릭 이벤트 리스너
        setupMenuListeners();
        
        console.log('라우터 초기화 완료');
    }
    
    /**
     * 메뉴 이벤트 리스너 설정
     */
    function setupMenuListeners() {
        // 메인 메뉴 토글
        const mainMenuButtons = document.querySelectorAll('.main-menu-button');
        mainMenuButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const menuName = button.getAttribute('data-menu');
                toggleSubmenu(menuName);
            });
        });
        
        // 서브메뉴 클릭 처리
        const submenuButtons = document.querySelectorAll('.submenu-button');
        submenuButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const route = button.getAttribute('data-route');
                if (route) {
                    navigateTo(route);
                }
            });
        });
    }
    
    /**
     * 서브메뉴 토글
     */
    function toggleSubmenu(menuName) {
        // 버튼 요소 가져오기
        const button = document.querySelector(`.main-menu-button[data-menu="${menuName}"]`);
        if (!button) return;
        
        // 현재 확장 상태 확인
        const isExpanded = button.classList.contains('expanded');
        
        // 모든 서브메뉴 초기화
        document.querySelectorAll('.main-menu-button').forEach(btn => {
            btn.classList.remove('expanded');
        });
        
        document.querySelectorAll('.submenu-list').forEach(submenu => {
            submenu.classList.remove('expanded');
        });
        
        // 토글: 이미 확장된 메뉴를 클릭한 경우 닫기만 함
        if (!isExpanded) {
            // 선택한 메뉴 확장
            button.classList.add('expanded');
            
            // 해당 서브메뉴 표시
            const submenu = document.getElementById(`${menuName}-submenu`);
            if (submenu) {
                submenu.classList.add('expanded');
            }
        }
    }
    
    /**
     * URL에서 경로 파싱
     */
    function parseUrl() {
        // URL에서 해시 또는 쿼리 파라미터 검사
        const hash = window.location.hash.substring(1);
        const urlParams = new URLSearchParams(window.location.search);
        const routeParam = urlParams.get('route');
        
        // 해시 또는 쿼리 파라미터에서 경로 추출
        if (hash) {
            state.currentRoute = hash;
        } else if (routeParam) {
            state.currentRoute = routeParam;
        } else {
            state.currentRoute = 'search/auction'; // 기본 경로
        }
    }
    
    /**
     * 새 경로로 이동
     */
    function navigateTo(route) {
        if (!route || !state.routes[route]) {
            route = 'search/auction'; // 유효하지 않은 경로는 기본 경로로
        }
        
        // 현재 경로 업데이트
        state.currentRoute = route;
        
        // URL 업데이트 (해시 사용)
        window.history.pushState(null, '', `#${route}`);
        
        // UI 업데이트
        updateUI();
        
        // 서브메뉴 자동 확장 처리
        if (route) {
            const mainMenu = route.split('/')[0]; // 'search', 'calculate', 'fashion'
            expandMainMenu(mainMenu);
        }
        
        // 라우트 변경 이벤트 발생
        const event = new CustomEvent('routeChanged', {
            detail: {
                route: route,
                routeInfo: state.routes[route]
            }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 메인 메뉴 자동 확장
     */
    function expandMainMenu(mainMenu) {
        // 해당 메인 메뉴 펼치기
        toggleSubmenu(mainMenu);
    }
    
    /**
     * UI 요소 업데이트
     */
    function updateUI() {
        // 모든 페이지 숨기기
        document.querySelectorAll('.page-section').forEach(page => {
            page.classList.remove('active');
        });
        
        // 모든 서브메뉴 버튼 비활성화
        document.querySelectorAll('.submenu-button').forEach(button => {
            button.classList.remove('active');
        });
        
        // 현재 경로에 해당하는 페이지 표시
        const routeInfo = state.routes[state.currentRoute];
        if (routeInfo) {
            const contentId = routeInfo.content;
            const pageElement = document.getElementById(contentId);
            if (pageElement) {
                pageElement.classList.add('active');
            }
            
            // 페이지 제목 업데이트
            document.title = `${routeInfo.title} - 마비노기 도구모음`;
            
            // 해당 메뉴 버튼 활성화
            const menuButton = document.querySelector(`.submenu-button[data-route="${state.currentRoute}"]`);
            if (menuButton) {
                menuButton.classList.add('active');
            }
        }
    }
    
    /**
     * 현재 경로 정보 반환
     */
    function getCurrentRoute() {
        return {
            path: state.currentRoute,
            info: state.routes[state.currentRoute]
        };
    }
    
    // 공개 API
    return {
        init,
        navigateTo,
        getCurrentRoute
    };
})();

export default Router;
