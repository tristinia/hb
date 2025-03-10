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
        
        // 카테고리 데이터 로드
        loadCategories();
    }
    
    /**
     * 모든 카테고리 접기/펼치기 토글
     */
    function toggleAllCategories() {
        state.allExpanded = !state.allExpanded;
        
        // 모든 서브카테고리 접기/펼치기
        if (!state.allExpanded) {
            state.expandedMainCategory = null;
        }
        
        // UI 업데이트
        renderMainCategories();
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
        }
    }
    
    /**
     * 카테고리 데이터 로드
     */
    async function loadCategories() {
        try {
            // src/category-manager.js 파일 로드 시도
            const response = await fetch('../src/category-manager.js');
            
            if (response.ok) {
                const text = await response.text();
                
                // module.exports 형식에서 데이터 추출
                const mainCatMatch = text.match(/mainCategories:\s*\[([\s\S]*?)\]/);
                const categoriesMatch = text.match(/categories:\s*\[([\s\S]*?)\]/);
                
                if (mainCatMatch && categoriesMatch) {
                    try {
                        // 메인 카테고리 파싱
                        const mainCatText = `[${mainCatMatch[1]}]`;
                        const mainCategories = eval(mainCatText);
                        
                        // 서브 카테고리 파싱
                        const categoriesText = `[${categoriesMatch[1]}]`;
                        const subCategories = eval(categoriesText);
                        
                        state.mainCategories = mainCategories;
                        state.subCategories = subCategories;
                        state.isLoaded = true;
                        
                        console.log('카테고리 데이터 로드 성공:', 
                            state.mainCategories.length + '개 대분류,',
                            state.subCategories.length + '개 소분류');
                    } catch (parseError) {
                        console.error('카테고리 데이터 파싱 오류:', parseError);
                        throw new Error('카테고리 데이터 파싱 실패');
                    }
                } else {
                    throw new Error('카테고리 데이터 형식이 예상과 다름');
                }
            } else {
                throw new Error('카테고리 파일 로드 실패: ' + response.status);
            }
            
            // 카테고리 초기화
            renderMainCategories();
        } catch (error) {
            console.error('카테고리 로드 중 오류 발생:', error);
            
            // 오류 시 하드코딩된 카테고리 사용
            console.log('하드코딩된 카테고리 사용');
            
            // 카테고리 로드 실패 메시지 표시
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
            button.classList.toggle('expanded', state.expandedMainCategory === category.id);
            
            // 버튼 클릭 이벤트
            button.addEventListener('click', () => handleMainCategoryClick(category));
            
            li.appendChild(button);
            
            // 확장된 카테고리인 경우 소분류 목록 추가
            if (state.allExpanded || state.expandedMainCategory === category.id) {
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
     * 특정 메인
