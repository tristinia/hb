/**
 * 카테고리 관리 모듈
 * 카테고리 데이터 로드 및 UI 관리
 */

const CategoryManager = (() => {
    // 카테고리 상태
    const state = {
        mainCategories: [],
        subCategories: [],
        selectedMainCategory: null,
        selectedSubCategory: null,
        expandedMainCategory: null,
        allExpanded: false,
        isLoaded: false,
        isMobile: false
    };
    
    // DOM 요소 참조
    let elements = {
        mainCategoriesList: null,
        categoryPath: null,
        toggleAllButton: null
    };
    
    /**
     * 모듈 초기화
     */
    function init() {
        // DOM 요소 참조 가져오기
        elements.mainCategoriesList = document.getElementById('main-categories');
        elements.categoryPath = document.getElementById('category-path');
        elements.toggleAllButton = document.getElementById('toggle-all-categories');
        
        // 모바일 여부 감지
        state.isMobile = window.matchMedia("(max-width: 768px)").matches;
        
        // 초기 확장 상태 설정 (PC: 펼침, 모바일: 접힘)
        state.allExpanded = !state.isMobile;
        
        // 이벤트 리스너 설정
        setupEventListeners();
        
        // 반응형 변경 감지
        window.matchMedia("(max-width: 768px)").addListener(handleResponsiveChange);
        
        // 카테고리 데이터 로드
        loadCategories();
    }
    
    /**
     * 반응형 변경 핸들러
     * @param {MediaQueryListEvent} e - 미디어 쿼리 이벤트
     */
    function handleResponsiveChange(e) {
        // 모바일 상태 업데이트
        state.isMobile = e.matches;
        
        // 확장 상태 재설정
        state.allExpanded = !state.isMobile;
        
        // UI 다시 렌더링
        renderMainCategories();
    }
    
    /**
     * 이벤트 리스너 설정
     */
    function setupEventListeners() {
        // 카테고리 접기/펼치기 버튼 이벤트 리스너
        if (elements.toggleAllButton) {
            elements.toggleAllButton.addEventListener('click', toggleAllCategories);
            updateToggleButton();
        }
        
        // 카테고리 변경 이벤트 리스너 추가
        document.addEventListener('categoryChanged', handleCategoryChangedEvent);

        // 메인 카테고리 목록 이벤트 위임 설정
        if (elements.mainCategoriesList) {
            elements.mainCategoriesList.addEventListener('click', handleCategoryClick);
        }
    }
    
    /**
     * 카테고리 목록 클릭 이벤트 처리 (이벤트 위임)
     * @param {Event} event - 클릭 이벤트
     */
    function handleCategoryClick(event) {
        // 메인 카테고리 버튼 클릭
        const mainButton = event.target.closest('.category-button');
        if (mainButton) {
            const categoryId = mainButton.getAttribute('data-category-id');
            const category = state.mainCategories.find(cat => cat.id === categoryId);
            if (category) {
                handleMainCategoryClick(category);
            }
            return;
        }
        
        // 서브 카테고리 버튼 클릭
        const subButton = event.target.closest('.subcategory-button');
        if (subButton) {
            const categoryId = subButton.getAttribute('data-category-id');
            const subCategory = state.subCategories.find(cat => cat.id === categoryId);
            if (subCategory) {
                handleSubCategoryClick(subCategory);
            }
        }
    }
    
    /**
     * 카테고리 변경 이벤트 처리 함수
     * @param {CustomEvent} event - 카테고리 변경 이벤트
     */
    function handleCategoryChangedEvent(event) {
        const { mainCategory, subCategory, autoSelected } = event.detail;
        
        // 카테고리 선택 상태 업데이트
        updateCategorySelection(mainCategory, subCategory, autoSelected);
    }
    
    /**
     * 카테고리 선택 상태 업데이트
     * @param {string} mainCategory - 메인 카테고리 ID
     * @param {string} subCategory - 서브 카테고리 ID
     * @param {boolean} autoSelected - 자동 선택 여부
     */
    function updateCategorySelection(mainCategory, subCategory, autoSelected) {
        // 메인 카테고리 설정
        if (mainCategory) {
            state.selectedMainCategory = mainCategory;
            
            // 자동 선택인 경우 해당 카테고리 확장
            if (autoSelected) {
                state.expandedMainCategory = mainCategory;
            }
        }
        
        // 서브 카테고리 설정
        if (subCategory) {
            state.selectedSubCategory = subCategory;
        }
        
        // UI 업데이트
        renderMainCategories();
        updateCategoryPath();
    }
    
    /**
     * 모든 카테고리 접기/펼치기 토글
     */
    function toggleAllCategories() {
        // 현재 상태의 반대로 토글
        state.allExpanded = !state.allExpanded;
        
        if (state.allExpanded) {
            // 모든 대분류 펼치기
            state.expandedMainCategory = state.mainCategories.map(cat => cat.id);
        } else {
            // 모든 대분류 접기
            state.expandedMainCategory = null;
        }
        
        // UI 업데이트
        renderMainCategories();
        updateToggleButton();
        
        // 카테고리 변경 이벤트 트리거
        triggerCategoryChangedEvent();
    }
    
    /**
     * 메인 카테고리 클릭 처리
     * @param {Object} category - 클릭된 카테고리 객체
     */
    function handleMainCategoryClick(category) {
        // 현재 선택된 카테고리와 동일한 경우 토글
        if (state.expandedMainCategory === category.id) {
            // 접기
            state.expandedMainCategory = null;
        } else {
            // 확장
            state.expandedMainCategory = category.id;
        }
        
        // 선택 상태 업데이트
        state.selectedMainCategory = category.id;
        state.selectedSubCategory = null;
        
        // UI 업데이트
        renderMainCategories();
        updateCategoryPath();
        
        // 카테고리 변경 이벤트 트리거
        triggerCategoryChangedEvent();
    }
    
    /**
     * 토글 버튼 상태 업데이트
     */
    function updateToggleButton() {
        if (elements.toggleAllButton) {
            // 토글 버튼 아이콘 업데이트 (^ 또는 v)
            elements.toggleAllButton.innerHTML = state.allExpanded ? '&#x25B2;' : '&#x25BC;';
            
            // 아이콘 회전 효과
            const icon = elements.toggleAllButton.querySelector('svg');
            if (icon) {
                icon.style.transform = state.allExpanded ? 'rotate(180deg)' : '';
            }
            
            // 버튼 텍스트 업데이트
            elements.toggleAllButton.title = state.allExpanded ? '카테고리 접기' : '카테고리 펼치기';
        }
    }
    
    /**
     * JSON 파일에서 카테고리 데이터 로드
     */
    async function loadCategories() {
        try {
            // 카테고리 데이터 로드 시도
            const response = await fetch('../../data/categories.json');
            
            if (!response.ok) {
                throw new Error(`카테고리 데이터 로드 실패: ${response.status}`);
            }
            
            // JSON 데이터 파싱
            const data = await response.json();
            
            // 카테고리 데이터 설정
            state.mainCategories = data.mainCategories || [];
            state.subCategories = data.categories || [];
            state.isLoaded = true;
            
            // 초기 확장 상태 설정
            state.expandedMainCategory = state.isMobile ? null : state.mainCategories[0]?.id;
            
            console.log('카테고리 데이터 로드 성공:', 
                state.mainCategories.length + '개 대분류,',
                state.subCategories.length + '개 소분류');
            
            // 카테고리 초기화
            renderMainCategories();
            
            // 카테고리 로드 완료 이벤트 발생
            const event = new CustomEvent('categoriesLoaded', {
                detail: {
                    mainCategories: state.mainCategories,
                    subCategories: state.subCategories
                }
            });
            document.dispatchEvent(event);
        } catch (error) {
            console.error('카테고리 로드 중 오류 발생:', error);
            showCategoryLoadError();
        }
    }
    
    /**
     * 카테고리 로드 실패 메시지 표시
     */
    function showCategoryLoadError() {
        const categoryPanel = document.querySelector('.category-panel');
        if (categoryPanel) {
            categoryPanel.innerHTML = `
                <div class="panel-header">
                    <h3>카테고리</h3>
                </div>
                <div class="category-error">
                    <p>카테고리 데이터를 로드할 수 없습니다.</p>
                    <p>네트워크 연결을 확인하고 페이지를 새로고침 해주세요.</p>
                </div>
            `;
        }
    }
    
    /**
     * 메인 카테고리 렌더링 (아코디언 스타일)
     */
    function renderMainCategories() {
        // 카테고리가 없거나 목록 요소가 없으면 처리하지 않음
        if (state.mainCategories.length === 0 || !elements.mainCategoriesList) {
            return;
        }
        
        // DocumentFragment 사용하여 DOM 조작 최적화
        const fragment = document.createDocumentFragment();
        
        // 메인 카테고리 항목 생성
        state.mainCategories.forEach(category => {
            const li = document.createElement('li');
            li.className = 'category-item accordion-item';
            
            // 현재 카테고리가 확장된 상태인지 확인
            const isExpanded = state.expandedMainCategory === category.id;
            
            // 토글 아이콘 (위/아래 화살표)
            const toggleIcon = document.createElement('span');
            toggleIcon.className = 'toggle-icon';
            toggleIcon.innerHTML = isExpanded ? '^' : 'v';
            
            // 토글 애니메이션 효과 추가
            toggleIcon.style.transition = 'transform 0.3s ease';
            
            // 카테고리 버튼
            const button = document.createElement('button');
            button.className = `category-button ${state.selectedMainCategory === category.id ? 'active' : ''} ${isExpanded ? 'expanded' : ''}`;
            button.setAttribute('data-category-id', category.id);
            button.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
            
            // 버튼 내용 (토글 아이콘 + 텍스트)
            button.appendChild(toggleIcon);
            button.appendChild(document.createTextNode(category.name));
            
            li.appendChild(button);
            
            // 소분류 목록
            const subList = document.createElement('ul');
            subList.className = `subcategory-list ${isExpanded ? 'expanded' : ''}`;
            
            // 부드러운 애니메이션 추가
            subList.style.transition = 'max-height 0.3s ease, opacity 0.3s ease';
            subList.style.maxHeight = isExpanded ? '500px' : '0';
            subList.style.opacity = isExpanded ? '1' : '0';
            subList.style.overflow = 'hidden';
            
            // 서브 카테고리 항목 생성
            const subCategories = getSubCategoriesByMainCategory(category.id);
            subCategories.forEach(subCategory => {
                const subLi = document.createElement('li');
                subLi.className = 'subcategory-item';
                
                const subButton = document.createElement('button');
                subButton.className = `subcategory-button ${state.selectedSubCategory === subCategory.id ? 'active' : ''}`;
                subButton.textContent = subCategory.name;
                subButton.setAttribute('data-category-id', subCategory.id);
                
                subLi.appendChild(subButton);
                subList.appendChild(subLi);
            });
            
            li.appendChild(subList);
            fragment.appendChild(li);
        });
        
        // 기존 내용을 지우고 한 번에 추가 (성능 최적화)
        elements.mainCategoriesList.innerHTML = '';
        elements.mainCategoriesList.appendChild(fragment);
    }
    
    /**
     * 특정 메인 카테고리에 속하는 서브카테고리 가져오기
     * @param {string} mainCategory - 메인 카테고리 ID
     * @returns {Array} 서브카테고리 목록
     */
    function getSubCategoriesByMainCategory(mainCategory) {
        return state.subCategories.filter(cat => cat.mainCategory === mainCategory);
    }
    
    /**
     * 서브카테고리 클릭 처리
     * @param {Object} subCategory - 클릭한 서브카테고리 객체
     */
    function handleSubCategoryClick(subCategory) {
        // 서브 카테고리 선택
        state.selectedSubCategory = subCategory.id;
        
        // 선택된 서브카테고리의 메인 카테고리도 선택
        const mainCategory = subCategory.mainCategory;
        if (mainCategory) {
            state.selectedMainCategory = mainCategory;
            state.expandedMainCategory = mainCategory;
        }
        
        // UI 업데이트
        renderMainCategories();
        updateCategoryPath();
        
        // 선택된 카테고리 정보를 이벤트로 알림
        triggerCategoryChangedEvent();
    }
    
    /**
     * 카테고리 변경 이벤트 트리거
     */
    function triggerCategoryChangedEvent() {
        const event = new CustomEvent('categoryChanged', {
            detail: {
                mainCategory: state.selectedMainCategory,
                subCategory: state.selectedSubCategory
            }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 카테고리 경로 업데이트
     */
    function updateCategoryPath() {
        if (!elements.categoryPath) return;
        
        // 기존 경로 초기화
        elements.categoryPath.innerHTML = '';
        
        // 아무 카테고리도 선택하지 않았을 경우에는 감춤
        if (!state.selectedMainCategory && !state.selectedSubCategory) {
            elements.categoryPath.style.display = 'none';
            return;
        }
        
        elements.categoryPath.style.display = 'flex';
        
        // 경로 항목 배열 생성
        let pathItems = [];
        
        if (state.selectedMainCategory) {
            const mainCategory = state.mainCategories.find(cat => cat.id === state.selectedMainCategory);
            if (mainCategory) {
                pathItems.push({
                    type: 'main',
                    id: mainCategory.id,
                    name: mainCategory.name
                });
            }
        }
        
        if (state.selectedSubCategory) {
            const subCategory = state.subCategories.find(cat => cat.id === state.selectedSubCategory);
            if (subCategory) {
                pathItems.push({
                    type: 'sub',
                    id: subCategory.id,
                    name: subCategory.name
                });
            }
        }
        
        // 경로 항목 렌더링
        pathItems.forEach((item, index) => {
            // 구분자 추가 (첫 번째 항목 제외)
            if (index > 0) {
                const separator = document.createElement('span');
                separator.className = 'category-path-separator';
                separator.textContent = ' > ';
                elements.categoryPath.appendChild(separator);
            }
            
            // 경로 항목
            const pathButton = document.createElement('span');
            pathButton.className = `category-path-${item.type} category-button`;
            pathButton.setAttribute('data-category', item.id);
            pathButton.textContent = item.name;
            
            // 클릭 이벤트 리스너 추가
            pathButton.addEventListener('click', (e) => {
                const categoryId = e.target.getAttribute('data-category');
                
                // 메인 카테고리 버튼 클릭
                const mainCategory = state.mainCategories.find(cat => cat.id === categoryId);
                if (mainCategory) {
                    handleMainCategoryClick(mainCategory);
                    return;
                }
                
                // 서브 카테고리 버튼 클릭
                const subCategory = state.subCategories.find(cat => cat.id === categoryId);
                if (subCategory) {
                    handleSubCategoryClick(subCategory);
                }
            });
            
            elements.categoryPath.appendChild(pathButton);
        });
    }
    
    /**
     * 아이템에서 카테고리 경로 표시
     * @param {Object} item - 아이템 데이터
     */
    function showCategoryPathFromItem(item) {
        if (!elements.categoryPath) return;
        
        // 아이템 정보 없으면 감춤
        if (!item) {
            elements.categoryPath.innerHTML = '';
            elements.categoryPath.style.display = 'none';
            return;
        }
        
        elements.categoryPath.style.display = 'flex';
        elements.categoryPath.innerHTML = '';
        
        // 경로 항목 배열 생성
        let pathItems = [];
        
        // 메인 카테고리 찾기
        let mainCategoryId = '';
        
        if (item.mainCategory) {
            mainCategoryId = item.mainCategory;
            const mainCat = state.mainCategories.find(cat => cat.id === mainCategoryId);
            if (mainCat) {
                pathItems.push({
                    type: 'main',
                    id: mainCat.id,
                    name: mainCat.name
                });
            }
        } else if (item.category) {
            // 서브 카테고리로부터 메인 카테고리 찾기
            const subCat = state.subCategories.find(cat => cat.id === item.category);
            if (subCat) {
                mainCategoryId = subCat.mainCategory;
                const mainCat = state.mainCategories.find(cat => cat.id === mainCategoryId);
                if (mainCat) {
                    pathItems.push({
                        type: 'main',
                        id: mainCat.id,
                        name: mainCat.name
                    });
                }
            }
        }
        
        // 서브 카테고리 추가
        if (item.category || item.subCategory) {
            const subCategoryId = item.subCategory || item.category;
            const subCat = state.subCategories.find(cat => cat.id === subCategoryId);
            if (subCat) {
                pathItems.push({
                    type: 'sub',
                    id: subCat.id,
                    name: subCat.name
                });
            }
        }
        
        // 경로 항목 렌더링
        pathItems.forEach((item, index) => {
            // 구분자 추가 (첫 번째 항목 제외)
            if (index > 0) {
                const separator = document.createElement('span');
                separator.className = 'category-path-separator';
                separator.textContent = ' > ';
                elements.categoryPath.appendChild(separator);
            }
            
            // 경로 항목
            const pathButton = document.createElement('span');
            pathButton.className = `category-path-${item.type} category-button`;
            pathButton.setAttribute('data-category', item.id);
            pathButton.textContent = item.name;
            
            // 클릭 이벤트 리스너 추가
            pathButton.addEventListener('click', (e) => {
                const categoryId = e.target.getAttribute('data-category');
                
                // 메인 카테고리 버튼 클릭
                const mainCategory = state.mainCategories.find(cat => cat.id === categoryId);
                if (mainCategory) {
                    handleMainCategoryClick(mainCategory);
                    return;
                }
                
                // 서브 카테고리 버튼 클릭
                const subCategory = state.subCategories.find(cat => cat.id === categoryId);
                if (subCategory) {
                    handleSubCategoryClick(subCategory);
                }
            });
            
            elements.categoryPath.appendChild(pathButton);
        });
    }
    
    /**
     * 서브 카테고리에 해당하는 메인 카테고리 찾기
     * @param {string} subCategoryId - 서브 카테고리 ID
     * @returns {string|null} 메인 카테고리 ID
     */
    function findMainCategoryForSubCategory(subCategoryId) {
        if (!subCategoryId) return null;
        
        const subCategory = state.subCategories.find(cat => 
            cat.id === subCategoryId || cat.name === subCategoryId);
        
        return subCategory ? subCategory.mainCategory : null;
    }
    
    /**
     * 선택된 카테고리 초기화
     */
    function resetSelectedCategories() {
        state.selectedMainCategory = null;
        state.selectedSubCategory = null;
        state.expandedMainCategory = null;
        
        // UI 업데이트
        renderMainCategories();
        updateCategoryPath();
        
        // 카테고리 변경 이벤트 트리거
        triggerCategoryChangedEvent();
    }
    
    /**
     * 선택된 카테고리 가져오기
     * @returns {Object} 선택된 카테고리 정보
     */
    function getSelectedCategories() {
        return {
            mainCategory: state.selectedMainCategory,
            subCategory: state.selectedSubCategory,
            mainCategories: state.mainCategories,
            subCategories: state.subCategories
        };
    }
    
    // 공개 API
    return {
        init,
        renderMainCategories,
        updateCategoryPath,
        showCategoryPathFromItem,
        findMainCategoryForSubCategory,
        resetSelectedCategories,
        getSelectedCategories,
        getSubCategoriesByMainCategory,
        handleResponsiveChange
    };
})();

export default CategoryManager;
