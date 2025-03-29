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
        
        // 모바일 환경에서만 포인터 이벤트 설정
        if (state.isMobile) {
            // 모바일에서는 툴팁 자체 클릭 가능
            tooltipElement.style.pointerEvents = "auto";
            
            // 툴팁 클릭 시 닫기
            tooltipElement.addEventListener('click', function(e) {
                e.stopPropagation();
                hideTooltip();
            });
        } else {
            // PC에서는 툴팁이 마우스 이벤트를 차단하지 않도록 설정
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
        
        // 기본 위치 (커서 오른쪽)
        let left = x + 15; // 마우스/터치에서 15px 오른쪽으로
        let top = y;
        
        // 화면 경계 확인
        const margin = state.tooltipMargin;
        
        // 오른쪽 경계 넘어가면 조정
        if (left + tooltipWidth > windowWidth - margin) {
            left = windowWidth - tooltipWidth - margin;
        }
        
        // 하단 경계 넘어가면 조정
        if (top + tooltipHeight > windowHeight - margin) {
            top = windowHeight - tooltipHeight - margin;
        }
        
        // 왼쪽 경계 넘어가면 조정
        if (left < margin) {
            left = margin;
        }
        
        // 상단 경계 넘어가면 조정
        if (top < margin) {
            top = margin;
        }
        
        // 위치 적용 (반올림하여 픽셀 경계 깨짐 방지)
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
        // 현재 표시 중인 아이템과 다른 경우만 업데이트
        const newItemId = itemData.auction_item_no || '';
        
        if (state.currentItemId !== newItemId) {
            showTooltip(itemData, x, y);
        } else if (state.visible) {
            // 같은 아이템이면 위치만 업데이트
            calculatePosition(x, y);
        }
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
     * @returns {string} 현재 아이템 ID
     */
    function getCurrentItemId() {
        return state.currentItemId;
    }
    
    /**
     * 모바일 환경 여부 확인
     * @returns {boolean} 모바일 여부
     */
    function isMobileDevice() {
        return state.isMobile;
    }
    
    /**
     * 툴팁 표시 여부 확인
     * @returns {boolean} 표시 여부
     */
    function isVisible() {
        return state.visible;
    }
    
    /**
     * 툴팁 요소 가져오기
     * @returns {HTMLElement} 툴팁 요소
     */
    function getElement() {
        return tooltipElement;
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
        isMobileDevice,
        getElement
    };
})();

export default ItemTooltip;
