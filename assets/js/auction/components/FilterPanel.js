/**
 * 필터 UI 관리 모듈
 * 필터 UI 렌더링 및 이벤트 처리
 */

import filterService from '../services/filter.js';
import optionFilter from '../services/option-filter.js';

/**
 * 프론트엔드에서 지원하는 필터의 설정 목록.
 * 여기에 정의된 필터만 사용자에게 표시됩니다.
 * key: 백엔드의 availableFilters에 포함된 이름
 * value: 필터 UI를 구성하기 위한 설정값
 */
const FILTER_CONFIGS = {
    '공격': { displayName: '최대 공격력', type: 'range', fields: { min: '최소', max: '최대' }, field: 'option_value2' },
    '내구력': { displayName: '최대 내구력', type: 'range', fields: { min: '최소', max: '최대' } },
    '밸런스': { displayName: '밸런스', type: 'range', fields: { min: '최소', max: '최대' }, isPercent: true },
    '방어력': { displayName: '방어력', type: 'range', fields: { min: '최소', max: '최대' } },
    '보호': { displayName: '보호', type: 'range', fields: { min: '최소', max: '최대' } },
    '피어싱 레벨': { displayName: '피어싱 레벨', type: 'range', fields: { min: '최소', max: '최대' } },
    '남은 전용 해제 가능 횟수': { displayName: '전해 횟수', type: 'range', fields: { min: '최소', max: '최대' } },
    '인챈트': { displayName: '인챈트', type: 'enchant' },
    '특별 개조': { displayName: '특별 개조', type: 'special-mod' },
    '에르그': {
        displayName: '에르그',
        type: 'composite',
        fields: [
            { id: 'grade', type: 'select', label: '에르그 등급', options: { '': '전체', '일반': '일반', '고급': '고급', '희귀': '희귀', '영웅': '영웅', '전설': '전설' } },
            { id: 'level', type: 'range', label: '에르그 레벨', minId: 'minLevel', maxId: 'maxLevel' }
        ],
        filterType: 'erg'
    },
    '세공 옵션': {
        displayName: '세공 옵션',
        type: 'composite',
        fields: [
            { id: 'name', type: 'text', label: '세공 옵션 이름' },
            { id: 'level', type: 'range', label: '레벨 범위', minId: 'minLevel', maxId: 'maxLevel' }
        ],
        filterType: 'reforge-option',
        payloadKey: 'options'
    },
    '세트 효과': {
        displayName: '세트 효과',
        type: 'composite',
        fields: [
            { id: 'name', type: 'text', label: '세트 효과 이름' },
            { id: 'value', type: 'range', label: '효과 수치', minId: 'minValue', maxId: 'maxValue' }
        ],
        filterType: 'set-effect',
        payloadKey: 'effects'
    },
    '세공 랭크': { displayName: '세공', type: 'reforge-status' },
    '남은 거래 횟수': { displayName: '남은 거래 횟수', type: 'range' },

    '펫 정보: 남은 분양 횟수': { displayName: '남은 분양 횟수', type: 'range', category: '펫 정보' }
};

class FilterPanel {
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
        window.FilterPanel = this;
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
        document.body.style.overflow = 'auto';
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
     * @param {string[]} availableFilters - 백엔드에서 전달받은 사용 가능한 필터 이름 배열
     */
    async loadFilterOptions(availableFilters = []) {
        try {
            console.log('loadFilterOptions 호출됨, availableFilters:', availableFilters);

            // 필터 옵션 메뉴 초기화
            this.filterOptions.innerHTML = '';
            
            // 1. FILTER_CONFIGS에 정의된 순서를 기준으로 사용 가능한 필터 목록을 생성합니다.
            const filtersToDisplay = Object.keys(FILTER_CONFIGS).reduce((acc, filterName) => {
                // API에서 전달받은 availableFilters 목록에 포함된 필터만 추가합니다.
                if (availableFilters.includes(filterName)) {
                    acc.push({ name: filterName, ...FILTER_CONFIGS[filterName] });
                }
                return acc;
            }, []);

            // 필터가 없을 경우
            if (filtersToDisplay.length === 0) {
                this.filterOptions.innerHTML = '<div class="filter-option-none">사용 가능한 필터가 없습니다.</div>';
                return;
            }
            
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
                filtersToDisplay.forEach(filter => {
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
                filtersToDisplay.forEach(filter => {
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
     * 필터 옵션 클릭 처리 (드롭다운 메뉴에서)
     */
    handleFilterOptionClickFromDropdown(filter) {
        // 필터 옵션 메뉴 닫기
        this.toggleFilterOptions(); // 메뉴를 닫는 동작으로 통일

        // 필터 버튼 추가 및 패널 열기
        this.addAndActivateFilter(filter);
    }
    
    /**
     * 필터 옵션 클릭 처리
     */
    handleFilterOptionClick(filter) {
        // 필터 옵션 메뉴 닫기
        this.filterOptions.classList.remove('active');
        this.filterOptions.classList.remove('mobile-toast');
        
        // 메뉴가 닫힐 때 바디 오버플로우 복원
        document.body.style.overflow = 'auto';
        
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
        
        this.addAndActivateFilter(filter);
    }

    /**
     * 필터 버튼을 추가하고 해당 패널을 활성화합니다.
     * @param {object} filter - 필터 설정 객체
     */
    addAndActivateFilter(filter) {
        // 이미 활성화된 필터인지 확인
        const existingBtn = document.querySelector(`.filter-btn[data-filter="${filter.name}"]`);
        if (existingBtn) {
            // 이미 있는 버튼 활성화 및 패널 열기
            this.activateFilterButton(existingBtn, filter.name);
            return;
        }
        
        // 필터 패널 추가
        this.addFilterPanel(filter);
        
        // 필터 버튼 추가 (버튼 추가 후 활성화)
        const newBtn = this.addFilterButton(filter);
        // 버튼 활성화 및 패널 열기
        this.activateFilterButton(newBtn, filter.name);
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
        const panelId = `filter-panel-${filterId.replace(/\s/g, '')}`;
        const panel = document.getElementById(panelId);
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
        const panelId = `filter-panel-${filterId.replace(/\s/g, '')}`;
        const panel = document.getElementById(panelId);
        
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
        filterService.removeFilterOption(filterId);
        
        // 필터 버튼 삭제로 인한 행 수 변경 확인
        this.checkFilterRows();

        // 필터 제거 시 결과 패널 위치 조정
        this.adjustResultsContainerPosition();
        
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
        // 필터 버튼 추가 후 위치 재조정
        this.adjustResultsContainerPosition();

        // 필터 버튼 추가 후 위치 재조정
        this.adjustResultsContainerPosition();

        return newButton;
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
        panel.id = `filter-panel-${filter.name.replace(/\s/g, '')}`;
    
        if (isMobile) {
            this.createMobilePanelUI(panel, filter);
            this.setupFilterEventListeners(panel, filter, true); // 모바일용 이벤트 설정
        } else {
            this.createDesktopPanelUI(panel, filter);
            this.setupFilterEventListeners(panel, filter, false); // 데스크톱용 이벤트 설정
        }
        
        // 항상 filterPanels에 추가
        this.filterPanels.appendChild(panel);
        
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
        const setFilterContent = (filter) => { switch (filter.type) {
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
            case 'reforge-status':
                filterContent.innerHTML = this.createMobileReforgeStatusFilterUI(filter);
                break;
            case 'special-mod':
                filterContent.innerHTML = this.createMobileSpecialModFilterUI(filter);
                break;
            case 'composite':
                filterContent.innerHTML = this.createMobileCompositeFilterUI(filter);
                break;
            default:
                filterContent.innerHTML = '<p>지원되지 않는 필터 유형입니다.</p>';
        }};

        const filterContent = document.createElement('div');
        // 특별 개조 필터는 여러 filter-group을 가지므로 상위 div에 filter-group 클래스를 적용하지 않습니다.
        if (filter.type !== 'special-mod') {
            filterContent.className = 'filter-group';
        }
        setFilterContent(filter);
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

        if (filter.type === 'special-mod' || filter.type === 'composite' || filter.type === 'enchant' || filter.type === 'reforge-status') {
            // 여러 filter-group을 반환하는 필터들은 바로 innerHTML로 설정
            const filterContent = document.createElement('div');
            if (filter.type === 'special-mod') filterContent.innerHTML = this.createSpecialModFilterUI(filter);
            if (filter.type === 'composite') filterContent.innerHTML = this.createCompositeFilterUI(filter);
            if (filter.type === 'enchant') filterContent.innerHTML = this.createEnchantFilterUI(filter);
            if (filter.type === 'reforge-status') filterContent.innerHTML = this.createReforgeStatusFilterUI(filter);
            panel.appendChild(filterContent);
        } else {
            // 단일 filter-group을 사용하는 필터들
            const filterContent = document.createElement('div');
            filterContent.className = 'filter-group';
            if (filter.type === 'range') filterContent.innerHTML = this.createRangeFilterUI(filter);
            else if (filter.type === 'selection' || filter.type === 'select') filterContent.innerHTML = this.createSelectionFilterUI(filter);
            else filterContent.innerHTML = '<p>지원되지 않는 필터 유형입니다.</p>';
            panel.appendChild(filterContent);
        }
    }

    /**
     * 모바일용 범위 필터 UI 생성
     */
    createMobileRangeFilterUI(filter) {
        return `
            <div class="filter-group">
                <label class="filter-label">최소값</label>
                <input type="number" class="range-input" id="${filter.name.replace(/\s/g, '')}-min" placeholder="최소값 입력">
            </div>
            <div class="filter-group">
                <label class="filter-label">최대값</label>
                <input type="number" class="range-input" id="${filter.name.replace(/\s/g, '')}-max" placeholder="최대값 입력">
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
                <select class="dropdown-select" id="${filter.name.replace(/\s/g, '')}-select">
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
                <input type="text" class="range-input" id="${filter.name.replace(/\s/g, '')}-prefix" placeholder="접두 인챈트 검색">
            </div>
            <div class="filter-group">
                <label class="filter-label">접미 인챈트</label>
                <input type="text" class="range-input" id="${filter.name.replace(/\s/g, '')}-suffix" placeholder="접미 인챈트 검색">
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
                <select class="dropdown-select" id="${filter.name.replace(/\s/g, '')}-rank">
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
                <select class="dropdown-select" id="${filter.name.replace(/\s/g, '')}-line">
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
     * 모바일용 특별 개조 필터 UI 생성
     */
    createMobileSpecialModFilterUI(filter) {
        return `
            <div class="filter-group">
                <label class="filter-label">특별 개조 타입</label>
                <div class="special-mod-type-selector" id="${filter.name.replace(/\s/g, '')}-type-selector">
                    <button class="mod-type-btn" data-type="R">R타입</button>
                    <button class="mod-type-btn" data-type="S">S타입</button>
                </div>
                <input type="hidden" id="${filter.name.replace(/\s/g, '')}-type" value="">
            </div>
            <div class="filter-group">
                <label class="filter-label">특별 개조 단계 (최소)</label>
                <input type="number" class="range-input" id="${filter.name.replace(/\s/g, '')}-min-level" placeholder="최소 단계 입력">
            </div>
            <div class="filter-group">
                <label class="filter-label">특별 개조 단계 (최대)</label>
                <input type="number" class="range-input" id="${filter.name.replace(/\s/g, '')}-max-level" placeholder="최대 단계 입력">
            </div>
        `;
    }
    
    /**
     * 모바일용 복합 필터 UI 생성
     */
    createMobileCompositeFilterUI(filter) {
        return filter.fields.map(field => {
            let fieldHtml = `<div class="filter-group"><label class="filter-label">${field.label}</label>`;
            if (field.type === 'text') {
                fieldHtml += `<input type="text" class="range-input" data-id="${field.id}" placeholder="${field.label}">`;
            } else if (field.type === 'select') {
                const optionsHtml = Object.entries(field.options).map(([value, text]) => `<option value="${value}">${text}</option>`).join('');
                fieldHtml += `<select class="dropdown-select" data-id="${field.id}">${optionsHtml}</select>`;
            } else if (field.type === 'range') {
                fieldHtml += `<input type="number" class="range-input" data-id="${field.minId}" placeholder="최소">`;
                fieldHtml += `<input type="number" class="range-input" data-id="${field.maxId}" placeholder="최대" style="margin-top: 8px;">`;
            }
            fieldHtml += `</div>`;
            return fieldHtml;
        }).join('');
    }

    /**
     * 데스크톱용 복합 필터 UI 생성
     */
    createCompositeFilterUI(filter) {
        return filter.fields.map(field => {
            let fieldHtml = `<div class="filter-group"><label class="filter-label">${field.label}</label>`;
            if (field.type === 'text') {
                fieldHtml += `<input type="text" class="range-input" data-id="${field.id}" placeholder="${field.label}">`;
            } else if (field.type === 'select') {
                const optionsHtml = Object.entries(field.options).map(([value, text]) => `<option value="${value}">${text}</option>`).join('');
                fieldHtml += `<select class="dropdown-select" data-id="${field.id}">${optionsHtml}</select>`;
            } else if (field.type === 'range') {
                fieldHtml += `<div class="range-filter"><input type="number" class="range-input" data-id="${field.minId}" placeholder="최소"><span>~</span><input type="number" class="range-input" data-id="${field.maxId}" placeholder="최대"></div>`;
            }
            fieldHtml += `</div>`;
            return fieldHtml;
        }).join('');
    }

    /**
     * 필터 이벤트 리스너 설정
     */
    setupFilterEventListeners(panel, filter, isMobile = false) {
        // 필터 유형에 따른 이벤트 설정
        switch (filter.type) {
            case 'range':
                this.setupRangeFilterEvents(panel, filter, isMobile);
                break;
            case 'selection':
            case 'select':
                this.setupSelectionFilterEvents(panel, filter);
                break;
            case 'enchant': this.setupEnchantFilterEvents(panel, filter); break;
            case 'reforge-status':
                this.setupReforgeStatusFilterEvents(panel, filter);
                break;
            case 'special-mod': this.setupSpecialModFilterEvents(panel, filter); break;
            case 'composite':
                this.setupCompositeFilterEvents(panel, filter);
                break;
        }
    }
    
    /**
     * 범위 필터 UI 생성 (데스크톱용)
     */
    createRangeFilterUI(filter, isMobile = false) {
        return `
            <div class="range-filter">
                <input type="number" class="range-input" id="${filter.name.replace(/\s/g, '')}-min" placeholder="최소">
                <span>~</span>
                <input type="number" class="range-input" id="${filter.name.replace(/\s/g, '')}-max" placeholder="최대">
            </div>
        `;
    }
    
    /**
     * 선택 필터 UI 생성 (데스크톱용)
     */
    createSelectionFilterUI(filter) {
        // 옵션 목록은 동적으로 가져와야 합니다.
        return `
            <select class="dropdown-select" id="${filter.name.replace(/\s/g, '')}-select">
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
                <input type="text" class="range-input" id="${filter.name.replace(/\s/g, '')}-prefix" placeholder="접두 인챈트 검색">
            </div>
            <div class="filter-group">
                <label class="filter-label">접미 인챈트</label>
                <input type="text" class="range-input" id="${filter.name.replace(/\s/g, '')}-suffix" placeholder="접미 인챈트 검색">
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
                <div class="special-mod-type-selector" id="${filter.name.replace(/\s/g, '')}-type-selector">
                    <button class="mod-type-btn" data-type="R">R타입</button>
                    <button class="mod-type-btn" data-type="S">S타입</button>
                </div>
                <input type="hidden" id="${filter.name.replace(/\s/g, '')}-type" value="">
            </div>
            <div class="filter-group">
                <label class="filter-label">특별 개조 단계</label>
                <div class="range-filter">
                    <input type="number" class="range-input" id="${filter.name.replace(/\s/g, '')}-min-level" placeholder="최소">
                    <span>~</span>
                    <input type="number" class="range-input" id="${filter.name.replace(/\s/g, '')}-max-level" placeholder="최대">
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
                <select class="dropdown-select" id="${filter.name.replace(/\s/g, '')}-rank">
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
                <select class="dropdown-select" id="${filter.name.replace(/\s/g, '')}-line">
                    <option value="">전체</option>
                    <option value="1">1줄</option>
                    <option value="2">2줄</option>
                    <option value="3">3줄</option>
                </select>
            </div>
        `;
    }

    /**
     * 범위 필터 이벤트 설정
     */
    setupRangeFilterEvents(panel, filter, isMobile = false) {
        const filterId = filter.name.replace(/\s/g, '');
        const minInput = panel.querySelector(`#${filterId}-min`);
        const maxInput = panel.querySelector(`#${filterId}-max`);
        
        if (minInput && maxInput) {
            // 값 변경 이벤트
            const updateFilter = () => {
                const min = minInput.value.trim();
                const max = maxInput.value.trim();
                
                if (min || max) {
                    // 필터 옵션 업데이트
                    filterService.addFilterOption(filter.name, { // filter.name은 '공격'
                        ...filter, // '공격' 필터의 모든 설정(field: 'option_value2' 포함)을 복사
                        min: min,
                        max: max
                    });
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, true, { min, max });
                } else {
                    // 필터 제거
                    filterService.removeFilterOption(filter.name);
                    
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
        const filterId = filter.name.replace(/\s/g, '');
        const select = panel.querySelector(`#${filterId}-select`);
        
        if (select) {
            // 값 변경 이벤트
            select.addEventListener('change', () => {
                const value = select.value;
                
                if (value) {
                    // 필터 옵션 업데이트
                    filterService.addFilterOption(filter.name, {
                        type: 'selection',
                        value: value
                    });
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, true, { value });
                } else {
                    // 필터 제거
                    filterService.removeFilterOption(filter.name);
                    
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
        const filterId = filter.name.replace(/\s/g, '');
        const prefixInput = panel.querySelector(`#${filterId}-prefix`);
        const suffixInput = panel.querySelector(`#${filterId}-suffix`);
        
        if (prefixInput && suffixInput) {
            // 값 변경 이벤트
            const updateFilter = () => {
                const prefix = prefixInput.value.trim();
                const suffix = suffixInput.value.trim();
                
                if (prefix || suffix) {
                    // 필터 옵션 업데이트
                    filterService.addFilterOption(filter.name, {
                        type: 'enchant',
                        prefixEnchant: prefix,
                        suffixEnchant: suffix
                    });
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, true, { prefix, suffix });
                } else {
                    // 필터 제거
                    filterService.removeFilterOption(filter.name);
                    
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
     * 특별 개조 필터 이벤트 설정
     */
    setupSpecialModFilterEvents(panel, filter) {
        const filterId = filter.name.replace(/\s/g, '');
        const typeSelector = panel.querySelector(`#${filterId}-type-selector`);
        const typeInput = panel.querySelector(`#${filterId}-type`);
        const minLevelInput = panel.querySelector(`#${filterId}-min-level`);
        const maxLevelInput = panel.querySelector(`#${filterId}-max-level`);

        if (typeSelector && typeInput && minLevelInput && maxLevelInput) {
            // 타입 버튼 클릭 이벤트
            typeSelector.addEventListener('click', (e) => {
                if (e.target.matches('.mod-type-btn')) {
                    const selectedType = e.target.dataset.type;
                    
                    // 이미 선택된 버튼을 다시 클릭한 경우 선택 해제
                    if (e.target.classList.contains('active')) {
                        typeInput.value = '';
                        e.target.classList.remove('active');
                    } else {
                        typeInput.value = selectedType;
    
                        // 모든 버튼에서 active 클래스 제거 후 현재 버튼에 추가
                        typeSelector.querySelectorAll('.mod-type-btn').forEach(btn => btn.classList.remove('active'));
                        e.target.classList.add('active');
                    }

                    updateFilter();
                }
            });

            // 값 변경 이벤트
            const updateFilter = () => {
                const modType = typeInput.value;
                const minLevel = minLevelInput.value.trim();
                const maxLevel = maxLevelInput.value.trim();
                
                // 타입이 선택되었거나 레벨 값이 있을 때 필터 적용
                if (modType || minLevel !== '' || maxLevel !== '') {
                    // 필터 옵션 업데이트
                    filterService.addFilterOption(filter.name, {
                        type: 'special-mod',
                        modType: modType,
                        minLevel: minLevel,
                        maxLevel: maxLevel
                    });
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, true, { modType, minLevel, maxLevel });
                } else {
                    // 필터 제거
                    filterService.removeFilterOption(filter.name);
                    
                    // 필터 버튼 스타일 업데이트
                    this.updateFilterButtonStyle(filter.name, false);
                }
            };
            
            // 이벤트 리스너
            minLevelInput.addEventListener('input', updateFilter);
            maxLevelInput.addEventListener('input', updateFilter);
        } else {
            console.error('[DevDebug] 특별 개조 필터의 일부 UI 요소를 찾을 수 없습니다.');
        }
    }
    
    /**
     * 세공 상태 필터 이벤트 설정
     */
    setupReforgeStatusFilterEvents(panel, filter) {
        const filterId = filter.name.replace(/\s/g, '');
        const rankSelect = panel.querySelector(`#${filterId}-rank`);
        const lineSelect = panel.querySelector(`#${filterId}-line`);
        
        if (rankSelect && lineSelect) {
            const updateFilter = () => {
                const rank = rankSelect.value;
                const lineCount = lineSelect.value;
                
                if (rank || lineCount) {
                    filterService.addFilterOption(filter.name, {
                        type: 'reforge-status',
                        rank: rank,
                        lineCount: lineCount
                    });
                    this.updateFilterButtonStyle(filter.name, true, { rank, lineCount });
                } else {
                    filterService.removeFilterOption(filter.name);
                    this.updateFilterButtonStyle(filter.name, false);
                }
            };
            
            rankSelect.addEventListener('change', updateFilter);
            lineSelect.addEventListener('change', updateFilter);
        }
    }

    /**
     * 복합 필터 이벤트 설정
     */
    setupCompositeFilterEvents(panel, filter) {
        const inputs = panel.querySelectorAll('input, select');
        const updateFilter = () => {
            const values = {};
            let hasValue = false;
            inputs.forEach(input => {
                const id = input.dataset.id;
                const value = input.value.trim();
                if (value) {
                    hasValue = true;
                }
                values[id] = value;
            });

            if (hasValue) {
                let payload = { ...values };

                // 세공 옵션, 세트 효과는 배열 형태로 payload를 재구성
                if (filter.payloadKey) {
                    const nestedPayload = {};
                    filter.fields.forEach(field => {
                        if (field.type === 'text') nestedPayload[field.id] = values[field.id];
                        if (field.type === 'range') {
                            nestedPayload[field.minId] = values[field.minId];
                            nestedPayload[field.maxId] = values[field.maxId];
                        }
                    });
                    payload = { [filter.payloadKey]: [nestedPayload] };
                }

                filterService.addFilterOption(filter.name, {
                    type: filter.filterType || filter.type,
                    ...payload
                });
                this.updateFilterButtonStyle(filter.name, true, values);
            } else {
                filterService.removeFilterOption(filter.name);
                this.updateFilterButtonStyle(filter.name, false);
            }
        };

        inputs.forEach(input => {
            input.addEventListener('input', updateFilter);
            input.addEventListener('change', updateFilter);
        });
    }

    /**
     * 필터 버튼 스타일 업데이트
     */
    updateFilterButtonStyle(filterId, isActive, values = {}) {
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
            document.body.style.overflow = 'auto';
            
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
            document.body.style.overflow = 'auto';
            
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
        
        // 검색창 너비를 기준으로 필터 및 결과 컨테이너 너비 설정
        const searchWrapperWidth = searchWrapper.offsetWidth;
        // 필터 컨테이너 너비를 검색창과 동일하게 설정 (CSS에서 padding으로 여백 조절)
        this.filterContainer.style.width = `${searchWrapperWidth}px`;
        
        // 결과 컨테이너 너비를 검색창과 동일하게 설정
        resultsContainer.style.width = `${searchWrapperWidth}px`;
        
        // 검색 모드인지 확인 (search-container에 search-mode 클래스가 있는지)
        const isSearchMode = document.getElementById('search-container').classList.contains('search-mode');

        if (isSearchMode) {
            // 검색 모드에서는 CSS에 정의된 기본 마진값(130px)을 사용하도록 설정합니다.
            resultsContainer.style.marginTop = '130px';
        } else {
            resultsContainer.style.marginTop = '0px';
        }
    }
}

// 싱글톤 인스턴스 생성 및 내보내기
const filterPanel = new FilterPanel();

export default filterPanel;
