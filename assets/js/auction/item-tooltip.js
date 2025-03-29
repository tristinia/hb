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
        lastUpdateTime: 0       // 마지막 업데이트 시간 (깜빡임 방지용)
    };

    // DOM 요소
    let tooltipElement = null;
    
    /**
     * 모듈 초기화
     */
    function init() {
        // 이미 초기화되었으면 무시
        if (state.initialized) return;
        
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
        
        // 툴팁에 스타일 추가 - 모바일에서 리스트 호버 효과 덮기 위한 설정
        tooltipElement.style.pointerEvents = 'auto';
        
        // 이벤트 리스너 등록
        setupEventListeners();
        
        state.initialized = true;
        console.log('ItemTooltip 모듈 초기화 완료');
    }
    
    /**
     * 이벤트 리스너 설정
     */
    function setupEventListeners() {
        if (tooltipElement) {
            // 툴팁이 마우스 이벤트를 방해하지 않도록 설정
            tooltipElement.style.pointerEvents = 'none';
            
            // 모바일 환경에서는 툴팁을 터치하여 닫기 기능 유지
            tooltipElement.addEventListener('touchstart', function(e) {
                e.stopPropagation();
                hideTooltip();
            });
            
            // 모바일에서 터치 인식을 위해 필요한 부분만 포인터 이벤트 활성화
            const closeButton = document.createElement('div');
            closeButton.className = 'tooltip-close-button';
            closeButton.innerHTML = '×';
            closeButton.style.position = 'absolute';
            closeButton.style.top = '5px';
            closeButton.style.right = '5px';
            closeButton.style.width = '24px';
            closeButton.style.height = '24px';
            closeButton.style.background = 'rgba(0,0,0,0.3)';
            closeButton.style.color = '#fff';
            closeButton.style.borderRadius = '50%';
            closeButton.style.display = 'flex';
            closeButton.style.alignItems = 'center';
            closeButton.style.justifyContent = 'center';
            closeButton.style.cursor = 'pointer';
            closeButton.style.pointerEvents = 'auto'; // 이 버튼만 이벤트 반응
            closeButton.style.zIndex = '2';
            
            closeButton.addEventListener('click', hideTooltip);
            closeButton.addEventListener('touchstart', function(e) {
                e.stopPropagation();
                hideTooltip();
            });
            
            tooltipElement.appendChild(closeButton);
        }
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
        
        // 툴팁을 화면 밖에서 완전히 숨김
        tooltipElement.style.display = 'block';
        tooltipElement.style.opacity = '0';
        
        // 상태 업데이트
        state.visible = true;
        state.lastItemData = itemData;
        state.lastUpdateTime = Date.now();
        
        // 브라우저 렌더링 완료 후 실행
        requestAnimationFrame(() => {
            // 툴팁 크기 정확히 측정
            const tooltipHeight = tooltipElement.offsetHeight;
            const tooltipWidth = tooltipElement.offsetWidth;
            
            // 화면 크기
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            // 위치 계산 - 마우스 오른쪽, 같은 높이에 표시
            let left = x + 15;  // 마우스 오른쪽
            let top = y;        // 마우스와 같은 높이 
            
            // 오른쪽 경계 검사
            if (left + tooltipWidth > windowWidth) {
                left = windowWidth - tooltipWidth - 5;
            }
            
            // 아래쪽 경계 검사
            if (top + tooltipHeight > windowHeight) {
                top = windowHeight - tooltipHeight - 5;
            }
            
            // 위치 설정 후 표시
            tooltipElement.style.left = `${left}px`;
            tooltipElement.style.top = `${top}px`;
            tooltipElement.style.opacity = '1';
            
            // z-index 더 높게 설정하여 항상 위에 표시
            tooltipElement.style.zIndex = '1001';
        });
    }
    
    /**
     * 툴팁 위치 업데이트 - 깜빡임 방지 로직 추가
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
        
        // 마우스 오른쪽에 배치 (기준점)
        let left = x + 15;
        let top = y;
        
        // 오른쪽 경계 검사
        if (left + tooltipWidth > windowWidth) {
            left = windowWidth - tooltipWidth;
        }
        
        // 아래쪽 경계 검사
        if (top + tooltipHeight > windowHeight) {
            top = windowHeight - tooltipHeight;
        }
        
        // 부드러운 움직임을 위한 트랜지션 적용
        if (!tooltipElement.style.transition) {
            tooltipElement.style.transition = 'left 0.1s ease-out, top 0.1s ease-out';
        }
        
        // 위치 업데이트
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
        isVisible: () => state.visible
    };
})();

export default ItemTooltip;
