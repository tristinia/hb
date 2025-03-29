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
        tooltipMargin: 5 // 화면 경계에서 유지할 여백
    };

    // DOM 요소
    let tooltipElement = null;
    
    /**
     * 모듈 초기화
     */
    function init() {
        if (state.initialized) return;
        
        // 모바일 여부 감지
        state.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
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
        
        // 모바일에서는 툴팁 터치 가능
        if (state.isMobile) {
            tooltipElement.style.pointerEvents = "auto";
            
            // 모바일 환경에서 툴팁 클릭 이벤트
            tooltipElement.addEventListener('click', (e) => {
                e.stopPropagation();
                hideTooltip();
            });
        } else {
            // PC에서는 툴팁이 마우스 이벤트를 무시
            tooltipElement.style.pointerEvents = "none";
        }
        
        state.initialized = true;
        console.log(`툴팁 초기화 완료 (${state.isMobile ? '모바일' : 'PC'} 환경)`);
    }
    
    /**
     * 툴팁 표시
     * @param {Object} itemData - 아이템 데이터
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     */
    function showTooltip(itemData, x, y) {
        if (!tooltipElement || !itemData) return;
        
        // 툴팁 내용 생성
        tooltipElement.innerHTML = '';
        const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
        tooltipElement.appendChild(tooltipContent);
        
        // 먼저 표시하고 크기 측정 위해 숨김 상태로 설정
        tooltipElement.style.visibility = 'hidden';
        tooltipElement.style.display = 'block';
        
        // 상태 업데이트
        state.currentItemId = itemData.auction_item_no || '';
        state.visible = true;
        
        // 위치 계산 및 적용
        calculatePosition(x, y);
        
        // 툴팁 표시
        tooltipElement.style.visibility = 'visible';
    }
    
    /**
     * 툴팁 위치 계산 및 적용
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     */
    function calculatePosition(x, y) {
        if (!tooltipElement || !state.visible) return;
        
        // 툴팁 크기 
        const tooltipWidth = tooltipElement.offsetWidth;
        const tooltipHeight = tooltipElement.offsetHeight;
        
        // 화면 크기
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // 기본 위치 (커서 오른쪽에 배치)
        let left = x + 15;
        let top = y;
        
        // 경계 여백
        const margin = state.tooltipMargin;
        
        // 오른쪽 경계 검사
        if (left + tooltipWidth > windowWidth - margin) {
            left = windowWidth - tooltipWidth - margin;
        }
        
        // 하단 경계 검사
        if (top + tooltipHeight > windowHeight - margin) {
            top = windowHeight - tooltipHeight - margin;
        }
        
        // 위치 적용 (반올림)
        tooltipElement.style.left = `${Math.round(left)}px`;
        tooltipElement.style.top = `${Math.round(top)}px`;
    }
    
    /**
     * 툴팁 내용 및 위치 업데이트
     * @param {Object} itemData - 아이템 데이터
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     */
    function updateTooltip(itemData, x, y) {
        // 항상 새로운 툴팁으로 갱신
        showTooltip(itemData, x, y);
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
    
    // 공개 API
    return {
        init,
        showTooltip,
        updateTooltip,
        hideTooltip,
        updatePosition: calculatePosition,
        isVisible: () => state.visible,
        getCurrentItemId: () => state.currentItemId,
        isMobileDevice: () => state.isMobile,
        getElement: () => tooltipElement
    };
})();

export default ItemTooltip;
