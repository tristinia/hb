/**
 * 카테고리 관리 모듈
 * 반응형 카테고리 UI 및 상태 관리
 */
const CategoryManager = (() => {
    // 카테고리 상태 관리
    const state = {
        mainCategories: [],      // 주 카테고리 목록
        subCategories: [],       // 하위 카테고리 목록
        selectedMainCategory: null,  // 현재 선택된 주 카테고리
        selectedSubCategory: null,   // 현재 선택된 하위 카테고리
        expandedMainCategory: null,  // 현재 펼쳐진 주 카테고리
        allExpanded: false,      // 전체 카테고리 확장 상태
        isLoaded: false,         // 데이터 로딩 완료 여부
        isMobile: false          // 모바일 환경 여부
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
        // DOM 요소 참조
        elements.mainCategoriesList = document.getElementById('main-categories');
        elements.categoryPath = document.getElementById('category-path');
        elements.toggleAllButton = document.getElementById('toggle-all-categories');
        
        // 디바이스 환경 감지
        state.isMobile = window.matchMedia("(max-width: 768px)").matches;
        
        // 초기 확장 상태 설정
        state.allExpanded = !state.isMobile;
        state.expandedMainCategory = state.isMobile ? null : state.mainCategories[0]?.id;
        
        // 이벤트 리스너 설정
        setupEventListeners();
        
        // 반응형 변경 감지
        window.matchMedia("(max-width: 768px)").addListener(handleResponsiveChange);
        
        // 카테고리 데이터 로드
        loadCategories();
    }
    
    /**
     * 반응형 디자인 변경 처리
     * @param {MediaQueryListEvent} e - 미디어 쿼리 이벤트
     */
    function handleResponsiveChange(e) {
        // 모바일 상태 업데이트
        state.isMobile = e.matches;
        
        // 확장 상태 재설정
        state.allExpanded = !state.isMobile;
        state.expandedMainCategory = state.isMobile ? null : state.mainCategories[0]?.id;
        
        // UI 다시 렌더링
        renderMainCategories();
    }
    
    /**
     * 이벤트 리스너 설정
     */
    function setupEventListeners() {
        // 카테고리 접기/펼치기 버튼 이벤트
        if (elements.toggleAllButton) {
            elements.toggleAllButton.addEventListener('click', toggleAllCategories);
            updateToggleButton();
        }
        
        // 카테고리 변경 이벤트 리스너
        document.addEventListener('categoryChanged', handleCategoryChangedEvent);

        // 메인 카테고리 목록 이벤트 위임
        if (elements.mainCategoriesList) {
            elements.mainCategoriesList.addEventListener('click', handleCategoryClick);
        }
    }
    
    /**
     * 카테고리 클릭 이벤트 처리 (이벤트 위임)
     * @param {Event} event - 클릭 이벤트
     */
    function handleCategoryClick(event) {
        // 전체 카테고리 버튼 클릭
        const allButton = event.target.closest('.all-category-button');
        if (allButton) {
            resetSelectedCategories();
            return;
        }
        
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
     * 카테고리 변경 이벤트 처리
     * @param {CustomEvent} event - 카테고리 변경 이벤트
     */
    function handleCategoryChangedEvent(event) {
        const { mainCategory, subCategory, autoSelected } = event.detail;
        
        // 카테고리 선택 상태 업데이트
        updateCategorySelection(mainCategory, subCategory, autoSelected);
    }
    
    /**
     * 카테고리 선택 상태 업데이트
     * @param {string} mainCategory - 선택된 주 카테고리 ID
     * @param {string} subCategory - 선택된 하위 카테고리 ID
     * @param {boolean} autoSelected - 자동 선택 여부
     */
    function updateCategorySelection(mainCategory, subCategory, autoSelected) {
        // 주 카테고리 설정
        if (mainCategory) {
            state.selectedMainCategory = mainCategory;
            
            // 자동 선택인 경우 해당 카테고리 확장
            if (autoSelected) {
                state.expandedMainCategory = mainCategory;
            }
        }
        
        // 하위 카테고리 설정
        if (subCategory) {
            state.selectedSubCategory = subCategory;
        }
        
        // UI 업데이트
        renderMainCategories();
        updateCategoryPath();
    }
    
    /**
     * 전체 카테고리 접기/펼치기 토글
     */
    function toggleAllCategories() {
        state.allExpanded = !state.allExpanded;
        
        if (state.allExpanded) {
            // 첫 번째 대분류 확장
            state.expandedMainCategory = state.mainCategories[0]?.id;
            state.selectedMainCategory = state.mainCategories[0]?.id;
        } else {
            // 모든 대분류 접기
            state.expandedMainCategory = null;
            state.selectedMainCategory = null;
            state.selectedSubCategory = null;
        }
        
        // UI 업데이트
        renderMainCategories();
        updateCategoryPath();
        updateToggleButton();
        
        // 카테고리 변경 이벤트 트리거
        triggerCategoryChangedEvent();
    }
    
    /**
     * 토글 버튼 상태 업데이트
     */
    function updateToggleButton() {
        if (elements.toggleAllButton) {
            elements.toggleAllButton.classList.toggle('expanded', state.allExpanded);
            
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
     * 카테고리 데이터 로드
     */
    async function loadCategories() {
        try {
            // 카테고리 데이터 로드
            const categoriesPath = '../../data/categories.json';
            const response = await fetch(categoriesPath);
            
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
        } catch (error) {
            console.error('카테고리 로드 중 오류:', error);
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
                    <p>검색 기능을 이용해주세요.</p>
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
        
        // 전체 카테고리 항목 생성
        const allCategoryLi = document.createElement('li');
        allCategoryLi.className = 'category-item all-category';
        
        const allCategoryButton = document.createElement('button');
        allCategoryButton.className = `all-category-button ${!state.selectedMainCategory ? 'active' : ''}`;
        allCategoryButton.textContent = '전체';
        
        // 전체 버튼 클릭 이벤트 추가
        allCategoryButton.addEventListener('click', () => {
            // 모든 카테고리 접기
            state.selectedMainCategory = null;
            state.selectedSubCategory = null;
            state.expandedMainCategory = null;
            
            renderMainCategories();
            updateCategoryPath();
            triggerCategoryChangedEvent();
        });
        
        allCategoryLi.appendChild(allCategoryButton);
        fragment.appendChild(allCategoryLi);
        
        // 메인 카테고리 항목 생성
        state.mainCategories.forEach(category => {
            const li = document.createElement('li');
            li.className = 'category-item accordion-item';
            
            // 현재 카테고리가 확장된 상태인지 확인
            const isExpanded = state.expandedMainCategory === category.id;
            
            // +/- 토글 아이콘 생성
            const toggleIcon = document.createElement('span');
            toggleIcon.className = 'toggle-icon';
            toggleIcon.innerHTML = isExpanded ? '-' : '+';
            toggleIcon.style.transition = 'transform 0.3s ease';
            
            // 카테고리 버튼 생성
            const button = document.createElement('button');
            button.className = `category-button ${state.selectedMainCategory === category.id ? 'active' : ''} ${isExpanded ? 'expanded' : ''}`;
            button.setAttribute('data-category-id', category.id);
            button.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
            
            // 버튼 내용 (토글 아이콘 + 텍스트)
            button.appendChild(toggleIcon);
            button.appendChild(document.createTextNode(category.name));
            
            // 클릭 이벤트 리스너 추가
            button.addEventListener('click', () => {
                // 현재 선택된 카테고리와 동일하면 토글, 다르면 확장
                if (state.expandedMainCategory === category.id) {
                    // 접기
                    state.expandedMainCategory = null;
                    state.selectedMainCategory = null;
                    state.selectedSubCategory = null;
                } else {
                    // 확장
                    state.expandedMainCategory = category.id;
                    state.selectedMainCategory = category.id;
                    state.selectedSubCategory = null;
                }
                
                // UI 업데이트
                renderMainCategories();
                updateCategoryPath();
                
                // 카테고리 변경 이벤트 트리거
                triggerCategoryChangedEvent();
            });
            
            li.appendChild(button);
            
            // 소분류 목록 생성
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
                
                // 서브 카테고리 클릭 이벤트
                subButton.addEventListener('click', () => {
                    // 서브 카테고리 선택
                    state.selectedSubCategory = subCategory.id;
                    
                    // 해당 메인 카테고리 확장
                    state.expandedMainCategory = subCategory.mainCategory;
                    state.selectedMainCategory = subCategory.mainCategory;
                    
                    // UI 업데이트
                    renderMainCategories();
                    updateCategoryPath();
                    
                    // 카테고리 변경 이벤트 트리거
                    triggerCategoryChangedEvent();
                });
                
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
     * 특정 메인 카테고리의 하위 카테고리 조회
     * @param {string} mainCategory - 주 카테고리 ID
     * @returns {Array} 하위 카테고리 목록
     */
    function getSubCategoriesByMainCategory(mainCategory) {
        return state.subCategories.filter(cat => cat.mainCategory === mainCategory);
    }
    
    /**
     * 메인 카테고리 클릭 처리
     * @param {Object} category - 클릭된 카테고리 객체
     */
    function handleMainCategoryClick(category) {
        // 이미 선택된 카테고리인 경우 토글 (펼치기/접기)
        if (state.expandedMainCategory === category.id) {
            state.expandedMainCategory = null;
            state.selectedMainCategory = null;
            state.selectedSubCategory = null;
        } else {
            state.expandedMainCategory = category.id;
            state.selectedMainCategory = category.id;
            state.selectedSubCategory = null;
        }
        
        // UI 업데이트
        renderMainCategories();
        updateCategoryPath();
        
        // 선택된 카테고리 정보를 이벤트로 알림
        triggerCategoryChangedEvent();
    }
    
    /**
     * 서브카테고리 클릭 처리
     * @param {Object} subCategory - 클릭된 하위 카테고리 객체
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
        
        // 기본값으로 "전체" 표시
        elements.categoryPath.innerHTML = '<span class="category-path-main category-button">전체</span>';
        
        // 아무 카테고리도 선택하지 않았을 경우에는 기본 "전체" 표시만 유지
        if (!state.selectedMainCategory && !state.selectedSubCategory) {
            elements.categoryPath.style.display = 'block';
            return;
        }
        
        elements.categoryPath.style.display = 'block';
        
        let pathHTML = '<span class="category-path-main category-button">전체</span>';
        
        if (state.selectedMainCategory) {
            const mainCategory = state.mainCategories.find(cat => cat.id === state.selectedMainCategory);
            if (mainCategory) {
                pathHTML += `<span class="category-path-separator">></span>
                           <span class="category-path-main category-button" data-category="${mainCategory.id}">${mainCategory.name}</span>`;
            }
        }
        
        if (state.selectedSubCategory) {
            const subCategory = state.subCategories.find(cat => cat.id === state.selectedSubCategory);
            if (subCategory) {
                pathHTML += `<span class="category-path-separator">></span>
                           <span class="category-path-sub category-button" data-category="${subCategory.id}">${subCategory.name}</span>`;
            }
        }
        
        elements.categoryPath.innerHTML = pathHTML;
        
        // 경로 버튼에 이벤트 리스너 추가
        const pathButtons = elements.categoryPath.querySelectorAll('.category-button');
        pathButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const categoryId = e.target.getAttribute('data-category');
                
                // "전체" 버튼 클릭 시
                if (!categoryId) {
                    resetSelectedCategories();
                    return;
                }
                
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
        });
    }
    
    /**
     * 아이템 정보로부터 카테고리 경로 표시
     * @param {Object} item - 아이템 데이터
     */
    function showCategoryPathFromItem(item) {
        if (!elements.categoryPath) return;
        
        // 아이템 정보 없으면 기본 "전체" 표시
        if (!item) {
            elements.categoryPath.innerHTML = '<span class="category-path-main category-button">전체</span>';
            elements.categoryPath.style.display = 'block';
            return;
        }
        
        elements.categoryPath.style.display = 'block';
        
        let pathHTML = '<span class="category-path-main category-button">전체</span>';
        
        // 메인 카테고리 찾기
        let mainCategoryId = '';
        let mainCategoryName = '';
        
        if (item.mainCategory) {
            mainCategoryId = item.mainCategory;
            const mainCat = state.mainCategories.find(cat => cat.id === mainCategoryId);
            if (mainCat) mainCategoryName = mainCat.name;
        } else if (item.category) {
            // 서브 카테고리로부터 메인 카테고리 찾기
            const subCat = state.subCategories.find(cat => cat.id === item.category);
            if (subCat) {
                mainCategoryId = subCat.mainCategory;
                const mainCat = state.mainCategories.find(cat => cat.id === mainCategoryId);
                if (mainCat) mainCategoryName = mainCat.name;
            }
        }
        
        // 경로 HTML 구성
        if (mainCategoryName) {
            pathHTML += `<span class="category-path-separator">></span>
                      <span class="category-path-main category-button" data-category="${mainCategoryId}">${mainCategoryName}</span>`;
        }
        
        if (item.category || item.subCategory) {
            const subCategoryId = item.subCategory || item.category;
            const subCat = state.subCategories.find(cat => cat.id === subCategoryId);
            if (subCat) {
                pathHTML += `<span class="category-path-separator">></span>
                          <span class="category-path-sub category-button" data-category="${subCat.id}">${subCat.name}</span>`;
            }
        }
        
        elements.categoryPath.innerHTML = pathHTML;
        
        // 경로 버튼에 이벤트 리스너 추가
        const pathButtons = elements.categoryPath.querySelectorAll('.category-button');
        pathButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const categoryId = e.target.getAttribute('data-category');
                
                // "전체" 버튼 클릭 시
                if (!categoryId) {
                    resetSelectedCategories();
                    return;
                }
                
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
        });
    }
    
    /**
     * 서브 카테고리에 해당하는 메인 카테고리 찾기
     * @param {string} subCategoryId - 하위 카테고리 ID
     * @returns {string|null} 주 카테고리 ID
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
     * 선택된 카테고리 정보 조회
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
        getSubCategoriesByMainCategory
    };
})();
