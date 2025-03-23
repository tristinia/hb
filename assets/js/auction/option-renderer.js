/**
 * option-renderer.js
 * 아이템 옵션 렌더링 및 필터링을 위한 통합 처리 시스템
 */
class OptionRenderer {
  constructor() {
    this.colorClass = {
      red: 'item-red',
      blue: 'item-blue',
      yellow: 'item-yellow',
      orange: 'item-orange',
      pink: 'item-pink',
      navy: 'item-navy'
    };    
    this.debug = false;
    
    // 인챈트 메타데이터 저장 객체
    this.enchantData = {
      prefix: null,
      suffix: null,
      isLoaded: false
    };
    
    // 초기화 시 인챈트 메타데이터 로드
    this.loadEnchantMetadata();
  }
  
  /**
   * 디버그 로그 출력
   * @param {...any} args 로그 인자들
   */
  logDebug(...args) {
    if (this.debug) {
      console.log(...args);
    }
  }
  
  /**
   * 인챈트 메타데이터 로드
   */
  async loadEnchantMetadata() {
    try {
      // 접두사 로드
      const prefixResponse = await fetch('../../data/meta/enchants/prefix.json');
      if (prefixResponse.ok) {
        this.enchantData.prefix = await prefixResponse.json();
      }
      
      // 접미사 로드
      const suffixResponse = await fetch('../../data/meta/enchants/suffix.json');
      if (suffixResponse.ok) {
        this.enchantData.suffix = await suffixResponse.json();
      }
      
      this.enchantData.isLoaded = true;
      this.logDebug('인챈트 메타데이터 로드 완료');
    } catch (error) {
      console.error('인챈트 메타데이터 로드 실패:', error);
    }
  }
  
  /**
   * 인챈트 메타데이터 검색
   * @param {string} type - 인챈트 타입 ('접두' 또는 '접미')
   * @param {string} name - 인챈트 이름
   * @returns {Object|null} 인챈트 메타데이터
   */
  getEnchantMetadata(type, name) {
    if (!this.enchantData.isLoaded) return null;
    
    const source = type === '접두' ? 'prefix' : 'suffix';
    const data = this.enchantData[source];
    
    return data && data[name] ? data[name] : null;
  }
  
  /**
   * 옵션 타입별 처리 핸들러 정의
   * 각 옵션 타입마다:
   * - display: 표시할 텍스트 생성 함수
   * - filter: 필터링에 사용할 설정 (displayName, field, type 등)
   */
   get optionHandlers() {
    return {
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
        display: (option) => `남은 전용 해제 가능 횟수: ${option.option_value}`,
        filter: {
          displayName: '전용 해제 가능 횟수',
          field: 'option_value',
          type: 'range'
        },
        color: 'yellow'
      },
      
      '피어싱 레벨': {
        display: (option) => {
          const baseLevel = option.option_value || "0";
          const bonusLevel = option.option_value2 ? option.option_value2 : "";
          return `피어싱 레벨 ${baseLevel} ${bonusLevel}`;
        },
        filter: {
          displayName: '피어싱 레벨',
          field: 'option_value',
          type: 'range'
        }
      },
      
      '인챈트': {
        display: (option) => {
          const type = option.option_sub_type; // 접두 or 접미
          const value = option.option_value; // "충돌의 (랭크 4)"
          const desc = option.option_desc || ''; // 인챈트 효과 설명
          
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
          const metadata = this.getEnchantMetadata(type, enchantName);
          
          // 기본 HTML 구성
          let result = `<span class="enchant-type">[${type}]</span> ${enchantName} <span class="${this.colorClass.pink}">${rankText}</span>`;
          
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
                      ` <span class="${this.colorClass.navy}">(${metaEffect.min}~${metaEffect.max})</span>` : '';
                    
                    formattedEffects.push(
                      `<span class="${isNegative ? this.colorClass.red : this.colorClass.blue}">${effectText}</span>${rangeText}`
                    );
                    break;
                  }
                }
              } else {
                // 메타데이터 매칭 실패 시 일반 표시
                formattedEffects.push(
                  `<span class="${isNegative ? this.colorClass.red : this.colorClass.blue}">${cleanEffect}</span>`
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
      
      '특별 개조': {
        display: (option) => `특별개조 ${option.option_sub_type} (${option.option_value}단계)`,
        filter: {
          displayName: '특별개조 단계',
          field: 'option_value',
          type: 'range'
        },
        color: 'pink'
      },
      
      '에르그': {
        display: (option) => `등급 ${option.option_sub_type} (${option.option_value}/${option.option_value2}레벨)`,
        filter: {
          displayName: '에르그 레벨',
          field: 'option_value',
          type: 'range'
        },
        color: 'red'
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
      },

      '특별 개조': {
        display: (option) => `특별개조 ${option.option_sub_type} (${option.option_value}단계)`,
        filter: {
          displayName: '특별개조 단계',
          field: 'option_value',
          type: 'range'
        },
        color: 'red'
      },
      
      '에르그': {
        display: (option) => `등급 ${option.option_sub_type} (${option.option_value}/${option.option_value2}레벨)`,
        filter: {
          displayName: '에르그 레벨',
          field: 'option_value',
          type: 'range'
        },
        color: 'red'
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
        filter: false
      }
      // 추가 옵션 타입은 여기에 계속 추가...
    };
  }

  /**
   * 아이템 데이터를 기반으로 표시용 블록 생성
   * @param {Object} item 아이템 데이터
   * @returns {Array} 블록 데이터 배열
   */
  createDisplayBlocks(item) {
    const blocks = [];
    
    // 이름 필드 정규화
    const itemName = item.item_display_name || item.item_name || '이름 없음';
    
    // 옵션 필드 정규화
    const options = item.options || item.item_option || [];
    
    // 1블록: 아이템 이름 (가운데 정렬)
    blocks.push({
      id: 'name',
      align: 'center',
      content: [{ 
        text: itemName,
        filter: false
      }]
    });
    
    // 2블록: 아이템 속성 (왼쪽 정렬)
    const attributeBlock = {
      id: 'attributes',
      title: '아이템 속성',
      align: 'left',
      content: []
    };
    
    // 옵션 처리
    if (Array.isArray(options)) {
      // 일반 옵션 처리
      for (const option of options) {
        const processedOption = this.processOption(option);
        if (processedOption) {
          attributeBlock.content.push(processedOption);
        }
      }
      
      // 특수 기능 처리
      this.processSpecialFeatures(item, attributeBlock);
      
      // 접두/접미어 처리
      const affixes = this.processAffixes(item);
      if (affixes.length > 0) {
        attributeBlock.content.push(...affixes);
      }
    }
    
    // 블록 내용이 있는 경우만 추가
    if (attributeBlock.content.length > 0) {
      blocks.push(attributeBlock);
    }
    
    return blocks;
  }
  
  /**
   * 옵션 처리
   * @param {Object} option 옵션 데이터
   * @returns {Object|null} 처리된 옵션 정보
   */
  processOption(option) {
    // 옵션 타입 핸들러 가져오기
    const handler = this.optionHandlers[option.option_type];
    
    // 핸들러가 없으면 null 반환
    if (!handler) {
      return null;
    }
    
    // 표시 텍스트 생성
    const text = handler.display(option);
    
    // 필터 정보 생성
    let filter = false;
    if (handler.filter) {
      // handler.filter가 함수인 경우 호출
      const filterConfig = typeof handler.filter === 'function' 
        ? handler.filter(option) 
        : handler.filter;
      
      // 필터 설정이 있는 경우 필터 객체 생성
      if (filterConfig) {
        filter = {
          name: option.option_type,
          displayName: filterConfig.displayName || option.option_type,
          value: this.extractValue(option, filterConfig.field || 'option_value'),
          field: filterConfig.field || 'option_value',
          type: filterConfig.type || 'range',
          isPercent: filterConfig.isPercent || false,
          category: filterConfig.category || undefined,
          visible: filterConfig.visible !== undefined ? filterConfig.visible : true
        };
      }
    }
    
    // 색상 처리
    const color = handler.color || undefined;
    
    // 결과 반환
    return {
      text,
      filter,
      color
    };
  }
  
  /**
   * 옵션에서 값 추출 및 파싱
   * @param {Object} option 옵션 객체
   * @param {string} field 필드명
   * @returns {number|string} 추출된 값
   */
  extractValue(option, field) {
    const rawValue = option[field];
    
    // 값이 없으면 0 반환
    if (rawValue === undefined || rawValue === null) {
      return 0;
    }
    
    // 문자열이면 숫자 변환 시도
    if (typeof rawValue === 'string') {
      // % 기호 제거
      const cleanValue = rawValue.replace('%', '');
      
      // 숫자로 변환 시도
      const numValue = parseFloat(cleanValue);
      
      // 변환 결과가 유효하면 숫자 반환, 아니면 원래 문자열 반환
      return isNaN(numValue) ? rawValue : numValue;
    }
    
    // 이미 숫자면 그대로 반환
    return rawValue;
  }
  
  /**
   * 특수 기능 처리 (세공, 세트 효과, 개조 등)
   * @param {Object} item 아이템 데이터
   * @param {Object} block 블록 데이터
   */
  processSpecialFeatures(item, block) {
    const options = item.options || item.item_option || [];
    if (!Array.isArray(options)) return;
    
    // 일반 개조 및 장인 개조 처리
    this.processModifications(item, block);
    
    // 세공 처리
    this.processReforges(item, block);
    
    // 특별 개조와 에르그는 이미 processOption에서 처리됨
  }
  
  /**
   * 개조 처리 (일반 개조, 장인 개조)
   * @param {Object} item 아이템 데이터
   * @param {Object} block 블록 데이터
   */
  processModifications(item, block) {
    const options = item.options || item.item_option || [];
    
    // 일반 개조
    const normalModOption = options.find(opt => 
      opt.option_type === '일반 개조'
    );
    
    if (normalModOption) {
      // 한 줄에 일반 개조와 보석 강화 표시
      let modText = `일반 개조 (${normalModOption.option_value}/${normalModOption.option_value2})`;
      
      // 보석 개조 확인 - 이름을 "보석 강화"로 변경
      const gemModOption = options.find(opt => 
        opt.option_type === '보석 개조'
      );
      
      if (gemModOption) {
        modText += `, 보석 강화`;
      }
      
      block.content.push({
        text: modText,
        filter: false
      });
    }
    
    // 장인 개조 - "장인 개조" 텍스트는 기본색, 효과는 파란색으로 변경
    const masterModOption = options.find(opt => 
      opt.option_type === '장인 개조'
    );
    
    if (masterModOption) {
      const modParts = masterModOption.option_value.split(',');
      
      // 장인개조 텍스트만 먼저 추가 (기본 색상)
      block.content.push({
        text: `장인 개조`,
        filter: false
      });
      
      // 효과들은 개별적으로 파란색으로 추가
      modParts.forEach(part => {
        block.content.push({
          text: `- ${part.trim()}`,
          color: 'blue',
          filter: false
        });
      });
    }
  }
  
  /**
   * 세공 처리
   * @param {Object} item 아이템 데이터
   * @param {Object} block 블록 데이터
   */
  processReforges(item, block) {
    const options = item.options || item.item_option || [];
    
    // 세공 랭크 찾기
    const reforgeRankOption = options.find(opt => 
      opt.option_type === '세공 랭크'
    );
    
    if (!reforgeRankOption) return;
    
    const rank = reforgeRankOption.option_value;
    
    // 세공 옵션 찾기
    const reforgeOptions = options.filter(opt => 
      opt.option_type === '세공 옵션'
    ).sort((a, b) => 
      parseInt(a.option_sub_type) - parseInt(b.option_sub_type)
    );
    
    if (reforgeOptions.length === 0) return;
    
    // 세공 옵션 파싱 및 표시 텍스트 구성
    let displayText = `${rank}랭크`;
    
    reforgeOptions.forEach(opt => {
      // "스매시 대미지(18레벨:180 % 증가)" 형식 파싱
      const match = opt.option_value.match(/(.*?)\((\d+)레벨:(.*)\)/);
      if (!match) return;
      
      const name = match[1].trim();
      const level = parseInt(match[2]);
      const effect = match[3].trim();
      
      displayText += ` - ${name} ${level}레벨 └ ${effect}`;
    });
    
    // 블록에 추가
    block.content.push({
      text: displayText,
      color: {
        rank: 'red',          // 랭크 정보는 빨간색
        option: 'blue',       // 세공 옵션은 파란색
        detail: 'white'       // 상세 정보는 흰색
      },
      filter: false
    });
  }
  
  /**
   * 접두/접미어 처리
   * @param {Object} item 아이템 데이터
   * @returns {Array} 처리된 접두/접미어 배열
   */
  processAffixes(item) {
    const result = [];
    
    // 접두어 처리
    if (item.prefix) {
      result.push({
        text: `- ${item.prefix}`,
        color: item.prefix_color || 'default',
        filter: false
      });
    }
    
    // 접미어 처리
    if (item.suffix) {
      // "미티어로이드 (랭크 4)" 형식은 하이픈 없음
      if (item.suffix.includes("미티어로이드")) {
        result.push({
          text: item.suffix,
          color: item.suffix_color || 'default',
          filter: false
        });
      } else {
        result.push({
          text: `- ${item.suffix}`,
          color: item.suffix_color || 'default',
          filter: false
        });
      }
    }
    
    return result;
  }
  
  /**
   * 아이템 블록을 HTML로 렌더링
   * @param {Array} blocks 블록 데이터 배열
   * @returns {HTMLElement} 렌더링된 아이템 요소
   */
  renderItemBlocks(blocks) {
    const itemElement = document.createElement('div');
    itemElement.className = 'item-card';
    
    // 블록 렌더링
    blocks.forEach(block => {
      const blockElement = document.createElement('div');
      blockElement.className = `item-block`;
      
      // 정렬 설정
      if (block.align) {
        blockElement.style.textAlign = block.align;
      }
      
      // 블록 제목
      if (block.title) {
        const titleElement = document.createElement('h3');
        titleElement.className = 'block-title';
        titleElement.textContent = block.title;
        blockElement.appendChild(titleElement);
      }
      
      // 콘텐츠 추가
      block.content.forEach(content => {
        const contentElement = document.createElement('div');
        contentElement.className = 'item-content';
        
        // 복합 색상 처리
        if (content.color) {
          if (typeof content.color === 'string') {
            // 단일 색상
            contentElement.className += ` ${this.colorClass[content.color]}`;
            contentElement.textContent = content.text;
          } else if (typeof content.color === 'object') {
            // 복합 색상 (세공, 장인개조 등)
            this.applyComplexColors(contentElement, content.text, content.color);
          }
        } else {
          // HTML 태그가 있는 경우 innerHTML 사용
          if (content.text.includes('<')) {
            contentElement.innerHTML = content.text;
          } else {
            contentElement.textContent = content.text;
          }
        }
        
        blockElement.appendChild(contentElement);
      });
      
      itemElement.appendChild(blockElement);
    });
    
    return itemElement;
  }
  
  /**
   * 복합 색상 적용
   * @param {HTMLElement} element HTML 요소
   * @param {string} text 텍스트
   * @param {Object} colorMap 색상 맵
   */
  applyComplexColors(element, text, colorMap) {
    // 원래 텍스트를 제거
    element.textContent = '';
    
    if (colorMap.title && colorMap.content) {
      // 장인개조 같은 경우 타이틀과 내용 구분
      const titlePart = text.split(' - ')[0];
      const contentPart = text.substring(titlePart.length);
      
      const titleSpan = document.createElement('span');
      titleSpan.textContent = titlePart;
      titleSpan.className = colorMap.title !== 'default' ? this.colorClass[colorMap.title] : '';
      
      const contentSpan = document.createElement('span');
      contentSpan.textContent = contentPart;
      contentSpan.className = this.colorClass[colorMap.content];
      
      element.appendChild(titleSpan);
      element.appendChild(contentSpan);
    } else if (colorMap.rank && colorMap.option && colorMap.detail) {
      // 세공 옵션 같은 경우 랭크, 옵션, 상세정보 구분
      const parts = text.split(' - ');
      const rankPart = parts[0];
      
      const rankSpan = document.createElement('span');
      rankSpan.textContent = rankPart;
      rankSpan.className = this.colorClass[colorMap.rank];
      element.appendChild(rankSpan);
      
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        const detailParts = part.split(' └ ');
        
        if (i > 1) {
          const separator = document.createElement('span');
          separator.textContent = ' - ';
          element.appendChild(separator);
        }
        
        if (detailParts.length === 2) {
          const optionSpan = document.createElement('span');
          optionSpan.textContent = detailParts[0];
          optionSpan.className = this.colorClass[colorMap.option];
          
          const detailSpan = document.createElement('span');
          detailSpan.textContent = ` └ ${detailParts[1]}`;
          detailSpan.className = this.colorClass[colorMap.detail];
          
          element.appendChild(optionSpan);
          element.appendChild(detailSpan);
        } else {
          const optionSpan = document.createElement('span');
          optionSpan.textContent = part;
          optionSpan.className = this.colorClass[colorMap.option];
          element.appendChild(optionSpan);
        }
      }
    }
  }
  
  /**
   * 아이템에서 옵션 필터 추출
   * @param {Object} item 아이템 객체
   * @returns {Array} 필터 객체 배열
   */
  extractFilters(item) {
    const filters = [];
    
    // 옵션 필드 표준화
    const options = item.options || item.item_option || [];
    
    // 각 옵션 처리
    if (Array.isArray(options)) {
      options.forEach(option => {
        const processedOption = this.processOption(option);
        if (processedOption && processedOption.filter && processedOption.filter !== false) {
          filters.push(processedOption.filter);
        }
      });
    }
    
    return filters;
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const optionRenderer = new OptionRenderer();
export default optionRenderer;
