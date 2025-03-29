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
        lastItemData: null
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
        
        // 이벤트 리스너 등록
        setupEventListeners();
        
        state.initialized = true;
        console.log('ItemTooltip 모듈 초기화 완료');
    }
    
    /**
     * 이벤트 리스너 설정
     */
    function setupEventListeners() {
        // 툴팁 자체에 클릭 이벤트 추가
        if (tooltipElement) {
            tooltipElement.addEventListener('click', hideTooltip);
            tooltipElement.addEventListener('touchstart', (e) => {
                // 이벤트 전파 방지
                e.stopPropagation();
                // 툴팁 닫기
                hideTooltip();
            });
        }
        
        // 문서 클릭 시 툴팁 닫기
        document.addEventListener('click', (event) => {
            if (state.visible && tooltipElement && 
                !tooltipElement.contains(event.target) && 
                !event.target.closest('.item-row')) {
                hideTooltip();
            }
        });
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
        tooltipElement.style.position = 'fixed';
        
        // 상태 업데이트
        state.visible = true;
        state.lastItemData = itemData;
        
        // 브라우저 렌더링 완료 후 실행
        requestAnimationFrame(() => {
            // 툴팁 크기 정확히 측정
            const tooltipHeight = tooltipElement.offsetHeight;
            const tooltipWidth = tooltipElement.offsetWidth;
            
            // 화면 크기
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            // 위치 계산
            let left = x + 15;
            let top = y - 10;
            
            // 오른쪽 경계 검사
            if (left + tooltipWidth > windowWidth) {
                left = windowWidth - tooltipWidth;
            }
            
            // 아래쪽 경계 검사
            if (top + tooltipHeight > windowHeight) {
                top = windowHeight - tooltipHeight;
            }
            
            // 위치 설정 후 표시
            tooltipElement.style.left = `${left}px`;
            tooltipElement.style.top = `${top}px`;
            tooltipElement.style.opacity = '1';
        });
    }
    
    /**
     * 툴팁 위치 업데이트 - 아래쪽 경계 특히 신경써서 처리
     * @param {number} x - 마우스 X 좌표
     * @param {number} y - 마우스 Y 좌표
     */
    function updatePosition(x, y) {
        if (!tooltipElement || !state.visible) return;
        
        // 화면 크기
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // 툴팁 크기 - 실제 렌더링된 크기 재측정
        const tooltipWidth = tooltipElement.offsetWidth;
        const tooltipHeight = tooltipElement.offsetHeight;
        
        // 기본 위치 (항상 마우스 오른쪽에 배치)
        const offsetX = 15; // 마우스와의 X축 간격
        const offsetY = 10; // 마우스와의 Y축 간격
        
        let left = x + offsetX;
        let top = y - offsetY;
        
        // 오른쪽 경계 검사
        if (left + tooltipWidth > windowWidth) {
            left = windowWidth - tooltipWidth;
        }
        
        // 아래쪽 경계 검사
        if (top + tooltipHeight > windowHeight) {
            top = windowHeight - tooltipHeight;
        }
        
        // 위치 적용
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
