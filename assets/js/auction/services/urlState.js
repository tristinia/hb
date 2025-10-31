/*
 * urlState.js
 * URL 파라미터로 검색/필터 상태를 저장하여 공유 가능한 링크를 생성하는 모듈
 * (현재 사용되지 않아 주석 처리됨)
 */

// const UrlState = (() => {
//     /**
//      * 현재 상태를 URL로 인코딩
//      * @param {Object} state - 현재 상태 객체
//      * @returns {string} 인코딩된 URL
//      */
//     function encodeStateToUrl(state) {
//         // 상태 객체에서 필요한 정보만 추출
//         const shareableState = {
//             s: state.searchTerm || '',                     // 검색어
//             p: state.currentPage || 1,                     // 현재 페이지
//             ps: state.pageSize || 20,                      // 페이지 크기
//             f: compressFilters(state.filters || {}),       // 압축된 필터 정보
//             sort: state.sortField || '',                   // 정렬 필드
//             dir: state.sortDirection || 'asc'              // 정렬 방향
//         };
        
//         // 빈 값 제거
//         Object.keys(shareableState).forEach(key => {
//             if (
//                 shareableState[key] === '' || 
//                 shareableState[key] === null || 
//                 shareableState[key] === undefined ||
//                 (typeof shareableState[key] === 'object' && Object.keys(shareableState[key]).length === 0)
//             ) {
//                 delete shareableState[key];
//             }
//         });
        
//         // URL 쿼리 스트링으로 변환
//         const queryString = new URLSearchParams(shareableState).toString();
        
//         // 현재 URL 가져오기 (경로만)
//         const currentUrl = window.location.pathname;
        
//         // 새 URL 반환
//         return `${currentUrl}?${queryString}`;
//     }
    
//     /**
//      * URL에서 상태 디코딩
//      * @param {string} url - 디코딩할 URL
//      * @returns {Object} 디코딩된 상태 객체
//      */
//     function decodeStateFromUrl(url) {
//         const urlObj = new URL(url || window.location.href);
//         const params = new URLSearchParams(urlObj.search);
        
//         // 상태 객체 구성
//         const state = {
//             searchTerm: params.get('s') || '',
//             currentPage: parseInt(params.get('p')) || 1,
//             pageSize: parseInt(params.get('ps')) || 20,
//             filters: decompressFilters(params.get('f') || ''),
//             sortField: params.get('sort') || '',
//             sortDirection: params.get('dir') || 'asc'
//         };
        
//         return state;
//     }
    
//     /**
//      * 필터 객체 압축
//      * @param {Object} filters - 압축할 필터 객체
//      * @returns {string} 압축된 필터 문자열
//      */
//     function compressFilters(filters) {
//         if (Object.keys(filters).length === 0) {
//             return '';
//         }
        
//         // 간단한 형태로 직렬화
//         const serialized = JSON.stringify(filters);
        
//         // Base64 인코딩 (URL 안전 버전)
//         return btoa(serialized).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
//     }
    
//     /**
//      * 압축된 필터 문자열 복원
//      * @param {string} compressed - 압축된 필터 문자열
//      * @returns {Object} 복원된 필터 객체
//      */
//     function decompressFilters(compressed) {
//         if (!compressed) {
//             return {};
//         }
        
//         try {
//             // Base64 디코딩 (URL 안전 버전 되돌리기)
//             const base64 = compressed.replace(/-/g, '+').replace(/_/g, '/');
            
//             // 필요 시 패딩 추가
//             const padding = '='.repeat((4 - (base64.length % 4)) % 4);
//             const padded = base64 + padding;
            
//             // 디코딩 및 파싱
//             const serialized = atob(padded);
//             return JSON.parse(serialized);
//         } catch (error) {
//             console.error('필터 압축 해제 오류:', error);
//             return {};
//         }
//     }
    
//     /**
//      * 공유 가능한 URL 생성
//      * @returns {string} 공유 URL
//      */
//     function createShareableUrl() {
//         // 현재 애플리케이션 상태 수집
//         const appState = {
//             searchTerm: SearchManager.getSearchState().searchTerm,
//             selectedCategory: CategoryManager.getSelectedCategories().subCategory,
//             selectedMainCategory: CategoryManager.getSelectedCategories().mainCategory,
//             currentPage: PaginationManager.getState().currentPage,
//             pageSize: PaginationManager.getState().itemsPerPage,
//             filters: FilterManager.getFilters().advancedFilters
//         };
        
//         return encodeStateToUrl(appState);
//     }
    
//     /**
//      * URL에서 상태 복원
//      * @returns {Object} 복원된 상태
//      */
//     function restoreFromUrl() {
//         return decodeStateFromUrl();
//     }
    
//     // 공개 API
//     return {
//         createShareableUrl,
//         restoreFromUrl,
//     };
// })();

// export default UrlState;