/**
 * 인챈트 효과 텍스트 파싱
 */
function parseEnchantEffect(effectText) {
  let result = {
    template: effectText,
    min: null,
    max: null,
    variable: false
  };
  
  // 조건문이 있으면 "때" 이후의 텍스트만 사용
  let effectPart = effectText;
  const conditionMatch = effectText.match(/때\s+/);
  
  if (conditionMatch) {
    effectPart = effectText.substring(conditionMatch.index + conditionMatch[0].length);
  }
  
  // 증가/감소 패턴 확인
  if (/(증가|감소)$/.test(effectPart)) {
    const valueMatch = effectPart.match(/(\d+(?:\.\d+)?%?)\s*(증가|감소)$/);
    
    if (valueMatch) {
      const valueStr = valueMatch[1];
      const action = valueMatch[2];
      const value = parseFloat(valueStr.replace('%', ''));
      const isPercent = valueStr.includes('%');
      
      const valuePlaceholder = '{value}' + (isPercent ? '%' : '');
      const escapedValueStr = valueStr.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
      
      result.template = effectPart.replace(
        new RegExp(`${escapedValueStr}\\s*${action}$`),
        `${valuePlaceholder} ${action}`
      );
      
      result.min = value;
      result.max = value;
    }
  } else {
    result.template = effectPart;
  }
  
  return result;
}

/**
 * 인챈트 이름과 랭크 파싱
 */
function parseEnchantNameAndRank(enchantStr) {
  const rankPattern = /\(랭크 (\d+)\)$/;
  const rankMatch = enchantStr.match(rankPattern);
  
  let rank = null;
  let name = enchantStr;
  
  if (rankMatch) {
    rank = parseInt(rankMatch[1]);
    name = enchantStr.replace(rankPattern, '').trim();
  }
  
  return { name, rank };
}

/**
 * 인챈트 메타데이터 수집
 */
async function collectEnchantMetadata(itemsData, enchantType) {
  // 데이터 유효성 검사
  if (!Array.isArray(itemsData)) {
    console.error(`유효하지 않은 아이템 데이터: ${enchantType}`);
    return null;
  }

  // 인챈트 메타데이터 디렉토리 생성
  const enchantDir = path.join(config.DATA_DIR, 'meta', 'enchants');
  fs.ensureDirSync(enchantDir);

  // 인챈트 타입별 파일 경로
  const filePath = path.join(enchantDir, `${enchantType}.json`);

  // 기존 메타데이터 로드
  let existingData = { 
    updated: new Date().toISOString(), 
    enchants: {} 
  };
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      existingData = JSON.parse(data);
    }
  } catch (error) {
    console.warn(`기존 인챈트 메타데이터 로드 실패: ${enchantType}`, error.message);
  }

  // 메타데이터 수집 변수
  let newCount = 0;
  let updateCount = 0;

  // 각 아이템 순회
  for (const item of itemsData) {
    // 아이템 유효성 검사
    if (!item || !item.item_option) {
      continue;
    }

    // 인챈트 옵션만 필터링 (접두 또는 접미)
    const enchantOptions = item.item_option.filter(
      option => option.option_type === '인챈트' && 
                option.option_sub_type === (enchantType === 'prefix' ? '접두' : '접미') &&
                option.option_value && 
                option.option_desc
    );

    // 각 인챈트 옵션 처리
    for (const option of enchantOptions) {
      // 인챈트 이름과 랭크 파싱
      const { name, rank } = parseEnchantNameAndRank(option.option_value);
      
      // 효과 텍스트 분리 및 파싱
      const effectsTexts = option.option_desc.split(',');
      const effects = effectsTexts.map(text => parseEnchantEffect(text.trim()));
      
      // 메타데이터에 없으면 추가
      if (!existingData.enchants[name]) {
        existingData.enchants[name] = {
          name,
          rank,
          effects
        };
        newCount++;
      } else {
        // 기존 인챈트 업데이트
        const existingEnchant = existingData.enchants[name];
        
        // 랭크 업데이트
        if (rank && (!existingEnchant.rank || rank > existingEnchant.rank)) {
          existingEnchant.rank = rank;
        }
        
        // 새 효과 처리
        for (const newEffect of effects) {
          const matchingEffect = existingEnchant.effects.find(
            e => e.template === newEffect.template
          );
          
          if (matchingEffect) {
            // min/max 값 업데이트
            if (newEffect.min !== null) {
              matchingEffect.min = Math.min(
                matchingEffect.min !== null ? matchingEffect.min : Infinity,
                newEffect.min
              );
            }
            
            if (newEffect.max !== null) {
              matchingEffect.max = Math.max(
                matchingEffect.max !== null ? matchingEffect.max : -Infinity,
                newEffect.max
              );
            }
            
            // variable 필드 업데이트
            matchingEffect.variable = matchingEffect.min !== matchingEffect.max;
          } else {
            // 새 효과 추가
            existingEnchant.effects.push(newEffect);
          }
        }
        updateCount++;
      }
    }
  }

  // 인챈트 이름 기준으로 정렬된 객체로 변환 (한글 기준 가나다순)
  const sortedEnchants = {};
  Object.keys(existingData.enchants)
    .sort((a, b) => a.localeCompare(b, 'ko'))
    .forEach(key => {
      sortedEnchants[key] = existingData.enchants[key];
    });
  
  existingData.enchants = sortedEnchants;
  existingData.updated = new Date().toISOString();

  // 메타데이터 저장
  try {
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
    
    return {
      newCount,
      updateCount,
      totalCount: Object.keys(existingData.enchants).length
    };
  } catch (error) {
    console.error(`인챈트 메타데이터 저장 실패: ${enchantType}`, error);
    return null;
  }
}

module.exports = {
  collectEnchantMetadata,
  parseEnchantEffect,
  parseEnchantNameAndRank
};
