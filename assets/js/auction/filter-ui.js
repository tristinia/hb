/**
 * 필터 UI 관리 모듈
 * 필터 UI 렌더링 및 이벤트 처리
 */

import FilterManager from './filter-manager.js';
import optionFilter from './option-filter.js';

class FilterUI {
    constructor() {
        // DOM 요소 참조
        this.filterContainer = null;
        this.filterOptions = null;
        this.filterPanels = null;
        this.mainFilterBtn = null;
        
        // 필터 상태
        this.activeFilters = [];
        this.activePanel = null;
        
        // 클래스 초기화 상태
        this.initialized = false;

        // 드래그 상태 (모바일 전용)
        this.isDragging = false;
        this.startY = 0;
        this.currentY = 0;
        this.initialTranslateY = 0;
        this.snapThreshold = 0.75;

        // 필터 위치
        window.filterUI = this;
    }
    
    /**
     * 모듈 초기화 진행 표시
     */
    init() {
        if (this.initialized) return;
        
        // DOM 요소 참조 가져오기
        this.filterContainer = document.getElementById('filter-container');
        this.filterOptions = document.getElementById('filter-options');
        this.filterPanels = document.getElementById('filter-panels');
        this.mainFilterBtn = document.getElementById('main-filter-btn');
        
        // 요소가 없으면 초기화 실패
        if (!this.filterContainer || !this.filterOptions || !this.filterPanels || !this.mainFilterBtn) {
            console.error('필터 UI 요소를 찾을 수 없습니다.');
            return;
        }
        
        // 모바일 토스트용 오버레이 생성
        this.createFilterOverlay();
        
        // 모바일 스타일 적용을 위한 CSS 추가
        this.addMobileStyles();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 검색 모듈 내 위치 조정
        this.adjustResultsContainerPosition();
        
        // 윈도우 리사이즈 이벤트 처리
        window.addEventListener('resize', () => {
            this.checkFilterRows();
            this.adjustResultsContainerPosition();
        });
        
        // ResizeObserver 설정 부분 수정
        if (window.ResizeObserver) {
            this.containerObserver = new ResizeObserver(() => {
                // 활성화된 패널이 있으면 위치 업데이트
                if (this.activePanel) {
                    const panel = document.getElementById(`filter-panel-${this.activePanel}`);
                    if (panel && panel.classList.contains('active')) {
                        const isMobile = window.innerWidth <= 768;
                        if (!isMobile) {
                            const filterContainerRect = this.filterContainer.getBoundingClientRect();
                            panel.style.top = filterContainerRect.bottom + 'px';
                        }
                    }
                }
                
                // 사이즈 변경 시 너비도 함께 조정
                this.adjustResultsContainerPosition();
            });
            this.containerObserver.observe(this.filterContainer);
        }
        
        // 초기화 완료 후 너비 적용을 위해 한 번 실행
        setTimeout(() => this.adjustResultsContainerPosition(), 0);
        
        // 초기화 완료
        this.initialized = true;
    }
    
    /**
     * 모바일 토스트용 오버레이 생성
     */
    createFilterOverlay() {
        // 기존 오버레이 확인
        let overlay = document.querySelector('.filter-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'filter-overlay';
            document.body.appendChild(overlay);
            
            // 오버레이 클릭 이벤트
            overlay.addEventListener('click', () => {
                this.closeActiveToast();
            });
        }
        
        this.overlay = overlay;
    }
    
    /**
     * 활성화된 토스트 닫기 (모바일 전용)
     */
    closeActiveToast() {
        const activePanel = document.querySelector('.filter-panel.active');
        const activeButton = document.querySelector('.filter-btn.active[data-filter]');
        const activeOptions = document.querySelector('.filter-options.active');
        
        // 패널 닫기
        if (activePanel) {
            this.closeToast(activePanel);
            if (activeButton) {
                activeButton.classList.remove('active');
            }
        }
        
        // 옵션 메뉴 닫기
        if (activeOptions) {
            this.closeToast(activeOptions);
        }
        
        // 오버레이 숨김
        this.overlay.classList.remove('active');
        
        // 바디 오버플로우 복원
        document.body.style.overflow = '';
    }
    
    /**
     * 토스트 닫기 애니메이션 (모바일 전용)
     */
    closeToast(element) {
        element.style.transform = 'translateY(100%)';
        setTimeout(() => {
            element.classList.remove('active');
            element.style.transform = '';
        }, 300);
    }
    
    /**
     * 손잡이 생성 (모바일 전용)
     */
    createHandle() {
        const handle = document.createElement('div');
        handle.className = 'toast-handle';
        handle.innerHTML = '<div class="handle-bar"></div>';
        return handle;
    }
    
    /**
     * 드래그 이벤트 설정 (모바일 전용)
     */
    setupDragEvents(element) {
        const handle = element.querySelector('.toast-handle');
        if (!handle) return;
        
        // 터치 이벤트
        handle.addEventListener('touchstart', (e) => this.handleDragStart(e, element), { passive: false });
        handle.addEventListener('touchmove', (e) => this.handleDragMove(e, element), { passive: false });
        handle.addEventListener('touchend', (e) => this.handleDragEnd(e, element), { passive: false });
        
        // 마우스 이벤트 (데스크톱 테스트용)
        handle.addEventListener('mousedown', (e) => this.handleDragStart(e, element));
        document.addEventListener('mousemove', (e) => this.handleDragMove(e, element));
        document.addEventListener('mouseup', (e) => this.handleDragEnd(e, element));
    }
    
    /**
     * 드래그 시작 (모바일 전용)
     */
    handleDragStart(e, element) {
        if (window.innerWidth > 768) return;
        
        this.isDragging = true;
        this.startY = e.touches ? e.touches[0].clientY : e.clientY;
        this.currentY = this.startY;
        
        // 현재 위치 저장
        const transform = element.style.transform;
        const translateY = transform.match(/translateY\(([^)]+)\)/);
        this.initialTranslateY = translateY ? parseFloat(translateY[1]) : 0;
        
        element.style.transition = 'none';
        e.preventDefault();
    }
    
    /**
     * 드래그 중 (모바일 전용)
     */
    handleDragMove(e, element) {
        if (!this.isDragging || window.innerWidth > 768) return;
        
        this.currentY = e.touches ? e.touches[0].clientY : e.clientY;
        const deltaY = this.currentY - this.startY;
        let newTranslateY = this.initialTranslateY + deltaY;
        
        // 위로 너무 많이 올라가지 않도록 제한
        const maxHeight = window.innerHeight * 0.8;
        newTranslateY = Math.max(-maxHeight, newTranslateY);
        // 아래로 너무 많이 내려가지 않도록 제한
        newTranslateY = Math.min(0, newTranslateY);
        
        element.style.transform = `translateY(${newTranslateY}px)`;
        e.preventDefault();
    }
    
    /**
     * 드래그 종료 (모바일 전용)
     */
    handleDragEnd(e, element) {
        if (!this.isDragging || window.innerWidth > 768) return;
        
        this.isDragging = false;
        element.style.transition = 'transform 0.3s ease-out';
        
        const deltaY = this.currentY - this.startY;
        const snapPosition = -window.innerHeight * this.snapThreshold;
        
        // 스냅 로직
        if (deltaY > 100) {
            // 아래로 많이 드래그했으면 닫기
            this.closeActiveToast();
        } else if (this.initialTranslateY + deltaY < snapPosition + 50) {
            // 위로 많이 드래그했으면 스냅 위치로
            element.style.transform = `translateY(${snapPosition}px)`;
        } else {
            // 기본 위치로 복귀
            element.style.transform = `translateY(${snapPosition}px)`;
        }
    }
    
    /**
     * 모바일 스타일 적용을 위한 CSS 추가
     */
    addMobileStyles() {
        // 기존 스타일 태그 확인
        const styleId = 'filter-mobile-styles';
        let styleTag = document.getElementById(styleId);
        
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = styleId;
            styleTag.textContent = `
                /* 토스트 오버레이 */
                .filter-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.5);
                    z-index: 1999;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.3s ease;
                }
                
                .filter-overlay.active {
                    opacity: 1;
                    visibility: visible;
                }
                
                /* 토스트 손잡이 */
                .toast-handle {
                    padding: 8px 0 12px 0;
                    text-align: center;
                    cursor: grab;
                }
                
                .toast-handle:active {
                    cursor: grabbing;
                }
                
                .handle-bar {
                    width: 40px;
                    height: 4px;
                    background-color: var(--dark-40);
                    border-radius: 2px;
                    margin: 0 auto;
                }
                
                @media (max-width: 768px) {
                    /* 필터 옵션 드롭다운 토스트 스타일 */
                    .filter-options.mobile-toast {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        width: 100%;
                        max-width: 100%;
                        border-radius: 16px 16px 0 0;
                        max-height: 80vh;
                        overflow-y: auto;
                        z-index: 2000;
                        padding: 0;
                        background-color: var(--white);
                        box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.15);
                        transition: transform 0.3s ease-out;
                        transform: translateY(100%);
                    }
                    
                    .filter-options.mobile-toast.active {
                        transform: translateY(-20vh);
                    }
                    
                    .filter-options.mobile-toast .options-content {
                        padding: 0 20px 20px 20px;
                    }
                    
                    .filter-options.mobile-toast .filter-option {
                        padding: 16px 0;
                        border-bottom: 1px solid var(--light-gray);
                        font-size: var(--font-lg);
                        margin-bottom: 0;
                    }
                
                    /* 필터 패널 토스트 스타일 */
                    .filter-panel.mobile-toast {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        width: 100%;
                        max-width: 100%;
                        border-radius: 16px 16px 0 0;
                        max-height: 80vh;
                        overflow-y: auto;
                        z-index: 2000;
                        margin-bottom: 0;
                        padding: 0;
                        background-color: var(--white);
                        box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.15);
                        transition: transform 0.3s ease-out;
                        transform: translateY(100%);
                    }
                    
                    .filter-panel.mobile-toast.active {
                        transform: translateY(-20vh);
                    }
                    
                    .filter-panel.mobile-toast .panel-content {
                        padding: 0 20px 20px 20px;
                    }
                    
                    .filter-panel.mobile-toast .panel-header {
                        padding: 0 20px;
                        margin-bottom: var(--space-md);
                    }
                    
                    .filter-panel.mobile-toast .filter-group {
                        margin-bottom: var(--space-lg);
                    }
                    
                    .filter-panel.mobile-toast .filter-label {
                        display: block;
                        font-size: var(--font-md);
                        font-weight: var(--weight-medium);
                        margin-bottom: var(--space-sm);
                        color: var(--dark);
                    }
                    
                    .filter-panel.mobile-toast .range-filter {
                        display: flex;
                        flex-direction: column;
                        gap: var(--space-sm);
                    }
                    
                    .filter-panel.mobile-toast .range-input,
                    .filter-panel.mobile-toast .dropdown-select {
                        width: 100%;
                        padding: var(--space-md);
                        font-size: var(--font-md);
                        border-radius: var(--radius-md);
                    }
                }
            `;
            document.head.appendChild(styleTag);
        }
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 메인 필터 버튼 클릭 이벤트
        this.mainFilterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFilterOptions();
        });
        
        // 외부 클릭 시 메뉴/패널 닫기 (캡처링 단계에서 처리)
        document.addEventListener('click', (event) => this.handleOutsideClick(event), true);
        
        // 필터 이벤트 리스너
        document.addEventListener('filterChanged', (e) => this.handleFilterChanged(e));
    }
    
    /**
     * 필터 옵션 메뉴 토글 함수
     * 필터 버튼 클릭 시 드롭다운 메뉴를 표시하거나 숨김
     */
    toggleFilterOptions() {
        // 필터 옵션이 열리려고 하면 콘텐츠 로드
        if (!this.filterOptions.classList.contains('active')) {
            this.loadFilterOptions();
        }
        
        // 옵션 토글
        this.filterOptions.classList.toggle('active');
        
        // 모바일 디바이스 확인
        const isMobile = window.innerWidth <= 768;
        
        // 필터 옵션 메뉴 위치 조정
        if (this.filterOptions.classList.contains('active')) {
            if (isMobile) {
                // 모바일에서는 토스트 스타일 적용
                this.filterOptions.classList.add('mobile-toast');
                this.filterOptions.removeAttribute('style');
                
                // 바디에 오버플로우 히든 추가
                document.body.style.overflow = 'hidden';
                
                // 오버레이 활성화
                if (this.overlay) {
                    this.overlay.classList.add('active');
                }
                
                // 드래그 이벤트 설정
                setTimeout(() => {
                    this.setupDragEvents(this.filterOptions);
                }, 100);
            } else {
                // 데스크톱에서는 기존 드롭다운 스타일 유지
                this.filterOptions.classList.remove('mobile-toast');
                
                // 기존 CSS 구조를 유지하면서 위치만 조정
                const buttonRect = this.mainFilterBtn.getBoundingClientRect();
                const filterContainerRect = this.filterContainer.getBoundingClientRect();
                
                this.filterOptions.style.position = 'absolute';
                
                // 필터 컨테이너 내에서의 버튼 위치 계산
                const buttonLeftInContainer = buttonRect.left - filterContainerRect.left;
                
                // 드롭다운 위치 설정 - 버튼 아래에 간격을 두고 배치
                this.filterOptions.style.top = (buttonRect.height + 15) + 'px';
                this.filterOptions.style.left = buttonLeftInContainer + 'px';
                this.filterOptions.style.minWidth = buttonRect.width + 'px';
            }
        } else {
            // 메뉴가 닫힐 때
            this.filterOptions.classList.remove('mobile-toast');
            document.body.style.overflow = '';
            
            // 오버레이 비활성화
            if (this.overlay) {
                this.overlay.classList.remove('active');
            }
        }
        
        // 모든 패널 닫기
        document.querySelectorAll('.filter-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        // 모든 버튼 비활성화
        document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
            if (btn.dataset.filter !== 'main') {
                btn.classList.remove('active');
            }
        });
    }
    
    /**
     * 필터 옵션 로드 함수
     * 현재 카테고리에 맞는 필터 옵션을 동적으로 생성
     */
    async loadFilterOptions() {
        try {
            // 현재 카테고리 가져오기
            const currentCategory = window.ItemDisplay ? 
                window.ItemDisplay.getCurrentCategory() : null;
            
            // 사용 가능한 필터 가져오기
            const availableFilters = await FilterManager.getAvailableFiltersForCategory(currentCategory);
            
            // 필터 옵션 메뉴 초기화
            this.filterOptions.innerHTML = '';
            
            // 모바일 여부 확인
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
                // 모바일에서는 토스트 구조 생성
                
                // 손잡이 추가
                const handle = this.createHandle();
                this.filterOptions.appendChild(handle);
                
                // 옵션 컨테이너 생성
                const optionsContent = document.createElement('div');
                optionsContent.className = 'options-content';
                
                // 필터 옵션 동적 생성
                availableFilters.forEach(filter => {
                    if (filter.visible === false) return; // 숨겨진 필터 제외
                    
                    const option = document.createElement('div');
                    option.className = 'filter-option';
                    option.dataset.filter = filter.name;
                    option.dataset.name = filter.displayName;
                    option.dataset.type = filter.type;
                    
                    option.innerHTML = filter.displayName;
                    
                    // 필터 옵션 클릭 이벤트
                    option.addEventListener('click', () => {
                        this.handleFilterOptionClick(filter);
                    });
                    
                    optionsContent.appendChild(option);
                });
                
                this.filterOptions.appendChild(optionsContent);
            } else {
                // 데스크톱에서는 기존 방식
                availableFilters.forEach(filter => {
                    if (filter.visible === false) return; // 숨겨진 필터 제외
                    
                    const option = document.createElement('div');
                    option.className = 'filter-option';
                    option.dataset.filter = filter.name;
                    option.dataset.name = filter.displayName;
                    option.dataset.type = filter.type;
                    
                    option.innerHTML = filter.displayName;
                    
                    // 필터 옵션 클릭 이벤트
                    option.addEventListener('click', () => {
                        this.handleFilterOptionClick(filter);
                    });
                    
                    this.filterOptions.appendChild(option);
                });
            }
        } catch (error) {
            console.error('필터 옵션 로드 실패:', error);
        }
    }
    
    /**
     * 필터 옵션 클릭 처리
     */
    handleFilterOptionClick(filter) {
        // 필터 옵션 메뉴 닫기
        this.filterOptions.classList.remove('active');
        this.filterOptions.classList.remove('mobile-toast');
        
        // 메뉴가 닫힐 때 바디 오버플로우 복원
        document.body.style.overflow = '';
        
        // 오버레이 비활성화
        if (this.overlay) {
            this.overlay.classList.remove('active');
        }
        
        // 이미 활성화된 필터인지 확인
        const existingBtn = document.querySelector(`.filter-btn[data-filter="${filter.name}"]`);
        if (existingBtn) {
            // 이미 있는 버튼 활성화 및 패널 열기
            this.activateFilterButton(existingBtn, filter.name);
            return;
        }
        
        // 필터 버튼 추가
        this.addFilterButton(filter);
        
        // 필터 패널 추가
        this.addFilterPanel(filter);
        
        // 새로 추가된 버튼 찾기
        const newBtn = document.querySelector(`.filter-btn[data-filter="${filter.name}"]`);
        if (newBtn) {
            // 버튼 활성화 및 패널 열기
            this.activateFilterButton(newBtn, filter.name);
        }
        
        // 버튼 추가로 필터 컨테이너 높이가 변경되었을 수 있으므로 행 검사
        this.checkFilterRows();
        
        // 필터 추가 시 결과 패널 위치 조정
        setTimeout(() => this.adjustResultsContainerPosition(), 0);
    }

    /**
     * 필터 버튼 활성화 함수
     * 버튼 클릭 시 해당 패널을 표시하고 위치를 계산
     * 
     * @param {HTMLElement} button - 활성화할 필터 버튼 요소
     * @param {string} filterId - 필터 ID
     */
    activateFilterButton(button, filterId) {
        // 모든 버튼 비활성화
        document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
            if (btn.dataset.filter !== 'main') {
                btn.classList.remove('active');
            }
        });
        
        // 모든 패널 닫기
        document.querySelectorAll('.filter-panel').forEach(panel => {
            panel.classList.remove('active');
            panel.classList.remove('mobile-toast');
        });
        
        // 선택한 버튼 활성화
        button.classList.add('active');
        
        // 해당 패널 열기
        const panel = document.getElementById(`filter-panel-${filterId}`);
        if (panel) {
            // 패널을 항상 filterPanels 컨테이너 내부에 배치
            if (panel.parentNode !== this.filterPanels) {
                this.filterPanels.appendChild(panel);
            }
            
            // 패널 활성화
            panel.classList.add('active');
            this.activePanel = filterId;
            
            // 모바일 디바이스 확인
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
                // 모바일에서는 토스트 스타일 적용
                panel.classList.add('mobile-toast');
                panel.removeAttribute('style');
                
                // 바디에 오버플로우 히든 추가
                document.body.style.overflow = 'hidden';
                
                // 오버레이 활성화
                if (this.overlay) {
                    this.overlay.classList.add('active');
                }
                
                // 모바일에서는 패널을 body에 직접 추가하여 최상위 레이어로 만듦
                if (panel.parentNode !== document.body) {
                    document.body.appendChild(panel);
                }
                
                // 드래그 이벤트 설정
                setTimeout(() => {
                    this.setupDragEvents(panel);
                }, 100);
            } else {
                // 데스크톱에서는 기존 스타일 유지
                panel.classList.remove('mobile-toast');
                
                // 데스크톱에서는 필터 컨테이너 전체 높이를 기준으로 패널 위치 계산
                const filterContainerRect = this.filterContainer.getBoundingClientRect();
                
                // 패널 위치 설정 - 필터 컨테이너 아래에 배치
                panel.style.position = 'absolute';
                panel.style.top = filterContainerRect.bottom + 'px'; // 컨테이너 하단 기준
                panel.style.left = '0';
                panel.style.right = '0';
                panel.style.margin = '0 auto';
                panel.style.zIndex = '90';
                
                // 데스크톱에서는 패널을 필터 패널 컨테이너에 배치
                if (panel.parentNode !== this.filterPanels) {
                    this.filterPanels.appendChild(panel);
                }
            }
        }
    }
    
    /**
     * 필터 삭제
     */
    removeFilter(filterId) {
        // 모바일 여부 확인
        const isMobile = window.innerWidth <= 768;
        
        // 패널 찾기
        const panel = document.getElementById(`filter-panel-${filterId}`);
        
        // 패널이 활성화되어 있으면 바디 오버플로우 복원
        if (panel && panel.classList.contains('active')) {
            document.body.style.overflow = '';
        }
        
        // 모바일에서 바디에 직접 추가된 패널은 다시 filterPanels로 돌려놓기
        if (isMobile && panel && panel.parentNode === document.body) {
            this.filterPanels.appendChild(panel);
        }
        
        // 버튼 제거
        const filterBtn = document.querySelector(`.filter-btn[data-filter="${filterId}"]`);
        if (filterBtn) {
            filterBtn.remove();
        }
        
        // 패널 닫기
        if (panel) {
            panel.classList.remove('active');
            panel.classList.remove('mobile-toast');
        }
        
        // 필터 삭제
        FilterManager.removeFilterOption(filterId);
        
        // 필터 버튼 삭제로 인한 행 수 변경 확인
        this.checkFilterRows();
        
        // 필터 제거 시 결과 패널 위치 조정
        setTimeout(() => this.adjustResultsContainerPosition(), 0);
    }
    
    /**
     * 필터 컨테이너가 다층으로 표시되는지 확인
     */
    checkFilterRows() {
        if (!this.filterContainer) return false;
        
        const filterButtons = this.filterContainer.querySelectorAll('.filter-btn');
        if (filterButtons.length <= 1) {
            this.filterContainer.classList.remove('multirow');
            return false;
        }
        
        // 첫 번째 버튼의 위치를 기준으로 다른 버튼이 다른 행에 있는지 확인
        const firstButtonTop = filterButtons[0].getBoundingClientRect().top;
        let isMultipleRows = false;
        
        for (let i = 1; i < filterButtons.length; i++) {
            if (filterButtons[i].getBoundingClientRect().top > firstButtonTop + 5) {
                isMultipleRows = true;
                break;
            }
        }
        
        // 클래스 토글
        this.filterContainer.classList.toggle('multirow', isMultipleRows);
        
        return isMultipleRows;
    }
    
    /**
     * 필터 버튼 추가
     */
    addFilterButton(filter) {
        // 이미 존재하는지 확인
        if (document.querySelector(`.filter-btn[data-filter="${filter.name}"]`)) {
            return;
        }
        
        // 새 버튼 생성
        const newButton = document.createElement('button');
        newButton.className = 'filter-btn';
        newButton.dataset.filter = filter.name;
        newButton.dataset.type = filter.type;
        newButton.innerHTML = `
            ${filter.displayName}
            <span class="filter-remove" data-filter="${filter.name}" title="필터 삭제">×</span>
        `;
        
        // 클릭 이벤트 추가
        newButton.addEventListener('click', (event) => {
            // 삭제 버튼 클릭 시 이벤트 버블링 방지
            if (event.target.classList.contains('filter-remove')) {
                return;
            }
            
            // 버튼 활성화 및 패널 열기
            this.activateFilterButton(newButton, filter.name);
        });
        
        // 필터 컨테이너에 버튼 추가
        this.filterContainer.appendChild(newButton);
        
        // 삭제 버튼 이벤트 추가
        const removeBtn = newButton.querySelector('.filter-remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', (event) => {
                event.stopPropagation(); // 버블링 방지
                this.removeFilter(filter.name);
            });
        }
        
        // 필터 버튼 추가로 인한 행 수 변경 확인
        this.checkFilterRows();
    }
    
    /**
     * 필터 패널 추가
     */
    addFilterPanel(filter) {
        // 이미 존재하는지 확인
        const existingPanel = document.getElementById(`filter-panel-${filter.name}`);
        if (existingPanel) {
            return existingPanel;
        }
        
        // 모바일 여부 확인
        const isMobile = window.innerWidth <= 768;
        
        // 새 패널 생성
        const panel = document.createElement('div');
        panel.className = 'filter-panel';
        panel.id = `filter-panel-${filter.name}`;

        if (isMobile) {
            this.createMobilePanelUI(panel, filter);
        } else {
            this.createDesktopPanelUI(panel, filter);
        }
        
        // 항상 filterPanels에 추가
        this.filterPanels.appendChild(panel);
        
        // 이벤트 리스너 설정
        this.setupFilterEventListeners(panel, filter);
        
        return panel;
    }
    
    /**
     * 모바일용 필터 패널 UI 생성
     */
    createMobilePanelUI(panel, filter) {
        // 손잡이 추가
        const handle = this.createHandle();
        panel.appendChild(handle);

        // 패널 헤더
        const header = document.createElement('div');
        header.className = 'panel-header';
        header.innerHTML = `<h3 class="panel-title">${filter.displayName} 필터</h3>`;
        panel.appendChild(header);

        // 패널 컨텐츠 컨테이너
        const content = document.createElement('div');
        content.className = 'panel-content';

        // 필터 유형에 따른 UI 생성
        const filterContent = document.createElement('div');
        filterContent.className = 'filter-group';

        // 필터 타입에 따른 UI 요소 생성 (모바일용)
        switch (filter.type) {
            case 'range':
                filterContent.innerHTML = this.createMobileRangeFilterUI(filter);
                break;
            case 'selection':
            case 'select':
                filterContent.innerHTML = this.createMobileSelectionFilterUI(filter);
                break;
            case 'enchant':
                filterContent.innerHTML = this.createMobileEnchantFilterUI(filter);
                break;
            case 'reforge-option':
                filterContent.innerHTML = this.createMobileReforgeOptionFilterUI(filter);
                break;
            case 'reforge-status':
                filterContent.innerHTML = this.createMobileReforgeStatusFilterUI(filter);
                break;
            case 'erg':
                filterContent.innerHTML = this.createMobileErgFilterUI(filter);
                break;
            case 'special-mod':
                filterContent.innerHTML = this.createMobileSpecialModFilterUI(filter);
                break;
            case 'set-effect':
                filterContent.innerHTML = this.createMobileSetEffectFilterUI(filter);
                break;
            default:
                filterContent.innerHTML = '<p>지원되지 않는 필터 유형입니다.</p>';
        }

        content.appendChild(filterContent);
        panel.appendChild(content);
    }

    /**
     * 데스크톱용 필터 패널 UI 생성
     */
    createDesktopPanelUI(panel, filter) {
        panel.innerHTML = `
            <div class="panel-header">
                <h3 class="panel-title">${filter.displayName} 필터</h3>
            </div>
        `;

        const filterContent = document.createElement('div');
        filterContent.className = 'filter-group';

        switch (filter.type) {
            case 'range': filterContent.innerHTML = this.createRangeFilterUI(filter); break;
            case 'selection':
            case 'select': filterContent.innerHTML = this.createSelectionFilterUI(filter); break;
            case 'enchant': filterContent.innerHTML = this.createEnchantFilterUI(filter); break;
            case 'reforge-option': filterContent.innerHTML = this.createReforgeOptionFilterUI(filter); break;
            case 'reforge-status': filterContent.innerHTML = this.createReforgeStatusFilterUI(filter); break;
            case 'erg': filterContent.innerHTML = this.createErgFilterUI(filter); break;
            case 'special-mod': filterContent.innerHTML = this.createSpecialModFilterUI(filter); break;
            case 'set-effect': filterContent.innerHTML = this.createSetEffectFilterUI(filter); break;
            default: filterContent.innerHTML = '<p>지원되지 않는 필터 유형입니다.</p>';
        }

        panel.appendChild(filterContent);
    }

    /**
     * 모바일용 범위 필터 UI 생성
     */
    createMobileRangeFilterUI(filter) {
        return `
            <div class="filter-group">
                <label class="filter-label">최소값</label>
                <input type="number" class="range-input" id="${filter.name}-min" placeholder="최소값 입력">
            </div>
            <div class="filter-group">
                <label class="filter-label">최대값</label>
                <input type="number" class="range-input" id="${filter.name}-max" placeholder="최대값 입력">
            </div>
        `;
    }
    
    /**
     * 모바일용 선택 필터 UI 생성
     */
    createMobileSelectionFilterUI(filter) {
        return `
            <div class="filter-group">
                <label class="filter-label">선택</label>
                <select class="dropdown-select" id="${filter.name}-select">
                    <option value="">선택하세요</option>
                    <!-- 옵션은 동적으로 추가됩니다 -->
                </select>
            </div>
        `;
    }
    
    /**
     * 모바일용 인챈트 필터 UI 생성
     */
    createMobileEnchantFilterUI(filter) {
        return `
            <div class="filter-group">
                <label class="filter-label">접두 인챈트</label>
                <input type="text" class="range-input" id="${filter.name}-prefix" placeholder="접두 인챈트 검색">
            </div>
            <div class="filter-group">
                <label class="filter-label">접미 인챈트</label>
                <input type="text" class="range-input" id="${filter.name}-suffix" placeholder="접미 인챈트 검색">
            </div>
        `;
    }
    
    /**
     * 모바일용 세공 옵션 필터 UI 생성
     */
    createMobileReforgeOptionFilterUI(filter) {
        return `
            <div class="filter-group">
                <label class="filter-label">세공 옵션 이름</label>
                <input type="text" class="range-input" id="${filter.name}-name" placeholder="세공 옵션 이름">
            </div>
            <div class="filter-group">
                <label class="filter-label">최소 레벨</label>
                <input type="number" class="range-input" id="${filter.name}-min-level" placeholder="최소 레벨">
            </div>
            <div class="filter-group">
                <label class="filter-label">최대 레벨</label>
                <input type="number" class="range-input" id="${filter.name}-max-level" placeholder="최대 레벨">
            </div>
        `;
    }
    
    /**
     * 모바일용 세공 상태 필터 UI 생성
     */
    createMobileReforgeStatusFilterUI(filter) {
        return `
            <div class="filter-group">
                <label class="filter-label">세공 랭크</label>
                <select class="dropdown-select" id="${filter.name}-rank">
                    <option value="">전체</option>
                    <option value="1">1랭크</option>
                    <option value="2">2랭크</option>
                    <option value="3">3랭크</option>
                    <option value="4">4랭크</option>
                    <option value="5">5랭크</option>
                </select>
            </div>
            <div class="filter-group">
                <label class="filter-label">옵션 줄 수</label>
                <select class="dropdown-select" id="${filter.name}-line">
                    <option value="">전체</option>
                    <option value="1">1줄</option>
                    <option value="2">2줄</option>
                    <option value="3">3줄</option>
                    <option value="4">4줄</option>
                </select>
            </div>
        `;
    }
    
    /**
     * 모바일용 에르그 필터 UI 생성
     */
    createMobileErgFilterUI(filter) {
        return `
            <div class="filter-group">
                <label class="filter-label">에르그 등급</label>
                <select class="dropdown-select" id="${filter.name}-grade">
                    <option value="">전체</option>
                    <option value="일반">일반</option>
                    <option value="고급">고급</option>
                    <option value="희귀">희귀</option>
                    <option value="영웅">영웅</option>
                    <option value="전설">전설</option>
                </select>
            </div>
            <div class="filter-group">
                <label class="filter-label">최소 레벨</label>
                <input type="number" class="range-input" id="${filter.name}-min-level" placeholder="최소 레벨">
            </div>
            <div class="filter-group">
                <label class="filter-label">최대 레벨</label>
                <input type="number" class="range-input" id="${filter.name}-max-level" placeholder="최대 레벨">
            </div>
        `;
    }
    
    /**
     * 모바일용 특별 개조 필터 UI 생성
     */
    createMobileSpecialModFilterUI(filter) {
        return `
            <div class="filter-group">
                <label class="filter-label">특별 개조 타입</label>
                <select class="dropdown-select" id="${filter.name}-type">
                    <option value="">전체</option>
                    <option value="강화">강화</option>
                    <option value="변형">변형</option>
                    <option value="개조">개조</option>
                </select>
            </div>
            <div class="filter-group">
                <label class="filter-label">최소 단계</label>
                <input type="number" class="range-input" id="${filter.name}-min-level" placeholder="최소 단계">
            </div>
            <div class="filter-group">
                <label class="filter-label">최대 단계</label>
                <input type="number" class="range-input" id="${filter.name}-max-level" placeholder="최대 단계">
            </div>
        `;
    }
    
    /**
     * 모바일용 세트 효과 필터 UI 생성
     */
    createMobileSetEffectFilterUI(filter) {
        return `
            <div class="filter-group">
                <label class="filter-label">세트 효과 이름</label>
                <input type="text" class="range-input" id="${filter.name}-name" placeholder="세트 효과 이름">
            </div>
            <div class="filter-group">
                <label class="filter-label">최소 수치</label>
                <input type="number" class="range-input" id="${filter.name}-min-value" placeholder="최소 수치">
            </div>
            <div class="filter-group">
                <label class="filter-label">최대 수치</label>
                <input type="number" class="range-input" id="${filter.name}-max-value" placeholder="최대 수치">
            </div>
        `;
    }
    
    /**
     * 필터 이벤트 리스너 설정
     */
    setupFilterEventListeners(panel, filter) {
        // 필터 유형에 따른 이벤트 설정
        switch (filter.type) {
            case 'range':
                this.setupRangeFilterEvents(panel, filter);
                break;
            case 'selection':
            case 'select':
                this.setupSelectionFilterEvents(panel, filter);
                break;
            case 'enchant':
                this.setupEnchantFilterEvents(panel, filter);
                break;
            case 'reforge-option':
                this.setupReforgeOptionFilterEvents(panel, filter);
                break;
            case 'reforge-status':
                this.setupReforgeStatusFilterEvents(panel, filter);
                break;
            case 'erg':
                this.setupErgFilterEvents(panel, filter);
                break;
            case 'special-mod':
                this.setupSpecialModFilterEvents(panel, filter);
                break;
            case 'set-effect':
                this.setupSetEffectFilterEvents(panel, filter);
                break;
        }
    }
    
    /**
     * 범위 필터 UI 생성 (데스크톱용)
     */
    createRangeFilterUI(filter) {
        return `
            <div class="range-filter">
                <input type="number" class="range-input" id="${filter.name}-min" placeholder="최소">
                <span>~</span>
                <input type="number" class="range-input" id="${filter.name}-max" placeholder="최대">
            </div>
        `;
    }
    
    /**
     * 선택 필터 UI 생성 (데스크톱용)
     */
    createSelectionFilterUI(filter) {
        // 옵션 목록은 동적으로 가져와야 합니다.
        return `
            <select class="dropdown-select" id="${filter.name}-select">
                <option value="">선택하세요</option>
                <!-- 옵션은 동적으로 추가됩니다 -->
            </select>
        `;
    }
    
    /**
     * 인챈트 필터 UI 생성 (데스크톱용)
     */
    createEnchantFilterUI(filter) {
        return `
            <div class="filter-group">
                <label class="filter-label">접두 인챈트</label>
                <input type="text" class="range-input" id="${filter.name}-prefix" placeholder="접두 인챈트 검색">
            </div>
            <div class="filter-group">
                <label class="filter-label">접미 인챈트</label>
                <input type="text" class="range-input" id="${filter.name}-suffix" placeholder="접미 인챈트 검색">
            </div>
        `;
    }
    
    /**
     * 세공 옵션 필터 UI 생성 (데스크톱용)
     */
    createReforgeOptionFilterUI(filter) {
        return `
            <div class="filter-group">
                <label class="filter-label">세공 옵션 이름</label>
                <input type="text" class="range-input" id="${filter.name}-name" placeholder="세공 옵션 이름">
            </div>
            <div class="filter-group">
                <label class="filter-label">레벨 범위</label>
                <div class="range-filter">
                    <input type="number" class="range-input" id="${filter.name}-min-level" placeholder="최소">
                    <span>~</span>
                    <input type="number" class="range-input" id="${filter.name}-max-level" placeholder="최대">
                </div>
            </div>
        `;
    }
    
    /**
     * 세공 상태 필터 UI 생성 (데스크톱용)
     */
    createReforgeStatusFilterUI(filter) {
        return `
            <div class="filter-group">
                <label class="filter-label">세공 랭크</label>
                <select class="dropdown-select" id="${filter.name}-rank">
                    <option value="">전체</option>
                    <option value="1">1랭크</option>
                    <option value="2">2랭크</option>
                    <option value="3">3랭크</option>
                    <option value="4">4랭크</option>
                    <option value="5">5랭크</option>
                </select>
            </div>
            <div class="filter-group">
                <label class="filter-label">옵션 줄 수</label>
                <select class="dropdown-select" id="${filter.name}-line">
                    <option value="">전체</option>
                    <option value="1">1줄</option>
                    <option value="2">2줄</option>
                    <option value="3">3줄</option>
                    <option value="4">4줄</option>
                </select>
            </div>
        `;
    }
    
    /**
     * 에르그 필터 UI 생성 (데스크톱용)
     */
    createErgFilterUI(filter) {
        return `
            <div class="filter-group">
                <label class="filter-label">에르그 등급</label>
                <select class="dropdown-select" id="${filter.name}-grade">
                    <option value="">전체</option>
                    <option value="일반">일반</option>
                    <option value="고급">고급</option>
                    <option value="희귀">희귀</option>
                    <option value="영웅">영웅</option>
                    <option value="전설">전설</option>
                </select>
            </div>
            <div class="filter-group">
                <label class="filter-label">에르그 레벨</label>
                <div class="range-filter">
                    <input type="number" class="range-input" id="${filter.name}-min-level" placeholder="최소">
                    <span>~</span>
                    <input type="number" class="range-input" id="${filter.name}-max-level" placeholder="최대">
                </div>
            </div>
        `;
    }
    
    /**
     * 특별 개조 필터 UI 생성 (데스크톱용)
     */
    createSpecialModFilterUI(filter) {
        return `
            <div class="filter-group">
                <label class="filter-label">특별 개조 타입</label>
                <select class="dropdown-select" id="${filter.name}-type">
                    <option value="">전체</option>
                    <option value="강화">강화</option>
                    <option value="변형">변형</option>
                    <option value="개조">개조</option>
                </select>
            </div>
            <div class="filter-group">
                <label class="filter-label">특별 개조 단계</label>
                <div class="range-filter">
                    <input type="number" class="range-input" id="${filter.name}-min-level" placeholder="최소">
                    <span>~</span>
                    <input type="number" class="range-input" id="${filter.name}-max-level" placeholder="최대">
                </div>
            </div>
        `;
    }
    
    /**
     * 세트 효과 필터 UI 생성 (데스크톱용)
     */
    createSetEffectFilterUI(filter) {
        return `
            <div class="filter-group">
                <label class="filter-label">세트 효과 이름</label>
                <input type="text" class="range-input" id="${filter.name}-name" placeholder="세트 효과 이름">
            </div>
            <div class="filter-group">
                <label class="filter-label">효과 수치</label>
                <div class="range-filter">
                    <input type="number" class="range-input" id="${filter.name}-min-value" placeholder="최소">
                    <span>~</span>
                    <input type="number" class="range-input" id="${filter.name}-max-value" placeholder="최대">
                </div>
            </div>
        `;
    }
    
    /**
     * 범위 필터 이벤트 설정
     */
    setupRangeFilterEvents(panel, filter) {
        const minInput = panel.querySelector(`#${filter.name}-min`);
        const maxInput = panel.querySelector(`#${filter.name}-max`);
        
        if (minInput && maxInput) {
            // 값 변경 이벤트
            const updateFilter = () => {
                const min = minInput.value.trim();
                const max = maxInput.value.trim();
                
                if (min || max) {
                    // 필터 옵션 업데이트
                    FilterManager.updateFilterOption(filter.name, {
                        type: 'range',
                        min: min,
                        max: max
                    });
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, true);
                } else {
                    // 필터 제거
                    FilterManager.removeFilterOption(filter.name);
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, false);
                }
            };
            
            // 이벤트 리스너
            minInput.addEventListener('input', updateFilter);
            maxInput.addEventListener('input', updateFilter);
        }
    }
    
    /**
     * 선택 필터 이벤트 설정
     */
    setupSelectionFilterEvents(panel, filter) {
        const select = panel.querySelector(`#${filter.name}-select`);
        
        if (select) {
            // 값 변경 이벤트
            select.addEventListener('change', () => {
                const value = select.value;
                
                if (value) {
                    // 필터 옵션 업데이트
                    FilterManager.updateFilterOption(filter.name, {
                        type: 'selection',
                        value: value
                    });
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, true);
                } else {
                    // 필터 제거
                    FilterManager.removeFilterOption(filter.name);
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, false);
                }
            });
        }
    }
    
    /**
     * 인챈트 필터 이벤트 설정
     */
    setupEnchantFilterEvents(panel, filter) {
        const prefixInput = panel.querySelector(`#${filter.name}-prefix`);
        const suffixInput = panel.querySelector(`#${filter.name}-suffix`);
        
        if (prefixInput && suffixInput) {
            // 값 변경 이벤트
            const updateFilter = () => {
                const prefix = prefixInput.value.trim();
                const suffix = suffixInput.value.trim();
                
                if (prefix || suffix) {
                    // 필터 옵션 업데이트
                    FilterManager.updateFilterOption(filter.name, {
                        type: 'enchant',
                        prefixEnchant: prefix,
                        suffixEnchant: suffix
                    });
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, true);
                } else {
                    // 필터 제거
                    FilterManager.removeFilterOption(filter.name);
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, false);
                }
            };
            
            // 이벤트 리스너
            prefixInput.addEventListener('input', updateFilter);
            suffixInput.addEventListener('input', updateFilter);
        }
    }
    
    /**
     * 세공 옵션 필터 이벤트 설정
     */
    setupReforgeOptionFilterEvents(panel, filter) {
        const nameInput = panel.querySelector(`#${filter.name}-name`);
        const minLevelInput = panel.querySelector(`#${filter.name}-min-level`);
        const maxLevelInput = panel.querySelector(`#${filter.name}-max-level`);
        
        if (nameInput && minLevelInput && maxLevelInput) {
            // 값 변경 이벤트
            const updateFilter = () => {
                const name = nameInput.value.trim();
                const minLevel = minLevelInput.value.trim();
                const maxLevel = maxLevelInput.value.trim();
                
                if (name || minLevel || maxLevel) {
                    // 필터 옵션 업데이트
                    FilterManager.updateFilterOption(filter.name, {
                        type: 'reforge-option',
                        options: [{
                            name: name,
                            minLevel: minLevel,
                            maxLevel: maxLevel
                        }]
                    });
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, true);
                } else {
                    // 필터 제거
                    FilterManager.removeFilterOption(filter.name);
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, false);
                }
            };
            
            // 이벤트 리스너
            nameInput.addEventListener('input', updateFilter);
            minLevelInput.addEventListener('input', updateFilter);
            maxLevelInput.addEventListener('input', updateFilter);
        }
    }
    
    /**
     * 세공 상태 필터 이벤트 설정
     */
    setupReforgeStatusFilterEvents(panel, filter) {
        const rankSelect = panel.querySelector(`#${filter.name}-rank`);
        const lineSelect = panel.querySelector(`#${filter.name}-line`);
        
        if (rankSelect && lineSelect) {
            // 값 변경 이벤트
            const updateFilter = () => {
                const rank = rankSelect.value;
                const lineCount = lineSelect.value;
                
                if (rank || lineCount) {
                    // 필터 옵션 업데이트
                    FilterManager.updateFilterOption(filter.name, {
                        type: 'reforge-status',
                        rank: rank,
                        lineCount: lineCount
                    });
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, true);
                } else {
                    // 필터 제거
                    FilterManager.removeFilterOption(filter.name);
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, false);
                }
            };
            
            // 이벤트 리스너
            rankSelect.addEventListener('change', updateFilter);
            lineSelect.addEventListener('change', updateFilter);
        }
    }
    
    /**
     * 에르그 필터 이벤트 설정
     */
    setupErgFilterEvents(panel, filter) {
        const gradeSelect = panel.querySelector(`#${filter.name}-grade`);
        const minLevelInput = panel.querySelector(`#${filter.name}-min-level`);
        const maxLevelInput = panel.querySelector(`#${filter.name}-max-level`);
        
        if (gradeSelect && minLevelInput && maxLevelInput) {
            // 값 변경 이벤트
            const updateFilter = () => {
                const grade = gradeSelect.value;
                const minLevel = minLevelInput.value.trim();
                const maxLevel = maxLevelInput.value.trim();
                
                if (grade || minLevel || maxLevel) {
                    // 필터 옵션 업데이트
                    FilterManager.updateFilterOption(filter.name, {
                        type: 'erg',
                        grade: grade,
                        minLevel: minLevel,
                        maxLevel: maxLevel
                    });
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, true);
                } else {
                    // 필터 제거
                    FilterManager.removeFilterOption(filter.name);
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, false);
                }
            };
            
            // 이벤트 리스너
            gradeSelect.addEventListener('change', updateFilter);
            minLevelInput.addEventListener('input', updateFilter);
            maxLevelInput.addEventListener('input', updateFilter);
        }
    }
    
    /**
     * 특별 개조 필터 이벤트 설정
     */
    setupSpecialModFilterEvents(panel, filter) {
        const typeSelect = panel.querySelector(`#${filter.name}-type`);
        const minLevelInput = panel.querySelector(`#${filter.name}-min-level`);
        const maxLevelInput = panel.querySelector(`#${filter.name}-max-level`);
        
        if (typeSelect && minLevelInput && maxLevelInput) {
            // 값 변경 이벤트
            const updateFilter = () => {
                const modType = typeSelect.value;
                const minLevel = minLevelInput.value.trim();
                const maxLevel = maxLevelInput.value.trim();
                
                if (modType || minLevel || maxLevel) {
                    // 필터 옵션 업데이트
                    FilterManager.updateFilterOption(filter.name, {
                        type: 'special-mod',
                        modType: modType,
                        minLevel: minLevel,
                        maxLevel: maxLevel
                    });
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, true);
                } else {
                    // 필터 제거
                    FilterManager.removeFilterOption(filter.name);
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, false);
                }
            };
            
            // 이벤트 리스너
            typeSelect.addEventListener('change', updateFilter);
            minLevelInput.addEventListener('input', updateFilter);
            maxLevelInput.addEventListener('input', updateFilter);
        }
    }
    
    /**
     * 세트 효과 필터 이벤트 설정
     */
    setupSetEffectFilterEvents(panel, filter) {
        const nameInput = panel.querySelector(`#${filter.name}-name`);
        const minValueInput = panel.querySelector(`#${filter.name}-min-value`);
        const maxValueInput = panel.querySelector(`#${filter.name}-max-value`);
        
        if (nameInput && minValueInput && maxValueInput) {
            // 값 변경 이벤트
            const updateFilter = () => {
                const name = nameInput.value.trim();
                const minValue = minValueInput.value.trim();
                const maxValue = maxValueInput.value.trim();
                
                if (name || minValue || maxValue) {
                    // 필터 옵션 업데이트
                    FilterManager.updateFilterOption(filter.name, {
                        type: 'set-effect',
                        effects: [{
                            name: name,
                            minValue: minValue,
                            maxValue: maxValue
                        }]
                    });
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, true);
                } else {
                    // 필터 제거
                    FilterManager.removeFilterOption(filter.name);
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, false);
                }
            };
            
            // 이벤트 리스너
            nameInput.addEventListener('input', updateFilter);
            minValueInput.addEventListener('input', updateFilter);
            maxValueInput.addEventListener('input', updateFilter);
        }
    }
    
    /**
     * 필터 버튼 스타일 업데이트
     */
    updateFilterButtonStyle(filterId, isActive) {
        const filterBtn = document.querySelector(`.filter-btn[data-filter="${filterId}"]`);
        if (filterBtn) {
            if (isActive) {
                filterBtn.classList.add('filtered');
            } else {
                filterBtn.classList.remove('filtered');
            }
        }
    }
    
    /**
     * 외부 클릭 처리
     */
    handleOutsideClick(event) {
        // 드롭다운 메뉴 닫기
        if (!event.target.closest('#main-filter-btn') && 
            !event.target.closest('#filter-options') && 
            this.filterOptions.classList.contains('active')) {
            this.filterOptions.classList.remove('active');
            this.filterOptions.classList.remove('mobile-toast');
            
            // 메뉴가 닫힐 때 바디 오버플로우 복원
            document.body.style.overflow = '';
            
            // 오버레이 비활성화
            if (this.overlay) {
                this.overlay.classList.remove('active');
            }
        }
        
        // 필터 패널 닫기 (버튼 이외 영역 클릭 시)
        const activePanel = document.querySelector('.filter-panel.active');
        const activeBtn = document.querySelector('.filter-btn.active[data-filter]');
        
        if (activePanel && !activePanel.contains(event.target) && 
            activeBtn && !activeBtn.contains(event.target) &&
            !event.target.closest('#filter-options')) {
            
            // 검색창이나 결과패널 등 다른 주요 UI 영역 클릭 시에도 패널 닫기
            activePanel.classList.remove('active');
            activePanel.classList.remove('mobile-toast');
            activeBtn.classList.remove('active');
            
            // 패널이 닫힐 때 바디 오버플로우 복원
            document.body.style.overflow = '';
            
            // 오버레이 비활성화
            if (this.overlay) {
                this.overlay.classList.remove('active');
            }
            
            // 모바일에서 바디에 직접 추가된 패널은 다시 filterPanels로 돌려놓기
            const isMobile = window.innerWidth <= 768;
            if (isMobile && activePanel.parentNode === document.body) {
                this.filterPanels.appendChild(activePanel);
            }
        }
    }
    
    /**
     * 필터 변경 이벤트 처리
     */
    handleFilterChanged(e) {
        if (e.detail && e.detail.filters) {
            // 필터 적용 상태 업데이트
            const activeFilters = e.detail.filters;
            
            // 각 필터 버튼 스타일 업데이트
            activeFilters.forEach(filter => {
                this.updateFilterButtonStyle(filter.name, true);
            });
            
            // 영향받지 않은 버튼들 스타일 초기화
            document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
                const filterId = btn.dataset.filter;
                if (!activeFilters.some(f => f.name === filterId)) {
                    btn.classList.remove('filtered');
                }
            });
        }
    }
    
    /**
     * 결과 패널 위치 조정
     */
    adjustResultsContainerPosition() {
        const resultsContainer = document.querySelector('.results-container');
        const searchWrapper = document.querySelector('.search-wrapper');
        if (!resultsContainer || !this.filterContainer || !searchWrapper) return;
        
        // 검색창 너비 가져오기
        const searchWrapperWidth = searchWrapper.offsetWidth;
        
        // 필터 컨테이너 너비를 검색창보다 10px 작게 설정
        this.filterContainer.style.width = `${searchWrapperWidth - 10}px`;
        
        // 결과 컨테이너 너비를 검색창과 동일하게 설정
        resultsContainer.style.width = `${searchWrapperWidth}px`;
        
        // 기존 코드 유지 (마진 계산 부분)
        const filterButtons = this.filterContainer.querySelectorAll('.filter-btn');
        if (filterButtons.length <= 0) return;
        
        const firstButtonTop = filterButtons[0].getBoundingClientRect().top;
        const lastButtonBottom = filterButtons[filterButtons.length - 1].getBoundingClientRect().bottom;
        
        const filterContainerTop = 70;
        const bottomPosition = filterContainerTop + (lastButtonBottom - firstButtonTop) + 30;
        
        resultsContainer.style.marginTop = `${bottomPosition}px`;
    }
}

// 싱글톤 인스턴스 생성 및 내보내기
const filterUI = new FilterUI();

export default filterUI;
