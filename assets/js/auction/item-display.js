/**
 * 아이템 표시 관리 모듈
 * 검색 결과 표시, 아이템 상세 정보, 툴팁 등 처리
 * OptionRenderer와 연동하여 확장된 아이템 표시 기능 추가
 */

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
        resultStats: null,
        tooltip: null
    };
    
    /**
     * 모듈 초기화
     */
    function init() {
        // DOM 요소 참조 가져오기
        elements.resultsBody = document.getElementById('results-body');
        elements.resultStats = document.getElementById('result-stats');
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
            state.currentCategory = subCategory;
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
            
            // 아이템 클릭 이벤트 (모달)
            elements.resultsBody.addEventListener('click', handleItemClick);
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
            tr.innerHTML = `<td colspan="3">검색 결과가 없습니다. 다른 키워드로 검색해보세요.</td>`;
            elements.resultsBody.appendChild(tr);
            updateResultStats(0);
            return;
        }
        
        // 결과 통계 업데이트
        updateResultStats(state.filteredResults.length);
        
        // 가격순으로 정렬 (낮은 가격부터)
        const sortedItems = [...state.filteredResults].sort((a, b) => {
            const priceA = a.auction_price_per_unit || 0;
            const priceB = b.auction_price_per_unit || 0;
            return priceA - priceB;
        });
        
        // 아이템 행 생성
        sortedItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'item-row';
            tr.setAttribute('data-item-id', item.auction_item_no);
            tr.setAttribute('data-item', JSON.stringify(item));
            
            tr.innerHTML = `
                <td>
                    <div class="item-cell">
                        <div class="item-name">${item.item_name}</div>
                    </div>
                </td>
                <td>${item.auction_count || 1}개</td>
                <td class="item-price">${Utils.formatNumber(item.auction_price_per_unit)}G</td>
            `;
            
            elements.resultsBody.appendChild(tr);
        });
    }
    
    /**
     * 결과 통계 업데이트
     * @param {number} count - 결과 개수
     */
    function updateResultStats(count) {
        if (!elements.resultStats) return;
        
        elements.resultStats.textContent = `총 ${count}개 결과`;
    }
    
    /**
     * 로컬 필터링 적용
     */
    function applyLocalFiltering() {
        // 마지막 검색 결과가 없으면 처리하지 않음
        if (state.lastSearchResults.length === 0) {
            return;
        }
        
        // 로딩 시작 (API 호출이 아니므로 별도 처리)
        ApiClient.setLoading(true);
        
        // 필터링 지연 처리 (브라우저 렌더링 차단 방지)
        setTimeout(() => {
            // 필터링 로직 적용
            state.filteredResults = state.lastSearchResults.filter(item => 
                FilterManager.itemPassesFilters(item) && 
                (typeof OptionFilterManager !== 'undefined' ? 
                    OptionFilterManager.itemPassesFilters(item) : 
                    true)
            );
            
            // 결과 테이블 업데이트
            renderItemsTable();
            
            // 로딩 종료
            ApiClient.setLoading(false);
            
            // 페이지네이션 업데이트 (모듈 의존성 해결 필요)
            if (typeof PaginationManager !== 'undefined') {
                PaginationManager.resetPagination(state.filteredResults.length);
            }
        }, 10);
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
        if (!state.tooltipActive) return;
        
        // 툴팁 위치 업데이트
        updateTooltipPosition(event);
    }
    
    /**
     * 아이템 클릭 이벤트 핸들러 (상세 모달)
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function handleItemClick(event) {
        const tr = event.target.closest('.item-row');
        if (!tr) return;
        
        // 아이템 데이터 가져오기
        try {
            const itemData = JSON.parse(tr.getAttribute('data-item'));
            showItemDetails(itemData);
        } catch (e) {
            console.error('아이템 데이터 파싱 오류:', e);
        }
    }
    
    /**
     * 아이템 툴팁 표시
     * @param {Object} item - 아이템 데이터
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function showItemTooltip(item, event) {
        if (!elements.tooltip) return;
        
        state.tooltipActive = true;
        
        // 툴팁 내용 초기화
        elements.tooltip.innerHTML = '';
        
        // 확장된 옵션 렌더러 사용 (있는 경우)
        if (typeof OptionRenderer !== 'undefined') {
            const detailsElement = OptionRenderer.renderItemDetails(item);
            
            if (detailsElement) {
                // 툴팁 기본 레이아웃 생성
                const tooltipHeader = document.createElement('div');
                tooltipHeader.className = 'tooltip-header';
                tooltipHeader.innerHTML = `<h3>${item.item_name || '제목 없음'}</h3>`;
                
                // 가격 정보 추가
                const priceInfo = document.createElement('div');
                priceInfo.className = 'tooltip-price';
                priceInfo.innerHTML = `
                    <span>가격: ${Utils.formatNumber(item.auction_price_per_unit)}G</span>
                    <span>판매 수량: ${item.auction_count || 1}개</span>
                `;
                
                // 툴팁에 추가
                elements.tooltip.appendChild(tooltipHeader);
                
                const tooltipContent = document.createElement('div');
                tooltipContent.className = 'tooltip-content';
                tooltipContent.appendChild(priceInfo);
                tooltipContent.appendChild(detailsElement);
                
                elements.tooltip.appendChild(tooltipContent);
            } else {
                // 옵션 렌더러에서 생성 실패 시 기본 툴팁
                renderBasicTooltip(item);
            }
        } else {
            // 옵션 렌더러가 없는 경우 기본 툴팁
            renderBasicTooltip(item);
        }
        
        // 툴팁 위치 설정
        updateTooltipPosition(event);
        
        // 툴팁 표시
        elements.tooltip.style.display = 'block';
    }
    
    /**
     * 기본 툴팁 렌더링
     * @param {Object} item - 아이템 데이터
     */
    function renderBasicTooltip(item) {
        // 옵션 정보 추출
        let optionsHtml = '';
        if (item.item_option && item.item_option.length > 0) {
            // 중요한 옵션 먼저 표시
            const priorityOptions = ['분류', '레벨', '무게', '내구도', '색상', '두루마리', '속성'];
            const priorityOptionsData = [];
            const normalOptionsData = [];
            
            item.item_option.forEach(option => {
                if (option.option_type && option.option_value) {
                    const optionHtml = `
                        <div class="tooltip-option">
                            <span class="option-type">${option.option_type}:</span>
                            <span class="option-value">${option.option_value}</span>
                        </div>
                    `;
                    
                    if (priorityOptions.includes(option.option_type)) {
                        priorityOptionsData.push({
                            type: option.option_type,
                            html: optionHtml,
                            index: priorityOptions.indexOf(option.option_type)
                        });
                    } else {
                        normalOptionsData.push(optionHtml);
                    }
                }
            });
            
            // 우선순위 옵션 정렬 및 추가
            priorityOptionsData.sort((a, b) => a.index - b.index);
            priorityOptionsData.forEach(option => {
                optionsHtml += option.html;
            });
            
            // 일반 옵션 추가
            normalOptionsData.forEach(optionHtml => {
                optionsHtml += optionHtml;
            });
        }
        
        // 툴팁 내용 생성
        elements.tooltip.innerHTML = `
            <div class="tooltip-header">
                <h3>${item.item_name}</h3>
            </div>
            <div class="tooltip-content">
                <div class="tooltip-price">
                    <span>가격: ${Utils.formatNumber(item.auction_price_per_unit)}G</span>
                    <span>판매 수량: ${item.auction_count || 1}개</span>
                </div>
                <div class="tooltip-options">
                    ${optionsHtml || '<div class="no-options">옵션 정보가 없습니다.</div>'}
                </div>
            </div>
        `;
    }
    
    /**
     * 툴팁 위치 업데이트
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function updateTooltipPosition(event) {
        if (!elements.tooltip) return;
        
        // 마우스 위치에 따라 툴팁 위치 조정
        const x = event.clientX + 15;
        const y = event.clientY + 15;
        
        // 뷰포트 경계 확인
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const tooltipWidth = elements.tooltip.offsetWidth;
        const tooltipHeight = elements.tooltip.offsetHeight;
        
        // 화면 오른쪽 경계를 넘어가는 경우
        if (x + tooltipWidth > viewportWidth) {
            elements.tooltip.style.left = (viewportWidth - tooltipWidth - 10) + 'px';
        } else {
            elements.tooltip.style.left = x + 'px';
        }
        
        // 화면 아래 경계를 넘어가는 경우
        if (y + tooltipHeight > viewportHeight) {
            elements.tooltip.style.top = (viewportHeight - tooltipHeight - 10) + 'px';
        } else {
            elements.tooltip.style.top = y + 'px';
        }
    }
    
    /**
     * 툴팁 숨기기
     */
    function hideItemTooltip() {
        if (!elements.tooltip) return;
        
        state.tooltipActive = false;
        elements.tooltip.style.display = 'none';
    }
    
    /**
     * 아이템 상세 정보 모달 표시
     * @param {Object} item - 아이템 데이터
     */
    function showItemDetails(item) {
        // 모달 컨테이너 생성
        const modalContainer = document.createElement('div');
        modalContainer.className = 'modal-container';
        
        // 확장된 옵션 렌더러 사용 (있는 경우)
        let modalBody = '';
        
        if (typeof OptionRenderer !== 'undefined') {
            // OptionRenderer 사용
            modalBody = '<div id="item-details-container" class="item-details-container"></div>';
        } else {
            // 기본 렌더링 사용
            // 옵션 정보 추출
            let optionsHtml = '';
            if (item.item_option && item.item_option.length > 0) {
                item.item_option.forEach(option => {
                    if (option.option_type && option.option_value) {
                        optionsHtml += `
                            <div class="item-option">
                                <strong>${option.option_type}:</strong> ${option.option_value}
                            </div>
                        `;
                    }
                });
            }
            
            modalBody = `
                <div class="item-basic-info">
                    <p><strong>카테고리:</strong> ${item.auction_item_category || '정보 없음'}</p>
                    <p><strong>가격:</strong> ${Utils.formatNumber(item.auction_price_per_unit)}G</p>
                    <p><strong>판매 수량:</strong> ${item.auction_count || 1}개</p>
                </div>
                <div class="item-options">
                    <h4>아이템 옵션</h4>
                    ${optionsHtml || '<p>옵션 정보가 없습니다.</p>'}
                </div>
            `;
        }
        
        // 모달 HTML 생성
        modalContainer.innerHTML = `
            <div class="item-detail-modal">
                <div class="modal-header">
                    <h3>${item.item_name}</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    ${modalBody}
                </div>
            </div>
        `;
        
        document.body.appendChild(modalContainer);
        
        // 옵션 렌더러로 상세 정보 렌더링
        if (typeof OptionRenderer !== 'undefined') {
            const detailsContainer = modalContainer.querySelector('#item-details-container');
            if (detailsContainer) {
                const detailsElement = OptionRenderer.renderItemDetails(item);
                if (detailsElement) {
                    detailsContainer.appendChild(detailsElement);
                }
            }
        }
        
        // 모달 닫기 버튼 이벤트
        const closeButton = modalContainer.querySelector('.close-modal');
        closeButton.addEventListener('click', () => {
            document.body.removeChild(modalContainer);
        });
        
        // 모달 바깥 클릭 시 닫기
        modalContainer.addEventListener('click', (e) => {
            if (e.target === modalContainer) {
                document.body.removeChild(modalContainer);
            }
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
            elements.resultsBody.innerHTML = '<tr class="empty-result"><td colspan="3">검색어를 입력하세요.</td></tr>';
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
        clearResults,
        renderItemsTable,
        getCurrentCategory
    };
})();
