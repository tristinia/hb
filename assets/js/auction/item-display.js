/**
 * 아이템 표시 관리 모듈
 * 검색 결과 표시, 아이템 정보, 툴팁 등 처리
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
            tr.innerHTML = `<td colspan="3">검색 결과가 없습니다. 다른 키워드나 카테고리로 검색해보세요.</td>`;
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
            tr.setAttribute('data-item-id', item.auction_item_no || '');
            tr.setAttribute('data-item', JSON.stringify(item));
            
            tr.innerHTML = `
                <td>
                    <div class="item-cell">
                        <div class="item-name">${item.item_name || item.item_display_name || '이름 없음'}</div>
                    </div>
                </td>
                <td>${item.auction_count || 1}개</td>
                <td class="item-price">${Utils.formatNumber(item.auction_price_per_unit || 0)}G</td>
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
            try {
                // 필터링 로직 적용
                state.filteredResults = state.lastSearchResults.filter(item => 
                    FilterManager.itemPassesFilters(item) && 
                    (typeof OptionFilterManager !== 'undefined' ? 
                        OptionFilterManager.itemPassesFilters(item) : 
                        true)
                );
                
                // 결과 테이블 업데이트
                renderItemsTable();
                
                // 페이지네이션 업데이트 (모듈 의존성 해결 필요)
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
        if (!state.tooltipActive) return;
        
        // 툴팁 위치 업데이트
        updateTooltipPosition(event);
    }
    
    /**
     * 아이템 툴팁 표시
     * @param {Object} item - 아이템 데이터
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function showItemTooltip(item, event) {
        if (!elements.tooltip || !item) return;
        
        state.tooltipActive = true;
        
        // 툴팁 내용 초기화
        elements.tooltip.innerHTML = '';
        
        // 마비노기 스타일의 툴팁 렌더링
        const tooltipContent = renderMabinogiStyleTooltip(item);
        elements.tooltip.appendChild(tooltipContent);
        
        // 툴팁 위치 설정
        updateTooltipPosition(event);
        
        // 툴팁 표시
        elements.tooltip.style.display = 'block';
    }
    
    /**
     * 마비노기 스타일 아이템 툴팁 렌더링 함수
     * @param {Object} item - 아이템 데이터
     * @returns {HTMLElement} 툴팁 내용 요소
     */
    function renderMabinogiStyleTooltip(item) {
        const tooltipElement = document.createElement('div');
        
        // 아이템 이름 헤더
        const header = document.createElement('div');
        header.className = 'tooltip-header';
        header.innerHTML = `<h3>${item.item_name || item.item_display_name || '제목 없음'}</h3>`;
        tooltipElement.appendChild(header);
        
        // 툴팁 내용 컨테이너
        const content = document.createElement('div');
        content.className = 'tooltip-content';
        
        // 아이템 속성 블록
        const attributesBlock = document.createElement('div');
        attributesBlock.className = 'tooltip-block';
        attributesBlock.innerHTML = `<div class="tooltip-block-title">아이템 속성</div>`;
        
        // 옵션 필드 표준화
        const options = item.options || item.item_option || [];
        
        // 주요 속성 정보
        const coreAttributes = [
            { type: '공격', format: (opt) => `<div class="tooltip-stat">공격 ${opt.option_value}~${opt.option_value2}</div>` },
            { type: '부상률', format: (opt) => `<div class="tooltip-stat">부상률 ${opt.option_value}~${opt.option_value2}</div>` },
            { type: '크리티컬', format: (opt) => `<div class="tooltip-stat">크리티컬 ${opt.option_value}</div>` },
            { type: '밸런스', format: (opt) => `<div class="tooltip-stat">밸런스 ${opt.option_value}</div>` },
            { type: '내구력', format: (opt) => `<div class="tooltip-stat tooltip-yellow">내구력 ${opt.option_value}/${opt.option_value2}</div>` },
            { type: '숙련', format: (opt) => `<div class="tooltip-stat">숙련 ${opt.option_value}</div>` },
            { type: '남은 전용 해제 가능 횟수', format: (opt) => `<div class="tooltip-stat tooltip-yellow">남은 전용 해제 가능 횟수 : ${opt.option_value}</div>` }
        ];
        
        // 주요 속성 추가
        coreAttributes.forEach(attr => {
            const option = options.find(opt => opt.option_type === attr.type);
            if (option) {
                attributesBlock.innerHTML += attr.format(option);
            }
        });
        
        // 피어싱 레벨
        const piercingOption = options.find(opt => opt.option_type === '피어싱 레벨');
        if (piercingOption) {
            const baseLevel = piercingOption.option_value || "0";
            const bonusLevel = piercingOption.option_value2 ? piercingOption.option_value2 : "";
            attributesBlock.innerHTML += `<div class="tooltip-special-stat">- 피어싱 레벨 ${baseLevel} ${bonusLevel}</div>`;
        }
        
        content.appendChild(attributesBlock);
        
        // 인챈트 블록
        const enchantOptions = options.filter(opt => opt.option_type === '인챈트');
        if (enchantOptions.length > 0) {
            const enchantBlock = document.createElement('div');
            enchantBlock.className = 'tooltip-block';
            enchantBlock.innerHTML = `<div class="tooltip-block-title">인챈트</div>`;
            
            enchantOptions.forEach(enchant => {
                const type = enchant.option_sub_type;
                const value = enchant.option_value;
                const desc = enchant.option_desc;
                
                // 인챈트 이름과 랭크 (정규식으로 분리)
                const match = value.match(/(.+?)\s*(\(랭크 \d+\))/);
                if (match) {
                    const enchantName = match[1];
                    const rankText = match[2];
                    
                    enchantBlock.innerHTML += `
                        <div class="tooltip-stat">[${type}] ${enchantName} <span class="tooltip-pink">${rankText}</span></div>
                    `;
                    
                    // 인챈트 효과 (쉼표로 구분)
                    if (desc) {
                        const effects = desc.split(',');
                        effects.forEach(effect => {
                            enchantBlock.innerHTML += `<div class="tooltip-special-stat">- ${effect.trim()}</div>`;
                        });
                    }
                } else {
                    enchantBlock.innerHTML += `<div class="tooltip-stat">[${type}] ${value}</div>`;
                }
            });
            
            content.appendChild(enchantBlock);
        }
        
        // 개조 블록
        const modOptions = options.filter(opt => 
            opt.option_type === '일반 개조' || 
            opt.option_type === '장인 개조' || 
            opt.option_type === '특별 개조'
        );
        
        if (modOptions.length > 0) {
            const modBlock = document.createElement('div');
            modBlock.className = 'tooltip-block';
            modBlock.innerHTML = `<div class="tooltip-block-title">개조</div>`;
            
            // 일반 개조
            const normalMod = modOptions.find(opt => opt.option_type === '일반 개조');
            if (normalMod) {
                modBlock.innerHTML += `<div class="tooltip-stat">일반 개조 (${normalMod.option_value}/${normalMod.option_value2})</div>`;
            }
            
            // 보석 개조
            const gemMod = options.find(opt => opt.option_type === '보석 개조');
            if (gemMod) {
                modBlock.innerHTML += `<div class="tooltip-stat">, 보석 개조</div>`;
            }
            
            // 장인 개조
            const masterMod = modOptions.find(opt => opt.option_type === '장인 개조');
            if (masterMod) {
                modBlock.innerHTML += `<div class="tooltip-stat">장인개조</div>`;
                
                // 효과 추가 (쉼표로 구분)
                const effects = masterMod.option_value.split(',');
                effects.forEach(effect => {
                    modBlock.innerHTML += `<div class="tooltip-special-stat">- ${effect.trim()}</div>`;
                });
            }
            
            // 특별 개조
            const specialMod = modOptions.find(opt => opt.option_type === '특별 개조');
            if (specialMod) {
                const type = specialMod.option_sub_type; // "R" 또는 "S"
                const level = specialMod.option_value;   // 숫자 값
                
                modBlock.innerHTML += `<div class="tooltip-stat">특별개조 <span class="tooltip-red">${type}</span> (${level}단계)</div>`;
            }
            
            content.appendChild(modBlock);
        }
        
        // 세공 블록
        const reforgeRankOption = options.find(opt => opt.option_type === '세공 랭크');
        const reforgeOptions = options.filter(opt => opt.option_type === '세공 옵션');
        
        if (reforgeRankOption || reforgeOptions.length > 0) {
            const reforgeBlock = document.createElement('div');
            reforgeBlock.className = 'tooltip-block';
            reforgeBlock.innerHTML = `<div class="tooltip-block-title">세공</div>`;
            
            // 세공 랭크
            if (reforgeRankOption) {
                reforgeBlock.innerHTML += `<div class="tooltip-red">${reforgeRankOption.option_value}랭크</div>`;
            }
            
            // 세공 옵션
            reforgeOptions.forEach(opt => {
                // "스매시 대미지(18레벨:180 % 증가)" 형식 파싱
                const match = opt.option_value.match(/(.+?)\((\d+)레벨:(.*?)\)/);
                if (match) {
                    const [_, name, level, effect] = match;
                    reforgeBlock.innerHTML += `
                        <div class="tooltip-special-stat">- ${name} ${level}레벨 <span class="tooltip-stat">└ ${effect}</span></div>
                    `;
                } else {
                    reforgeBlock.innerHTML += `<div class="tooltip-special-stat">- ${opt.option_value}</div>`;
                }
            });
            
            content.appendChild(reforgeBlock);
        }
        
        // 에르그 블록
        const ergOption = options.find(opt => opt.option_type === '에르그');
        if (ergOption) {
            const ergBlock = document.createElement('div');
            ergBlock.className = 'tooltip-block';
            ergBlock.innerHTML = `
                <div class="tooltip-block-title">에르그</div>
                <div class="tooltip-red">등급 ${ergOption.option_sub_type} (${ergOption.option_value}/${ergOption.option_value2}레벨)</div>
            `;
            
            content.appendChild(ergBlock);
        }
        
        // 세트 효과 블록
        const setEffects = options.filter(opt => opt.option_type === '세트 효과');
        if (setEffects.length > 0) {
            const setBlock = document.createElement('div');
            setBlock.className = 'tooltip-block';
            setBlock.innerHTML = `<div class="tooltip-block-title">세트 효과</div>`;
            
            setEffects.forEach(effect => {
                setBlock.innerHTML += `<div class="tooltip-special-stat">- ${effect.option_value} +${effect.option_value2}</div>`;
            });
            
            content.appendChild(setBlock);
        }
        
        // 가격 정보
        if (item.auction_price_per_unit) {
            const priceBlock = document.createElement('div');
            priceBlock.className = 'tooltip-block';
            priceBlock.innerHTML = `
                <div class="tooltip-block-title">가격 정보</div>
                <div class="tooltip-stat">가격: ${Utils.formatNumber(item.auction_price_per_unit)}G</div>
                <div class="tooltip-stat">판매 수량: ${item.auction_count || 1}개</div>
            `;
            
            content.appendChild(priceBlock);
        }
        
        tooltipElement.appendChild(content);
        return tooltipElement;
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
            tr.innerHTML = `<td colspan="3">표시할 결과가 없습니다</td>`;
            elements.resultsBody.appendChild(tr);
            return;
        }
        
        // 아이템 행 생성
        pageItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'item-row';
            tr.setAttribute('data-item-id', item.auction_item_no || '');
            tr.setAttribute('data-item', JSON.stringify(item));
            
            tr.innerHTML = `
                <td>
                    <div class="item-cell">
                        <div class="item-name">${item.item_name || item.item_display_name || '이름 없음'}</div>
                    </div>
                </td>
                <td>${item.auction_count || 1}개</td>
                <td class="item-price">${Utils.formatNumber(item.auction_price_per_unit || 0)}G</td>
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
            elements.resultsBody.innerHTML = '<tr class="empty-result"><td colspan="3">검색어나 카테고리를 선택해 주세요.</td></tr>';
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
