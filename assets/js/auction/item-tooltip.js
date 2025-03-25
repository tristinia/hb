/**
 * item-tooltip.js
 * 아이템 툴팁 전용 독립 모듈
 * PC/모바일 구분 없이 동일하게 작동하는 버전
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
            // 마우스 오버 이벤트 - PC/모바일 모두 동일하게 처리
            resultsTable.addEventListener('mouseover', handleMouseOver);
            
            // 마우스 아웃 이벤트
            resultsTable.addEventListener('mouseout', handleMouseOut);
            
            // 마우스 이동 이벤트
            resultsTable.addEventListener('mousemove', handleMouseMove);
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
     * 마우스 오버 이벤트 핸들러
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function handleMouseOver(event) {
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
     * 마우스 아웃 이벤트 핸들러
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function handleMouseOut(event) {
        const itemRow = event.target.closest('.item-row');
        if (!itemRow) return;
        
        // 다른 자식 요소로 이동한 경우는 무시
        const relatedTarget = event.relatedTarget;
        if (relatedTarget && itemRow.contains(relatedTarget)) return;
        
        // 툴팁 숨기기
        hideTooltip();
    }
    
    /**
     * 마우스 이동 이벤트 핸들러
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function handleMouseMove(event) {
        if (!state.visible || !tooltipElement) return;
        
        // 툴팁 위치 업데이트
        updatePosition(event.clientX, event.clientY);
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
     * 툴팁 위치 업데이트 - 아래쪽 경계 특히 신경써서 처리
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
        const offsetX = 15; // 마우스와의 X축 간격
        const offsetY = -10; // 마우스 위로 약간 올림 (Y축 간격)
        
        let left = x + offsetX;
        let top = y + offsetY; // 마우스 위치보다 약간 위에 위치
        
        // 아래쪽 경계 검사 (더 강력하게) - 아래로 넘어가지 않게 함
        if (top + tooltipHeight > windowHeight) {
            // 툴팁이 화면 아래로 넘어가면, 마우스 위치보다 충분히 위에 배치
            // 툴팁 전체가 화면에 보이도록 보정
            top = windowHeight - tooltipHeight;
            
            // 혹시라도 음수가 되면 0으로 보정
            if (top < 0) top = 0;
        }
        
        // 오른쪽 경계 검사
        if (left + tooltipWidth > windowWidth) {
            left = windowWidth - tooltipWidth;
            
            // 혹시라도 음수가 되면 0으로 보정
            if (left < 0) left = 0;
        }
        
        // 위치 적용
        tooltipElement.style.left = `${left}px`;
        tooltipElement.style.top = `${top}px`;
        
        // 디버깅 정보 (나중에 제거)
        //console.log(`마우스: (${x}, ${y}), 툴팁: (${left}, ${top}), 크기: ${tooltipWidth}x${tooltipHeight}, 화면: ${windowWidth}x${windowHeight}`);
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
        isVisible: () => state.visible
    };
})();

export default ItemTooltip;
