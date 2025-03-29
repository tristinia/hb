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
        animationFrameId: null,
        tooltipOffset: 15 // 커서로부터의 오프셋
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
        state.isMobile = ('ontouchstart' in window) && window.innerWidth <= 768;
        
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
        
        // 모바일/PC에 따른 이벤트 설정
        if (state.isMobile) {
            setupMobileEvents();
        } else {
            setupDesktopEvents();
        }
        
        state.initialized = true;
        console.log(`툴팁 초기화 완료 (${state.isMobile ? '모바일' : 'PC'} 모드)`);
    }
    
    /**
     * 모바일 이벤트 설정
     */
    function setupMobileEvents() {
        // 결과 테이블에 터치 이벤트 추가
        const resultsTable = document.querySelector('.results-table');
        if (resultsTable) {
            resultsTable.addEventListener('click', function(e) {
                const itemRow = e.target.closest('.item-row');
                if (!itemRow) return;
                
                // 아이템 데이터 가져오기
                const itemDataStr = itemRow.getAttribute('data-item');
                if (!itemDataStr) return;
                
                try {
                    const itemData = JSON.parse(itemDataStr);
                    
                    // 이미 같은 아이템이 선택되어 있는지 확인
                    const newItemId = itemData.auction_item_no || '';
                    
                    if (state.visible && state.currentItemId === newItemId) {
                        // 같은 아이템 재터치 시에도 유지
                        return;
                    }
                    
                    // 이전 행 강조 제거
                    if (state.currentRow) {
                        state.currentRow.classList.remove('hovered');
                    }
                    
                    // 새 행 강조
                    itemRow.classList.add('hovered');
                    state.currentRow = itemRow;
                    
                    // 툴팁 표시
                    showTooltip(itemData, e.clientX, e.clientY, itemRow);
                } catch (error) {
                    console.error('모바일 툴팁 처리 오류:', error);
                }
            });
        }
        
        // 툴팁에만 클릭 이벤트 추가 (닫기용)
        tooltipElement.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation(); // 중요: 이벤트 전파 방지
            hideTooltip();
        });
        
        // 문서 클릭 이벤트는 추가하지 않음 (모바일에서는 툴팁을 직접 클릭해야만 닫히도록)
        // document의 click 이벤트 리스너 제거 (혹시 있다면)
        document.removeEventListener('click', handleDocumentClick);
    }
    
    /**
     * PC 이벤트 설정
     */
    function setupDesktopEvents() {
        // 결과 테이블 마우스 이벤트
        const resultsTable = document.querySelector('.results-table');
        if (resultsTable) {
            resultsTable.addEventListener('mouseover', function(e) {
                const itemRow = e.target.closest('.item-row');
                if (!itemRow) return;
                
                // 아이템 데이터 가져오기
                try {
                    const itemDataStr = itemRow.getAttribute('data-item');
                    if (!itemDataStr) return;
                    
                    const itemData = JSON.parse(itemDataStr);
                    
                    // 이미 같은 아이템이면 위치만 업데이트
                    if (state.visible && state.currentItemId === (itemData.auction_item_no || '')) {
                        state.mousePosition = { x: e.clientX, y: e.clientY };
                        return;
                    }
                    
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
                    console.error('PC 툴팁 처리 오류:', error);
                }
            });
            
            // 마우스 아웃 이벤트 (툴팁으로 이동하는 경우 제외)
            resultsTable.addEventListener('mouseout', function(e) {
                const relatedTarget = e.relatedTarget;
                // 툴팁으로 이동하는 경우 무시
                if (relatedTarget && relatedTarget.closest('#item-tooltip')) {
                    return;
                }
                
                // 다른 아이템 행으로 이동하는 경우도 무시
                if (relatedTarget && relatedTarget.closest('.item-row')) {
                    return;
                }
                
                // 테이블 밖으로 마우스가 나간 경우 툴팁 숨김
                if (!relatedTarget || !relatedTarget.closest('.results-table')) {
                    hideTooltip();
                }
            });
        }
        
        // 전역 마우스 이동 이벤트 (툴팁 위치 업데이트 및 하단 요소 감지)
        document.addEventListener('mousemove', handleMouseMove);
        
        // 툴팁에 마우스 이벤트 추가
        tooltipElement.addEventListener('mousemove', function(e) {
            // 툴팁 위에서 마우스가 움직일 때 하단 요소 감지
            const x = e.clientX;
            const y = e.clientY;
            
            // 마우스 위치 업데이트
            state.mousePosition = { x, y };
            
            // 하단 요소 감지 (중요: 툴팁을 임시 제거)
            detectElementUnderTooltip(x, y);
        });
        
        // 문서 클릭 시 툴팁 숨김 (테이블 외 영역 클릭)
        document.addEventListener('click', handleDocumentClick);
    }
    
    /**
     * 마우스 이동 이벤트 핸들러
     */
    function handleMouseMove(e) {
        if (!state.visible) return;
        
        // 마우스 위치 업데이트
        state.mousePosition = { x: e.clientX, y: e.clientY };
    }
    
    /**
     * 문서 클릭 이벤트 핸들러
     */
    function handleDocumentClick(e) {
        if (!state.visible) return;
        
        // 툴팁 또는 아이템 행 클릭은 무시
        if (e.target.closest('#item-tooltip') || e.target.closest('.item-row')) {
            return;
        }
        
        // 다른 영역 클릭 시 툴팁 숨김
        hideTooltip();
    }
    
    /**
     * 툴팁 아래 요소 감지 (PC 전용)
     */
    function detectElementUnderTooltip(x, y) {
        if (!tooltipElement || !tooltipParent) return;
        
        try {
            // 툴팁의 현재 상태 저장
            const tooltipStyle = {
                display: tooltipElement.style.display,
                left: tooltipElement.style.left,
                top: tooltipElement.style.top,
                html: tooltipElement.innerHTML
            };
            
            // 툴팁을 DOM에서 완전히 제거
            tooltipParent.removeChild(tooltipElement);
            
            // 실제 마우스 아래 요소 확인
            const elementUnderCursor = document.elementFromPoint(x, y);
            
            // 아이템 행 확인
            if (elementUnderCursor) {
                const itemRow = elementUnderCursor.closest('.item-row');
                if (itemRow && (!state.currentRow || itemRow !== state.currentRow)) {
                    // 새 아이템 행 발견 시 데이터 가져오기
                    const itemDataStr = itemRow.getAttribute('data-item');
                    if (itemDataStr) {
                        try {
                            const itemData = JSON.parse(itemDataStr);
                            const newItemId = itemData.auction_item_no || '';
                            
                            // 다른 아이템이면 툴팁 업데이트
                            if (newItemId !== state.currentItemId) {
                                // 이전 행 강조 제거
                                if (state.currentRow) {
                                    state.currentRow.classList.remove('hovered');
                                }
                                
                                // 새 행 강조
                                itemRow.classList.add('hovered');
                                state.currentRow = itemRow;
                                
                                // 상태 업데이트
                                state.currentItemId = newItemId;
                                
                                // 툴팁 복원 및 내용 업데이트
                                tooltipParent.appendChild(tooltipElement);
                                tooltipElement.style.display = tooltipStyle.display;
                                tooltipElement.style.left = tooltipStyle.left;
                                tooltipElement.style.top = tooltipStyle.top;
                                
                                // 내용 업데이트
                                tooltipElement.innerHTML = '';
                                const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
                                tooltipElement.appendChild(tooltipContent);
                                
                                return;
                            }
                        } catch (error) {
                            console.error('툴팁 아래 요소 처리 오류:', error);
                        }
                    }
                }
            }
            
            // 아이템 변경이 없으면 그냥 툴팁 복원
            tooltipParent.appendChild(tooltipElement);
            tooltipElement.style.display = tooltipStyle.display;
            tooltipElement.style.left = tooltipStyle.left;
            tooltipElement.style.top = tooltipStyle.top;
            
        } catch (error) {
            console.error('툴팁 아래 요소 감지 오류:', error);
            
            // 오류 발생 시 툴팁 복원 시도
            if (!tooltipElement.parentNode) {
                tooltipParent.appendChild(tooltipElement);
            }
        }
    }
    
    /**
     * 툴팁 표시
     */
    function showTooltip(itemData, x, y, rowElement) {
        if (!tooltipElement || !itemData) return;
        
        // 이전 행 상태 관리
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
        
        // 상태 업데이트
        state.currentItemId = itemData.auction_item_no || '';
        state.visible = true;
        state.mousePosition = { x, y };
        
        // 툴팁 표시
        tooltipElement.style.display = 'block';
        
        // 위치 계산 및 설정
        calculateAndSetPosition(x, y);
        
        // PC에서는 애니메이션 시작
        if (!state.isMobile) {
            startPositionAnimation();
        }
    }
    
    /**
     * 툴팁 위치 계산 및 설정
     */
    function calculateAndSetPosition(x, y) {
        // 툴팁 크기
        const tooltipWidth = tooltipElement.offsetWidth;
        const tooltipHeight = tooltipElement.offsetHeight;
        
        // 화면 크기
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // 기본 위치 (커서 오른쪽)
        let left = x + state.tooltipOffset;
        let top = y;
        
        // 화면 경계 체크 및 조정 (하단과 우측 기준)
        const margin = 5; // 화면 경계에서 최소 간격
        
        // 우측 경계 체크
        if (left + tooltipWidth > windowWidth - margin) {
            left = windowWidth - tooltipWidth - margin;
        }
        
        // 하단 경계 체크
        if (top + tooltipHeight > windowHeight - margin) {
            top = windowHeight - tooltipHeight - margin;
        }
        
        // 위치 적용
        tooltipElement.style.left = `${Math.round(left)}px`;
        tooltipElement.style.top = `${Math.round(top)}px`;
    }
    
    /**
     * 위치 애니메이션 시작 (PC 전용)
     */
    function startPositionAnimation() {
        // 기존 애니메이션 중지
        if (state.animationFrameId) {
            cancelAnimationFrame(state.animationFrameId);
        }
        
        // 애니메이션 프레임 함수
        function animatePosition() {
            if (state.visible) {
                calculateAndSetPosition(state.mousePosition.x, state.mousePosition.y);
                state.animationFrameId = requestAnimationFrame(animatePosition);
            }
        }
        
        // 애니메이션 시작
        state.animationFrameId = requestAnimationFrame(animatePosition);
    }
    
    /**
     * 툴팁 업데이트
     */
    function updateTooltip(itemData, x, y, rowElement) {
        if (!tooltipElement || !itemData) return;
        
        const newItemId = itemData.auction_item_no || '';
        
        // 같은 아이템이면 위치만 업데이트
        if (state.currentItemId === newItemId) {
            state.mousePosition = { x, y };
            return;
        }
        
        // 다른 아이템이면 내용 업데이트
        tooltipElement.innerHTML = '';
        const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(itemData);
        tooltipElement.appendChild(tooltipContent);
        
        // 행 강조 상태 업데이트
        if (state.currentRow && state.currentRow !== rowElement) {
            state.currentRow.classList.remove('hovered');
        }
        
        if (rowElement) {
            rowElement.classList.add('hovered');
            state.currentRow = rowElement;
        }
        
        // 상태 업데이트
        state.currentItemId = newItemId;
        state.mousePosition = { x, y };
    }
    
    /**
     * 툴팁 위치만 업데이트
     */
    function updatePosition(x, y) {
        if (!tooltipElement || !state.visible) return;
        
        state.mousePosition = { x, y };
        calculateAndSetPosition(x, y);
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
        
        // 현재 행 강조 제거
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
