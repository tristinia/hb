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
      '공격', '부상률', '크리티컬', '밸런스', '방어력', '보호', '마법 방어력', '마법 보호', '내구력', '숙련',
      '남은 전용 해제 가능 횟수', '전용 해제 거래 보증서 사용 불가',
      '피어싱 레벨', '아이템 보호', '인챈트', '일반 개조', '보석 개조',
      '장인 개조', '특별 개조', '에르그', '세공 랭크', '세공 옵션', '세트 효과', '남은 거래 횟수'
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
      
      case '방어력':
        text = `방어력 ${option.option_value}`;
        break;
        
      case '보호':
        text = `보호 ${option.option_value}`;
        break;
        
      case '마법 방어력':
        text = `마법 방어력 ${option.option_value}`;
        break;
        
      case '마법 보호':
        text = `마법 보호 ${option.option_value}`;
        break;
        
      case '내구력':
        const currentDurability = parseInt(option.option_value) || 0;
        const maxDurability = parseInt(option.option_value2) || 1;
        text = `내구력 ${currentDurability}/${maxDurability}`;
        
        // 현재 내구력이 최대 내구력의 20% 이하인지 확인 (올림 적용)
        const durabilityThreshold = Math.ceil(maxDurability * 0.2);
        if (currentDurability <= durabilityThreshold) {
          color = 'red'; // 20% 이하면 빨간색
        } else {
          color = 'yellow'; // 그 외에는 노란색
        }
        break;
        
      case '숙련':
        text = `숙련 ${option.option_value}`;
        break;
        
      case '남은 전용 해제 가능 횟수':
        text = ` 전용 아이템(전용 일시 해제)\n남은 전용 해제 가능 횟수: ${option.option_value}`;
        color = 'yellow';
        break;
        
      case '전용 해제 거래 보증서 사용 불가':
        text = `전용 해제 거래 보증서 사용 불가`;
        color = 'red';
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
          text = `#인챈트 추출 시 아이템 보호`;
        } else if (option.option_value === '인챈트 실패') {
          text = `#인챈트 실패 시 아이템 보호`;
        } else if (option.option_value === '수리 실패') {
          text = `#수리 실패 시 아이템 보호`;
        } else {
          text = `#아이템 보호`;
        }
        color = 'yellow';
        break;
        
      case '인챈트':
        text = this.renderEnchant(option, context);
        break;
        
      case '일반 개조':
        text = `일반 개조(${option.option_value}/${option.option_value2})`;
        break;
        
      case '보석 개조':
        text = `보석 강화`;
        break;
        
      case '장인 개조':
        text = `장인 개조`;
        break;
        
      case '특별 개조':
        text = `특별 개조 <span class="item-pink">${option.option_sub_type} (${option.option_value}단계)</span>`;
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
      '아이템 색상': []
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
          type === '마법 방어력' || type === '마법 보호' ||
          type === '전용 해제 거래 보증서 사용 불가' || type === '인챈트 불가능') {
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
    });
    
    // 각 그룹 렌더링
    Object.entries(optionGroups).forEach(([groupName, groupOptions]) => {
      if (groupOptions.length > 0) {
        // 인챈트 불가능 옵션을 인챈트 그룹에도 추가
        if (groupName === '인챈트') {
          const notEnchantableOption = options.find(opt => 
            opt.option_type === '인챈트 불가능' && opt.option_value === 'true'
          );
          
          if (notEnchantableOption && !groupOptions.includes(notEnchantableOption)) {
            // 인챈트 불가능 옵션을 인챈트 그룹의 맨 앞에 추가
            groupOptions.unshift(notEnchantableOption);
          }
        }
        
        // 섹션 블록 생성
        const sectionBlock = this.createSectionBlock(groupName, groupOptions);
        if (sectionBlock) {
          tooltipElement.appendChild(sectionBlock);
        }
      }
    });
    
    // 가격 정보 (맨 아래)
    if (item.auction_price_per_unit) {
      const formattedPrice = this.formatItemPrice(item.auction_price_per_unit);
      
      const priceElement = document.createElement('div');
      priceElement.className = 'tooltip-price';
      
      // 가격을 먼저 표시
      let tooltipText = `가격: <span class="${formattedPrice.class}">${formattedPrice.text}</span>`;
      
      // 아이템이 여러 개인 경우 수량 정보 표시
      if (item.item_count && item.item_count > 1) {
        tooltipText += ` 수량: <span class="item-yellow">${item.item_count}</span>`;
      }
      
      priceElement.innerHTML = tooltipText;
      tooltipElement.appendChild(priceElement);
    }
    
    return tooltipElement;
    }
  
  createSectionBlock(groupName, options) {
    const block = document.createElement('div');
    block.className = 'tooltip-block';
    
    // 섹션 제목
    const title = document.createElement('div');
    title.className = 'tooltip-block-title';
    title.textContent = groupName;
    block.appendChild(title);
    
    // 각 그룹별 렌더링 로직 적용
    switch(groupName) {
      case '아이템 속성':
        this.renderItemAttributesSection(options, block);
        break;
      case '인챈트':
        this.renderEnchantsSection(options, block);
        break;
      case '개조':
        this.renderModificationsSection(options, block);
        break;
      case '세공':
        this.renderReforgeSection(options, block);
        break;
      case '에르그':
        this.renderErgSection(options, block);
        break;
      case '세트 효과':
        this.renderSetEffectSection(options, block);
        break;
      case '아이템 색상':
        this.renderItemColorSection(options, block);
        break;
      default:
        // 기타 옵션 기본 렌더링 (제거됨 - 더 이상 '기타' 카테고리 없음)
        break;
    }
    
    return block;
  }
  
  renderItemAttributesSection(options, block) {
    // 아이템 속성을 특정 순서로 정렬하기 위한 순서 배열
    const attributeOrder = [
      '공격', '부상률', '크리티컬', '밸런스', '방어력', '보호', '마법 방어력', '마법 보호', 
      '내구력', '숙련', '남은 전용 해제 가능 횟수', '전용 해제 거래 보증서 사용 불가', 
      '피어싱 레벨', '인챈트 불가능', '아이템 보호'
    ];
    
    // 인챈트 불가능 옵션 확인
    const notEnchantableOption = options.find(opt => 
      opt.option_type === '인챈트 불가능' && opt.option_value === 'true'
    );
    
    // 방어 관련 속성 확인
    const hasDefenseValues = options.some(opt => 
      opt.option_type === '방어력' || opt.option_type === '보호'
    );
    
    const hasMagicDefenseValues = options.some(opt => 
      opt.option_type === '마법 방어력' || opt.option_type === '마법 보호'
    );
    
    // 아이템 보호 옵션을 순서대로 수집
    const protectionOptions = {
      '인챈트 추출': null,
      '인챈트 실패': null,
      '수리 실패': null
    };
    
    // 모든 아이템 보호 옵션 찾기
    options.forEach(option => {
      if (option.option_type === '아이템 보호') {
        const value = option.option_value;
        if (value in protectionOptions) {
          protectionOptions[value] = option;
        }
      }
    });
    
    // 아이템 속성을 피어싱 기준으로 그룹화
    const upperGroup = []; // 피어싱 위쪽 그룹
    const lowerGroup = []; // 피어싱 아래쪽 그룹
    let piercingOption = null;
    
    // 피어싱 위치 찾기
    const piercingIndex = options.findIndex(opt => opt.option_type === '피어싱 레벨');
    
    // 방어 관련 속성 보강
    const defenseOptions = [];
    
    // 방어력 속성 보강
    if (hasDefenseValues || hasMagicDefenseValues) {
      // 방어력
      const defenseOpt = options.find(opt => opt.option_type === '방어력');
      if (defenseOpt) {
        defenseOptions.push(defenseOpt);
      } else {
        // 방어력 속성이 없으면 0으로 가상 속성 추가
        defenseOptions.push({
          option_type: '방어력',
          option_value: '0'
        });
      }
      
      // 보호
      const protectionOpt = options.find(opt => opt.option_type === '보호');
      if (protectionOpt) {
        defenseOptions.push(protectionOpt);
      } else {
        // 보호 속성이 없으면 0으로 가상 속성 추가
        defenseOptions.push({
          option_type: '보호',
          option_value: '0'
        });
      }
    }
    
    // 마법 방어 관련 속성 보강
    if (hasMagicDefenseValues) {
      // 마법 방어력
      const magicDefenseOpt = options.find(opt => opt.option_type === '마법 방어력');
      if (magicDefenseOpt) {
        defenseOptions.push(magicDefenseOpt);
      } else {
        // 마법 방어력 속성이 없으면 0으로 가상 속성 추가
        defenseOptions.push({
          option_type: '마법 방어력',
          option_value: '0'
        });
      }
      
      // 마법 보호
      const magicProtectionOpt = options.find(opt => opt.option_type === '마법 보호');
      if (magicProtectionOpt) {
        defenseOptions.push(magicProtectionOpt);
      } else {
        // 마법 보호 속성이 없으면 0으로 가상 속성 추가
        defenseOptions.push({
          option_type: '마법 보호',
          option_value: '0'
        });
      }
    }
    
    if (piercingIndex >= 0) {
      // 피어싱이 있는 경우
      piercingOption = options[piercingIndex];
      
      // 옵션 분류
      options.forEach(option => {
        const type = option.option_type;
        
        // 아이템 보호 옵션 제외 (나중에 별도 처리)
        if (type === '아이템 보호') return;
        // 인챈트 불가능 옵션은 정상적으로 처리되도록 수정
        
        // 방어 속성은 이미 defenseOptions에 수집됨
        if (defenseOptions.some(o => o.option_type === type)) return;
        
        // 옵션 타입에 따라 그룹에 추가
        const optionIndex = attributeOrder.indexOf(type);
        if (optionIndex < attributeOrder.indexOf('피어싱 레벨')) {
          upperGroup.push(option);
        } else if (type !== '피어싱 레벨') {
          lowerGroup.push(option);
        }
      });
      
      // 보강된 방어 속성 추가
      defenseOptions.forEach(opt => {
        // 방어 속성은 항상 upperGroup에 추가
        upperGroup.push(opt);
      });
      
      // 인챈트 불가능 옵션 추가
      if (notEnchantableOption) {
        lowerGroup.push(notEnchantableOption);
      }
    } else {
      // 피어싱이 없는 경우 - 전용해제/아이템보호 기준으로 나눔
      options.forEach(option => {
        const type = option.option_type;
        
        // 아이템 보호 옵션 제외 (나중에 별도 처리)
        if (type === '아이템 보호') return;
        // 인챈트 불가능 옵션은 정상적으로 처리되도록 수정
        
        // 방어 속성은 이미 defenseOptions에 수집됨
        if (defenseOptions.some(o => o.option_type === type)) return;
        
        if (type === '남은 전용 해제 가능 횟수' || type === '전용 해제 거래 보증서 사용 불가') {
          lowerGroup.push(option);
        } else {
          upperGroup.push(option);
        }
      });
      
      // 보강된 방어 속성 추가
      defenseOptions.forEach(opt => {
        // 방어 속성은 항상 upperGroup에 추가
        upperGroup.push(opt);
      });
      
      // 인챈트 불가능 옵션 추가
      if (notEnchantableOption) {
        lowerGroup.push(notEnchantableOption);
      }
    }
    
    // 정렬
    upperGroup.sort((a, b) => attributeOrder.indexOf(a.option_type) - attributeOrder.indexOf(b.option_type));
    lowerGroup.sort((a, b) => attributeOrder.indexOf(a.option_type) - attributeOrder.indexOf(b.option_type));
    
    // 상단 그룹 렌더링
    upperGroup.forEach((option, index) => {
      const isLast = index === upperGroup.length - 1;
      
      // 간격 클래스
      let gapClass = 'gap-xxs';
      if (isLast) {
        // 피어싱이 있거나 하단 그룹이 있는 경우에만 md 간격 추가
        if (piercingOption || lowerGroup.length > 0) {
          gapClass = 'gap-md';
        } else {
          gapClass = ''; // 아무것도 없으면 간격 없음
        }
      }
      
      this.createOptionElement(option, block, gapClass);
    });
    
    // 피어싱 렌더링
    if (piercingOption) {
      // 하단 그룹(아이템 보호, 인챈트 불가능)이 있는지 확인
      const hasLowerGroup = lowerGroup.length > 0;
      const hasProtectionOptions = Object.values(protectionOptions).some(opt => opt !== null);
      
      // 하단 그룹이 있으면 md 간격, 없으면 간격 없음
      const gapClass = (hasLowerGroup || hasProtectionOptions) ? 'gap-md' : '';
      this.createOptionElement(piercingOption, block, gapClass);
    }
    
    // 하단 그룹 렌더링 (인챈트 불가능 등)
    lowerGroup.forEach((option, index) => {
      const isLast = index === lowerGroup.length - 1;
      // 아이템 보호 옵션이 있는지 확인
      const hasProtectionOptions = Object.values(protectionOptions).some(opt => opt !== null);
      
      // 마지막 항목이고 아이템 보호가 없으면 간격 없음, 아니면 xxs
      const gapClass = isLast && !hasProtectionOptions ? '' : 'gap-xxs';
      
      // 인챈트 불가능 속성인 경우 특별 처리
      if (option.option_type === '인챈트 불가능' && option.option_value === 'true') {
        const optionElement = document.createElement('div');
        optionElement.className = `tooltip-stat item-red ${gapClass}`;
        optionElement.textContent = '#인챈트 부여 불가';
        block.appendChild(optionElement);
      } else {
        this.createOptionElement(option, block, gapClass);
      }
    });
    
    // 마지막으로 아이템 보호 옵션 순서대로 렌더링
    const protectionValues = Object.keys(protectionOptions);
    protectionValues.forEach((value, index) => {
      const option = protectionOptions[value];
      if (option) {
        const isLast = index === protectionValues.length - 1;
        const gapClass = isLast ? '' : 'gap-xxs';
        this.createOptionElement(option, block, gapClass);
      }
    });
  }
  
  renderEnchantsSection(options, block) {
    // 인챈트 불가능 확인
    const notEnchantableOption = options.find(opt => 
      opt.option_type === '인챈트 불가능' && opt.option_value === 'true'
    );
    
    // 접두/접미 구분
    const prefixEnchants = options.filter(opt => opt.option_sub_type === '접두');
    const suffixEnchants = options.filter(opt => opt.option_sub_type === '접미');
    
    // 인챈트 불가능 표시 - 가장 먼저 표시
    if (notEnchantableOption) {
      const notEnchantableElement = document.createElement('div');
      notEnchantableElement.className = 'tooltip-stat item-red gap-md';
      notEnchantableElement.textContent = '인챈트 부여 불가';
      block.appendChild(notEnchantableElement);
    }
    
    // 접두 인챈트 렌더링
    prefixEnchants.forEach((enchant, index) => {
      // 인챈트 기본 정보
      const context = {
        getEnchantMetadata: (type, name) => metadataLoader.getEnchantMetadata(type, name)
      };
      
      // 접두 이름과 랭크 추출
      const type = enchant.option_sub_type;
      const value = enchant.option_value;
      const nameMatch = value.match(/(.*?)\s*\(랭크 (\d+)\)/);
      let enchantName = value;
      let rankText = '';
      
      if (nameMatch) {
        enchantName = nameMatch[1].trim();
        rankText = `(랭크 ${nameMatch[2]})`;
      }
      
      // 인챈트 제목 요소
      const enchantElement = document.createElement('div');
      enchantElement.className = 'tooltip-stat gap-xs';
      enchantElement.innerHTML = `<span class="enchant-type">[${type}]</span> ${enchantName} <span class="item-pink">${rankText}</span>`;
      block.appendChild(enchantElement);
      
      // 인챈트 효과 처리
      if (enchant.option_desc) {
        const effects = enchant.option_desc.split(',');
        
        effects.forEach((effect, i) => {
          const isLastEffect = i === effects.length - 1;
          // 마지막 효과이고 접미사가 있으면 일반 간격, 없으면 짧은 간격
          const gapClass = isLastEffect && suffixEnchants.length > 0 ? 'gap-md' : 'gap-xxs';
          
          const effectText = effect.trim();
          const conditionMatch = effectText.match(/(.*?때) (.*)/);
          const cleanEffect = conditionMatch ? conditionMatch[2].trim() : effectText;
          
          const isNegative = 
            (cleanEffect.includes('수리비') && cleanEffect.includes('증가')) || 
            (!cleanEffect.includes('수리비') && cleanEffect.includes('감소'));
          
          const effectElement = document.createElement('div');
          effectElement.className = `tooltip-special-stat ${gapClass}`;
          
          const colorClass = isNegative ? 'item-red' : 'item-blue';
          effectElement.innerHTML = `<span class="${colorClass}">- ${cleanEffect}</span>`;
          
          block.appendChild(effectElement);
        });
      }
    });
    
    // 접미 인챈트 렌더링 (접두와 유사)
    suffixEnchants.forEach((enchant, index) => {
      const context = {
        getEnchantMetadata: (type, name) => metadataLoader.getEnchantMetadata(type, name)
      };
      
      const type = enchant.option_sub_type;
      const value = enchant.option_value;
      const nameMatch = value.match(/(.*?)\s*\(랭크 (\d+)\)/);
      let enchantName = value;
      let rankText = '';
      
      if (nameMatch) {
        enchantName = nameMatch[1].trim();
        rankText = `(랭크 ${nameMatch[2]})`;
      }
      
      const enchantElement = document.createElement('div');
      enchantElement.className = 'tooltip-stat gap-xs';
      enchantElement.innerHTML = `<span class="enchant-type">[${type}]</span> ${enchantName} <span class="item-pink">${rankText}</span>`;
      block.appendChild(enchantElement);
      
      if (enchant.option_desc) {
        const effects = enchant.option_desc.split(',');
        
        effects.forEach((effect, i) => {
          const isLast = i === effects.length - 1;
          const gapClass = isLast ? '' : 'gap-xxs';
          
          const effectText = effect.trim();
          const conditionMatch = effectText.match(/(.*?때) (.*)/);
          const cleanEffect = conditionMatch ? conditionMatch[2].trim() : effectText;
          
          const isNegative = 
            (cleanEffect.includes('수리비') && cleanEffect.includes('증가')) || 
            (!cleanEffect.includes('수리비') && cleanEffect.includes('감소'));
          
          const effectElement = document.createElement('div');
          effectElement.className = `tooltip-special-stat ${gapClass}`;
          
          const colorClass = isNegative ? 'item-red' : 'item-blue';
          effectElement.innerHTML = `<span class="${colorClass}">- ${cleanEffect}</span>`;
          
          block.appendChild(effectElement);
        });
      }
    });
  }
  
  renderModificationsSection(options, block) {
    // 개조 타입별 추출
    const normalMod = options.find(opt => opt.option_type === '일반 개조');
    const gemMod = options.find(opt => opt.option_type === '보석 개조');
    const masterMod = options.find(opt => opt.option_type === '장인 개조');
    const specialMod = options.find(opt => opt.option_type === '특별 개조');
    
    // 일반 개조와 보석 개조 처리
    if (normalMod || gemMod) {
      let text = '';
      if (normalMod) {
        text += `일반 개조(${normalMod.option_value}/${normalMod.option_value2})`;
        if (gemMod) {
          text += ', 보석 강화';
        }
      } else if (gemMod) {
        text += '보석 강화';
      }
      
      const modElement = document.createElement('div');
      modElement.className = 'tooltip-stat gap-md';
      modElement.textContent = text;
      block.appendChild(modElement);
    }
    
    // 장인 개조 처리
    if (masterMod) {
      // 장인 개조 타이틀
      const masterModTitle = document.createElement('div');
      masterModTitle.className = 'tooltip-stat gap-xs';
      masterModTitle.textContent = '장인 개조';
      block.appendChild(masterModTitle);
      
      // 장인 개조 효과 처리
      const modParts = masterMod.option_value.split(',');
      modParts.forEach((part, index) => {
        const isLast = index === modParts.length - 1;
        const gapClass = isLast && specialMod ? 'gap-md' : (isLast ? '' : 'gap-xxs');
        
        const effectElement = document.createElement('div');
        effectElement.className = `tooltip-stat item-blue ${gapClass}`;
        effectElement.textContent = `- ${part.trim()}`;
        block.appendChild(effectElement);
      });
    }
    
    // 특별 개조 처리
    if (specialMod) {
      const specialModElement = document.createElement('div');
      specialModElement.className = 'tooltip-stat';
      specialModElement.innerHTML = `특별 개조 <span class="item-pink">${specialMod.option_sub_type} (${specialMod.option_value}단계)</span>`;
      block.appendChild(specialModElement);
    }
  }
  
  renderReforgeSection(options, block) {
    // 세공 랭크 찾기
    const reforgeRank = options.find(opt => opt.option_type === '세공 랭크');
    const reforgeOptions = options.filter(opt => opt.option_type === '세공 옵션');
    
    // 세공 랭크 표시
    if (reforgeRank) {
      const rankElement = document.createElement('div');
      rankElement.className = 'tooltip-stat item-pink gap-xs';
      rankElement.textContent = `${reforgeRank.option_value}랭크`;
      block.appendChild(rankElement);
    }
    
    // 세공 옵션 표시
    reforgeOptions.forEach((option, index) => {
      const isLast = index === reforgeOptions.length - 1;
      const gapClass = isLast ? '' : 'gap-xxs';
      
      const match = option.option_value.match(/(.*?)\((\d+)레벨:(.*)\)/);
      const optionElement = document.createElement('div');
      optionElement.className = `tooltip-stat item-blue ${gapClass}`;
      
      if (match) {
        const name = match[1].trim();
        const level = match[2];
        optionElement.textContent = `- ${name} ${level}레벨`;
      } else {
        optionElement.textContent = `- ${option.option_value}`;
      }
      
      block.appendChild(optionElement);
    });
  }
  
  renderErgSection(options, block) {
    options.forEach(option => {
      const optionElement = document.createElement('div');
      optionElement.className = 'tooltip-stat item-pink';
      optionElement.innerHTML = `등급 <span class="item-pink">${option.option_sub_type}</span> <span class="item-pink">(${option.option_value}/${option.option_value2}레벨)</span>`;
      block.appendChild(optionElement);
    });
  }
  
  renderSetEffectSection(options, block) {
    options.forEach((option, index) => {
      const isLast = index === options.length - 1;
      const gapClass = isLast ? '' : 'gap-xxs';
      
      const optionElement = document.createElement('div');
      optionElement.className = `tooltip-stat item-blue ${gapClass}`;
      optionElement.textContent = `- ${option.option_value} +${option.option_value2}`;
      block.appendChild(optionElement);
    });
  }
  
  renderItemColorSection(options, block) {
    options.forEach((option, index) => {
      const isLast = index === options.length - 1;
      const gapClass = isLast ? '' : 'gap-xxs';
      
      let colorText = `${option.option_sub_type}: `;
      if (option.option_value) {
        colorText += option.option_value;
      }
      if (option.option_desc) {
        colorText += ` ${option.option_desc}`;
      }
      
      const optionElement = document.createElement('div');
      optionElement.className = `tooltip-stat ${gapClass}`;
      optionElement.textContent = colorText;
      block.appendChild(optionElement);
    });
  }
  
  createOptionElement(option, block, gapClass) {
    // 옵션 처리하여 HTML 또는 텍스트 내용 생성
    const processedOption = this.processTooltipOption(option);
    if (!processedOption) return;
    
    // HTML 내용이 있는 경우
    if (processedOption.html) {
      const statElement = document.createElement('div');
      statElement.className = `tooltip-stat ${gapClass || ''}`;
      if (processedOption.colorClass) {
        statElement.classList.add(processedOption.colorClass);
      }
      statElement.innerHTML = processedOption.html;
      block.appendChild(statElement);
    } 
    // 일반 텍스트에서 줄바꿈 처리
    else if (processedOption.text.includes('\n')) {
      const lines = processedOption.text.split('\n');
      lines.forEach((line, i) => {
        const lineElement = document.createElement('div');
        lineElement.className = `tooltip-stat ${i < lines.length - 1 ? 'gap-xxs' : gapClass || ''}`;
        if (processedOption.colorClass) {
          lineElement.classList.add(processedOption.colorClass);
        }
        // 줄바꿈 처리 시 trim()을 제거하여 앞부분 공백 유지
        lineElement.textContent = line;
        block.appendChild(lineElement);
      });
    } else {
      const statElement = document.createElement('div');
      statElement.className = `tooltip-stat ${gapClass || ''}`;
      if (processedOption.colorClass) {
        statElement.classList.add(processedOption.colorClass);
      }
      statElement.textContent = processedOption.text;
      block.appendChild(statElement);
    }
  }
  
  processTooltipOption(option) {
    // 옵션 타입별 처리
    switch (option.option_type) {
      case '공격':
        return {
          text: `공격 ${option.option_value}~${option.option_value2}`
        };
        
      case '부상률':
        const minValue = option.option_value.toString().replace('%', '');
        const maxValue = option.option_value2.toString().replace('%', '');
        return {
          text: `부상률 ${minValue}~${maxValue}%`
        };
        
      case '크리티컬':
        return {
          text: `크리티컬 ${option.option_value}`
        };
        
      case '밸런스':
        return {
          text: `밸런스 ${option.option_value}`
        };
      
      case '방어력':
        return {
          text: `방어력 ${option.option_value}`
        };
        
      case '보호':
        return {
          text: `보호 ${option.option_value}`
        };
        
      case '마법 방어력':
        return {
          text: `마법 방어력 ${option.option_value}`
        };
        
      case '마법 보호':
        return {
          text: `마법 보호 ${option.option_value}`
        };
        
      case '내구력':
        const currentDurability = parseInt(option.option_value) || 0;
        const maxDurability = parseInt(option.option_value2) || 1;
        
        // 현재 내구력이 최대 내구력의 20% 이하인지 확인 (올림 적용)
        const durabilityThreshold = Math.ceil(maxDurability * 0.2);
        
        return {
          text: `내구력 ${currentDurability}/${maxDurability}`,
          colorClass: currentDurability <= durabilityThreshold ? 'item-red' : 'item-yellow'
        };
        
      case '숙련':
        return {
          text: `숙련 ${option.option_value}`
        };
        
      case '남은 전용 해제 가능 횟수':
        return {
          text: ` 전용 아이템(전용 일시 해제)\n남은 전용 해제 가능 횟수: ${option.option_value}`,
          colorClass: 'item-yellow'
        };
        
      case '전용 해제 거래 보증서 사용 불가':
        return {
          text: `전용 해제 거래 보증서 사용 불가`,
          colorClass: 'item-red'
        };
        
      case '피어싱 레벨':
        const baseLevel = option.option_value || "0";
        let text;
        
        if (option.option_value2) {
          text = `피어싱 레벨 ${baseLevel}+ ${option.option_value2.substring(1)}`;
        } else {
          text = `피어싱 레벨 ${baseLevel}`;
        }
        
        return {
          text,
          colorClass: 'item-blue'
        };

      case '인챈트 불가능':
        if (option.option_value === 'true') {
          return {
            text: `#인챈트 부여 불가`,
            colorClass: 'item-red'
          };
        }
        return null;
        
      case '아이템 보호':
        let protectionText;
        
        if (option.option_value === '인챈트 추출') {
          protectionText = `#인챈트 추출 시 아이템 보호`;
        } else if (option.option_value === '인챈트 실패') {
          protectionText = `#인챈트 실패 시 아이템 보호`;
        } else if (option.option_value === '수리 실패') {
          protectionText = `#수리 실패 시 아이템 보호`;
        } else {
          protectionText = `#아이템 보호`;
        }
        
        return {
          text: protectionText,
          colorClass: 'item-yellow'
        };
        
      case '특별 개조':
        return {
          html: `특별 개조 <span class="item-pink">${option.option_sub_type} (${option.option_value}단계)</span>`,
          colorClass: ''
        };
        
      default:
        return {
          text: `${option.option_type}: ${option.option_value}`
        };
    }
  }
  
  formatItemPrice(price) {
    if (!price) return { text: '0', class: '' };
    
    // 기본 가격 (1~9999)
    if (price < 10000) {
      return {
        text: `${price}`,
        class: ''
      };
    }
    
    // 만 단위 가격 (10000~99999999)
    if (price < 100000000) {
      const man = Math.floor(price / 10000);
      const remainder = price % 10000;
      
      let text = `${man}만`;
      if (remainder > 0) {
        text += `${remainder}`;
      }
      
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
        text += `${remainder}`;
      }
      
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
      text += `${remainder}`;
    }
    
    return {
      text: text,
      class: 'item-orange'
    };
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const optionRenderer = new OptionRenderer();
export default optionRenderer;
