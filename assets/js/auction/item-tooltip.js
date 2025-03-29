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
        
        // PC에서는 툴팁이 마우스 이벤트를 차단하지 않도록 설정
        if (!state.isMobile) {
            tooltipElement.style.pointerEvents = "none";
        } else {
            // 모바일에서는 툴팁을 터치 가능하게 설정
            tooltipElement.style.pointerEvents = "auto";
            
            // 툴팁을 터치했을 때 숨기기
            tooltipElement.addEventListener('click', (e) => {
                e.stopPropagation();
                hideTooltip();
            });
            
            // 외부 영역 클릭 시 툴팁 숨김 (모바일 전용)
            document.addEventListener('click', (e) => {
                if (state.visible && 
                    !e.target.closest('.item-row') && 
                    !e.target.closest('#item-tooltip')) {
                    hideTooltip();
                }
            });
        }
        
        state.initialized = true;
        console.log(`툴팁 초기화 완료 (${state.isMobile ? '모바일' : 'PC'} 환경)`);
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
        
        // 상태 업데이트
        state.currentItemId = itemData.auction_item_no || '';
        state.visible = true;
        
        // 툴팁 표시
        tooltipElement.style.display = 'block';
        
        // 위치 계산 및 적용
        calculatePosition(x, y);
    }
    
    /**
     * 툴팁 위치 계산 및 적용
     */
    function calculatePosition(x, y) {
        if (!tooltipElement || !state.visible) return;
        
        // 툴팁 크기
        const tooltipWidth = tooltipElement.offsetWidth;
        const tooltipHeight = tooltipElement.offsetHeight;
        
        // 화면 크기
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // 기본 위치 (커서 오른쪽)
        let left = x + 15; // 커서 오른쪽에 15px 여백
        let top = y;       // 커서와 동일한 높이
        
        // 화면 경계 확인 (5px 여백 유지)
        const margin = 5;
        
        // 오른쪽 경계 처리
        if (left + tooltipWidth > windowWidth - margin) {
            left = windowWidth - tooltipWidth - margin;
        }
        
        // 하단 경계 처리
        if (top + tooltipHeight > windowHeight - margin) {
            top = windowHeight - tooltipHeight - margin;
        }
        
        // 위치가 음수가 되지 않도록 보정
        left = Math.max(margin, left);
        top = Math.max(margin, top);
        
        // 위치 적용
        tooltipElement.style.left = `${Math.round(left)}px`;
        tooltipElement.style.top = `${Math.round(top)}px`;
    }
    
    /**
     * 툴팁 내용 및 위치 업데이트
     */
    function updateTooltip(itemData, x, y) {
        if (!tooltipElement) return;
        
        const newItemId = itemData.auction_item_no || '';
        
        // 같은 아이템이면 위치만 업데이트
        if (state.currentItemId === newItemId && state.visible) {
            calculatePosition(x, y);
            return;
        }
        
        // 다른 아이템이면 내용 업데이트 (showTooltip 호출)
        showTooltip(itemData, x, y);
    }
    
    /**
     * 툴팁 숨기기
     */
    function hideTooltip() {
        if (!tooltipElement) return;
        
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
        updatePosition: calculatePosition,
        isVisible,
        getCurrentItemId,
        isMobileDevice
    };
})();

export default ItemTooltip;
