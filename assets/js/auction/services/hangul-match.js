/**
 * 초성 자모 인식 문자열 매칭 엔진
 * 검색 자동완성과 필터 자동완성에서 공통 사용
 */

import Utils from './utils.js';

const MIN_SCORE = 40;

// 정규화한 텍스트 기준 초성 캐시 (키가 텍스트 자체라 여러 데이터 소스가 공유해도 안전)
const chosungCache = new Map();

function getCachedChosung(text) {
    let value = chosungCache.get(text);
    if (value === undefined) {
        value = Utils.getChosung(text);
        chosungCache.set(text, value);
    }
    return value;
}

function defaultGetText(candidate) {
    if (typeof candidate === 'string') return candidate;
    return (candidate && candidate.name) || '';
}

/**
 * 문자열이 다른 문자열의 서브시퀀스인지 확인
 */
function isSubsequence(sub, main) {
    if (!sub || !main) return false;
    if (sub.length > main.length) return false;

    let j = 0;
    for (let i = 0; i < main.length && j < sub.length; i++) {
        if (sub[j] === main[i]) {
            j++;
        }
    }

    return j === sub.length;
}

/**
 * 서브시퀀스 매칭 점수 계산
 */
function calculateSubsequenceScore(sub, main) {
    if (!isSubsequence(sub, main)) return 0;

    let score = 45;

    let maxConsecutive = 0;
    let currentConsecutive = 0;
    let j = 0;

    for (let i = 0; i < main.length && j < sub.length; i++) {
        if (main[i] === sub[j]) {
            currentConsecutive++;
            j++;
            maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
        } else {
            currentConsecutive = 0;
        }
    }

    score += Math.min(maxConsecutive * 3, 15);

    if (main.startsWith(sub[0])) {
        score += 5;
    }

    const mainLength = main.length;
    const subLength = sub.length;
    const gapPenalty = Math.max(0, mainLength - subLength - 2);
    score -= Math.min(gapPenalty * 1.5, 15);

    return Math.max(MIN_SCORE, score);
}

/**
 * 비연속 순차 경로 탐색
 */
function hasValidSequence(positionsArray) {
    if (!positionsArray || positionsArray.length === 0) return false;

    function findPath(level, lastPosition) {
        if (level === positionsArray.length) {
            return true;
        }

        const currentPositions = positionsArray[level];

        for (const currentPosition of currentPositions) {
            if (currentPosition > lastPosition) {
                if (findPath(level + 1, currentPosition)) {
                    return true;
                }
            }
        }

        return false;
    }

    return findPath(0, -1);
}

/**
 * 연속되지 않은 글자 순차적 검색
 * @param {string} term - 검색어
 * @param {string} itemName - 대상 문자열
 * @returns {number} 매칭 점수
 */
function checkSequentialMatch(term, itemName) {
    if (!term || !itemName) return 0;

    const noSpaceItemName = Utils.removeSpaces(itemName);

    const lastChar = term[term.length - 1];
    const prefix = term.slice(0, -1);
    const lastCharAnalysis = Utils.analyzeHangulChar(lastChar);

    if (noSpaceItemName.includes(term)) {
        return noSpaceItemName.startsWith(term) ? 98 : 90;
    }

    const charPositions = [];

    for (let i = 0; i < prefix.length; i++) {
        const prefixChar = prefix[i];
        const positions = [];

        if (Utils.isAllChosung(prefixChar)) {
            for (let j = 0; j < noSpaceItemName.length; j++) {
                if (Utils.getChosung(noSpaceItemName[j]) === prefixChar) {
                    positions.push(j);
                }
            }
        } else {
            let pos = -1;
            while ((pos = noSpaceItemName.indexOf(prefixChar, pos + 1)) !== -1) {
                positions.push(pos);
            }
        }

        if (positions.length === 0) {
            return 0;
        }

        charPositions.push(positions);
    }

    const lastCharPositions = [];

    if (lastCharAnalysis.type === 'chosung') {
        for (let j = 0; j < noSpaceItemName.length; j++) {
            if (Utils.getChosung(noSpaceItemName[j]) === lastChar) {
                lastCharPositions.push({ pos: j, type: 'chosung', weight: 1.0 });
            }
        }
    }
    else if (lastCharAnalysis.type === 'syllable_no_jongsung') {
        let pos = -1;
        while ((pos = noSpaceItemName.indexOf(lastChar, pos + 1)) !== -1) {
            lastCharPositions.push({ pos: pos, type: 'exact', weight: 1.0 });
        }

        for (let j = 0; j < noSpaceItemName.length; j++) {
            const itemChar = noSpaceItemName[j];
            const itemCharAnalysis = Utils.analyzeHangulChar(itemChar);

            if (itemCharAnalysis.type.includes('syllable') &&
                itemCharAnalysis.chosung === lastCharAnalysis.chosung &&
                itemCharAnalysis.jungsung === lastCharAnalysis.jungsung &&
                itemCharAnalysis.jongsung) {

                lastCharPositions.push({ pos: j, type: 'partial_with_batchim', weight: 0.9 });
            }
        }

        if (Utils.getCompoundJungsung(lastCharAnalysis.jungsung).length > 0) {
            const possibleCompoundJungsung = Utils.getCompoundJungsung(lastCharAnalysis.jungsung);

            for (let j = 0; j < noSpaceItemName.length; j++) {
                const itemChar = noSpaceItemName[j];
                const itemCharAnalysis = Utils.analyzeHangulChar(itemChar);

                if (itemCharAnalysis.type.includes('syllable') &&
                    itemCharAnalysis.chosung === lastCharAnalysis.chosung &&
                    possibleCompoundJungsung.includes(itemCharAnalysis.jungsung)) {

                    lastCharPositions.push({ pos: j, type: 'compound_vowel', weight: 0.8 });
                }
            }
        }
    }
    else if (lastCharAnalysis.type === 'syllable_with_jongsung') {
        let pos = -1;
        while ((pos = noSpaceItemName.indexOf(lastChar, pos + 1)) !== -1) {
            lastCharPositions.push({ pos: pos, type: 'exact', weight: 1.0 });
        }

        const baseChar = lastCharAnalysis.syllableWithoutJongsung;
        const jongsung = lastCharAnalysis.jongsung;

        let basePos = -1;
        while ((basePos = itemName.indexOf(baseChar, basePos + 1)) !== -1) {
            let found = false;

            if (basePos + 1 < itemName.length) {
                const nextChar = itemName[basePos + 1];
                const nextCharChosung = Utils.getChosung(nextChar);

                if (nextCharChosung === jongsung) {
                    lastCharPositions.push({ pos: basePos, type: 'split_adjacent', weight: 0.9 });
                    found = true;
                }
            }

            if (!found) {
                for (let afterPos = basePos + 1; afterPos < itemName.length; afterPos++) {
                    const afterChar = itemName[afterPos];
                    const afterChosung = Utils.getChosung(afterChar);

                    if (afterChosung === jongsung) {
                        lastCharPositions.push({ pos: basePos, type: 'split_distant', weight: 0.8 });
                        break;
                    }
                }
            }
        }
    }
    else if (lastCharAnalysis.type === 'syllable_compound_jongsung') {
        let pos = -1;
        while ((pos = noSpaceItemName.indexOf(lastChar, pos + 1)) !== -1) {
            lastCharPositions.push({ pos: pos, type: 'exact', weight: 1.0 });
        }

        const baseChar = lastCharAnalysis.syllableWithFirstJong;
        const secondJongsung = lastCharAnalysis.secondJongsung;

        let basePos = -1;
        while ((basePos = noSpaceItemName.indexOf(baseChar, basePos + 1)) !== -1) {
            let found = false;

            if (basePos + 1 < noSpaceItemName.length) {
                const nextChar = noSpaceItemName[basePos + 1];
                const nextCharChosung = Utils.getChosung(nextChar);

                if (nextCharChosung === secondJongsung) {
                    lastCharPositions.push({ pos: basePos, type: 'compound_split_adjacent', weight: 0.9 });
                    found = true;
                }
            }

            if (!found) {
                for (let afterPos = basePos + 1; afterPos < noSpaceItemName.length; afterPos++) {
                    const afterChar = noSpaceItemName[afterPos];
                    const afterChosung = Utils.getChosung(afterChar);

                    if (afterChosung === secondJongsung) {
                        lastCharPositions.push({ pos: basePos, type: 'compound_split_distant', weight: 0.8 });
                        break;
                    }
                }
            }
        }
    }
    else {
        let pos = -1;
        while ((pos = noSpaceItemName.indexOf(lastChar, pos + 1)) !== -1) {
            lastCharPositions.push({ pos: pos, type: 'regular', weight: 1.0 });
        }
    }

    if (lastCharPositions.length === 0) {
        return 0;
    }

    const lastPosArray = lastCharPositions.map(item => item.pos);
    charPositions.push(lastPosArray);

    if (hasValidSequence(charPositions)) {
        let matchBonus = 0;

        const highestWeight = Math.max(...lastCharPositions.map(p => p.weight));
        matchBonus += highestWeight * 10;

        if (charPositions[0].includes(0)) {
            matchBonus += 5;
        }

        return Math.min(85, 65 + matchBonus);
    }

    return 0;
}

/**
 * 초성 전용 다중 글자 검색 처리
 */
function matchChosungMulti(chosungTerm, candidates, getText, matchedItems) {
    for (const candidate of candidates) {
        const text = getText(candidate);
        if (!text) continue;

        const itemName = text.toLowerCase();
        const noSpaceItemName = Utils.removeSpaces(itemName);
        const itemChosung = getCachedChosung(noSpaceItemName);

        let score = 0;

        if (itemChosung === chosungTerm) {
            score = 100;
        } else if (itemChosung.startsWith(chosungTerm)) {
            score = 95;
        } else if (itemChosung.includes(chosungTerm)) {
            score = 80;
        } else if (isSubsequence(chosungTerm, itemChosung)) {
            const subsequenceScore = calculateSubsequenceScore(chosungTerm, itemChosung);
            score = Math.max(score, subsequenceScore);
        } else if (itemName.includes(' ')) {
            const words = itemName.split(' ');
            const wordChosungs = words.map(word => Utils.getChosung(Utils.removeSpaces(word)));

            const combinedWordInitials = wordChosungs.map(chosung => chosung.charAt(0)).join('');

            if (combinedWordInitials.includes(chosungTerm)) {
                score = 60;
            } else {
                for (const wordChosung of wordChosungs) {
                    if (wordChosung.includes(chosungTerm)) {
                        score = 55;
                        break;
                    }
                }

                if (score < MIN_SCORE) {
                    const allWordChosungs = wordChosungs.join('');
                    if (isSubsequence(chosungTerm, allWordChosungs)) {
                        score = 50;
                    }
                }
            }
        }

        if (score >= MIN_SCORE) {
            matchedItems.push({ item: candidate, text, score });
        }
    }
}

/**
 * 초성 검색 처리
 */
function matchChosung(chosung, candidates, getText, matchedItems) {
    const processedChosung = chosung.split('').map(char => {
        if (Utils.COMPOUND_JONGSUNG_MAP[char]) {
            return Utils.COMPOUND_JONGSUNG_MAP[char].join('');
        }
        return char;
    }).join('');

    for (const candidate of candidates) {
        const text = getText(candidate);
        if (!text) continue;

        const itemLower = text.toLowerCase();
        const noSpaceItemText = Utils.removeSpaces(itemLower);
        const itemChosung = getCachedChosung(noSpaceItemText);

        let score = 0;

        if (itemChosung.startsWith(processedChosung)) {
            score = 95;
        } else if (itemChosung.includes(processedChosung)) {
            score = 70;
        } else if (processedChosung.length > chosung.length && itemChosung.includes(processedChosung)) {
            score = 65;
        }

        if (score >= MIN_SCORE) {
            matchedItems.push({ item: candidate, text, score });
        }
    }
}

/**
 * 받침 없는 완성형 한글 검색 처리
 */
function matchSyllableNoJongsung(char, analysis, candidates, getText, matchedItems) {
    for (const candidate of candidates) {
        const text = getText(candidate);
        if (!text) continue;

        const itemLower = text.toLowerCase();
        const noSpaceItemText = Utils.removeSpaces(itemLower);
        let score = 0;

        if (noSpaceItemText.includes(char)) {
            score = noSpaceItemText.startsWith(char) ? 95 : 75;
        }

        // 같은 초성과 중성이지만 받침이 있는 경우
        if (score < 70) {
            for (let i = 0; i < noSpaceItemText.length; i++) {
                const itemChar = noSpaceItemText[i];
                const itemAnalysis = Utils.analyzeHangulChar(itemChar);

                if (itemAnalysis.type.includes('syllable') &&
                    itemAnalysis.chosung === analysis.chosung &&
                    itemAnalysis.jungsung === analysis.jungsung &&
                    itemAnalysis.jongsung) {

                    score = i === 0 ? 68 : 65;
                    break;
                }
            }
        }

        // 겹모음 확인
        if (score < 65 && Utils.getCompoundJungsung(analysis.jungsung).length > 0) {
            const possibleCompoundJungsung = Utils.getCompoundJungsung(analysis.jungsung);

            for (let i = 0; i < noSpaceItemText.length; i++) {
                const itemChar = noSpaceItemText[i];
                const itemCharAnalysis = Utils.analyzeHangulChar(itemChar);

                if (itemCharAnalysis.type.includes('syllable') &&
                    itemCharAnalysis.chosung === analysis.chosung &&
                    possibleCompoundJungsung.includes(itemCharAnalysis.jungsung)) {

                    score = i === 0 ? 60 : 55;
                    break;
                }
            }
        }

        if (score >= MIN_SCORE) {
            matchedItems.push({ item: candidate, text, score });
        }
    }
}

/**
 * 받침 있는 완성형 한글 검색 처리
 */
function matchSyllableWithJongsung(char, analysis, candidates, getText, matchedItems) {
    for (const candidate of candidates) {
        const text = getText(candidate);
        if (!text) continue;

        const itemLower = text.toLowerCase();
        const noSpaceItemText = Utils.removeSpaces(itemLower);
        let score = 0;

        if (noSpaceItemText.includes(char)) {
            if (noSpaceItemText.startsWith(char) || itemLower.includes(' ' + char)) {
                score = 95;
            } else {
                score = 75;
            }
        }

        // 받침 없는 글자 뒤에 받침 소리 오는 패턴 검색 (띄어쓰기 허용)
        if (score < 70) {
            const baseChar = analysis.syllableWithoutJongsung;
            const jongsung = analysis.jongsung;

            for (let i = 0; i < itemLower.length - 1; i++) {
                if (itemLower[i] === baseChar) {
                    if (i + 1 < itemLower.length) {
                        const nextChar = itemLower[i + 1];
                        const nextCharChosung = Utils.getChosung(nextChar);

                        if (nextCharChosung === jongsung) {
                            if (i === 0 || itemLower[i - 1] === ' ') {
                                score = Math.max(score, 70);
                            } else {
                                score = Math.max(score, 65);
                            }
                        }
                    }

                    const spaceAfterBasePos = itemLower.indexOf(' ', i);
                    if (spaceAfterBasePos !== -1 && spaceAfterBasePos + 1 < itemLower.length) {
                        const afterSpaceChar = itemLower[spaceAfterBasePos + 1];
                        const afterSpaceChosung = Utils.getChosung(afterSpaceChar);

                        if (afterSpaceChosung === jongsung) {
                            score = Math.max(score, 60);
                        }
                    }
                }
            }
        }

        if (score >= MIN_SCORE) {
            matchedItems.push({ item: candidate, text, score });
        }
    }
}

/**
 * 겹받침 한글 검색 처리
 */
function matchCompoundJongsung(char, analysis, candidates, getText, matchedItems) {
    for (const candidate of candidates) {
        const text = getText(candidate);
        if (!text) continue;

        const itemLower = text.toLowerCase();
        const noSpaceItemText = Utils.removeSpaces(itemLower);
        let score = 0;

        if (noSpaceItemText.includes(char)) {
            score = noSpaceItemText.startsWith(char) ? 95 : 75;
        }

        // 첫 받침까지 글자 뒤에 두 번째 받침 소리 오는 패턴 검색
        if (score < 70) {
            const baseChar = analysis.syllableWithFirstJong;
            const secondJongsung = analysis.secondJongsung;

            for (let i = 0; i < noSpaceItemText.length - 1; i++) {
                if (noSpaceItemText[i] === baseChar) {
                    const nextChar = noSpaceItemText[i + 1];
                    const nextCharChosung = Utils.getChosung(nextChar);

                    if (nextCharChosung === secondJongsung) {
                        score = i === 0 ? 70 : 65;
                        break;
                    }
                }
            }
        }

        if (score >= MIN_SCORE) {
            matchedItems.push({ item: candidate, text, score });
        }
    }
}

/**
 * 일반 문자 검색 처리
 */
function matchBasicChar(char, candidates, getText, matchedItems) {
    for (const candidate of candidates) {
        const text = getText(candidate);
        if (!text) continue;

        const itemLower = text.toLowerCase();
        const noSpaceItemText = Utils.removeSpaces(itemLower);
        let score = 0;

        if (noSpaceItemText.includes(char)) {
            score = noSpaceItemText.startsWith(char) ? 95 : 70;
        }

        if (score >= MIN_SCORE) {
            matchedItems.push({ item: candidate, text, score });
        }
    }
}

/**
 * 단일 글자 검색 처리
 */
function matchSingleChar(char, candidates, getText, matchedItems) {
    const charAnalysis = Utils.analyzeHangulChar(char);

    if (charAnalysis.type === 'chosung') {
        matchChosung(char, candidates, getText, matchedItems);
        return;
    }

    if (charAnalysis.type.includes('syllable')) {
        if (charAnalysis.type === 'syllable_no_jongsung') {
            matchSyllableNoJongsung(char, charAnalysis, candidates, getText, matchedItems);
            return;
        }
        if (charAnalysis.type === 'syllable_with_jongsung') {
            matchSyllableWithJongsung(char, charAnalysis, candidates, getText, matchedItems);
            return;
        }
        if (charAnalysis.type === 'syllable_compound_jongsung') {
            matchCompoundJongsung(char, charAnalysis, candidates, getText, matchedItems);
            return;
        }
    }

    matchBasicChar(char, candidates, getText, matchedItems);
}

/**
 * 다중 글자 검색 처리
 */
function matchMultiChar(term, candidates, getText, matchedItems) {
    if (!term) return; // 빈 문자열은 전체 후보와 매칭되므로 제외

    for (const candidate of candidates) {
        const text = getText(candidate);
        if (!text) continue;

        const itemText = text;
        const itemLower = itemText.toLowerCase();
        const noSpaceItemText = Utils.removeSpaces(itemLower);
        let score = 0;

        if (noSpaceItemText.includes(term)) {
            score = noSpaceItemText.startsWith(term) ? 98 : 90;
        }

        if (score < 60) {
            const sequentialMatchScore = checkSequentialMatch(term, itemLower);
            if (sequentialMatchScore > 0) {
                score = Math.max(score, sequentialMatchScore);
            }
        }

        if (score >= MIN_SCORE) {
            matchedItems.push({ item: candidate, text: itemText, score });
        }
    }
}

/**
 * 검색어 후보 배열 초성 자모 인식 매칭 채점
 * @param {string} query - 검색어
 * @param {Array} candidates - 문자열 배열 또는 getText로 텍스트를 뽑을 수 있는 임의 객체 배열
 * @param {Object} [options]
 * @param {Function} [options.getText] - candidate -> 매칭 대상 문자열 (기본: 문자열 그대로 또는 candidate.name)
 * @returns {Array<{item:*, text:string, score:number}>}
 */
function match(query, candidates, options = {}) {
    if (!query || !Array.isArray(candidates) || candidates.length === 0) {
        return [];
    }

    const getText = options.getText || defaultGetText;

    const normalizedTerm = query.toLowerCase();
    const noSpaceTerm = Utils.removeSpaces(normalizedTerm);
    if (!noSpaceTerm) return [];

    const matchedItems = [];

    const isAllChosung = Utils.isAllChosung(noSpaceTerm);
    let termToProcess = noSpaceTerm;

    // 겹자음 초성이 포함된 경우 이를 분해하여 처리
    const hasCompoundConsonant = [...termToProcess].some(char => Utils.COMPOUND_JONGSUNG_MAP[char]);

    if (hasCompoundConsonant) {
        termToProcess = [...termToProcess].map(char => {
            return Utils.COMPOUND_JONGSUNG_MAP[char] ? Utils.COMPOUND_JONGSUNG_MAP[char].join('') : char;
        }).join('');
    }

    if (isAllChosung || hasCompoundConsonant) {
        matchChosungMulti(termToProcess, candidates, getText, matchedItems);
    } else if (noSpaceTerm.length === 1) {
        matchSingleChar(noSpaceTerm, candidates, getText, matchedItems);
    } else {
        matchMultiChar(noSpaceTerm, candidates, getText, matchedItems);
    }

    return matchedItems;
}

/**
 * 매칭 결과 중복 제거와 정렬
 * @param {Array<{item:*, text:string, score:number}>} matches
 * @param {Object} [options]
 * @param {Function} [options.key] - 중복 판단 키 함수 (기본: text)
 * @param {Function} [options.comparator] - 정렬 비교 함수 (기본: 점수 내림차순 -> 텍스트 길이 오름차순)
 * @returns {Array<{item:*, text:string, score:number}>}
 */
function rank(matches, options = {}) {
    const key = options.key || (entry => entry.text);
    const comparator = options.comparator || ((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.text || '').length - (b.text || '').length;
    });

    const uniqueItems = new Map();
    matches.forEach(entry => {
        const k = key(entry);
        if (!uniqueItems.has(k) || uniqueItems.get(k).score < entry.score) {
            uniqueItems.set(k, entry);
        }
    });

    return Array.from(uniqueItems.values()).sort(comparator);
}

export default {
    match,
    rank,
    MIN_SCORE
};
