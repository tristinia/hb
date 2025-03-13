/**
 * filter-manager.js
 * 필터 UI 관리 및 필터 적용 기능
 */

import optionRenderer from './option-renderer.js';
import optionFilterManager from './option-filter-manager.js';

class FilterManager {
  constructor() {
    this.activeFilters = [];
    this.allItems = [];
    this.filterOptions = {
      categories: {
        '기본': [],
        '세공': [],
        '세트 효과': [],
        '특수': []
      },
      advancedFilters: []
    };
    
    // UI 요소 참조
    this.filterContainer = null;
    this.itemsContainer = null;
  }
  
  /**
   * 초기화
   * @param {Array} items 아이템 데이터 배열
   * @param {Object} metaData 메타데이터
   * @param {HTMLElement} filterContainer 필터 컨테이너 요소
   * @param {HTMLElement} itemsContainer 아이템 컨테이너 요소
   */
  init(items, metaData, filterContainer, itemsContainer) {
    console.log('FilterManager 초기화 중...', items.length, '개 아이템');
    this.allItems = items;
    this.filterContainer = filterContainer;
    this.itemsContainer = itemsContainer;
    
    // 메타데이터 설정
    optionFilterManager.setMetaData(metaData);
    
    // 모든 가능한 필터 수집
    const allFilters = this.collectAllFilters(items);
    
    // 필터 분류
    this.filterOptions = optionFilterManager.categorizeFilters(allFilters);
    
    // 필터 UI 렌더링
    this.renderFilterUI();
    
    // 초기 아이템 목록 표시
    this.renderItems(items);
    
    console.log('FilterManager 초기화 완료');
  }
  
  /**
   * 모든 가능한 필터 수집
   * @param {Array} items 아이템 데이터 배열
   * @returns {Array} 모든 가능한 필터 배열
   */
  collectAllFilters(items) {
    const allFilters = [];
    
    items.forEach(item => {
      const itemFilters = optionFilterManager.extractFilters(item);
      
      itemFilters.forEach(filter => {
        // 중복 방지
        if (!allFilters.some(f => f.name === filter.name)) {
          allFilters.push(filter);
        }
      });
    });
    
    return allFilters;
  }
  
  /**
   * 필터 UI 렌더링
   */
  renderFilterUI() {
    if (!this.filterContainer) return;
    
    // 기존 내용 삭제
    this.filterContainer.innerHTML = '';
    
    // 필터 카테고리 탭
    const tabContainer = document.createElement('div');
    tabContainer.className = 'filter-tabs';
    
    Object.keys(this.filterOptions.categories).forEach(category => {
      const tab = document.createElement('button');
      tab.textContent = category;
      tab.className = 'filter-tab';
      tab.onclick = () => this.switchFilterCategory(category);
      tabContainer.appendChild(tab);
    });
    
    this.filterContainer.appendChild(tabContainer);
    
    // 필터 영역
    const filterArea = document.createElement('div');
    filterArea.className = 'filter-area';
    
    // 필터 선택 드롭다운
    const filterSelector = document.createElement('select');
    filterSelector.className = 'filter-selector';
    filterSelector.innerHTML = '<option value="">필터 선택...</option>';
    
    // 기본 카테고리의 필터들을 드롭다운에 추가
    this.filterOptions.categories['기본'].forEach(filter => {
      const option = document.createElement('option');
      option.value = filter.name;
      option.textContent = filter.name;
      filterSelector.appendChild(option);
    });
    
    filterSelector.onchange = () => this.addFilterInput(filterSelector.value);
    
    filterArea.appendChild(filterSelector);
    
    // 활성 필터 영역
    const activeFilters = document.createElement('div');
    activeFilters.className = 'active-filters';
    filterArea.appendChild(activeFilters);
    
    this.filterContainer.appendChild(filterArea);
    
    // 필터 적용 버튼
    const applyBtn = document.createElement('button');
    applyBtn.className = 'apply-filter-btn';
    applyBtn.textContent = '필터 적용';
    applyBtn.onclick = () => this.applyFilters();
    
    this.filterContainer.appendChild(applyBtn);
    
    // 첫 번째 탭 활성화
    const firstTab = this.filterContainer.querySelector('.filter-tab');
    if (firstTab) {
      firstTab.classList.add('active');
    }
  }
  
  /**
   * 필터 카테고리 전환
   * @param {string} category 카테고리 이름
   */
  switchFilterCategory(category) {
    // 탭 활성화
    const tabs = this.filterContainer.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
      if (tab.textContent === category) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    // 드롭다운 업데이트
    const filterSelector = this.filterContainer.querySelector('.filter-selector');
    filterSelector.innerHTML = '<option value="">필터 선택...</option>';
    
    // 선택한 카테고리의 필터들을 드롭다운에 추가
    this.filterOptions.categories[category].forEach(filter => {
      const option = document.createElement('option');
      option.value = filter.name;
      option.textContent = filter.name;
      filterSelector.appendChild(option);
    });
  }
  
  /**
   * 필터 입력 영역 추가
   * @param {string} filterName 필터 이름
   */
  addFilterInput(filterName) {
    if (!filterName) return;
    
    const activeFilters = this.filterContainer.querySelector('.active-filters');
    
    // 이미 존재하는지 확인
    if (this.filterContainer.querySelector(`[data-filter-name="${filterName}"]`)) {
      alert('이미 추가된 필터입니다.');
      return;
    }
    
    // 필터 정보 찾기
    const allFilters = [].concat(...Object.values(this.filterOptions.categories));
    const filterInfo = allFilters.find(f => f.name === filterName);
    
    if (!filterInfo) return;
    
    // 필터 입력 영역 생성
    const filterBox = document.createElement('div');
    filterBox.className = 'filter-box';
    filterBox.dataset.filterName = filterName;
    
    // 필터 이름
    const nameSpan = document.createElement('span');
    nameSpan.className = 'filter-name';
    nameSpan.textContent = filterName;
    filterBox.appendChild(nameSpan);
    
    // 줄바꿈 추가
    filterBox.appendChild(document.createElement('br'));
    
    // 필터 입력 UI
    if (filterInfo.type === 'range') {
      // 범위 입력
      const minInput = document.createElement('input');
      minInput.type = 'number';
      minInput.placeholder = '최소값';
      minInput.className = 'filter-min';
      
      const maxInput = document.createElement('input');
      maxInput.type = 'number';
      maxInput.placeholder = '최대값';
      maxInput.className = 'filter-max';
      
      const rangeLabel = document.createElement('span');
      rangeLabel.textContent = ' ~ ';
      
      filterBox.appendChild(minInput);
      filterBox.appendChild(rangeLabel);
      filterBox.appendChild(maxInput);
    } else if (filterInfo.type === 'selection') {
      // 선택형 입력
      const select = document.createElement('select');
      select.className = 'filter-select';
      
      filterInfo.options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
      });
      
      filterBox.appendChild(select);
    }
    
    // 제거 버튼
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'X';
    removeBtn.className = 'filter-remove';
    removeBtn.onclick = () => filterBox.remove();
    
    filterBox.appendChild(removeBtn);
    
    // 활성 필터 영역에 추가
    activeFilters.appendChild(filterBox);
    
    // 드롭다운 초기화
    this.filterContainer.querySelector('.filter-selector').value = '';
  }
  
  /**
   * 현재 활성화된 필터 수집
   * @returns {Array} 활성화된 필터 배열
   */
  getActiveFilters() {
    const result = [];
    
    this.filterContainer.querySelectorAll('.filter-box').forEach(box => {
      const name = box.dataset.filterName;
      
      // 범위 필터
      const minInput = box.querySelector('.filter-min');
      const maxInput = box.querySelector('.filter-max');
      
      if (minInput && maxInput) {
        const filter = {
          name,
          type: 'range'
        };
        
        if (minInput.value) {
          filter.min = parseFloat(minInput.value);
        }
        
        if (maxInput.value) {
          filter.max = parseFloat(maxInput.value);
        }
        
        result.push(filter);
        return;
      }
      
      // 선택형 필터
      const select = box.querySelector('.filter-select');
      
      if (select) {
        result.push({
          name,
          type: 'selection',
          value: select.value
        });
      }
    });
    
    return result;
  }
  
  /**
   * 필터 적용
   */
  applyFilters() {
    // 활성 필터 수집
    const activeFilters = this.getActiveFilters();
    
    // 필터 적용
    const filteredItems = optionFilterManager.applyFilters(this.allItems, activeFilters);
    
    // 결과 렌더링
    this.renderItems(filteredItems);
  }
  
  /**
   * 아이템 목록 렌더링
   * @param {Array} items 아이템 데이터 배열
   */
  renderItems(items) {
    if (!this.itemsContainer) return;
    
    // 기존 내용 삭제
    this.itemsContainer.innerHTML = '';
    
    // 아이템이 없는 경우
    if (items.length === 0) {
      const noItemElement = document.createElement('div');
      noItemElement.className = 'no-item-message';
      noItemElement.textContent = '조건에 맞는 아이템이 없습니다.';
      this.itemsContainer.appendChild(noItemElement);
      return;
    }
    
    // 아이템 렌더링
    items.forEach(item => {
      // 블록 생성
      const blocks = optionRenderer.createDisplayBlocks(item);
      
      // 블록 렌더링
      const itemElement = optionRenderer.renderItemBlocks(blocks);
      
      // 컨테이너에 추가
      this.itemsContainer.appendChild(itemElement);
    });
  }
  
  /**
   * CSS 스타일 추가
   */
  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .filter-container {
        border: 1px solid #ddd;
        padding: 15px;
        border-radius: 5px;
        background: white;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      }
      
      .filter-tabs {
        display: flex;
        margin-bottom: 15px;
        border-bottom: 1px solid #ddd;
      }
      
      .filter-tab {
        padding: 8px 0;
        cursor: pointer;
        background: #f5f5f5;
        border: none;
        margin-right: 0;
        flex: 1;
        font-size: 13px;
        text-align: center;
      }
      
      .filter-tab.active {
        background: #007bff;
        color: white;
      }
      
      .filter-selector {
        width: 100%;
        padding: 8px;
        margin-bottom: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      
      .active-filters {
        display: flex;
        flex-direction: column;
        margin-bottom: 15px;
      }
      
      .filter-box {
        border: 1px solid #ddd;
        padding: 10px;
        border-radius: 4px;
        background: #f9f9f9;
        margin-bottom: 8px;
        position: relative;
      }
      
      .filter-name {
        font-weight: bold;
        display: block;
        margin-bottom: 5px;
        padding-right: 20px;
      }
      
      .filter-min, .filter-max {
        width: 70px;
        padding: 5px;
        border: 1px solid #ddd;
        border-radius: 3px;
      }
      
      .filter-select {
        width: calc(100% - 30px);
        padding: 5px;
        border: 1px solid #ddd;
        border-radius: 3px;
      }
      
      .filter-remove {
        position: absolute;
        top: 8px;
        right: 8px;
        background: #ff6b6b;
        color: white;
        border: none;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
      }
      
      .apply-filter-btn {
        background: #28a745;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        width: 100%;
      }
      
      .item-card {
        border: 1px solid #ddd;
        padding: 15px;
        margin-bottom: 15px;
        border-radius: 5px;
        background: white;
      }
      
      .item-block {
        margin-bottom: 15px;
      }
      
      .block-title {
        font-size: 16px;
        margin-bottom: 10px;
        border-bottom: 1px solid #eee;
        padding-bottom: 5px;
      }
      
      .item-content {
        margin-bottom: 5px;
        line-height: 1.5;
      }
      
      .color-red { color: #e74c3c; }
      .color-blue { color: #3498db; }
      .color-yellow { color: #f1c40f; }
      .color-white { color: #333333; }
      .color-default { color: #333333; }
      
      .no-item-message {
        padding: 20px;
        text-align: center;
        color: #666;
        font-style: italic;
        background: white;
        border-radius: 5px;
        border: 1px solid #ddd;
      }
    `;
    
    document.head.appendChild(style);
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const filterManager = new FilterManager();
export default filterManager;
