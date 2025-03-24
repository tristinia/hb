/**
 * option-renderer.js
 * 아이템 옵션 렌더링 전용 모듈
 */

import optionDefinitions from './option-definitions.js';
import metadataLoader from './metadata-loader.js';

/**
 * 옵션 렌더러 클래스
 * 아이템 옵션의 시각적 표시 담당
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
  
  /**
   * 디버그 로그 출력
   * @param {...any} args 로그 인자들
   */
  logDebug(...args) {
    if (this.debug) {
      console.log('[OptionRenderer]', ...args);
    }
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
  
  /**
   * 옵션을 중요도 순서로 정렬
   * @param {Array} options 옵션 배열
   * @returns {Array} 정렬된 옵션 배열
   */
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
  
  /**
   * 옵션 처리
   * @param {Object} option 옵션 데이터
   * @returns {Object|null} 처리된 옵션 정보
   */
  processOption(option) {
    // 옵션 정의 가져오기
    const definition = optionDefinitions[option.option_type];
    
    // 정의가 없으면 기본 텍스트만 반환
    if (!definition) {
      return {
        text: `${option.option_type}: ${option.option_value}`,
        filter: false
      };
    }
    
    // 컨텍스트 객체 (메타데이터 접근용)
    const context = {
      getEnchantMetadata: (type, name) => metadataLoader.getEnchantMetadata(type, name)
    };
    
    // 표시 텍스트 생성
    let text;
    if (typeof definition.display === 'function') {
      // 함수형 표시 로직 (컨텍스트 전달)
      text = definition.display(option, context);
    } else {
      // 기본 텍스트
      text = `${option.option_type}: ${option.option_value}`;
    }
    
    // 색상 정보
    const color = definition.color;
    
    return {
      text,
      color,
      filter: false // 렌더링에서는 필터 정보 불필요
    };
  }
  
  /**
   * 특수 기능 처리 (세공, 세트 효과, 개조 등)
   * @param {Object} item 아이템 데이터
   * @param {Object} block 블록 데이터
   */
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
  
  /**
   * 마비노기 스타일 아이템 툴팁 렌더링
   * @param {Object} item - 아이템 데이터
   * @returns {HTMLElement} 툴팁 요소
   */
  renderMabinogiStyleTooltip(item) {
    const tooltipElement = document.createElement('div');
    
    // 아이템 이름 헤더
    const header = document.createElement('div');
    header.className = 'tooltip-header';
    header.innerHTML = `<h3>${item.item_display_name || item.item_name || '이름 없음'}</h3>`;
    tooltipElement.appendChild(header);
    
    // 툴팁 내용 컨테이너
    const content = document.createElement('div');
    content.className = 'tooltip-content';
    
    // 아이템 속성 블록
    const attributesBlock = document.createElement('div');
    attributesBlock.className = 'tooltip-block';
    attributesBlock.innerHTML = `<div class="tooltip-block-title">아이템 속성</div>`;
    
    // 옵션 처리
    const options = item.options || item.item_option || [];
    
    if (Array.isArray(options)) {
      // 중요 순서로 정렬
      const orderedOptions = this.orderOptionsByImportance(options);
      
      // 옵션 렌더링
      for (const option of orderedOptions) {
        // 일반 속성 처리
        const processedOption = this.processOption(option);
        
        if (processedOption) {
          const colorClass = processedOption.color ? this.colorClass[processedOption.color] : '';
          
          if (processedOption.text.includes('<')) {
            // HTML 포함된 경우 wrapper div 추가
            attributesBlock.innerHTML += `<div class="tooltip-stat ${colorClass}">${processedOption.text}</div>`;
          } else {
            // 일반 텍스트
            const statElement = document.createElement('div');
            statElement.className = `tooltip-stat ${colorClass}`;
            statElement.textContent = processedOption.text;
            attributesBlock.appendChild(statElement);
          }
        }
      }
    }
    
    content.appendChild(attributesBlock);
    
    // 가격 정보 (맨 아래)
    if (item.auction_price_per_unit) {
      const formattedPrice = this.formatItemPrice(item.auction_price_per_unit);
      
      const priceBlock = document.createElement('div');
      priceBlock.className = 'tooltip-block';
      
      priceBlock.innerHTML = `
          <div class="tooltip-block-title">가격 정보</div>
          <div class="tooltip-stat">가격: <span class="${formattedPrice.class}">${formattedPrice.text}</span></div>
      `;
      
      content.appendChild(priceBlock);
    }
    
    tooltipElement.appendChild(content);
    return tooltipElement;
  }
  
  /**
   * 가격 포맷팅 함수
   * @param {number} price - 가격
   * @returns {object} 포맷된 가격과 CSS 클래스
   */
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
