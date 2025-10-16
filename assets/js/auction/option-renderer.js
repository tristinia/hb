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
      navy: 'item-navy',
      gray: 'item-gray'
    };
    
    this.debug = false;
    this.currentItem = null;
  }
  
  logDebug(...args) {
    if (this.debug) {
      console.log('[OptionRenderer]', ...args);
    }
  }
  
  renderMabinogiStyleTooltip(item) {
    // 현재 아이템 저장
    this.currentItem = item;
    
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
          type === '전용 해제 거래 보증서 사용 불가' || type === '인챈트 불가능' || 
          type === '인챈트 종류' || type === '내구도' || type === '남은 거래 횟수' ||
          type === '색상' || type === '품질' || type === '크기' || type === '남은 사용 횟수' ||
          type === '토템 효과' || type === '토템 추가 옵션' || type === '토템 강화 제한' ||
          type === '펫 정보' || type === '사용 효과' || type === '조미료 효과' ||
          type === '에코스톤 등급' || type === '에코스톤 고유 능력' || type === '에코스톤 각성 능력') {
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
  
  orderOptionsByImportance(options) {
    // 주요 속성 순서 정의
    const optionOrder = [
      '공격', '부상률', '크리티컬', '밸런스', '방어력', '보호', '마법 방어력', '마법 보호', '내구력', '숙련',
      '남은 전용 해제 가능 횟수', '전용 해제 거래 보증서 사용 불가', '인챈트 종류',
      '색상', '품질', '크기', '토템 효과', '토템 추가 옵션', '토템 강화 제한', '펫 정보',
      '피어싱 레벨', 
      '사용 효과', '조미료 효과', '에코스톤 등급', '에코스톤 고유 능력', '에코스톤 각성 능력', 
      '내구도', '남은 거래 횟수', '남은 사용 횟수', '인챈트 불가능', '아이템 보호',
      '인챈트', '일반 개조', '보석 개조', '장인 개조', '특별 개조', '에르그', '세공 랭크', '세공 옵션', '세트 효과'
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
        break;
    }
    
    return block;
  }

  renderItemAttributesSection(options, block) {
    // 1. 속성을 6개 그룹으로 분류
    // === 묶음 1: 기본 속성 + 전용 관련 + 새 속성들 ===
    const group1 = [];
    
    // === 묶음 2: 피어싱 레벨 ===
    const piercingOption = options.find(opt => opt.option_type === '피어싱 레벨');
    
    // === 묶음 3: 사용 효과, 조미료 효과, 내구도, 거래 횟수, 남은 사용 횟수, 인챈트 불가능, 아이템 보호 ===
    const group3 = [];
    
    // === 묶음 4: 에코스톤 등급 ===
    const ecostoneRankOption = options.find(opt => opt.option_type === '에코스톤 등급');
    
    // === 묶음 5: 에코스톤 고유 능력 ===
    const ecostoneAbilityOptions = options.filter(opt => opt.option_type === '에코스톤 고유 능력');
    
    // === 묶음 6: 에코스톤 각성 능력 ===
    const ecostoneAwakeningOptions = options.filter(opt => opt.option_type === '에코스톤 각성 능력');
    
    // 인챈트 종류 옵션 찾기 (group1에 속함)
    const enchantTypeOptions = options.filter(opt => opt.option_type === '인챈트 종류');
    
    // 인챈트 불가능 옵션 확인 (group3에 속함)
    const notEnchantableOption = options.find(opt => 
      opt.option_type === '인챈트 불가능' && opt.option_value === 'true'
    );

    // 내구도 옵션 찾기 (group3에 속함)
    const durabilityOption = options.find(opt => opt.option_type === '내구도');
    
    // 남은 거래 횟수 옵션 찾기 (group3에 속함)
    const tradeCountOption = options.find(opt => opt.option_type === '남은 거래 횟수');
    
    // 남은 사용 횟수 옵션 찾기 (group3에 속함)
    const usageCountOption = options.find(opt => opt.option_type === '남은 사용 횟수');
    
    // 사용 효과 옵션 (group3에 속함)
    const usageEffectOptions = options.filter(opt => opt.option_type === '사용 효과');
    
    // 조미료 효과 옵션 (group3에 속함)
    const spiceEffectOptions = options.filter(opt => opt.option_type === '조미료 효과');
    
    // 토템 관련 옵션 분류
    const totemEffectOptions = options.filter(opt => opt.option_type === '토템 효과');
    const totemAdditionalOptions = options.filter(opt => opt.option_type === '토템 추가 옵션');
    const totemLimitOptions = options.filter(opt => opt.option_type === '토템 강화 제한');
    
    // 펫 정보 옵션 처리
    const petInfoOptions = options.filter(opt => opt.option_type === '펫 정보');
    if (petInfoOptions.length > 0) {
      // 펫 정보의 경우 한 번에 처리하기 위해 별도 처리
      const petInfo = this.processAllPetInfo(petInfoOptions);
      if (petInfo) {
        group1.push({
          option_type: 'processed_pet_info',
          option_value: petInfo
        });
      }
    }
    
    // 토템 강화 제한이 있는지 확인
    const hasTotemLimits = totemLimitOptions.length > 0;
    
    // 토템 효과나 추가 옵션이 없지만 강화 제한이 있는 경우 "없음" 옵션 생성
    if (hasTotemLimits) {
      if (totemEffectOptions.length === 0) {
        group1.push({
          option_type: 'totem_none_effect',
          option_value: '일반 옵션 : 없음'
        });
      }
      
      if (totemAdditionalOptions.length === 0) {
        group1.push({
          option_type: 'totem_none_additional',
          option_value: '추가 옵션 : 없음'
        });
      }
    }
    
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

    const hasProtectionOptions = Object.values(protectionOptions).some(opt => opt !== null);
    
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
    
    // 각 옵션을 적절한 그룹에 할당
    options.forEach(option => {
      const type = option.option_type;
      
      // group3에 속하는 옵션
      if (type === '내구도' || type === '남은 거래 횟수' || type === '남은 사용 횟수' ||
          type === '인챈트 불가능' || type === '아이템 보호' || 
          type === '사용 효과' || type === '조미료 효과') {
        return; // 별도 처리
      }
      
      // 피어싱 레벨은 group2에 할당
      if (type === '피어싱 레벨') {
        return; // 별도 처리
      }
      
      // 인챈트 종류도 별도로 처리
      if (type === '인챈트 종류') {
        return; // 별도 처리
      }
      
      // 에코스톤 관련 속성은 별도 처리
      if (type === '에코스톤 등급' || type === '에코스톤 고유 능력' || type === '에코스톤 각성 능력') {
        return; // 별도 처리
      }
      
      // 토템 관련 속성은 별도 처리
      if (type === '토템 효과' || type === '토템 추가 옵션' || type === '토템 강화 제한' ||
          type === 'totem_none_effect' || type === 'totem_none_additional') {
        if (type !== 'totem_none_effect' && type !== 'totem_none_additional') {
          group1.push(option);
        }
        return;
      }
      
      // 펫 정보는 processAllPetInfo에서 처리
      if (type === '펫 정보' || type === 'processed_pet_info') {
        if (type === 'processed_pet_info') {
          return; // 이미 처리됨
        }
        return; // 별도 처리
      }
      
      // 방어 속성은 이미 defenseOptions에 수집됨
      if (defenseOptions.some(o => o.option_type === type)) {
        return;
      }
      
      // 나머지는 group1에 할당
      group1.push(option);
    });
    
    // 방어 속성 추가
    defenseOptions.forEach(opt => {
      group1.push(opt);
    });
    
    // 인챈트 종류를 group1에 추가
    enchantTypeOptions.forEach(opt => {
      group1.push(opt);
    });

    // 1번 그룹 정렬
    const attributeOrder = [
      '공격', '부상률', '크리티컬', '밸런스', '방어력', '보호', '마법 방어력', '마법 보호', 
      '내구력', '숙련', '남은 전용 해제 가능 횟수', '전용 해제 거래 보증서 사용 불가', 
      '인챈트 종류', '색상', '품질', '크기', '토템 효과', '토템 추가 옵션', '토템 강화 제한',
      'totem_none_effect', 'totem_none_additional', 'processed_pet_info'
    ];
    
    group1.sort((a, b) => 
      attributeOrder.indexOf(a.option_type) - attributeOrder.indexOf(b.option_type)
    );
    
    // 사용 효과 추가
    usageEffectOptions.forEach(opt => {
      group3.push(opt);
    });
    
    // 조미료 효과 추가
    spiceEffectOptions.forEach(opt => {
      group3.push(opt);
    });
    
    // 내구도 추가
    if (durabilityOption) {
      group3.push(durabilityOption);
    }
    
    // 거래 횟수 추가
    if (tradeCountOption) {
      group3.push(tradeCountOption);
    }
    
    // 남은 사용 횟수 추가
    if (usageCountOption) {
      group3.push(usageCountOption);
    }
    
    // 인챈트 불가능 추가
    if (notEnchantableOption && notEnchantableOption.option_value === 'true') {
      group3.push(notEnchantableOption);
    }
    
    // 아이템 보호 옵션 추가
    ['인챈트 추출', '인챈트 실패', '수리 실패'].forEach(key => {
      if (protectionOptions[key]) {
        group3.push(protectionOptions[key]);
      }
    });
    
    // === 그룹 렌더링 시작 ===
    
    // 그룹 1 렌더링
    group1.forEach((option, index) => {
      const isLast = index === group1.length - 1;
      
      // 간격 설정
      let gapClass = '';
      if (isLast) {
        // 다음 그룹이 있는지 확인
        if (piercingOption || group3.length > 0 || ecostoneRankOption) {
          gapClass = 'gap-md';
        }
      } else {
        gapClass = 'gap-xxs';
      }
      
      // 토템 관련 옵션 특별 처리
      if (option.option_type === 'totem_none_effect' || option.option_type === 'totem_none_additional') {
        const optionElement = document.createElement('div');
        optionElement.className = `tooltip-stat item-gray ${gapClass}`;
        optionElement.textContent = option.option_value;
        block.appendChild(optionElement);
      }
      // 펫 정보 특별 처리
      else if (option.option_type === 'processed_pet_info') {
        // 펫 정보 HTML 생성
        const petInfoHtml = this.generatePetInfoHTML(option.option_value);
        const petInfoElement = document.createElement('div');
        petInfoElement.className = gapClass;
        petInfoElement.innerHTML = petInfoHtml;
        block.appendChild(petInfoElement);
      } else {
        this.createOptionElement(option, block, gapClass);
      }
    });
    
    // 그룹 2 (피어싱) 렌더링
    if (piercingOption) {
      // 다음 그룹이 있는지 확인
      const hasNextGroup = group3.length > 0 || ecostoneRankOption;
      const gapClass = hasNextGroup ? 'gap-md' : '';
      this.createOptionElement(piercingOption, block, gapClass);
    }
    
    // 그룹 3 렌더링
    let lastSpiceEffectIndex = -1;
    let hasAddedSpiceHeader = false;
    
    group3.forEach((option, index) => {
      const isLast = index === group3.length - 1;
      // 다음 그룹이 있는지 확인
      const hasNextGroup = ecostoneRankOption;
      // 마지막 항목은 다음 그룹이 있으면 gap-md, 아니면 간격 없음, 그 외에는 xxs 간격
      const gapClass = isLast ? (hasNextGroup ? 'gap-md' : '') : 'gap-xxs';
      
      // 사용 효과 특별 처리
      if (option.option_type === '사용 효과') {
        const optionElement = document.createElement('div');
        optionElement.className = `tooltip-stat item-blue ${gapClass}`;
        optionElement.textContent = `- ${option.option_value}`;
        block.appendChild(optionElement);
      }
      // 조미료 효과 특별 처리
      else if (option.option_type === '조미료 효과') {
        // 이 옵션이 첫 번째 조미료 효과인지 확인
        if (!hasAddedSpiceHeader) {
          // 조미료 효과 헤더 추가
          const headerElement = document.createElement('div');
          headerElement.className = 'tooltip-stat gap-xs';
          headerElement.textContent = '조미료 효과';
          block.appendChild(headerElement);
          
          hasAddedSpiceHeader = true;
        }
        
        const optionElement = document.createElement('div');
        optionElement.className = `tooltip-stat item-blue ${gapClass}`;
        optionElement.textContent = `- ${option.option_value}`;
        block.appendChild(optionElement);
        
        lastSpiceEffectIndex = index;
      }
      // 인챈트 불가능 옵션 특별 처리
      else if (option.option_type === '인챈트 불가능' && option.option_value === 'true') {
        const optionElement = document.createElement('div');
        optionElement.className = `tooltip-stat item-red ${gapClass}`;
        optionElement.textContent = '#인챈트 부여 불가';
        block.appendChild(optionElement);
      } else {
        this.createOptionElement(option, block, gapClass);
      }
    });
    
    // 그룹 4 (에코스톤 등급) 렌더링
    if (ecostoneRankOption) {
      const rank = parseInt(ecostoneRankOption.option_value) || 0;
      let colorClass = '';
      
      if (rank > 20) {
        colorClass = 'item-pink';
      } else if (rank > 10) {
        colorClass = 'item-blue';
      }
      
      // 다음 그룹이 있는지 확인
      const hasNextGroup = ecostoneAbilityOptions.length > 0 || ecostoneAwakeningOptions.length > 0;
      const gapClass = hasNextGroup ? 'gap-md' : '';
      
      const optionElement = document.createElement('div');
      optionElement.className = `tooltip-stat ${colorClass} ${gapClass}`;
      optionElement.textContent = `${rank} 등급`;
      block.appendChild(optionElement);
    }
    
    // 그룹 5 (에코스톤 고유 능력) 렌더링
    if (ecostoneAbilityOptions.length > 0) {
      // 헤더
      const headerElement = document.createElement('div');
      headerElement.className = 'tooltip-stat gap-xs';
      headerElement.textContent = '고유 능력';
      block.appendChild(headerElement);
      
      // 능력 렌더링
      ecostoneAbilityOptions.forEach((option, index) => {
        const isLast = index === ecostoneAbilityOptions.length - 1;
        // 다음 그룹이 있는지 확인
        const hasNextGroup = ecostoneAwakeningOptions.length > 0;
        const gapClass = isLast ? (hasNextGroup ? 'gap-md' : '') : 'gap-xxs';
        
        const optionElement = document.createElement('div');
        optionElement.className = `tooltip-stat item-blue ${gapClass}`;
        optionElement.textContent = `- ${option.option_sub_type} +${option.option_value}`;
        block.appendChild(optionElement);
      });
    }
    
    // 그룹 6 (에코스톤 각성 능력) 렌더링
    if (ecostoneAwakeningOptions.length > 0) {
      // 헤더
      const headerElement = document.createElement('div');
      headerElement.className = 'tooltip-stat gap-xs';
      headerElement.textContent = '각성 능력';
      block.appendChild(headerElement);
      
      // 능력 렌더링
      ecostoneAwakeningOptions.forEach((option, index) => {
        const isLast = index === ecostoneAwakeningOptions.length - 1;
        const gapClass = isLast ? '' : 'gap-xxs'; // 마지막 항목은 간격 없음
        
        const optionElement = document.createElement('div');
        optionElement.className = `tooltip-stat item-blue ${gapClass}`;
        optionElement.textContent = `- ${option.option_value}`;
        block.appendChild(optionElement);
      });
    }
  }
  
  processAllPetInfo(petOptions) {
    if (!petOptions || petOptions.length === 0) return null;
    
    // 필요한 정보 추출
    let breedName = '';
    let petLevel = '';
    let accumulatedLevel = '';
    let petPoints = '';
    let age = '';
    let summonTime = '';
    let remainingBreedCount = '';
    let stats = {};
    
    petOptions.forEach(option => {
      const subType = option.option_sub_type;
      const value = option.option_value;
      
      if (subType === '종족명') {
        breedName = value;
      } else if (subType === '레벨') {
        petLevel = value;
      } else if (subType === '누적 레벨') {
        accumulatedLevel = value;
      } else if (subType === '펫 포인트') {
        petPoints = value;
      } else if (subType === '나이') {
        age = value;
      } else if (subType === '최대 소환 시간') {
        summonTime = value;
      } else if (subType === '남은 분양 횟수') {
        remainingBreedCount = value;
      } else if (['생명력', '마나', '스태미나', '체력', '의지', '솜씨', '지력', '행운'].includes(subType)) {
        stats[subType] = value;
      }
    });
    
    return {
      breedName,
      petLevel,
      accumulatedLevel,
      petPoints,
      age,
      summonTime,
      remainingBreedCount,
      stats
    };
  }
  
  generatePetInfoHTML(petInfo) {
    let html = '';
    
    // 분양 횟수 계산
    if (petInfo.remainingBreedCount) {
      const breedCount = 5 - parseInt(petInfo.remainingBreedCount);
      html += `<div class="tooltip-stat item-yellow gap-xxs">분양 횟수 : ${breedCount} / 5</div>`;
    }
    
    // 종족
    if (petInfo.breedName) {
      html += `<div class="tooltip-stat item-yellow gap-xxs">종족 : ${petInfo.breedName}</div>`;
    }
    
    // 나이
    if (petInfo.age) {
      html += `<div class="tooltip-stat item-yellow gap-xxs">나이 : ${petInfo.age}</div>`;
    }
    
    // 레벨
    if (petInfo.petLevel) {
      html += `<div class="tooltip-stat item-yellow gap-xxs">레벨 : ${petInfo.petLevel}${petInfo.accumulatedLevel ? ` (누적레벨: ${petInfo.accumulatedLevel})` : ''}</div>`;
    }
    
    // 펫 포인트
    if (petInfo.petPoints) {
      html += `<div class="tooltip-stat item-yellow gap-xxs">펫 포인트 : ${petInfo.petPoints}</div>`;
    }
    
    // 최대 소환 시간
    if (petInfo.summonTime) {
      const summonMinutes = parseInt(petInfo.summonTime);
      const hours = Math.floor(summonMinutes / 60);
      const minutes = summonMinutes % 60;
      const summonTimeText = hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
      html += `<div class="tooltip-stat item-yellow gap-xxs">최대 소환 시간 : ${summonTimeText}</div>`;
    }
    
    // 기본 스탯
    if (petInfo.stats && Object.keys(petInfo.stats).length > 0) {
      const statTexts = [];
      
      if (petInfo.stats['생명력']) statTexts.push(`생명력 ${petInfo.stats['생명력']}`);
      if (petInfo.stats['마나']) statTexts.push(`마나 ${petInfo.stats['마나']}`);
      if (petInfo.stats['스태미나']) statTexts.push(`스태미나 ${petInfo.stats['스태미나']}`);
      if (petInfo.stats['체력']) statTexts.push(`체력 ${petInfo.stats['체력']}`);
      if (petInfo.stats['의지']) statTexts.push(`의지 ${petInfo.stats['의지']}`);
      if (petInfo.stats['솜씨']) statTexts.push(`솜씨 ${petInfo.stats['솜씨']}`);
      if (petInfo.stats['지력']) statTexts.push(`지력 ${petInfo.stats['지력']}`);
      if (petInfo.stats['행운']) statTexts.push(`행운 ${petInfo.stats['행운']}`);
      
      html += `<div class="tooltip-stat item-blue">기본 스탯 : ${statTexts.join(', ')}</div>`;
    }
    
    return html;
  }
  
  renderEnchantsSection(options, block) {
    // 인챈트 불가능 확인
    const notEnchantableOption = options.find(opt => 
      opt.option_type === '인챈트 불가능' && opt.option_value === 'true'
    );
    
    // 접두/접미 구분
    const prefixEnchants = options.filter(opt => 
      opt.option_type === '인챈트' && opt.option_sub_type === '접두'
    );
    const suffixEnchants = options.filter(opt => 
      opt.option_type === '인챈트' && opt.option_sub_type === '접미'
    );
    
    // 인챈트 불가능 표시 - 가장 먼저 표시
    if (notEnchantableOption) {
      const notEnchantableElement = document.createElement('div');
      // 다음 인챈트가 있을 때만 gap-md 적용
      notEnchantableElement.className = `tooltip-stat item-red ${(prefixEnchants.length > 0 || suffixEnchants.length > 0) ? 'gap-md' : ''}`;
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
      let rankNum = 0;
      
      if (nameMatch) {
        enchantName = nameMatch[1].trim();
        rankText = `(랭크 ${nameMatch[2]})`;
        rankNum = parseInt(nameMatch[2]);
      }
      
      // 메타데이터 조회
      const metadata = context.getEnchantMetadata(type, enchantName);
      
      // 인챈트 제목 요소
      const enchantElement = document.createElement('div');
      // 효과가 있을 때만 gap-xs 적용
      const hasEffects = enchant.option_desc && enchant.option_desc.length > 0;
      enchantElement.className = `tooltip-stat ${hasEffects ? 'gap-xs' : ''}`;
      enchantElement.innerHTML = `<span class="enchant-type">[${type}]</span> ${enchantName} <span class="item-pink">${rankText}</span>`;
      block.appendChild(enchantElement);
      
      // 인챈트 효과 처리
      if (enchant.option_desc) {
        const effects = enchant.option_desc.split(',');
        
        effects.forEach((effect, i) => {
          const isLastEffect = i === effects.length - 1;
          // 마지막 효과이고 접미사가 있으면 gap-md, 아니면 gap-xxs
          const gapClass = isLastEffect && suffixEnchants.length > 0 ? 'gap-md' : (isLastEffect ? '' : 'gap-xxs');
          
          const effectText = effect.trim();
          const conditionMatch = effectText.match(/(.*?때) (.*)/);
          const cleanEffect = conditionMatch ? conditionMatch[2].trim() : effectText;
          
          const isNegative = 
            (cleanEffect.includes('수리비') && cleanEffect.includes('증가')) || 
            (!cleanEffect.includes('수리비') && cleanEffect.includes('감소'));
          
          const effectElement = document.createElement('div');
          effectElement.className = `tooltip-special-stat ${gapClass}`;
          
          // 값 추출 (예: "체력 44 증가" -> 44)
          const valueMatch = cleanEffect.match(/(.*?)(\d+)(.*)/);
          
          if (valueMatch && metadata && metadata.effects) {
            const [_, prefix, value, suffix] = valueMatch;
            const displayEffect = `- ${cleanEffect}`;
            
            // 메타데이터에서 효과 찾기
            let foundEffectTemplate = false;
            let rangeText = '';
            
            for (const metaEffect of metadata.effects) {
              const template = metaEffect.template;
              // 정규식으로 템플릿 변환
              const pattern = template.replace(/\{value\}/g, '\\d+');
              
              if (new RegExp(pattern).test(cleanEffect)) {
                // 값 범위 정보 추가 (변동 가능 효과인 경우)
                if (metaEffect.variable) {
                  rangeText = ` <span class="item-navy">(${metaEffect.min}~${metaEffect.max})</span>`;
                }
                foundEffectTemplate = true;
                break;
              }
            }
            
            const colorClass = isNegative ? 'item-red' : 'item-blue';
            effectElement.innerHTML = `<span class="${colorClass}">- ${cleanEffect}</span>${rangeText}`;
          } else {
            const colorClass = isNegative ? 'item-red' : 'item-blue';
            effectElement.innerHTML = `<span class="${colorClass}">- ${cleanEffect}</span>`;
          }
          
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
      let rankNum = 0;
      
      if (nameMatch) {
        enchantName = nameMatch[1].trim();
        rankText = `(랭크 ${nameMatch[2]})`;
        rankNum = parseInt(nameMatch[2]);
      }
      
      // 메타데이터 조회
      const metadata = context.getEnchantMetadata(type, enchantName);
      
      const enchantElement = document.createElement('div');
      const hasEffects = enchant.option_desc && enchant.option_desc.length > 0;
      enchantElement.className = `tooltip-stat ${hasEffects ? 'gap-xs' : ''}`;
      enchantElement.innerHTML = `<span class="enchant-type">[${type}]</span> ${enchantName} <span class="item-pink">${rankText}</span>`;
      block.appendChild(enchantElement);
      
      if (enchant.option_desc) {
        const effects = enchant.option_desc.split(',');
        
        effects.forEach((effect, i) => {
          const isLastEffect = i === effects.length - 1;
          // 마지막 항목은 간격 없음, 중간 항목은 gap-xxs
          const gapClass = isLastEffect ? '' : 'gap-xxs';
          
          const effectText = effect.trim();
          const conditionMatch = effectText.match(/(.*?때) (.*)/);
          const cleanEffect = conditionMatch ? conditionMatch[2].trim() : effectText;
          
          const isNegative = 
            (cleanEffect.includes('수리비') && cleanEffect.includes('증가')) || 
            (!cleanEffect.includes('수리비') && cleanEffect.includes('감소'));
          
          const effectElement = document.createElement('div');
          effectElement.className = `tooltip-special-stat ${gapClass}`;
          
          // 값 추출 (예: "체력 44 증가" -> 44)
          const valueMatch = cleanEffect.match(/(.*?)(\d+)(.*)/);
          
          if (valueMatch && metadata && metadata.effects) {
            const [_, prefix, value, suffix] = valueMatch;
            const displayEffect = `- ${cleanEffect}`;
            
            // 메타데이터에서 효과 찾기
            let foundEffectTemplate = false;
            let rangeText = '';
            
            for (const metaEffect of metadata.effects) {
              const template = metaEffect.template;
              // 정규식으로 템플릿 변환
              const pattern = template.replace(/\{value\}/g, '\\d+');
              
              if (new RegExp(pattern).test(cleanEffect)) {
                // 값 범위 정보 추가 (변동 가능 효과인 경우)
                if (metaEffect.variable) {
                  rangeText = ` <span class="item-navy">(${metaEffect.min}~${metaEffect.max})</span>`;
                }
                foundEffectTemplate = true;
                break;
              }
            }
            
            const colorClass = isNegative ? 'item-red' : 'item-blue';
            effectElement.innerHTML = `<span class="${colorClass}">- ${cleanEffect}</span>${rangeText}`;
          } else {
            const colorClass = isNegative ? 'item-red' : 'item-blue';
            effectElement.innerHTML = `<span class="${colorClass}">- ${cleanEffect}</span>`;
          }
          
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
      // 다음 개조 항목이 있는 경우만 gap-md 적용
      modElement.className = `tooltip-stat ${(masterMod || specialMod) ? 'gap-md' : ''}`;
      modElement.textContent = text;
      block.appendChild(modElement);
    }
    
    // 장인 개조 처리
    if (masterMod) {
      // 장인 개조 타이틀
      const masterModTitle = document.createElement('div');
      // 장인 개조 내용이 있을 때만 gap-xs 적용
      const hasMasterModContent = masterMod.option_value && masterMod.option_value.includes(',');
      masterModTitle.className = `tooltip-stat ${hasMasterModContent ? 'gap-xs' : ''}`;
      masterModTitle.textContent = '장인 개조';
      block.appendChild(masterModTitle);
      
      // 장인 개조 효과 처리
      if (hasMasterModContent) {
        const modParts = masterMod.option_value.split(',');
        modParts.forEach((part, index) => {
          const isLast = index === modParts.length - 1;
          // 마지막 항목이고 특별 개조가 있을 때만 gap-md, 마지막이면서 다음 항목 없으면 gap 없음
          const gapClass = isLast ? (specialMod ? 'gap-md' : '') : 'gap-xxs';
          
          const effectElement = document.createElement('div');
          effectElement.className = `tooltip-stat item-blue ${gapClass}`;
          effectElement.textContent = `- ${part.trim()}`;
          block.appendChild(effectElement);
        });
      }
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
    
    // 세공 랭크가 있고 옵션도 있는지 확인
    const hasOptions = reforgeOptions.length > 0;
    
    // 세공 랭크 표시
    if (reforgeRank) {
      const rankElement = document.createElement('div');
      // 세공 랭크와 첫 옵션 사이는 gap-xs, 옵션이 없으면 간격 없음
      rankElement.className = `tooltip-stat item-pink ${hasOptions ? 'gap-xs' : ''}`;
      rankElement.textContent = `${reforgeRank.option_value}랭크`;
      block.appendChild(rankElement);
    }
    
    // 세공 옵션 표시
    reforgeOptions.forEach((option, index) => {
      const isLast = index === reforgeOptions.length - 1;
      // 마지막 항목이면 간격 없음, 아니면 gap-xxs
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
    options.forEach((option, index) => {
      const isLast = index === options.length - 1;
      // 마지막 항목은 간격 없음, 중간 항목은 gap-xxs
      const gapClass = isLast ? '' : 'gap-xxs';
      
      const optionElement = document.createElement('div');
      optionElement.className = `tooltip-stat item-pink ${gapClass}`;
      optionElement.innerHTML = `등급 <span class="item-pink">${option.option_sub_type}</span> <span class="item-pink">(${option.option_value}/${option.option_value2}레벨)</span>`;
      block.appendChild(optionElement);
    });
  }
  
  renderSetEffectSection(options, block) {
    options.forEach((option, index) => {
      const isLast = index === options.length - 1;
      // 마지막 항목은 간격 없음, 중간 항목은 gap-xxs
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
    const processedOption = this.processOption(option);
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
  
  processOption(option) {
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

      case '인챈트 종류':
        const enchantType = option.option_sub_type;
        const enchantValue = option.option_value;
        
        // 인챈트 이름과 랭크 추출
        const enchantMatch = enchantValue.match(/(.*?)\s*\(랭크 ([A-Za-z0-9]+)\)/);
        let enchantName = enchantValue;
        let rankText = '';
        
        if (enchantMatch) {
          enchantName = enchantMatch[1].trim();
          const rankValue = enchantMatch[2];
          rankText = `(${enchantType}:랭크 ${rankValue})`;
        }
        
        // 메타데이터 검색을 위한 타입
        const enchantMetaType = enchantType;
        
        // 메타데이터에서 인챈트 정보 검색
        const enchantMetadata = metadataLoader.getEnchantMetadata(enchantMetaType, enchantName);
        
        // 효과 HTML 배열
        const effectHtmls = [];
        
        // 메타데이터에서 효과 추출
        if (enchantMetadata && enchantMetadata.effects && enchantMetadata.effects.length > 0) {
          enchantMetadata.effects.forEach(effect => {
            const template = effect.template;
            const min = effect.min;
            const max = effect.max;
            const variable = effect.variable;
            const condition = effect.condition || '';
            
            // 부정적 효과 확인
            const isNegative = 
              (template.includes('수리비') && template.includes('증가')) || 
              (!template.includes('수리비') && template.includes('감소'));
            
            // 값 텍스트 구성
            const valueText = variable ? `${min}~${max}` : min;
            const valueReplacedTemplate = template.replace('{value}', valueText);
            
            // 효과 텍스트 구성
            let effectText;
            if (template.includes('피어싱 레벨')) {
              effectText = `피어싱 레벨이 있을 때 ${valueReplacedTemplate}`;
            } else if (condition) {
              effectText = `${condition} ${valueReplacedTemplate}`;
            } else {
              effectText = valueReplacedTemplate;
            }
            
            effectHtmls.push({
              text: effectText,
              isNegative
            });
          });
        }
        
        // 전용 인챈트 여부 확인
        const isSpecialEnchant = this.currentItem && 
                               this.currentItem.item_name && 
                               this.currentItem.item_name.includes('전용') &&
                               this.currentItem.item_name.includes('인챈트');
        
        // 효과들을 원본 순서의 반대로 배치 (속성3, 속성2, 속성1 순서로)
        const reversedEffectHtmls = [...effectHtmls].reverse();
        
        // 효과 HTML 생성
        let effectsHtml = '';
        
        // 인챈트 이름과 첫 효과 사이에 gap-xs 적용
        if (reversedEffectHtmls.length > 0 || isSpecialEnchant) {
          effectsHtml += `<div class="gap-xs"></div>`;
        }
        
        // 각 효과 추가 (모든 효과 사이에 gap-xxs 적용)
        for (let i = 0; i < reversedEffectHtmls.length; i++) {
          const effect = reversedEffectHtmls[i];
          effectsHtml += `<div class="${effect.isNegative ? 'item-red' : 'item-blue'}">${effect.text}</div>`;
          
          // 다음 효과나 특별 메시지가 있으면 gap-xxs 추가
          if (i < reversedEffectHtmls.length - 1 || isSpecialEnchant) {
            effectsHtml += `<div class="gap-xxs"></div>`;
          }
        }
        
        // 특별 인챈트 메시지 추가
        if (isSpecialEnchant) {
          effectsHtml += `<div class="item-red">인챈트 장비를 전용으로 만듦</div>`;
        }
        
        // 내구도와의 간격을 위한 gap-md 추가 (마지막에 항상 추가)
        effectsHtml += `<div class="gap-md"></div>`;
        
        // 최종 HTML 구성
        const html = `
          <div>
            <div>${enchantName} ${rankText}</div>
            ${effectsHtml}
          </div>
        `;
        
        return {
          html: html,
          colorClass: 'item-navy'
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

      case '내구도':
        const durabilityValue = parseFloat(option.option_value.replace('%', ''));
        const durabilityText = `내구도 ${option.option_value}`;
        
        // 20% 이하일 때 빨간색으로 표시
        return {
          text: durabilityText,
          colorClass: durabilityValue <= 20 ? 'item-red' : 'item-yellow'
        };

      case '남은 거래 횟수':
        return {
          text: `남은 거래 가능 횟수 : ${option.option_value}`,
          colorClass: 'item-yellow'
        };
        
      case '남은 사용 횟수':
        return {
          text: `남은 사용 횟수 : ${option.option_value}`,
          colorClass: 'item-yellow'
        };
        
      case '색상':
        let colorValue = option.option_value || '';
        let colorParts = colorValue.split(',');
        
        // RGB 값을 16진수로 변환
        const r = parseInt(colorParts[0] || 0);
        const g = parseInt(colorParts[1] || 0);
        const b = parseInt(colorParts[2] || 0);
        const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
        
        return {
          html: `<div style="display: flex; align-items: center; line-height: 1;">
            <span>${hexColor}</span>
            <div style="display: inline-block; width: 12px; height: 12px; background-color: rgb(${r},${g},${b}); border: 1px solid white; margin-left: 4px; border-radius: 2px; vertical-align: middle;"></div>
          </div>
          <div style="margin-top: 3px;">
            <span>R:${colorParts[0]} G:${colorParts[1]} B:${colorParts[2]}</span>
          </div>`,
          colorClass: 'item-navy'
        };
        
     case '품질':
      const quality = parseInt(option.option_value) || 0;
      const stars = '★'.repeat(quality);
      return {
        html: `<div style="display: flex; align-items: center;">
          <span>품질 : </span>
          <span style="font-size: 0.7em; letter-spacing: -1px; margin-left: 2px;">${stars}</span>
        </div>`,
        colorClass: ''
      };
        
      case '크기':
        return {
          text: `크기 : ${option.option_value}`,
          colorClass: ''
        };
        
      case '토템 효과':
        return {
          text: `${option.option_sub_type} +${option.option_value}`,
          colorClass: 'item-yellow'
        };
        
      case '토템 추가 옵션':
        return {
          text: `추가 옵션 : ${option.option_sub_type} +${option.option_value}`,
          colorClass: 'item-blue'
        };
        
      case '토템 강화 제한':
        const value = parseInt(option.option_value) || 0;
        const colorClass = value > 0 ? 'item-yellow' : 'item-gray';
        
        if (option.option_sub_type === '남은 일반 강화 횟수') {
          return {
            text: `남은 일반 옵션 강화 횟수 : ${option.option_value}`,
            colorClass
          };
        } else if (option.option_sub_type === '남은 추가 강화 횟수') {
          return {
            text: `남은 추가 옵션 강화 횟수 : ${option.option_value}`,
            colorClass
          };
        }
        return {
          text: `${option.option_sub_type} : ${option.option_value}`,
          colorClass
        };
        
      case 'totem_none_effect':
        return {
          text: option.option_value,
          colorClass: 'item-gray'
        };
        
      case 'totem_none_additional':
        return {
          text: option.option_value,
          colorClass: 'item-gray'
        };
        
      case 'processed_pet_info':
        // 펫 정보는 별도 처리됨
        return {
          html: this.generatePetInfoHTML(option.option_value),
          colorClass: ''
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
