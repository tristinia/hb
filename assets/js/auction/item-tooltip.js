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
        isMobile: false
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
        
        // PC에서는 마우스 이벤트를 차단하지 않음 (하단 요소 감지 위해)
        tooltipElement.style.pointerEvents = 'none';
        
        state.initialized = true;
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
            // 모바일: 터치 위치 위에 표시 (손가락에 가려지지 않게)
            left = x - (tooltipWidth / 2); // 터치 지점 중앙 정렬
            top = y - tooltipHeight - 20;   // 터치 지점 위쪽에 20px 여백
        } else {
            // PC: 마우스 커서 우측에 표시
            left = x + 15;
            top = y - 10;
        }
        
        // 화면 경계 처리 (PC/모바일 공통)
        
        // 오른쪽 경계
        if (left + tooltipWidth > windowWidth) {
            left = windowWidth - tooltipWidth - 5;
        }
        
        // 왼쪽 경계
        if (left < 5) {
            left = 5;
        }
        
        // 아래쪽 경계
        if (top + tooltipHeight > windowHeight) {
            top = windowHeight - tooltipHeight - 5;
        }
        
        // 위쪽 경계
        if (top < 5) {
            if (state.isMobile) {
                // 모바일: 터치 위치 아래에 표시 (공간 부족 시)
                top = y + 20;
            } else {
                top = 5;
            }
        }
        
        // 위치 설정 (깜빡임 방지를 위해 정수로 반올림)
        tooltipElement.style.left = `${Math.round(left)}px`;
        tooltipElement.style.top = `${Math.round(top)}px`;
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
