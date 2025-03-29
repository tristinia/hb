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
        resultsTable: null,
        resultsContainer: null,
        pagination: null
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
        elements.resultsTable = document.querySelector('.results-table');
        elements.resultsContainer = document.querySelector('.results-container');
        elements.pagination = document.getElementById('pagination');
        
        // 테이블 이벤트 리스너 설정
        setupEventListeners();
        
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
     * 이벤트 리스너 설정
     */
    function setupEventListeners() {
        const isMobile = ItemTooltip.isMobileDevice();
        
        if (isMobile) {
            // 모바일 환경 설정
            setupMobileEvents();
        } else {
            // PC 환경 설정
            setupDesktopEvents();
        }
    }
    
    /**
     * 모바일 이벤트 설정
     */
    function setupMobileEvents() {
        // 아이템 클릭 이벤트 (주로 터치)
        elements.resultsContainer.addEventListener('click', (e) => {
            const itemRow = e.target.closest('.item-row');
            if (!itemRow) return;
            
            // 툴팁이 표시 중이어도 새 아이템 클릭 시 즉시 해당 아이템 툴팁으로 전환
            handleItemClick(itemRow, e);
        });
        
        // 툴팁 직접 터치 시 닫기
        document.addEventListener('click', (e) => {
            if (!ItemTooltip.isVisible()) return;
            
            // 툴팁을 직접 터치한 경우
            if (e.target.closest('#item-tooltip')) {
                e.stopPropagation(); // 이벤트 전파 막기
                ItemTooltip.hideTooltip();
                
                // 활성화된 행 초기화
                if (state.activeRow) {
                    state.activeRow.classList.remove('hovered');
                    state.activeRow = null;
                }
            } 
            // 툴팁이 표시된 상태에서 아이템 행과 툴팁 외부를 터치한 경우
            else if (!e.target.closest('.item-row')) {
                ItemTooltip.hideTooltip();
                
                // 활성화된 행 초기화
                if (state.activeRow) {
                    state.activeRow.classList.remove('hovered');
                    state.activeRow = null;
                }
            }
        });
    }
    
    /**
     * PC 이벤트 설정
     */
    function setupDesktopEvents() {
        // 행에 마우스 진입 시 툴팁 표시
        elements.resultsContainer.addEventListener('mouseover', (e) => {
            const itemRow = e.target.closest('.item-row');
            if (itemRow) {
                handleItemHover(itemRow, e);
            }
        });
        
        // 마우스 이동 시 툴팁 위치 업데이트 및 아이템 변경 처리
        document.addEventListener('mousemove', (e) => {
            if (ItemTooltip.isVisible()) {
                // 마우스 커서 아래의 요소 확인 - 항상 마우스 위치를 기준으로 체크
                const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
                
                // 마우스가 아이템 행 위에 있는지 확인 (툴팁과 상관없이)
                const hoveredRow = elementUnderMouse?.closest('.item-row');
                
                if (hoveredRow) {
                    // 아이템 행 위에 있을 때 (이전 행과 다르거나 같거나 상관없이)
                    if (hoveredRow !== state.activeRow) {
                        // 다른 아이템 행이면 새 툴팁 표시
                        handleItemHover(hoveredRow, e);
                    } else {
                        // 같은 행이면 위치만 업데이트
                        ItemTooltip.updatePosition(e.clientX, e.clientY);
                    }
                } else if (!elementUnderMouse?.closest('.results-container')) {
                    // 결과 영역 완전히 밖으로 나가면 툴팁 숨김
                    ItemTooltip.hideTooltip();
                    
                    if (state.activeRow) {
                        state.activeRow.classList.remove('hovered');
                        state.activeRow = null;
                    }
                } else {
                    // 결과 영역 내이지만 아이템 행이 아닌 경우 위치만 업데이트
                    ItemTooltip.updatePosition(e.clientX, e.clientY);
                }
            }
        });
    }
    
    /**
     * 아이템 호버 처리 (PC)
     */
    function handleItemHover(itemRow, e) {
        try {
            // 아이템 데이터 가져오기
            const itemDataStr = itemRow.getAttribute('data-item');
            if (!itemDataStr) return;
            
            const itemData = JSON.parse(itemDataStr);
            
            // 이전 활성화 상태 제거
            if (state.activeRow && state.activeRow !== itemRow) {
                state.activeRow.classList.remove('hovered');
            }
            
            // 현재 행 활성화
            itemRow.classList.add('hovered');
            state.activeRow = itemRow;
            
            // 툴팁 표시 또는 업데이트
            if (ItemTooltip.isVisible()) {
                ItemTooltip.updateTooltip(itemData, e.clientX, e.clientY);
            } else {
                ItemTooltip.showTooltip(itemData, e.clientX, e.clientY);
            }
        } catch (error) {
            console.error('아이템 호버 처리 중 오류:', error);
        }
    }
    
    /**
     * 아이템 클릭 처리 (모바일)
     */
    function handleItemClick(itemRow, e) {
        try {
            // 이벤트 전파 중단 (외부 클릭 이벤트와 충돌 방지)
            e.stopPropagation();
            
            // 아이템 데이터 가져오기
            const itemDataStr = itemRow.getAttribute('data-item');
            if (!itemDataStr) return;
            
            const itemData = JSON.parse(itemDataStr);
            
            // 이전 활성화 상태 제거
            document.querySelectorAll('.item-row.hovered').forEach(row => {
                if (row !== itemRow) {
                    row.classList.remove('hovered');
                }
            });
            
            // 현재 행 활성화
            itemRow.classList.add('hovered');
            state.activeRow = itemRow;
            
            // 터치 좌표 가져오기
            const touchX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : window.innerWidth / 2);
            const touchY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : window.innerHeight / 2);
            
            // 툴팁 표시 또는 업데이트
            if (ItemTooltip.isVisible()) {
                ItemTooltip.updateTooltip(itemData, touchX, touchY);
            } else {
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
