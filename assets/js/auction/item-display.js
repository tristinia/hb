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
        activeRow: null,  // 현재 활성화된 행 추적
        hoverDebounceDelay: 50, // 호버 이벤트 디바운스 지연 (ms)
        mouseMoveThrottle: 16,  // 마우스 이동 쓰로틀 간격 (ms, 약 60fps)
        hoveredItemId: null     // 현재 호버된 아이템 ID
    };
    
    // DOM 요소 참조
    let elements = {
        resultsBody: null,
        resultsTable: null,
        resultsContainer: null,
        pagination: null
    };

    // 디바운스 및 쓰로틀 타이머
    let hoverDebounceTimer = null;
    let mouseMoveThrottleTimer = null;
    let lastMouseMoveTime = 0;
    
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
        elements.resultsTable = document.querySelector('.results-table');
        elements.resultsContainer = document.querySelector('.results-container');
        elements.pagination = document.getElementById('pagination');
        
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
        // 모바일 여부 확인
        const isMobile = ItemTooltip.isMobileDevice();
        
        if (elements.resultsContainer) {
            if (isMobile) {
                // 모바일 환경 - 터치 이벤트
                setupMobileEventListeners();
            } else {
                // PC 환경 - 마우스 이벤트
                setupDesktopEventListeners();
            }
        }
    }
    
    /**
     * 모바일 환경 이벤트 리스너 설정
     */
    function setupMobileEventListeners() {
        // 터치 이벤트로 툴팁 표시/숨김
        elements.resultsContainer.addEventListener('click', handleItemClick);
    }
    
    /**
     * PC 환경 이벤트 리스너 설정
     */
    function setupDesktopEventListeners() {
        // 결과 컨테이너에 위임 이벤트 설정
        elements.resultsContainer.addEventListener('mouseover', handleItemRowHover);
        elements.resultsContainer.addEventListener('mouseout', handleItemRowLeave);
        
        // 마우스 이동에 따른 툴팁 위치 업데이트 (쓰로틀링 적용)
        document.addEventListener('mousemove', handleMouseMove);
    }
    
    /**
     * 아이템 행 마우스 호버 처리 (PC)
     */
    function handleItemRowHover(e) {
        // 아이템 행 확인
        const itemRow = e.target.closest('.item-row');
        if (!itemRow) return;
        
        // 아이템 데이터 가져오기
        try {
            const itemDataStr = itemRow.getAttribute('data-item');
            if (!itemDataStr) return;
            
            const itemData = JSON.parse(itemDataStr);
            const itemId = itemData.auction_item_no || '';
            
            // 이미 호버 중인 동일 아이템이면 스킵 (중복 처리 방지)
            if (state.hoveredItemId === itemId) return;
            
            // 디바운스 적용 (빠른 마우스 이동 시 깜빡임 방지)
            clearTimeout(hoverDebounceTimer);
            
            hoverDebounceTimer = setTimeout(() => {
                // 호버된 아이템 ID 업데이트
                state.hoveredItemId = itemId;
                
                // 이전 활성화 상태 제거
                if (state.activeRow && state.activeRow !== itemRow) {
                    state.activeRow.classList.remove('hovered');
                }
                
                // 현재 행 활성화
                itemRow.classList.add('hovered');
                state.activeRow = itemRow;
                
                // 마우스 위치 확인
                const mouseX = e.clientX;
                const mouseY = e.clientY;
                
                // 툴팁 표시 또는 업데이트
                if (ItemTooltip.isVisible()) {
                    ItemTooltip.updateTooltip(itemData, mouseX, mouseY);
                } else {
                    ItemTooltip.showTooltip(itemData, mouseX, mouseY);
                }
            }, state.hoverDebounceDelay);
        } catch (error) {
            console.error('아이템 호버 처리 중 오류:', error);
        }
    }
    
    /**
     * 아이템 행 마우스 이탈 처리 (PC)
     */
    function handleItemRowLeave(e) {
        // relatedTarget이 결과 컨테이너 안에 있는지 확인
        const isInsideContainer = e.relatedTarget && 
            (e.relatedTarget.closest('.results-container') || 
             e.relatedTarget.closest('.item-tooltip'));
        
        // 결과 컨테이너 내부로 이동하는 경우 무시
        if (isInsideContainer) return;
        
        // 디바운스 타이머 정리
        clearTimeout(hoverDebounceTimer);
        
        // 호버 상태 초기화
        state.hoveredItemId = null;
        
        // 툴팁 숨기기
        ItemTooltip.hideTooltip();
        
        // 현재 활성화된 행 초기화
        if (state.activeRow) {
            state.activeRow.classList.remove('hovered');
            state.activeRow = null;
        }
    }
    
    /**
     * 마우스 이동 처리 (툴팁 위치 업데이트)
     */
    function handleMouseMove(e) {
        // 툴팁이 표시 중이고 활성화된 행이 있는 경우에만 위치 업데이트
        if (!ItemTooltip.isVisible() || !state.activeRow) return;
        
        // 쓰로틀링 적용 (성능 최적화)
        const now = Date.now();
        if (now - lastMouseMoveTime < state.mouseMoveThrottle) return;
        
        lastMouseMoveTime = now;
        
        // 마우스가 현재 어떤 아이템 행 위에 있는지 확인
        const hoveredRow = document.elementFromPoint(e.clientX, e.clientY)?.closest('.item-row');
        
        if (hoveredRow) {
            // 마우스가 다른 아이템 행으로 이동한 경우
            if (hoveredRow !== state.activeRow) {
                try {
                    const itemDataStr = hoveredRow.getAttribute('data-item');
                    if (itemDataStr) {
                        const itemData = JSON.parse(itemDataStr);
                        const itemId = itemData.auction_item_no || '';
                        
                        // 이전 행 강조 제거
                        if (state.activeRow) {
                            state.activeRow.classList.remove('hovered');
                        }
                        
                        // 새 행 강조
                        hoveredRow.classList.add('hovered');
                        state.activeRow = hoveredRow;
                        state.hoveredItemId = itemId;
                        
                        // 툴팁 업데이트
                        ItemTooltip.updateTooltip(itemData, e.clientX, e.clientY);
                        return;
                    }
                } catch (error) {
                    console.error('마우스 이동 처리 중 오류:', error);
                }
            }
        }
        
        // 동일한 아이템 위에서 이동 중이면 위치만 업데이트
        ItemTooltip.updatePosition(e.clientX, e.clientY);
    }
    
    /**
     * 아이템 클릭 처리 (모바일용)
     */
    function handleItemClick(e) {
        const itemRow = e.target.closest('.item-row');
        if (!itemRow) return;
        
        try {
            const itemDataStr = itemRow.getAttribute('data-item');
            if (!itemDataStr) return;
            
            const itemData = JSON.parse(itemDataStr);
            const itemId = itemData.auction_item_no || '';
            
            // 이전 활성화 상태 제거
            document.querySelectorAll('.item-row.hovered').forEach(row => {
                if (row !== itemRow) {
                    row.classList.remove('hovered');
                }
            });
            
            // 현재 행 활성화 상태 토글
            itemRow.classList.toggle('hovered');
            
            // 현재 선택된 아이템인지 확인
            const isAlreadySelected = (state.activeRow === itemRow);
            
            // 툴팁 표시 여부 결정
            if (isAlreadySelected && ItemTooltip.isVisible() && ItemTooltip.getCurrentItemId() === itemId) {
                // 이미 선택된 동일 아이템은 클릭 시 상태 초기화
                ItemTooltip.hideTooltip();
                state.activeRow = null;
            } else {
                // 새 아이템 선택
                state.activeRow = itemRow;
                
                // 터치 이벤트 좌표 가져오기
                const touchX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : window.innerWidth / 2);
                const touchY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : window.innerHeight / 2);
                
                // 툴팁 표시
                ItemTooltip.showTooltip(itemData, touchX, touchY);
            }
        } catch (error) {
            console.error('아이템 클릭 처리 중 오류:', error);
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
        
        // 페이지네이션 표시 확인
        if (elements.pagination) {
            elements.pagination.style.display = 'flex';
        }
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
        
        // 페이지네이션 표시 확인
        if (elements.pagination) {
            elements.pagination.style.display = 'flex';
        }
    }
    
    /**
     * 아이템 결과 초기화
     */
    function clearResults() {
        state.searchResults = [];
        state.filteredResults = [];
        state.lastSearchResults = [];
        state.activeRow = null;
        state.hoveredItemId = null;
        
        // 디바운스 타이머 정리
        clearTimeout(hoverDebounceTimer);
        clearTimeout(mouseMoveThrottleTimer);
        
        if (elements.resultsBody) {
            elements.resultsBody.innerHTML = '';
        }
        
        if (ItemTooltip.isVisible()) {
            ItemTooltip.hideTooltip();
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
