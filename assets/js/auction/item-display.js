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

const ItemDisplay = (() => {
    // 아이템 표시 상태
    const state = {
        searchResults: [],
        filteredResults: [],
        lastSearchResults: [], // 필터링용 캐시
        currentCategory: null
    };
    
    // DOM 요소 참조
    let elements = {
        resultsBody: null,
        tooltip: null
    };

    /**
     * 툴팁 관리자 - 아이템 툴팁 처리 전담
     */
    const TooltipManager = {
        element: null,       // 툴팁 DOM 요소
        isVisible: false,    // 툴팁 표시 상태
        offsetX: 15,         // 마우스에서 X축 오프셋
        
        /**
         * 툴팁 관리자 초기화
         * @param {HTMLElement} tooltipElement - 툴팁 DOM 요소
         */
        init(tooltipElement) {
            this.element = tooltipElement;
            
            if (this.element) {
                this.element.style.position = 'fixed';
                this.element.style.display = 'none';
            }
        },
        
        /**
         * 아이템 툴팁 표시
         * @param {Object} item - 아이템 데이터
         * @param {number} x - 마우스 X 좌표
         * @param {number} y - 마우스 Y 좌표
         */
        show(item, x, y) {
            if (!this.element || !item) return;
            
            // 내용 초기화 및 생성
            this.element.innerHTML = '';
            const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(item);
            this.element.appendChild(tooltipContent);
            
            // 툴팁 표시 (우선 화면 밖에서 크기 측정)
            this.element.style.display = 'block';
            this.element.style.left = '-9999px';
            this.element.style.top = '-9999px';
            
            // 위치 계산 후 적용
            this.updatePosition(x, y);
            
            this.isVisible = true;
        },
        
        /**
         * 툴팁 위치 업데이트
         * @param {number} x - 마우스 X 좌표
         * @param {number} y - 마우스 Y 좌표
         */
        updatePosition(x, y) {
            if (!this.element || !this.isVisible) return;
            
            // 화면 크기
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            // 툴팁 크기
            const rect = this.element.getBoundingClientRect();
            const tooltipWidth = rect.width;
            const tooltipHeight = rect.height;
            
            // 기본 위치 (마우스 오른쪽)
            let left = x + this.offsetX;
            let top = y;
            
            // 오른쪽 경계 검사 - 화면을 벗어나면 오른쪽 경계에 맞춤
            if (left + tooltipWidth > windowWidth) {
                left = windowWidth - tooltipWidth;
            }
            
            // 아래쪽 경계 검사 - 화면을 벗어나면 아래쪽 경계에 맞춤
            if (top + tooltipHeight > windowHeight) {
                top = windowHeight - tooltipHeight;
            }
            
            // 위치가 음수가 되지 않도록 보정
            left = Math.max(0, left);
            top = Math.max(0, top);
            
            // 위치 적용
            this.element.style.left = `${left}px`;
            this.element.style.top = `${top}px`;
        },
        
        /**
         * 툴팁 숨기기
         */
        hide() {
            if (!this.element) return;
            
            this.element.style.display = 'none';
            this.element.innerHTML = '';
            this.isVisible = false;
        }
    };

    /**
     * 아이템 표시 이름 포맷팅 (색상 처리)
     * @param {Object} item - 아이템 데이터
     * @returns {string} HTML 포맷팅된 아이템 이름
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
                    result += `<span class="item-special-prefix">${specialPrefix}</span>`;
                } else {
                    result += `<span class="item-normal">${specialPrefix}</span>`;
                }
            }
            
            if (enchantPart) {
                // 인챈트 = 파란색
                result += `<span class="item-enchant">${enchantPart}</span>`;
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
        
        // 툴팁 관리자 초기화
        TooltipManager.init(elements.tooltip);
        
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
        if (elements.resultsBody) {
            // 클릭 이벤트에서 e.stopPropagation()을 추가하여 이벤트 전파 방지
            // 이렇게 하면 특별히 다른 이벤트 리스너는 필요하지 않음
            // 툴팁은 별도 모듈(ItemTooltip)에서 처리함
            
            // 이벤트 리스너가 충돌하지 않도록 기존 핸들러 제거
            elements.resultsBody.removeEventListener('click', handleItemClick);
            
            // 이벤트 버블링 방지를 위한 클릭 핸들러 추가
            elements.resultsBody.addEventListener('click', function(e) {
                // 클릭 이벤트의 기본 동작 및 전파 방지
                // 이렇게 하면 상위 요소의 이벤트 핸들러가 실행되지 않음
                e.stopPropagation();
            });
        }
    }
    
    /**
     * 아이템 마우스 오버 이벤트 핸들러
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function handleItemMouseOver(event) {
        const itemRow = event.target.closest('.item-row');
        if (!itemRow) return;
        
        try {
            // 아이템 데이터 가져오기
            const itemData = JSON.parse(itemRow.getAttribute('data-item'));
            
            // 툴팁 표시
            TooltipManager.show(itemData, event.clientX, event.clientY);
        } catch (e) {
            console.error('아이템 데이터 파싱 오류:', e);
        }
    }
    
    /**
     * 아이템 마우스 아웃 이벤트 핸들러
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function handleItemMouseOut(event) {
        const itemRow = event.target.closest('.item-row');
        if (!itemRow) return;
        
        // 자식 요소로 이동한 경우는 무시
        const relatedTarget = event.relatedTarget;
        if (relatedTarget && itemRow.contains(relatedTarget)) return;
        
        // 툴팁 숨기기
        TooltipManager.hide();
    }
    
    /**
     * 아이템 마우스 이동 이벤트 핸들러
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function handleItemMouseMove(event) {
        // 툴팁 위치 업데이트
        if (TooltipManager.isVisible) {
            TooltipManager.updatePosition(event.clientX, event.clientY);
        }
    }
     
    /**
     * 검색 결과 설정 및 렌더링
     * @param {Array} items - 아이템 목록
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
            const priceFormatted = optionRenderer.formatItemPrice(item.auction_price_per_unit || 0);
            
            // 남은 시간 포맷팅
            const remainingTime = formatRemainingTime(item.date_auction_expire);
            
            tr.innerHTML = `
                <td>
                    <div class="item-cell">
                        <div class="item-name">${formatItemDisplayName(item)}</div>
                    </div>
                </td>
                <td>${remainingTime}</td>
                <td>${item.auction_count || 1}개</td>
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
        
        // 로딩 시작 (API 호출이 아니므로 별도 처리)
        ApiClient.setLoading(true);
        
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
            } finally {
                // 로딩 종료
                ApiClient.setLoading(false);
            }
        }, 10);
    }
    
    /**
     * 필터링 오류 표시
     * @param {string} message - 오류 메시지
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
     * @param {string} expiryDate - ISO 형식 만료 시간
     * @returns {string} 포맷된 남은 시간
     */
    function formatRemainingTime(expiryDate) {
        if (!expiryDate) return '';
        
        try {
            const expiry = new Date(expiryDate);
            const now = new Date();
            
            // 이미 만료된 경우
            if (expiry <= now) {
                return '만료됨';
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
     * 현재 페이지의 아이템 렌더링
     * @param {number} startIndex - 시작 인덱스
     * @param {number} endIndex - 종료 인덱스
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
            const priceFormatted = optionRenderer.formatItemPrice(item.auction_price_per_unit || 0);
            
            // 남은 시간 포맷팅
            const remainingTime = formatRemainingTime(item.date_auction_expire);
            
            tr.innerHTML = `
                <td>
                    <div class="item-cell">
                        <div class="item-name">${formatItemDisplayName(item)}</div>
                    </div>
                </td>
                <td>${remainingTime}</td>
                <td>${item.auction_count || 1}개</td>
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
        
        // 툴팁 숨기기
        TooltipManager.hide();
    }
    
    /**
     * 현재 카테고리 가져오기
     * @returns {string} 현재 카테고리 ID
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
