/**
 * item-tooltip.js
 * 아이템 툴팁 표시와 위치 계산을 담당하는 모듈
 */

import optionRenderer from './option-renderer.js';

const ItemTooltip = (() => {
    // 내부 상태
    const state = {
        initialized: false,
        visible: false,
        lastItemData: null,
        currentItemId: null,
        isMobile: false,
        lastUpdateTime: 0
    };

    // DOM 요소
    let tooltipElement = null;
    
    /**
     * 모듈 초기화
     */
    function init() {
        if (state.initialized) return;
        
        // 모바일 환경 감지
        state.isMobile = 'ontouchstart' in window;
        
        // 툴팁 요소 찾기 또는 생성
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
        
        // PC에서는 툴팁이 마우스 이벤트를 차단하지 않음
        tooltipElement.style.pointerEvents = 'none';
        
        state.initialized = true;
    }
    
    /**
     * 툴팁 표시
     */
    function showTooltip(itemData, x, y) {
        if (!tooltipElement || !itemData) return;
        
        // 내용 초기화 및 생성
        tooltipElement.innerHTML = '';
        const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
        tooltipElement.appendChild(tooltipContent);
        
        // 상태 업데이트
        state.visible = true;
        state.lastItemData = itemData;
        state.currentItemId = itemData.auction_item_no || '';
        
        // 위치 업데이트
        updatePosition(x, y);
        
        // 표시 설정
        tooltipElement.style.display = 'block';
    }
    
    /**
     * 툴팁 위치 업데이트 (쓰로틀링 적용)
     */
    function updatePosition(x, y) {
        if (!tooltipElement || !state.visible) return;
        
        // 업데이트 쓰로틀링 (50ms마다 업데이트)
        const now = Date.now();
        if (now - state.lastUpdateTime < 50) return;
        state.lastUpdateTime = now;
        
        // 툴팁 크기 측정
        const tooltipWidth = tooltipElement.offsetWidth;
        const tooltipHeight = tooltipElement.offsetHeight;
        
        // 화면 크기
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // 기본 위치 계산 (PC/모바일에 따라 다름)
        let left, top;
        
        if (state.isMobile) {
            // 모바일: 터치 위치 위쪽에 표시
            left = Math.max(5, Math.min(x - tooltipWidth / 2, windowWidth - tooltipWidth - 5));
            top = Math.max(5, y - tooltipHeight - 30);
            
            // 화면 하단에 가까우면 위로 표시, 상단에 가까우면 아래로 표시
            if (top < 10) {
                top = y + 30;
            }
        } else {
            // PC: 마우스 커서 오른쪽에 표시
            left = x + 15;
            top = y - 5;
            
            // 오른쪽 경계 체크
            if (left + tooltipWidth > windowWidth - 5) {
                left = x - tooltipWidth - 15;
            }
            
            // 왼쪽 경계 체크
            if (left < 5) {
                left = 5;
            }
            
            // 하단 경계 체크
            if (top + tooltipHeight > windowHeight - 5) {
                top = windowHeight - tooltipHeight - 5;
            }
            
            // 상단 경계 체크
            if (top < 5) {
                top = 5;
            }
        }
        
        // 위치 적용
        tooltipElement.style.left = `${Math.round(left)}px`;
        tooltipElement.style.top = `${Math.round(top)}px`;
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
        state.lastItemData = itemData;
        state.currentItemId = itemData.auction_item_no || '';
        
        // 위치 업데이트
        updatePosition(x, y);
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
     * 모바일 환경 여부 반환
     */
    function isMobile() {
        return state.isMobile;
    }
    
    /**
     * 현재 아이템 ID 반환
     */
    function getCurrentItemId() {
        return state.currentItemId;
    }
    
    // 공개 API
    return {
        init,
        showTooltip,
        updateTooltip,
        hideTooltip,
        updatePosition,
        isVisible: () => state.visible,
        isMobile,
        getCurrentItemId
    };
})();

export default ItemTooltip;
