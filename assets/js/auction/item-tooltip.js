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
        lastItemRowUnderMouse: null  // 마우스 아래의 행 추적
    };

    // DOM 요소
    let tooltipElement = null;
    
    /**
     * 모듈 초기화
     */
    function init() {
        if (state.initialized) return;
        
        // 모바일 여부 감지
        state.isMobile = 'ontouchstart' in window;
        
        // 툴팁 요소 검색 또는 생성
        tooltipElement = document.getElementById('item-tooltip');
        if (!tooltipElement) {
            tooltipElement = document.createElement('div');
            tooltipElement.id = 'item-tooltip';
            tooltipElement.className = 'item-tooltip';
            document.body.appendChild(tooltipElement);
        }
        
        // 기본 스타일 설정
        tooltipElement.style.position = 'fixed';
        tooltipElement.style.display = 'none';
        tooltipElement.style.zIndex = '1001';
        
        // PC와 모바일에서 다른 이벤트 처리
        if (state.isMobile) {
            // 모바일: 툴팁 클릭 시 닫기
            tooltipElement.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                hideTooltip();
            });
        } else {
            // PC: 전역 마우스 이동 추적 (깜빡임과 부드러운 이동을 위한 핵심)
            document.addEventListener('mousemove', (e) => {
                // 마우스 위치 업데이트
                state.mousePosition.x = e.clientX;
                state.mousePosition.y = e.clientY;
                
                if (state.visible) {
                    // 마우스 아래의 실제 요소 찾기 (툴팁 투과)
                    tooltipElement.style.pointerEvents = 'none';
                    const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
                    tooltipElement.style.pointerEvents = 'auto';
                    
                    // 요소가 아이템 행인지 확인
                    const itemRow = elementUnderMouse ? elementUnderMouse.closest('.item-row') : null;
                    
                    // 새로운 아이템 행을 발견했고, 이전과 다른 경우 처리
                    if (itemRow && state.lastItemRowUnderMouse !== itemRow) {
                        // 아이템 데이터 확인
                        try {
                            const itemDataStr = itemRow.getAttribute('data-item');
                            if (itemDataStr) {
                                const itemData = JSON.parse(itemDataStr);
                                
                                // 이전 행과 다른 아이템인 경우 업데이트
                                if (state.currentItemId !== itemData.auction_item_no) {
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
                                    state.currentItemId = itemData.auction_item_no || '';
                                }
                            }
                        } catch (error) {
                            console.error('아이템 데이터 처리 오류:', error);
                        }
                    }
                    
                    // 현재 마우스 아래 행 추적
                    state.lastItemRowUnderMouse = itemRow;
                }
            });
            
            // 툴팁에서 마우스가 나갈 때만 닫기 (행 위로 이동할 때는 유지)
            tooltipElement.addEventListener('mouseout', (e) => {
                // 관련 타겟이 툴팁이나 아이템 행이 아닌 경우만 닫기
                if (!e.relatedTarget || 
                    (!tooltipElement.contains(e.relatedTarget) && 
                     !e.relatedTarget.closest('.item-row'))) {
                    hideTooltip();
                }
                e.stopPropagation();
            });
        }
        
        state.initialized = true;
    }
    
    /**
     * 툴팁 표시
     */
    function showTooltip(itemData, x, y, rowElement) {
        if (!tooltipElement || !itemData) return;
        
        // 이전 행 상태 저장 및 업데이트
        if (state.currentRow && state.currentRow !== rowElement) {
            state.currentRow.classList.remove('hovered');
        }
        
        if (rowElement) {
            rowElement.classList.add('hovered');
            state.currentRow = rowElement;
            state.lastItemRowUnderMouse = rowElement;
        }
        
        // 툴팁 내용 생성
        tooltipElement.innerHTML = '';
        const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
        tooltipElement.appendChild(tooltipContent);
        
        // PC에서는 마우스 이벤트 처리 설정
        tooltipElement.style.pointerEvents = 'auto';
        
        // 툴팁 표시
        tooltipElement.style.display = 'block';
        
        // 초기 위치 설정
        tooltipElement.style.left = '0px';
        tooltipElement.style.top = '0px';
        
        // 초기 마우스 위치 설정
        state.mousePosition = { x, y };
        
        // 상태 업데이트
        state.visible = true;
        state.currentItemId = itemData.auction_item_no || '';
        
        // 애니메이션 시작 (PC에서만)
        if (!state.isMobile) {
            startPositionAnimation();
        } else {
            // 모바일에서는 한 번만 위치 설정
            updatePosition(x, y);
        }
    }
    
    /**
     * 위치 애니메이션 시작
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
     * 툴팁 내용 업데이트
     */
    function updateTooltip(itemData, x, y, rowElement) {
        if (!tooltipElement || !itemData) return;
        
        // 같은 아이템이면 위치만 업데이트
        if (state.currentItemId === (itemData.auction_item_no || '')) {
            state.mousePosition = { x, y };
            return;
        }
        
        // 다른 아이템이면 내용 업데이트
        tooltipElement.innerHTML = '';
        const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
        tooltipElement.appendChild(tooltipContent);
        
        // 행 상태 업데이트
        if (state.currentRow && state.currentRow !== rowElement) {
            state.currentRow.classList.remove('hovered');
        }
        
        if (rowElement) {
            rowElement.classList.add('hovered');
            state.currentRow = rowElement;
            state.lastItemRowUnderMouse = rowElement;
        }
        
        // 상태 업데이트
        state.currentItemId = itemData.auction_item_no || '';
        
        // 마우스 위치 업데이트
        state.mousePosition = { x, y };
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
        
        // 위치 계산 (기존 로직 유지)
        let left = x + 15; // 커서 우측에 15px 여백
        let top = y + 5;   // 커서 아래쪽에 5px 여백
        
        // 화면 경계 처리
        const rightMargin = 5;
        const maxLeft = windowWidth - tooltipWidth - rightMargin;
        if (left > maxLeft) {
            left = maxLeft;
        }
        
        const bottomMargin = 5;
        const maxTop = windowHeight - tooltipHeight - bottomMargin;
        if (top > maxTop) {
            top = maxTop;
        }
        
        // 좌측 경계도 확인
        if (left < 5) {
            left = 5;
        }
        
        // 상단 경계도 확인
        if (top < 5) {
            top = 5;
        }
        
        // 위치 고정 (정수값으로 고정)
        tooltipElement.style.left = `${Math.round(left)}px`;
        tooltipElement.style.top = `${Math.round(top)}px`;
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
        
        // 현재 행의 강조 제거
        if (state.currentRow) {
            state.currentRow.classList.remove('hovered');
            state.currentRow = null;
        }
        
        tooltipElement.style.display = 'none';
        tooltipElement.innerHTML = '';
        state.visible = false;
        state.currentItemId = null;
        state.lastItemRowUnderMouse = null;
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
    
    // 공개 API
    return {
        init,
        showTooltip,
        updateTooltip,
        hideTooltip,
        updatePosition,
        isVisible: () => state.visible,
        getCurrentItemId,
        isMobileDevice
    };
})();

export default ItemTooltip;
