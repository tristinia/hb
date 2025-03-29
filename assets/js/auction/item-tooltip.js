/**
 * item-tooltip.js
 * 아이템 정보 툴팁 표시와 위치 계산 담당 모듈
 */

import optionRenderer from './option-renderer.js';
import Utils from '../common/utils.js';

const ItemTooltip = (() => {
    // 기본 상태 변수
    const state = {
        initialized: false,
        visible: false,
        currentItemId: null,
        currentRow: null,
        isMobile: false,
        mousePosition: { x: 0, y: 0 },
        lastItemRowUnderMouse: null, // 마지막으로 감지된 아이템 행
        mouseLeaveTimeout: null // 마우스 이동 타임아웃
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
        // PC 환경에서는 툴팁이 마우스 이벤트를 차단하지 않도록 설정
        // 하지만 마우스 이동 시 깜빡임을 방지하기 위해 이벤트를 다른 방식으로 처리
        
        // 결과 테이블에 마우스 이벤트 리스너 추가
        const resultsTable = document.querySelector('.results-table');
        if (resultsTable) {
            // 마우스 움직임을 쓰로틀링하여 과도한 업데이트 방지
            const throttledMouseMove = Utils.throttle(handleTableMouseMove, 30);
            resultsTable.addEventListener('mousemove', throttledMouseMove);
            
            // 마우스가 테이블 밖으로 나갈 때
            resultsTable.addEventListener('mouseleave', function(e) {
                hideTooltip();
            });
        }
        
        // 툴팁 요소 설정
        tooltipElement.style.pointerEvents = "none"; // 마우스 이벤트를 무시하여 하단 요소 감지
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
        
        // 툴팁을 터치했을 때만 숨김 처리
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
     * 테이블 내 마우스 이동 처리 (PC 환경)
     */
    function handleTableMouseMove(e) {
        // 마우스 위치 업데이트
        state.mousePosition = { x: e.clientX, y: e.clientY };
        
        // 마우스 아래 아이템 행 찾기
        const itemRow = e.target.closest('.item-row');
        if (!itemRow) return;
        
        // 이전에 감지된 것과 같은 행이면 위치만 업데이트하고 내용은 변경하지 않음
        if (state.lastItemRowUnderMouse === itemRow) {
            if (state.visible) {
                updatePosition(e.clientX, e.clientY);
            }
            return;
        }
        
        // 새로운 아이템 행 감지 - 상태 업데이트
        state.lastItemRowUnderMouse = itemRow;
        
        try {
            // 아이템 데이터 가져오기
            const itemDataStr = itemRow.getAttribute('data-item');
            if (!itemDataStr) return;
            
            const itemData = JSON.parse(itemDataStr);
            const newItemId = itemData.auction_item_no || '';
            
            // 이전 행 강조 제거
            if (state.currentRow && state.currentRow !== itemRow) {
                state.currentRow.classList.remove('hovered');
            }
            
            // 새 행 강조
            itemRow.classList.add('hovered');
            state.currentRow = itemRow;
            
            // 툴팁 표시 또는 업데이트
            if (!state.visible) {
                showTooltip(itemData, e.clientX, e.clientY, itemRow);
            } else {
                updateTooltip(itemData, e.clientX, e.clientY, itemRow);
            }
        } catch (error) {
            console.error("아이템 데이터 처리 오류:", error);
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
            const newItemId = itemData.auction_item_no || '';
            
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
        
        // 툴팁 표시
        tooltipElement.style.display = 'block';
        
        // 위치 설정
        updatePosition(x, y);
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
        
        // 마지막 감지된 행 초기화
        state.lastItemRowUnderMouse = null;
        
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
