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
export const FILTER_CONFIGS = {
    '공격': { displayName: '최대 공격력', type: 'range', fields: { min: '최소', max: '최대' }, field: 'option_value2' },
    '내구력': { displayName: '최대 내구력', type: 'range', fields: { min: '최소', max: '최대' } },
    '밸런스': { displayName: '밸런스', type: 'range', fields: { min: '최소', max: '최대' }, isPercent: true },
    '방어력': { displayName: '방어력', type: 'range', fields: { min: '최소', max: '최대' } },
    '보호': { displayName: '보호', type: 'range', fields: { min: '최소', max: '최대' } },
    '피어싱 레벨': { displayName: '피어싱 레벨', type: 'range', fields: { min: '최소', max: '최대' } },
    // 전용 해제 옵션이 없는 아이템은 기본 8회로 간주
    '남은 전용 해제 가능 횟수': { displayName: '전해 횟수', type: 'range', fields: { min: '최소', max: '최대' }, defaultValue: 8 },
    '인챈트': { displayName: '인챈트', type: 'enchant' },
    '특별 개조': { displayName: '특별 개조', type: 'special-mod' },
    '에르그': {
        displayName: '에르그',
        type: 'composite',
        fields: [
            { id: 'grade', type: 'track', label: '등급', options: { 'B': 'B', 'A': 'A', 'S': 'S' } },
            { id: 'level', type: 'range', label: '레벨', minId: 'minLevel', maxId: 'maxLevel' }
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

        // 데스크톱 후보 칩 상태
        this.currentAvailableFilters = [];
        this.candidatesExpanded = false;
        this.candidatesExpansionId = 0;

        // 클래스 초기화 상태
        this.initialized = false;

        this.lastIsMobile = window.innerWidth <= 768;

        this.currentMobileValueFilter = null;
        this.currentMobileValueDraft = null;

        // 순수 여백값
        this.RESULTS_GAP = 4;

        this.SEARCH_TO_FILTER_GAP = 8;

        // 칩당 stagger 지연
        this.CANDIDATE_STAGGER_MS = 20;

        // 팝오버-칩 여백
        this.PANEL_GAP = 4;

        // 드래그 상태 (모바일 전용)
        this.isDragging = false;
        this.dragCommitted = false;
        this.startY = 0;
        this.startX = 0;
        this.currentY = 0;
        this.dragTargetElement = null;
        this.dragDisabled = false;
        this.inputBlurSwipeStartY = null;
        this.suppressNextCardClick = false;

        // 목록 페이지 더미 히스토리 존재 여부
        this.mobileFilterSheetHistoryPushed = false;

        // 자체 popstate 재진입 차단
        this.suppressNextPopstate = false;

        // 키보드 노출 중 기준 위치/높이 캐시
        this.mobileSheetBaseRect = null;
        this.DRAG_COMMIT_THRESHOLD = 10;
        this.INPUT_BLUR_SWIPE_THRESHOLD = 12;
        this.CLOSE_THRESHOLD_RATIO = 0.15;

        this.SHEET_OPEN_TRANSITION = 'transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)';
        this.SHEET_DRAG_CLOSE_TRANSITION = 'transform 0.3s ease-out';
        this.SHEET_CLOSE_TRANSITION = 'transform 0.32s cubic-bezier(0.5, 0, 0.75, 0)';

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

        // 이벤트 리스너 설정
        this.setupEventListeners();

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => this.handleViewportResize());
        }

        // 뒤로가기 시 열린 시트/입력 페이지 정리
        window.addEventListener('popstate', () => {
            if (this.suppressNextPopstate) {
                this.suppressNextPopstate = false;
                return;
            }
            if (this.currentMobileValueFilter) {
                this.returnToMobileFilterList(true);
            } else if (this.mobileFilterSheetHistoryPushed) {
                this.closeActiveToast(false, true);
            }
        });

        // 검색 모듈 내 위치 조정
        this.adjustResultsContainerPosition();
        
        // 윈도우 리사이즈 이벤트 처리
        window.addEventListener('resize', () => {
            const isMobile = window.innerWidth <= 768;
            if (isMobile !== this.lastIsMobile) {
                this.lastIsMobile = isMobile;
                this.handleBreakpointCross();
            }
            this.checkFilterRows();

            // 시트 열림 중엔 갱신 보류
            if (document.querySelector('.filter-options.mobile-filter-sheet.active')) return;

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
                        if (!isMobile && this.activeButtonEl) {
                            this.positionDesktopFilterPanel(this.activeButtonEl, panel);
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

            // 오버레이 자체 드래그 핸들러
            overlay.addEventListener('touchstart', (e) => this.handleDragStart(e, this.filterOptions, true), { passive: false });
            overlay.addEventListener('touchmove', (e) => this.handleDragMove(e, this.filterOptions), { passive: false });
            overlay.addEventListener('touchend', (e) => this.handleDragEnd(e, this.filterOptions), { passive: false });
            overlay.addEventListener('touchcancel', () => this.handleDragCancel());
        }

        this.overlay = overlay;
    }
    
    /**
     * 활성 상태인 모바일 시트 닫기
     * @param {boolean} fromDrag
     * @param {boolean} fromPopstate
     */
    closeActiveToast(fromDrag = false, fromPopstate = false) {
        const activePanel = document.querySelector('.filter-panel.active');
        const activeButton = document.querySelector('.filter-btn.active[data-filter]');
        const activeOptions = document.querySelector('.filter-options.active');

        // 패널 닫기
        if (activePanel) {
            this.closeToast(activePanel, fromDrag);
            if (activeButton) {
                activeButton.classList.remove('active');
            }
        }

        // 옵션 메뉴 닫기
        if (activeOptions) {
            this.closeToast(activeOptions, fromDrag);

            if (this.mobileFilterSheetHistoryPushed && activeOptions.classList.contains('mobile-filter-sheet')) {
                this.mobileFilterSheetHistoryPushed = false;
                if (!fromPopstate) {
                    history.back();
                }
            }
        }
    }

    /**
     * 모바일 시트 닫기 애니메이션
     */
    closeToast(element, fromDrag = false) {
        element.style.transition = fromDrag ? this.SHEET_DRAG_CLOSE_TRANSITION : this.SHEET_CLOSE_TRANSITION;
        element.style.transform = 'translateY(100%)';

        let finished = false;
        const finishClose = () => {
            if (finished) return;
            finished = true;
            element.classList.remove('active');
            element.style.transform = '';
            element.style.transition = '';

            if (this.overlay) this.overlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        };

        element.addEventListener('transitionend', finishClose, { once: true });
        setTimeout(finishClose, 340);
    }

    /**
     * 모바일 바텀시트 열기
     * @param {HTMLElement} element
     */
    openMobileSheet(element) {
        element.classList.add('mobile-filter-sheet');
        element.removeAttribute('style');
        this.positionMobileSheetBelowSearch(element);
        element.style.transition = 'none';
        element.style.transform = 'translateY(100%)';

        document.body.style.overflow = 'hidden';

        const slideSheetUp = () => {
            element.style.transition = this.SHEET_OPEN_TRANSITION;
            element.style.transform = 'translateY(0)';
        };

        if (this.overlay) {
            this.overlay.classList.add('active');

            let started = false;
            const onOverlayShown = () => {
                if (started) return;
                started = true;
                slideSheetUp();
            };
            this.overlay.addEventListener('transitionend', onOverlayShown, { once: true });
            setTimeout(onOverlayShown, 155);
        } else {
            slideSheetUp();
        }

        // dragBound로 중복 차단
        setTimeout(() => this.setupDragEvents(element), 420);
    }

    /**
     * 모바일 시트 상단을 검색창 하단에 고정
     * @param {HTMLElement} element
     */
    positionMobileSheetBelowSearch(element) {
        const searchContainer = document.querySelector('.search-container');
        if (!searchContainer) return;

        const top = searchContainer.getBoundingClientRect().bottom;
        element.style.top = `${top}px`;
        element.style.height = 'auto';
    }

    /**
     * 키보드 노출 시 시트 높이/위치 보정
     */
    handleViewportResize() {
        if (window.innerWidth > 768) return;
        if (this.isDragging) return;

        const activeSheet = document.querySelector('.filter-options.mobile-filter-sheet.active');
        if (!activeSheet) return;

        // 포커스 없으면 검색창 기준 재고정
        const focused = activeSheet.querySelector('input:focus, textarea:focus, select:focus');
        if (!focused) {
            this.positionMobileSheetBelowSearch(activeSheet);
            this.mobileSheetBaseRect = null;
            return;
        }

        if (!this.mobileSheetBaseRect) {
            const rect = activeSheet.getBoundingClientRect();
            this.mobileSheetBaseRect = { top: rect.top, height: rect.height };
        }

        const vv = window.visualViewport;
        const keyboardInset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);

        activeSheet.style.transition = `${this.SHEET_OPEN_TRANSITION}, height 0.25s ease`;
        activeSheet.style.top = this.mobileSheetBaseRect.top + 'px';
        activeSheet.style.height = Math.max(0, this.mobileSheetBaseRect.height - keyboardInset) + 'px';

        focused.scrollIntoView({ block: 'nearest' });
    }

    /**
     * 드래그 이벤트 설정 (모바일 전용)
     */
    setupDragEvents(element) {
        if (element.dataset.dragBound) return;
        element.dataset.dragBound = 'true';

        // 손잡이 (시각 요소) 추가
        element.addEventListener('touchstart', (e) => this.handleDragStart(e, element), { passive: false });
        element.addEventListener('touchmove', (e) => this.handleDragMove(e, element), { passive: false });
        element.addEventListener('touchend', (e) => this.handleDragEnd(e, element), { passive: false });
        element.addEventListener('touchcancel', () => this.handleDragCancel());

        // 마우스 이벤트 (데스크톱 테스트용)
        element.addEventListener('mousedown', (e) => this.handleDragStart(e, element));
        document.addEventListener('mousemove', (e) => this.handleDragMove(e, element));
        document.addEventListener('mouseup', (e) => this.handleDragEnd(e, element));

        // 포커스 중 드래그 비활성화 (위임 처리)
        element.addEventListener('focusin', (e) => {
            if (e.target.matches('input, textarea, select')) this.dragDisabled = true;
        });
        element.addEventListener('focusout', (e) => {
            if (e.target.matches('input, textarea, select')) this.dragDisabled = false;
        });
    }
    
    /**
     * 공용 메서드
     */
    handleInputBlurSwipeStart(e) {
        if (window.innerWidth > 768 || !this.dragDisabled) return false;
        this.inputBlurSwipeStartY = e.touches ? e.touches[0].clientY : e.clientY;
        return true;
    }

    /**
     * 위 방향 스와이프 처리
     */
    handleInputBlurSwipeMove(e) {
        if (window.innerWidth > 768 || !this.dragDisabled) return false;
        if (this.inputBlurSwipeStartY === null) return true;
        if (e.cancelable) e.preventDefault();
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        const rawDeltaY = y - this.inputBlurSwipeStartY;
        if (rawDeltaY >= this.INPUT_BLUR_SWIPE_THRESHOLD &&
            document.activeElement && document.activeElement.matches('input, textarea, select')) {
            document.activeElement.blur();
            this.inputBlurSwipeStartY = null;
        }
        return true;
    }

    /**
     * 드래그 시작 (모바일 전용)
     * @param {boolean} forceWholeSheet
     */
    handleDragStart(e, element, forceWholeSheet = false) {
        if (window.innerWidth > 768) return;
        if (this.handleInputBlurSwipeStart(e)) return;
        // 멀티터치 재진입 무시
        if (this.isDragging) return;
        // 바깥 컨테이너는 스크롤 미작동
        const isValueSheetActive = !forceWholeSheet && this.mobileFilterValuePage && this.mobileFilterValuePage.classList.contains('active');
        const scrollableContent = isValueSheetActive ? this.mobileFilterValueContent : this.mobileFilterListContent;
        const touchTarget = e.touches ? e.touches[0].target : e.target;
        if (scrollableContent && scrollableContent.scrollTop > 0 && scrollableContent.contains(touchTarget)) return;

        this.dragTargetElement = isValueSheetActive ? this.mobileFilterValuePage : element;

        this.isDragging = true;
        this.dragCommitted = false;
        this.suppressNextCardClick = false;
        this.startY = e.touches ? e.touches[0].clientY : e.clientY;
        this.startX = e.touches ? e.touches[0].clientX : e.clientX;
        this.currentY = this.startY;

        // 인라인 미적용 시 기본 위치 설정
        const transform = this.dragTargetElement.style.transform;
        const translateY = transform.match(/translateY\(([^)]+)\)/);
        this.initialTranslateY = translateY ? parseFloat(translateY[1]) : 0;
    }
    
    /**
     * 드래그 중 (모바일 전용)
     */
    handleDragMove(e, element) {
        if (window.innerWidth > 768) return;

        // 포커스 중엔 별도 분기
        if (this.handleInputBlurSwipeMove(e)) return;

        if (!this.isDragging) return;

        const target = this.dragTargetElement;
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        const rawDeltaY = y - this.startY;

        if (rawDeltaY > 0 && e.cancelable) {
            e.preventDefault();
        }

        if (!this.dragCommitted) {
            const verticalDelta = Math.abs(rawDeltaY);
            const horizontalDelta = Math.abs(x - this.startX);
            if (verticalDelta < this.DRAG_COMMIT_THRESHOLD || verticalDelta < horizontalDelta) {
                return;
            }
            if (rawDeltaY <= 0) {
                this.isDragging = false;
                return;
            }
            this.dragCommitted = true;
            target.style.transition = 'none';
        }

        this.currentY = y;
        const deltaY = this.currentY - this.startY;
        let newTranslateY = this.initialTranslateY + deltaY;

        newTranslateY = Math.max(0, newTranslateY);
        newTranslateY = Math.min(window.innerHeight, newTranslateY);

        target.style.transform = `translateY(${newTranslateY}px)`;
    }
    
    /**
     * 드래그 종료 (모바일 전용)
     */
    handleDragEnd(e, element) {
        if (!this.isDragging || window.innerWidth > 768) return;

        this.isDragging = false;
        if (!this.dragCommitted) return;
        this.dragCommitted = false;
        // 드래그 후 클릭 무시 플래그
        this.suppressNextCardClick = true;

        const target = this.dragTargetElement;
        const deltaY = this.currentY - this.startY;
        const closeThreshold = window.innerHeight * this.CLOSE_THRESHOLD_RATIO;

        if (deltaY > closeThreshold) {
            target.style.transition = '';
            if (target === this.mobileFilterValuePage) {
                this.returnToMobileFilterList(false, true);
            } else {
                this.closeActiveToast(true);
            }
        } else {
            target.style.transition = this.SHEET_OPEN_TRANSITION;
            target.style.transform = 'translateY(0px)';
        }
    }

    /**
     * 터치 취소 시 복귀
     */
    handleDragCancel() {
        if (this.dragCommitted && this.dragTargetElement) {
            this.dragTargetElement.style.transition = this.SHEET_OPEN_TRANSITION;
            this.dragTargetElement.style.transform = 'translateY(0px)';
        }
        this.isDragging = false;
        this.dragCommitted = false;
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        this.mainFilterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                this.toggleFilterOptions();
            } else {
                this.toggleFilterCandidates();
            }
        });

        // 외부 클릭 시 메뉴/패널 닫기 (캡처링 단계에서 처리)
        document.addEventListener('click', (event) => this.handleOutsideClick(event), true);

        // 필터 이벤트 리스너
        document.addEventListener('filterChanged', (e) => this.handleFilterChanged(e));

        // 위임 리스너 - 모든 칩 공용
        this.filterContainer.addEventListener('click', (event) => {
            const chip = event.target.closest('.filter-btn');
            if (!chip) return;
            chip.classList.remove('chip-click-flash');
            void chip.offsetWidth;
            chip.classList.add('chip-click-flash');
        });
    }

    toggleFilterOptions() {
        const isMobile = window.innerWidth <= 768;
        const wasActive = this.filterOptions.classList.contains('active');

        // 클래스 제거 순서 유지
        if (wasActive) {
            if (isMobile) {
                this.closeActiveToast();
            } else {
                this.filterOptions.classList.remove('active');
                this.filterOptions.classList.remove('mobile-filter-sheet');
                document.body.style.overflow = '';
            }
            document.querySelectorAll('.filter-panel').forEach(panel => panel.classList.remove('active'));
            document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
                if (btn.dataset.filter !== 'main') btn.classList.remove('active');
            });
            return;
        }

        // 열기
        this.filterOptions.classList.add('active');

        if (this.filterOptions.parentNode !== this.filterContainer) {
            this.filterContainer.appendChild(this.filterOptions);
        }

        if (isMobile) {
            if (this.filterOptions.parentNode !== document.body) {
                document.body.appendChild(this.filterOptions);
            }

            // 2단 구조 준비
            this.ensureMobileFilterSheetSkeleton();
            if (this.mobileFilterValuePage) {
                this.mobileFilterValuePage.classList.remove('active');
                this.mobileFilterValuePage.style.transition = '';
                this.mobileFilterValuePage.style.transform = '';
            }
            if (this.mobileFilterValueDim) this.mobileFilterValueDim.classList.remove('active');
            this.currentMobileValueFilter = null;
            this.currentMobileValueDraft = null;
            this.renderMobileFilterSheetList();

            this.openMobileSheet(this.filterOptions);

            history.pushState({ mobileFilterSheetOpen: true }, '');
            this.mobileFilterSheetHistoryPushed = true;
        } else {
            this.filterOptions.classList.remove('mobile-filter-sheet');

            const buttonRect = this.mainFilterBtn.getBoundingClientRect();
            const filterContainerRect = this.filterContainer.getBoundingClientRect();

            this.filterOptions.style.position = 'absolute';

            const buttonLeftInContainer = buttonRect.left - filterContainerRect.left;

            this.filterOptions.style.top = (buttonRect.height + 15) + 'px';
            this.filterOptions.style.left = buttonLeftInContainer + 'px';
            this.filterOptions.style.minWidth = buttonRect.width + 'px';
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
     * 후보 필터 칩 인라인 펼침/접힘 토글 (데스크톱 전용)
     */
    toggleFilterCandidates() {
        if (this.candidatesExpanded) {
            this.collapseFilterCandidates();
        } else {
            this.expandFilterCandidates();
        }
    }

    /**
     * 미적용 필터 (점선 칩) 삽입
     */
    expandFilterCandidates() {
        const activeNames = new Set(
            Array.from(this.filterContainer.querySelectorAll('.filter-btn[data-filter]')).map(btn => btn.dataset.filter)
        );

        const filtersToDisplay = Object.keys(FILTER_CONFIGS).reduce((acc, filterName) => {
            if (this.currentAvailableFilters.includes(filterName) && !activeNames.has(filterName)) {
                const filter = { name: filterName, ...FILTER_CONFIGS[filterName] };
                if (filter.visible !== false) acc.push(filter);
            }
            return acc;
        }, []);

        if (filtersToDisplay.length === 0) return;

        this.candidatesExpanded = true;
        this.updateMainFilterBtnVisibility();

        const expansionId = ++this.candidatesExpansionId;

        filtersToDisplay.forEach((filter, index) => {
            setTimeout(() => {
                if (this.candidatesExpansionId !== expansionId) return;

                const candidate = this.createCandidateChip(filter);
                // "+필터" 칩 바로 앞에 삽입
                this.filterContainer.insertBefore(candidate, this.mainFilterBtn);

                this.checkFilterRows();
                this.adjustResultsContainerPosition();
            }, index * this.CANDIDATE_STAGGER_MS);
        });
    }

    collapseFilterCandidates() {
        this.candidatesExpansionId++;

        const candidates = Array.from(this.filterContainer.querySelectorAll('.filter-btn-candidate'));
        this.candidatesExpanded = false;

        if (candidates.length === 0) {
            this.updateMainFilterBtnVisibility();
        } else {
            // DOM 제거 후에만 "+필터" 표시
            let remaining = candidates.length;
            candidates.forEach(el => {
                el.classList.add('candidate-exiting');
                el.addEventListener('animationend', () => {
                    el.remove();
                    remaining--;
                    if (remaining === 0) {
                        this.updateMainFilterBtnVisibility();
                    }
                    this.checkFilterRows();
                    this.adjustResultsContainerPosition();
                }, { once: true });
            });
        }

        this.checkFilterRows();
        this.adjustResultsContainerPosition();
    }

    /**
     * 후보 없음/펼침 중엔 "+필터" 숨김
     */
    updateMainFilterBtnVisibility() {
        // 모바일은 단일 "필터" 칩 구조
        if (window.innerWidth <= 768) {
            this.mainFilterBtn.style.display = '';
            return;
        }

        const activeNames = new Set(
            Array.from(this.filterContainer.querySelectorAll('.filter-btn[data-filter]')).map(btn => btn.dataset.filter)
        );
        const hasCandidates = this.currentAvailableFilters.some(filterName => {
            const config = FILTER_CONFIGS[filterName];
            return !activeNames.has(filterName) && config && config.visible !== false;
        });

        this.mainFilterBtn.style.display = (hasCandidates && !this.candidatesExpanded) ? '' : 'none';
    }

    createCandidateChip(filter) {
        const candidate = document.createElement('button');
        candidate.type = 'button';
        candidate.className = 'filter-btn filter-btn-candidate';
        candidate.dataset.candidateFilter = filter.name;
        candidate.innerHTML = `<span class="filter-btn-label">${filter.displayName}</span>`;

        candidate.addEventListener('click', (e) => {
            e.stopPropagation();
            candidate.remove();
            this.addAndActivateFilter(filter, false);
        });

        return candidate;
    }

    /**
     * @param {string[]} availableFilters
     */
    async loadFilterOptions(availableFilters = []) {
        try {
            console.log('loadFilterOptions 호출됨, availableFilters:', availableFilters);

            this.currentAvailableFilters = availableFilters;

            // 새 결과 도착 시 펼침 상태 접음
            if (this.candidatesExpanded) {
                this.collapseFilterCandidates();
            }

            this.updateMainFilterBtnVisibility();

            if (window.innerWidth <= 768) {
                this.renderMobileFilterSheetList();
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
     * @param {object} filter - 필터 설정 객체
     * @param {boolean} activatePanel
     */
    addAndActivateFilter(filter, activatePanel = true) {
        const existingBtn = document.querySelector(`.filter-btn[data-filter="${filter.name}"]`);
        if (existingBtn) {
            if (activatePanel) {
                this.activateFilterButton(existingBtn, filter.name);
            }
            return;
        }

        this.addFilterPanel(filter);
        const newBtn = this.addFilterButton(filter);

        if (activatePanel) {
            this.activateFilterButton(newBtn, filter.name);
        }

        this.updateMainFilterBtnVisibility();
    }

    /**
     * @param {HTMLElement} button - 활성화할 필터 버튼 요소
     * @param {string} filterId - 필터 ID
     */
    activateFilterButton(button, filterId) {

        // 재클릭 시 토글 닫기
        const targetPanelId = `filter-panel-${filterId.replace(/\s/g, '')}`;
        const targetPanel = document.getElementById(targetPanelId);
        if (button.classList.contains('active') && targetPanel && targetPanel.classList.contains('active')) {
            this.closeDesktopPanel(targetPanel, button);
            this.activePanel = null;
            this.activeButtonEl = null;
            return;
        }

        // 모든 버튼 비활성화
        document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
            if (btn.dataset.filter !== 'main') {
                btn.classList.remove('active');
            }
        });

        document.querySelectorAll('.filter-panel.active').forEach(panel => {
            this.closeDesktopPanel(panel);
        });

        // 선택한 버튼 활성화
        button.classList.add('active');

        // 해당 패널 열기
        const panel = targetPanel;
        if (panel) {
            // 패널을 항상 filterPanels 컨테이너 내부에 배치
            if (panel.parentNode !== this.filterPanels) {
                this.filterPanels.appendChild(panel);
            }

            // 재클릭 시 예약된 종료 무효화
            this.cancelPanelClose(panel);

            // 패널 활성화
            panel.classList.add('active');
            this.activePanel = filterId;
            this.activeButtonEl = button;

            panel.style.position = 'absolute';
            panel.style.zIndex = '90';
            this.positionDesktopFilterPanel(button, panel);

            panel.querySelectorAll('.condition-segment').forEach(seg => {
                this.positionSegmentIndicator(seg, seg.querySelector('.segment-btn.active'));
            });
        }
    }

    /**
     * 패널 좌표를 필터 패널 컨테이너 기준으로 변환
     * @param {HTMLElement} button - 기준이 되는 필터 칩 버튼
     * @param {HTMLElement} panel - 위치를 계산할 필터 패널
     */
    positionDesktopFilterPanel(button, panel) {
        const buttonRect = button.getBoundingClientRect();

        const prevVisibility = panel.style.visibility;
        panel.style.visibility = 'hidden';
        panel.style.right = 'auto';
        panel.style.margin = '0';
        const panelWidth = panel.offsetWidth;

        const panelsRect = this.filterPanels.getBoundingClientRect();

        const overflowsRight = buttonRect.left + panelWidth > window.innerWidth;
        const left = overflowsRight
            ? (buttonRect.right - panelWidth) - panelsRect.left
            : buttonRect.left - panelsRect.left;
        const top = buttonRect.bottom - panelsRect.top + this.PANEL_GAP;

        panel.style.top = Math.round(top) + 'px';
        panel.style.left = Math.round(left) + 'px';
        panel.style.visibility = prevVisibility || 'visible';
    }

    /**
     * 데스크톱 팝오버 닫힘 - 모든 경로 공유
     * @param {HTMLElement} panel
     * @param {HTMLElement|null} button
     * @param {boolean} destroy - true면 닫힘 후 패널 DOM 자체를 제거(필터 삭제 시 재생성 대비 입력값 잔존 방지)
     */
    closeDesktopPanel(panel, button = null, destroy = false) {
        if (!panel) return;
        if (!panel.classList.contains('active')) {
            if (destroy) panel.remove();
            return;
        }
        const token = (panel._closeToken = (panel._closeToken || 0) + 1);

        panel.classList.add('closing');
        if (button) button.classList.remove('active');

        const finishClose = () => {
            if (panel._closeToken !== token) return; // 재오픈으로 무효화
            if (destroy) {
                panel.remove();
            } else {
                panel.classList.remove('active', 'closing');
            }
        };

        panel.addEventListener('animationend', finishClose, { once: true });
        setTimeout(finishClose, 120);
    }

    /**
     * 열기 경로 진입 시 항상 먼저 호출
     */
    cancelPanelClose(panel) {
        panel._closeToken = (panel._closeToken || 0) + 1;
        panel.classList.remove('closing');
    }

    /**
     * 필터 삭제
     */
    removeFilter(filterId) {
        const panelId = `filter-panel-${filterId.replace(/\s/g, '')}`;
        const panel = document.getElementById(panelId);

        // 패널이 활성화되어 있으면 바디 오버플로우 복원
        if (panel && panel.classList.contains('active')) {
            document.body.style.overflow = '';
        }

        // 버튼 제거
        const filterBtn = document.querySelector(`.filter-btn[data-filter="${filterId}"]`);
        if (filterBtn) {
            filterBtn.remove();
        }

        if (panel) {
            this.closeDesktopPanel(panel, null, true);
        }

        // 필터 삭제
        filterService.removeFilterOption(filterId);

        // 칩 색상 갱신 및 시트 목록 갱신
        this.updateMobileFilterChipStyle();
        if (window.innerWidth <= 768 && this.filterOptions.classList.contains('active')) {
            this.renderMobileFilterSheetList();
        }

        // 삭제된 항목만 재삽입
        if (this.candidatesExpanded && this.currentAvailableFilters.includes(filterId)) {
            const config = FILTER_CONFIGS[filterId];
            if (config && config.visible !== false) {
                const configKeys = Object.keys(FILTER_CONFIGS);
                const filterIndex = configKeys.indexOf(filterId);
                const nextCandidate = Array.from(this.filterContainer.querySelectorAll('.filter-btn-candidate'))
                    .find(el => configKeys.indexOf(el.dataset.candidateFilter) > filterIndex);
                const candidateChip = this.createCandidateChip({ name: filterId, ...config });
                this.filterContainer.insertBefore(candidateChip, nextCandidate || this.mainFilterBtn);
            }
        }

        this.updateMainFilterBtnVisibility();
        this.checkFilterRows();
        this.adjustResultsContainerPosition();
        setTimeout(() => this.adjustResultsContainerPosition(), 0);
    }

    /**
     * 필터 UI 전체 초기화
     */
    resetAllFilterUI() {
        document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
            const filterId = btn.dataset.filter;
            const panelId = `filter-panel-${filterId.replace(/\s/g, '')}`;
            const panel = document.getElementById(panelId);

            if (panel && panel.classList.contains('active')) {
                document.body.style.overflow = '';
            }
            if (panel) {
                this.closeDesktopPanel(panel, null, true);
            }

            btn.remove();
        });

        if (this.candidatesExpanded) {
            this.collapseFilterCandidates();
        }

        this.updateMobileFilterChipStyle();
        if (window.innerWidth <= 768 && this.filterOptions.classList.contains('active')) {
            this.renderMobileFilterSheetList();
        }

        this.updateMainFilterBtnVisibility();
        this.checkFilterRows();
        this.adjustResultsContainerPosition();
    }

    /**
     * 필터 컨테이너가 다층으로 표시되는지 확인
     */
    checkFilterRows() {
        if (!this.filterContainer) return false;

        // 후보 칩도 개수에 포함
        const filterButtons = this.filterContainer.querySelectorAll(':scope > .filter-btn');
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
            <span class="filter-btn-label">${filter.displayName}</span>
            <span class="filter-remove" data-filter="${filter.name}" title="필터 삭제">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </span>
        `;
        
        // 클릭 이벤트 추가
        newButton.addEventListener('click', (event) => {
            // 삭제 버튼 클릭 시 이벤트 버블링 차단
            if (event.target.classList.contains('filter-remove')) {
                return;
            }
            
            // 버튼 활성화 및 패널 열기
            this.activateFilterButton(newButton, filter.name);
        });
        
        // 적용된 칩은 항상 후보/+필터보다 앞에 위치
        const firstCandidate = this.filterContainer.querySelector('.filter-btn-candidate');
        this.filterContainer.insertBefore(newButton, firstCandidate || this.mainFilterBtn);

        // 삭제 버튼 이벤트 추가
        const removeBtn = newButton.querySelector('.filter-remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                this.removeFilter(filter.name);
            });
        }
        
        this.checkFilterRows();
        this.adjustResultsContainerPosition();
        this.adjustResultsContainerPosition();

        return newButton;
    }

    /**
     * 목록 페이지 생성 전에도 호출 가능
     */
    updateMobileFilterChipStyle() {
        const count = filterService.getFilters().activeFilters.length;
        // 모바일 전용 칩 강조
        const isMobile = window.innerWidth <= 768;
        this.mainFilterBtn.classList.toggle('filtered', isMobile && count > 0);

        const title = this.filterOptions.querySelector('.mobile-filter-list-title');
        if (title) title.textContent = count === 0 ? '필터 없음' : `필터 ${count}개`;
    }

    /**
     * 모바일 필터 목록 페이지/입력 페이지 캐싱
     */
    ensureMobileFilterSheetSkeleton() {
        if (this.mobileFilterTrack) return;

        this.filterOptions.innerHTML = `
            <div class="mobile-filter-track">
                <div class="mobile-filter-page mobile-filter-page--list">
                    <div class="mobile-filter-handle"></div>
                    <div class="mobile-filter-list-header">
                        <span class="mobile-filter-list-title">필터</span>
                    </div>
                    <div class="mobile-filter-list-content"></div>
                </div>
                <div class="mobile-filter-value-dim"></div>
                <div class="mobile-filter-page mobile-filter-page--value">
                    <div class="mobile-filter-handle"></div>
                    <div class="mobile-filter-value-header">
                        <button type="button" class="mobile-filter-delete" disabled>삭제</button>
                        <span class="mobile-filter-value-title">세부 설정</span>
                        <button type="button" class="mobile-filter-done" disabled>완료</button>
                    </div>
                    <div class="mobile-filter-value-content"></div>
                </div>
            </div>
        `;

        this.mobileFilterTrack = this.filterOptions.querySelector('.mobile-filter-track');
        this.mobileFilterListContent = this.filterOptions.querySelector('.mobile-filter-list-content');
        this.mobileFilterValuePage = this.filterOptions.querySelector('.mobile-filter-page--value');
        this.mobileFilterValueDim = this.filterOptions.querySelector('.mobile-filter-value-dim');
        this.mobileFilterValueContent = this.filterOptions.querySelector('.mobile-filter-value-content');
        this.mobileFilterDeleteBtn = this.filterOptions.querySelector('.mobile-filter-delete');
        this.mobileFilterDoneBtn = this.filterOptions.querySelector('.mobile-filter-done');

        this.mobileFilterDoneBtn.addEventListener('click', () => this.commitMobileFilterValue());
        this.mobileFilterDeleteBtn.addEventListener('click', () => this.clearMobileFilterValue());
    }

    /**
     * 목록 페이지 렌더
     */
    renderMobileFilterSheetList() {
        this.ensureMobileFilterSheetSkeleton();
        this.updateMobileFilterChipStyle();

        const appliedNames = new Set(filterService.getFilters().activeFilters.map(f => f.name));
        const applied = [];
        const candidates = [];
        Object.keys(FILTER_CONFIGS).forEach(name => {
            const config = FILTER_CONFIGS[name];
            if (!config || config.visible === false) return;
            if (appliedNames.has(name)) {
                applied.push({ name, ...config });
            } else if (this.currentAvailableFilters.includes(name)) {
                candidates.push({ name, ...config });
            }
        });

        const optionsContent = document.createElement('div');
        optionsContent.className = 'options-content';

        if (applied.length === 0 && candidates.length === 0) {
            optionsContent.innerHTML = '<div class="filter-option-none">사용 가능한 필터가 없습니다.</div>';
        } else {
            const listCard = document.createElement('div');
            listCard.className = 'filter-option-list';
            applied.forEach(f => listCard.appendChild(this.createMobileFilterListItem(f, true)));
            candidates.forEach(f => listCard.appendChild(this.createMobileFilterListItem(f, false)));
            optionsContent.appendChild(listCard);
        }

        this.mobileFilterListContent.innerHTML = '';
        this.mobileFilterListContent.appendChild(optionsContent);
    }

    /**
     * 목록 페이지 항목
     * @param {object} filter
     * @param {boolean} isApplied
     */
    createMobileFilterListItem(filter, isApplied) {
        const item = document.createElement('div');
        item.className = 'filter-option' + (isApplied ? ' filter-option--applied' : '');
        item.dataset.filter = filter.name;

        item.innerHTML = `
            <span class="filter-option-label">${filter.displayName}</span>
            <svg class="filter-option-arrow" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 6 15 12 9 18"></polyline>
            </svg>
        `;

        item.addEventListener('click', () => {
            if (this.suppressNextCardClick) {
                this.suppressNextCardClick = false;
                return;
            }
            this.openMobileFilterValueSheet(filter);
        });
        return item;
    }

    /**
     * 모바일 필터 값 입력 카드 생성
     * @param {object} filter
     */
    buildMobileFilterValueMarkup(filter) {
        const wrapper = document.createElement('div');
        wrapper.className = 'mobile-filter-value-panel';
        this.createDesktopPanelUI(wrapper, filter);
        return wrapper;
    }

    /**
     * 입력 화면 동작 연결
     * @param {HTMLElement} wrapper
     * @param {object} filter
     * @returns {{getDraft: () => {hasValue: boolean, payload: object|null}}}
     */
    wireMobileFilterValueForm(wrapper, filter) {
        const filterId = filter.name.replace(/\s/g, '');
        const draft = { hasValue: false, payload: null };

        const isApplied = filterService.getFilters().activeFilters.some(f => f.name === filter.name);

        const notify = () => this.updateMobileValueSheetButtons(draft.hasValue, isApplied);

        const readRangeInputs = (idAttr, minKey, maxKey) => {
            const get = (key) => idAttr === 'data-id' ? wrapper.querySelector(`[data-id="${key}"]`) : wrapper.querySelector(`#${key}`);
            const minEl = get(minKey);
            const maxEl = get(maxKey);
            return { min: minEl ? minEl.value.trim() : '', max: maxEl ? maxEl.value.trim() : '' };
        };

        switch (filter.type) {
            case 'range': {
                const minKey = `${filterId}-min`;
                const maxKey = `${filterId}-max`;
                const onUpdate = () => {
                    const { min, max } = readRangeInputs('id', minKey, maxKey);
                    draft.hasValue = !!(min || max);
                    draft.payload = draft.hasValue ? { ...filter, min, max } : null;
                    notify();
                };
                this.setupConditionalRangeEvents(wrapper, filterId, minKey, maxKey, 'id', onUpdate);
                break;
            }
            case 'enchant': {
                const prefixEl = wrapper.querySelector(`#${filterId}-prefix`);
                const suffixEl = wrapper.querySelector(`#${filterId}-suffix`);
                const onUpdate = () => {
                    const prefix = prefixEl ? prefixEl.value.trim() : '';
                    const suffix = suffixEl ? suffixEl.value.trim() : '';
                    draft.hasValue = !!(prefix || suffix);
                    draft.payload = draft.hasValue ? { type: 'enchant', prefixEnchant: prefix, suffixEnchant: suffix } : null;
                    notify();
                };
                if (prefixEl) {
                    prefixEl.addEventListener('input', () => { this.syncClearVisibility(prefixEl); onUpdate(); });
                    this.attachClearButton(prefixEl);
                }
                if (suffixEl) {
                    suffixEl.addEventListener('input', () => { this.syncClearVisibility(suffixEl); onUpdate(); });
                    this.attachClearButton(suffixEl);
                }
                break;
            }
            case 'special-mod': {
                const typeSelector = wrapper.querySelector(`#${filterId}-type-selector`);
                const typeInput = wrapper.querySelector(`#${filterId}-type`);
                const minKey = `${filterId}-min-level`;
                const maxKey = `${filterId}-max-level`;
                const onUpdate = () => {
                    const modType = typeInput ? typeInput.value : '';
                    const { min: minLevel, max: maxLevel } = readRangeInputs('id', minKey, maxKey);
                    draft.hasValue = !!(modType || minLevel !== '' || maxLevel !== '');
                    draft.payload = draft.hasValue ? { type: 'special-mod', modType, minLevel, maxLevel } : null;
                    notify();
                };
                if (typeSelector && typeInput) {
                    this.setupModTypeIndicator(typeSelector, (btn) => {
                        typeInput.value = btn ? btn.dataset.type : '';
                        onUpdate();
                    });
                }
                this.setupConditionalRangeEvents(wrapper, `${filterId}-level`, minKey, maxKey, 'id', onUpdate);
                break;
            }
            case 'composite': {
                const groupPrefix = filterId;
                const onUpdate = () => {
                    const values = {};
                    let hasValue = false;
                    wrapper.querySelectorAll('[data-id]').forEach(input => {
                        const v = input.value.trim();
                        if (v) hasValue = true;
                        values[input.dataset.id] = v;
                    });
                    draft.hasValue = hasValue;
                    if (!hasValue) {
                        draft.payload = null;
                        notify();
                        return;
                    }
                    let payload = { ...values };
                    if (filter.payloadKey) {
                        const nested = {};
                        filter.fields.forEach(field => {
                            if (field.type === 'text') nested[field.id] = values[field.id];
                            if (field.type === 'range') {
                                nested[field.minId] = values[field.minId];
                                nested[field.maxId] = values[field.maxId];
                            }
                        });
                        payload = { [filter.payloadKey]: [nested] };
                    }
                    draft.payload = { type: filter.filterType || filter.type, ...payload };
                    notify();
                };

                wrapper.querySelectorAll('.special-mod-type-selector[data-track-for]').forEach(selector => {
                    const fieldId = selector.dataset.trackFor;
                    const hiddenInput = wrapper.querySelector(`input[type="hidden"][data-id="${fieldId}"]`);
                    if (!hiddenInput) return;
                    this.setupModTypeIndicator(selector, (btn) => {
                        hiddenInput.value = btn ? btn.dataset.value : '';
                        onUpdate();
                    });
                });

                const rangeFieldIds = new Set();
                filter.fields.forEach(field => {
                    if (field.type !== 'range') return;
                    rangeFieldIds.add(field.minId);
                    rangeFieldIds.add(field.maxId);
                    this.setupConditionalRangeEvents(wrapper, `${groupPrefix}-${field.id}`, field.minId, field.maxId, 'data-id', onUpdate);
                });

                wrapper.querySelectorAll('[data-id]').forEach(input => {
                    if (rangeFieldIds.has(input.dataset.id)) return;
                    input.addEventListener('input', () => { this.syncClearVisibility(input); onUpdate(); });
                    input.addEventListener('change', onUpdate);
                    this.attachClearButton(input);
                });
                break;
            }
        }

        return { getDraft: () => draft };
    }

    /**
     * 입력 페이지 진입 시 저장된 값 사용
     * @param {HTMLElement} wrapper
     * @param {object} filter
     */
    populateMobileFilterValueForm(wrapper, filter) {
        const stored = filterService.getFilters().activeFilters.find(f => f.name === filter.name);
        if (!stored) return;

        const filterId = filter.name.replace(/\s/g, '');

        const setRangeGroup = (groupId, idAttr, minKey, maxKey, minVal, maxVal) => {
            const segment = wrapper.querySelector(`.condition-segment[data-group="${groupId}"]`);
            if (!segment) return;
            const mode = (minVal && maxVal) ? 'range' : (maxVal ? 'lte' : 'gte');
            const targetBtn = segment.querySelector(`.segment-btn[data-mode="${mode}"]`);
            if (targetBtn && !targetBtn.classList.contains('active')) {
                targetBtn.click();
            }
            const get = (key) => idAttr === 'data-id'
                ? wrapper.querySelector(`.condition-inputs[data-group="${groupId}"] [data-id="${key}"]`)
                : wrapper.querySelector(`.condition-inputs[data-group="${groupId}"] #${key}`);
            const minEl = get(minKey);
            const maxEl = get(maxKey);
            if (minEl && minVal) minEl.value = minVal;
            if (maxEl && maxVal) maxEl.value = maxVal;
        };

        switch (filter.type) {
            case 'range':
                setRangeGroup(filterId, 'id', `${filterId}-min`, `${filterId}-max`, stored.min, stored.max);
                break;
            case 'enchant': {
                const prefixEl = wrapper.querySelector(`#${filterId}-prefix`);
                const suffixEl = wrapper.querySelector(`#${filterId}-suffix`);
                if (prefixEl) prefixEl.value = stored.prefixEnchant || '';
                if (suffixEl) suffixEl.value = stored.suffixEnchant || '';
                break;
            }
            case 'special-mod': {
                const typeInput = wrapper.querySelector(`#${filterId}-type`);
                if (typeInput && stored.modType) {
                    const btn = wrapper.querySelector(`#${filterId}-type-selector .mod-type-btn[data-type="${stored.modType}"]`);
                    if (btn) btn.click();
                }
                setRangeGroup(`${filterId}-level`, 'id', `${filterId}-min-level`, `${filterId}-max-level`, stored.minLevel, stored.maxLevel);
                break;
            }
            case 'composite': {
                const groupPrefix = filterId;
                let flatValues = stored;
                if (filter.payloadKey && stored[filter.payloadKey] && stored[filter.payloadKey][0]) {
                    flatValues = stored[filter.payloadKey][0];
                }
                filter.fields.forEach(field => {
                    if (field.type === 'text' || field.type === 'select') {
                        const el = wrapper.querySelector(`[data-id="${field.id}"]`);
                        if (el) el.value = flatValues[field.id] || '';
                    } else if (field.type === 'track') {
                        const val = flatValues[field.id];
                        if (val) {
                            const btn = wrapper.querySelector(`.special-mod-type-selector[data-track-for="${field.id}"] .mod-type-btn[data-value="${val}"]`);
                            if (btn) btn.click();
                        }
                    } else if (field.type === 'range') {
                        setRangeGroup(`${groupPrefix}-${field.id}`, 'data-id', field.minId, field.maxId, flatValues[field.minId], flatValues[field.maxId]);
                    }
                });
                break;
            }
        }
    }

    /**
     * 입력 페이지 열기
     * @param {object} filter
     */
    openMobileFilterValueSheet(filter) {
        this.ensureMobileFilterSheetSkeleton();

        const wrapper = this.buildMobileFilterValueMarkup(filter);
        this.mobileFilterValueContent.innerHTML = '';
        this.mobileFilterValueContent.appendChild(wrapper);

        const { getDraft } = this.wireMobileFilterValueForm(wrapper, filter);
        this.populateMobileFilterValueForm(wrapper, filter);

        wrapper.querySelectorAll('input, select').forEach(el => {
            el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input'));
        });

        this.currentMobileValueFilter = filter;
        this.currentMobileValueDraft = getDraft;

        const page = this.mobileFilterValuePage;
        page.classList.add('active');
        page.style.transition = 'none';
        page.style.transform = 'translateY(100%)';

        const dim = this.mobileFilterValueDim;
        const slidePageUp = () => {
            page.style.transition = this.SHEET_OPEN_TRANSITION;
            page.style.transform = 'translateY(0)';
        };

        if (dim) {
            dim.classList.add('active');

            let started = false;
            const onDimShown = () => {
                if (started) return;
                started = true;
                slidePageUp();
            };
            dim.addEventListener('transitionend', onDimShown, { once: true });
            setTimeout(onDimShown, 155);
        } else {
            slidePageUp();
        }

        history.pushState({ mobileFilterValueSheet: true }, '');
    }

    /**
     * 값 입력 페이지를 아래로 내려 숨김
     * @param {boolean} fromDrag
     */
    closeMobileValueLayer(fromDrag = false) {
        const el = this.mobileFilterValuePage;
        if (!el) return;

        el.style.transition = fromDrag ? this.SHEET_DRAG_CLOSE_TRANSITION : this.SHEET_CLOSE_TRANSITION;
        el.style.transform = 'translateY(100%)';

        let finished = false;
        const finishClose = () => {
            if (finished) return;
            finished = true;
            el.classList.remove('active');
            el.style.transform = '';
            el.style.transition = '';
            if (this.mobileFilterValueDim) this.mobileFilterValueDim.classList.remove('active');
        };

        el.addEventListener('transitionend', finishClose, { once: true });
        setTimeout(finishClose, 340);
    }

    /**
     * 완료 버튼은 입력값 유무, 삭제 버튼은 적용 여부로 활성화 결정
     * @param {boolean} hasValue
     * @param {boolean} isApplied
     */
    updateMobileValueSheetButtons(hasValue, isApplied) {
        if (!this.mobileFilterDeleteBtn || !this.mobileFilterDoneBtn) return;
        this.mobileFilterDeleteBtn.disabled = !isApplied;
        this.mobileFilterDoneBtn.disabled = !hasValue;
        this.mobileFilterDoneBtn.classList.toggle('mobile-filter-done--active', hasValue);
    }

    /**
     * 값 입력 화면 닫고 목록으로 복귀
     * @param {boolean} fromPopstate
     * @param {boolean} fromDrag
     */
    returnToMobileFilterList(fromPopstate = false, fromDrag = false) {
        const wasOpen = !!this.currentMobileValueFilter;
        if (wasOpen) this.closeMobileValueLayer(fromDrag);
        this.currentMobileValueFilter = null;
        this.currentMobileValueDraft = null;

        if (!fromPopstate && wasOpen) {
            this.suppressNextPopstate = true;
            history.back();
        }
    }

    /**
     * 입력값 필터 적용
     */
    commitMobileFilterValue() {
        const filter = this.currentMobileValueFilter;
        const draft = this.currentMobileValueDraft ? this.currentMobileValueDraft() : null;
        if (!filter || !draft || !draft.hasValue) return;

        filterService.addFilterOption(filter.name, draft.payload);

        if (!document.querySelector(`.filter-btn[data-filter="${filter.name}"]`)) {
            this.addFilterButton(filter);
        }
        this.updateFilterButtonStyle(filter.name, true, draft.payload);

        this.returnToMobileFilterList();
        this.renderMobileFilterSheetList();
    }

    /**
     * 필터 삭제
     */
    clearMobileFilterValue() {
        const filter = this.currentMobileValueFilter;
        if (!filter) return;

        if (document.querySelector(`.filter-btn[data-filter="${filter.name}"]`)) {
            this.removeFilter(filter.name);
        }

        this.returnToMobileFilterList();
        this.renderMobileFilterSheetList();
    }

    /**
     * 화면 크기 전환 시 열린 필터 UI 즉시 닫음
     */
    handleBreakpointCross() {
        if (this.filterOptions.classList.contains('active')) {
            this.filterOptions.classList.remove('active', 'mobile-filter-sheet');
            this.filterOptions.removeAttribute('style');
            document.body.style.overflow = '';
            if (this.overlay) this.overlay.classList.remove('active');
            this.returnToMobileFilterList();

            if (this.mobileFilterSheetHistoryPushed) {
                this.mobileFilterSheetHistoryPushed = false;
                history.back();
            }
        }

        document.querySelectorAll('.filter-panel.active').forEach(panel => {
            panel.classList.remove('active', 'closing');
            panel.removeAttribute('style');
        });
        this.activePanel = null;
        this.activeButtonEl = null;

        document.querySelectorAll('.filter-btn.active[data-filter]').forEach(btn => btn.classList.remove('active'));

        // 전환 시점에 메인 버튼 강조 갱신
        this.updateMobileFilterChipStyle();
    }

    addFilterPanel(filter) {
        const existingPanel = document.getElementById(`filter-panel-${filter.name}`);
        if (existingPanel) {
            return existingPanel;
        }

        const panel = document.createElement('div');
        panel.className = 'filter-panel';
        panel.id = `filter-panel-${filter.name.replace(/\s/g, '')}`;

        this.createDesktopPanelUI(panel, filter);
        this.setupFilterEventListeners(panel, filter, false);

        this.filterPanels.appendChild(panel);

        return panel;
    }

    /**
     * 필터 패널 UI 생성
     */
    createDesktopPanelUI(panel, filter) {
        panel.innerHTML = '';

        panel.classList.toggle('filter-panel--popover', ['range', 'special-mod', 'composite', 'enchant'].includes(filter.type));

        if (filter.type === 'special-mod' || filter.type === 'composite' || filter.type === 'enchant' || filter.type === 'range') {
            const filterContent = document.createElement('div');
            if (filter.type === 'special-mod') filterContent.innerHTML = this.createSpecialModFilterUI(filter);
            if (filter.type === 'composite') filterContent.innerHTML = this.createCompositeFilterUI(filter);
            if (filter.type === 'enchant') filterContent.innerHTML = this.createEnchantFilterUI(filter);
            if (filter.type === 'range') filterContent.innerHTML = this.createRangeFilterUI(filter);
            panel.appendChild(filterContent);
        } else {
            // 단일 그룹 사용 필터
            const filterContent = document.createElement('div');
            filterContent.className = 'filter-group filter-group--stacked';
            if (filter.type === 'selection' || filter.type === 'select') filterContent.innerHTML = this.createSelectionFilterUI(filter);
            else filterContent.innerHTML = '<p>지원되지 않는 필터 유형입니다.</p>';
            panel.appendChild(filterContent);
        }
    }

    attachNumericInputGuards(root) {
        root.querySelectorAll('input[type="text"].range-input[data-numeric]').forEach(input => {
            input.addEventListener('input', () => {
                const cleaned = input.value.replace(/[^0-9.]/g, '');
                const dotIndex = cleaned.indexOf('.');
                input.value = dotIndex === -1
                    ? cleaned
                    : cleaned.slice(0, dotIndex + 1) + cleaned.slice(dotIndex + 1).replace(/\./g, '');
            });
        });
    }

    /**
     * .range-input-wrap 하위 X버튼 마크업 (range/text 계열 입력창 공용)
     */
    renderClearButtonHTML() {
        return `
            <button type="button" class="range-input-clear" tabindex="-1" aria-label="입력값 지우기">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
    }

    /**
     * 값 유무에 따라 X버튼 표시 토글
     */
    syncClearVisibility(input) {
        const wrap = input.closest('.range-input-wrap');
        const clearBtn = wrap ? wrap.querySelector('.range-input-clear') : null;
        if (clearBtn) clearBtn.classList.toggle('visible', input.value.trim() !== '');
    }

    /**
     * X버튼 클릭 시 입력값 초기화 - 기존 input 리스너로 위임
     */
    attachClearButton(input) {
        const wrap = input.closest('.range-input-wrap');
        const clearBtn = wrap ? wrap.querySelector('.range-input-clear') : null;
        if (!clearBtn) return;
        clearBtn.addEventListener('click', () => {
            input.value = '';
            input.dispatchEvent(new Event('input'));
        });
    }

    /**
     * 복합 필터 UI
     */
    createCompositeFilterUI(filter) {
        const groupPrefix = filter.name.replace(/\s/g, '');

        // 팝오버/입력 페이지 전용 축약 라벨
        const desktopFieldLabels = {
            'erg': { grade: '에르그 등급', level: '에르그 레벨' },
            'reforge-option': { name: '세공 이름', level: '세공 레벨' },
            'set-effect': { value: '강화 수치' }
        }[filter.filterType] || {};
        const fieldLabel = (field) => desktopFieldLabels[field.id] || field.label;

        return filter.fields.map(field => {
            if (field.type === 'range') {
                return this.createConditionalRangeGroupHTML(fieldLabel(field), `${groupPrefix}-${field.id}`, 'data-id', field.minId, field.maxId);
            }
            if (field.type === 'track') {
                // 특별개조 타입 선택 컴포넌트 재사용
                const buttons = Object.entries(field.options)
                    .map(([value, label]) => `<button type="button" class="mod-type-btn" data-value="${value}">${label}</button>`)
                    .join('');
                return `
                    <div class="filter-group filter-group--stacked">
                        <label class="filter-label">${fieldLabel(field)}</label>
                        <div class="special-mod-type-selector" data-track-for="${field.id}">${buttons}</div>
                        <input type="hidden" data-id="${field.id}" value="">
                    </div>
                `;
            }
            const textInputId = `${groupPrefix}-${field.id}`;
            let fieldHtml = `<div class="filter-group filter-group--stacked"><label class="filter-label"${field.type === 'text' ? ` for="${textInputId}"` : ''}>${fieldLabel(field)}</label>`;
            if (field.type === 'text') {
                fieldHtml += `<div class="range-input-wrap"><input type="text" class="range-input" autocomplete="off" data-id="${field.id}" id="${textInputId}">${this.renderClearButtonHTML()}</div>`;
            } else if (field.type === 'select') {
                const optionsHtml = Object.entries(field.options).map(([value, text]) => `<option value="${value}">${text}</option>`).join('');
                fieldHtml += `<select class="dropdown-select" data-id="${field.id}">${optionsHtml}</select>`;
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
            case 'special-mod': this.setupSpecialModFilterEvents(panel, filter); break;
            case 'composite':
                this.setupCompositeFilterEvents(panel, filter);
                break;
        }
    }
    
    /**
     * 범위 필터 UI 생성
     */
    createRangeFilterUI(filter, isMobile = false) {
        const filterId = filter.name.replace(/\s/g, '');
        return this.createConditionalRangeGroupHTML(filter.displayName, filterId, 'id', `${filterId}-min`, `${filterId}-max`);
    }

    /**
     * 이상/이하/범위 세그먼트
     * @param {string} label
     * @param {string} groupId
     * @param {string} idAttr
     * @param {string} minKey
     * @param {string} maxKey
     */
    createConditionalRangeGroupHTML(label, groupId, idAttr, minKey, maxKey) {
        const primaryInputId = idAttr === 'data-id' ? `${groupId}-${minKey}` : minKey;
        return `
            <div class="filter-group filter-group--conditional">
                <div class="condition-row">
                    <label class="filter-label" for="${primaryInputId}">${label}</label>
                    <div class="condition-segment" data-group="${groupId}">
                        <span class="segment-indicator"></span>
                        <button type="button" class="segment-btn active" data-mode="gte">이상</button>
                        <button type="button" class="segment-btn" data-mode="lte">이하</button>
                        <button type="button" class="segment-btn" data-mode="range">범위</button>
                    </div>
                </div>
                <div class="condition-inputs" data-group="${groupId}">
                    ${this.renderConditionInputsHTML('gte', idAttr, minKey, maxKey, groupId)}
                </div>
            </div>
        `;
    }

    /**
     * 이상/이하/범위 조건에 맞춰 입력창 생성
     * @param {string} mode
     * @param {string} idAttr
     * @param {string} minKey
     * @param {string} maxKey
     * @param {string} [groupId]
     */
    renderConditionInputsHTML(mode, idAttr, minKey, maxKey, groupId) {
        const attr = (key) => idAttr === 'data-id' ? `data-id="${key}" id="${groupId}-${key}"` : `id="${key}"`;
        const field = (key, extraClass = '') => `
            <div class="range-input-wrap${extraClass}">
                <input type="text" inputmode="decimal" data-numeric="true" autocomplete="off" class="range-input" ${attr(key)}>
                ${this.renderClearButtonHTML()}
            </div>
        `;

        if (mode === 'gte') return `<div class="range-filter">${field(minKey)}</div>`;
        if (mode === 'lte') return `<div class="range-filter">${field(maxKey)}</div>`;
        return `<div class="range-filter">${field(minKey)}<span class="range-separator range-field-enter">~</span>${field(maxKey, ' range-field-enter')}</div>`;
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
     * 인챈트 필터 UI 생성
     */
    createEnchantFilterUI(filter) {
        const filterId = filter.name.replace(/\s/g, '');
        return `
            <div class="filter-group filter-group--stacked">
                <label class="filter-label" for="${filterId}-prefix">접두 인챈트</label>
                <div class="range-input-wrap">
                    <input type="text" class="range-input" autocomplete="off" id="${filterId}-prefix">
                    ${this.renderClearButtonHTML()}
                </div>
            </div>
            <div class="filter-group filter-group--stacked">
                <label class="filter-label" for="${filterId}-suffix">접미 인챈트</label>
                <div class="range-input-wrap">
                    <input type="text" class="range-input" autocomplete="off" id="${filterId}-suffix">
                    ${this.renderClearButtonHTML()}
                </div>
            </div>
        `;
    }
    
    /**
     * 특별 개조 필터 UI 생성
     */
    createSpecialModFilterUI(filter) {
        const filterId = filter.name.replace(/\s/g, '');
        return `
            <div class="filter-group filter-group--stacked">
                <label class="filter-label">특별 개조 타입</label>
                <div class="special-mod-type-selector" id="${filterId}-type-selector">
                    <button class="mod-type-btn" data-type="S">S</button>
                    <button class="mod-type-btn" data-type="R">R</button>
                </div>
                <input type="hidden" id="${filterId}-type" value="">
            </div>
            ${this.createConditionalRangeGroupHTML('특별 개조 단계', `${filterId}-level`, 'id', `${filterId}-min-level`, `${filterId}-max-level`)}
        `;
    }
    
    /**
     * 범위 필터 이벤트 설정
     */
    setupRangeFilterEvents(panel, filter, isMobile = false) {
        const filterId = filter.name.replace(/\s/g, '');
        const minKey = `${filterId}-min`;
        const maxKey = `${filterId}-max`;

        const updateFilter = () => {
            const scope = panel.querySelector(`.condition-inputs[data-group="${filterId}"]`);
            const minInput = scope ? scope.querySelector(`#${minKey}`) : null;
            const maxInput = scope ? scope.querySelector(`#${maxKey}`) : null;
            const min = minInput ? minInput.value.trim() : '';
            const max = maxInput ? maxInput.value.trim() : '';

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
                filterService.removeFilterOption(filter.name);
                this.updateFilterButtonStyle(filter.name, false);
            }
        };

        this.setupConditionalRangeEvents(panel, filterId, minKey, maxKey, 'id', updateFilter);
    }

    /**
     * 활성 버튼 위치에 맞춰 밑줄 인디케이터 이동
     * @param {HTMLElement} segment
     * @param {HTMLElement|null} activeBtn
     */
    positionSegmentIndicator(segment, activeBtn) {
        const indicator = segment.querySelector('.segment-indicator');
        if (!indicator || !activeBtn) return;
        indicator.style.width = activeBtn.offsetWidth + 'px';
        indicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
    }

    /**
     * 세그먼트 클릭 및 입력창 이벤트 연결
     * @param {HTMLElement} panel
     * @param {string} groupId
     * @param {string} minKey
     * @param {string} maxKey
     * @param {string} idAttr
     * @param {Function} onUpdate
     */
    setupConditionalRangeEvents(panel, groupId, minKey, maxKey, idAttr, onUpdate) {
        const segment = panel.querySelector(`.condition-segment[data-group="${groupId}"]`);
        const inputsContainer = panel.querySelector(`.condition-inputs[data-group="${groupId}"]`);
        if (!segment || !inputsContainer) return;

        const getInput = (key) => idAttr === 'data-id'
            ? inputsContainer.querySelector(`[data-id="${key}"]`)
            : inputsContainer.querySelector(`#${key}`);

        // 조건 전환으로 필드가 안 보이는 동안에도 값 보존
        const cache = { min: '', max: '' };
        const syncCache = () => {
            const minInput = getInput(minKey);
            const maxInput = getInput(maxKey);
            if (minInput) cache.min = minInput.value.trim();
            if (maxInput) cache.max = maxInput.value.trim();
        };

        const wireInputs = () => {
            this.attachNumericInputGuards(inputsContainer);
            inputsContainer.querySelectorAll('input').forEach(input => {
                input.addEventListener('input', () => {
                    syncCache();
                    this.syncClearVisibility(input);
                    onUpdate();
                });
                this.attachClearButton(input);
            });
        };
        wireInputs();

        // 패널을 열 때 인디케이터 위치 재계산
        this.positionSegmentIndicator(segment, segment.querySelector('.segment-btn.active'));

        segment.addEventListener('click', (e) => {
            const btn = e.target.closest('.segment-btn');
            if (!btn || btn.classList.contains('active')) return;

            const newMode = btn.dataset.mode;
            syncCache();

            segment.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.positionSegmentIndicator(segment, btn);

            inputsContainer.innerHTML = this.renderConditionInputsHTML(newMode, idAttr, minKey, maxKey, groupId);
            wireInputs();

            // 캐시된 값으로 복원 (숨겨졌던 필드도 포함)
            const newMinInput = getInput(minKey);
            const newMaxInput = getInput(maxKey);
            if (newMinInput && cache.min) { newMinInput.value = cache.min; this.syncClearVisibility(newMinInput); }
            if (newMaxInput && cache.max) { newMaxInput.value = cache.max; this.syncClearVisibility(newMaxInput); }

            onUpdate();
        });
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
                    this.updateFilterButtonStyle(filter.name, false);
                }
            };
            
            // 이벤트 리스너
            prefixInput.addEventListener('input', () => { this.syncClearVisibility(prefixInput); updateFilter(); });
            suffixInput.addEventListener('input', () => { this.syncClearVisibility(suffixInput); updateFilter(); });
            this.attachClearButton(prefixInput);
            this.attachClearButton(suffixInput);
        }
    }
    
    /**
     * 타입/등급 선택 버튼 그룹에 슬라이딩 인디케이터 스타일 애니메이션
     */
    setupModTypeIndicator(selector, onChange) {
        let indicator = selector.querySelector('.mod-type-indicator');
        if (!indicator) {
            indicator = document.createElement('span');
            indicator.className = 'mod-type-indicator';
            selector.insertBefore(indicator, selector.firstChild);
        }

        const placeIndicator = (btn, animate) => {
            if (!animate) indicator.style.transition = 'none';
            indicator.style.left = `${btn.offsetLeft}px`;
            indicator.style.top = `${btn.offsetTop}px`;
            indicator.style.width = `${btn.offsetWidth}px`;
            indicator.style.height = `${btn.offsetHeight}px`;
            indicator.classList.add('visible');
            if (!animate) {
                // 강제 리플로우로 즉시 반영 후 원복
                void indicator.offsetWidth;
                indicator.style.transition = '';
            }
        };

        let activeBtn = selector.querySelector('.mod-type-btn.active') || null;
        if (activeBtn) placeIndicator(activeBtn, false);

        selector.addEventListener('click', (e) => {
            const btn = e.target.closest('.mod-type-btn');
            if (!btn) return;

            const wasActive = btn.classList.contains('active');
            selector.querySelectorAll('.mod-type-btn').forEach(b => b.classList.remove('active'));

            if (wasActive) {
                activeBtn = null;
                indicator.classList.remove('visible');
                onChange(null);
                return;
            }

            btn.classList.add('active');
            placeIndicator(btn, !!activeBtn);
            activeBtn = btn;

            onChange(btn);
        });
    }

    setupSpecialModFilterEvents(panel, filter) {
        const filterId = filter.name.replace(/\s/g, '');
        const typeSelector = panel.querySelector(`#${filterId}-type-selector`);
        const typeInput = panel.querySelector(`#${filterId}-type`);
        const minKey = `${filterId}-min-level`;
        const maxKey = `${filterId}-max-level`;

        if (!typeSelector || !typeInput) {
            console.error('[DevDebug] 특별 개조 필터의 일부 UI 요소를 찾을 수 없습니다.');
            return;
        }

        const readLevels = () => {
            const scope = panel.querySelector(`.condition-inputs[data-group="${filterId}-level"]`);
            const minLevelInput = scope ? scope.querySelector(`#${minKey}`) : null;
            const maxLevelInput = scope ? scope.querySelector(`#${maxKey}`) : null;
            return {
                minLevel: minLevelInput ? minLevelInput.value.trim() : '',
                maxLevel: maxLevelInput ? maxLevelInput.value.trim() : ''
            };
        };

        // 값 변경 이벤트
        const updateFilter = () => {
            const modType = typeInput.value;
            const { minLevel, maxLevel } = readLevels();

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
                filterService.removeFilterOption(filter.name);
                this.updateFilterButtonStyle(filter.name, false);
            }
        };

        // 타입 버튼 클릭 이벤트
        this.setupModTypeIndicator(typeSelector, (btn) => {
            typeInput.value = btn ? btn.dataset.type : '';
            updateFilter();
        });

        this.setupConditionalRangeEvents(panel, `${filterId}-level`, minKey, maxKey, 'id', updateFilter);
    }
    
    /**
     * 복합 필터 이벤트 설정
     */
    setupCompositeFilterEvents(panel, filter) {
        const groupPrefix = filter.name.replace(/\s/g, '');

        const updateFilter = () => {
            const values = {};
            let hasValue = false;
            panel.querySelectorAll('[data-id]').forEach(input => {
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

        // 타입/등급 필터 처리
        panel.querySelectorAll('.special-mod-type-selector[data-track-for]').forEach(selector => {
            const fieldId = selector.dataset.trackFor;
            const hiddenInput = panel.querySelector(`input[type="hidden"][data-id="${fieldId}"]`);
            if (!hiddenInput) return;

            this.setupModTypeIndicator(selector, (btn) => {
                hiddenInput.value = btn ? btn.dataset.value : '';
                updateFilter();
            });
        });

        const rangeFieldIds = new Set();
        filter.fields.forEach(field => {
            if (field.type !== 'range') return;
            rangeFieldIds.add(field.minId);
            rangeFieldIds.add(field.maxId);

            this.setupConditionalRangeEvents(panel, `${groupPrefix}-${field.id}`, field.minId, field.maxId, 'data-id', updateFilter);
        });

        panel.querySelectorAll('[data-id]').forEach(input => {
            if (rangeFieldIds.has(input.dataset.id)) return;
            input.addEventListener('input', () => { this.syncClearVisibility(input); updateFilter(); });
            input.addEventListener('change', updateFilter);
            this.attachClearButton(input);
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

        // +필터 버튼 스타일 갱신
        this.updateMobileFilterChipStyle();
    }
    
    /**
     * 외부 클릭 처리
     */
    handleOutsideClick(event) {
        // 마우스 드래그 클릭 무시
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;

        // 인라인 후보 필터 칩 접기
        if (this.candidatesExpanded &&
            !event.target.closest('.filter-btn, .filter-btn-candidate') &&
            !event.target.closest('.filter-panel')) {
            this.collapseFilterCandidates();
        }

        const isMobile = window.innerWidth <= 768;

        // 캡처 단계 리스너
        if (!event.target.closest('#main-filter-btn') &&
            !event.target.closest('#filter-options') &&
            !event.target.closest('.filter-panel') &&
            this.filterOptions.classList.contains('active')) {
            if (isMobile) {
                this.closeActiveToast();
            } else {
                this.filterOptions.classList.remove('active');
                this.filterOptions.classList.remove('mobile-filter-sheet');
                document.body.style.overflow = 'auto';
                if (this.overlay) {
                    this.overlay.classList.remove('active');
                }
            }
        }

        const activePanel = document.querySelector('.filter-panel.active');
        const activeBtn = document.querySelector('.filter-btn.active[data-filter]');

        if (activePanel && !activePanel.contains(event.target) &&
            activeBtn && !activeBtn.contains(event.target) &&
            !event.target.closest('#filter-options')) {
            if (activePanel.classList.contains('mobile-filter-sheet')) {
                this.closeActiveToast();
            } else {
                this.closeDesktopPanel(activePanel, activeBtn);
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
        const searchContainer = document.getElementById('search-container');
        if (!resultsContainer || !this.filterContainer || !searchWrapper || !searchContainer) return;

        // 검색창 너비를 기준으로 필터 및 결과 컨테이너 너비 설정
        const searchWrapperWidth = searchWrapper.offsetWidth;
        // 필터 컨테이너 너비를 검색창과 동일하게 설정 (CSS에서 padding으로 여백 조절)
        this.filterContainer.style.width = `${searchWrapperWidth}px`;

        // 결과 컨테이너 너비를 검색창과 동일하게 설정
        resultsContainer.style.width = `${searchWrapperWidth}px`;

        // 검색 모드인지 확인 (search-container에 search-mode 클래스가 있는지)
        const isSearchMode = searchContainer.classList.contains('search-mode');

        if (isSearchMode) {
            // 검색창 기준으로 위치 계산
            const searchWrapperRect = searchWrapper.getBoundingClientRect();
            this.filterContainer.style.top = `${searchWrapperRect.bottom + this.SEARCH_TO_FILTER_GAP}px`;

            // 고정값 대신 실제 하단 위치 사용
            const filterContainerRect = this.filterContainer.getBoundingClientRect();

            resultsContainer.style.marginTop = `${filterContainerRect.bottom + this.RESULTS_GAP}px`;
        } else {
            resultsContainer.style.marginTop = '0px';
        }
    }
}

// 싱글톤 인스턴스 생성 및 내보내기
const filterPanel = new FilterPanel();

export default filterPanel;
