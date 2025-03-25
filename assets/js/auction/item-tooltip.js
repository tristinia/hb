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
        // 테이블에 이벤트 리스너 추가 (이벤트 위임 사용)
        const resultsTable = document.querySelector('.results-table');
        if (resultsTable) {
            // 마우스 오버 이벤트 (데스크톱)
            resultsTable.addEventListener('mouseover', handleMouseOver);
            
            // 마우스 아웃 이벤트 (데스크톱)
            resultsTable.addEventListener('mouseout', handleMouseOut);
            
            // 마우스 이동 이벤트 (데스크톱)
            resultsTable.addEventListener('mousemove', handleMouseMove);
            
            // 터치/클릭 이벤트 (모바일)
            resultsTable.addEventListener('click', handleClick);
        }
        
        // 툴팁 외부 클릭 시 닫기 (모바일)
        document.addEventListener('click', (event) => {
            // 클릭된 요소가 툴팁이나 아이템 행이 아니면 툴팁 숨기기
            if (state.visible && 
                tooltipElement && 
                !tooltipElement.contains(event.target) && 
                !event.target.closest('.item-row')) {
                hideTooltip();
            }
        });
    }
    
    /**
     * 마우스 오버 이벤트 핸들러 (데스크톱)
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function handleMouseOver(event) {
        // 모바일 환경에서는 무시
        if (isMobileDevice()) return;
        
        const itemRow = event.target.closest('.item-row');
        if (!itemRow) return;
        
        try {
            // 아이템 데이터 가져오기
            const itemDataStr = itemRow.getAttribute('data-item');
            if (!itemDataStr) return;
            
            const itemData = JSON.parse(itemDataStr);
            
            // 툴팁 표시
            showTooltip(itemData, event.clientX, event.clientY);
        } catch (error) {
            console.error('툴팁 표시 중 오류:', error);
        }
    }
    
    /**
     * 마우스 아웃 이벤트 핸들러 (데스크톱)
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function handleMouseOut(event) {
        // 모바일 환경에서는 무시
        if (isMobileDevice()) return;
        
        const itemRow = event.target.closest('.item-row');
        if (!itemRow) return;
        
        // 다른 자식 요소로 이동한 경우는 무시
        const relatedTarget = event.relatedTarget;
        if (relatedTarget && itemRow.contains(relatedTarget)) return;
        
        // 툴팁 숨기기
        hideTooltip();
    }
    
    /**
     * 마우스 이동 이벤트 핸들러 (데스크톱)
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function handleMouseMove(event) {
        // 모바일 환경에서는 무시
        if (isMobileDevice()) return;
        
        if (!state.visible || !tooltipElement) return;
        
        // 툴팁 위치 업데이트
        updatePosition(event.clientX, event.clientY);
    }
    
    /**
     * 클릭 이벤트 핸들러 (모바일)
     * @param {MouseEvent|TouchEvent} event - 클릭/터치 이벤트
     */
    function handleClick(event) {
        // 데스크톱 환경에서는 무시
        if (!isMobileDevice()) return;
        
        const itemRow = event.target.closest('.item-row');
        if (!itemRow) return;
        
        try {
            // 아이템 데이터 가져오기
            const itemDataStr = itemRow.getAttribute('data-item');
            if (!itemDataStr) return;
            
            const itemData = JSON.parse(itemDataStr);
            
            // 이미 같은 아이템의 툴팁이 표시중이면 숨기기
            if (state.visible && state.lastItemData && 
                state.lastItemData.auction_item_no === itemData.auction_item_no) {
                hideTooltip();
                return;
            }
            
            // 이벤트 전파 방지 (중요: 다른 이벤트 핸들러 호출 방지)
            event.stopPropagation();
            
            // 클릭 위치 또는 아이템 위치 계산
            let x, y;
            
            if (event.clientX && event.clientY) {
                // 마우스 클릭 위치
                x = event.clientX;
                y = event.clientY;
            } else {
                // 터치 이벤트나 위치 정보가 없는 경우, 아이템 행의 위치 사용
                const rect = itemRow.getBoundingClientRect();
                x = rect.left + rect.width / 2;
                y = rect.top;
            }
            
            // 툴팁 표시
            showTooltip(itemData, x, y);
        } catch (error) {
            console.error('툴팁 표시 중 오류:', error);
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
        
        // 툴팁 표시 (우선 화면 밖에서 크기 측정)
        tooltipElement.style.display = 'block';
        tooltipElement.style.left = '-9999px';
        tooltipElement.style.top = '-9999px';
        
        // 위치 계산 후 적용
        updatePosition(x, y);
        
        // 상태 업데이트
        state.visible = true;
        state.lastItemData = itemData;
    }
    
    /**
     * 툴팁 위치 업데이트
     * @param {number} x - 마우스 X 좌표
     * @param {number} y - 마우스 Y 좌표
     */
    function updatePosition(x, y) {
        if (!tooltipElement || !state.visible) return;
        
        // 화면 크기
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // 툴팁 크기
        const rect = tooltipElement.getBoundingClientRect();
        const tooltipWidth = rect.width;
        const tooltipHeight = rect.height;
        
        // 기본 위치 (마우스 오른쪽에 고정 간격)
        const offsetX = 15; // 마우스와의 간격
        let left = x + offsetX;
        let top = y;
        
        // 오른쪽 경계 검사 - 화면을 벗어나면 오른쪽 경계에 맞춤
        if (left + tooltipWidth > windowWidth) {
            left = windowWidth - tooltipWidth;
        }
        
        // 아래쪽 경계 검사 - 화면을 벗어나면 위로 이동
        if (top + tooltipHeight > windowHeight) {
            top = windowHeight - tooltipHeight;
        }
        
        // 위치가 음수가 되지 않도록 보정
        left = Math.max(0, left);
        top = Math.max(0, top);
        
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
    
    /**
     * 모바일 디바이스 감지
     * @returns {boolean} 모바일 디바이스 여부
     */
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    // 공개 API
    return {
        init,
        showTooltip,
        hideTooltip,
        isVisible: () => state.visible
    };
})();

export default ItemTooltip;
