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
        targetPosition: { x: 0, y: 0 }, // 목표 위치 (애니메이션 용)
        animationFrameId: null,
        hoverTimer: null
    };

    // DOM 요소
    let tooltipElement = null;
    
    /**
     * 모듈 초기화
     */
    function init() {
        if (state.initialized) return;
        
        // 모바일 여부 감지
        state.isMobile = ('ontouchstart' in window) && window.innerWidth <= 768;
        
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
        
        // PC와 모바일 환경에 따라 다른 설정
        if (state.isMobile) {
            // 모바일 환경
            setupMobileEvents();
        } else {
            // PC 환경
            setupPCEvents();
        }
        
        state.initialized = true;
        console.log(`툴팁 초기화 완료 (${state.isMobile ? '모바일' : 'PC'} 환경)`);
    }
    
    /**
     * PC 환경 이벤트 설정
     */
    function setupPCEvents() {
        // 결과 테이블에 마우스 이벤트 리스너 추가
        const resultsTable = document.querySelector('.results-table');
        if (resultsTable) {
            // 테이블 전체에 mousemove 이벤트 등록
            resultsTable.addEventListener('mousemove', handleMouseMove);
            
            // 테이블에서 마우스가 나갈 때
            resultsTable.addEventListener('mouseleave', function(e) {
                // 테이블 밖으로 마우스가 완전히 나갔을 때만 툴팁 숨김
                if (!e.relatedTarget || !e.relatedTarget.closest('.results-table')) {
                    hideTooltip();
                }
            });
        }
        
        // PC에서는 툴팁이 마우스 이벤트를 차단하지 않도록 설정
        tooltipElement.style.pointerEvents = "none";
    }
    
    /**
     * 모바일 환경 이벤트 설정
     */
    function setupMobileEvents() {
        // 모바일에서는 툴팁이 터치 이벤트를 캡처하도록 설정
        tooltipElement.style.pointerEvents = "auto";
        
        // 결과 테이블에 터치 이벤트 리스너 추가
        const resultsTable = document.querySelector('.results-table');
        if (resultsTable) {
            // 아이템 터치 처리
            resultsTable.addEventListener('click', handleItemClick);
            
            // 터치 관련 이벤트 추가
            resultsTable.addEventListener('touchstart', handleTouchStart, { passive: true });
            resultsTable.addEventListener('touchend', handleTouchEnd);
        }
        
        // 툴팁을 터치했을 때 숨김 처리 (모바일에서만)
        tooltipElement.addEventListener('click', function(e) {
            e.stopPropagation(); // 이벤트 전파 중지
            hideTooltip();
        });
    }
    
    /**
     * 터치 시작 이벤트 처리 (모바일)
     */
    function handleTouchStart(e) {
        // 터치 시작 시 처리 (필요시 여기에 코드 추가)
    }
    
    /**
     * 터치 종료 이벤트 처리 (모바일)
     */
    function handleTouchEnd(e) {
        // 터치가 끝난 위치 확인
        if (e.changedTouches && e.changedTouches.length > 0) {
            const touch = e.changedTouches[0];
            
            // 툴팁 위에서 터치가 끝난 경우
            if (isPointOverTooltip(touch.clientX, touch.clientY)) {
                e.preventDefault();
                hideTooltip();
                return;
            }
            
            // 아이템 행 찾기
            const itemRow = findItemRowAtPoint(touch.clientX, touch.clientY);
            if (itemRow) {
                e.preventDefault();
                
                try {
                    // 아이템 데이터 가져오기
                    const itemDataStr = itemRow.getAttribute('data-item');
                    if (!itemDataStr) return;
                    
                    const itemData = JSON.parse(itemDataStr);
                    
                    // 이전 행 강조 제거 및 새 행 강조
                    if (state.currentRow && state.currentRow !== itemRow) {
                        state.currentRow.classList.remove('hovered');
                    }
                    itemRow.classList.add('hovered');
                    state.currentRow = itemRow;
                    
                    // 현재 표시 중인 아이템과 같은지 확인
                    if (state.visible && state.currentItemId === itemData.auction_item_no) {
                        hideTooltip();
                    } else {
                        // 툴팁 표시
                        showTooltip(itemData, touch.clientX, touch.clientY);
                    }
                } catch (error) {
                    console.error("아이템 터치 처리 오류:", error);
                }
            }
        }
    }
    
    /**
     * 특정 좌표가 툴팁 위에 있는지 확인
     */
    function isPointOverTooltip(x, y) {
        if (!tooltipElement || !state.visible) return false;
        
        const rect = tooltipElement.getBoundingClientRect();
        return (
            x >= rect.left && 
            x <= rect.right && 
            y >= rect.top && 
            y <= rect.bottom
        );
    }
    
    /**
     * 특정 좌표에 있는 아이템 행 찾기
     */
    function findItemRowAtPoint(x, y) {
        const elements = document.elementsFromPoint(x, y);
        for (const element of elements) {
            const row = element.closest('.item-row');
            if (row) return row;
        }
        return null;
    }
    
    /**
     * 아이템 클릭 처리 (PC/모바일 공통)
     */
    function handleItemClick(e) {
        // 아이템 행 찾기
        const itemRow = e.target.closest('.item-row');
        if (!itemRow) return;
        
        try {
            // 아이템 데이터 가져오기
            const itemDataStr = itemRow.getAttribute('data-item');
            if (!itemDataStr) return;
            
            const itemData = JSON.parse(itemDataStr);
            
            // 이전 행 강조 제거
            if (state.currentRow && state.currentRow !== itemRow) {
                state.currentRow.classList.remove('hovered');
            }
            
            // 새 행 강조
            itemRow.classList.add('hovered');
            state.currentRow = itemRow;
            
            // 모바일에서는 같은 아이템 재클릭 시 툴팁 토글
            if (state.isMobile && state.visible && state.currentItemId === itemData.auction_item_no) {
                hideTooltip();
            } else {
                // 툴팁 표시
                showTooltip(itemData, e.clientX, e.clientY);
            }
        } catch (error) {
            console.error("아이템 클릭 처리 오류:", error);
        }
    }
    
    /**
     * 마우스 이동 처리 (PC 전용)
     */
    function handleMouseMove(e) {
        // 마지막 아이템 ID와 행 참조 추적
        handleMouseMove.lastItemId = handleMouseMove.lastItemId || null;
        
        // 현재 마우스 위치 저장
        state.mousePosition = { x: e.clientX, y: e.clientY };
        
        // 마우스 아래 있는 아이템 행 찾기
        const itemRow = findItemRowAtPoint(e.clientX, e.clientY);
        
        // 아이템 행이 있는 경우
        if (itemRow) {
            try {
                // 아이템 데이터 가져오기
                const itemDataStr = itemRow.getAttribute('data-item');
                if (!itemDataStr) return;
                
                const itemData = JSON.parse(itemDataStr);
                const currentItemId = itemData.auction_item_no || '';
                
                // 새 아이템이면 모든 행 강조 제거 후 현재 행만 강조
                if (currentItemId !== handleMouseMove.lastItemId) {
                    document.querySelectorAll('.item-row.hovered').forEach(row => {
                        if (row !== itemRow) {
                            row.classList.remove('hovered');
                        }
                    });
                    
                    // 현재 행 강조 및 상태 저장
                    itemRow.classList.add('hovered');
                    handleMouseMove.lastItemId = currentItemId;
                    state.currentRow = itemRow;
                    
                    // 툴팁 업데이트 또는 표시
                    if (state.visible) {
                        updateTooltip(itemData, e.clientX, e.clientY);
                    } else {
                        showTooltip(itemData, e.clientX, e.clientY);
                    }
                } else if (state.visible) {
                    // 같은 아이템이면 위치만 업데이트
                    updatePosition(e.clientX, e.clientY);
                }
            } catch (error) {
                console.error('툴팁 업데이트 중 오류:', error);
            }
        } else if (state.visible && !isPointOverTooltip(e.clientX, e.clientY)) {
            // 아이템 행도 아니고 툴팁 위도 아닌 경우
            hideTooltip();
            handleMouseMove.lastItemId = null;
            
            // 모든 행의 강조 제거
            document.querySelectorAll('.item-row.hovered').forEach(row => {
                row.classList.remove('hovered');
            });
        }
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
        state.mousePosition = { x, y };
        
        // 툴팁을 일단 보이게 하고 크기 계산을 위해 숨겨진 상태로 표시
        tooltipElement.style.opacity = '0';
        tooltipElement.style.display = 'block';
        
        // 약간의 지연 후 위치 계산 및 표시 (DOM 업데이트 후)
        setTimeout(() => {
            calculateInitialPosition(x, y);
            tooltipElement.style.opacity = '1';
            
            // 애니메이션 시작 (PC만)
            if (!state.isMobile) {
                startPositionAnimation();
            }
        }, 10);
    }
    
    /**
     * 툴팁 초기 위치 계산
     */
    function calculateInitialPosition(x, y) {
        if (!tooltipElement) return;
        
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
            left = Math.max(margin, windowWidth - tooltipWidth - margin);
        }
        
        // 하단 경계 처리
        if (top + tooltipHeight > windowHeight - margin) {
            top = Math.max(margin, windowHeight - tooltipHeight - margin);
        }
        
        // 위치 직접 적용 (애니메이션 없이)
        tooltipElement.style.left = `${Math.round(left)}px`;
        tooltipElement.style.top = `${Math.round(top)}px`;
        
        // 목표 위치 업데이트
        state.targetPosition = { x: left, y: top };
    }
    
    /**
     * 툴팁 위치 애니메이션 시작
     */
    function startPositionAnimation() {
        // 이전 애니메이션 프레임 취소
        if (state.animationFrameId) {
            cancelAnimationFrame(state.animationFrameId);
        }
        
        // 애니메이션 함수
        function animate() {
            // 툴팁이 보이지 않으면 애니메이션 중단
            if (!state.visible) return;
            
            // 현재 마우스 위치 기반으로 목표 위치 계산
            calculateTargetPosition();
            
            // 현재 툴팁 위치
            const currentLeft = parseFloat(tooltipElement.style.left) || 0;
            const currentTop = parseFloat(tooltipElement.style.top) || 0;
            
            // 목표 위치
            const targetLeft = state.targetPosition.x;
            const targetTop = state.targetPosition.y;
            
            // 부드러운 이동을 위한 보간 (0.2 = 20% 이동)
            const newLeft = currentLeft + (targetLeft - currentLeft) * 0.2;
            const newTop = currentTop + (targetTop - currentTop) * 0.2;
            
            // 위치 적용
            tooltipElement.style.left = `${Math.round(newLeft)}px`;
            tooltipElement.style.top = `${Math.round(newTop)}px`;
            
            // 다음 프레임 요청
            state.animationFrameId = requestAnimationFrame(animate);
        }
        
        // 애니메이션 시작
        state.animationFrameId = requestAnimationFrame(animate);
    }
    
    /**
     * 마우스 위치 기반 목표 위치 계산
     */
    function calculateTargetPosition() {
        // 마우스 위치
        const x = state.mousePosition.x;
        const y = state.mousePosition.y;
        
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
            left = Math.max(margin, windowWidth - tooltipWidth - margin);
        }
        
        // 하단 경계 처리
        if (top + tooltipHeight > windowHeight - margin) {
            top = Math.max(margin, windowHeight - tooltipHeight - margin);
        }
        
        // 목표 위치 업데이트
        state.targetPosition = { x: left, y: top };
    }
    
    /**
     * 툴팁 위치 업데이트 (즉시 적용)
     */
    function updatePosition(x, y) {
        if (!tooltipElement || !state.visible) return;
        
        // 마우스 위치 업데이트
        state.mousePosition = { x, y };
        
        // PC에서는 애니메이션을 통해 위치 업데이트
        if (!state.isMobile) {
            // 목표 위치만 업데이트 (애니메이션 함수에서 실제 위치 변경)
            calculateTargetPosition();
        } else {
            // 모바일에서는 즉시 위치 변경
            calculateInitialPosition(x, y);
        }
    }
    
    /**
     * 툴팁 내용 및 위치 업데이트
     */
    function updateTooltip(itemData, x, y) {
        if (!tooltipElement || !itemData) return;
        
        const newItemId = itemData.auction_item_no || '';
        
        // 같은 아이템이면 위치만 업데이트
        if (state.currentItemId === newItemId) {
            updatePosition(x, y);
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
        
        // 현재 행 강조 제거
        if (state.currentRow) {
            state.currentRow.classList.remove('hovered');
            state.currentRow = null;
        }
        
        // 애니메이션 정지
        if (state.animationFrameId) {
            cancelAnimationFrame(state.animationFrameId);
            state.animationFrameId = null;
        }
        
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
        updatePosition,
        isVisible,
        getCurrentItemId,
        isMobileDevice
    };
})();

export default ItemTooltip;
