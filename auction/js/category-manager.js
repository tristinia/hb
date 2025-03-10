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
        allExpanded: true,
        isLoaded: false
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
        
        // 카테고리 접기/펼치기 버튼 이벤트 리스너
        if (elements.toggleAllButton) {
            elements.toggleAllButton.addEventListener('click', toggleAllCategories);
            updateToggleAllButton();
        }
        
        // 카테고리 변경 이벤트 리스너 추가
        document.addEventListener('categoryChanged', handleCategoryChangedEvent);
        
        // 카테고리 데이터 로드
        loadCategories();
    }
    
    /**
     * 카테고리 변경 이벤트 처리 함수 추가
     * @param {CustomEvent} event - 카테고리 변경 이벤트
     */
    function handleCategoryChangedEvent(event) {
        const { mainCategory, subCategory, autoSelected } = event.detail;
        
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
        state.allExpanded = !state.allExpanded;
        
        // 카테고리 패널 요소 가져오기
        const categoryPanel = document.querySelector('.category-panel');
        
        if (state.allExpanded) {
            // 펼침: 모든 대분류 카테고리를 리스트로 표시
            if (categoryPanel) {
                categoryPanel.classList.remove('collapsed');
            }
        } else {
            // 접음: 모든 대분류 카테고리를 숨김
            if (categoryPanel) {
                categoryPanel.classList.add('collapsed');
            }
        }
        
        // UI 업데이트
        updateToggleAllButton();
    }
    
    /**
     * 토글 버튼 상태 업데이트
     */
    function updateToggleAllButton() {
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
     * JSON 파일에서 카테고리 데이터 로드
     */
    async function loadCategories() {
        try {
            // JSON 파일에서 카테고리 데이터 로드
            const response = await fetch('../data/categories.json');
            
            if (!response.ok) {
                throw new Error(`카테고리 데이터 로드 실패: ${response.status}`);
            }
            
            // JSON 데이터 파싱
            const data = await response.json();
            
            // 카테고리 데이터 설정
            state.mainCategories = data.mainCategories || [];
            state.subCategories = data.categories || [];
            state.isLoaded = true;
            
            console.log('카테고리 데이터 로드 성공:', 
                state.mainCategories.length + '개 대분류,',
                state.subCategories.length + '개 소분류');
            
            // 카테고리 초기화
            renderMainCategories();
        } catch (error) {
            console.error('카테고리 로드 중 오류 발생:', error);
            
            // 오류 시 대체 경로 시도
            try {
                console.log('대체 경로에서 카테고리 데이터 로드 시도...');
                const altResponse = await fetch('/data/categories.json');
                
                if (altResponse.ok) {
                    const data = await altResponse.json();
                    state.mainCategories = data.mainCategories || [];
                    state.subCategories = data.categories || [];
                    state.isLoaded = true;
                    
                    console.log('대체 경로에서 카테고리 데이터 로드 성공');
                    renderMainCategories();
                    return;
                }
            } catch (altError) {
                console.error('대체 경로 시도 실패:', altError);
            }
            
            // 모든 시도 실패 시 오류 메시지 표시
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
     * 메인 카테고리 렌더링
     */
    function renderMainCategories() {
        // 카테고리가 없으면 표시하지 않음
        if (state.mainCategories.length === 0 || !elements.mainCategoriesList) {
            return;
        }
        
        elements.mainCategoriesList.innerHTML = '';
        
        state.mainCategories.forEach(category => {
            const li = document.createElement('li');
            li.className = 'category-item';
            
            // 토글 아이콘 SVG
            const toggleIcon = `
                <svg class="toggle-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            `;
            
            const button = document.createElement('button');
            button.className = `category-button ${state.selectedMainCategory === category.id ? 'active' : ''}`;
            button.innerHTML = `${category.name} ${toggleIcon}`;
            button.setAttribute('data-category-id', category.id);
            
            // 수정된 부분: 확장 로직 개선
            // 모든 카테고리가 펼쳐진 상태인 경우 OR 이 특정 카테고리가 펼쳐진 경우
            const isExpanded = state.allExpanded || state.expandedMainCategory === category.id;
            button.classList.toggle('expanded', isExpanded);
            
            // 버튼 클릭 이벤트
            button.addEventListener('click', () => handleMainCategoryClick(category));
            
            li.appendChild(button);
            
            // 확장된 카테고리인 경우 소분류 목록 추가
            if (isExpanded) {
                const subList = document.createElement('ul');
                subList.className = 'subcategory-list expanded';
                
                const subCategories = getSubCategoriesByMainCategory(category.id);
                subCategories.forEach(subCategory => {
                    const subLi = document.createElement('li');
                    subLi.className = 'subcategory-item';
                    
                    const subButton = document.createElement('button');
                    subButton.className = `subcategory-button ${state.selectedSubCategory === subCategory.id ? 'active' : ''}`;
                    subButton.textContent = subCategory.name;
                    subButton.setAttribute('data-category-id', subCategory.id);
                    subButton.addEventListener('click', () => handleSubCategoryClick(subCategory));
                    
                    subLi.appendChild(subButton);
                    subList.appendChild(subLi);
                });
                
                li.appendChild(subList);
            }
            
            elements.mainCategoriesList.appendChild(li);
        });
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
     * 메인 카테고리 클릭 처리
     * @param {Object} category - 클릭한 카테고리 객체
     */
    function handleMainCategoryClick(category) {
        // 이미 선택된 카테고리인 경우 토글 (펼치기/접기)
        if (state.expandedMainCategory === category.id) {
            state.expandedMainCategory = null;
        } else {
            state.expandedMainCategory = category.id;
        }
        
        // 항상 메인 카테고리는 선택 상태로 유지
        state.selectedMainCategory = category.id;
        
        // 중요: 메인 카테고리만 선택했을 때는 서브 카테고리 선택 초기화
        // 이 부분이 없어서 이전 서브 카테고리가 유지되는 문제 발생
        state.selectedSubCategory = null;
        
        // 카테고리 UI 업데이트
        renderMainCategories();
        
        // 카테고리 경로 업데이트
        updateCategoryPath();
        
        // 선택된 카테고리 정보를 이벤트로 알림
        const event = new CustomEvent('categoryChanged', {
            detail: {
                mainCategory: state.selectedMainCategory,
                subCategory: state.selectedSubCategory
            }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 서브카테고리 클릭 처리
     * @param {Object} subCategory - 클릭한 서브카테고리 객체
     */
    function handleSubCategoryClick(subCategory) {
        // 이미 선택된 서브 카테고리인 경우 선택 해제하지 않고 유지
        state.selectedSubCategory = subCategory.id;
        
        // 선택된 서브카테고리의 메인 카테고리도 선택
        const mainCategory = subCategory.mainCategory;
        if (mainCategory) {
            state.selectedMainCategory = mainCategory;
            state.expandedMainCategory = mainCategory;
        }
        
        // 카테고리 UI 업데이트
        renderMainCategories();
        
        // 카테고리 경로 업데이트
        updateCategoryPath();
        
        // 선택된 카테고리 정보를 이벤트로 알림
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
        
        if (!state.selectedMainCategory && !state.selectedSubCategory) {
            elements.categoryPath.style.display = 'none';
            return;
        }
        
        elements.categoryPath.style.display = 'block';
        
        let pathHTML = '';
        
        if (state.selectedMainCategory) {
            const mainCategory = state.mainCategories.find(cat => cat.id === state.selectedMainCategory);
            if (mainCategory) {
                pathHTML += `<span class="category-path-main">${mainCategory.name}</span>`;
            }
        }
        
        if (state.selectedSubCategory) {
            const subCategory = state.subCategories.find(cat => cat.id === state.selectedSubCategory);
            if (subCategory) {
                pathHTML += `<span class="category-path-separator">></span>`;
                pathHTML += `<span class="category-path-sub">${subCategory.name}</span>`;
            }
        }
        
        elements.categoryPath.innerHTML = pathHTML;
    }
    
    /**
     * 아이템에서 카테고리 경로 표시
     * @param {Object} item - 아이템 데이터
     */
    function showCategoryPathFromItem(item) {
        if (!elements.categoryPath) return;
        
        // 아이템 정보 없으면 표시 안함
        if (!item) {
            elements.categoryPath.style.display = 'none';
            return;
        }
        
        elements.categoryPath.style.display = 'block';
        
        let pathHTML = '';
        
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
            pathHTML += `<span class="category-path-main">${mainCategoryName}</span>`;
        }
        
        if (item.category || item.subCategory) {
            const subCategoryId = item.subCategory || item.category;
            const subCat = state.subCategories.find(cat => cat.id === subCategoryId);
            if (subCat) {
                pathHTML += `<span class="category-path-separator">></span>`;
                pathHTML += `<span class="category-path-sub">${subCat.name}</span>`;
            }
        }
        
        elements.categoryPath.innerHTML = pathHTML;
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
        renderMainCategories();
        updateCategoryPath();
    }
    
    /**
     * 선택된 카테고리 가져오기
     * @returns {Object} 선택된 카테고리 정보
     */
    function getSelectedCategories() {
        return {
            mainCategory: state.selectedMainCategory,
            subCategory: state.selectedSubCategory,
            mainCategories: state.mainCategories,  // 이름 조회를 위해 추가
            subCategories: state.subCategories     // 이름 조회를 위해 추가
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
