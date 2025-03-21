/**
 * option-renderer.js
 * 아이템 옵션 렌더링 관련 기능
 */

class OptionRenderer {
  constructor() {
    this.colorClass = {
      red: 'color-red',
      blue: 'color-blue',
      yellow: 'color-yellow',
      white: 'color-white',
      default: 'color-default'
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
    let result = null;
    
    switch(option.option_type) {
      case '공격':
      result = {
        text: `공격 ${option.option_value}~${option.option_value2}`,
        filter: {
          name: '최대 공격력',
          value: parseInt(option.option_value2),
          type: 'range'
        }
      };
      break;
        
      case '부상률':
        const minInjury = option.option_value.toString().replace('%', '');
        const maxInjury = option.option_value2.toString().replace('%', '');
        result = {
          text: `부상률 ${minInjury}~${maxInjury}%`,
          filter: {
            name: '최대 부상률',
            value: parseInt(maxInjury),
            type: 'range',
            isPercent: true
          }
        };
        break;
        
      case '크리티컬':
        result = {
          text: `크리티컬 ${option.option_value}`,
          filter: {
            name: '크리티컬',
            value: parseInt(option.option_value.replace('%', '')),
            type: 'range',
            isPercent: true
          }
        };
        break;
        
      case '밸런스':
        result = {
          text: `밸런스 ${option.option_value}`,
          filter: {
            name: '밸런스',
            value: parseInt(option.option_value.replace('%', '')),
            type: 'range',
            isPercent: true
          }
        };
        break;
        
      case '방어력':
        result = {
          text: `방어력 ${option.option_value}`,
          filter: false
        };
        break;
        
      case '보호':
        result = {
          text: `보호 ${option.option_value}`,
          filter: {
            name: '보호',
            value: option.option_value,
            type: 'range'
          }
        };
        break;
        
      case '마법 방어력':
        result = {
          text: `마법 방어력 ${option.option_value}`,
          filter: false
        };
        break;
        
      case '마법 보호':
        result = {
          text: `마법 보호 ${option.option_value}`,
          filter: {
            name: '마법 보호',
            value: option.option_value,
            type: 'range'
          }
        };
        break;
        
      case '내구력':
        result = {
          text: `내구력 ${option.option_value}/${option.option_value2}`,
          filter: {
            name: '내구력',
            value: option.option_value2,
            type: 'range',
            visible: false
          }
        };
        break;
        
      case '숙련':
        result = {
          text: `숙련 ${option.option_value}`,
          filter: false
        };
        break;
        
      case '남은 전용 해제 가능 횟수':
        result = {
            text: ` 전용 아이템 (전용 일시 해제)\n남은 전용 해제 가능 횟수 : ${option.option_value}`,
            filter: {
            name: '남은 전용 해제 가능 횟수',
            value: option.option_value,
            type: 'range'
            }
        };
        break;
        
      case '피어싱 레벨':
        result = {
          text: `- 피어싱 레벨 ${option.option_value} ${option.option_value2 || ''}`,
          color: 'blue',
          filter: {
            name: '피어싱 레벨',
            value: parseInt(option.option_value) + (option.option_value2 ? parseInt(option.option_value2.replace('+', '')) : 0),
            type: 'range'
          }
        };
        break;
        
      case '인챈트 불가능':
        result = {
          text: `#인챈트 부여 불가능`,
          filter: false
        };
        break;
        
      case '아이템 보호':
        if (option.option_value === '인챈트 실패') {
          result = {
            text: `#인챈트 실패 시 아이템 보호`,
            filter: false
          };
        } else if (option.option_value === '수리 실패') {
          result = {
            text: `#수리 실패 시 아이템 보호`,
            filter: false
          };
        }
        break;
        
      case '남은 거래 횟수':
        result = {
          text: `남은 거래 가능 횟수 : ${option.option_value}`,
          filter: false
        };
        break;
    }
    
    return result;
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
    
    // 특별 개조 처리
    this.processSpecialMods(item, block);
    
    // 세공 처리
    this.processReforges(item, block);
    
    // 에르그 처리
    this.processErg(item, block);
    
    // 세트 효과 처리
    this.processSetEffects(item, block);
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
      let modText = `일반 개조 (${normalModOption.option_value}/${normalModOption.option_value2})`;
      
      // 보석 개조 확인
      const gemModOption = options.find(opt => 
        opt.option_type === '보석 개조'
      );
      
      if (gemModOption) {
        modText += `, 보석 개조`;
      }
      
      block.content.push({
        text: modText,
        filter: false
      });
    }
    
    // 장인 개조
    const masterModOption = options.find(opt => 
      opt.option_type === '장인 개조'
    );
    
    if (masterModOption) {
      const modParts = masterModOption.option_value.split(',');
      let modText = `장인개조`;
      
      modParts.forEach(part => {
        modText += ` - ${part.trim()}`;
      });
      
      block.content.push({
        text: modText,
        color: {
          title: 'default', // "장인개조"는 기본 색상
          content: 'blue'   // 나머지는 파란색
        },
        filter: false
      });
    }
  }
  
  /**
   * 특별 개조 처리
   * @param {Object} item 아이템 데이터
   * @param {Object} block 블록 데이터
   */
  processSpecialMods(item, block) {
    const options = item.options || item.item_option || [];
    const specialModOption = options.find(opt => 
      opt.option_type === '특별개조'
    );
    
    if (specialModOption) {
      const type = specialModOption.option_sub_type; // "R" 또는 "S"
      const level = specialModOption.option_value;   // 숫자 값
      
      block.content.push({
        text: `특별개조 ${type} (${level}단계)`,
        color: 'red',
        filter: {
          name: '특별개조 타입',
          value: type,
          type: 'selection',
          options: ['R', 'S']
        }
      });
      
      // 추가 필터 정보는 option-filter-manager.js에서 처리
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
    
    // 필터 정보는 option-filter-manager.js에서 처리
  }
  
  /**
   * 에르그 처리
   * @param {Object} item 아이템 데이터
   * @param {Object} block 블록 데이터
   */
  processErg(item, block) {
    const options = item.options || item.item_option || [];
    const ergOption = options.find(opt => 
      opt.option_type === '에르그'
    );
    
    if (!ergOption) return;
    
    block.content.push({
      text: `등급 ${ergOption.option_sub_type} (${ergOption.option_value}/${ergOption.option_value2}레벨)`,
      color: 'red',
      filter: {
        name: '에르그 등급',
        value: ergOption.option_sub_type,
        type: 'selection',
        options: ['B', 'A', 'S']
      }
    });
    
    // 추가 필터 정보는 option-filter-manager.js에서 처리
  }
  
  /**
   * 세트 효과 처리
   * @param {Object} item 아이템 데이터
   * @param {Object} block 블록 데이터
   */
  processSetEffects(item, block) {
    const options = item.options || item.item_option || [];
    const setEffects = options.filter(opt => 
      opt.option_type === '세트 효과'
    ).sort((a, b) => 
      parseInt(a.option_sub_type || '0') - parseInt(b.option_sub_type || '0')
    );
    
    if (setEffects.length === 0) return;
    
    setEffects.forEach(effect => {
      block.content.push({
        text: `- ${effect.option_value} +${effect.option_value2}`,
        color: 'blue',
        filter: false
      });
      
      // 필터 정보는 option-filter-manager.js에서 처리
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
          // 기본 색상
          contentElement.textContent = content.text;
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
      titleSpan.className = this.colorClass[colorMap.title];
      
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
}

// 싱글톤 인스턴스 생성 및 내보내기
const optionRenderer = new OptionRenderer();
export default optionRenderer;
