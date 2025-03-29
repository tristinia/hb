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
        lastPosition: { x: 0, y: 0 },
        positionLocked: false, // 위치 고정 상태 추가
        updateThrottle: false  // 업데이트 제한을 위한 플래그
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
            tooltipElement.addEventListener('touchstart', hideTooltip);
        }
        
        // 문서 클릭 시 툴팁 닫기
        document.addEventListener('click', (event) => {
            if (state.visible && tooltipElement && 
                !tooltipElement.contains(event.target) && 
                !event.target.closest('.item-row')) {
                hideTooltip();
            }
        });
        
        // 화면 스크롤 시 툴팁 위치 조정
        window.addEventListener('scroll', () => {
            if (state.visible && !state.updateThrottle) {
                state.updateThrottle = true;
                
                // 스크롤 중 재계산 제한 (성능 최적화)
                setTimeout(() => {
                    updatePosition(state.lastPosition.x, state.lastPosition.y);
                    state.updateThrottle = false;
                }, 100);
            }
        });
        
        // 화면 크기 변경 시 툴팁 위치 조정
        window.addEventListener('resize', () => {
            if (state.visible && !state.updateThrottle) {
                state.updateThrottle = true;
                
                // 크기 변경 중 재계산 제한 (성능 최적화)
                setTimeout(() => {
                    updatePosition(state.lastPosition.x, state.lastPosition.y);
                    state.updateThrottle = false;
                }, 100);
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
        
        // 이전과 동일한 아이템이면서 위치가 크게 변하지 않았으면 업데이트 건너뛰기
        if (state.visible && state.lastItemData === itemData) {
            const dx = Math.abs(x - state.lastPosition.x);
            const dy = Math.abs(y - state.lastPosition.y);
            
            // 위치가 10px 이상 변하지 않았으면 업데이트 건너뛰기
            if (dx < 10 && dy < 10) {
                return;
            }
        }
        
        // 위치 저장
        state.lastPosition = { x, y };
        state.lastItemData = itemData;
        
        // 툴팁이 이미 표시 중이면 내용만 업데이트
        if (state.visible) {
            updateTooltipContent(itemData);
            updatePosition(x, y);
            return;
        }
        
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
        state.positionLocked = false;
        
        // 브라우저 렌더링 완료 후 실행
        requestAnimationFrame(() => {
            // 위치 계산 및 설정
            calculateAndSetPosition(x, y);
            
            // 표시 효과
            tooltipElement.style.opacity = '1';
            tooltipElement.style.transition = 'opacity 0.1s ease-in-out';
        });
    }
    
    /**
     * 툴팁 내용 업데이트
     * @param {Object} itemData - 아이템 데이터
     */
    function updateTooltipContent(itemData) {
        if (!tooltipElement || !itemData) return;
        
        tooltipElement.innerHTML = '';
        const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
        tooltipElement.appendChild(tooltipContent);
    }
    
    /**
     * 최적의 툴팁 위치 계산 및 설정
     * @param {number} x - 마우스 X 좌표
     * @param {number} y - 마우스 Y 좌표
     */
    function calculateAndSetPosition(x, y) {
        if (!tooltipElement) return;
        
        // 툴팁 크기 측정
        const tooltipRect = tooltipElement.getBoundingClientRect();
        const tooltipWidth = tooltipRect.width;
        const tooltipHeight = tooltipRect.height;
        
        // 화면 크기
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // 기본 위치 (마우스 오른쪽)
        let left = x + 15;
        let top = y - 10;
        
        // 오른쪽 경계 검사
        if (left + tooltipWidth > windowWidth) {
            // 오른쪽 공간이 부족하면 왼쪽에 배치
            left = Math.max(0, x - tooltipWidth - 15);
            
            // 왼쪽도 공간이 부족하면 화면 오른쪽 경계에 맞춤
            if (left < 0) {
                left = Math.max(0, windowWidth - tooltipWidth);
            }
        }
        
        // 아래쪽 경계 검사
        if (top + tooltipHeight > windowHeight) {
            // 아래쪽 공간이 부족하면 위쪽에 배치
            top = Math.max(0, y - tooltipHeight - 10);
            
            // 위쪽도 공간이 부족하면 화면 아래쪽 경계에 맞춤
            if (top < 0) {
                top = Math.max(0, windowHeight - tooltipHeight);
            }
        }
        
        // 위치 설정
        tooltipElement.style.left = `${left}px`;
        tooltipElement.style.top = `${top}px`;
        
        // 위치 고정 상태 기록
        state.positionLocked = 
            (left <= 0) || 
            (left >= windowWidth - tooltipWidth) || 
            (top <= 0) || 
            (top >= windowHeight - tooltipHeight);
    }
    
    /**
     * 툴팁 위치 업데이트
     * @param {number} x - 마우스 X 좌표
     * @param {number} y - 마우스 Y 좌표
     */
    function updatePosition(x, y) {
        if (!tooltipElement || !state.visible) return;
        
        // 위치가 화면 경계에 고정된 상태면 작은 마우스 움직임에는 반응하지 않음
        if (state.positionLocked) {
            const dx = Math.abs(x - state.lastPosition.x);
            const dy = Math.abs(y - state.lastPosition.y);
            
            // 마우스가 20px 이상 이동했을 때만 재계산
            if (dx < 20 && dy < 20) {
                return;
            }
        }
        
        // 위치 저장
        state.lastPosition = { x, y };
        
        // 쓰로틀링 적용하여 너무 자주 업데이트되는 것 방지
        if (state.updateThrottle) return;
        
        state.updateThrottle = true;
        
        // 위치 계산 및 설정
        calculateAndSetPosition(x, y);
        
        // 쓰로틀 해제 (16ms = 약 60fps)
        setTimeout(() => {
            state.updateThrottle = false;
        }, 16);
    }
    
    /**
     * 툴팁 숨기기
     */
    function hideTooltip() {
        if (!tooltipElement) return;
        
        tooltipElement.style.transition = 'opacity 0.1s ease-in-out';
        tooltipElement.style.opacity = '0';
        
        // 페이드 아웃 후 툴팁 제거
        setTimeout(() => {
            tooltipElement.style.display = 'none';
            tooltipElement.innerHTML = '';
            state.visible = false;
        }, 100);
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
