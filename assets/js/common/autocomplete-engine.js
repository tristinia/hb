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
        onSelect: null // 선택 핸들러
    };
    
    // DOM 요소 참조
    let elements = {
        searchInput: null,
        suggestionsList: null
    };

    /**
     * 키보드 입력 처리
     * @param {KeyboardEvent} e - 키보드 이벤트
     */
    function handleKeyDown(e) {
        // 자동완성 목록이 표시된 경우에만 처리
        if (!state.isSuggestionVisible) {
            if (e.key === 'Enter') {
                e.preventDefault();
                // 검색 이벤트 발생
                const event = new CustomEvent('search', {
                    detail: {
                        context: state.context
                    }
                });
                document.dispatchEvent(event);
            }
            return;
        }
        
        const totalSuggestions = state.suggestions.length;
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                state.activeSuggestion = (state.activeSuggestion < totalSuggestions - 1) 
                    ? state.activeSuggestion + 1 
                    : totalSuggestions - 1;
                updateActiveSuggestion();
                scrollSuggestionIntoView();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                state.activeSuggestion = (state.activeSuggestion > 0) 
                    ? state.activeSuggestion - 1 
                    : 0;
                updateActiveSuggestion();
                scrollSuggestionIntoView();
                break;
                
            case 'Enter':
                e.preventDefault();
                if (state.activeSuggestion >= 0 && state.activeSuggestion < totalSuggestions) {
                    handleSelectSuggestion(state.suggestions[state.activeSuggestion], state.activeSuggestion);
                } else {
                    // 검색 이벤트 발생
                    const event = new CustomEvent('search', {
                        detail: {
                            context: state.context
                        }
                    });
                    document.dispatchEvent(event);
                }
                break;
                
            case 'Escape':
                clearSuggestions();
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
        // 자동완성 외부 클릭 시 닫기
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
     * 모듈 초기화
     * @param {Object} options - 초기화 옵션
     */
    function init(options = {}) {
        // DOM 요소 참조 가져오기
        elements.searchInput = document.getElementById('search-input');
        elements.suggestionsList = document.getElementById('suggestions');
        
        // 옵션 설정
        if (options.dataSource) state.dataSource = options.dataSource;
        if (options.onSelect) state.onSelect = options.onSelect;
        
        state.context = options.context || 'default';
        
        // 이벤트 리스너 설정
        setupEventListeners();
        
        state.isInitialized = true;
        
        return true;
    }
    
    /**
     * 이벤트 리스너 설정
     */
    function setupEventListeners() {
        // 검색어 변경 이벤트 리스닝
        document.addEventListener('searchTermChanged', handleSearchTermChanged);
        
        // 키보드 이벤트 (화살표, Enter 등)
        if (elements.searchInput) {
            elements.searchInput.addEventListener('keydown', handleKeyDown);
        }
        
        // 문서 클릭 이벤트 (외부 클릭 시 닫기)
        document.addEventListener('click', handleDocumentClick);
    }
    
    /**
     * 검색어 변경 이벤트 처리
     * @param {CustomEvent} e - 검색어 변경 이벤트
     */
    function handleSearchTermChanged(e) {
        const { term, context } = e.detail;
        
        // 컨텍스트 확인
        if (context !== state.context) return;
        
        if (!term) {
            clearSuggestions();
            return;
        }
        
        // 추천 목록 생성 및 표시
        updateSuggestions(term);
    }
    
    /**
     * 추천 목록 업데이트
     * @param {string} term - 검색어
     */
    function updateSuggestions(term) {
        // 데이터 소스 함수가 없으면 종료
        if (typeof state.dataSource !== 'function') return;
        
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
            elements.suggestionsList.classList.remove('show');
            state.isSuggestionVisible = false;
            return;
        }
        
        // DocumentFragment 사용하여 DOM 조작 최소화
        const fragment = document.createDocumentFragment();
        
        // 추천 목록 표시
        state.suggestions.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = `suggestion-item ${index === state.activeSuggestion ? 'active' : ''}`;
            li.setAttribute('data-index', index);
            
            // 추천 항목 내용 (기본 포맷)
            let content = '';
            
            // 아이템이 객체인 경우 (경매장, 주머니 등)
            if (typeof item === 'object') {
                content = `
                    <div class="suggestion-name">${item.name || item.text || ''}</div>
                    ${item.category ? `<div class="suggestion-category">${item.category}</div>` : ''}
                `;
            } else {
                // 아이템이 문자열인 경우 (간단한 추천)
                content = `<div class="suggestion-name">${item}</div>`;
            }
            
            li.innerHTML = content;
            
            // 클릭 이벤트
            li.addEventListener('click', () => handleSelectSuggestion(item, index));
            
            fragment.appendChild(li);
        });
        
        // 한 번에 DOM에 추가
        elements.suggestionsList.appendChild(fragment);
        
        // 목록 표시
        elements.suggestionsList.classList.add('show');
        state.isSuggestionVisible = true;
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
        
        // 자동완성 닫기
        clearSuggestions();
        
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
     * 자동완성 목록 비우기
     */
    function clearSuggestions() {
        if (!elements.suggestionsList) return;
        
        // 페이드 아웃 애니메이션 시작
        elements.suggestionsList.classList.add('hide');
        elements.suggestionsList.classList.remove('show');
        
        // 애니메이션 완료 후 내용 지우기
        setTimeout(() => {
            elements.suggestionsList.innerHTML = '';
            state.suggestions = [];
            state.activeSuggestion = -1;
            state.isSuggestionVisible = false;
            
            elements.suggestionsList.classList.remove('hide');
        }, 300);
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
    
    // 공개 API
    return {
        init,
        setDataSource,
        setContext,
        setSelectHandler,
        clearSuggestions
    };
})();

export default AutocompleteEngine;
