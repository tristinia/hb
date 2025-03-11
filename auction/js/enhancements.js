/**
 * 경매장 애플리케이션 추가 최적화 및 개선 사항
 * 
 * 아래 코드는 전체 애플리케이션의 성능과 사용자 경험을 
 * 더욱 향상시키기 위한 추가 최적화 요소들입니다.
 */

/**
 * 1. 아이템 렌더링 최적화 - 가상 스크롤링 구현
 * 대량의 아이템을 표시할 때 화면에 보이는 부분만 렌더링하여 성능 향상
 */
const VirtualScroller = (() => {
    let state = {
        container: null,
        items: [],
        itemHeight: 60, // 아이템 행 높이 (px)
        visibleItems: 0, // 한 번에 표시할 아이템 수
        totalHeight: 0,  // 전체 컨텐츠 높이
        scrollTop: 0,    // 현재 스크롤 위치
        renderBuffer: 5, // 위/아래 추가 렌더링할 아이템 수
        isActive: false  // 가상 스크롤링 활성화 여부
    };
    
    /**
     * 가상 스크롤러 초기화
     * @param {HTMLElement} container - 아이템 컨테이너 요소
     * @param {number} itemHeight - 각 아이템의 높이 (px)
     */
    function init(container, itemHeight = 60) {
        state.container = container;
        state.itemHeight = itemHeight;
        
        // 컨테이너 크기로 표시 가능한 아이템 수 계산
        calculateVisibleItems();
        
        // 리사이즈 이벤트 리스너
        window.addEventListener('resize', debounce(() => {
            calculateVisibleItems();
            renderVisibleItems();
        }, 200));
        
        // 스크롤 이벤트 리스너
        container.addEventListener('scroll', throttle(() => {
            state.scrollTop = container.scrollTop;
            renderVisibleItems();
        }, 16)); // 약 60fps
    }
    
    /**
     * 표시 가능 아이템 수 계산
     */
    function calculateVisibleItems() {
        if (!state.container) return;
        
        const containerHeight = state.container.clientHeight;
        state.visibleItems = Math.ceil(containerHeight / state.itemHeight) + (2 * state.renderBuffer);
    }
    
    /**
     * 아이템 설정 및 가상 스크롤링 시작
     * @param {Array} items - 표시할 전체 아이템 배열
     */
    function setItems(items) {
        state.items = items || [];
        state.totalHeight = state.items.length * state.itemHeight;
        
        // 아이템이 적으면 가상 스크롤링 비활성화
        state.isActive = state.items.length > 50;
        
        if (state.isActive) {
            setupVirtualScroll();
        } else {
            // 일반 렌더링 사용
            renderAllItems();
        }
    }
    
    /**
     * 가상 스크롤링 설정
     */
    function setupVirtualScroll() {
        if (!state.container) return;
        
        // 실제 아이템이 들어갈 컨테이너
        const innerContainer = document.createElement('div');
        innerContainer.className = 'virtual-scroll-content';
        innerContainer.style.position = 'relative';
        innerContainer.style.height = `${state.totalHeight}px`;
        
        // 기존 내용 비우고 새 컨테이너 추가
        state.container.innerHTML = '';
        state.container.appendChild(innerContainer);
        
        // 초기 아이템 렌더링
        renderVisibleItems();
    }
    
    /**
     * 보이는 아이템만 렌더링
     */
    function renderVisibleItems() {
        if (!state.isActive || !state.container) return;
        
        const innerContainer = state.container.querySelector('.virtual-scroll-content');
        if (!innerContainer) return;
        
        // 현재 스크롤 위치에 따른 표시 범위 계산
        const startIndex = Math.max(0, Math.floor(state.scrollTop / state.itemHeight) - state.renderBuffer);
        const endIndex = Math.min(
            state.items.length, 
            startIndex + state.visibleItems + state.renderBuffer
        );
        
        // 현재 표시된 아이템에 데이터 속성 추가
        innerContainer.querySelectorAll('.item-row').forEach(item => {
            item.dataset.virtual = 'true';
        });
        
        // 새 아이템 생성 및 배치
        for (let i = startIndex; i < endIndex; i++) {
            const item = state.items[i];
            if (!item) continue;
            
            // 이미 해당 인덱스의 아이템이 있는지 확인
            let itemElement = innerContainer.querySelector(`.item-row[data-index="${i}"]`);
            
            if (!itemElement) {
                // 새 아이템 생성
                itemElement = createItemElement(item, i);
                itemElement.style.position = 'absolute';
                itemElement.style.top = `${i * state.itemHeight}px`;
                itemElement.style.width = '100%';
                itemElement.style.height = `${state.itemHeight}px`;
                
                innerContainer.appendChild(itemElement);
            } else {
                // 이미 있는 아이템 재사용
                itemElement.dataset.virtual = 'false';
            }
        }
        
        // 화면에서 벗어난 아이템 제거 (메모리 최적화)
        innerContainer.querySelectorAll('.item-row[data-virtual="true"]').forEach(item => {
            innerContainer.removeChild(item);
        });
    }
    
    /**
     * 모든 아이템 일반 방식으로 렌더링 (가상 스크롤링 비활성화 시)
     */
    function renderAllItems() {
        if (!state.container) return;
        
        // 컨테이너 초기화
        state.container.innerHTML = '';
        
        // 일반 테이블 방식으로 모든 아이템 추가
        const fragment = document.createDocumentFragment();
        
        state.items.forEach((item, index) => {
            const itemElement = createItemElement(item, index);
            fragment.appendChild(itemElement);
        });
        
        state.container.appendChild(fragment);
    }
    
    /**
     * 아이템 요소 생성 (테이블 행)
     * @param {Object} item - 아이템 데이터
     * @param {number} index - 아이템 인덱스
     * @returns {HTMLElement} 생성된 아이템 요소
     */
    function createItemElement(item, index) {
        const tr = document.createElement('tr');
        tr.className = 'item-row';
        tr.setAttribute('data-item-id', item.auction_item_no);
        tr.setAttribute('data-index', index);
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
        
        return tr;
    }
    
    // 유틸리티 함수: 디바운스
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }
    
    // 유틸리티 함수: 스로틀
    function throttle(func, limit) {
        let lastCall = 0;
        return function() {
            const now = Date.now();
            if (now - lastCall < limit) return;
            lastCall = now;
            func.apply(this, arguments);
        };
    }
    
    // 공개 API
    return {
        init,
        setItems
    };
})();

/**
 * 2. IndexedDB 캐싱 구현
 * 로컬 스토리지의 한계(5MB)를 넘는 데이터를 효율적으로 저장
 */
const DataCache = (() => {
    const DB_NAME = 'auctionDataCache';
    const DB_VERSION = 1;
    const STORES = {
        ITEMS: 'items',
        CATEGORIES: 'categories',
        OPTIONS: 'options',
        METADATA: 'metadata'
    };
    
    let db = null;
    
    /**
     * 데이터베이스 초기화
     * @returns {Promise} 초기화 완료 프로미스
     */
    function init() {
        return new Promise((resolve, reject) => {
            if (db) {
                resolve(db);
                return;
            }
            
            // IndexedDB 지원 확인
            if (!window.indexedDB) {
                console.warn('이 브라우저는 IndexedDB를 지원하지 않습니다. 캐싱이 제한됩니다.');
                reject('IndexedDB 미지원');
                return;
            }
            
            // 데이터베이스 열기
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            // 데이터베이스 스키마 업그레이드
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 아이템 저장소 생성
                if (!db.objectStoreNames.contains(STORES.ITEMS)) {
                    const itemStore = db.createObjectStore(STORES.ITEMS, { keyPath: 'category' });
                    itemStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                }
                
                // 카테고리 저장소 생성
                if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
                    db.createObjectStore(STORES.CATEGORIES, { keyPath: 'type' });
                }
                
                // 옵션 구조 저장소 생성
                if (!db.objectStoreNames.contains(STORES.OPTIONS)) {
                    db.createObjectStore(STORES.OPTIONS, { keyPath: 'category' });
                }
                
                // 메타데이터 저장소 생성
                if (!db.objectStoreNames.contains(STORES.METADATA)) {
                    db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
                }
                
                console.log('IndexedDB 스키마 업그레이드 완료');
            };
            
            // 성공 처리
            request.onsuccess = (event) => {
                db = event.target.result;
                console.log('IndexedDB 연결 성공');
                resolve(db);
            };
            
            // 오류 처리
            request.onerror = (event) => {
                console.error('IndexedDB 열기 실패:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    /**
     * 데이터 저장
     * @param {string} storeName - 저장소 이름
     * @param {Object} data - 저장할 데이터
     * @returns {Promise} 저장 완료 프로미스
     */
    function saveData(storeName, data) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject('데이터베이스가 초기화되지 않았습니다.');
                return;
            }
            
            try {
                const transaction = db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                
                // 데이터에 타임스탬프 추가
                if (Array.isArray(data)) {
                    data.forEach(item => {
                        item.lastUpdated = Date.now();
                        const request = store.put(item);
                    });
                } else {
                    data.lastUpdated = Date.now();
                    const request = store.put(data);
                }
                
                // 트랜잭션 완료 처리
                transaction.oncomplete = () => {
                    resolve(true);
                };
                
                // 트랜잭션 오류 처리
                transaction.onerror = (event) => {
                    reject(event.target.error);
                };
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * 데이터 조회
     * @param {string} storeName - 저장소 이름
     * @param {string|number} key - 조회할 키
     * @returns {Promise} 조회 결과 프로미스
     */
    function getData(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject('데이터베이스가 초기화되지 않았습니다.');
                return;
            }
            
            try {
                const transaction = db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(key);
                
                request.onsuccess = (event) => {
                    resolve(event.target.result);
                };
                
                request.onerror = (event) => {
                    reject(event.target.error);
                };
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * 모든 데이터 조회
     * @param {string} storeName - 저장소 이름
     * @returns {Promise} 모든 데이터 배열 프로미스
     */
    function getAllData(storeName) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject('데이터베이스가 초기화되지 않았습니다.');
                return;
            }
            
            try {
                const transaction = db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();
                
                request.onsuccess = (event) => {
                    resolve(event.target.result);
                };
                
                request.onerror = (event) => {
                    reject(event.target.error);
                };
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * 데이터 삭제
     * @param {string} storeName - 저장소 이름
     * @param {string|number} key - 삭제할 키
     * @returns {Promise} 삭제 완료 프로미스
     */
    function deleteData(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject('데이터베이스가 초기화되지 않았습니다.');
                return;
            }
            
            try {
                const transaction = db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(key);
                
                request.onsuccess = () => {
                    resolve(true);
                };
                
                request.onerror = (event) => {
                    reject(event.target.error);
                };
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * 모든 데이터 삭제 (저장소 초기화)
     * @param {string} storeName - 저장소 이름
     * @returns {Promise} 삭제 완료 프로미스
     */
    function clearStore(storeName) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject('데이터베이스가 초기화되지 않았습니다.');
                return;
            }
            
            try {
                const transaction = db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();
                
                request.onsuccess = () => {
                    resolve(true);
                };
                
                request.onerror = (event) => {
                    reject(event.target.error);
                };
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * 캐시 유효성 확인
     * @param {string} key - 검사할 키
     * @param {number} maxAgeMs - 최대 유효 기간 (밀리초)
     * @returns {Promise<boolean>} 유효성 여부
     */
    async function isValid(storeName, key, maxAgeMs = 24 * 60 * 60 * 1000) {
        try {
            const data = await getData(storeName, key);
            if (!data || !data.lastUpdated) return false;
            
            const age = Date.now() - data.lastUpdated;
            return age < maxAgeMs;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * 데이터베이스 닫기
     */
    function close() {
        if (db) {
            db.close();
            db = null;
            console.log('IndexedDB 연결 닫힘');
        }
    }
    
    // 공개 API
    return {
        init,
        saveData,
        getData,
        getAllData,
        deleteData,
        clearStore,
        isValid,
        close,
        STORES
    };
})();

/**
 * 3. 웹 워커 통합 - 무거운 데이터 처리를 별도 스레드로 분리
 * 메인 스레드 블로킹 방지로 UI 반응성 향상
 */
const WorkerManager = (() => {
    let worker = null;
    const callbacks = new Map();
    let callbackId = 0;
    
    /**
     * 워커 초기화
     */
    function init() {
        try {
            // 이미 존재하는 워커 종료
            if (worker) {
                worker.terminate();
            }
            
            // 워커 스크립트 생성 (인라인으로 생성)
            const workerScript = `
                // 웹 워커 내부 코드
                self.onmessage = function(e) {
                    const { id, action, data } = e.data;
                    
                    try {
                        let result;
                        
                        switch (action) {
                            case 'filter':
                                result = filterItems(data.items, data.filters);
                                break;
                            case 'sort':
                                result = sortItems(data.items, data.sortField, data.sortOrder);
                                break;
                            case 'processCategories':
                                result = processCategories(data.categories);
                                break;
                            case 'search':
                                result = searchItems(data.items, data.query, data.fields);
                                break;
                            default:
                                throw new Error(\`알 수 없는 작업: \${action}\`);
                        }
                        
                        self.postMessage({ id, result, error: null });
                    } catch (error) {
                        self.postMessage({ id, result: null, error: error.message });
                    }
                };
                
                // 아이템 필터링
                function filterItems(items, filters) {
                    if (!filters || Object.keys(filters).length === 0) {
                        return items;
                    }
                    
                    return items.filter(item => {
                        // 아이템 옵션이 없는 경우
                        if (!item.item_option || !Array.isArray(item.item_option)) {
                            return false;
                        }
                        
                        // 각 필터 적용
                        for (const [filterKey, filterValue] of Object.entries(filters)) {
                            if (filterKey.startsWith('min_')) {
                                const optionName = filterKey.replace('min_', '');
                                const optionValue = getItemOptionValue(item, optionName);
                                
                                if (optionValue === null || parseFloat(optionValue) < parseFloat(filterValue)) {
                                    return false;
                                }
                            }
                            else if (filterKey.startsWith('max_')) {
                                const optionName = filterKey.replace('max_', '');
                                const optionValue = getItemOptionValue(item, optionName);
                                
                                if (optionValue === null || parseFloat(optionValue) > parseFloat(filterValue)) {
                                    return false;
                                }
                            }
                            else {
                                const optionValue = getItemOptionValue(item, filterKey);
                                if (optionValue === null || !optionValue.includes(filterValue)) {
                                    return false;
                                }
                            }
                        }
                        
                        return true;
                    });
                }
                
                // 아이템 옵션 값 가져오기
                function getItemOptionValue(item, optionName) {
                    if (!item.item_option || !Array.isArray(item.item_option)) {
                        return null;
                    }
                    
                    const option = item.item_option.find(opt => opt.option_type === optionName);
                    return option ? option.option_value : null;
                }
                
                // 아이템 정렬
                function sortItems(items, sortField, sortOrder) {
                    return [...items].sort((a, b) => {
                        let valueA, valueB;
                        
                        // 정렬 필드에 따라 값 추출
                        if (sortField === 'price') {
                            valueA = a.auction_price_per_unit || 0;
                            valueB = b.auction_price_per_unit || 0;
                        } else if (sortField === 'name') {
                            valueA = a.item_name || '';
                            valueB = b.item_name || '';
                        } else if (sortField === 'count') {
                            valueA = a.auction_count || 0;
                            valueB = b.auction_count || 0;
                        } else {
                            valueA = a[sortField];
                            valueB = b[sortField];
                        }
                        
                        // 문자열 비교
                        if (typeof valueA === 'string' && typeof valueB === 'string') {
                            return sortOrder === 'asc' 
                                ? valueA.localeCompare(valueB, 'ko') 
                                : valueB.localeCompare(valueA, 'ko');
                        }
                        
                        // 숫자 비교
                        return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
                    });
                }
                
                // 카테고리 처리
                function processCategories(categories) {
                    // 카테고리별 아이템 맵 생성
                    const categoryMap = new Map();
                    
                    categories.forEach(category => {
                        categoryMap.set(category.id, {
                            ...category,
                            itemCount: 0
                        });
                    });
                    
                    return Array.from(categoryMap.values());
                }
                
                // 아이템 검색
                function searchItems(items, query, fields) {
                    if (!query || query.trim() === '') {
                        return items;
                    }
                    
                    const normalizedQuery = query.toLowerCase();
                    const searchFields = fields || ['item_name'];
                    
                    return items.filter(item => {
                        return searchFields.some(field => {
                            const value = item[field];
                            if (!value) return false;
                            
                            return value.toString().toLowerCase().includes(normalizedQuery);
                        });
                    });
                }
            `;
            
            // Blob으로 워커 스크립트 생성
            const blob = new Blob([workerScript], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            
            // 워커 생성
            worker = new Worker(workerUrl);
            
            // 메시지 핸들러 설정
            worker.onmessage = handleWorkerMessage;
            worker.onerror = handleWorkerError;
            
            console.log('웹 워커 초기화 완료');
            
            // URL 정리 (메모리 누수 방지)
            URL.revokeObjectURL(workerUrl);
            
            return true;
        } catch (error) {
            console.error('웹 워커 초기화 실패:', error);
            worker = null;
            return false;
        }
    }
    
    /**
     * 작업 요청 처리
     * @param {string} action - 작업 타입
     * @param {Object} data - 작업 데이터
     * @returns {Promise} 작업 결과 프로미스
     */
    function sendTask(action, data) {
        return new Promise((resolve, reject) => {
            if (!worker) {
                if (!init()) {
                    reject(new Error('웹 워커를 사용할 수 없습니다.'));
                    return;
                }
            }
            
            const id = callbackId++;
            
            // 콜백 등록
            callbacks.set(id, { resolve, reject });
            
            // 작업 전송
            worker.postMessage({ id, action, data });
        });
    }
    
    /**
     * 워커 메시지 처리
     * @param {MessageEvent} event - 워커 메시지 이벤트
     */
    function handleWorkerMessage(event) {
        const { id, result, error } = event.data;
        
        // 해당 작업의 콜백 찾기
        const callback = callbacks.get(id);
        if (!callback) return;
        
        // 콜백 실행 및 제거
        if (error) {
            callback.reject(new Error(error));
        } else {
            callback.resolve(result);
        }
        
        callbacks.delete(id);
    }
    
    /**
     * 워커 오류 처리
     * @param {ErrorEvent} error - 워커 오류 이벤트
     */
    function handleWorkerError(error) {
        console.error('웹 워커 오류:', error);
        
        // 모든 대기 중인 작업에 오류 전달
        callbacks.forEach(callback => {
            callback.reject(new Error('웹 워커 오류: ' + error.message));
        });
        
        // 콜백 맵 초기화
        callbacks.clear();
        
        // 워커 재생성
        worker.terminate();
        worker = null;
        init();
    }
    
    /**
     * 워커 종료
     */
    function terminate() {
        if (worker) {
            worker.terminate();
            worker = null;
            callbacks.clear();
            console.log('웹 워커 종료됨');
        }
    }
    
    /**
     * 아이템 필터링 요청
     * @param {Array} items - 필터링할 아이템 배열
     * @param {Object} filters - 필터 조건
     * @returns {Promise<Array>} 필터링된 아이템 배열
     */
    function filterItems(items, filters) {
        return sendTask('filter', { items, filters });
    }
    
    /**
     * 아이템 정렬 요청
     * @param {Array} items - 정렬할 아이템 배열
     * @param {string} sortField - 정렬 필드
     * @param {string} sortOrder - 정렬 순서 ('asc'/'desc')
     * @returns {Promise<Array>} 정렬된 아이템 배열
     */
    function sortItems(items, sortField, sortOrder) {
        return sendTask('sort', { items, sortField, sortOrder });
    }
    
    /**
     * 아이템 검색 요청
     * @param {Array} items - 검색할 아이템 배열
     * @param {string} query - 검색어
     * @param {Array} fields - 검색 필드 목록
     * @returns {Promise<Array>} 검색 결과 아이템 배열
     */
    function searchItems(items, query, fields) {
        return sendTask('search', { items, query, fields });
    }
    
    // 워커 지원 확인
    const isSupported = typeof Worker !== 'undefined';
    
    // 공개 API
    return {
        init,
        filterItems,
        sortItems,
        searchItems,
        terminate,
        isSupported
    };
})();

/**
 * 4. 데이터 공유 및 URL 공유 기능
 * URL 파라미터로 검색/필터 상태 저장하여 공유 가능한 링크 생성
 */
const StateManager = (() => {
    /**
     * 현재 상태를 URL로 인코딩
     * @param {Object} state - 현재 상태 객체
     * @returns {string} 인코딩된 URL
     */
    function encodeStateToUrl(state) {
        // 상태 객체에서 필요한 정보만 추출
        const shareableState = {
            s: state.searchTerm || '',                     // 검색어
            c: state.selectedCategory || '',               // 선택한 카테고리 ID
            mc: state.selectedMainCategory || '',          // 선택한 메인 카테고리 ID
            p: state.currentPage || 1,                     // 현재 페이지
            ps: state.pageSize || 20,                      // 페이지 크기
            f: compressFilters(state.filters || {}),       // 압축된 필터 정보
            sort: state.sortField || '',                   // 정렬 필드
            dir: state.sortDirection || 'asc'              // 정렬 방향
        };
        
        // 빈 값 제거
        Object.keys(shareableState).forEach(key => {
            if (
                shareableState[key] === '' || 
                shareableState[key] === null || 
                shareableState[key] === undefined ||
                (typeof shareableState[key] === 'object' && Object.keys(shareableState[key]).length === 0)
            ) {
                delete shareableState[key];
            }
        });
        
        // URL 쿼리 스트링으로 변환
        const queryString = new URLSearchParams(shareableState).toString();
        
        // 현재 URL 가져오기 (경로만)
        const currentUrl = window.location.pathname;
        
        // 새 URL 반환
        return `${currentUrl}?${queryString}`;
    }
    
    /**
     * URL에서 상태 디코딩
     * @param {string} url - 디코딩할 URL
     * @returns {Object} 디코딩된 상태 객체
     */
    function decodeStateFromUrl(url) {
        const urlObj = new URL(url || window.location.href);
        const params = new URLSearchParams(urlObj.search);
        
        // 상태 객체 구성
        const state = {
            searchTerm: params.get('s') || '',
            selectedCategory: params.get('c') || '',
            selectedMainCategory: params.get('mc') || '',
            currentPage: parseInt(params.get('p')) || 1,
            pageSize: parseInt(params.get('ps')) || 20,
            filters: decompressFilters(params.get('f') || ''),
            sortField: params.get('sort') || '',
            sortDirection: params.get('dir') || 'asc'
        };
        
        return state;
    }
    
    /**
     * 필터 객체 압축
     * @param {Object} filters - 압축할 필터 객체
     * @returns {string} 압축된 필터 문자열
     */
    function compressFilters(filters) {
        if (Object.keys(filters).length === 0) {
            return '';
        }
        
        // 간단한 형태로 직렬화
        const serialized = JSON.stringify(filters);
        
        // Base64 인코딩 (URL 안전 버전)
        return btoa(serialized).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    
    /**
     * 압축된 필터 문자열 복원
     * @param {string} compressed - 압축된 필터 문자열
     * @returns {Object} 복원된 필터 객체
     */
    function decompressFilters(compressed) {
        if (!compressed) {
            return {};
        }
        
        try {
            // Base64 디코딩 (URL 안전 버전 되돌리기)
            const base64 = compressed.replace(/-/g, '+').replace(/_/g, '/');
            
            // 필요 시 패딩 추가
            const padding = '='.repeat((4 - (base64.length % 4)) % 4);
            const padded = base64 + padding;
            
            // 디코딩 및 파싱
            const serialized = atob(padded);
            return JSON.parse(serialized);
        } catch (error) {
            console.error('필터 압축 해제 오류:', error);
            return {};
        }
    }
    
    /**
     * 공유 가능한 URL 생성
     * @returns {string} 공유 URL
     */
    function createShareableUrl() {
        // 현재 애플리케이션 상태 수집
        const appState = {
            searchTerm: SearchManager.getSearchState().searchTerm,
            selectedCategory: CategoryManager.getSelectedCategories().subCategory,
            selectedMainCategory: CategoryManager.getSelectedCategories().mainCategory,
            currentPage: PaginationManager.getState().currentPage,
            pageSize: PaginationManager.getState().itemsPerPage,
            filters: FilterManager.getFilters().advancedFilters
        };
        
        return encodeStateToUrl(appState);
    }
    
    /**
     * URL에서 상태 복원
     * @returns {Object} 복원된 상태
     */
    function restoreFromUrl() {
        return decodeStateFromUrl();
    }
    
    /**
     * 공유 URL 클립보드에 복사
     */
    function copyShareableUrl() {
        const url = createShareableUrl();
        
        try {
            // 새로운 방식 (Clipboard API)
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url)
                    .then(() => {
                        alert('URL이 클립보드에 복사되었습니다.');
                    })
                    .catch(err => {
                        fallbackCopy(url);
                    });
            } else {
                fallbackCopy(url);
            }
        } catch (error) {
            fallbackCopy(url);
        }
    }
    
    /**
     * 대체 복사 메서드 (Clipboard API 미지원 시)
     * @param {string} text - 복사할 텍스트
     */
    function fallbackCopy(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // 화면 밖에 위치시키지만 문서 내에 유지
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                alert('URL이 클립보드에 복사되었습니다.');
            } else {
                alert('URL 복사 실패. 수동으로 URL을 복사하세요: ' + text);
            }
        } catch (err) {
            alert('URL 복사 실패. 수동으로 URL을 복사하세요: ' + text);
        }
        
        document.body.removeChild(textArea);
    }
    
    // 공개 API
    return {
        createShareableUrl,
        restoreFromUrl,
        copyShareableUrl
    };
})();

/**
 * 5. 다크 모드 지원
 * 시스템 설정 및 사용자 선호에 따른 테마 전환
 */
const ThemeManager = (() => {
    const THEMES = {
        LIGHT: 'light',
        DARK: 'dark',
        AUTO: 'auto'
    };
    
    const STORAGE_KEY = 'theme-preference';
    
    let currentTheme = THEMES.AUTO;
    let systemPrefersDark = false;
    
    /**
     * 테마 초기화
     */
    function init() {
        // 저장된 사용자 선호 테마 불러오기
        const savedTheme = localStorage.getItem(STORAGE_KEY);
        if (savedTheme && Object.values(THEMES).includes(savedTheme)) {
            currentTheme = savedTheme;
        }
        
        // 시스템 테마 감지
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        systemPrefersDark = mediaQuery.matches;
        
        // 시스템 테마 변경 감지
        mediaQuery.addEventListener('change', event => {
            systemPrefersDark = event.matches;
            if (currentTheme === THEMES.AUTO) {
                applyTheme();
            }
        });
        
        // 초기 테마 적용
        applyTheme();
        
        // 테마 전환 버튼 추가
        addThemeToggleButton();
        
        console.log(`테마 관리자 초기화: ${currentTheme} (시스템: ${systemPrefersDark ? 'dark' : 'light'})`);
    }
    
    /**
     * 테마 설정 적용
     */
    function applyTheme() {
        // 실제 적용할 테마 결정
        const effectiveTheme = currentTheme === THEMES.AUTO
            ? (systemPrefersDark ? THEMES.DARK : THEMES.LIGHT)
            : currentTheme;
        
        // 문서 루트에 테마 속성 설정
        document.documentElement.setAttribute('data-theme', effectiveTheme);
        
        // HTML 클래스 업데이트
        document.documentElement.classList.remove(THEMES.LIGHT, THEMES.DARK);
        document.documentElement.classList.add(effectiveTheme);
        
        // 메타 테마 색상 업데이트 (모바일 브라우저용)
        updateMetaThemeColor(effectiveTheme);
        
        // 테마 전환 버튼 업데이트
        updateThemeToggleButton(effectiveTheme);
    }
    
    /**
     * 메타 테마 색상 업데이트
     * @param {string} theme - 적용할 테마
     */
    function updateMetaThemeColor(theme) {
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        
        // 메타 태그가 없으면 새로 생성
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }
        
        // 테마에 맞는 색상 설정
        const color = theme === THEMES.DARK ? '#121212' : '#ffffff';
        metaThemeColor.content = color;
    }
    
    /**
     * 테마 변경
     * @param {string} theme - 적용할 테마
     */
    function setTheme(theme) {
        if (!Object.values(THEMES).includes(theme)) {
            console.error(`잘못된 테마: ${theme}`);
            return;
        }
        
        currentTheme = theme;
        
        // 테마 저장
        localStorage.setItem(STORAGE_KEY, theme);
        
        // 테마 적용
        applyTheme();
    }
    
    /**
     * 테마 간 순환
     */
    function cycleTheme() {
        const themeOrder = [THEMES.LIGHT, THEMES.DARK, THEMES.AUTO];
        const currentIndex = themeOrder.indexOf(currentTheme);
        const nextIndex = (currentIndex + 1) % themeOrder.length;
        setTheme(themeOrder[nextIndex]);
    }
    
    /**
     * 테마 전환 버튼 추가
     */
    function addThemeToggleButton() {
        // 이미 있는지 확인
        if (document.getElementById('theme-toggle')) {
            return;
        }
        
        // 버튼 컨테이너 생성
        const container = document.createElement('div');
        container.className = 'theme-toggle-container';
        
        // 버튼 생성
        const button = document.createElement('button');
        button.id = 'theme-toggle';
        button.className = 'theme-toggle-button';
        button.setAttribute('aria-label', '테마 변경');
        button.innerHTML = `
            <svg class="theme-icon theme-icon-light" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg class="theme-icon theme-icon-dark" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
            <svg class="theme-icon theme-icon-auto" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"></path>
            </svg>
        `;
        
        // 클릭 이벤트
        button.addEventListener('click', cycleTheme);
        
        // DOM에 추가
        container.appendChild(button);
        document.body.appendChild(container);
    }
    
    /**
     * 테마 전환 버튼 업데이트
     * @param {string} activeTheme - 활성화된 테마
     */
    function updateThemeToggleButton(activeTheme) {
        const button = document.getElementById('theme-toggle');
        if (!button) return;
        
        // 모든 아이콘 숨기기
        button.querySelectorAll('.theme-icon').forEach(icon => {
            icon.style.display = 'none';
        });
        
        // 현재 테마에 맞는 아이콘 표시
        const activeIcon = button.querySelector(`.theme-icon-${currentTheme}`);
        if (activeIcon) {
            activeIcon.style.display = 'block';
        }
        
        // 버튼 제목 업데이트
        let title = '테마 변경';
        if (currentTheme === THEMES.LIGHT) {
            title = '라이트 모드 (클릭하여 변경)';
        } else if (currentTheme === THEMES.DARK) {
            title = '다크 모드 (클릭하여 변경)';
        } else if (currentTheme === THEMES.AUTO) {
            title = '시스템 테마 (클릭하여 변경)';
        }
        
        button.setAttribute('title', title);
    }
    
    // 공개 API
    return {
        init,
        setTheme,
        cycleTheme,
        THEMES
    };
})();

/**
 * 6. 성능 모니터링
 * 애플리케이션 성능 측정 및 디버깅 도구
 */
const PerformanceMonitor = (() => {
    let isActive = false;
    let metrics = {};
    let markers = {};
    
    /**
     * 성능 모니터링 시작
     */
    function start() {
        if (isActive) return;
        
        isActive = true;
        metrics = {};
        markers = {};
        
        console.log('성능 모니터링 시작');
        
        // 초기 마커 설정
        mark('app-start');
    }
    
    /**
     * 성능 모니터링 종료
     * @returns {Object} 수집된 성능 메트릭
     */
    function end() {
        if (!isActive) return metrics;
        
        isActive = false;
        mark('app-end');
        
        // 총 실행 시간 계산
        measure('total-execution', 'app-start', 'app-end');
        
        console.log('성능 모니터링 종료');
        
        // 결과 복사본 반환
        return { ...metrics };
    }
    
    /**
     * 마커 추가
     * @param {string} name - 마커 이름
     */
    function mark(name) {
        if (!isActive) return;
        
        markers[name] = performance.now();
    }
    
    /**
     * 시간 측정
     * @param {string} name - 측정 이름
     * @param {string} startMark - 시작 마커
     * @param {string} endMark - 종료 마커
     */
    function measure(name, startMark, endMark) {
        if (!isActive) return;
        
        if (!markers[startMark] || !markers[endMark]) {
            console.warn(`마커 누락: ${startMark} 또는 ${endMark}`);
            return;
        }
        
        const duration = markers[endMark] - markers[startMark];
        metrics[name] = duration.toFixed(2);
    }
    
    /**
     * 성능 메트릭 기록
     * @param {string} name - 메트릭 이름
     * @param {number} value - 메트릭 값
     */
    function logMetric(name, value) {
        if (!isActive) return;
        
        metrics[name] = typeof value === 'number' ? value.toFixed(2) : value;
    }
    
    /**
     * 함수 성능 측정 래퍼
     * @param {Function} fn - 측정할 함수
     * @param {string} name - 메트릭 이름
     * @returns {Function} 래핑된 함수
     */
    function measureFunction(fn, name) {
        return function(...args) {
            if (!isActive) return fn.apply(this, args);
            
            const startTime = performance.now();
            const result = fn.apply(this, args);
            const endTime = performance.now();
            
            logMetric(name, endTime - startTime);
            
            return result;
        };
    }
    
    /**
     * 리소스 로딩 성능 측정
     */
    function measureResourceLoading() {
        if (!isActive || !window.performance || !performance.getEntriesByType) return;
        
        const resources = performance.getEntriesByType('resource');
        
        // 리소스 타입별 분류
        const resourceMetrics = {
            scripts: [],
            stylesheets: [],
            images: [],
            other: []
        };
        
        resources.forEach(resource => {
            const url = resource.name;
            const duration = resource.duration;
            const size = resource.transferSize || 0;
            
            const entry = {
                url: url.split('/').pop() || url, // 파일명만 추출
                duration: duration.toFixed(2),
                size: formatSize(size)
            };
            
            if (url.endsWith('.js')) {
                resourceMetrics.scripts.push(entry);
            } else if (url.endsWith('.css')) {
                resourceMetrics.stylesheets.push(entry);
            } else if (/\.(jpg|jpeg|png|gif|webp|svg)$/.test(url)) {
                resourceMetrics.images.push(entry);
            } else {
                resourceMetrics.other.push(entry);
            }
        });
        
        metrics.resources = resourceMetrics;
    }
    
    /**
     * 크기 포맷 변환 (바이트 -> 가독성 있는 단위)
     * @param {number} bytes - 바이트 크기
     * @returns {string} 변환된 크기 문자열
     */
    function formatSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * 성능 보고서 생성
     * @returns {string} HTML 포맷 보고서
     */
    function generateReport() {
        if (Object.keys(metrics).length === 0) {
            return '<p>성능 데이터가 없습니다.</p>';
        }
        
        let report = '<h3>성능 보고서</h3>';
        
        // 주요 메트릭
        report += '<div class="performance-metrics">';
        Object.entries(metrics).forEach(([key, value]) => {
            if (key === 'resources') return; // 리소스는 별도 처리
            
            report += `<div class="metric-item">
                <span class="metric-name">${key}</span>
                <span class="metric-value">${value} ms</span>
            </div>`;
        });
        report += '</div>';
        
        // 리소스 메트릭 (있는 경우)
        if (metrics.resources) {
            report += '<h4>리소스 로드 성능</h4>';
            
            // 스크립트
            if (metrics.resources.scripts.length) {
                report += '<details><summary>스크립트 파일 (${metrics.resources.scripts.length})</summary><ul>';
                metrics.resources.scripts.forEach(script => {
                    report += `<li>${script.url}: ${script.duration}ms (${script.size})</li>`;
                });
                report += '</ul></details>';
            }
            
            // 스타일시트
            if (metrics.resources.stylesheets.length) {
                report += '<details><summary>스타일시트 (${metrics.resources.stylesheets.length})</summary><ul>';
                metrics.resources.stylesheets.forEach(css => {
                    report += `<li>${css.url}: ${css.duration}ms (${css.size})</li>`;
                });
                report += '</ul></details>';
            }
            
            // 이미지
            if (metrics.resources.images.length) {
                report += '<details><summary>이미지 (${metrics.resources.images.length})</summary><ul>';
                metrics.resources.images.forEach(img => {
                    report += `<li>${img.url}: ${img.duration}ms (${img.size})</li>`;
                });
                report += '</ul></details>';
            }
        }
        
        return report;
    }
    
    /**
     * 보고서 표시
     */
    function showReport() {
        measureResourceLoading(); // 리소스 성능 측정
        
        // 보고서 컨테이너
        const container = document.createElement('div');
        container.className = 'performance-report';
        container.innerHTML = `
            <div class="report-header">
                <h2>성능 보고서</h2>
                <button class="close-report">&times;</button>
            </div>
            <div class="report-content">
                ${generateReport()}
            </div>
        `;
        
        // 닫기 버튼 이벤트
        container.querySelector('.close-report').addEventListener('click', () => {
            document.body.removeChild(container);
        });
        
        // 문서에 추가
        document.body.appendChild(container);
    }
    
    // 공개 API
    return {
        start,
        end,
        mark,
        measure,
        logMetric,
        measureFunction,
        showReport
    };
})();

/**
 * 7. 로컬라이즈 지원 (다국어 처리)
 * 한국어, 영어 등 다국어 지원 기능
 */
const LocalizationManager = (() => {
    const LANGUAGES = {
        KO: 'ko',
        EN: 'en'
    };
    
    let currentLanguage = LANGUAGES.KO;
    let translations = {};
    
    /**
     * 초기화
     */
    async function init() {
        // 기본 언어 설정 (브라우저 언어 기반)
        const browserLang = navigator.language.split('-')[0];
        currentLanguage = Object.values(LANGUAGES).includes(browserLang) 
            ? browserLang 
            : LANGUAGES.KO;
        
        // 번역 데이터 로드
        await loadTranslations(currentLanguage);
        
        // UI 상태 업데이트
        updateLanguageSelector();
    }
    
    /**
     * 언어 변경
     * @param {string} lang - 언어 코드
     */
    async function changeLanguage(lang) {
        if (!Object.values(LANGUAGES).includes(lang) || lang === currentLanguage) {
            return;
        }
        
        currentLanguage = lang;
        
        // 번역 데이터 로드
        await loadTranslations(lang);
        
        // UI 전체 업데이트
        translatePage();
        
        // 언어 선택기 업데이트
        updateLanguageSelector();
        
        // 언어 설정 저장
        localStorage.setItem('app-language', lang);
    }
    
    /**
     * 번역 데이터 로드
     * @param {string} lang - 언어 코드
     */
    async function loadTranslations(lang) {
        try {
            // 번역 파일 경로
            const translationPaths = [
                `/locales/${lang}.json`,
                `./locales/${lang}.json`,
                `../locales/${lang}.json`
            ];
            
            // 모든 경로 시도
            for (const path of translationPaths) {
                try {
                    const response = await fetch(path);
                    if (response.ok) {
                        translations = await response.json();
                        console.log(`${lang} 언어 데이터 로드 완료`);
                        return;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            // 모든 경로 실패 시 기본 번역 설정
            console.warn(`${lang} 언어 파일을 찾을 수 없습니다. 기본 번역을 사용합니다.`);
            translations = getDefaultTranslations(lang);
        } catch (error) {
            console.error('번역 데이터 로드 오류:', error);
            translations = getDefaultTranslations(lang);
        }
    }
    
    /**
     * 기본 번역 데이터
     * @param {string} lang - 언어 코드
     * @returns {Object} 기본 번역 객체
     */
    function getDefaultTranslations(lang) {
        if (lang === LANGUAGES.EN) {
            return {
                'search.placeholder': 'Enter item name...',
                'filter.title': 'Advanced Options',
                'filter.apply': 'Apply',
                'filter.reset': 'Reset',
                'pagination.next': 'Next',
                'pagination.prev': 'Previous'
                // 기타 필요한 키...
            };
        }
        
        // 한국어 기본값 (이미 한국어인 경우 번역 불필요)
        return {
            'search.placeholder': '아이템 이름을 입력하세요...',
            'filter.title': '세부 옵션',
            'filter.apply': '적용',
            'filter.reset': '초기화',
            'pagination.next': '다음',
            'pagination.prev': '이전'
            // 기타 필요한 키...
        };
    }
    
    /**
     * 전체 페이지 번역
     */
    function translatePage() {
        // data-i18n 속성이 있는 모든 요소 번역
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (translations[key]) {
                // 요소 유형에 따라 다른 처리
                if (element.tagName === 'INPUT' && element.getAttribute('placeholder')) {
                    element.placeholder = translations[key];
                } else {
                    element.textContent = translations[key];
                }
            }
        });
        
        // 타이틀 번역
        if (translations['page.title']) {
            document.title = translations['page.title'];
        }
    }
    
    /**
     * 언어 선택기 UI 업데이트
     */
    function updateLanguageSelector() {
        // 언어 선택기가 없으면 생성
        let selector = document.getElementById('language-selector');
        if (!selector) {
            selector = createLanguageSelector();
        }
        
        // 현재 언어 하이라이트
        const buttons = selector.querySelectorAll('button');
        buttons.forEach(button => {
            button.classList.toggle('active', button.getAttribute('data-lang') === currentLanguage);
        });
    }
    
    /**
     * 언어 선택기 생성
     * @returns {HTMLElement} 언어 선택기 요소
     */
    function createLanguageSelector() {
        const selector = document.createElement('div');
        selector.id = 'language-selector';
        selector.className = 'language-selector';
        
        // 한국어 버튼
        const koButton = document.createElement('button');
        koButton.setAttribute('data-lang', LANGUAGES.KO);
        koButton.textContent = '한국어';
        koButton.addEventListener('click', () => changeLanguage(LANGUAGES.KO));
        
        // 영어 버튼
        const enButton = document.createElement('button');
        enButton.setAttribute('data-lang', LANGUAGES.EN);
        enButton.textContent = 'English';
        enButton.addEventListener('click', () => changeLanguage(LANGUAGES.EN));
        
        // 선택기 조립
        selector.appendChild(koButton);
        selector.appendChild(enButton);
        
        // 푸터에 추가
        const footer = document.querySelector('footer');
        if (footer) {
            footer.appendChild(selector);
        } else {
            document.body.appendChild(selector);
        }
        
        return selector;
    }
    
    /**
     * 텍스트 번역
     * @param {string} key - 번역 키
     * @param {Object} params - 치환 파라미터
     * @returns {string} 번역된 텍스트
     */
    function translate(key, params = {}) {
        let text = translations[key] || key;
        
        // 파라미터 치환
        Object.entries(params).forEach(([param, value]) => {
            text = text.replace(new RegExp(`{${param}}`, 'g'), value);
        });
        
        return text;
    }
    
    // 공개 API
    return {
        init,
        changeLanguage,
        translate,
        LANGUAGES
    };
})();

/**
 * 8. App Update Notifier
 * 새 버전 알림 및 자동 업데이트 지원
 */
const UpdateNotifier = (() => {
    const CHECK_INTERVAL = 60 * 60 * 1000; // 1시간 (밀리초)
    const VERSION_URL = 'version.json';
    
    let currentVersion = '1.0.0';
    let updateCheckTimer = null;
    
    /**
     * 초기화
     * @param {string} version - 현재 버전
     */
    function init(version) {
        currentVersion = version || '1.0.0';
        
        // 세션당 한 번만 업데이트 확인
        if (!sessionStorage.getItem('update-check-performed')) {
            checkForUpdates();
            sessionStorage.setItem('update-check-performed', 'true');
        }
        
        // 주기적 업데이트 확인 설정
        startPeriodicCheck();
    }
    
    /**
     * 주기적 업데이트 확인 시작
     */
    function startPeriodicCheck() {
        stopPeriodicCheck(); // 기존 타이머 제거
        
        updateCheckTimer = setInterval(() => {
            checkForUpdates();
        }, CHECK_INTERVAL);
    }
    
    /**
     * 주기적 업데이트 확인 중지
     */
    function stopPeriodicCheck() {
        if (updateCheckTimer) {
            clearInterval(updateCheckTimer);
            updateCheckTimer = null;
        }
    }
    
    /**
     * 업데이트 확인
     */
    async function checkForUpdates() {
        try {
            // 버전 정보 로드
            const response = await fetch(VERSION_URL + '?nocache=' + Date.now());
            
            if (!response.ok) {
                throw new Error('버전 정보를 로드할 수 없습니다.');
            }
            
            const versionInfo = await response.json();
            const latestVersion = versionInfo.version;
            
            // 버전 비교
            if (isNewerVersion(latestVersion, currentVersion)) {
                // 새 버전 알림
                showUpdateNotification(latestVersion, versionInfo.changes);
                
                // 자동 새로고침 옵션 (사용자 확인 필요)
                if (versionInfo.critical) {
                    promptForRefresh();
                }
            }
        } catch (error) {
            console.warn('업데이트 확인 실패:', error);
        }
    }
    
    /**
     * 버전 비교 (Semantic Versioning)
     * @param {string} newVersion - 새 버전
     * @param {string} oldVersion - 현재 버전
     * @returns {boolean} 새 버전이 더 높은지 여부
     */
    function isNewerVersion(newVersion, oldVersion) {
        const newParts = newVersion.split('.').map(Number);
        const oldParts = oldVersion.split('.').map(Number);
        
        // 메이저 버전 비교
        if (newParts[0] > oldParts[0]) return true;
        if (newParts[0] < oldParts[0]) return false;
        
        // 마이너 버전 비교
        if (newParts[1] > oldParts[1]) return true;
        if (newParts[1] < oldParts[1]) return false;
        
        // 패치 버전 비교
        return newParts[2] > oldParts[2];
    }
    
    /**
     * 업데이트 알림 표시
     * @param {string} version - 새 버전
     * @param {Array} changes - 변경 사항 목록
     */
    function showUpdateNotification(version, changes) {
        // 이미 알림을 표시한 버전인지 확인
        const notifiedVersion = localStorage.getItem('last-notified-version');
        if (notifiedVersion === version) {
            return;
        }
        
        // 알림 컨테이너
        const notification = document.createElement('div');
        notification.className = 'update-notification';
        
        // 변경 사항 HTML 생성
        let changesHtml = '';
        if (changes && changes.length) {
            changesHtml = '<ul>' + changes.map(change => `<li>${change}</li>`).join('') + '</ul>';
        }
        
        // 알림 내용
        notification.innerHTML = `
            <div class="notification-header">
                <h3>새 버전 알림</h3>
                <button class="close-notification">&times;</button>
            </div>
            <div class="notification-content">
                <p>새 버전(${version})이 사용 가능합니다!</p>
                ${changesHtml}
                <div class="notification-actions">
                    <button class="refresh-button">지금 새로고침</button>
                    <button class="dismiss-button">나중에</button>
                </div>
            </div>
        `;
        
        // 이벤트 리스너
        notification.querySelector('.close-notification').addEventListener('click', () => {
            document.body.removeChild(notification);
        });
        
        notification.querySelector('.refresh-button').addEventListener('click', () => {
            refreshPage();
        });
        
        notification.querySelector('.dismiss-button').addEventListener('click', () => {
            document.body.removeChild(notification);
            localStorage.setItem('last-notified-version', version);
        });
        
        // 문서에 추가
        document.body.appendChild(notification);
    }
    
    /**
     * 새로고침 확인 요청
     */
    function promptForRefresh() {
        if (confirm('중요한 업데이트가 있습니다. 지금 페이지를 새로고침하시겠습니까?')) {
            refreshPage();
        }
    }
    
    /**
     * 페이지 새로고침
     */
    function refreshPage() {
        // 캐시 무시하고 새로고침
        window.location.reload(true);
    }
    
    // 공개 API
    return {
        init,
        checkForUpdates,
        startPeriodicCheck,
        stopPeriodicCheck
    };
})();
