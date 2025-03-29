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
        mousePosition: { x: 0, y: 0 },
        animationFrameId: null
    };

    // DOM 요소
    let tooltipElement = null;
    let tooltipParent = null;
    
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
        
        // 툴팁 부모 저장
        tooltipParent = tooltipElement.parentNode;
        
        // 기본 스타일 설정
        tooltipElement.style.position = 'fixed';
        tooltipElement.style.display = 'none';
        tooltipElement.style.zIndex = '1001';
        
        // PC와 모바일에서 다른 이벤트 처리
        if (state.isMobile) {
            // 모바일: 터치 이벤트로 아이템 클릭과 툴팁 터치 구분
            document.addEventListener('click', (e) => {
                if (state.visible) {
                    // 툴팁을 터치한 경우
                    if (e.target.closest('#item-tooltip')) {
                        e.preventDefault();
                        hideTooltip();
                        return;
                    }
                    
                    // 다른 아이템 행을 터치한 경우
                    const itemRow = e.target.closest('.item-row');
                    if (itemRow) {
                        e.preventDefault();
                        handleItemRowClick(itemRow, e.clientX, e.clientY);
                        return;
                    }
                    
                    // 다른 영역 터치 시 툴팁 닫기
                    hideTooltip();
                }
            });
        } else {
            // PC: 전역 마우스 이동 추적 (툴팁 부드러운 이동 핵심)
            document.addEventListener('mousemove', (e) => {
                if (state.visible) {
                    // 현재 마우스 위치 저장
                    state.mousePosition.x = e.clientX;
                    state.mousePosition.y = e.clientY;
                    
                    // 마우스 아래 실제 요소 감지를 위한 특별 처리 (핵심!)
                    checkElementUnderMouse(e.clientX, e.clientY);
                }
            });
            
            // 문서 클릭 시 툴팁 숨기기 (테이블 외 영역 클릭)
            document.addEventListener('click', (e) => {
                if (state.visible) {
                    // 툴팁이나 아이템 행 클릭 시 유지
                    if (e.target.closest('#item-tooltip') || e.target.closest('.item-row')) {
                        return;
                    }
                    hideTooltip();
                }
            });
        }
        
        state.initialized = true;
    }
    
    /**
     * 마우스 아래 요소 확인 (PC 전용)
     */
    function checkElementUnderMouse(x, y) {
        // 현재 툴팁 상태 저장
        const tooltipDisplay = tooltipElement.style.display;
        const tooltipHtml = tooltipElement.innerHTML;
        
        try {
            // 툴팁을 완전히 제거하여 아래 요소 확인
            if (tooltipParent) {
                tooltipParent.removeChild(tooltipElement);
            }
            
            // 실제 마우스 아래 요소 확인
            const elementUnderMouse = document.elementFromPoint(x, y);
            
            // 툴팁 복원
            if (tooltipParent) {
                tooltipParent.appendChild(tooltipElement);
                tooltipElement.style.display = tooltipDisplay;
                
                // 아이템 행인지 확인
                if (elementUnderMouse) {
                    const itemRow = elementUnderMouse.closest('.item-row');
                    if (itemRow && (!state.currentRow || itemRow !== state.currentRow)) {
                        // 새 아이템 행 발견, 툴팁 업데이트
                        updateTooltipForRow(itemRow, x, y);
                    }
                }
            }
        } catch (error) {
            // 오류 발생 시 툴팁 복원 시도
            console.error('요소 확인 중 오류:', error);
            if (tooltipElement && tooltipParent && !tooltipElement.parentNode) {
                tooltipParent.appendChild(tooltipElement);
                tooltipElement.style.display = tooltipDisplay;
                tooltipElement.innerHTML = tooltipHtml;
            }
        }
    }
    
    /**
     * 아이템 행 클릭 처리 (모바일 전용)
     */
    function handleItemRowClick(itemRow, x, y) {
        try {
            // 아이템 데이터 가져오기
            const itemDataStr = itemRow.getAttribute('data-item');
            if (!itemDataStr) return;
            
            const itemData = JSON.parse(itemDataStr);
            const newItemId = itemData.auction_item_no || '';
            
            // 같은 아이템 재클릭 시 툴팁 숨김
            if (state.currentItemId === newItemId) {
                hideTooltip();
                return;
            }
            
            // 다른 아이템이면 툴팁 갱신
            if (state.currentRow) {
                state.currentRow.classList.remove('hovered');
            }
            
            itemRow.classList.add('hovered');
            state.currentRow = itemRow;
            
            // 툴팁 내용 갱신
            tooltipElement.innerHTML = '';
            const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
            tooltipElement.appendChild(tooltipContent);
            
            // 상태 업데이트
            state.currentItemId = newItemId;
            state.visible = true;
            
            // 위치 업데이트
            updatePosition(x, y);
            
            // 표시
            tooltipElement.style.display = 'block';
        } catch (error) {
            console.error('아이템 클릭 처리 오류:', error);
        }
    }
    
    /**
     * 새 행에 대한 툴팁 업데이트
     */
    function updateTooltipForRow(itemRow, x, y) {
        try {
            // 아이템 데이터 가져오기
            const itemDataStr = itemRow.getAttribute('data-item');
            if (!itemDataStr) return;
            
            const itemData = JSON.parse(itemDataStr);
            const newItemId = itemData.auction_item_no || '';
            
            // 이미 같은 아이템이면 무시
            if (state.currentItemId === newItemId) return;
            
            // 이전 행 강조 제거
            if (state.currentRow) {
                state.currentRow.classList.remove('hovered');
            }
            
            // 새 행 강조
            itemRow.classList.add('hovered');
            state.currentRow = itemRow;
            
            // 툴팁 내용 업데이트
            tooltipElement.innerHTML = '';
            const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
            tooltipElement.appendChild(tooltipContent);
            
            // 상태 업데이트
            state.currentItemId = newItemId;
        } catch (error) {
            console.error('툴팁 행 업데이트 오류:', error);
        }
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
        
        // 툴팁 표시
        tooltipElement.style.display = 'block';
        
        // 초기 위치 설정
        tooltipElement.style.left = '0px';
        tooltipElement.style.top = '0px';
        
        // 초기 마우스 위치 설정
        state.mousePosition = { x, y };
        
        // 상태 업데이트
        state.visible = true;
        state.currentItemId = itemData.auction_item_no || '';
        
        // 애니메이션 시작 (PC에서만)
        if (!state.isMobile) {
            startPositionAnimation();
        } else {
            // 모바일에서는 한 번만 위치 설정
            updatePosition(x, y);
        }
    }
    
    /**
     * 위치 애니메이션 시작
     */
    function startPositionAnimation() {
        // 기존 애니메이션 중지
        if (state.animationFrameId) {
            cancelAnimationFrame(state.animationFrameId);
        }
        
        // 애니메이션 프레임 함수
        function animatePosition() {
            // 툴팁이 표시 중일 때만 위치 업데이트
            if (state.visible) {
                updatePosition(state.mousePosition.x, state.mousePosition.y);
                state.animationFrameId = requestAnimationFrame(animatePosition);
            }
        }
        
        // 애니메이션 시작
        state.animationFrameId = requestAnimationFrame(animatePosition);
    }
    
    /**
     * 툴팁 내용 업데이트
     */
    function updateTooltip(itemData, x, y, rowElement) {
        if (!tooltipElement || !itemData) return;
        
        // 같은 아이템이면 위치만 업데이트
        if (state.currentItemId === (itemData.auction_item_no || '')) {
            state.mousePosition = { x, y };
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
        
        // 마우스 위치 업데이트
        state.mousePosition = { x, y };
    }
    
    /**
     * 툴팁 위치 업데이트 - 화면 경계 처리 포함
     */
    function updatePosition(x, y) {
        if (!tooltipElement || !state.visible) return;
        
        // 툴팁 크기
        const tooltipWidth = tooltipElement.offsetWidth;
        const tooltipHeight = tooltipElement.offsetHeight;
        
        // 화면 크기
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // 위치 계산 (기존 로직 유지)
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
        
        // 좌측 경계도 확인
        if (left < 5) {
            left = 5;
        }
        
        // 상단 경계도 확인
        if (top < 5) {
            top = 5;
        }
        
        // 위치 고정 (정수값으로 고정)
        tooltipElement.style.left = `${Math.round(left)}px`;
        tooltipElement.style.top = `${Math.round(top)}px`;
    }
    
    /**
     * 툴팁 숨기기
     */
    function hideTooltip() {
        if (!tooltipElement) return;
        
        // 애니메이션 중지
        if (state.animationFrameId) {
            cancelAnimationFrame(state.animationFrameId);
            state.animationFrameId = null;
        }
        
        // 현재 행의 강조 제거
        if (state.currentRow) {
            state.currentRow.classList.remove('hovered');
            state.currentRow = null;
        }
        
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
