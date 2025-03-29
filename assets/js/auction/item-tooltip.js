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
        isMobile: false,
        lastPosition: { x: 0, y: 0 }, // 마지막 위치 저장 변수 추가
        updatePending: false // 위치 업데이트 예약 상태
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
        tooltipElement.style.willChange = 'transform'; // 브라우저 최적화 힌트 추가
        
        // PC와 모바일에서 다른 이벤트 처리
        if (state.isMobile) {
            // 모바일: 툴팁 클릭 시 닫기
            tooltipElement.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                hideTooltip();
            });
        } else {
            // PC: 툴팁 위에서 이벤트 전파 방지 (깜빡임 해결의 핵심)
            tooltipElement.addEventListener('mouseover', (e) => {
                e.stopPropagation();
            });
            
            tooltipElement.addEventListener('mouseout', (e) => {
                // 툴팁에서 다른 요소로 마우스가 이동할 때만 처리
                if (!e.relatedTarget || !tooltipElement.contains(e.relatedTarget)) {
                    hideTooltip();
                }
                e.stopPropagation();
            });
        }
        
        state.initialized = true;
    }
    
    /**
     * 툴팁 표시
     */
    function showTooltip(itemData, x, y, rowElement) {
        if (!tooltipElement || !itemData) return;
        
        // 이전 행 상태 저장 및 업데이트
        if (state.currentRow && state.currentRow !== rowElement) {
            state.currentRow.classList.remove('hovered');
        }
        
        if (rowElement) {
            rowElement.classList.add('hovered');
            state.currentRow = rowElement;
        }
        
        // 툴팁 내용 생성
        tooltipElement.innerHTML = '';
        const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
        tooltipElement.appendChild(tooltipContent);
        
        // PC에서는 마우스 이벤트 방지 (깜빡임 해결)
        if (!state.isMobile) {
            tooltipElement.style.pointerEvents = 'auto';
        }
        
        // 툴팁 표시 전에 위치 설정 (깜빡임 방지)
        tooltipElement.style.left = '0px';
        tooltipElement.style.top = '0px';
        tooltipElement.style.transform = `translate(${x + 15}px, ${y + 5}px)`;
        
        // 툴팁 표시
        tooltipElement.style.display = 'block';
        
        // 상태 업데이트
        state.visible = true;
        state.currentItemId = itemData.auction_item_no || '';
        
        // 위치 설정 저장
        state.lastPosition = { x, y };
        
        // 다음 프레임에서 정확한 위치 업데이트 (경계 확인 포함)
        requestAnimationFrame(() => {
            updatePosition(x, y);
        });
    }
    
    /**
     * 툴팁 내용 업데이트
     */
    function updateTooltip(itemData, x, y, rowElement) {
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
        
        // 행 상태 업데이트
        if (state.currentRow && state.currentRow !== rowElement) {
            state.currentRow.classList.remove('hovered');
        }
        
        if (rowElement) {
            rowElement.classList.add('hovered');
            state.currentRow = rowElement;
        }
        
        // 상태 업데이트
        state.currentItemId = itemData.auction_item_no || '';
        
        // 위치 업데이트
        updatePosition(x, y);
    }
    
    /**
     * 툴팁 위치 업데이트 - 부드러운 움직임 지원
     */
    function updatePosition(x, y) {
        if (!tooltipElement || !state.visible) return;
        
        // 마지막 위치와 비교하여 큰 변화가 있을 때만 업데이트
        const distanceSquared = Math.pow(x - state.lastPosition.x, 2) + Math.pow(y - state.lastPosition.y, 2);
        const isMajorMove = distanceSquared > 4; // 2px 이상 움직였을 때만 위치 계산
        
        // 작은 움직임은 transform만 업데이트
        if (!isMajorMove) {
            tooltipElement.style.transform = `translate(${x + 15}px, ${y + 5}px)`;
            state.lastPosition = { x, y };
            return;
        }

        // 위치 업데이트가 이미 예약되어 있으면 중복 실행 방지
        if (state.updatePending) return;
        
        // 위치 업데이트 예약
        state.updatePending = true;
        
        // 애니메이션 프레임에 위치 업데이트 예약 (부드러운 움직임)
        requestAnimationFrame(() => {
            // 툴팁 크기
            const tooltipWidth = tooltipElement.offsetWidth;
            const tooltipHeight = tooltipElement.offsetHeight;
            
            // 화면 크기
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            // 위치 계산 (기본)
            let left = x + 15; // 커서 우측에 15px 여백
            let top = y + 5;   // 커서 아래쪽에 5px 여백
            
            // 화면 경계 처리
            const rightMargin = 5;
            const maxLeft = windowWidth - tooltipWidth - rightMargin;
            if (left > maxLeft) {
                left = maxLeft;
            }
            
            const bottomMargin = 5;
            const maxTop = windowHeight - tooltipHeight - bottomMargin;
            if (top > maxTop) {
                top = maxTop;
            }
            
            // 정수 좌표로 변환
            left = Math.round(left);
            top = Math.round(top);
            
            // 직접 위치 설정 (transform 대신 left/top 속성 사용)
            tooltipElement.style.transform = '';
            tooltipElement.style.left = `${left}px`;
            tooltipElement.style.top = `${top}px`;
            
            // 마지막 위치 저장
            state.lastPosition = { x, y };
            
            // 업데이트 예약 상태 해제
            state.updatePending = false;
        });
    }
    
    /**
     * 툴팁 숨기기
     */
    function hideTooltip() {
        if (!tooltipElement) return;
        
        // 현재 행의 강조 제거
        if (state.currentRow) {
            state.currentRow.classList.remove('hovered');
            state.currentRow = null;
        }
        
        tooltipElement.style.display = 'none';
        tooltipElement.innerHTML = '';
        state.visible = false;
        state.currentItemId = null;
        state.updatePending = false;
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
        getCurrentItemId,
        isMobileDevice
    };
})();

export default ItemTooltip;
