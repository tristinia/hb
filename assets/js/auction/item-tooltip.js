/**
 * item-tooltip.js
 * 아이템 정보 툴팁 표시와 위치 계산 담당 모듈
 */

import optionRenderer from './option-renderer.js';

const ItemTooltip = (() => {
    // 기본 상태 변수
    const state = {
        initialized: false,
        visible: false,
        currentItemId: null,
        currentRow: null,
        isMobile: false,
        mousePosition: { x: 0, y: 0 },
        animationFrameId: null,
        margin: 5 // 화면 경계에서의 최소 거리
    };

    // DOM 요소
    let tooltipElement = null;
    let tooltipParent = null;
    
    /**
     * 모듈 초기화
     */
    function init() {
        if (state.initialized) return;
        
        // 모바일 여부 감지 (터치 디바이스와 화면 크기 모두 고려)
        state.isMobile = ('ontouchstart' in window) && 
                         (window.innerWidth <= 768 || window.innerHeight <= 600);
        
        // 툴팁 요소 검색 또는 생성
        tooltipElement = document.getElementById('item-tooltip');
        if (!tooltipElement) {
            tooltipElement = document.createElement('div');
            tooltipElement.id = 'item-tooltip';
            tooltipElement.className = 'item-tooltip';
            document.body.appendChild(tooltipElement);
        }
        
        // 툴팁 부모 저장
        tooltipParent = tooltipElement.parentNode;
        
        // 기본 스타일 설정
        tooltipElement.style.position = 'fixed';
        tooltipElement.style.display = 'none';
        tooltipElement.style.zIndex = '1001';
        
        // PC와 모바일 환경에 따른 이벤트 리스너 설정
        if (state.isMobile) {
            // 모바일 터치 이벤트 설정
            setupMobileEvents();
        } else {
            // PC 마우스 이벤트 설정
            setupDesktopEvents();
        }
        
        state.initialized = true;
        console.log(`툴팁 초기화 완료 (${state.isMobile ? '모바일' : 'PC'} 모드)`);
    }
    
    /**
     * 모바일 터치 이벤트 설정
     */
    function setupMobileEvents() {
        // 결과 테이블에 터치 이벤트 리스너 추가
        const resultsTable = document.querySelector('.results-table');
        if (resultsTable) {
            // 결과 테이블에 클릭 이벤트 추가
            resultsTable.addEventListener('click', handleMobileItemClick);
        }
        
        // 툴팁 클릭 시 숨김 처리
        tooltipElement.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            hideTooltip();
        });
        
        // 문서 클릭 이벤트는 불필요 (모바일에서는 툴팁을 직접 클릭해야만 닫히도록)
        document.removeEventListener('click', handleDocumentClick);
    }
    
    /**
     * PC 마우스 이벤트 설정
     */
    function setupDesktopEvents() {
        // 결과 테이블에 마우스 이벤트 리스너 추가
        const resultsTable = document.querySelector('.results-table');
        if (resultsTable) {
            resultsTable.addEventListener('mouseover', handleItemHover);
            resultsTable.addEventListener('mouseout', handleMouseOut);
        }
        
        // 전역 마우스 이동 이벤트 (부드러운 툴팁 이동)
        document.addEventListener('mousemove', handleMouseMove);
        
        // 문서 클릭 시 툴팁 숨김 (테이블 외 영역 클릭)
        document.addEventListener('click', handleDocumentClick);
    }
    
    /**
     * 문서 클릭 이벤트 핸들러
     */
    function handleDocumentClick(e) {
        if (state.visible) {
            // 툴팁이나 아이템 행 클릭은 무시
            if (e.target.closest('#item-tooltip') || e.target.closest('.item-row')) {
                return;
            }
            hideTooltip();
        }
    }
    
    /**
     * 모바일 아이템 클릭 이벤트 핸들러
     */
    function handleMobileItemClick(e) {
        const itemRow = e.target.closest('.item-row');
        if (!itemRow) return;
        
        try {
            // 아이템 데이터 가져오기
            const itemDataStr = itemRow.getAttribute('data-item');
            if (!itemDataStr) return;
            
            const itemData = JSON.parse(itemDataStr);
            const newItemId = itemData.auction_item_no || '';
            
            // 같은 아이템 재클릭 시 툴팁 상태 전환
            if (state.visible && state.currentItemId === newItemId) {
                hideTooltip();
                return;
            }
            
            // 이전 행 강조 제거
            if (state.currentRow) {
                state.currentRow.classList.remove('hovered');
            }
            
            // 새 행 강조
            itemRow.classList.add('hovered');
            state.currentRow = itemRow;
            
            // 툴팁 내용 업데이트
            tooltipElement.innerHTML = '';
            const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
            tooltipElement.appendChild(tooltipContent);
            
            // 상태 업데이트
            state.currentItemId = newItemId;
            state.visible = true;
            
            // 터치 위치 기준으로 툴팁 표시
            updatePosition(e.clientX, e.clientY);
            
            // 툴팁 표시
            tooltipElement.style.display = 'block';
        } catch (error) {
            console.error('모바일 툴팁 표시 중 오류:', error);
        }
    }
    
    /**
     * PC 아이템 호버 이벤트 핸들러
     */
    function handleItemHover(e) {
        const itemRow = e.target.closest('.item-row');
        if (!itemRow) return;
        
        try {
            // 아이템 데이터 가져오기
            const itemDataStr = itemRow.getAttribute('data-item');
            if (!itemDataStr) return;
            
            const itemData = JSON.parse(itemDataStr);
            const newItemId = itemData.auction_item_no || '';
            
            // 이미 같은 아이템이면 위치만 업데이트
            if (state.visible && state.currentItemId === newItemId) {
                state.mousePosition = { x: e.clientX, y: e.clientY };
                return;
            }
            
            // 이전 행 강조 제거
            if (state.currentRow && state.currentRow !== itemRow) {
                state.currentRow.classList.remove('hovered');
            }
            
            // 새 행 강조
            itemRow.classList.add('hovered');
            state.currentRow = itemRow;
            
            // 툴팁 내용 업데이트 또는 최초 표시
            updateTooltipContent(itemData);
            
            // 상태 업데이트
            state.currentItemId = newItemId;
            state.visible = true;
            state.mousePosition = { x: e.clientX, y: e.clientY };
            
            // 애니메이션 시작 (부드러운 움직임)
            startPositionAnimation();
            
            // 툴팁 표시
            tooltipElement.style.display = 'block';
        } catch (error) {
            console.error('PC 툴팁 표시 중 오류:', error);
        }
    }
    
    /**
     * 마우스 이동 이벤트 핸들러
     */
    function handleMouseMove(e) {
        // 툴팁이 표시 중일 때만 처리
        if (!state.visible) return;
        
        // 현재 마우스 위치 저장
        state.mousePosition = { x: e.clientX, y: e.clientY };
        
        // 마우스 아래 실제 요소 감지 (툴팁 제외)
        detectElementUnderCursor(e.clientX, e.clientY);
    }
    
    /**
     * 마우스 아웃 이벤트 핸들러
     */
    function handleMouseOut(e) {
        // 아이템 행에서 벗어날 때
        const itemRow = e.target.closest('.item-row');
        const relatedTarget = e.relatedTarget;
        
        // 다른 아이템 행이나 툴팁으로 이동하는 경우는 무시
        if (relatedTarget && (relatedTarget.closest('.item-row') || relatedTarget.closest('#item-tooltip'))) {
            return;
        }
        
        // 테이블 밖으로 마우스가 나간 경우 툴팁 숨김
        if (itemRow && !e.relatedTarget.closest('.results-table') && !e.relatedTarget.closest('#item-tooltip')) {
            hideTooltip();
        }
    }
    
    /**
     * 커서 아래 실제 요소 감지 (툴팁 제외)
     */
    function detectElementUnderCursor(x, y) {
        // 1. 툴팁 일시 숨김
        const tooltipWasVisible = tooltipElement.style.display !== 'none';
        const originalDisplay = tooltipElement.style.display;
        
        try {
            // 툴팁 임시 숨김 (요소 감지를 위해)
            if (tooltipWasVisible) {
                tooltipElement.style.pointerEvents = 'none';
                tooltipElement.style.visibility = 'hidden';
            }
            
            // 2. 마우스 아래 실제 요소 감지
            const elementUnderCursor = document.elementFromPoint(x, y);
            
            // 3. 툴팁 원래 상태로 복원
            if (tooltipWasVisible) {
                tooltipElement.style.pointerEvents = '';
                tooltipElement.style.visibility = '';
                tooltipElement.style.display = originalDisplay;
            }
            
            // 4. 감지된 요소가 아이템 행인지 확인
            if (elementUnderCursor) {
                const itemRow = elementUnderCursor.closest('.item-row');
                if (itemRow && (!state.currentRow || itemRow !== state.currentRow)) {
                    try {
                        // 아이템 데이터 가져오기
                        const itemDataStr = itemRow.getAttribute('data-item');
                        if (itemDataStr) {
                            const itemData = JSON.parse(itemDataStr);
                            const newItemId = itemData.auction_item_no || '';
                            
                            // 다른 아이템이면 툴팁 내용 업데이트
                            if (newItemId !== state.currentItemId) {
                                // 이전 행 강조 제거
                                if (state.currentRow) {
                                    state.currentRow.classList.remove('hovered');
                                }
                                
                                // 새 행 강조
                                itemRow.classList.add('hovered');
                                state.currentRow = itemRow;
                                
                                // 툴팁 내용 업데이트
                                updateTooltipContent(itemData);
                                
                                // 상태 업데이트
                                state.currentItemId = newItemId;
                            }
                        }
                    } catch (error) {
                        console.error('툴팁 내용 업데이트 중 오류:', error);
                    }
                }
            }
        } catch (error) {
            console.error('커서 아래 요소 감지 중 오류:', error);
            
            // 오류 발생 시 툴팁 원래 상태로 복원
            if (tooltipWasVisible) {
                tooltipElement.style.pointerEvents = '';
                tooltipElement.style.visibility = '';
                tooltipElement.style.display = originalDisplay;
            }
        }
    }
    
    /**
     * 툴팁 내용 업데이트
     */
    function updateTooltipContent(itemData) {
        if (!tooltipElement || !itemData) return;
        
        // 툴팁 내용 교체
        tooltipElement.innerHTML = '';
        const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
        tooltipElement.appendChild(tooltipContent);
    }
    
    /**
     * 위치 애니메이션 시작 (부드러운 이동)
     */
    function startPositionAnimation() {
        // 기존 애니메이션 중지
        if (state.animationFrameId) {
            cancelAnimationFrame(state.animationFrameId);
        }
        
        // 애니메이션 프레임 함수
        function animatePosition() {
            // 툴팁이 표시 중일 때만 위치 업데이트
            if (state.visible) {
                updatePosition(state.mousePosition.x, state.mousePosition.y);
                state.animationFrameId = requestAnimationFrame(animatePosition);
            }
        }
        
        // 애니메이션 시작
        state.animationFrameId = requestAnimationFrame(animatePosition);
    }
    
    /**
     * 툴팁 위치 업데이트 - 화면 경계 처리 포함
     */
    function updatePosition(x, y) {
        if (!tooltipElement || !state.visible) return;
        
        // 툴팁 크기
        const tooltipWidth = tooltipElement.offsetWidth;
        const tooltipHeight = tooltipElement.offsetHeight;
        
        // 화면 크기
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // 기본 위치 (커서 오른쪽)
        let left = x + 15; // 커서 오른쪽에 15px 여백
        let top = y + 5;   // 커서 아래쪽에 5px 여백
        
        // 오른쪽 화면 경계 처리
        if (left + tooltipWidth > windowWidth - state.margin) {
            left = windowWidth - tooltipWidth - state.margin;
        }
        
        // 하단 화면 경계 처리
        if (top + tooltipHeight > windowHeight - state.margin) {
            top = windowHeight - tooltipHeight - state.margin;
        }
        
        // 좌측 경계 처리 (필요시)
        if (left < state.margin) {
            left = state.margin;
        }
        
        // 상단 경계 처리 (필요시)
        if (top < state.margin) {
            top = state.margin;
        }
        
        // 위치 적용 (정수값으로 변환하여 렌더링 최적화)
        tooltipElement.style.left = `${Math.round(left)}px`;
        tooltipElement.style.top = `${Math.round(top)}px`;
    }
    
    /**
     * 툴팁 표시
     */
    function showTooltip(itemData, x, y, rowElement) {
        if (!tooltipElement || !itemData) return;
        
        // 이전 행 강조 제거
        if (state.currentRow && state.currentRow !== rowElement) {
            state.currentRow.classList.remove('hovered');
        }
        
        // 새 행 강조
        if (rowElement) {
            rowElement.classList.add('hovered');
            state.currentRow = rowElement;
        }
        
        // 툴팁 내용 업데이트
        updateTooltipContent(itemData);
        
        // 상태 업데이트
        state.currentItemId = itemData.auction_item_no || '';
        state.visible = true;
        state.mousePosition = { x, y };
        
        // 위치 초기화
        tooltipElement.style.left = '0px';
        tooltipElement.style.top = '0px';
        
        // 툴팁 표시
        tooltipElement.style.display = 'block';
        
        // 환경에 따른 처리
        if (state.isMobile) {
            // 모바일: 한 번만 위치 설정
            updatePosition(x, y);
        } else {
            // PC: 부드러운 애니메이션 시작
            startPositionAnimation();
        }
    }
    
    /**
     * 툴팁 내용 및 위치 업데이트
     */
    function updateTooltip(itemData, x, y, rowElement) {
        if (!tooltipElement || !itemData) return;
        
        const newItemId = itemData.auction_item_no || '';
        
        // 같은 아이템이면 위치만 업데이트
        if (state.currentItemId === newItemId) {
            state.mousePosition = { x, y };
            return;
        }
        
        // 다른 아이템이면 내용 업데이트
        updateTooltipContent(itemData);
        
        // 행 강조 상태 업데이트
        if (state.currentRow && state.currentRow !== rowElement) {
            state.currentRow.classList.remove('hovered');
        }
        
        if (rowElement) {
            rowElement.classList.add('hovered');
            state.currentRow = rowElement;
        }
        
        // 상태 업데이트
        state.currentItemId = newItemId;
        state.mousePosition = { x, y };
    }
    
    /**
     * 툴팁 숨기기
     */
    function hideTooltip() {
        if (!tooltipElement) return;
        
        // 애니메이션 중지
        if (state.animationFrameId) {
            cancelAnimationFrame(state.animationFrameId);
            state.animationFrameId = null;
        }
        
        // 현재 행 강조 제거
        if (state.currentRow) {
            state.currentRow.classList.remove('hovered');
            state.currentRow = null;
        }
        
        // 툴팁 숨김 및 상태 초기화
        tooltipElement.style.display = 'none';
        tooltipElement.innerHTML = '';
        state.visible = false;
        state.currentItemId = null;
    }
    
    /**
     * 현재 표시 중인 아이템 ID 반환
     */
    function getCurrentItemId() {
        return state.currentItemId;
    }
    
    /**
     * 모바일 여부 확인
     */
    function isMobileDevice() {
        return state.isMobile;
    }
    
    /**
     * 툴팁 표시 여부 확인
     */
    function isVisible() {
        return state.visible;
    }
    
    // 공개 API
    return {
        init,
        showTooltip,
        updateTooltip,
        hideTooltip,
        updatePosition,
        isVisible,
        getCurrentItemId,
        isMobileDevice
    };
})();

export default ItemTooltip;
