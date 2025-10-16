/**
 * 유틸리티 함수 모음
 * 여러 모듈에서 공통으로 사용하는 헬퍼 함수들
 */

// 한글 관련 상수
const HANGUL_START = 44032; // '가'의 유니코드
const HANGUL_END = 55203; // '힣'의 유니코드
const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const JUNGSUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JONGSUNG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

// 영한 오타 매핑
const ENG_TO_KOR_MAP = {
    'q': 'ㅂ', 'w': 'ㅈ', 'e': 'ㄷ', 'r': 'ㄱ', 't': 'ㅅ',
    'y': 'ㅛ', 'u': 'ㅕ', 'i': 'ㅑ', 'o': 'ㅐ', 'p': 'ㅔ',
    'a': 'ㅁ', 's': 'ㄴ', 'd': 'ㅇ', 'f': 'ㄹ', 'g': 'ㅎ',
    'h': 'ㅗ', 'j': 'ㅓ', 'k': 'ㅏ', 'l': 'ㅣ',
    'z': 'ㅋ', 'x': 'ㅌ', 'c': 'ㅊ', 'v': 'ㅍ', 'b': 'ㅠ',
    'n': 'ㅜ', 'm': 'ㅡ'
};

/**
 * 한글 분해 함수
 * @param {string} str - 분해할 문자열
 * @returns {string} 분해된 문자열
 */
function decomposeHangul(str) {
    return str.split('').map(char => {
        const charCode = char.charCodeAt(0);
        if (charCode < HANGUL_START || charCode > HANGUL_END) {
            return char; // 한글이 아니면 그대로 반환
        }
        
        const chosungIndex = Math.floor((charCode - HANGUL_START) / (21 * 28));
        const jungsungIndex = Math.floor(((charCode - HANGUL_START) % (21 * 28)) / 28);
        const jongsungIndex = (charCode - HANGUL_START) % 28;
        
        return CHOSUNG[chosungIndex] + JUNGSUNG[jungsungIndex] + (jongsungIndex > 0 ? JONGSUNG[jongsungIndex] : '');
    }).join('');
}

/**
 * 초성 추출 함수
 * @param {string} str - 초성을 추출할 문자열
 * @returns {string} 추출된 초성
 */
function getChosung(str) {
    return str.split('').map(char => {
        const charCode = char.charCodeAt(0);
        if (charCode < HANGUL_START || charCode > HANGUL_END) {
            return char; // 한글이 아니면 그대로 반환
        }
        
        const chosungIndex = Math.floor((charCode - HANGUL_START) / (21 * 28));
        return CHOSUNG[chosungIndex];
    }).join('');
}

/**
 * 영문을 한글 자모로 변환 (오타 수정 용도)
 * @param {string} str - 변환할 영문 문자열
 * @returns {string} 변환된 한글 자모 문자열
 */
function engToKor(str) {
    let result = '';
    for (let i = 0; i < str.length; i++) {
        const char = str[i].toLowerCase();
        result += ENG_TO_KOR_MAP[char] || char;
    }
    return result;
}

/**
 * 디바운스 함수 (연속 호출 방지)
 * @param {Function} func - 실행할 함수
 * @param {number} wait - 대기 시간 (ms)
 * @returns {Function} 디바운스된 함수
 */
function debounce(func, wait = 300) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
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
 * 숫자에 천 단위 콤마 추가
 * @param {number} number - 포맷팅할 숫자
 * @returns {string} 포맷팅된 문자열
 */
function formatNumber(number) {
    if (number === undefined || number === null) return '0';
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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

/**
 * 오류 발생 시 로그 기록 및 처리
 * @param {Error} error - 발생한 오류
 * @param {string} context - 오류 발생 컨텍스트
 * @returns {string} 사용자에게 표시할 오류 메시지
 */
function handleError(error, context) {
    // 오류 로그 기록
    console.error(`${context} 오류:`, error);
    
    // 사용자 표시용 메시지 생성
    let userMessage = '처리 중 오류가 발생했습니다.';
    
    // 특정 오류 유형에 따른 메시지 커스터마이징
    if (error.name === 'TypeError') {
        userMessage = '데이터 형식이 올바르지 않습니다.';
    } else if (error.name === 'SyntaxError') {
        userMessage = '데이터 구문이 올바르지 않습니다.';
    } else if (error.name === 'NetworkError' || error.message.includes('네트워크') || error.message.includes('network')) {
        userMessage = '네트워크 연결을 확인해주세요.';
    }
    
    return `${userMessage} 잠시 후 다시 시도해주세요.`;
}

// ES 모듈로 내보내기
export default {
    decomposeHangul,
    getChosung,
    engToKor,
    debounce,
    throttle,
    similarityScore,
    formatNumber,
    truncateText,
    isMobileDevice,
    parseURLParams,
    handleError
};
