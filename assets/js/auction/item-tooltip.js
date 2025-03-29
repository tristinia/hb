/**
 * item-tooltip.js
 * 아이템 툴팁 전용 독립 모듈
 */

import optionRenderer from './option-renderer.js';

/**
 * 아이템 툴팁 관리자
 * 아이템 정보 툴팁 표시와 위치 계산을 담당하는 독립적인 모듈
 */
const ItemTooltip = (() => {
    // 내부 상태
    const state = {
        initialized: false,
        visible: false,
        lastItemData: null,
        currentItemId: null,
        supportsHover: false,    // 호버 지원 여부
        lastPositionX: 0,        // 마지막 위치 X (깜빡임 방지용)
        lastPositionY: 0,        // 마지막 위치 Y (깜빡임 방지용)
        isPositionStable: false, // 위치 안정화 상태
        positionUpdateCount: 0,  // 위치 업데이트 카운터
        positionLocked: false    // 위치 잠금 상태 (깜빡임 방지)
    };

    // DOM 요소
    let tooltipElement = null;
    
    /**
     * 모듈 초기화
     */
    function init() {
        // 이미 초기화되었으면 무시
        if (state.initialized) return;
        
        // 호버 지원 여부 감지
        state.supportsHover = window.matchMedia('(hover: hover)').matches;
        
        // 툴팁 HTML 요소 검색
        tooltipElement = document.getElementById('item-tooltip');
        
        // 요소가 없으면 새로 생성
        if (!tooltipElement) {
            tooltipElement = document.createElement('div');
            tooltipElement.id = 'item-tooltip';
            tooltipElement.className = 'item-tooltip';
            document.body.appendChild(tooltipElement);
        }
        
        // 초기 스타일 설정
        tooltipElement.style.position = 'fixed';
        tooltipElement.style.display = 'none';
        tooltipElement.style.zIndex = '1001';
        tooltipElement.style.cursor = 'default';
        
        // 툴팁 자체는 포인터 이벤트를 캡처하지 않도록 설정
        // 이렇게 하면 툴팁 아래 요소의 이벤트가 감지됨
        tooltipElement.style.pointerEvents = 'none';
        
        // 모바일에서는 툴팁 클릭 감지를 위해 이벤트 활성화 (터치 전용)
        if (!state.supportsHover && 'ontouchstart' in window) {
            tooltipElement.addEventListener('touchstart', function(e) {
                // 툴팁 터치 시 이벤트 전파 중단 및 툴팁 숨김
                e.stopPropagation();
                hideTooltip();
            });
        }
        
        state.initialized = true;
        console.log('ItemTooltip 모듈 초기화 완료');
    }
    
    /**
     * 툴팁 표시
     * @param {Object} itemData - 아이템 데이터
     * @param {number} x - 마우스 X 좌표
     * @param {number} y - 마우스 Y 좌표
     */
    function showTooltip(itemData, x, y) {
        if (!tooltipElement || !itemData) return;
        
        // 내용 초기화 및 생성
        tooltipElement.innerHTML = '';
        const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
        tooltipElement.appendChild(tooltipContent);
        
        // 툴팁 표시 설정
        tooltipElement.style.display = 'block';
        
        // 상태 업데이트
        state.visible = true;
        state.lastItemData = itemData;
        state.currentItemId = itemData.auction_item_no || '';
        state.positionUpdateCount = 0;
        state.isPositionStable = false;
        state.positionLocked = false;
        
        // 위치 즉시 업데이트
        updatePosition(x, y);
    }
    
    /**
     * 툴팁 내용 업데이트
     * @param {Object} itemData - 아이템 데이터
     * @param {number} x - 마우스 X 좌표
     * @param {number} y - 마우스 Y 좌표
     */
    function updateTooltip(itemData, x, y) {
        if (!tooltipElement || !itemData) return;
        
        // 같은 아이템이면 위치만 업데이트 (깜빡임 방지)
        if (state.currentItemId === (itemData.auction_item_no || '')) {
            updatePosition(x, y);
            return;
        }
        
        // 다른 아이템이면 내용 업데이트
        tooltipElement.innerHTML = '';
        const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
        tooltipElement.appendChild(tooltipContent);
        
        // 상태 업데이트
        state.lastItemData = itemData;
        state.currentItemId = itemData.auction_item_no || '';
        state.positionUpdateCount = 0;
        state.isPositionStable = false;
        state.positionLocked = false;
        
        // 위치 업데이트
        updatePosition(x, y);
    }
    
    /**
     * 툴팁 위치 업데이트
     * @param {number} x - 마우스 X 좌표
     * @param {number} y - 마우스 Y 좌표
     */
    function updatePosition(x, y) {
        if (!tooltipElement || !state.visible) return;
        
        // 위치 잠금 중이면 무시 (깜빡임 방지)
        if (state.positionLocked) return;
        
        // 이전 위치와 거의 동일하면 무시 (깜빡임 방지)
        const moveDistance = Math.sqrt(
            Math.pow((state.lastPositionX) - x, 2) + 
            Math.pow((state.lastPositionY) - y, 2)
        );
        
        // 작은 움직임이고 안정화 상태면 무시
        if (moveDistance < 5 && state.isPositionStable) {
            return;
        }
        
        // 툴팁 크기 측정
        const tooltipWidth = tooltipElement.offsetWidth;
        const tooltipHeight = tooltipElement.offsetHeight;
        
        // 화면 크기
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // 기본 위치 계산 - 마우스 커서 오른쪽 위에 표시
        let left = x + 15;
        let top = y - 15;
        
        // 모바일 기기 감지
        const isMobile = !state.supportsHover || ('ontouchstart' in window);
        
        // 모바일일 경우 위치 조정 (손가락이 가리지 않도록)
        if (isMobile) {
            // 모바일에서는 터치 위치 위에 표시
            top = y - tooltipHeight - 20;
        }
        
        // 오른쪽 경계 검사
        if (left + tooltipWidth > windowWidth) {
            left = windowWidth - tooltipWidth - 5;
        }
        
        // 왼쪽 경계 검사
        if (left < 5) {
            left = 5;
        }
        
        // 아래쪽 경계 검사
        if (top + tooltipHeight > windowHeight) {
            // 화면 아래 경계를 벗어나면 위에 표시
            top = windowHeight - tooltipHeight - 5;
        }
        
        // 위쪽 경계 검사
        if (top < 5) {
            // 모바일에서는 아래에 표시, PC에서는 위치 조정
            if (isMobile) {
                top = y + 15; // 터치 위치 아래로
            } else {
                top = 5;
            }
        }
        
        // 위치가 경계에 가까우면 안정화 상태로 변경 (깜빡임 방지)
        const isNearBoundary = 
            (left <= 5) || 
            (left + tooltipWidth >= windowWidth - 5) || 
            (top <= 5) || 
            (top + tooltipHeight >= windowHeight - 5);
        
        if (isNearBoundary) {
            state.positionUpdateCount++;
            
            // 여러 번 경계 근처에서 업데이트되면 안정화 상태로 전환
            if (state.positionUpdateCount > 3) {
                state.isPositionStable = true;
                
                // 일시적으로 위치 잠금 (깜빡임 방지)
                state.positionLocked = true;
                setTimeout(() => {
                    state.positionLocked = false;
                }, 300);
            }
        } else {
            // 경계에서 멀어지면 상태 초기화
            state.positionUpdateCount = 0;
            state.isPositionStable = false;
        }
        
        // 위치 업데이트
        tooltipElement.style.left = `${Math.round(left)}px`;
        tooltipElement.style.top = `${Math.round(top)}px`;
        
        // 마지막 위치 저장
        state.lastPositionX = x;
        state.lastPositionY = y;
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
        state.isPositionStable = false;
        state.positionUpdateCount = 0;
    }
    
    /**
     * 현재 표시 중인 아이템 ID 반환
     * @returns {string} 현재 아이템 ID
     */
    function getCurrentItemId() {
        return state.currentItemId;
    }
    
    /**
     * Apple Pencil 호버 지원 여부 확인 (아이패드 전용)
     * @returns {boolean} 호버 지원 여부
     */
    function checkApplePencilHover() {
        // iPad OS 13 이상 + Apple Pencil 2 + Safari 브라우저 확인
        const isIPad = /iPad/i.test(navigator.userAgent) || 
                       (/Macintosh/i.test(navigator.userAgent) && 'ontouchend' in document);
        
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        // iPad + Safari + hoverable 확인
        return isIPad && (isSafari || state.supportsHover);
    }
    
    /**
     * 호버링 지원 여부 확인 (마우스 + 터치펜 고려)
     * @returns {boolean} 호버 지원 여부
     */
    function supportsHoverOrPen() {
        // 기본 호버 지원 또는 Apple Pencil 호버 지원 확인
        return state.supportsHover || checkApplePencilHover();
    }
    
    // 공개 API
    return {
        init,
        showTooltip,
        updateTooltip,
        hideTooltip,
        updatePosition,
        isVisible: () => state.visible,
        supportsHover: supportsHoverOrPen,
        getCurrentItemId
    };
})();

export default ItemTooltip;
