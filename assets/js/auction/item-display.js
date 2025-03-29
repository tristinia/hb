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
        const resultsTable = document.querySelector('.results-table');
        if (!resultsTable) return;
        
        // PC와 모바일 분리 처리
        const isMobile = ItemTooltip.isMobileDevice();
        
        if (isMobile) {
            // 모바일: 터치 시작 시점에 행 감지 (touchend 대신)
            resultsTable.addEventListener('touchstart', handleTouchStart);
            
            // 터치가 끝나는 시점에는 툴팁 표시 여부만 결정
            resultsTable.addEventListener('touchend', handleTouchEnd);
            
            // 모바일: 결과 테이블 외부 터치시 툴팁 닫기
            document.addEventListener('touchstart', function(e) {
                const isResultsArea = e.target.closest('.results-container');
                if (!isResultsArea && ItemTooltip.isVisible()) {
                    ItemTooltip.hideTooltip();
                    
                    // 모든 행 강조 제거
                    document.querySelectorAll('.item-row.hovered').forEach(row => {
                        row.classList.remove('hovered');
                    });
                }
            });
        } else {
            // PC 코드는 그대로 유지
            resultsTable.addEventListener('mouseover', handleMouseOver);
            resultsTable.addEventListener('mouseout', handleMouseOut);
            resultsTable.addEventListener('mousemove', handleMouseMove);
        }
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
        // 마지막 아이템 ID 추적
        handleMouseMove.lastItemId = handleMouseMove.lastItemId || null;
        
        // 현재 마우스 위치의 요소 확인
        let elementAtPoint = document.elementFromPoint(event.clientX, event.clientY);
        
        // 툴팁 자체를 확인하고 건너뛰기
        if (elementAtPoint && (elementAtPoint.id === 'item-tooltip' || elementAtPoint.closest('#item-tooltip'))) {
            // 툴팁 요소를 임시로 숨겨서 그 아래 요소 확인
            const tooltip = document.getElementById('item-tooltip');
            const origDisplay = tooltip.style.display;
            tooltip.style.display = 'none';
            
            // 툴팁 아래 실제 요소 가져오기
            elementAtPoint = document.elementFromPoint(event.clientX, event.clientY);
            
            // 툴팁 원상복구
            tooltip.style.display = origDisplay;
        }
        
        if (!elementAtPoint) return;
        
        // 요소에서 가장 가까운 아이템 행 찾기
        const itemRow = elementAtPoint.closest('.item-row');
        
        // 아이템 행이 있는 경우 툴팁 업데이트
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
                    
                    // 현재 행 강조
                    itemRow.classList.add('hovered');
                    handleMouseMove.lastItemId = currentItemId;
                    
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
            if (ItemTooltip.isVisible()) {
                ItemTooltip.hideTooltip();
                handleMouseMove.lastItemId = null;
                
                // 모든 행의 강조 제거
                document.querySelectorAll('.item-row.hovered').forEach(row => {
                    row.classList.remove('hovered');
                });
            }
        }
    }
    
    /**
     * 터치 이벤트 핸들러 (모바일 전용)
     */
    function handleTouch(event) {
        // 툴팁 터치 확인 - 툴팁을 터치하면 닫기
        if (event.target.closest('#item-tooltip')) {
            event.preventDefault();
            ItemTooltip.hideTooltip();
            return;
        }
        
        // 아이템 행 확인
        const itemRow = event.target.closest('.item-row');
        if (!itemRow) return;
        
        // 이제 행을 찾았을 때만 기본 동작 방지
        event.preventDefault();
        
        try {
            // 아이템 데이터 가져오기
            const itemDataStr = itemRow.getAttribute('data-item');
            if (!itemDataStr) return;
            
            const itemData = JSON.parse(itemDataStr);
            const currentItemId = itemData.auction_item_no || '';
            
            // 툴팁 표시 여부에 따른 처리
            if (ItemTooltip.isVisible()) {
                const visibleItemId = ItemTooltip.getCurrentItemId();
                
                if (currentItemId === visibleItemId) {
                    // 같은 아이템을 다시 터치하면 툴팁 숨김
                    ItemTooltip.hideTooltip();
                    // 강조 제거
                    itemRow.classList.remove('hovered');
                } else {
                    // 다른 아이템 터치면 기존 강조 제거 후 새 아이템 강조
                    document.querySelectorAll('.item-row.hovered').forEach(row => {
                        if (row !== itemRow) {
                            row.classList.remove('hovered');
                        }
                    });
                    
                    // 현재 행 강조
                    itemRow.classList.add('hovered');
                    
                    // 터치 위치 가져오기
                    const touch = event.changedTouches[0];
                    
                    // 툴팁 업데이트
                    ItemTooltip.updateTooltip(itemData, touch.clientX, touch.clientY);
                }
            } else {
                // 현재 행 강조
                itemRow.classList.add('hovered');
                
                // 터치 위치 가져오기
                const touch = event.changedTouches[0];
                
                // 툴팁이 없으면 새로 표시
                ItemTooltip.showTooltip(itemData, touch.clientX, touch.clientY);
            }
        } catch (error) {
            console.error('툴팁 표시 중 오류:', error);
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
