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
        mouseX: 0,
        mouseY: 0,
        activeTrackingId: null
    };

    // DOM 요소
    let tooltipElement = null;
    
    /**
     * 모듈 초기화
     */
    function init() {
        if (state.initialized) return;
        
        // 모바일 여부 감지
        state.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
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
        
        if (state.isMobile) {
            // 모바일 설정
            setupMobileEvents();
        } else {
            // PC 설정
            setupPCEvents();
        }
        
        state.initialized = true;
        console.log(`툴팁 초기화 완료 (${state.isMobile ? '모바일' : 'PC'} 환경)`);
    }
    
    /**
     * PC 환경 이벤트 설정
     */
    function setupPCEvents() {
        // 툴팁이 마우스 이벤트를 가로채지 않도록 설정
        tooltipElement.style.pointerEvents = "none";
        
        // 전역 문서 레벨에서 마우스 이벤트 처리
        document.addEventListener('mousemove', handleGlobalMouseMove);
        
        // 결과 테이블 찾기
        const resultsTable = document.querySelector('.results-container');
        if (resultsTable) {
            // 아이템 행에 hover 이벤트 추가
            resultsTable.addEventListener('mouseover', function(e) {
                const itemRow = e.target.closest('.item-row');
                if (itemRow) {
                    highlightRow(itemRow);
                    
                    // 아이템 데이터 가져오기
                    try {
                        const itemDataStr = itemRow.getAttribute('data-item');
                        if (!itemDataStr) return;
                        
                        const itemData = JSON.parse(itemDataStr);
                        showTooltip(itemData, state.mouseX, state.mouseY);
                    } catch (error) {
                        console.error('아이템 데이터 파싱 오류:', error);
                    }
                }
            });
            
            // 테이블에서 마우스가 나갈 때 처리
            resultsTable.addEventListener('mouseleave', function(e) {
                // 테이블을 완전히 벗어날 때만 툴팁 숨김
                if (!e.relatedTarget || !e.relatedTarget.closest('.results-container')) {
                    hideTooltip();
                    
                    // 모든 행 하이라이트 제거
                    document.querySelectorAll('.item-row.hovered').forEach(row => {
                        row.classList.remove('hovered');
                    });
                }
            });
        }
    }
    
    /**
     * 모바일 환경 이벤트 설정
     */
    function setupMobileEvents() {
        // 모바일 환경에서는 툴팁이 터치 이벤트를 캡처
        tooltipElement.style.pointerEvents = "auto";
        
        // 툴팁을 터치하면 숨김
        tooltipElement.addEventListener('click', function(e) {
            e.stopPropagation();
            hideTooltip();
        });
        
        // 결과 테이블 찾기
        const resultsTable = document.querySelector('.results-container');
        if (resultsTable) {
            // 아이템 행 클릭 이벤트
            resultsTable.addEventListener('click', function(e) {
                const itemRow = e.target.closest('.item-row');
                if (itemRow) {
                    // 이미 선택된 행인지 확인
                    const isAlreadySelected = itemRow.classList.contains('hovered');
                    
                    // 모든 행 선택 해제
                    document.querySelectorAll('.item-row.hovered').forEach(row => {
                        row.classList.remove('hovered');
                    });
                    
                    if (isAlreadySelected) {
                        // 이미 선택된 행이면 툴팁만 숨김
                        hideTooltip();
                    } else {
                        // 새 행 선택 및 툴팁 표시
                        itemRow.classList.add('hovered');
                        state.currentRow = itemRow;
                        
                        try {
                            const itemDataStr = itemRow.getAttribute('data-item');
                            if (itemDataStr) {
                                const itemData = JSON.parse(itemDataStr);
                                showTooltip(itemData, e.clientX, e.clientY);
                            }
                        } catch (error) {
                            console.error('아이템 데이터 파싱 오류:', error);
                        }
                    }
                }
            });
        }
        
        // 외부 영역 클릭 시 툴팁 숨김 (모바일 전용)
        document.addEventListener('click', function(e) {
            if (state.visible && 
                !e.target.closest('.item-row') && 
                !e.target.closest('#item-tooltip')) {
                hideTooltip();
            }
        });
    }
    
    /**
     * 전역 마우스 이동 처리
     */
    function handleGlobalMouseMove(e) {
        // 마우스 좌표 저장
        state.mouseX = e.clientX;
        state.mouseY = e.clientY;
        
        // 툴팁이 표시 중이면 위치 업데이트
        if (state.visible && !state.isMobile) {
            updateTooltipPosition();
        }
        
        // 마우스 아래 요소 확인 - PC 환경에서 아이템 변경 감지
        if (state.visible && !state.isMobile) {
            // 마우스 아래의 요소 가져오기
            const elementUnderMouse = document.elementFromPoint(state.mouseX, state.mouseY);
            
            // 아이템 행 찾기
            const itemRow = elementUnderMouse ? elementUnderMouse.closest('.item-row') : null;
            
            if (itemRow) {
                // 새 아이템 행을 찾았으면 툴팁 업데이트
                try {
                    const itemDataStr = itemRow.getAttribute('data-item');
                    if (!itemDataStr) return;
                    
                    const itemData = JSON.parse(itemDataStr);
                    const newItemId = itemData.auction_item_no || '';
                    
                    // 새 아이템이면 툴팁 내용 업데이트
                    if (newItemId !== state.currentItemId) {
                        // 강조 표시 업데이트
                        highlightRow(itemRow);
                        
                        // 툴팁 내용 업데이트
                        updateTooltipContent(itemData);
                    }
                } catch (error) {
                    console.error('아이템 데이터 파싱 오류:', error);
                }
            }
        }
    }
    
    /**
     * 지정된 행 강조 표시
     */
    function highlightRow(row) {
        if (!row) return;
        
        // 기존 강조된 행 제거
        document.querySelectorAll('.item-row.hovered').forEach(r => {
            if (r !== row) r.classList.remove('hovered');
        });
        
        // 새 행 강조
        row.classList.add('hovered');
        state.currentRow = row;
    }
    
    /**
     * 툴팁 표시
     */
    function showTooltip(itemData, x, y) {
        if (!tooltipElement || !itemData) return;
        
        const newItemId = itemData.auction_item_no || '';
        
        // 이미 같은 아이템을 표시 중이면 위치만 업데이트
        if (state.visible && state.currentItemId === newItemId) {
            if (!state.isMobile) {
                updateTooltipPosition();
            }
            return;
        }
        
        // 툴팁 내용 생성
        tooltipElement.innerHTML = '';
        const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
        tooltipElement.appendChild(tooltipContent);
        
        // 상태 업데이트
        state.currentItemId = newItemId;
        state.visible = true;
        
        // 툴팁 표시
        tooltipElement.style.display = 'block';
        
        // 위치 업데이트
        updateTooltipPosition();
    }
    
    /**
     * 툴팁 내용 업데이트
     */
    function updateTooltipContent(itemData) {
        if (!tooltipElement || !itemData || !state.visible) return;
        
        const newItemId = itemData.auction_item_no || '';
        
        // 같은 아이템이면 무시
        if (state.currentItemId === newItemId) return;
        
        // 툴팁 내용 업데이트
        tooltipElement.innerHTML = '';
        const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
        tooltipElement.appendChild(tooltipContent);
        
        // 상태 업데이트
        state.currentItemId = newItemId;
        
        // 위치 업데이트
        updateTooltipPosition();
    }
    
    /**
     * 툴팁 위치 업데이트
     */
    function updateTooltipPosition() {
        if (!tooltipElement || !state.visible) return;
        
        // 툴팁 크기
        const tooltipWidth = tooltipElement.offsetWidth;
        const tooltipHeight = tooltipElement.offsetHeight;
        
        // 화면 크기
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // 여백
        const margin = 5;
        
        // 기본 위치 (마우스 오른쪽)
        let left = state.mouseX + 15;
        let top = state.mouseY;
        
        // 오른쪽 경계 처리
        if (left + tooltipWidth > windowWidth - margin) {
            left = windowWidth - tooltipWidth - margin;
        }
        
        // 하단 경계 처리
        if (top + tooltipHeight > windowHeight - margin) {
            top = windowHeight - tooltipHeight - margin;
        }
        
        // 위치가 음수가 되지 않도록 보정
        left = Math.max(margin, left);
        top = Math.max(margin, top);
        
        // 위치 적용
        tooltipElement.style.left = `${Math.round(left)}px`;
        tooltipElement.style.top = `${Math.round(top)}px`;
    }
    
    /**
     * 툴팁 숨기기
     */
    function hideTooltip() {
        if (!tooltipElement) return;
        
        // 툴팁 숨김
        tooltipElement.style.display = 'none';
        tooltipElement.innerHTML = '';
        
        // 상태 초기화
        state.visible = false;
        state.currentItemId = null;
    }
    
    /**
     * 툴팁 내용 및 위치 업데이트
     */
    function updateTooltip(itemData, x, y) {
        if (!state.visible) {
            showTooltip(itemData, x, y);
        } else {
            updateTooltipContent(itemData);
            state.mouseX = x;
            state.mouseY = y;
            updateTooltipPosition();
        }
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
        updatePosition: updateTooltipPosition,
        isVisible,
        getCurrentItemId,
        isMobileDevice
    };
})();

export default ItemTooltip;
