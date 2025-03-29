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
        supportsHover: false     // 호버 지원 여부
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
        
        // 포인터 이벤트 설정
        tooltipElement.style.pointerEvents = 'auto';
        
        // 호버 지원 여부에 따른 이벤트 처리 분기
        if (!state.supportsHover || 'ontouchstart' in window) {
            // 터치 기기에서만 터치로 툴팁 닫기 활성화
            tooltipElement.addEventListener('touchstart', function(e) {
                e.stopPropagation();
                e.preventDefault();
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
        state.lastUpdateTime = Date.now();
        
        // 위치 즉시 업데이트
        updatePosition(x, y);
    }
    
    /**
     * 툴팁 위치 업데이트
     * @param {number} x - 마우스 X 좌표
     * @param {number} y - 마우스 Y 좌표
     */
    function updatePosition(x, y) {
        if (!tooltipElement || !state.visible) return;
        
        // 툴팁 크기 측정
        const tooltipWidth = tooltipElement.offsetWidth;
        const tooltipHeight = tooltipElement.offsetHeight;
        
        // 화면 크기
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // 기본 위치 계산
        let left = x + 15;
        let top = y + 5;
        
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
            top = windowHeight - tooltipHeight - 5;
        }
        
        // 위쪽 경계 검사
        if (top < 5) {
            top = 5;
        }
        
        // 위치 즉시 업데이트
        tooltipElement.style.left = `${left}px`;
        tooltipElement.style.top = `${top}px`;
    }
    
    /**
     * 툴팁 숨기기
     */
    function hideTooltip() {
        if (!tooltipElement) return;
        
        tooltipElement.style.display = 'none';
        tooltipElement.innerHTML = '';
        state.visible = false;
    }
    
    // 공개 API
    return {
        init,
        showTooltip,
        hideTooltip,
        updatePosition,
        isVisible: () => state.visible,
        supportsHover: () => state.supportsHover
    };
})();

export default ItemTooltip;
