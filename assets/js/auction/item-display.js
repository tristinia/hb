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
        tooltipActive: false,
        currentCategory: null
    };
    
    // DOM 요소 참조
    let elements = {
        resultsBody: null,
        tooltip: null
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
            // 테이블 마우스 이벤트 (툴팁)
            elements.resultsBody.addEventListener('mouseover', handleTableMouseOver);
            elements.resultsBody.addEventListener('mouseout', handleTableMouseOut);
            elements.resultsBody.addEventListener('mousemove', handleTableMouseMove);
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
            <td colspan="3">
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
        
        if (elements.resultStats) {
            elements.resultStats.textContent = '';
        }
    }
    
    /**
     * 테이블 마우스 오버 이벤트 핸들러 (툴팁)
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function handleTableMouseOver(event) {
        const tr = event.target.closest('.item-row');
        if (!tr) return;
        
        // 아이템 데이터 가져오기
        try {
            const itemData = JSON.parse(tr.getAttribute('data-item'));
            showItemTooltip(itemData, event);
        } catch (e) {
            console.error('아이템 데이터 파싱 오류:', e);
        }
    }
    
    /**
     * 테이블 마우스 아웃 이벤트 핸들러 (툴팁)
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function handleTableMouseOut(event) {
        const tr = event.target.closest('.item-row');
        if (!tr) return;
        
        const relatedTarget = event.relatedTarget;
        if (relatedTarget && tr.contains(relatedTarget)) return;
        
        hideItemTooltip();
    }

    
    /**
     * 테이블 마우스 이동 이벤트 핸들러 (툴팁 위치)
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function handleTableMouseMove(event) {

    }
    
    /**
     * 아이템 툴팁 표시
     * @param {Object} item - 아이템 데이터
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function showItemTooltip(item, event) {
        if (!elements.tooltip || !item) return;
        
        // 1단계: 모든 준비 설정 - 초기화 및 숨김 상태로 생성
        elements.tooltip.innerHTML = '';
        elements.tooltip.style.display = 'none'; // 숨김 상태에서 시작
        
        // 2단계: 필요한 제약 조건 계산
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const isMobile = viewportWidth < 768;
        
        // 여백 조정
        const margin = 15;
        
        // 최대 크기 계산 (비율 적용)
        const maxWidthRatio = isMobile ? 0.8 : 0.4;
        const maxHeightRatio = isMobile ? 0.7 : 0.6;
        const maxWidth = Math.floor(viewportWidth * maxWidthRatio);
        const maxHeight = Math.floor(viewportHeight * maxHeightRatio);
        
        // 3단계: 툴팁에 스타일 적용
        elements.tooltip.style.maxWidth = `${maxWidth}px`;
        elements.tooltip.style.maxHeight = `${maxHeight}px`;
        elements.tooltip.style.overflow = 'auto';
        
        // 4단계: 내용 생성
        const tooltipContent = optionRenderer.renderMabinogiStyleTooltip(item);
        elements.tooltip.appendChild(tooltipContent);
        
        // 5단계: 임시로 표시해서 크기 측정
        elements.tooltip.style.visibility = 'hidden'; // 보이지 않게
        elements.tooltip.style.display = 'block';     // 표시 상태로
        
        // 6단계: 강제 리플로우로 정확한 크기 얻기
        // 이 줄이 브라우저에게 요소를 실제로 렌더링하도록 강제
        const forceReflow = elements.tooltip.offsetHeight; 
        
        // 7단계: 이제 정확한 크기를 얻을 수 있음
        const tooltipWidth = elements.tooltip.offsetWidth;
        const tooltipHeight = elements.tooltip.offsetHeight;
        
        // 8단계: 위치 계산
        let left = event.clientX + margin;
        let top = event.clientY + margin;
        
        // 오른쪽 경계 확인
        if (left + tooltipWidth + margin > viewportWidth) {
            left = Math.max(margin, event.clientX - tooltipWidth - margin);
        }
        
        // 아래쪽 경계 확인
        if (top + tooltipHeight + margin > viewportHeight) {
            top = Math.max(margin, event.clientY - tooltipHeight - margin);
        }
        
        // 9단계: 최종 위치 설정
        elements.tooltip.style.left = `${left}px`;
        elements.tooltip.style.top = `${top}px`;
        
        // 10단계: 이제 표시
        elements.tooltip.style.visibility = 'visible';
        state.tooltipActive = true;
    }
    
    /**
     * 툴팁 위치 즉시 계산 및 적용
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function positionTooltipNow(event) {
        if (!elements.tooltip || !state.tooltipActive) return;
        
        // 화면 크기
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // 여백
        const margin = 15;
        
        // ★★★ 여기가 핵심: offsetWidth/offsetHeight 사용 ★★★
        // offsetWidth/offsetHeight는 스크롤바와 경계를 포함한 전체 요소 크기
        const tooltipWidth = elements.tooltip.offsetWidth;
        const tooltipHeight = elements.tooltip.offsetHeight;
        
        // 마우스 위치
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        
        // 초기 위치 (마우스 오른쪽 아래)
        let left = mouseX + margin;
        let top = mouseY + margin;
        
        // ★★★ 여기가 핵심: 화면 경계 확인 및 간단 조정 ★★★
        // 오른쪽 확인
        if (left + tooltipWidth + margin > viewportWidth) {
            left = Math.max(margin, mouseX - tooltipWidth - margin);
        }
        
        // 아래쪽 확인
        if (top + tooltipHeight + margin > viewportHeight) {
            top = Math.max(margin, mouseY - tooltipHeight - margin);
        }
        
        // 위치 적용
        elements.tooltip.style.left = `${left}px`;
        elements.tooltip.style.top = `${top}px`;
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
     * 툴팁 위치 업데이트
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function updateTooltipPosition(event) {
        if (!elements.tooltip || !state.tooltipActive) return;
        
        // 화면 치수 가져오기
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // 모바일 디바이스 확인
        const isMobile = window.innerWidth < 768;
        
        // 여백 설정 (화면 경계와의 간격)
        const margin = 16;
        
        // 툴팁 크기 제한 설정 (화면 비율 기준)
        const maxWidthRatio = isMobile ? 0.9 : 0.4;
        const maxHeightRatio = isMobile ? 0.7 : 0.6;
        
        // 최대 가능한 너비/높이 계산 (여백 고려)
        const maxWidth = Math.floor(viewportWidth * maxWidthRatio) - margin;
        const maxHeight = Math.floor(viewportHeight * maxHeightRatio) - margin;
        
        // 툴팁 크기 제한 적용
        elements.tooltip.style.maxWidth = `${maxWidth}px`;
        elements.tooltip.style.maxHeight = `${maxHeight}px`;
        elements.tooltip.style.overflow = 'auto';
        
        // 툴팁 실제 크기 측정 (스크롤바 포함)
        const tooltipRect = elements.tooltip.getBoundingClientRect();
        const tooltipWidth = tooltipRect.width;
        const tooltipHeight = tooltipRect.height;
        
        // 마우스 위치 가져오기
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        
        // 각 방향으로 사용 가능한 공간 계산
        const spaceRight = viewportWidth - mouseX - margin;
        const spaceLeft = mouseX - margin;
        const spaceBelow = viewportHeight - mouseY - margin;
        const spaceAbove = mouseY - margin;
        
        // 위치 결정 로직
        let posX, posY;
        const offset = 15; // 마우스 포인터와의 거리
        
        // X축 위치 결정 (좌/우)
        if (tooltipWidth <= spaceRight) {
            // 오른쪽에 충분한 공간이 있음
            posX = mouseX + offset;
        } else if (tooltipWidth <= spaceLeft) {
            // 왼쪽에 충분한 공간이 있음
            posX = mouseX - tooltipWidth - offset;
        } else {
            // 양쪽 모두 충분한 공간이 없음 - 가장 많은 공간이 있는 쪽에 배치
            if (spaceRight >= spaceLeft) {
                posX = viewportWidth - tooltipWidth - margin;
            } else {
                posX = margin;
            }
        }
        
        // Y축 위치 결정 (위/아래)
        if (tooltipHeight <= spaceBelow) {
            // 아래에 충분한 공간이 있음
            posY = mouseY + offset;
        } else if (tooltipHeight <= spaceAbove) {
            // 위에 충분한 공간이 있음
            posY = mouseY - tooltipHeight - offset;
        } else {
            // 위/아래 모두 충분한 공간이 없음 - 가장 많은 공간이 있는 쪽에 배치
            if (spaceBelow >= spaceAbove) {
                posY = viewportHeight - tooltipHeight - margin;
            } else {
                posY = margin;
            }
        }
        
        // 모바일에서는 특별 처리 (화면 중앙에 가깝게 배치)
        if (isMobile) {
            // X축은 화면 중앙에 맞추되 여백 유지
            posX = Math.max(margin, Math.min(
                (viewportWidth - tooltipWidth) / 2,
                viewportWidth - tooltipWidth - margin
            ));
            
            // Y축은 화면 중앙보다 약간 위에 배치 (손가락으로 가리지 않도록)
            posY = Math.max(margin, Math.min(
                (viewportHeight - tooltipHeight) * 0.4,
                viewportHeight - tooltipHeight - margin
            ));
        }
        
        // 최종적으로 화면 경계 벗어남 방지 (안전장치)
        posX = Math.max(margin, Math.min(posX, viewportWidth - tooltipWidth - margin));
        posY = Math.max(margin, Math.min(posY, viewportHeight - tooltipHeight - margin));
        
        // 툴팁 위치 적용
        elements.tooltip.style.left = `${posX}px`;
        elements.tooltip.style.top = `${posY}px`;
    }
    
    /**
     * 툴팁 숨기기
     */
    function hideItemTooltip() {
        if (!elements.tooltip) return;
        
        // 타이머 정리
        if (state.tooltipTimer) {
            clearTimeout(state.tooltipTimer);
            state.tooltipTimer = null;
        }
        
        state.tooltipActive = false;
        elements.tooltip.style.display = 'none';
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
        
        if (elements.resultStats) {
            elements.resultStats.textContent = '';
        }
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
