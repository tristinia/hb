/**
 * 유틸리티 함수 모음
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

/**
 * 스로틀 함수 (일정 시간 간격으로 호출 제한)
 * @param {Function} func - 실행할 함수
 * @param {number} limit - 제한 시간 (ms)
 * @returns {Function} 스로틀링된 함수
 */
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const context = this;
        const args = arguments;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 날짜 포맷팅 함수
 * @param {string} dateString - YYYY-MM-DD 형식의 날짜 문자열
 * @returns {string} 포맷팅된 날짜 문자열 (예: 2024년 03월 10일)
 */
function formatDate(dateString) {
    if (!dateString || typeof dateString !== 'string') return '';
    
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    
    return `${parts[0]}년 ${parts[1]}월 ${parts[2]}일`;
}

/**
 * 숫자에 천단위 콤마 추가
 * @param {number} number - 포맷팅할 숫자
 * @returns {string} 포맷팅된 숫자 문자열
 */
function formatNumber(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * DOM 요소 생성 헬퍼 함수
 * @param {string} tag - 요소의 태그명
 * @param {object} attrs - 요소 속성
 * @param {Array|string} children - 자식 요소 또는 텍스트
 * @returns {HTMLElement} 생성된 요소
 */
function createElement(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);
    
    // 속성 설정
    Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            const eventName = key.slice(2).toLowerCase();
            element.addEventListener(eventName, value);
        } else {
            element.setAttribute(key, value);
        }
    });
    
    // 자식 요소 추가
    if (typeof children === 'string') {
        element.textContent = children;
    } else if (Array.isArray(children)) {
        children.forEach(child => {
            if (child instanceof Node) {
                element.appendChild(child);
            } else if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            }
        });
    }
    
    return element;
}

/**
 * 문자열 비교를 위한 유사도 점수 계산 (레벤슈타인 거리 기반)
 * @param {string} s1 - 첫 번째 문자열
 * @param {string} s2 - 두 번째 문자열
 * @returns {number} 유사도 점수 (0-1, 1이 가장 유사)
 */
function similarityScore(s1, s2) {
    if (!s1 || !s2) return 0;
    
    const track = Array(s2.length + 1).fill(null).map(() => 
        Array(s1.length + 1).fill(null));
    
    for (let i = 0; i <= s1.length; i += 1) {
        track[0][i] = i;
    }
    
    for (let j = 0; j <= s2.length; j += 1) {
        track[j][0] = j;
    }
    
    for (let j = 1; j <= s2.length; j += 1) {
        for (let i = 1; i <= s1.length; i += 1) {
            const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
                track[j][i - 1] + 1, // deletion
                track[j - 1][i] + 1, // insertion
                track[j - 1][i - 1] + indicator, // substitution
            );
        }
    }
    
    // 레벤슈타인 거리를 0-1 사이 유사도 점수로 변환 (높을수록 유사)
    const distance = track[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    return maxLength > 0 ? 1 - distance / maxLength : 1;
}

// 유틸리티 객체로 내보내기
const Utils = {
    decomposeHangul,
    getChosung,
    engToKor,
    debounce,
    throttle,
    formatDate,
    formatNumber,
    createElement,
    similarityScore
};

export default Utils;
