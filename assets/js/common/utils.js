/**
 * 유틸리티 함수 모음
 */

// 한글 관련 상수
const HANGUL_START = 44032; // '가'의 유니코드
const HANGUL_END = 55203; // '힣'의 유니코드
const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const JUNGSUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JONGSUNG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

// 겹받침 매핑 테이블
const COMPOUND_JONGSUNG_MAP = {
  'ㄳ': ['ㄱ', 'ㅅ'],
  'ㄵ': ['ㄴ', 'ㅈ'],
  'ㄶ': ['ㄴ', 'ㅎ'],
  'ㄺ': ['ㄹ', 'ㄱ'],
  'ㄻ': ['ㄹ', 'ㅁ'],
  'ㄼ': ['ㄹ', 'ㅂ'],
  'ㄽ': ['ㄹ', 'ㅅ'],
  'ㄾ': ['ㄹ', 'ㅌ'],
  'ㄿ': ['ㄹ', 'ㅍ'],
  'ㅀ': ['ㄹ', 'ㅎ'],
  'ㅄ': ['ㅂ', 'ㅅ']
};

// 겹모음 매핑 테이블 (단모음에서 가능한 겹모음 목록)
const COMPOUND_JUNGSUNG_MAP = {
  'ㅗ': ['ㅘ', 'ㅙ', 'ㅚ'],
  'ㅜ': ['ㅝ', 'ㅞ', 'ㅟ'],
  'ㅡ': ['ㅢ']
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
    if (!str) return '';
    
    if (typeof str === 'string') {
        return str.split('').map(char => {
            const charCode = char.charCodeAt(0);
            if (charCode >= HANGUL_START && charCode <= HANGUL_END) {
                const chosungIndex = Math.floor((charCode - HANGUL_START) / (21 * 28));
                return CHOSUNG[chosungIndex];
            } else if (CHOSUNG.includes(char)) {
                // 이미 초성인 경우 그대로 반환
                return char;
            } else {
                return char; // 한글이 아니면 그대로 반환
            }
        }).join('');
    }
    
    return ''; // 문자열이 아닌 경우 빈 문자열 반환
}

/**
 * 한글 글자에서 중성(모음) 추출
 * @param {string} char - 분석할 한글 문자
 * @returns {string|null} 추출된 중성(모음)
 */
function getJungsung(char) {
  if (!char) return null;
  
  const code = char.charCodeAt(0);
  
  // 완성형 한글이 아닌 경우
  if (code < HANGUL_START || code > HANGUL_END) {
    return null;
  }
  
  // 한글 분해
  const charIndex = code - HANGUL_START;
  const jungsungIndex = Math.floor((charIndex % (21 * 28)) / 28);
  
  return JUNGSUNG[jungsungIndex];
}

/**
 * 단모음에서 가능한 겹모음 목록 반환
 * @param {string} jungsung - 단모음
 * @returns {Array} 가능한 겹모음 목록
 */
function getCompoundJungsung(jungsung) {
  return COMPOUND_JUNGSUNG_MAP[jungsung] || [];
}

/**
 * 한글 마지막 글자 분석 함수
 * @param {string} char - 분석할 한글 문자
 * @returns {Object} 분석 결과
 */
function analyzeHangulChar(char) {
  if (!char) return { type: 'none' };
  
  const code = char.charCodeAt(0);
  
  // 초성만 있는 경우 (ㄱ~ㅎ)
  if (code >= 0x3131 && code <= 0x314E) {
    return { 
      type: 'chosung',
      chosung: char
    };
  }
  
  // 완성형 한글이 아닌 경우
  if (code < HANGUL_START || code > HANGUL_END) {
    return { type: 'other', char: char };
  }
  
  // 한글 분해
  const charIndex = code - HANGUL_START;
  const chosungIndex = Math.floor(charIndex / (21 * 28));
  const jungsungIndex = Math.floor((charIndex % (21 * 28)) / 28);
  const jongsungIndex = charIndex % 28;
  
  const chosung = CHOSUNG[chosungIndex];
  const jungsung = JUNGSUNG[jungsungIndex];
  const jongsung = jongsungIndex > 0 ? JONGSUNG[jongsungIndex] : '';
  
  // 받침 없는 경우
  if (jongsungIndex === 0) {
    return {
      type: 'syllable_no_jongsung',
      chosung: chosung,
      jungsung: jungsung,
      syllable: char
    };
  }
  
  // 겹받침인지 확인
  const isCompoundJongsung = COMPOUND_JONGSUNG_MAP[jongsung] !== undefined;
  
  // 겹받침인 경우
  if (isCompoundJongsung) {
    const [firstJong, secondJong] = COMPOUND_JONGSUNG_MAP[jongsung];
    
    // 앞 글자만 있는 상태로 복원
    const syllableWithFirstJong = String.fromCharCode(
      HANGUL_START + 
      chosungIndex * 21 * 28 + 
      jungsungIndex * 28 + 
      JONGSUNG.indexOf(firstJong)
    );
    
    return {
      type: 'syllable_compound_jongsung',
      chosung: chosung,
      jungsung: jungsung,
      jongsung: jongsung,
      firstJongsung: firstJong,
      secondJongsung: secondJong,
      syllable: char,
      syllableWithFirstJong: syllableWithFirstJong,
      nextChosung: secondJong
    };
  }
  
  // 일반 받침인 경우
  // 받침을 제거한 상태로 복원
  const syllableWithoutJongsung = String.fromCharCode(
    HANGUL_START + 
    chosungIndex * 21 * 28 + 
    jungsungIndex * 28
  );
  
  return {
    type: 'syllable_with_jongsung',
    chosung: chosung,
    jungsung: jungsung,
    jongsung: jongsung,
    syllable: char,
    syllableWithoutJongsung: syllableWithoutJongsung,
    nextChosung: jongsung
  };
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
 * 한글 문자가 완성형인지 검사
 * @param {string} char - 검사할 문자
 * @returns {boolean} 완성형 한글 여부
 */
function isCompleteHangul(char) {
  const code = char.charCodeAt(0);
  return code >= HANGUL_START && code <= HANGUL_END;
}

/**
 * 한글 관련 문자열 유사도를 보다 정확히 계산
 * @param {string} str1 - 첫 번째 문자열
 * @param {string} str2 - 두 번째 문자열
 * @returns {number} 유사도 점수 (0-1)
 */
function hangulSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const normalized1 = str1.toLowerCase();
    const normalized2 = str2.toLowerCase();
    
    // 초성 추출
    const chosung1 = getChosung(normalized1);
    const chosung2 = getChosung(normalized2);
    
    // 자음/모음 분해
    const decomposed1 = decomposeHangul(normalized1);
    const decomposed2 = decomposeHangul(normalized2);
    
    // 1. 시작 부분 일치 확인 (높은 가중치)
    if (normalized2.startsWith(normalized1)) {
        return 1.0;
    }
    
    // 2. 초성 시작 부분 일치 (중간 가중치)
    if (chosung2.startsWith(chosung1)) {
        return 0.8;
    }
    
    // 3. 자모 분해 후 시작 부분 일치 (낮은 가중치)
    if (decomposed2.startsWith(decomposed1)) {
        return 0.7;
    }
    
    // 4. 포함 관계 확인 (더 낮은 가중치)
    if (normalized2.includes(normalized1)) {
        return 0.6;
    }
    
    // 5. 초성 포함 관계
    if (chosung2.includes(chosung1)) {
        return 0.5;
    }
    
    return 0;
}

/**
 * 한글 입력 분석 함수
 * @param {string} searchTerm - 검색어
 * @returns {Object} 분석 결과
 */
function analyzeHangulInput(searchTerm) {
  if (!searchTerm) return { isTyping: false, searchBase: '', lastChar: '', isLastCharJamo: false, isLastCharComplete: false };
  
  // 마지막 문자와 이전 부분 분리
  const lastChar = searchTerm[searchTerm.length - 1];
  const lastCharCode = lastChar.charCodeAt(0);
  const searchBase = searchTerm.slice(0, -1);
  
  // 자음/모음 범위 확인 (ㄱ~ㅣ)
  const isJamo = lastCharCode >= 0x3131 && lastCharCode <= 0x3163;
  
  // 완성형 한글 확인 (가~힣)
  const isComplete = lastCharCode >= HANGUL_START && lastCharCode <= HANGUL_END;
  
  return {
    isTyping: isJamo,
    lastChar,
    searchBase,
    isLastCharJamo: isJamo,
    isLastCharComplete: isComplete
  };
}

/**
 * 띄어쓰기를 제거한 문자열 반환
 * @param {string} str - 원본 문자열
 * @returns {string} 띄어쓰기 제거된 문자열
 */
function removeSpaces(str) {
  if (!str) return '';
  return str.replace(/\s+/g, '');
}

/**
 * 문자열이 모두 한글 초성인지 확인
 * @param {string} str - 확인할 문자열
 * @returns {boolean} 모두 초성인지 여부
 */
function isAllChosung(str) {
  if (!str || str.length === 0) return false;
  
  // 한글 초성 목록
  for (let i = 0; i < str.length; i++) {
    if (!CHOSUNG.includes(str[i])) {
      return false;
    }
  }
  
  return true;
}

/**
 * 두 문자열의 자모 레벨 유사도 계산
 * @param {string} searchTerm - 검색어
 * @param {string} targetStr - 대상 문자열
 * @returns {number} 유사도 점수 (0-100)
 */
function jamoSimilarity(searchTerm, targetStr) {
  if (!searchTerm || !targetStr) return 0;
  
  const searchChosung = getChosung(searchTerm);
  const targetChosung = getChosung(targetStr);
  
  // 초성 일치 여부 확인
  if (targetChosung.startsWith(searchChosung)) {
    return 70;
  } else if (targetChosung.includes(searchChosung)) {
    return 50;
  }
  
  return 0;
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
    getJungsung,
    getCompoundJungsung,
    analyzeHangulChar,
    debounce,
    throttle,
    formatDate,
    formatNumber,
    createElement,
    similarityScore,
    isCompleteHangul,
    analyzeHangulInput,
    removeSpaces,
    jamoSimilarity,
    isAllChosung,
    COMPOUND_JONGSUNG_MAP,
    COMPOUND_JUNGSUNG_MAP
};

export default Utils;
