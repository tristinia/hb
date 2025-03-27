/**
 * 아이템 옵션 렌더링 전용 모듈
 */

import metadataLoader from './metadata-loader.js';

/**
 * 옵션 렌더러 클래스
 */
class OptionRenderer {
  constructor() {
    // 색상 클래스 매핑
    this.colorClass = {
      red: 'item-red',
      blue: 'item-blue',
      yellow: 'item-yellow',
      orange: 'item-orange',
      pink: 'item-pink',
      navy: 'item-navy'
    };
    
    this.debug = false;
  }
  
  logDebug(...args) {
    if (this.debug) {
      console.log('[OptionRenderer]', ...args);
    }
  }
  
  createDisplayBlocks(item) {
    const blocks = [];
    
    const itemName = item.item_display_name || item.item_name || '이름 없음';
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
      // 일반 옵션 처리 (속성 순서 정렬)
      const orderedOptions = this.orderOptionsByImportance(options);
      
      for (const option of orderedOptions) {
        const processedOption = this.processOption(option);
        if (processedOption) {
          attributeBlock.content.push(processedOption);
        }
      }
      
      // 장인 개조 특수 처리
      this.processSpecialFeatures(item, attributeBlock);
    }
    
    // 블록 내용이 있는 경우만 추가
    if (attributeBlock.content.length > 0) {
      blocks.push(attributeBlock);
    }
    
    return blocks;
  }
  
  orderOptionsByImportance(options) {
    // 주요 속성 순서 정의
    const optionOrder = [
      '공격', '부상률', '크리티컬', '밸런스', '내구력', '숙련',
      '남은 전용 해제 가능 횟수', '전용 해제 거래 보증서 사용 불가',
      '피어싱 레벨', '아이템 보호', '인챈트', '특별 개조', '에르그',
      '세공 랭크', '세공 옵션', '세트 효과', '남은 거래 횟수'
    ];
    
    // 옵션 정렬
    return [...options].sort((a, b) => {
      const indexA = optionOrder.indexOf(a.option_type);
      const indexB = optionOrder.indexOf(b.option_type);
      
      // 목록에 없는 옵션은 뒤로
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      
      return indexA - indexB;
    });
  }
  
  processOption(option) {
    const optionType = option.option_type;
    
    // 컨텍스트 객체 (메타데이터 접근용)
    const context = {
      getEnchantMetadata: (type, name) => metadataLoader.getEnchantMetadata(type, name)
    };
    
    let text;
    let color;
    
    // 옵션 타입별 처리
    switch (optionType) {
      case '공격':
        text = `공격 ${option.option_value}~${option.option_value2}`;
        break;
        
      case '부상률':
        const minValue = option.option_value.toString().replace('%', '');
        const maxValue = option.option_value2.toString().replace('%', '');
        text = `부상률 ${minValue}~${maxValue}%`;
        break;
        
      case '크리티컬':
        text = `크리티컬 ${option.option_value}`;
        break;
        
      case '밸런스':
        text = `밸런스 ${option.option_value}`;
        break;
        
      case '내구력':
        const currentDurability = parseInt(option.option_value) || 0;
        const maxDurability = parseInt(option.option_value2) || 1;
        text = `내구력 ${currentDurability}/${maxDurability}`;
        color = 'yellow';
        break;
        
      case '숙련':
        text = `숙련 ${option.option_value}`;
        break;
        
      case '남은 전용 해제 가능 횟수':
        text = ` 전용 아이템 (전용 일시 해제)\n남은 전용 해제 가능 횟수: ${option.option_value}`;
        color = 'yellow';
        break;
        
      case '전용 해제 거래 보증서 사용 불가':
        text = `전용 해제 거래 보증서 사용 불가`;
        color = 'yellow';
        break;
        
      case '피어싱 레벨':
        const baseLevel = option.option_value || "0";
        
        if (option.option_value2) {
          text = `피어싱 레벨 ${baseLevel}+ ${option.option_value2.substring(1)}`;
        } else {
          text = `피어싱 레벨 ${baseLevel}`;
        }
        color = 'blue';
        break;
        
      case '아이템 보호':
        if (option.option_value === '인챈트 추출') {
          text = `인챈트 추출 시 아이템 보호`;
        } else if (option.option_value === '인챈트 실패') {
          text = `인챈트 실패 시 아이템 보호`;
        } else if (option.option_value === '수리 실패') {
          text = `수리 실패 시 아이템 보호`;
        } else {
          text = `아이템 보호`;
        }
        color = 'yellow';
        break;
        
      case '인챈트':
        text = this.renderEnchant(option, context);
        break;
        
      case '일반 개조':
        text = `일반 개조 (${option.option_value}/${option.option_value2})`;
        break;
        
      case '보석 개조':
        text = `보석 개조`;
        break;
        
      case '장인 개조':
        text = `장인 개조`;
        break;
        
      case '특별 개조':
        text = `특별개조 <span class="item-pink">${option.option_sub_type}</span> <span class="item-pink">(${option.option_value}단계)</span>`;
        break;
        
      case '에르그':
        text = `등급 <span class="item-pink">${option.option_sub_type}</span> <span class="item-pink">(${option.option_value}/${option.option_value2}레벨)</span>`;
        break;
        
      case '세공 랭크':
        text = `${option.option_value}랭크`;
        color = 'pink';
        break;
        
      case '세공 옵션':
        const match = option.option_value.match(/(.*?)\((\d+)레벨:(.*)\)/);
        if (match) {
          const name = match[1].trim();
          const level = match[2];
          text = `- ${name} ${level}레벨`;
        } else {
          text = `- ${option.option_value}`;
        }
        color = 'blue';
      break;
        
      case '세트 효과':
        text = `- ${option.option_value} +${option.option_value2}`;
        color = 'blue';
        break;
        
      case '남은 거래 횟수':
        text = `남은 거래 가능 횟수 : ${option.option_value}`;
        color = 'yellow';
        break;
        
      default:
        text = `${optionType}: ${option.option_value}`;
        break;
    }
    
    return {
      text,
      color,
      filter: false
    };
  }
  
  renderEnchant(option, context) {
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
        const conditionMatch = effect.match(/(.*?때) (.*)/);
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
  }
  
  processSpecialFeatures(item, block) {
    const options = item.options || item.item_option || [];
    if (!Array.isArray(options)) return;
    
    // 장인 개조 특별 처리
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
        
        // 색상 처리
        if (content.color) {
          contentElement.className += ` ${this.colorClass[content.color]}`;
        }
        
        // HTML 태그가 있는 경우 innerHTML 사용
        if (content.text.includes('<')) {
          contentElement.innerHTML = content.text;
        } else {
          contentElement.textContent = content.text;
        }
        
        blockElement.appendChild(contentElement);
      });
      
      itemElement.appendChild(blockElement);
    });
    
    return itemElement;
  }
  
  renderMabinogiStyleTooltip(item) {
    // 최상위 툴팁 요소
    const tooltipElement = document.createElement('div');
    tooltipElement.className = 'item-tooltip';
    
    // 아이템 이름 헤더
    const header = document.createElement('div');
    header.className = 'tooltip-header';
    header.innerHTML = `<h3>${item.item_display_name || item.item_name || '이름 없음'}</h3>`;
    tooltipElement.appendChild(header);
    
    // 옵션 데이터 가져오기
    const options = item.options || item.item_option || [];
    
    // 옵션을 카테고리별로 그룹화
    const optionGroups = {
      '아이템 속성': [],
      '인챈트': [],
      '개조': [],
      '세공': [],
      '에르그': [],
      '세트 효과': [],
      '아이템 색상': [],
      '기타': []
    };
    
    // 옵션 정렬
    const orderedOptions = this.orderOptionsByImportance(options);
    
    // 옵션을 그룹별로 분류
    orderedOptions.forEach(option => {
      const type = option.option_type;
      
      if (type === '공격' || type === '부상률' || type === '크리티컬' || 
          type === '밸런스' || type === '내구력' || type === '숙련' || 
          type === '남은 전용 해제 가능 횟수' || type === '피어싱 레벨' || 
          type === '아이템 보호' || type === '방어력' || type === '보호' || 
          type === '마법 방어력' || type === '마법 보호') {
        optionGroups['아이템 속성'].push(option);
      } 
      else if (type === '인챈트') {
        optionGroups['인챈트'].push(option);
      } 
      else if (type === '일반 개조' || type === '보석 개조' || 
               type === '장인 개조' || type === '특별 개조') {
        optionGroups['개조'].push(option);
      } 
      else if (type === '세공 랭크' || type === '세공 옵션') {
        optionGroups['세공'].push(option);
      } 
      else if (type === '에르그') {
        optionGroups['에르그'].push(option);
      } 
      else if (type === '세트 효과') {
        optionGroups['세트 효과'].push(option);
      } 
      else if (type === '아이템 색상') {
        optionGroups['아이템 색상'].push(option);
      } 
      else {
        optionGroups['기타'].push(option);
      }
    });
    
    // 각 그룹별로 섹션 생성 - 직접 툴팁에 추가
    Object.entries(optionGroups).forEach(([groupName, groupOptions]) => {
      // 해당 그룹에 옵션이 있는 경우만 섹션 생성
      if (groupOptions.length > 0) {
        // 블록 생성
        const block = document.createElement('div');
        block.className = 'tooltip-block';
        
        // 제목 생성
        const title = document.createElement('div');
        title.className = 'tooltip-block-title';
        title.textContent = groupName;
        block.appendChild(title);
        
        // 해당 섹션의 옵션들 추가
        groupOptions.forEach(option => {
          this.renderTooltipOption(option, block);
        });
        
        // 완성된 블록을 직접 툴팁에 추가
        tooltipElement.appendChild(block);
      }
    });
    
    // 가격 정보 (맨 아래)
    if (item.auction_price_per_unit) {
      const formattedPrice = this.formatItemPrice(item.auction_price_per_unit);
      
      const priceElement = document.createElement('div');
      priceElement.className = 'tooltip-price';
      priceElement.innerHTML = `가격: <span class="${formattedPrice.class}">${formattedPrice.text}</span>`;
      tooltipElement.appendChild(priceElement);
    }
    
    return tooltipElement;
  }
  
  renderTooltipOption(option, block) {
    const optionType = option.option_type;
    
    // 특수 처리: 장인 개조
    if (optionType === '장인 개조') {
      // 장인 개조 텍스트 추가
      const labelElement = document.createElement('div');
      labelElement.className = 'tooltip-stat';
      labelElement.textContent = '장인 개조';
      block.appendChild(labelElement);
      
      // 효과들은 개별적으로 추가
      const modParts = option.option_value.split(',');
      modParts.forEach(part => {
        const effectElement = document.createElement('div');
        effectElement.className = 'tooltip-stat item-blue';
        effectElement.textContent = `- ${part.trim()}`;
        block.appendChild(effectElement);
      });
    } 
    // 특수 처리: 전용 아이템 해제
    else if (optionType === '남은 전용 해제 가능 횟수') {
      // 첫 번째 줄
      const firstLine = document.createElement('div');
      firstLine.className = 'tooltip-stat item-yellow';
      firstLine.textContent = '전용 아이템 (전용 일시 해제)';
      block.appendChild(firstLine);
      
      // 두 번째 줄
      const secondLine = document.createElement('div');
      secondLine.className = 'tooltip-stat item-yellow';
      secondLine.textContent = `남은 전용 해제 가능 횟수: ${option.option_value}`;
      block.appendChild(secondLine);
    }
    // 특수 처리: 인챈트
    else if (optionType === '인챈트') {
      // 인챈트 기본 정보 표시
      const context = {
        getEnchantMetadata: (type, name) => metadataLoader.getEnchantMetadata(type, name)
      };
      
      // 인챈트 이름과 랭크 추출
      const type = option.option_sub_type;
      const value = option.option_value;
      const nameMatch = value.match(/(.*?)\s*\(랭크 (\d+)\)/);
      let enchantName = value;
      let rankText = '';
      
      if (nameMatch) {
        enchantName = nameMatch[1].trim();
        rankText = `(랭크 ${nameMatch[2]})`;
      }
      
      // 메타데이터 조회
      const metadata = context.getEnchantMetadata(type, enchantName);
      
      // 기본 정보 요소 생성
      const enchantElement = document.createElement('div');
      enchantElement.className = 'tooltip-stat';
      enchantElement.innerHTML = `<span class="enchant-type">[${type}]</span> ${enchantName} <span class="item-pink">${rankText}</span>`;
      block.appendChild(enchantElement);
      
      // 인챈트 효과 처리 부분
      if (option.option_desc) {
        const effects = option.option_desc.split(',');
        
        effects.forEach(effect => {
          const effectText = effect.trim();
          // 조건부 효과에서 순수 효과만 추출
          const conditionMatch = effectText.match(/(.*?때) (.*)/);
          const cleanEffect = conditionMatch ? conditionMatch[2].trim() : effectText;
          
          // 부정적 효과 확인
          const isNegative = 
            (cleanEffect.includes('수리비') && cleanEffect.includes('증가')) || 
            (!cleanEffect.includes('수리비') && cleanEffect.includes('감소'));
          
          const effectElement = document.createElement('div');
          effectElement.className = 'tooltip-special-stat';
          
          // 기본 효과 텍스트 표시 (- 포함하여 적절한 색상 적용)
          const colorClass = isNegative ? 'item-red' : 'item-blue';
          let effectHTML = `<span class="${colorClass}">- ${cleanEffect}</span>`;
          
          // 메타데이터에서 유동 범위 확인 및 추가
          if (metadata && metadata.effects) {
            for (const metaEffect of metadata.effects) {
              const template = metaEffect.template;
              // 템플릿을 정규식 패턴으로 변환
              const pattern = template.replace(/\{value\}/g, '\\d+');
              
              if (new RegExp(pattern).test(cleanEffect) && metaEffect.variable) {
                // 변동 가능 효과인 경우 범위 정보 추가 (네이비 색상)
                effectHTML += ` <span class="item-navy">(${metaEffect.min}~${metaEffect.max})</span>`;
                break;
              }
            }
          }
          
          effectElement.innerHTML = effectHTML;
          block.appendChild(effectElement);
        });
      }
    }
    // 일반적인 옵션 처리
    else {
      // 옵션 처리
      const processedOption = this.processOption(option);
      
      if (processedOption) {
        const colorClass = processedOption.color ? this.colorClass[processedOption.color] : '';
        
        // HTML 내용이 있는 경우
        if (processedOption.text.includes('<')) {
          const statElement = document.createElement('div');
          statElement.className = `tooltip-stat ${colorClass}`;
          statElement.innerHTML = processedOption.text;
          block.appendChild(statElement);
        } 
        // 일반 텍스트에서 줄바꿈 처리
        else if (processedOption.text.includes('\n')) {
          const lines = processedOption.text.split('\n');
          lines.forEach(line => {
            const lineElement = document.createElement('div');
            lineElement.className = `tooltip-stat ${colorClass}`;
            lineElement.textContent = line.trim();
            block.appendChild(lineElement);
          });
        } else {
          const statElement = document.createElement('div');
          statElement.className = `tooltip-stat ${colorClass}`;
          statElement.textContent = processedOption.text;
          block.appendChild(statElement);
        }
      }
    }
  }
  
  formatItemPrice(price) {
    if (!price) return { text: '0 Gold', class: '' };
    
    // 기본 가격 (1~9999)
    if (price < 10000) {
      return {
        text: `${price.toLocaleString()} Gold`,
        class: ''
      };
    }
    
    // 만 단위 가격 (10000~99999999)
    if (price < 100000000) {
      const man = Math.floor(price / 10000);
      const remainder = price % 10000;
      
      let text = `${man}만`;
      if (remainder > 0) {
        text += `${remainder.toLocaleString()}`;
      }
      text += ' Gold';
      
      return {
        text: text,
        class: 'item-blue'
      };
    }
    
    // 억 단위 가격 (100000000~9999999999)
    if (price < 10000000000) {
      const eok = Math.floor(price / 100000000);
      const manRemainder = Math.floor((price % 100000000) / 10000);
      const remainder = price % 10000;
      
      let text = `${eok}억`;
      if (manRemainder > 0) {
        text += `${manRemainder}만`;
      }
      if (remainder > 0) {
        text += `${remainder.toLocaleString()}`;
      }
      text += ' Gold';
      
      return {
        text: text,
        class: 'item-red'
      };
    }
    
    // 100억 이상 가격
    const eok = Math.floor(price / 100000000);
    const manRemainder = Math.floor((price % 100000000) / 10000);
    const remainder = price % 10000;
    
    let text = `${eok}억`;
    if (manRemainder > 0) {
      text += `${manRemainder}만`;
    }
    if (remainder > 0) {
      text += `${remainder.toLocaleString()}`;
    }
    text += ' Gold';
    
    return {
      text: text,
      class: 'item-orange'
    };
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const optionRenderer = new OptionRenderer();
export default optionRenderer;
