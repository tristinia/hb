/**
 * 아이템 표시 관리 모듈
 * 검색 결과 표시, 아이템 정보, 툴팁 등 처리
 */

import Utils from './utils.js';
import ApiClient from './api-client.js';
import FilterManager from './filter-manager.js';
import PaginationManager from './pagination.js';
import optionFilter from './option-filter.js';
import optionRenderer from './option-renderer.js';
import ItemTooltip from './item-tooltip.js';

const ItemDisplay = (() => {
    // 아이템 표시 상태
    const state = {
        searchResults: [],
        filteredResults: [],
        lastSearchResults: [], // 필터링용 캐시
        currentCategory: null,
        activeRow: null  // 현재 활성화된 행 추적
    };
    
    // DOM 요소 참조
    let elements = {
        resultsBody: null,
        tooltip: null
    };

    /**
     * 아이템 표시 이름 포맷팅 (색상 처리)
     */
    function formatItemDisplayName(item) {
        // 기본값 설정
        const displayName = item.item_display_name || item.item_name || '이름 없음';
        const baseName = item.item_name || '';
        
        // 기본 이름만 있는 경우
        if (!item.item_display_name || item.item_display_name === baseName) {
            return displayName;
        }
        
        // 아이템 이름 분리 처리
        let result = '';
        let enchantPart = '';
        let specialPrefix = '';
        
        // 접두사 확인
        if (displayName.startsWith("신성한 ")) {
            specialPrefix = "신성한 ";
        } else if (displayName.startsWith("축복받은 ")) {
            specialPrefix = "축복받은 ";
        }
        
        // 기본 아이템 이름 부분 추출
        const baseNameIndex = displayName.lastIndexOf(baseName);
        
        if (baseNameIndex > 0) {
            // 접두사와 인챈트 부분 추출
            const prefixPart = displayName.substring(0, baseNameIndex);
            
            // 접두사가 있는 경우 인챈트 부분 추출
            if (specialPrefix) {
                enchantPart = prefixPart.substring(specialPrefix.length);
            } else {
                enchantPart = prefixPart;
            }
            
            // HTML 조합
            if (specialPrefix) {
                if (specialPrefix === "신성한 ") {
                    // 신성한 = 노란색
                    result += `<span class="item-yellow">${specialPrefix}</span>`;
                } else {
                    result += `<span class="item-normal">${specialPrefix}</span>`;
                }
            }
            
            if (enchantPart) {
                // 인챈트 = 파란색
                result += `<span class="item-blue">${enchantPart}</span>`;
            }
            
            result += `<span class="item-base-name">${baseName}</span>`;
        } else {
            // 분리 실패 시 원본 그대로 표시
            result = displayName;
        }
        
        return result;
    }
    
    /**
     * 모듈 초기화
     */
    function init() {
        // DOM 요소 참조 가져오기
        elements.resultsBody = document.getElementById('results-body');
        elements.tooltip = document.getElementById('item-tooltip');
        
        // 테이블 이벤트 리스너 설정
        setupTableEventListeners();
        
        // 필터 변경 이벤트 리스너
        document.addEventListener('filterChanged', (e) => {
            applyLocalFiltering();
        });
        
        // 카테고리 변경 이벤트 리스너
        document.addEventListener('categoryChanged', (e) => {
            const { subCategory } = e.detail;
            if (subCategory) {
                state.currentCategory = subCategory;
            }
        });
    }
    
    /**
     * 테이블 이벤트 리스너 설정
     */
    function setupTableEventListeners() {
        // 모바일 감지
        const isMobile = ItemTooltip.isMobileDevice();
        
        // 이벤트 등록은 ItemTooltip 내부에서 처리하므로 여기서는 아무 것도 하지 않음
        // ItemTooltip.init() 함수가 모든 필요한 이벤트를 설정함
        console.log(`테이블 이벤트 리스너 설정 완료 (${isMobile ? '모바일' : 'PC'} 모드)`);
    }

    /**
     * 모바일 아이템 클릭 처리
     */
    function handleMobileItemClick(e) {
        // 툴팁 클릭 시 처리
        if (e.target.closest('#item-tooltip')) {
            e.preventDefault();
            ItemTooltip.hideTooltip();
            return;
        }
        
        // 아이템 행 검색
        const itemRow = e.target.closest('.item-row');
        if (!itemRow) {
            // 행 외부 클릭 시 툴팁 숨김
            if (ItemTooltip.isVisible()) {
                ItemTooltip.hideTooltip();
            }
            return;
        }
        
        try {
            // 아이템 데이터 가져오기
            const itemDataStr = itemRow.getAttribute('data-item');
            if (!itemDataStr) return;
            
            const itemData = JSON.parse(itemDataStr);
            
            // 툴팁 표시 여부 및 현재 아이템 ID 확인
            if (ItemTooltip.isVisible() && ItemTooltip.getCurrentItemId() === itemData.auction_item_no) {
                // 같은 아이템 재클릭 시 툴팁 숨김
                ItemTooltip.hideTooltip();
            } else {
                // 새 아이템 클릭 시 툴팁 표시
                ItemTooltip.showTooltip(itemData, e.clientX, e.clientY, itemRow);
            }
        } catch (error) {
            console.error('모바일 툴팁 처리 중 오류:', error);
        }
    }
    
    /**
     * PC 아이템 호버 처리
     */
    function handleItemHover(e) {
        const itemRow = e.target.closest('.item-row');
        if (!itemRow) return;
        
        try {
            // 아이템 데이터 가져오기
            const itemDataStr = itemRow.getAttribute('data-item');
            if (!itemDataStr) return;
            
            const itemData = JSON.parse(itemDataStr);
            
            // 툴팁 상태에 따라 처리
            if (ItemTooltip.isVisible()) {
                if (ItemTooltip.getCurrentItemId() === itemData.auction_item_no) {
                    // 같은 아이템이면 위치 업데이트 스킵 (애니메이션 루프가 담당)
                    return;
                } else {
                    // 다른 아이템이면 툴팁 내용 업데이트
                    ItemTooltip.updateTooltip(itemData, e.clientX, e.clientY, itemRow);
                }
            } else {
                // 툴팁이 없으면 새 툴팁 표시
                ItemTooltip.showTooltip(itemData, e.clientX, e.clientY, itemRow);
            }
        } catch (error) {
            console.error('PC 툴팁 처리 중 오류:', error);
        }
    }
    
    // 새로운 터치 이벤트 핸들러들
    function handleTouchStart(event) {
        // touchstart에서는 아직 아무 작업도 하지 않고, 나중에 touchend에서 처리
        // 이 이벤트는 스크롤 등 기본 동작 허용을 위해 preventDefault()를 호출하지 않음
    }
    
    function handleTouchEnd(event) {
        // 터치 지점
        const touch = event.changedTouches[0];
        const touchX = touch.clientX;
        const touchY = touch.clientY;
        
        // 툴팁 터치 확인
        const tooltipElement = document.getElementById('item-tooltip');
        const isTouchOnTooltip = tooltipElement && ItemTooltip.isVisible() && 
                                elementContainsPoint(tooltipElement, touchX, touchY);
        
        // 툴팁을 터치한 경우: 툴팁 닫기
        if (isTouchOnTooltip) {
            event.preventDefault();
            ItemTooltip.hideTooltip();
            document.querySelectorAll('.item-row.hovered').forEach(row => {
                row.classList.remove('hovered');
            });
            return;
        }
        
        // 아이템 행 찾기
        // 중요: 여기서 결과 테이블 전체를 대상으로 터치 지점 검사
        const resultsTable = document.querySelector('.results-table');
        if (!resultsTable) return;
        
        const rect = resultsTable.getBoundingClientRect();
        const isTouchInTable = touchX >= rect.left && touchX <= rect.right && 
                              touchY >= rect.top && touchY <= rect.bottom;
        
        // 테이블 영역 안에서만 처리
        if (isTouchInTable) {
            const rows = resultsTable.querySelectorAll('.item-row');
            let touchedRow = null;
            
            // 모든 행을 순회하며 터치 지점이 포함된 행 찾기
            for (const row of rows) {
                const rowRect = row.getBoundingClientRect();
                if (touchY >= rowRect.top && touchY <= rowRect.bottom) {
                    touchedRow = row;
                    break;
                }
            }
            
            if (touchedRow) {
                event.preventDefault();
                
                try {
                    // 아이템 데이터 가져오기
                    const itemDataStr = touchedRow.getAttribute('data-item');
                    if (!itemDataStr) return;
                    
                    const itemData = JSON.parse(itemDataStr);
                    const currentItemId = itemData.auction_item_no || '';
                    
                    // 툴팁 표시 여부에 따른 처리
                    if (ItemTooltip.isVisible()) {
                        const visibleItemId = ItemTooltip.getCurrentItemId();
                        
                        if (currentItemId === visibleItemId) {
                            // 같은 아이템을 다시 터치하면 툴팁 숨김
                            ItemTooltip.hideTooltip();
                            touchedRow.classList.remove('hovered');
                        } else {
                            // 다른 아이템 터치하면 새 툴팁 표시
                            document.querySelectorAll('.item-row.hovered').forEach(row => {
                                if (row !== touchedRow) row.classList.remove('hovered');
                            });
                            
                            touchedRow.classList.add('hovered');
                            
                            // 터치 지점 기준으로 툴팁 표시 (기존과 동일)
                            ItemTooltip.updateTooltip(itemData, touchX, touchY);
                        }
                    } else {
                        // 툴팁이 없으면 새 툴팁 표시
                        touchedRow.classList.add('hovered');
                        ItemTooltip.showTooltip(itemData, touchX, touchY);
                    }
                } catch (error) {
                    console.error('툴팁 표시 중 오류:', error);
                }
            }
        }
    }
    
    // 요소가 지정된 좌표를 포함하는지 확인하는 헬퍼 함수
    function elementContainsPoint(element, x, y) {
        const rect = element.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    /**
     * 마우스 오버 이벤트 핸들러 (PC 전용)
     */
    function handleMouseOver(event) {
        const itemRow = event.target.closest('.item-row');
        if (!itemRow) return;
        
        try {
            // 행 강조 표시
            itemRow.classList.add('hovered');
            
            // 아이템 데이터 가져오기
            const itemDataStr = itemRow.getAttribute('data-item');
            if (!itemDataStr) return;
            
            // 툴팁 표시
            const itemData = JSON.parse(itemDataStr);
            ItemTooltip.showTooltip(itemData, event.clientX, event.clientY);
        } catch (error) {
            console.error('툴팁 표시 중 오류:', error);
        }
    }
    

    /**
     * 마우스 아웃 이벤트 핸들러 (PC 전용)
     */
    function handleMouseOut(event) {
        const itemRow = event.target.closest('.item-row');
        if (!itemRow) return;
        
        // 다른 아이템 행으로 이동하는 경우 처리
        const relatedItemRow = event.relatedTarget ? event.relatedTarget.closest('.item-row') : null;
        
        // 다른 아이템 행이 없으면 (즉, 테이블 밖으로 나갔으면) 툴팁 숨김
        if (!relatedItemRow) {
            itemRow.classList.remove('hovered');
            ItemTooltip.hideTooltip();
        }
    }

    /**
     * 마우스 이동 이벤트 핸들러 (PC 전용)
     */
    function handleMouseMove(event) {
        // 마지막 아이템 ID와 행 참조 추적
        handleMouseMove.lastItemId = handleMouseMove.lastItemId || null;
        handleMouseMove.lastItemRow = handleMouseMove.lastItemRow || null;
        
        // 마우스 커서 아래 있는 요소 확인
        let elementUnderMouse;
        
        // 툴팁이 표시 중인지 확인
        if (ItemTooltip.isVisible()) {
            const tooltipElement = document.getElementById('item-tooltip');
            if (tooltipElement) {
                // 툴팁 영역에 마우스가 있는지 확인
                const rect = tooltipElement.getBoundingClientRect();
                const isMouseOverTooltip = 
                    event.clientX >= rect.left && 
                    event.clientX <= rect.right && 
                    event.clientY >= rect.top && 
                    event.clientY <= rect.bottom;
                    
                if (isMouseOverTooltip) {
                    // 마지막으로 호버된 행이 있으면 그대로 유지
                    if (handleMouseMove.lastItemRow) {
                        // 위치만 업데이트 (현재 마우스 위치 사용)
                        ItemTooltip.updatePosition(event.clientX, event.clientY);
                        return;
                    }
                }
            }
        }
        
        // 요소 감지
        elementUnderMouse = document.elementFromPoint(event.clientX, event.clientY);
        
        // 아이템 행 찾기 
        const itemRow = elementUnderMouse ? elementUnderMouse.closest('.item-row') : null;
        
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
                    handleMouseMove.lastItemRow = itemRow;
                    
                    // 툴팁 업데이트
                    if (ItemTooltip.isVisible()) {
                        ItemTooltip.updateTooltip(itemData, event.clientX, event.clientY);
                    } else {
                        ItemTooltip.showTooltip(itemData, event.clientX, event.clientY);
                    }
                } else {
                    // 같은 아이템이면 위치만 업데이트
                    ItemTooltip.updatePosition(event.clientX, event.clientY);
                }
            } catch (error) {
                console.error('툴팁 업데이트 중 오류:', error);
            }
        } else {
            // 아이템 행이 없는 경우 툴팁 숨기기
            // (툴팁 위에 마우스가 있는 경우는 제외)
            if (ItemTooltip.isVisible() && elementUnderMouse && !elementUnderMouse.closest('#item-tooltip')) {
                ItemTooltip.hideTooltip();
                handleMouseMove.lastItemId = null;
                handleMouseMove.lastItemRow = null;
                
                // 모든 행의 강조 제거
                document.querySelectorAll('.item-row.hovered').forEach(row => {
                    row.classList.remove('hovered');
                });
            }
        }
    }
    
    /**
     * 검색 결과 설정 및 렌더링
     */
    function setSearchResults(items) {
        // 결과 저장
        state.searchResults = items || [];
        state.lastSearchResults = [...state.searchResults];
        state.filteredResults = [...state.searchResults];
        
        // 결과 렌더링
        renderItemsTable();
    }
    
    /**
     * 아이템 목록 테이블 렌더링
     */
    function renderItemsTable() {
        if (!elements.resultsBody) return;
        
        // 결과 테이블 초기화
        elements.resultsBody.innerHTML = '';
        
        // 결과가 없는 경우
        if (state.filteredResults.length === 0) {
            const tr = document.createElement('tr');
            tr.className = 'empty-result';
            tr.innerHTML = `<td colspan="4">검색 결과가 없습니다.</td>`;
            elements.resultsBody.appendChild(tr);
            return;
        }
        
        // 가격순으로 정렬
        const sortedItems = [...state.filteredResults].sort((a, b) => {
            const priceA = a.auction_price_per_unit || 0;
            const priceB = b.auction_price_per_unit || 0;
            return priceA - priceB;
        });
    
        state.filteredResults = sortedItems;
        
        // 아이템 행 생성
        sortedItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'item-row';
            tr.setAttribute('data-item-id', item.auction_item_no || '');
            tr.setAttribute('data-item', JSON.stringify(item));
            
            // 가격 포맷팅
            const priceFormatted = formatItemPrice(item.auction_price_per_unit || 0);
            
            // 남은 시간 포맷팅
            const remainingTime = formatRemainingTime(item.date_auction_expire);
            
            tr.innerHTML = `
                <td>
                    <div class="item-cell">
                        <div class="item-name">${formatItemDisplayName(item)}</div>
                    </div>
                </td>
                <td>${remainingTime}</td>
                <td>${item.auction_count || 1}</td>
                <td class="item-price ${priceFormatted.class}">${priceFormatted.text}</td>
            `;
            
            elements.resultsBody.appendChild(tr);
        });
    }
    
    /**
     * 로컬 필터링 적용
     */
    function applyLocalFiltering() {
        // 마지막 검색 결과가 없으면 처리하지 않음
        if (state.lastSearchResults.length === 0) {
            console.log('필터링할 결과 없음');
            return;
        }
        
        // 필터링 지연 처리 (브라우저 렌더링 차단 방지)
        setTimeout(() => {
            try {
                // 활성화된 필터 가져오기
                const activeFilters = FilterManager.getFilters().activeFilters;
                
                // 필터링 로직 적용 - 필터가 없으면 모든 아이템 표시
                if (activeFilters.length === 0) {
                    state.filteredResults = [...state.lastSearchResults];
                } else {
                    state.filteredResults = state.lastSearchResults.filter(item => {
                        return FilterManager.itemPassesFilters(item) && 
                            optionFilter.itemPassesFilters(item, activeFilters);
                    });
                }
                
                console.log('필터링 후 아이템 수:', state.filteredResults.length);
                
                // 결과 테이블 업데이트
                renderItemsTable();
                
                // 페이지네이션 업데이트
                if (typeof PaginationManager !== 'undefined') {
                    PaginationManager.resetPagination(state.filteredResults.length);
                }
            } catch (error) {
                console.error('필터링 중 오류 발생:', error);
                showFilterError('필터링 중 오류가 발생했습니다');
            }
        }, 10);
    }
    
    /**
     * 필터링 오류 표시
     */
    function showFilterError(message) {
        if (!elements.resultsBody) return;
        
        const tr = document.createElement('tr');
        tr.className = 'error-result';
        tr.innerHTML = `
            <td colspan="4">
                <div class="error-message">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    ${message}
                </div>
            </td>
        `;
        
        elements.resultsBody.innerHTML = '';
        elements.resultsBody.appendChild(tr);
    }
    
    /**
     * 남은 시간 포맷팅 함수
     */
    function formatRemainingTime(expiryDate) {
        if (!expiryDate) return '';
        
        try {
            const expiry = new Date(expiryDate);
            const now = new Date();
            
            // 이미 만료된 경우
            if (expiry <= now) {
                return '만료';
            }
            
            const diffMs = expiry - now;
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
            
            // 표시 형식 결정
            if (diffHours > 0) {
                // 1시간 이상일 때는 시간만 표시
                return `${diffHours}시간`;
            } else if (diffMinutes > 0) {
                // 60분 미만일 때는 분으로만 표시
                return `${diffMinutes}분`;
            } else {
                // 60초 미만일 때는 초로 표시
                return `${diffSeconds}초`;
            }
        } catch (error) {
            console.error('날짜 형식 오류:', error);
            return '';
        }
    }
    
    /**
     * 아이템 가격 포맷팅
     */
    function formatItemPrice(price) {
        if (!price) return { text: '0', class: '' };
        
        // 기본 가격 (1~9999)
        if (price < 10000) {
            return {
                text: `${price}`,
                class: ''
            };
        }
        
        // 만 단위 가격 (10000~99999999)
        if (price < 100000000) {
            const man = Math.floor(price / 10000);
            const remainder = price % 10000;
            
            let text = `${man}만`;
            if (remainder > 0) {
                text += `${remainder}`;
            }
            
            return {
                text: text,
                class: 'item-blue'
            };
        }
        
        // 억 단위 가격 (100000000~9999999999)
        if (price < 10000000000) {
            const eok = Math.floor(price / 100000000);
            const manRemainder = Math.floor((price % 100000000) / 10000);
            const remainder = price % 10000;
            
            let text = `${eok}억`;
            if (manRemainder > 0) {
                text += `${manRemainder}만`;
            }
            if (remainder > 0) {
                text += `${remainder}`;
            }
            
            return {
                text: text,
                class: 'item-red'
            };
        }
        
        // 100억 이상 가격
        const eok = Math.floor(price / 100000000);
        const manRemainder = Math.floor((price % 100000000) / 10000);
        const remainder = price % 10000;
        
        let text = `${eok}억`;
        if (manRemainder > 0) {
            text += `${manRemainder}만`;
        }
        if (remainder > 0) {
            text += `${remainder}`;
        }
        
        return {
            text: text,
            class: 'item-orange'
        };
    }
    
    /**
     * 현재 페이지의 아이템 렌더링
     */
    function renderItemsForPage(startIndex, endIndex) {
        if (!elements.resultsBody || state.filteredResults.length === 0) return;
        
        // 결과 테이블 초기화
        elements.resultsBody.innerHTML = '';
        
        // 페이지에 해당하는 아이템 가져오기
        const pageItems = state.filteredResults.slice(startIndex, endIndex);
        
        // 아이템이 없는 경우
        if (pageItems.length === 0) {
            const tr = document.createElement('tr');
            tr.className = 'empty-result';
            tr.innerHTML = `<td colspan="4">표시할 결과가 없습니다</td>`;
            elements.resultsBody.appendChild(tr);
            return;
        }
        
        // 아이템 행 생성
        pageItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'item-row';
            tr.setAttribute('data-item-id', item.auction_item_no || '');
            tr.setAttribute('data-item', JSON.stringify(item));
            
            // 가격 포맷팅
            const priceFormatted = formatItemPrice(item.auction_price_per_unit || 0);
            
            // 남은 시간 포맷팅
            const remainingTime = formatRemainingTime(item.date_auction_expire);
            
            tr.innerHTML = `
                <td>
                    <div class="item-cell">
                        <div class="item-name">${formatItemDisplayName(item)}</div>
                    </div>
                </td>
                <td>${remainingTime}</td>
                <td>${item.auction_count || 1}</td>
                <td class="item-price ${priceFormatted.class}">${priceFormatted.text}</td>
            `;
            
            elements.resultsBody.appendChild(tr);
        });
    }
    
    /**
     * 아이템 결과 초기화
     */
    function clearResults() {
        state.searchResults = [];
        state.filteredResults = [];
        state.lastSearchResults = [];
        
        if (elements.resultsBody) {
            elements.resultsBody.innerHTML = '';
        }
    }
    
    /**
     * 현재 카테고리 가져오기
     */
    function getCurrentCategory() {
        return state.currentCategory;
    }
    
    // 공개 API
    return {
        init,
        setSearchResults,
        applyLocalFiltering,
        renderItemsForPage,
        clearResults,
        renderItemsTable,
        getCurrentCategory
    };
})();

export default ItemDisplay;
