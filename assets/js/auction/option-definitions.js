/**
 * option-definitions.js
 * 아이템 옵션 타입의 중앙 정의 모듈
 * 렌더링과 필터링에 필요한 모든 옵션 정의를 포함
 */

/**
 * 중앙화된 옵션 정의
 * 각 옵션 타입별로:
 * - display: 표시 방법, 색상 등 UI 관련 정의
 * - filter: 필터링 관련 메타데이터
 */
const optionDefinitions = {
  // 기본 전투 스탯
  '공격': {
    display: (option) => `공격 ${option.option_value}~${option.option_value2}`,
    filter: {
      displayName: '최대 공격력',
      field: 'option_value2',
      type: 'range'
    }
  },
  
  '부상률': {
    display: (option) => {
      const minValue = option.option_value.toString().replace('%', '');
      const maxValue = option.option_value2.toString().replace('%', '');
      return `부상률 ${minValue}~${maxValue}%`;
    },
    filter: false
  },
  
  '크리티컬': {
    display: (option) => `크리티컬 ${option.option_value}`,
    filter: false
  },
  
  '밸런스': {
    display: (option) => `밸런스 ${option.option_value}`,
    filter: {
      displayName: '밸런스',
      field: 'option_value',
      type: 'range',
      isPercent: true
    }
  },
  
  '내구력': {
    display: (option) => {
      const currentDurability = parseInt(option.option_value) || 0;
      const maxDurability = parseInt(option.option_value2) || 1;
      return `내구력 ${currentDurability}/${maxDurability}`;
    },
    filter: {
      displayName: '최대 내구력',
      field: 'option_value2',
      type: 'range'
    },
    color: 'yellow'
  },
  
  '숙련': {
    display: (option) => `숙련 ${option.option_value}`,
    filter: false
  },
  
  '남은 전용 해제 가능 횟수': {
    display: (option) => ` 전용 아이템 (전용 일시 해제)\n남은 전용 해제 가능 횟수: ${option.option_value}`,
    filter: {
      displayName: '전용 해제 가능 횟수',
      field: 'option_value',
      type: 'range'
    },
    color: 'yellow'
  },
  
  '전용 해제 거래 보증서 사용 불가': {
    display: (option) => `전용 해제 거래 보증서 사용 불가`,
    filter: false,
    color: 'yellow'
  },
  
  '피어싱 레벨': {
    display: (option) => {
      const baseLevel = option.option_value || "0";
      
      if (option.option_value2) {
        return `피어싱 레벨 ${baseLevel}+ ${option.option_value2.substring(1)}`;
      } else {
        return `피어싱 레벨 ${baseLevel}`;
      }
    },
    filter: {
      displayName: '피어싱 레벨',
      field: 'option_value',
      type: 'range'
    },
    color: 'blue'
  },
  
  '아이템 보호': {
    display: (option) => {
      if (option.option_value === '인챈트 추출') {
        return `인챈트 추출 시 아이템 보호`;
      } else if (option.option_value === '인챈트 실패') {
        return `인챈트 실패 시 아이템 보호`;
      } else if (option.option_value === '수리 실패') {
        return `수리 실패 시 아이템 보호`;
      }
      return `아이템 보호`;
    },
    filter: false,
    color: 'yellow'
  },
  
  '인챈트': {
    display: (option, context) => {
      const type = option.option_sub_type;
      const value = option.option_value;
      const desc = option.option_desc || '';
      
      // 인챈트 이름과 랭크 추출
      const nameMatch = value.match(/(.*?)\s*\(랭크 (\d+)\)/);
      let enchantName = value;
      let rankText = '';
      let rankNum = 0;
      
      if (nameMatch) {
        enchantName = nameMatch[1].trim();
        rankText = `(랭크 ${nameMatch[2]})`;
        rankNum = parseInt(nameMatch[2]);
      }
      
      // 메타데이터 조회
      const metadata = context?.getEnchantMetadata?.(type, enchantName);
      
      // 기본 HTML 구성
      let result = `<span class="enchant-type">[${type}]</span> ${enchantName} <span class="item-pink">${rankText}</span>`;
      
      // 효과 처리
      if (desc) {
        const effects = desc.split(',');
        const formattedEffects = [];
        
        effects.forEach(effect => {
          // 조건부 정보 제거하고 순수 효과만 추출
          const conditionMatch = effect.match(/(.*?) 랭크 \d+ 이상일 때 (.*)/);
          const cleanEffect = conditionMatch ? conditionMatch[2].trim() : effect.trim();
          
          // 부정적 효과 확인 (수리비 증가, 또는 다른 감소 효과)
          const isNegative = 
            (cleanEffect.includes('수리비') && cleanEffect.includes('증가')) || 
            (!cleanEffect.includes('수리비') && cleanEffect.includes('감소'));
          
          // 값 추출 (예: "체력 44 증가" -> 44)
          const valueMatch = cleanEffect.match(/(.*?)(\d+)(.*)/);
          
          if (valueMatch && metadata && metadata.effects) {
            const [_, prefix, value, suffix] = valueMatch;
            const effectText = prefix + value + suffix;
            
            // 메타데이터에서 효과 찾기
            for (const metaEffect of metadata.effects) {
              const template = metaEffect.template;
              // 정규식으로 템플릿 변환
              const pattern = template.replace(/\{value\}/g, '\\d+');
              
              if (new RegExp(pattern).test(cleanEffect)) {
                // 값 범위 정보 추가 (변동 가능 효과인 경우)
                const rangeText = metaEffect.variable ? 
                  ` <span class="item-navy">(${metaEffect.min}~${metaEffect.max})</span>` : '';
                
                formattedEffects.push(
                  `<span class="${isNegative ? 'item-red' : 'item-blue'}">${effectText}</span>${rangeText}`
                );
                break;
              }
            }
          } else {
            // 메타데이터 매칭 실패 시 일반 표시
            formattedEffects.push(
              `<span class="${isNegative ? 'item-red' : 'item-blue'}">${cleanEffect}</span>`
            );
          }
        });
        
        if (formattedEffects.length > 0) {
          result += ` - ${formattedEffects.join(' - ')}`;
        }
      }
      
      return result;
    },
    filter: {
      displayName: '인챈트',
      type: 'enchant',
      subTypes: ['접두', '접미']
    }
  },

  '일반 개조': {
    display: (option) => `일반 개조 (${option.option_value}/${option.option_value2})`,
    filter: false
  },
  
  '보석 개조': {
    display: (option) => `보석 개조`,
    filter: false
  },
  
  '장인 개조': {
    display: (option) => {
      // 장인 개조는 여러 효과가 있으므로 기본 텍스트만 반환
      return `장인 개조`;
    },
    filter: false
  },
  
  '특별 개조': {
    display: (option) => `특별개조 <span class="item-pink">${option.option_sub_type}</span> <span class="item-pink">(${option.option_value}단계)</span>`,
    filter: {
      displayName: '특별개조 단계',
      field: 'option_value',
      type: 'range'
    }
  },
  
  '에르그': {
    display: (option) => `등급 <span class="item-pink">${option.option_sub_type}</span> <span class="item-pink">(${option.option_value}/${option.option_value2}레벨)</span>`,
    filter: {
      displayName: '에르그 레벨',
      field: 'option_value',
      type: 'range'
    }
  },
  
  '세공 랭크': {
    display: (option) => `${option.option_value}랭크`,
    filter: {
      displayName: '세공 상태',
      type: 'reforge-status'
    },
    color: 'pink'
  },
  
  '세공 옵션': {
    display: (option) => {
      // "스매시 대미지(18레벨:180 % 증가)" 형식 파싱
      const match = option.option_value.match(/(.*?)\((\d+)레벨:(.*)\)/);
      if (!match) return option.option_value;
      
      const name = match[1].trim();
      const level = match[2];
      
      return `${name} ${level}레벨`;
    },
    filter: {
      displayName: '세공 옵션',
      type: 'reforge-option'
    },
    color: 'blue'
  },
  
  '세트 효과': {
    display: (option) => `- ${option.option_value} +${option.option_value2}`,
    filter: {
      displayName: '세트 효과',
      field: 'option_value2',
      type: 'range',
      category: '세트 효과'
    },
    color: 'blue'
  },
  
  '남은 거래 횟수': {
    display: (option) => `남은 거래 가능 횟수 : ${option.option_value}`,
    filter: false,
    color: 'yellow'
  }
};

export default optionDefinitions;
