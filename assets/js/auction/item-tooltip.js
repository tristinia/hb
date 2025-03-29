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
        tooltipElement.style.cursor = 'default';
        
        // 모바일 환경 감지 및 스타일 설정
        if ('ontouchstart' in window) {
            // 모바일에서는 포인터 이벤트 활성화 (클릭 처리를 위해)
            tooltipElement.style.pointerEvents = 'auto';
            
            // 모바일 환경에서 툴팁 터치 시 닫히도록 처리
            tooltipElement.addEventListener('touchstart', function(e) {
                e.stopPropagation();
                e.preventDefault();
                hideTooltip();
            });
            
            tooltipElement.addEventListener('click', function(e) {
                e.stopPropagation();
                hideTooltip();
            });
        } else {
            // PC 환경에서는 포인터 이벤트 비활성화
            tooltipElement.style.pointerEvents = 'none';
        }
        
        state.initialized = true;
        console.log('ItemTooltip 모듈 초기화 완료');
    }
    
    /**
     * 이벤트 리스너 설정
     */
    function setupEventListeners() {
        if (tooltipElement) {
            if (!('ontouchstart' in window)) {
                tooltipElement.style.pointerEvents = 'none';
            } else {
                tooltipElement.style.pointerEvents = 'auto';
            }
            
            // 모바일 환경에서는 툴팁을 터치하여 닫기
            tooltipElement.addEventListener('touchstart', function(e) {
                e.stopPropagation();
                hideTooltip();
            });
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
        
        // 툴팁 표시 설정
        tooltipElement.style.display = 'block';
        tooltipElement.style.opacity = '0';
        
        // 상태 업데이트
        state.visible = true;
        state.lastItemData = itemData;
        state.lastUpdateTime = Date.now();
        
        // 트랜지션 설정
        tooltipElement.style.transition = 'opacity 0.2s';
        
        // 브라우저 렌더링 완료 후 실행
        requestAnimationFrame(() => {
            updatePosition(x, y);
            tooltipElement.style.opacity = '1';
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
        
        // 기본 위치 계산 (마우스 오른쪽 약간 아래)
        let left = x + 15;
        let top = y + 5;
        
        // 오른쪽 경계 검사 - 화면 밖으로 나가지 않도록 조정
        if (left + tooltipWidth > windowWidth) {
            left = windowWidth - tooltipWidth - 5; // 우측 여백 5px 추가
        }
        
        // 왼쪽 경계 검사 - 최소 5px 여백 확보
        if (left < 5) {
            left = 5;
        }
        
        // 아래쪽 경계 검사 - 화면 밖으로 나가지 않도록 조정
        if (top + tooltipHeight > windowHeight) {
            top = windowHeight - tooltipHeight - 5; // 하단 여백 5px 추가
        }
        
        // 위쪽 경계 검사 - 최소 5px 여백 확보
        if (top < 5) {
            top = 5;
        }
        
        // 부드러운 움직임을 위한 트랜지션 설정
        tooltipElement.style.transition = 'left 0.1s ease-out, top 0.1s ease-out';
        
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
