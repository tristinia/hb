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
        lockedToItem: false // 아이템 행에 고정 여부
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
            // 아이템 행에 mouse enter/leave 이벤트 등록 (이벤트 위임)
            resultsTable.addEventListener('mouseenter', handleItemRowMouseEnter, true);
            resultsTable.addEventListener('mouseleave', handleItemRowMouseLeave, true);
            
            // 아이템 행 위에서의 마우스 이동 처리
            resultsTable.addEventListener('mousemove', handleItemRowMouseMove);
            
            // 테이블 자체에서 마우스가 나갈 때
            resultsTable.addEventListener('mouseleave', function(e) {
                // 테이블 밖으로 마우스가 완전히 나갔을 때만 툴팁 숨김
                if (!e.relatedTarget || !e.relatedTarget.closest('.results-table')) {
                    hideTooltip();
                }
            });
        }
        
        // 툴팁 자체에는 이벤트 처리 없음 (pointer-events 사용 안함)
        tooltipElement.style.pointerEvents = "auto";
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
            resultsTable.addEventListener('click', handleMobileItemClick);
        }
        
        // 툴팁을 터치했을 때 숨김 처리
        tooltipElement.addEventListener('click', function(e) {
            e.stopPropagation(); // 이벤트 전파 중지
            hideTooltip();
        });
        
        // 모바일에서 외부 터치 시 툴팁 숨김
        document.addEventListener('click', function(e) {
            // 아이템 행이나 툴팁 터치는 무시
            if (e.target.closest('.item-row') || e.target.closest('#item-tooltip')) {
                return;
            }
            
            // 다른 영역 터치 시 툴팁 숨김
            if (state.visible) {
                hideTooltip();
            }
        });
    }
    
    /**
     * 아이템 행 진입 이벤트 처리 (PC)
     */
    function handleItemRowMouseEnter(e) {
        // 아이템 행인 경우에만 처리
        const itemRow = e.target.closest('.item-row');
        if (!itemRow) return;
        
        try {
            // 아이템 데이터 가져오기
            const itemDataStr = itemRow.getAttribute('data-item');
            if (!itemDataStr) return;
            
            const itemData = JSON.parse(itemDataStr);
            
            // 행 강조 처리
            if (state.currentRow) {
                state.currentRow.classList.remove('hovered');
            }
            
            itemRow.classList.add('hovered');
            state.currentRow = itemRow;
            
            // 툴팁 표시
            showTooltip(itemData, e.clientX, e.clientY, itemRow);
            
            // 아이템에 고정
            state.lockedToItem = true;
        } catch (error) {
            console.error('아이템 행 마우스 진입 오류:', error);
        }
    }
    
    /**
     * 아이템 행 이탈 이벤트 처리 (PC)
     */
    function handleItemRowMouseLeave(e) {
        // 아이템 행인 경우에만 처리
        const itemRow = e.target.closest('.item-row');
        if (!itemRow) return;
        
        // 다른 아이템 행으로 넘어가는 경우 무시
        if (e.relatedTarget && e.relatedTarget.closest('.item-row')) {
            return;
        }
        
        // 툴팁으로 이동하는 경우 무시
        if (e.relatedTarget && e.relatedTarget.closest('#item-tooltip')) {
            return;
        }
        
        // 툴팁과 테이블 모두 벗어나는 경우에만 툴팁 숨김
        if (!e.relatedTarget || 
            (!e.relatedTarget.closest('.item-row') && 
             !e.relatedTarget.closest('#item-tooltip') && 
             !e.relatedTarget.closest('.results-table'))) {
            
            hideTooltip();
        }
        
        // 고정 해제
        state.lockedToItem = false;
    }
    
    /**
     * 아이템 행 위에서 마우스 이동 처리 (PC)
     */
    function handleItemRowMouseMove(e) {
        // 아이템 행을 찾아봄
        const itemRow = e.target.closest('.item-row');
        
        // 아이템 행 위에 있지 않으면 무시
        if (!itemRow) return;
        
        // 마우스 위치 업데이트
        state.mousePosition = { x: e.clientX, y: e.clientY };
        
        // 툴팁이 표시 중이면 위치만 업데이트
        if (state.visible) {
            updatePosition(e.clientX, e.clientY);
        }
    }
    
    /**
     * 모바일 아이템 클릭 처리
     */
    function handleMobileItemClick(e) {
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
            
            // 툴팁 표시
            showTooltip(itemData, e.clientX, e.clientY, itemRow);
        } catch (error) {
            console.error("모바일 아이템 클릭 처리 오류:", error);
        }
    }
    
    /**
     * 툴팁 표시
     */
    function showTooltip(itemData, x, y, rowElement) {
        if (!tooltipElement || !itemData) return;
        
        // 이전 행 강조 제거
        if (state.currentRow && state.currentRow !== rowElement) {
            state.currentRow.classList.remove('hovered');
        }
        
        // 새 행 강조
        if (rowElement) {
            rowElement.classList.add('hovered');
            state.currentRow = rowElement;
        }
        
        // 툴팁 내용 생성
        tooltipElement.innerHTML = '';
        const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
        tooltipElement.appendChild(tooltipContent);
        
        // 상태 업데이트
        state.currentItemId = itemData.auction_item_no || '';
        state.visible = true;
        state.mousePosition = { x, y };
        
        // 위치 설정
        updatePosition(x, y);
        
        // 툴팁 표시
        tooltipElement.style.display = 'block';
    }
    
    /**
     * 툴팁 위치 업데이트
     */
    function updatePosition(x, y) {
        if (!tooltipElement || !state.visible) return;
        
        // 툴팁 크기
        const tooltipWidth = tooltipElement.offsetWidth;
        const tooltipHeight = tooltipElement.offsetHeight;
        
        // 화면 크기
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // 기본 위치 (커서 오른쪽)
        let left = x + 15; // 커서 오른쪽에 15px 여백
        let top = y + 5;   // 커서 아래에 5px 여백
        
        // 화면 경계 확인 (5px 여백 유지)
        const margin = 5;
        
        // 우측 경계 처리
        if (left + tooltipWidth > windowWidth - margin) {
            left = windowWidth - tooltipWidth - margin;
        }
        
        // 하단 경계 처리
        if (top + tooltipHeight > windowHeight - margin) {
            top = windowHeight - tooltipHeight - margin;
        }
        
        // 위치 적용
        tooltipElement.style.left = `${Math.round(left)}px`;
        tooltipElement.style.top = `${Math.round(top)}px`;
    }
    
    /**
     * 툴팁 내용 및 위치 업데이트
     */
    function updateTooltip(itemData, x, y, rowElement) {
        if (!tooltipElement || !itemData) return;
        
        const newItemId = itemData.auction_item_no || '';
        
        // 같은 아이템이면 위치만 업데이트
        if (state.currentItemId === newItemId) {
            updatePosition(x, y);
            return;
        }
        
        // 다른 아이템이면 내용 업데이트 (showTooltip 호출)
        showTooltip(itemData, x, y, rowElement);
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
        
        // 고정 해제
        state.lockedToItem = false;
        
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
