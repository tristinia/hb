/**
 * 기본 검색 기능 제공 모듈
 * 모든 검색 인터페이스의 기반 기능
 */

import Utils from './utils.js';

const SearchCore = (() => {
    // 기본 상태
    const state = {
        searchTerm: '',
        isInitialized: false,
        isSearching: false,
        onSearch: null, // 검색 핸들러 함수
        onReset: null,  // 초기화 핸들러 함수
        context: null   // 현재 검색 컨텍스트 (auction, pouch 등)
    };
    
    // DOM 요소 참조
    let elements = {
        searchInput: null,
        searchButton: null,
        clearButton: null,
        logoButton: null
    };
    
    /**
     * 모듈 초기화
     * @param {Object} options - 초기화 옵션
     */
    function init(options = {}) {
        // DOM 요소 참조 가져오기
        elements.searchInput = document.getElementById('search-input');
        elements.searchButton = document.querySelector('.search-button');
        elements.clearButton = document.getElementById('clear-button');
        elements.logoButton = document.getElementById('logo-button');
        
        // 핸들러 설정
        if (options.onSearch) state.onSearch = options.onSearch;
        if (options.onReset) state.onReset = options.onReset;
        
        // 컨텍스트 설정
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
        if (elements.searchInput) {
            // 검색어 입력 이벤트
            elements.searchInput.addEventListener('input', handleInput);
            
            // 키보드 이벤트 (Enter 등)
            elements.searchInput.addEventListener('keydown', handleKeyDown);
        }
        
        if (elements.searchButton) {
            // 검색 버튼 클릭
            elements.searchButton.addEventListener('click', triggerSearch);
        }
        
        if (elements.clearButton) {
            // 클리어 버튼 클릭
            elements.clearButton.addEventListener('click', clearSearchInput);
        }
        
        if (elements.logoButton) {
            // 로고(초기화) 버튼 클릭
            elements.logoButton.addEventListener('click', resetSearch);
        }
    }
    
    /**
     * 검색어 입력 처리
     */
    function handleInput() {
        if (!elements.searchInput) return;
        
        state.searchTerm = elements.searchInput.value.trim();
        
        // 클리어 버튼 표시/숨김
        if (elements.clearButton) {
            elements.clearButton.classList.toggle('visible', state.searchTerm !== '');
        }
        
        // 검색어 변경 이벤트 발생
        const event = new CustomEvent('searchTermChanged', {
            detail: {
                term: state.searchTerm,
                context: state.context
            }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 키보드 입력 처리
     * @param {KeyboardEvent} e - 키보드 이벤트
     */
    function handleKeyDown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            triggerSearch();
        }
    }
    
    /**
     * 검색 실행
     */
    function triggerSearch() {
        if (state.isSearching) return;
        
        state.isSearching = true;
        
        // 최신 검색어 가져오기
        if (elements.searchInput) {
            state.searchTerm = elements.searchInput.value.trim();
        }
        
        // 검색 이벤트 발생
        const event = new CustomEvent('search', {
            detail: {
                term: state.searchTerm,
                context: state.context
            }
        });
        document.dispatchEvent(event);
        
        // 커스텀 핸들러 호출
        if (typeof state.onSearch === 'function') {
            state.onSearch(state.searchTerm, state.context);
        }
        
        state.isSearching = false;
    }
    
    /**
     * 검색 입력창 비우기
     */
    function clearSearchInput() {
        if (elements.searchInput) {
            elements.searchInput.value = '';
            state.searchTerm = '';
            
            // 클리어 버튼 숨기기
            if (elements.clearButton) {
                elements.clearButton.classList.remove('visible');
            }
            
            // 포커스 유지
            elements.searchInput.focus();
            
            // 검색어 변경 이벤트 발생
            const event = new CustomEvent('searchTermChanged', {
                detail: {
                    term: '',
                    context: state.context
                }
            });
            document.dispatchEvent(event);
        }
    }
    
    /**
     * 검색 초기화
     */
    function resetSearch() {
        clearSearchInput();
        
        // 검색 초기화 이벤트 발생
        const event = new CustomEvent('searchReset', {
            detail: {
                context: state.context
            }
        });
        document.dispatchEvent(event);
        
        // 커스텀 핸들러 호출
        if (typeof state.onReset === 'function') {
            state.onReset();
        }
    }
    
    /**
     * 검색어 설정
     * @param {string} term - 설정할 검색어
     */
    function setSearchTerm(term) {
        if (elements.searchInput) {
            elements.searchInput.value = term;
            state.searchTerm = term;
            
            // 클리어 버튼 표시/숨김
            if (elements.clearButton) {
                elements.clearButton.classList.toggle('visible', term !== '');
            }
        }
    }
    
    /**
     * 검색 컨텍스트 설정
     * @param {string} context - 검색 컨텍스트 (auction, pouch 등)
     */
    function setContext(context) {
        state.context = context;
        
        // 컨텍스트 변경 이벤트 발생
        const event = new CustomEvent('searchContextChanged', {
            detail: {
                context: state.context
            }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 현재 검색 상태 반환
     * @returns {Object} 검색 상태
     */
    function getState() {
        return {
            searchTerm: state.searchTerm,
            context: state.context,
            isSearching: state.isSearching
        };
    }
    
    // 공개 API
    return {
        init,
        triggerSearch,
        resetSearch,
        clearSearchInput,
        setSearchTerm,
        setContext,
        getState
    };
})();

export default SearchCore;
