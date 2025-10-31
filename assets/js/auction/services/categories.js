/**
 * 카테고리 관리 모듈
 * 카테고리 데이터 로드 및 관리
 */

const CategoryManager = (() => {
    // 카테고리 상태
    const state = {
        mainCategories: [],
        subCategories: [],
        selectedMainCategory: null,
        selectedSubCategory: null,
        isLoaded: false
    };
    
    /**
     * 모듈 초기화
     */
    function init() {
        // 카테고리 데이터 로드
        loadCategories();
    }
    
    /**
     * JSON 파일에서 카테고리 데이터 로드
     */
    async function loadCategories() {
        try {
            // 카테고리 데이터 로드 시도
            const response = await fetch('data/categories.json');
            
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
        }
    }
    
    /**
     * 카테고리 선택 상태 업데이트
     * @param {string} mainCategory - 메인 카테고리 ID
     * @param {string} subCategory - 서브 카테고리 ID
     */
    function updateCategorySelection(mainCategory, subCategory) {
        // 메인 카테고리 설정
        if (mainCategory) {
            state.selectedMainCategory = mainCategory;
        }
        
        // 서브 카테고리 설정
        if (subCategory) {
            state.selectedSubCategory = subCategory;
        }
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
    
    /**
     * 특정 메인 카테고리에 속하는 서브카테고리 가져오기
     * @param {string} mainCategory - 메인 카테고리 ID
     * @returns {Array} 서브카테고리 목록
     */
    function getSubCategoriesByMainCategory(mainCategory) {
        return state.subCategories.filter(cat => cat.mainCategory === mainCategory);
    }
    
    // 공개 API
    return {
        init,
        findMainCategoryForSubCategory,
        resetSelectedCategories,
        getSelectedCategories,
        getSubCategoriesByMainCategory,
        updateCategorySelection
    };
})();

export default CategoryManager;
