const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// 설정
const CONFIG = {
  API_KEY: process.env.API_KEY,
  API_BASE_URL: 'https://open.api.nexon.com/mabinogi/v1/auction/list',
  API_DELAY_MS: 250, // 초당 4회 이하로 요청 (안전하게)
  MAX_RETRIES: 3,    // 최대 재시도 횟수
  MAX_ERRORS: 5,     // 연속 오류 최대 허용 수 (이 이상이면 중단)
  DATA_DIR: './data', // 데이터 저장 경로
  CONSECUTIVE_ERROR_THRESHOLD: 3 // 연속 오류 임계값
};

// 데이터 디렉토리 생성
fs.ensureDirSync(CONFIG.DATA_DIR);
fs.ensureDirSync(path.join(CONFIG.DATA_DIR, 'items'));
fs.ensureDirSync(path.join(CONFIG.DATA_DIR, 'meta'));
fs.ensureDirSync(path.join(CONFIG.DATA_DIR, 'meta/enchants'));
fs.ensureDirSync(path.join(CONFIG.DATA_DIR, 'meta/reforges'));
fs.ensureDirSync(path.join(CONFIG.DATA_DIR, 'meta/ecostones'));

// 글로벌 상태
const state = {
  apiCalls: 0,
  errors: 0,
  consecutiveErrors: 0,
  enchants: {
    prefix: {},
    suffix: {}
  },
  reforges: {},
  ecostones: {}
};

// 마비노기 API 카테고리 목록 (한글 이름으로 수정)
const categories = [
  // 근거리 무기
  { id: '검', name: '검', mainCategory: '근거리 장비' },
  { id: '둔기', name: '둔기', mainCategory: '근거리 장비' },
  { id: '랜스', name: '랜스', mainCategory: '근거리 장비' },
  { id: '도끼', name: '도끼', mainCategory: '근거리 장비' },
  { id: '너클', name: '너클', mainCategory: '근거리 장비' },
  { id: '석궁', name: '석궁', mainCategory: '원거리 장비' },
  { id: '활', name: '활', mainCategory: '원거리 장비' },
  { id: '듀얼건', name: '듀얼건', mainCategory: '원거리 장비' },
  { id: '수리검', name: '수리검', mainCategory: '원거리 장비' },
  { id: '실린더', name: '실린더', mainCategory: '마법 장비' },
  { id: '원드', name: '원드', mainCategory: '마법 장비' },
  { id: '스태프', name: '스태프', mainCategory: '마법 장비' },
  
  // 방어구
  { id: '경갑옷', name: '경갑옷', mainCategory: '갑옷' },
  { id: '중갑옷', name: '중갑옷', mainCategory: '갑옷' },
  { id: '로브', name: '로브', mainCategory: '방어 장비' },
  { id: '투구', name: '투구', mainCategory: '방어 장비' },
  { id: '장갑', name: '장갑', mainCategory: '방어 장비' },
  { id: '신발', name: '신발', mainCategory: '방어 장비' },
  { id: '방패', name: '방패', mainCategory: '방어 장비' },
  
  // 액세서리
  { id: '귀걸이', name: '귀걸이', mainCategory: '액세서리' },
  { id: '반지', name: '반지', mainCategory: '액세서리' },
  { id: '목걸이', name: '목걸이', mainCategory: '액세서리' },
  
  // 특수 장비
  { id: '에코스톤', name: '에코스톤', mainCategory: '특수 장비' },
  { id: '인챈트 스크롤', name: '인챈트 스크롤', mainCategory: '인챈트 용품' }
];

/**
 * API 호출 함수
 * @param {string} categoryId - 카테고리 ID
 * @param {string} cursor - 다음 페이지 커서
 * @param {number} retryCount - 재시도 횟수
 * @returns {Promise<Object>}
 */
async function callApi(categoryId, cursor = null, retryCount = 0) {
  try {
    // API 키 확인
    if (!CONFIG.API_KEY) {
      throw new Error('API 키가 설정되지 않았습니다. GitHub Secrets에 API_KEY를 설정하세요.');
    }
    
    // API 딜레이 적용
    await sleep(CONFIG.API_DELAY_MS);
    
    // URL 및 파라미터 설정
    const params = new URLSearchParams({
      auction_item_category: categoryId  // category에서 auction_item_category로 변경
    });
    
    if (cursor) {
      params.append('next_cursor', cursor);
    }
    
    // API 호출
    const url = `${CONFIG.API_BASE_URL}?${params.toString()}`;
    const response = await axios.get(url, {
      headers: {
        'accept': 'application/json',
        'x-nxopen-api-key': CONFIG.API_KEY
      },
      timeout: 10000 // 10초 타임아웃
    });
    
    // API 호출 카운트 증가
    state.apiCalls++;
    
    // 연속 오류 카운트 초기화
    state.consecutiveErrors = 0;
    
    return {
      items: response.data.auction_item || [],
      next_cursor: response.data.next_cursor
    };
  } catch (error) {
    // 오류 카운트 증가
    state.errors++;
    state.consecutiveErrors++;
    
    // 오류 정보 추출
    const status = error.response?.status;
    const errorCode = error.response?.data?.error?.name;
    const errorMessage = error.response?.data?.error?.message || error.message;
    
    console.error(`API 오류 [${categoryId}]: ${status} - ${errorCode} - ${errorMessage}`);
    
    // 연속 오류가 임계값 이상이면 중단할지 결정
    if (state.consecutiveErrors >= CONFIG.CONSECUTIVE_ERROR_THRESHOLD) {
      // 1. 유효하지 않은 파라미터 오류인 경우 (카테고리 ID 문제일 가능성 높음)
      if (errorCode === 'OPENAPI00004') {
        throw new Error(`치명적 오류: 카테고리 ID '${categoryId}'가 유효하지 않습니다. 마비노기 API 설명서를 확인하세요.`);
      }
      
      // 2. API 키 오류인 경우
      if (errorCode === 'OPENAPI00005') {
        throw new Error('치명적 오류: API 키가 유효하지 않습니다. API 키를 확인하세요.');
      }
      
      // 3. API 점검 중인 경우
      if (errorCode === 'OPENAPI00011') {
        throw new Error('API 점검 중입니다. 나중에 다시 시도하세요.');
      }
      
      // 4. 게임 점검 중인 경우
      if (errorCode === 'OPENAPI00010') {
        throw new Error('게임 점검 중입니다. 나중에 다시 시도하세요.');
      }
      
      // 5. API 호출량 초과한 경우
      if (errorCode === 'OPENAPI00007' || status === 429) {
        throw new Error('API 호출량 제한에 도달했습니다. 내일 다시 시도하세요.');
      }
      
      // 6. 서버 오류가 연속으로 발생하는 경우
      if (status >= 500) {
        throw new Error('서버 오류가 연속으로 발생하여 수집을 중단합니다.');
      }
    }
    
    // 재시도 허용 범위 내이면 재시도
    if (retryCount < CONFIG.MAX_RETRIES) {
      console.log(`재시도 중... (${retryCount + 1}/${CONFIG.MAX_RETRIES})`);
      // 지수 백오프 적용 (재시도마다 대기 시간 증가)
      const backoffDelay = CONFIG.API_DELAY_MS * Math.pow(2, retryCount);
      await sleep(backoffDelay);
      return callApi(categoryId, cursor, retryCount + 1);
    }
    
    // 기존 데이터 로드 시도
    try {
      const existingDataPath = path.join(CONFIG.DATA_DIR, 'items', `${categoryId}.json`);
      if (fs.existsSync(existingDataPath)) {
        console.log(`기존 데이터 사용: ${categoryId}`);
        const data = JSON.parse(fs.readFileSync(existingDataPath, 'utf8'));
        return {
          items: data.items || [],
          next_cursor: null,
          useExisting: true
        };
      }
    } catch (readError) {
      console.error('기존 데이터 읽기 실패:', readError.message);
    }
    
    // 모든 시도 실패
    return { items: [], next_cursor: null, error: true };
  }
}

/**
 * 단일 카테고리 아이템 수집
 * @param {Object} category - 카테고리 정보
 * @returns {Promise<Array>}
 */
async function collectCategoryItems(category) {
  console.log(`\n카테고리 수집 시작: ${category.name} (${category.id})`);
  
  try {
    let allItems = [];
    let nextCursor = null;
    let pageCount = 0;
    let useExistingData = false;
    
    // 최대 100페이지까지만 처리 (안전장치)
    const MAX_PAGES = 100;
    
    // 페이지 처리
    do {
      try {
        // API 호출
        const result = await callApi(category.id, nextCursor);
        
        // 기존 데이터 사용인 경우
        if (result.useExisting) {
          allItems = result.items;
          useExistingData = true;
          break;
        }
        
        // 아이템 추가
        if (result.items && result.items.length > 0) {
          allItems = allItems.concat(result.items);
        }
        
        // 다음 페이지 설정
        nextCursor = result.next_cursor;
        pageCount++;
        
        console.log(`  페이지 ${pageCount} 처리 완료: ${result.items?.length || 0}개 아이템, 현재 총 ${allItems.length}개`);
        
        // 최대 페이지 수 체크
        if (pageCount >= MAX_PAGES) {
          console.warn(`  최대 페이지 수(${MAX_PAGES})에 도달했습니다. 수집을 중단합니다.`);
          break;
        }
        
      } catch (error) {
        // 치명적 오류인 경우 상위로 전파
        if (error.message.startsWith('치명적 오류:')) {
          throw error;
        }
        
        console.error(`  페이지 로드 중 오류:`, error.message);
        break;
      }
    } while (nextCursor);
    
    if (useExistingData) {
      console.log(`  기존 데이터 사용: ${allItems.length}개 아이템`);
    } else {
      console.log(`  카테고리 ${category.id} 수집 완료: 총 ${allItems.length}개 아이템`);
    }
    
    // 결과 반환
    return allItems;
  } catch (error) {
    // 치명적 오류는 상위로 전파
    if (error.message.startsWith('치명적 오류:')) {
      throw error;
    }
    
    console.error(`  카테고리 ${category.id} 처리 중 오류:`, error.message);
    return [];
  }
}

/**
 * 아이템 옵션 처리
 * @param {Array} items - 아이템 목록
 * @param {string} categoryId - 카테고리 ID
 * @returns {Array} - 처리된 아이템 목록
 */
function processItems(items, categoryId) {
  return items.map(item => {
    // 기본 필드 추출
    const processed = {
      name: item.item_name,
      display_name: item.item_display_name,
      price: item.auction_price_per_unit,
      has_enchant: false,
      has_reforge: false,
      has_ecostone: false
    };
    
    // 옵션 처리
    if (item.item_option && Array.isArray(item.item_option)) {
      item.item_option.forEach(option => {
        // 인챈트 여부 확인 및 처리
        if (option.option_type === "인챈트") {
          processed.has_enchant = true;
          processEnchant(option);
        }
        
        // 세공 옵션 여부 확인 및 처리
        if (option.option_type === "세공 옵션") {
          processed.has_reforge = true;
          processReforge(option, categoryId);
        }
        
        // 에코스톤 여부 확인 및 처리
        if (option.option_type === "에코스톤 각성 능력") {
          processed.has_ecostone = true;
          processEcostone(option, item.item_name);
        }
      });
    }
    
    return processed;
  });
}

/**
 * 인챈트 정보 처리
 * @param {Object} option - 인챈트 옵션
 */
function processEnchant(option) {
  // 접두/접미 구분
  const isPrefix = option.option_sub_type === "접두";
  const collection = isPrefix ? state.enchants.prefix : state.enchants.suffix;
  
  // "오피서의 (랭크 5)" 형식에서 이름과 랭크 추출
  const matches = option.option_value.match(/^(.*?)\s*\(랭크\s*(\d+)\)$/);
  if (!matches) return;
  
  const enchantName = matches[1].trim();
  const rank = parseInt(matches[2]);
  
  // 인챈트 데이터 초기화
  if (!collection[enchantName]) {
    collection[enchantName] = {
      name: enchantName,
      rank: rank,
      effects: []
    };
  }
  
  // 효과 파싱 및 저장
  if (option.option_desc) {
    const effects = option.option_desc.split(',');
    
    effects.forEach(effect => {
      processEnchantEffect(collection[enchantName], effect.trim());
    });
  }
}

/**
 * 인챈트 효과 처리
 * @param {Object} enchant - 인챈트 정보
 * @param {string} effectText - 효과 텍스트
 */
function processEnchantEffect(enchant, effectText) {
  // 기존 효과 찾기
  const existingEffect = enchant.effects.find(e => e.text === effectText);
  
  if (!existingEffect) {
    // 새 효과 추가
    enchant.effects.push({ text: effectText });
    
    // 효과에서 숫자 값 추출 시도
    const numMatch = effectText.match(/(\d+)([%]?)\s*(?:증가|감소|회복)/);
    if (numMatch) {
      const value = parseInt(numMatch[1]);
      const isPercent = numMatch[2] === '%';
      
      const lastIndex = enchant.effects.length - 1;
      enchant.effects[lastIndex].value = value;
      enchant.effects[lastIndex].isPercent = isPercent;
      enchant.effects[lastIndex].min = value;
      enchant.effects[lastIndex].max = value;
    }
  } else {
    // 기존 효과 업데이트 (숫자 값이 있을 경우 범위 확장)
    if (existingEffect.value !== undefined) {
      const numMatch = effectText.match(/(\d+)([%]?)\s*(?:증가|감소|회복)/);
      if (numMatch) {
        const value = parseInt(numMatch[1]);
        
        if (value < existingEffect.min) existingEffect.min = value;
        if (value > existingEffect.max) existingEffect.max = value;
      }
    }
  }
}

/**
 * 세공 옵션 처리
 * @param {Object} option - 세공 옵션
 * @param {string} categoryId - 카테고리 ID
 */
function processReforge(option, categoryId) {
  // "아이스볼트 최소 대미지(10레벨:15.00 증가)" 형식에서 옵션 이름 추출
  const nameMatch = option.option_value.match(/^(.*?)\s*\(/);
  if (!nameMatch) return;
  
  const reforgeOptionName = nameMatch[1].trim();
  
  // 카테고리별 세공 옵션 저장
  const categoryType = categoryId.split('_')[0] || categoryId; // weapon, armor 등
  
  if (!state.reforges[categoryType]) {
    state.reforges[categoryType] = new Set();
  }
  
  state.reforges[categoryType].add(reforgeOptionName);
}

/**
 * 에코스톤 능력 처리
 * @param {Object} option - 에코스톤 옵션
 * @param {string} itemName - 아이템 이름
 */
function processEcostone(option, itemName) {
  // "마법 자동 방어 5 레벨" 형식에서 "마법 자동 방어" 부분 추출
  const abilityMatch = option.option_value.match(/^(.*?)\s+\d+\s+레벨$/);
  if (!abilityMatch) return;
  
  const abilityName = abilityMatch[1].trim();
  
  // 에코스톤 타입 추출 (블루 에코스톤 등)
  const ecostoneType = itemName.match(/^([\w가-힣]+)\s+에코스톤/)?.[1] || '기타';
  
  // 에코스톤 타입별 능력 저장
  if (!state.ecostones[ecostoneType]) {
    state.ecostones[ecostoneType] = new Set();
  }
  
  state.ecostones[ecostoneType].add(abilityName);
}

/**
 * 인챈트 데이터 저장
 * @param {string} type - 인챈트 타입 (prefix/suffix)
 * @param {Object} data - 인챈트 데이터
 */
function saveEnchantData(type, data) {
  const filePath = path.join(CONFIG.DATA_DIR, 'meta', 'enchants', `${type}.json`);
  
  // 기존 데이터 로드 (있으면)
  let existingData = {};
  try {
    if (fs.existsSync(filePath)) {
      existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (error) {
    console.warn(`기존 인챈트 데이터 로드 실패: ${error.message}`);
  }
  
  // 데이터 병합
  const mergedData = mergeEnchantData(existingData, data);
  
  // 저장
  fs.writeFileSync(filePath, JSON.stringify({
    updated: new Date().toISOString(),
    enchants: mergedData
  }, null, 2));
  
  console.log(`인챈트 데이터 저장 완료: ${type}`);
}

/**
 * 세공 데이터 저장
 * @param {Object} data - 세공 데이터
 */
function saveReforgeData(data) {
  const filePath = path.join(CONFIG.DATA_DIR, 'meta', 'reforges', 'reforges.json');
  
  // 기존 데이터 로드 (있으면)
  let existingData = {};
  try {
    if (fs.existsSync(filePath)) {
      existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'))?.reforges || {};
    }
  } catch (error) {
    console.warn(`기존 세공 데이터 로드 실패: ${error.message}`);
  }
  
  // 카테고리별로 병합
  const mergedData = {};
  
  // 모든 카테고리 처리
  const allCategories = new Set([
    ...Object.keys(existingData),
    ...Object.keys(data)
  ]);
  
  allCategories.forEach(category => {
    // 기존 값과 신규 값 합치기
    const existing = existingData[category] || [];
    const newValues = Array.from(data[category] || []);
    
    // 중복 제거하여 병합
    mergedData[category] = Array.from(new Set([...existing, ...newValues])).sort();
  });
  
  // 저장
  fs.writeFileSync(filePath, JSON.stringify({
    updated: new Date().toISOString(),
    reforges: mergedData
  }, null, 2));
  
  console.log(`세공 데이터 저장 완료`);
}

/**
 * 에코스톤 데이터 저장
 * @param {Object} data - 에코스톤 데이터
 */
function saveEcostoneData(data) {
  const filePath = path.join(CONFIG.DATA_DIR, 'meta', 'ecostones', 'abilities.json');
  
  // 기존 데이터 로드 (있으면)
  let existingData = {};
  try {
    if (fs.existsSync(filePath)) {
      existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'))?.ecostones || {};
    }
  } catch (error) {
    console.warn(`기존 에코스톤 데이터 로드 실패: ${error.message}`);
  }
  
  // 타입별로 병합
  const mergedData = {};
  
  // 모든 타입 처리
  const allTypes = new Set([
    ...Object.keys(existingData),
    ...Object.keys(data)
  ]);
  
  allTypes.forEach(type => {
    // 기존 값과 신규 값 합치기
    const existing = existingData[type] || [];
    const newValues = Array.from(data[type] || []);
    
    // 중복 제거하여 병합
    mergedData[type] = Array.from(new Set([...existing, ...newValues])).sort();
  });
  
  // 저장
  fs.writeFileSync(filePath, JSON.stringify({
    updated: new Date().toISOString(),
    ecostones: mergedData
  }, null, 2));
  
  console.log(`에코스톤 데이터 저장 완료`);
}

/**
 * 인챈트 데이터 병합
 * @param {Object} existing - 기존 데이터
 * @param {Object} newData - 새 데이터
 * @returns {Object} - 병합된 데이터
 */
function mergeEnchantData(existing, newData) {
  const result = { ...existing };
  
  // 새 데이터 반복
  for (const [enchantName, enchantData] of Object.entries(newData)) {
    // 기존 데이터에 없으면 추가
    if (!result[enchantName]) {
      result[enchantName] = { ...enchantData };
      continue;
    }
    
    // 랭크 업데이트
    if (enchantData.rank) {
      result[enchantName].rank = enchantData.rank;
    }
    
    // 효과 병합
    if (enchantData.effects && enchantData.effects.length > 0) {
      // 기존 효과가 없으면 초기화
      if (!result[enchantName].effects) {
        result[enchantName].effects = [];
      }
      
      // 새 효과 추가 또는 업데이트
      enchantData.effects.forEach(newEffect => {
        // 동일 효과 찾기
        const existingEffect = result[enchantName].effects.find(
          e => e.text === newEffect.text
        );
        
        if (!existingEffect) {
          // 새 효과 추가
          result[enchantName].effects.push({ ...newEffect });
        } else {
          // 범위 업데이트
          if (newEffect.min !== undefined && existingEffect.min !== undefined) {
            existingEffect.min = Math.min(existingEffect.min, newEffect.min);
          }
          
          if (newEffect.max !== undefined && existingEffect.max !== undefined) {
            existingEffect.max = Math.max(existingEffect.max, newEffect.max);
          }
        }
      });
    }
  }
  
  return result;
}

/**
 * 아이템 데이터 저장
 * @param {string} categoryId - 카테고리 ID
 * @param {Array} items - 아이템 목록
 */
function saveItemsData(categoryId, items) {
  const filePath = path.join(CONFIG.DATA_DIR, 'items', `${categoryId}.json`);
  
  const data = {
    updated: new Date().toISOString(),
    count: items.length,
    items: items
  };
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`아이템 데이터 저장 완료: ${categoryId} (${items.length}개)`);
}

/**
 * API 테스트
 * @returns {Promise<boolean>}
 */
async function testApi() {
  try {
    console.log('API 테스트 중...');
    
    // API 키 확인
    if (!CONFIG.API_KEY) {
      console.error('API 키가 설정되지 않았습니다.');
      return false;
    }
    
    // 테스트용 카테고리 (가장 기본적인 것)
    const testCategory = '검';
    
    // API 호출 테스트
    const result = await callApi(testCategory);
    
    if (result.items && result.items.length > 0) {
      console.log(`API 테스트 성공: ${result.items.length}개 아이템 수신됨`);
      return true;
    } else {
      console.error('API 테스트 실패: 아이템이 없습니다.');
      return false;
    }
  } catch (error) {
    console.error('API 테스트 실패:', error.message);
    return false;
  }
}

/**
 * 메인 함수
 */
async function main() {
  console.log('마비노기 경매장 데이터 수집 시작');
  console.log(`시작 시간: ${new Date().toISOString()}`);
  
  try {
    // API 테스트
    const apiTestResult = await testApi();
    if (!apiTestResult) {
      console.error('API 테스트 실패. 수집을 중단합니다.');
      process.exit(1);
    }
    
    // 카테고리별 처리
    for (const category of categories) {
      try {
        // 아이템 수집
        const items = await collectCategoryItems(category);
        
        // 데이터 처리
        const processedItems = processItems(items, category.id);
        
        // 아이템 데이터 저장
        saveItemsData(category.id, processedItems);
      } catch (error) {
        // 치명적 오류인 경우 전체 프로세스 중단
        if (error.message.startsWith('치명적 오류:')) {
          console.error('치명적 오류로 수집이 중단됩니다:', error.message);
          process.exit(1);
        }
        
        console.error(`카테고리 ${category.id} 처리 중 오류:`, error.message);
        // 다음 카테고리로 계속
      }
    }
    
    // 메타데이터 저장
    console.log('\n메타데이터 저장 중...');
    
    // 인챈트 데이터 저장
    saveEnchantData('prefix', state.enchants.prefix);
    saveEnchantData('suffix', state.enchants.suffix);
    
    // 세공 데이터 저장
    saveReforgeData(state.reforges);
    
    // 에코스톤 데이터 저장
    saveEcostoneData(state.ecostones);
    
    // 실행 통계
    console.log('\n=== 실행 통계 ===');
    console.log(`API 호출 횟수: ${state.apiCalls}`);
    console.log(`오류 횟수: ${state.errors}`);
    console.log(`종료 시간: ${new Date().toISOString()}`);
    console.log('데이터 수집 완료');
    
  } catch (error) {
    console.error('처리 중 치명적 오류:', error.message);
    process.exit(1);
  }
}

// 실행
main().catch(error => {
  console.error('예상치 못한 오류:', error);
  process.exit(1);
});
