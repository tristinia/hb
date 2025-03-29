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
        isMobile: false,
        lastPosition: { x: 0, y: 0 }
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
        
        // PC와 모바일에서 이벤트 처리 방식 분리
        if (state.isMobile) {
            // 모바일: 툴팁 자체 터치 가능하게 설정 (툴팁 자체를 터치하면 닫히도록)
            tooltipElement.style.pointerEvents = 'auto';
            tooltipElement.addEventListener('touchstart', handleTooltipTouch);
        } else {
            // PC: 항상 포인터 이벤트를 무시하도록 설정 (깜빡임 방지 핵심)
            tooltipElement.style.pointerEvents = 'none';
            
            // 추가: 깜빡임 방지를 위한 이벤트 리스너
            document.addEventListener('mousemove', (e) => {
                // 툴팁이 표시되어 있고 마우스가 움직이는 경우
                if (state.visible) {
                    // 마우스 위치에서 아이템을 찾아 툴팁 갱신
                    const itemAtPoint = getItemElementAtPoint(e.clientX, e.clientY);
                    if (itemAtPoint && itemAtPoint.hasAttribute('data-item')) {
                        // 아이템이 있으면 툴팁 위치만 업데이트
                        updatePosition(e.clientX, e.clientY);
                    }
                }
            });
        }
        
        state.initialized = true;
    }
    
    /**
     * 특정 위치에 있는 아이템 요소 가져오기
     * @param {number} x - 화면 X 좌표
     * @param {number} y - 화면 Y 좌표
     * @returns {HTMLElement|null} 아이템 요소 또는 null
     */
    function getItemElementAtPoint(x, y) {
        // elementFromPoint는 툴팁이 있으면 툴팁을 반환할 수 있으므로
        // 일시적으로 툴팁을 숨기고 체크
        const currentVisibility = tooltipElement.style.visibility;
        tooltipElement.style.visibility = 'hidden';
        
        // 특정 지점의 요소 확인
        const element = document.elementFromPoint(x, y);
        
        // 툴팁 가시성 복원
        tooltipElement.style.visibility = currentVisibility;
        
        // 요소가 있으면 가장 가까운 아이템 행 찾기
        if (element) {
            return element.closest('.item-row');
        }
        
        return null;
    }
    
    /**
     * 툴팁 터치 이벤트 처리 (모바일 전용)
     */
    function handleTooltipTouch(event) {
        event.preventDefault();
        event.stopPropagation();
        hideTooltip();
    }
    
    /**
     * 툴팁 표시
     */
    function showTooltip(itemData, x, y) {
        if (!tooltipElement || !itemData) return;
        
        // 툴팁 내용 생성
        tooltipElement.innerHTML = '';
        const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
        tooltipElement.appendChild(tooltipContent);
        
        // 툴팁 표시
        tooltipElement.style.display = 'block';
        
        // 상태 업데이트
        state.visible = true;
        state.currentItemId = itemData.auction_item_no || '';
        
        // 위치 업데이트
        updatePosition(x, y);
    }
    
    /**
     * 툴팁 내용 업데이트
     */
    function updateTooltip(itemData, x, y) {
        if (!tooltipElement || !itemData) return;
        
        // 같은 아이템이면 위치만 업데이트
        if (state.currentItemId === (itemData.auction_item_no || '')) {
            updatePosition(x, y);
            return;
        }
        
        // 다른 아이템이면 내용 업데이트
        tooltipElement.innerHTML = '';
        const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
        tooltipElement.appendChild(tooltipContent);
        
        // 상태 업데이트
        state.currentItemId = itemData.auction_item_no || '';
        
        // 위치 업데이트
        updatePosition(x, y);
    }
    
    /**
     * 툴팁 위치 업데이트
     */
    function updatePosition(x, y) {
        if (!tooltipElement || !state.visible) return;
        
        // 툴팁 크기
        const tooltipWidth = tooltipElement.offsetWidth;
        const tooltipHeight = tooltipElement.offsetHeight;
        
        // 화면 크기
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        let left, top;
        
        // 모바일과 PC 처리 분리
        if (state.isMobile) {
            // 모바일: PC와 유사하게 터치 위치 오른쪽에 표시
            left = x + 15; // 터치 지점 우측에 15px 여백
            top = y - 10;  // 터치 지점 위쪽에 10px 여백 (손가락에 가려지지 않게)
        } else {
            // PC: 마우스 커서 오른쪽 아래에 표시
            left = x + 15; // 커서 우측에 15px 여백
            top = y + 5;   // 커서 아래쪽에 5px 여백
        }
        
        // 화면 경계 처리 (오른쪽과 아래쪽만 체크)
        
        // 오른쪽 경계 - 오른쪽에 항상 최소 5px 여백 유지
        const rightMargin = 5; // 우측 여백
        const maxLeft = windowWidth - tooltipWidth - rightMargin;
        
        if (left > maxLeft) {
            left = maxLeft; // 오른쪽 경계에서 여백 유지
        }
        
        // 아래쪽 경계 - 동일한 방식으로 처리
        const bottomMargin = 5; // 하단 여백
        const maxTop = windowHeight - tooltipHeight - bottomMargin;
        
        if (top > maxTop) {
            // 모바일: 높이가 넘칠 경우 상단에 고정
            if (state.isMobile) {
                top = 10; // 상단에 10px 여백
            } else {
                top = maxTop; // 하단 여백 유지
            }
        }
        
        // 위치 고정 (깜빡임 방지를 위해 숫자를 정수로 올림하고 px 단위로 설정)
        // 브라우저 렌더링 엔진에 따라 소수점 계산에서 미세한 차이가 발생할 수 있으므로 
        // 정수 사용하여 안정화
        tooltipElement.style.left = `${Math.floor(left)}px`;
        tooltipElement.style.top = `${Math.floor(top)}px`;
    }
    
    /**
     * 툴팁 숨기기
     */
    function hideTooltip() {
        if (!tooltipElement) return;
        
        tooltipElement.style.display = 'none';
        tooltipElement.innerHTML = '';
        state.visible = false;
        state.currentItemId = null;
        
        // 마지막 위치 초기화
        state.lastPosition.x = 0;
        state.lastPosition.y = 0;
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
        supportsHover: () => !state.isMobile,
        getCurrentItemId,
        isMobileDevice
    };
})();

export default ItemTooltip;
