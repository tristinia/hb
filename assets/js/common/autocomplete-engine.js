/**
 * 자동완성 엔진 모듈
 * 검색어 추천 및 자동완성 UI 관리
 */

import Utils from './utils.js';

const AutocompleteEngine = (() => {
    // 기본 상태
    const state = {
        isInitialized: false,
        suggestions: [],
        activeSuggestion: -1,
        isSuggestionVisible: false,
        dataSource: null, // 자동완성 데이터 제공 함수
        context: null, // 현재 컨텍스트
        onSelect: null, // 선택 핸들러
        lastSearchTerm: '', // 마지막 검색어 저장
        showViaDownArrow: false
    };
    
    // DOM 요소 참조
    let elements = {
        searchInput: null,
        suggestionsList: null,
        suggestionsContainer: null
    };

    // 타이머 ID 저장
    let clearSuggestionsTimer = null;
    let preventClickTimer = null;

    /**
     * 모듈 초기화
     * @param {Object} options - 초기화 옵션
     */
    function init(options = {}) {
        // DOM 요소 참조 가져오기
        elements.searchInput = document.getElementById('search-input');
        elements.suggestionsList = document.getElementById('suggestions');
        elements.suggestionsContainer = document.getElementById('suggestions-container');
        
        // 요소 체크
        if (!elements.searchInput || !elements.suggestionsList || !elements.suggestionsContainer) {
            console.error('자동완성에 필요한 DOM 요소를 찾을 수 없습니다.');
            return false;
        }
        
        // 옵션 설정
        if (options.dataSource) state.dataSource = options.dataSource;
        if (options.onSelect) state.onSelect = options.onSelect;
        
        state.context = options.context || 'default';
        
        // 이벤트 리스너 설정
        setupEventListeners();
        
        // 창 크기 변경 및 스크롤 이벤트에 대응하여 위치 업데이트
        if (window.ResizeObserver) {
            const searchContainerObserver = new ResizeObserver(() => {
                if (state.isSuggestionVisible) {
                    updateSuggestionsPosition();
                }
            });
            
            // 검색 컨테이너 관찰 시작
            const searchContainer = document.querySelector('.search-container');
            if (searchContainer) {
                searchContainerObserver.observe(searchContainer);
            }
        }
        
        // 스크롤 및 리사이즈 이벤트에 대해 디바운스 없이 바로 적용
        window.addEventListener('resize', () => {
            if (state.isSuggestionVisible) {
                updateSuggestionsPosition();
            }
        });
        
        // 스크롤 이벤트에 더 즉각적으로 반응
        window.addEventListener('scroll', () => {
            if (state.isSuggestionVisible) {
                updateSuggestionsPosition();
            }
        });
        
        // PC/모바일 전환점 감지 및 즉각 대응
        const mobileMediaQuery = window.matchMedia('(max-width: 768px)');
        mobileMediaQuery.addEventListener('change', () => {
            if (state.isSuggestionVisible) {
                // 전환점에서 약간의 지연 후 위치 업데이트
                setTimeout(updateSuggestionsPosition, 10);
            }
        });
        
        // 검색 컨테이너 및 검색창 위치 변화 감지를 위한 관찰자
        if (window.ResizeObserver) {
            const searchContainer = document.querySelector('.search-container');
            if (searchContainer) {
                const containerObserver = new ResizeObserver(() => {
                    if (state.isSuggestionVisible) {
                        updateSuggestionsPosition();
                    }
                });
                containerObserver.observe(searchContainer);
            }
        }
        
        state.isInitialized = true;
        
        return true;
    }
    
    /**
     * 이벤트 리스너 설정
     */
    function setupEventListeners() {
        // 검색어 변경 이벤트 리스닝
        document.addEventListener('searchTermChanged', handleSearchTermChanged);
        
        // 검색창 클릭 이벤트 - 자동완성 표시
        if (elements.searchInput) {
            elements.searchInput.addEventListener('click', handleSearchInputClick);
            
            // 포커스 이벤트 - 자동완성 표시
            elements.searchInput.addEventListener('focus', handleSearchInputFocus);
            
            // 키보드 이벤트 (화살표, Enter 등)
            elements.searchInput.addEventListener('keydown', handleKeyDown, true);
        }
        
        // 문서 클릭 이벤트 (외부 클릭 시 닫기)
        document.addEventListener('click', handleDocumentClick, true);
        
        // 검색 완료 이벤트 수신
        document.addEventListener('search', handleSearchCompleted);
    }

    /**
     * 자동완성 목록 위치 동적 계산
     */
    function updateSuggestionsPosition() {
        // 자동완성이 표시되지 않은 경우는 무시
        if (!state.isSuggestionVisible) return;
        
        // 검색 입력창 참조 확인
        if (!elements.searchInput) return;
        
        // 검색창 래퍼 요소 (검색창의 실제 컨테이너)
        const searchWrapper = document.querySelector('.search-wrapper');
        if (!searchWrapper) return;
        
        // 검색창의 위치 정보 가져오기
        const searchRect = searchWrapper.getBoundingClientRect();
        
        // 검색창 아래에 위치하도록 설정
        const topPosition = searchRect.bottom + 10;
        
        // 모바일 여부 확인
        const isMobile = window.innerWidth <= 768;
        
        // 위치 업데이트
        elements.suggestionsContainer.style.position = 'fixed';
        elements.suggestionsContainer.style.top = `${topPosition}px`;
        elements.suggestionsContainer.style.width = `${searchRect.width}px`;
        elements.suggestionsContainer.style.left = `${searchRect.left}px`;
        elements.suggestionsContainer.style.transform = 'none';
        elements.suggestionsContainer.style.maxWidth = 'none';
        elements.suggestionsContainer.style.padding = '0'; // 내부 패딩 제거
        
        // 리스트 너비 설정
        elements.suggestionsList.style.position = 'relative';
        elements.suggestionsList.style.left = '0';
        elements.suggestionsList.style.transform = 'none';
        elements.suggestionsList.style.width = '100%';
        elements.suggestionsList.style.maxWidth = '100%';
        elements.suggestionsList.style.margin = '0'; // 마진 제거
        
        // 가시성 클래스 추가
        elements.suggestionsContainer.classList.add('visible');
    }
    
    /**
     * 검색창 클릭 이벤트 처리
     */
    function handleSearchInputClick(e) {
        // 검색어가 있는 경우에만 자동완성 표시
        if (elements.searchInput && elements.searchInput.value.trim()) {
            const term = elements.searchInput.value.trim();
            state.lastSearchTerm = term;
            updateSuggestions(term);
            e.stopPropagation(); // 문서 클릭 이벤트와 충돌 방지
        }
    }
    
    /**
     * 검색창 포커스 이벤트 처리
     */
    function handleSearchInputFocus(e) {
        // 검색어가 있는 경우에만 자동완성 표시
        if (elements.searchInput && elements.searchInput.value.trim()) {
            const term = elements.searchInput.value.trim();
            state.lastSearchTerm = term;
            updateSuggestions(term);
        }
    }
    
    /**
     * 검색 완료 이벤트 처리
     */
    function handleSearchCompleted(e) {
        // 검색 완료 후 자동완성 닫기
        clearSuggestions();
    }
    
    /**
     * 검색어 변경 이벤트 처리
     * @param {CustomEvent} e - 검색어 변경 이벤트
     */
    function handleSearchTermChanged(e) {
        const { term, context } = e.detail;
        
        // 컨텍스트 확인
        if (context !== state.context) return;
        
        // 검색어 저장
        state.lastSearchTerm = term;
        
        if (!term) {
            clearSuggestions();
            return;
        }
        
        // 추천 목록 생성 및 표시
        updateSuggestions(term);
    }
    
    function handleKeyDown(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                
                // 자동완성 목록이 숨겨진 상태에서 아래 방향키를 누른 경우
                if (!state.isSuggestionVisible) {
                    if (elements.searchInput && elements.searchInput.value.trim()) {
                        const term = elements.searchInput.value.trim();
                        state.lastSearchTerm = term;
                        
                        // 리스트 펼치기 및 첫 번째 항목 선택 표시
                        state.showViaDownArrow = true;
                        updateSuggestions(term);
                    }
                } else {
                    // 이미 표시된 상태에서는 다음 항목으로 이동
                    const totalSuggestions = state.suggestions.length;
                    state.activeSuggestion = (state.activeSuggestion < totalSuggestions - 1) 
                        ? state.activeSuggestion + 1 
                        : totalSuggestions - 1;
                    updateActiveSuggestion();
                    scrollSuggestionIntoView();
                }
                break;
                
            case 'ArrowUp':
                // 자동완성 목록이 표시된 경우에만 처리 (펼쳐져 있지 않을 때는 무시)
                if (state.isSuggestionVisible) {
                    e.preventDefault();
                    state.activeSuggestion = (state.activeSuggestion > 0) 
                        ? state.activeSuggestion - 1 
                        : 0;
                    updateActiveSuggestion();
                    scrollSuggestionIntoView();
                }
                break;
                
            case 'Enter':
                if (state.isSuggestionVisible && state.activeSuggestion >= 0 && state.activeSuggestion < state.suggestions.length) {
                    // 매우 중요: 모든 이벤트 전파 차단
                    e.preventDefault();
                    e.stopPropagation();
                    
                    handleSelectSuggestion(state.suggestions[state.activeSuggestion], state.activeSuggestion);
                    return false;
                } else if (state.isSuggestionVisible) {
                    // 선택된 항목이 없는 상태에서 엔터 - 리스트 닫기 (내용만 즉시 제거)
                    emptyAndCloseSuggestions();
                }
                break;
                
            case 'Escape':
                if (state.isSuggestionVisible) {
                    e.preventDefault();
                    emptyAndCloseSuggestions();
                }
                break;
        }
    }
    
    /**
     * 활성화된 자동완성 항목 업데이트
     */
    function updateActiveSuggestion() {
        const items = elements.suggestionsList.querySelectorAll('.suggestion-item');
        
        items.forEach((item, index) => {
            item.classList.toggle('active', index === state.activeSuggestion);
        });
    }
    
    /**
     * 선택된 자동완성 항목이 보이도록 스크롤
     */
    function scrollSuggestionIntoView() {
        if (state.activeSuggestion < 0) return;
        
        const activeItem = elements.suggestionsList.querySelector(`.suggestion-item.active`);
        if (activeItem) {
            // 부드러운 스크롤로 항목을 보이게 함
            activeItem.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }
    
    /**
     * 문서 클릭 이벤트 처리
     * @param {MouseEvent} event - 마우스 이벤트
     */
    function handleDocumentClick(event) {
        // 자동완성 또는 검색창 클릭이 아닌 경우만 닫기
        if (
            elements.searchInput && 
            elements.suggestionsList &&
            !elements.searchInput.contains(event.target) && 
            !elements.suggestionsList.contains(event.target)
        ) {
            clearSuggestions();
        }
    }
    
    /**
     * 추천 목록 업데이트
     * @param {string} term - 검색어
     */
    function updateSuggestions(term) {
        // 데이터 소스 함수가 없으면 종료
        if (typeof state.dataSource !== 'function') return;
        
        // 이전 타이머가 있으면 취소
        if (clearSuggestionsTimer) {
            clearTimeout(clearSuggestionsTimer);
            clearSuggestionsTimer = null;
        }
        
        // 데이터 소스에서 추천 목록 가져오기
        const suggestions = state.dataSource(term, state.context);
        
        if (suggestions && suggestions.length > 0) {
            state.suggestions = suggestions;
            renderSuggestions();
        } else {
            clearSuggestions();
        }
    }
    
    /**
     * 추천 목록 렌더링
     */
    function renderSuggestions() {
        if (!elements.suggestionsList) return;
        
        // 기존 추천 초기화
        elements.suggestionsList.innerHTML = '';
        
        // 추천 목록이 없으면 숨김
        if (state.suggestions.length === 0) {
            elements.suggestionsContainer.classList.remove('visible');
            state.isSuggestionVisible = false;
            return;
        }
        
        // 닫기 애니메이션 클래스 제거
        elements.suggestionsList.classList.remove('hide');
        
        // DocumentFragment 사용하여 DOM 조작 최소화
        const fragment = document.createDocumentFragment();
        
        // 추천 목록 표시
        state.suggestions.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = `suggestion-item ${index === state.activeSuggestion ? 'active' : ''}`;
            
            // 추천 항목 내용 (기본 포맷)
            let content = '';
            
            // 아이템이 객체인 경우 (경매장, 주머니 등)
            if (typeof item === 'object') {
                // 카테고리 정보 구성
                const mainCat = item.mainCategory || '';
                const subCat = item.isCategory ? item.name : (item.subCategory || '');
                const categoryInfo = (mainCat || subCat) ? 
                    `<div class="suggestion-category">${mainCat}${mainCat && subCat ? ' > ' : ''}${subCat}</div>` : '';
                
                // 카테고리 항목인 경우 특별 처리
                if (item.isCategory) {
                    content = `
                        <div class="suggestion-name">
                            카테고리: <span class="item-orange">${item.name}</span>
                        </div>
                        ${categoryInfo}
                    `;
                } else {
                    content = `
                        <div class="suggestion-name">${item.name || item.text || ''}</div>
                        ${categoryInfo}
                    `;
                }
            } else {
                content = `<div class="suggestion-name">${item}</div>`;
            }
            
            li.innerHTML = content;
            
            // 클릭 이벤트
            li.addEventListener('click', () => handleSelectSuggestion(item, index));
            
            fragment.appendChild(li);
        });
        
        // 한 번에 DOM에 추가
        elements.suggestionsList.appendChild(fragment);
        
        // 컨테이너 먼저 표시
        elements.suggestionsContainer.classList.add('visible');
        
        // 상태 업데이트
        state.isSuggestionVisible = true;
    
        // 아래 방향키로 목록 진입
        if (state.showViaDownArrow) {
            state.activeSuggestion = 0;
            state.showViaDownArrow = false;
            updateActiveSuggestion();
        }
        
        // 그 다음 애니메이션과 함께 목록 표시
        setTimeout(() => {
            elements.suggestionsList.classList.add('show');
        }, 10);
        
        if (state.suggestions.length > 10) {
            elements.suggestionsList.classList.add('scrollable');
        } else {
            elements.suggestionsList.classList.remove('scrollable');
        }
        
        // 위치 업데이트
        updateSuggestionsPosition();
    }
    
    /**
     * 추천 항목 선택 처리
     * @param {Object|string} item - 선택한 항목
     * @param {number} index - 선택한 인덱스
     */
    function handleSelectSuggestion(item, index) {
        // 선택된 아이템의 텍스트 가져오기
        const itemText = typeof item === 'object' ? (item.name || item.text || '') : item;
        
        // 검색창에 설정
        if (elements.searchInput) {
            elements.searchInput.value = itemText;
        }
        
        // 자동완성 닫기 (선택 시 내용만 즉시 비우고 애니메이션 시작)
        emptyAndCloseSuggestions();
        
        // 선택 이벤트 발생
        const event = new CustomEvent('autocompleteSelected', {
            detail: {
                item,
                index,
                context: state.context
            }
        });
        document.dispatchEvent(event);
        
        // 커스텀 핸들러 호출
        if (typeof state.onSelect === 'function') {
            state.onSelect(item, index, state.context);
        }
    }
    
    /**
     * 내용을 비우고 자동완성 목록 닫기 (ESC, Enter, 선택 시 사용)
     */
    function emptyAndCloseSuggestions() {
        if (!elements.suggestionsList) return;
        
        // 이미 숨겨진 상태면 중복 처리 방지
        if (!state.isSuggestionVisible) return;
        
        // 이전 타이머가 있으면 취소
        if (clearSuggestionsTimer) {
            clearTimeout(clearSuggestionsTimer);
            clearSuggestionsTimer = null;
        }
        
        // 페이드 아웃 애니메이션 시작
        elements.suggestionsList.classList.add('hide');
        elements.suggestionsList.classList.remove('show');
        
        // 상태 업데이트
        state.isSuggestionVisible = false;
        elements.suggestionsContainer.classList.remove('visible');
        
        // 애니메이션 완료 후 내용 지우기
        clearSuggestionsTimer = setTimeout(() => {
            // 애니메이션이 완료된 후에도 여전히 숨겨진 상태인지 확인
            if (!state.isSuggestionVisible) {
                elements.suggestionsList.innerHTML = '';
                state.suggestions = [];
                state.activeSuggestion = -1;
                elements.suggestionsList.classList.remove('hide');
            }
            
            clearSuggestionsTimer = null;
        }, 300);
    }

    /**
     * 자동완성 목록 비우기
     */
    function clearSuggestions() {
        if (!elements.suggestionsList) return;
        
        // 이미 숨겨진 상태면 중복 처리 방지
        if (!state.isSuggestionVisible) return;
        
        // 페이드 아웃 애니메이션 시작
        elements.suggestionsList.classList.add('hide');
        elements.suggestionsList.classList.remove('show');
        
        // 상태 업데이트
        state.isSuggestionVisible = false;
        elements.suggestionsContainer.classList.remove('visible');
        
        // 이전 타이머가 있으면 취소
        if (clearSuggestionsTimer) {
            clearTimeout(clearSuggestionsTimer);
        }
        
        // 애니메이션 완료 후 내용 지우기
        clearSuggestionsTimer = setTimeout(() => {
            // 애니메이션이 완료된 후에도 여전히 숨겨진 상태인지 확인
            if (!state.isSuggestionVisible) {
                elements.suggestionsList.innerHTML = '';
                state.suggestions = [];
                state.activeSuggestion = -1;
                elements.suggestionsList.classList.remove('hide');
            }
            
            clearSuggestionsTimer = null;
        }, 300);
    }
    
    /**
     * 자동완성 목록 다시 표시
     */
    function showSuggestions() {
        if (state.lastSearchTerm && state.dataSource) {
            updateSuggestions(state.lastSearchTerm);
        }
    }

    /**
     * 데이터 소스 함수 설정
     * @param {Function} dataSourceFn - 검색어와 컨텍스트를 받아 추천 목록을 반환하는 함수
     */
    function setDataSource(dataSourceFn) {
        if (typeof dataSourceFn === 'function') {
            state.dataSource = dataSourceFn;
        }
    }
    
    /**
     * 검색 컨텍스트 설정
     * @param {string} context - 검색 컨텍스트 (auction, pouch 등)
     */
    function setContext(context) {
        state.context = context;
        
        // 컨텍스트 변경 시 자동완성 목록 초기화
        clearSuggestions();
    }
    
    /**
     * 항목 선택 핸들러 설정
     * @param {Function} handlerFn - 선택 시 호출될 함수
     */
    function setSelectHandler(handlerFn) {
        if (typeof handlerFn === 'function') {
            state.onSelect = handlerFn;
        }
    }
    
    /**
     * 자동완성 표시 상태 확인
     * @returns {boolean} 자동완성 표시 상태
     */
    function isSuggestionVisible() {
        // 빈 내용이 아니고 show 클래스가 있는 경우만 표시 상태로 간주
        return state.isSuggestionVisible && 
               elements.suggestionsList && 
               elements.suggestionsList.innerHTML.trim() !== '' && 
               elements.suggestionsList.classList.contains('show');
    }
    
    /**
     * 활성화된 항목 정보 가져오기
     * @returns {Object} 활성화된 항목과 인덱스
     */
    function getActiveItem() {
        if (state.activeSuggestion >= 0 && state.activeSuggestion < state.suggestions.length) {
            return {
                item: state.suggestions[state.activeSuggestion],
                index: state.activeSuggestion
            };
        }
        return null;
    }
    
    // 공개 API
    return {
        init,
        setDataSource,
        setContext,
        setSelectHandler,
        clearSuggestions,
        showSuggestions,
        isSuggestionVisible,
        getActiveItem,
        updateSuggestions
    };
})();

export default AutocompleteEngine;
