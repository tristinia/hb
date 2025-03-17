/**
 * 유틸리티 함수 모음
 * 여러 모듈에서 공통으로 사용하는 헬퍼 함수들
 */

const Utils = (() => {
    /**
     * 숫자에 천 단위 콤마 추가
     * @param {number} number - 포맷팅할 숫자
     * @returns {string} 포맷팅된 문자열
     */
    function formatNumber(number) {
        if (number === undefined || number === null) return '0';
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    
    /**
     * 디바운스 함수 (연속 호출 제한)
     * @param {Function} func - 실행할 함수
     * @param {number} wait - 대기 시간 (ms)
     * @returns {Function} 디바운스된 함수
     */
    function debounce(func, wait = 300) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
    
    /**
     * 스로틀 함수 (호출 빈도 제한)
     * @param {Function} func - 실행할 함수
     * @param {number} limit - 제한 시간 (ms)
     * @returns {Function} 스로틀된 함수
     */
    function throttle(func, limit = 300) {
        let lastCall = 0;
        return function() {
            const now = Date.now();
            if (now - lastCall < limit) return;
            lastCall = now;
            return func.apply(this, arguments);
        };
    }
    
    /**
     * 문자열 유사도 점수 계산 (0~1)
     * @param {string} str1 - 첫 번째 문자열
     * @param {string} str2 - 두 번째 문자열
     * @returns {number} 유사도 점수 (0~1)
     */
    function similarityScore(str1, str2) {
        if (!str1 || !str2) return 0;
        str1 = str1.toLowerCase();
        str2 = str2.toLowerCase();
        
        // 간단한 유사도 측정: 공통 부분 문자열 찾기
        let score = 0;
        const minLength = Math.min(str1.length, str2.length);
        
        for (let i = 0; i < minLength; i++) {
            if (str1[i] === str2[i]) {
                score += 1;
            } else {
                break;
            }
        }
        
        // 추가 점수: 포함 관계
        if (str1.includes(str2) || str2.includes(str1)) {
            score += Math.min(str1.length, str2.length) * 0.2;
        }
        
        return score / Math.max(str1.length, str2.length);
    }
    
    /**
     * 초성 추출 (한글)
     * @param {string} str - 초성을 추출할 문자열
     * @returns {string} 추출된 초성
     */
    function getChosung(str) {
        if (!str) return '';
        
        const chos = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
        let result = '';
        
        for (let i = 0; i < str.length; i++) {
            const char = str.charAt(i);
            const code = char.charCodeAt(0);
            
            if (code >= 44032 && code <= 55203) {
                // 한글 음절 범위 (가~힣)
                const chosungIndex = Math.floor((code - 44032) / 588);
                result += chos[chosungIndex];
            } else {
                // 한글이 아닌 경우는 그대로 추가
                result += char;
            }
        }
        
        return result;
    }
    
    /**
     * 영어 타이핑을 한글로 변환 (잘못된 키보드 입력 보정)
     * @param {string} eng - 영어 문자열
     * @returns {string} 변환된 한글 문자열
     */
    function engToKor(eng) {
        if (!eng) return '';
        
        const engToKorMap = {
            'q': 'ㅂ', 'w': 'ㅈ', 'e': 'ㄷ', 'r': 'ㄱ', 't': 'ㅅ', 'y': 'ㅛ', 'u': 'ㅕ', 'i': 'ㅑ', 'o': 'ㅐ', 'p': 'ㅔ',
            'a': 'ㅁ', 's': 'ㄴ', 'd': 'ㅇ', 'f': 'ㄹ', 'g': 'ㅎ', 'h': 'ㅗ', 'j': 'ㅓ', 'k': 'ㅏ', 'l': 'ㅣ',
            'z': 'ㅋ', 'x': 'ㅌ', 'c': 'ㅊ', 'v': 'ㅍ', 'b': 'ㅠ', 'n': 'ㅜ', 'm': 'ㅡ'
        };
        
        let result = '';
        for (let i = 0; i < eng.length; i++) {
            const char = eng.charAt(i).toLowerCase();
            result += engToKorMap[char] || char;
        }
        
        return result;
    }
    
    /**
     * 텍스트 절단 및 말줄임표 추가
     * @param {string} text - 원본 텍스트
     * @param {number} maxLength - 최대 길이
     * @returns {string} 잘린 텍스트
     */
    function truncateText(text, maxLength = 50) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    /**
     * 현재 디바이스가 모바일인지 확인
     * @returns {boolean} 모바일 여부
     */
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    /**
     * URL 매개변수 파싱
     * @returns {Object} 파싱된 매개변수 객체
     */
    function parseURLParams() {
        const params = {};
        const queryString = window.location.search.substring(1);
        const pairs = queryString.split('&');
        
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i].split('=');
            if (pair.length === 2) {
                params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
            }
        }
        
        return params;
    }
    
    // 공개 API
    return {
        formatNumber,
        debounce,
        throttle,
        similarityScore,
        getChosung,
        engToKor,
        truncateText,
        isMobileDevice,
        parseURLParams
    };
})();
