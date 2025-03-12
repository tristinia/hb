/**
 * 옵션 렌더링 모듈
 * 아이템 세부 정보 표시 및 필터 생성
 */

const OptionRenderer = (() => {
    // 상태 관리
    const state = {
        optionStructure: null,
        loadedCategories: new Set(),
        blockConfig: {},
        optionConfig: {},
        metaCache: new Map() // 메타데이터 캐시
    };
    
    /**
     * 초기화 함수
     */
    function init() {
        // 이벤트 리스너 설정
        setupEventListeners();
        console.log('OptionRenderer 초기화 완료');
    }
    
    /**
     * 옵션 구조 로드
     * @param {string} categoryId - 카테고리 ID
     * @returns {Promise<Object>} 옵션 구조 객체
     */
    async function loadOptionStructure(categoryId) {
        if (!categoryId) {
            console.warn('카테고리 ID가 없습니다.');
            return null;
        }
        
        // 이미 로드된 카테고리인지 확인
        if (state.loadedCategories.has(categoryId)) {
            return state.optionStructure;
        }
        
        try {
            // 파일명으로 사용할 수 없는 특수문자 처리
            const safeCategoryId = categoryId.replace(/[\/\\:*?"<>|]/g, '_');
            
            // 옵션 구조 파일 로드
            const response = await fetch(`../../data/option_structure/${safeCategoryId}.json`);
            
            if (!response.ok) {
                // 대체 경로 시도
                const fallbackResponse = await fetch('../../data/option_structure.json');
                
                if (!fallbackResponse.ok) {
                    throw new Error('옵션 구조 파일을 찾을 수 없습니다.');
                }
                
                const data = await fallbackResponse.json();
                state.optionStructure = data;
            } else {
                const data = await response.json();
                state.optionStructure = data;
            }
            
            // 블록 및 옵션 설정 추출
            state.blockConfig = state.optionStructure.blocks || {};
            state.optionConfig = state.optionStructure.options || {};
            
            // 로드된 카테고리 추가
            state.loadedCategories.add(categoryId);
            
            return state.optionStructure;
        } catch (error) {
            console.error('옵션 구조 로드 실패:', error);
            return null;
        }
    }
    
    /**
     * 아이템 세부 정보 렌더링
     * @param {Object} item - 아이템 데이터
     * @returns {HTMLElement} 렌더링된 세부 정보 요소
     */
    function renderItemDetails(item) {
        if (!item) return null;
        
        // 옵션 구조가 로드되지 않은 경우 기본 렌더링
        if (!state.optionStructure) {
            return renderBasicItemDetails(item);
        }
        
        // 컨테이너 생성
        const container = document.createElement('div');
        container.className = 'item-details-container';
        
        // 블록 순서대로 정렬
        const sortedBlocks = Object.entries(state.blockConfig)
            .sort(([, a], [, b]) => (a.order || 999) - (b.order || 999));
        
        // 각 블록 렌더링
        for (const [blockId, blockConfig] of sortedBlocks) {
            // 블록에 해당하는 옵션들 필터링
            const blockOptions = Object.entries(state.optionConfig)
                .filter(([, optionConfig]) => optionConfig.block === blockId)
                .map(([optionId, optionConfig]) => ({id: optionId, ...optionConfig}));
            
            // 블록에 표시할 옵션이 있는 경우에만 블록 생성
            if (blockOptions.length > 0) {
                const blockElement = renderBlock(blockId, blockConfig, blockOptions, item);
                
                if (blockElement) {
                    container.appendChild(blockElement);
                }
            }
        }
        
        return container;
    }
    
    /**
     * 기본 아이템 세부 정보 렌더링 (옵션 구조 없는 경우)
     * @param {Object} item - 아이템 데이터
     * @returns {HTMLElement} 렌더링된 요소
     */
    function renderBasicItemDetails(item) {
        const container = document.createElement('div');
        container.className = 'item-details-basic';
        
        // 기본 정보만 표시
        container.innerHTML = `
            <div class="item-name">${item.item_name || '알 수 없는 아이템'}</div>
            <div class="item-price">가격: ${Utils.formatNumber(item.auction_price_per_unit || 0)}G</div>
            <div class="item-count">수량: ${item.auction_count || 1}개</div>
        `;
        
        // 옵션이 있으면 간단히 표시
        if (item.item_option && Array.isArray(item.item_option)) {
            const optionsList = document.createElement('ul');
            optionsList.className = 'item-options-list';
            
            item.item_option.forEach(option => {
                if (option.option_type) {
                    const li = document.createElement('li');
                    li.innerHTML = `<strong>${option.option_type}:</strong> ${option.option_value || ''}`;
                    
                    if (option.option_desc) {
                        li.innerHTML += ` (${option.option_desc})`;
                    }
                    
                    optionsList.appendChild(li);
                }
            });
            
            if (optionsList.children.length > 0) {
                container.appendChild(optionsList);
            }
        }
        
        return container;
    }
    
    /**
     * 블록 렌더링
     * @param {string} blockId - 블록 ID
     * @param {Object} blockConfig - 블록 설정
     * @param {Array} options - 블록에 표시할 옵션 목록
     * @param {Object} item - 아이템 데이터
     * @returns {HTMLElement} 렌더링된 블록 요소
     */
    function renderBlock(blockId, blockConfig, options, item) {
        // 아이템 옵션이 없는 경우 건너뛰기
        if (!item.item_option || !Array.isArray(item.item_option)) {
            return null;
        }
        
        // 블록 컨테이너 생성
        const blockElement = document.createElement('div');
        blockElement.className = `item-block item-block-${blockId}`;
        
        // 블록 제목이 있으면 추가
        if (blockConfig.title) {
            const titleElement = document.createElement('div');
            titleElement.className = 'block-title';
            titleElement.textContent = blockConfig.title;
            blockElement.appendChild(titleElement);
        }
        
        // 블록 내용 컨테이너
        const blockContent = document.createElement('div');
        blockContent.className = 'block-content';
        blockContent.style.textAlign = blockConfig.align || 'left';
        
        // 표시할 옵션이 있는지 확인
        let hasVisibleOptions = false;
        
        // 각 옵션 처리
        for (const optionConfig of options) {
            // 아이템의 해당 옵션 데이터 찾기
            const matchingOptions = item.item_option.filter(itemOption => {
                // 기본 타입 매칭
                if (itemOption.option_type === optionConfig.id) {
                    return true;
                }
                
                // 커스텀 조건이 있는 경우
                if (optionConfig.condition) {
                    return checkOptionCondition(itemOption, optionConfig.condition);
                }
                
                return false;
            });
            
            // 매칭된 옵션이 있으면 표시
            if (matchingOptions.length > 0) {
                for (const itemOption of matchingOptions) {
                    const optionElement = renderOption(optionConfig, itemOption, item);
                    
                    if (optionElement) {
                        blockContent.appendChild(optionElement);
                        hasVisibleOptions = true;
                    }
                }
            }
        }
        
        // 표시할 옵션이 없으면 null 반환
        if (!hasVisibleOptions) {
            return null;
        }
        
        // 블록 내용 추가
        blockElement.appendChild(blockContent);
        
        return blockElement;
    }
    
    /**
     * 옵션 조건 확인
     * @param {Object} itemOption - 아이템 옵션 데이터
     * @param {Object} condition - 조건 객체
     * @returns {boolean} 조건 충족 여부
     */
    function checkOptionCondition(itemOption, condition) {
        // 기본 필드 체크
        if (condition.field && condition.value !== undefined) {
            const fieldValue = itemOption[condition.field];
            
            if (fieldValue !== condition.value) {
                return false;
            }
        }
        
        // AND 조건이 있는 경우
        if (condition.and) {
            return checkOptionCondition(itemOption, condition.and);
        }
        
        // OR 조건이 있는 경우
        if (condition.or) {
            return checkOptionCondition(itemOption, condition.or);
        }
        
        return true;
    }
    
    /**
     * 옵션 렌더링
     * @param {Object} optionConfig - 옵션 설정
     * @param {Object} itemOption - 아이템 옵션 데이터
     * @param {Object} item - 아이템 데이터
     * @returns {HTMLElement} 렌더링된 옵션 요소
     */
    function renderOption(optionConfig, itemOption, item) {
        // 표시 형식이 없으면 기본 형식 사용
        if (!optionConfig.display || !optionConfig.display.format) {
            return renderBasicOption(itemOption);
        }
        
        const optionElement = document.createElement('div');
        optionElement.className = 'item-option';
        
        // 옵션 데이터 추출 및 변환
        const processedValues = processOptionValue(optionConfig, itemOption, item);
        
        // 표시 형식 적용 (플레이스홀더 치환)
        let displayText = optionConfig.display.format;
        
        for (const [key, value] of Object.entries(processedValues)) {
            // {value}, {value2} 등의 플레이스홀더 치환
            displayText = displayText.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
        }
        
        // 빈 플레이스홀더 정리
        displayText = displayText.replace(/\{[^}]+\}/g, '');
        
        // 텍스트 설정
        optionElement.textContent = displayText;
        
        // 색상 적용
        if (optionConfig.display.color) {
            if (optionConfig.display.color === 'default') {
                // 기본 색상은 변경하지 않음
            } else {
                optionElement.style.color = optionConfig.display.color;
            }
        }
        
        // 패턴 색상 적용 (정규식 기반)
        if (optionConfig.display.pattern_color && Array.isArray(optionConfig.display.pattern_color)) {
            // 원본 텍스트를 HTML로 변환
            let htmlContent = displayText;
            
            for (const patternColor of optionConfig.display.pattern_color) {
                const pattern = new RegExp(patternColor.pattern, 'g');
                const color = patternColor.color;
                
                // 패턴 매칭 부분에 색상 적용
                htmlContent = htmlContent.replace(pattern, match => 
                    `<span style="color: ${color}">${match}</span>`
                );
            }
            
            // HTML 내용 설정
            optionElement.innerHTML = htmlContent;
        }
        
        // 효과 목록 표시 (인챈트 등)
        if (optionConfig.display.enchant_effects && itemOption.option_desc) {
            const effectsList = renderEffectsList(
                itemOption.option_desc,
                optionConfig.display.enchant_effects
            );
            
            if (effectsList) {
                optionElement.appendChild(effectsList);
            }
        }
        
        // 세공 세부 정보 표시
        if (processedValues.reforge_detail) {
            const detailElement = document.createElement('div');
            detailElement.className = 'reforge-detail';
            detailElement.innerHTML = processedValues.reforge_detail;
            
            if (optionConfig.display.reforge_detail && optionConfig.display.reforge_detail.color) {
                detailElement.style.color = optionConfig.display.reforge_detail.color;
            }
            
            optionElement.appendChild(detailElement);
        }
        
        return optionElement;
    }
    
    /**
     * 기본 옵션 렌더링
     * @param {Object} itemOption - 아이템 옵션 데이터
     * @returns {HTMLElement} 렌더링된 요소
     */
    function renderBasicOption(itemOption) {
        const optionElement = document.createElement('div');
        optionElement.className = 'item-option-basic';
        
        // 기본 형식으로 표시
        optionElement.textContent = `${itemOption.option_type}: ${itemOption.option_value || ''}`;
        
        // 추가 설명이 있으면 표시
        if (itemOption.option_desc) {
            const descSpan = document.createElement('span');
            descSpan.className = 'option-desc';
            descSpan.textContent = ` (${itemOption.option_desc})`;
            optionElement.appendChild(descSpan);
        }
        
        return optionElement;
    }
    
    /**
     * 옵션 값 처리 및 변환
     * @param {Object} optionConfig - 옵션 설정
     * @param {Object} itemOption - 아이템 옵션 데이터
     * @param {Object} item - 아이템 데이터
     * @returns {Object} 처리된 값 객체
     */
    function processOptionValue(optionConfig, itemOption, item) {
        // 기본 값 추출
        const result = {
            value: itemOption.option_value || '',
            value2: itemOption.option_value2 || '',
            sub_type: itemOption.option_sub_type || '',
            desc: itemOption.option_desc || ''
        };
        
        // 변환 처리
        if (optionConfig.display && optionConfig.display.transform) {
            for (const transform of optionConfig.display.transform) {
                applyTransform(transform, result, item);
            }
        }
        
        return result;
    }
    
    /**
     * 변환 적용
     * @param {Object} transform - 변환 설정
     * @param {Object} values - 값 객체
     * @param {Object} item - 아이템 데이터
     */
    function applyTransform(transform, values, item) {
        const operation = transform.operation;
        
        switch (operation) {
            case 'removePercent':
                // % 기호 제거
                if (transform.field && values[transform.field]) {
                    const as = transform.as || transform.field;
                    values[as] = values[transform.field].replace('%', '');
                }
                break;
            
            case 'extractEnchantInfo':
                // 인챈트 정보 추출
                if (transform.source && values[transform.source]) {
                    const sourceText = values[transform.source];
                    
                    if (transform.extract && Array.isArray(transform.extract)) {
                        for (const extract of transform.extract) {
                            if (extract.pattern && extract.as) {
                                const regex = new RegExp(extract.pattern);
                                const match = sourceText.match(regex);
                                
                                if (match) {
                                    const value = match[1] || '';
                                    
                                    if (extract.format) {
                                        values[extract.as] = extract.format.replace('{0}', value);
                                    } else {
                                        values[extract.as] = value;
                                    }
                                } else {
                                    values[extract.as] = '';
                                }
                            }
                        }
                    }
                }
                break;
            
            case 'conditionalField':
                // 조건부 필드 생성
                if (transform.field) {
                    if (transform.condition && transform.condition.type === 'fieldExists') {
                        const context = transform.condition.context || 'item';
                        const targetObj = context === 'item' ? item : values;
                        
                        const field = transform.condition.field;
                        const fieldValue = transform.condition.value;
                        
                        // 필드가 있는지 확인
                        let fieldExists = false;
                        
                        if (field === 'item_option' && Array.isArray(targetObj[field])) {
                            // 옵션 중에 특정 type이 있는지 확인
                            fieldExists = targetObj[field].some(opt => opt.option_type === fieldValue);
                        } else {
                            fieldExists = targetObj[field] !== undefined;
                        }
                        
                        // 조건에 따라 값 설정
                        values[transform.field] = fieldExists ? transform.true_value : transform.false_value;
                    }
                }
                break;
            
            case 'extractReforgeInfo':
                // 세공 정보 추출
                if (transform.source && values[transform.source]) {
                    const sourceText = values[transform.source];
                    
                    if (transform.extract && Array.isArray(transform.extract)) {
                        for (const extract of transform.extract) {
                            if (extract.pattern && extract.as) {
                                const regex = new RegExp(extract.pattern);
                                const match = sourceText.match(regex);
                                
                                if (match) {
                                    values[extract.as] = match[1] || '';
                                } else {
                                    values[extract.as] = '';
                                }
                            }
                        }
                    }
                    
                    // 세공 세부 정보 추출
                    if (transform.reforge_detail && transform.reforge_detail.pattern) {
                        const regex = new RegExp(transform.reforge_detail.pattern);
                        const match = sourceText.match(regex);
                        
                        if (match) {
                            const detail = match[1] || '';
                            const format = transform.reforge_detail.format || '{0}';
                            values.reforge_detail = format.replace('{0}', detail);
                        }
                    }
                }
                break;
            
            default:
                // 지원하지 않는 변환 유형
                console.warn(`지원하지 않는 변환 유형: ${operation}`);
        }
    }
    
    /**
     * 효과 목록 렌더링
     * @param {string} effectsText - 효과 설명 텍스트
     * @param {Object} config - 효과 표시 설정
     * @returns {HTMLElement} 렌더링된 요소
     */
    function renderEffectsList(effectsText, config) {
        if (!effectsText) return null;
        
        // 효과 분리
        const separator = config.separator || ',';
        const effects = effectsText.split(separator).map(str => str.trim());
        
        // 빈 항목 필터링
        if (effects.length === 0) return null;
        
        // 효과 목록 컨테이너
        const effectsList = document.createElement('ul');
        effectsList.className = 'effects-list';
        
        // 각 효과 추가
        for (const effect of effects) {
            if (!effect) continue;
            
            const li = document.createElement('li');
            li.className = 'effect-item';
            
            // 줄 앞에 접두어 추가
            const linePrefix = config.line_prefix || '';
            
            // 효과 텍스트 설정
            const effectText = `${linePrefix}${effect}`;
            li.textContent = effectText;
            
            // 효과 색상 적용
            if (config.effect_colors) {
                // 기본값 설정
                const defaultPositive = config.effect_colors.defaultPositive || true;
                let isPositive = defaultPositive;
                
                // 부정 키워드 검사
                if (config.effect_colors.negativeKeywords && Array.isArray(config.effect_colors.negativeKeywords)) {
                    isPositive = !config.effect_colors.negativeKeywords.some(keyword => effect.includes(keyword));
                }
                
                // 색상 적용
                const color = isPositive ? 
                    (config.effect_colors.positive || 'blue') : 
                    (config.effect_colors.negative || 'red');
                
                li.style.color = color;
            }
            
            effectsList.appendChild(li);
        }
        
        return effectsList;
    }
    
    /**
     * 메타데이터 로드
     * @param {string} path - 메타데이터 파일 경로
     * @param {Object} context - 컨텍스트 객체 (카테고리, 아이템 타입 등)
     * @returns {Promise<Object>} 메타데이터 객체
     */
    async function loadMetadata(path, context = {}) {
        if (!path) return null;
        
        // 경로 내 변수 대체
        let resolvedPath = path;
        
        for (const [key, value] of Object.entries(context)) {
            resolvedPath = resolvedPath.replace(`{${key}}`, value);
        }
        
        // 캐시에서 확인
        if (state.metaCache.has(resolvedPath)) {
            return state.metaCache.get(resolvedPath);
        }
        
        try {
            const response = await fetch(resolvedPath);
            
            if (!response.ok) {
                throw new Error(`메타데이터 로드 실패: ${response.status}`);
            }
            
            const data = await response.json();
            
            // 캐시에 저장
            state.metaCache.set(resolvedPath, data);
            
            return data;
        } catch (error) {
            console.error(`메타데이터 로드 실패: ${resolvedPath}`, error);
            return null;
        }
    }
    
    /**
     * 아이템 필터 UI 생성
     * @param {string} categoryId - 카테고리 ID
     * @param {HTMLElement} container - 필터를 추가할 컨테이너
     */
    async function generateFilterUI(categoryId, container) {
        if (!categoryId || !container) return;
        
        // 옵션 구조 로드
        await loadOptionStructure(categoryId);
        
        // 컨테이너 초기화
        container.innerHTML = '';
        
        // 옵션 구조가 없는 경우
        if (!state.optionStructure) {
            container.innerHTML = `
                <div class="no-filters">
                    필터 구성을 불러올 수 없습니다.
                </div>
            `;
            return;
        }
        
        // 필터 생성 가능한 옵션 수집
        const filterableOptions = [];
        
        for (const [optionId, optionConfig] of Object.entries(state.optionConfig)) {
            // 필터 설정이 있는 경우만 추가
            if (optionConfig.filter) {
                filterableOptions.push({
                    id: optionId,
                    ...optionConfig
                });
            }
        }
        
        // 블록별로 그룹화
        const blockGroups = {};
        
        for (const option of filterableOptions) {
            const blockId = option.block || 'default';
            
            if (!blockGroups[blockId]) {
                blockGroups[blockId] = [];
            }
            
            blockGroups[blockId].push(option);
        }
        
        // 블록 순서대로 필터 그룹 생성
        const sortedBlocks = Object.entries(state.blockConfig)
            .sort(([, a], [, b]) => (a.order || 999) - (b.order || 999));
        
        for (const [blockId, blockConfig] of sortedBlocks) {
            // 블록에 필터링 가능한 옵션이 있는 경우
            if (blockGroups[blockId] && blockGroups[blockId].length > 0) {
                // 필터 그룹 생성
                const groupElement = document.createElement('div');
                groupElement.className = 'filter-group';
                
                // 블록 제목이 있으면 추가
                if (blockConfig.title) {
                    const titleElement = document.createElement('div');
                    titleElement.className = 'filter-group-title';
                    titleElement.textContent = blockConfig.title;
                    groupElement.appendChild(titleElement);
                }
                
                // 필터 옵션 리스트
                const optionsList = document.createElement('ul');
                optionsList.className = 'filter-options-list';
                
                // 각 필터 옵션 추가
                for (const optionConfig of blockGroups[blockId]) {
                    // 필터 타입에 따라 UI 생성
                    const filterElement = createFilterElement(optionConfig, categoryId);
                    
                    if (filterElement) {
                        const li = document.createElement('li');
                        li.className = 'filter-option';
                        li.appendChild(filterElement);
                        optionsList.appendChild(li);
                    }
                }
                
                // 옵션 목록 추가
                if (optionsList.children.length > 0) {
                    groupElement.appendChild(optionsList);
                    container.appendChild(groupElement);
                }
            }
        }
        
        // 필터가 없는 경우 안내 메시지
        if (container.children.length === 0) {
            container.innerHTML = `
                <div class="no-filters">
                    현재 카테고리에 필터가 없습니다.
                </div>
            `;
        }
    }
    
    /**
     * 필터 요소 생성
     * @param {Object} optionConfig - 옵션 설정
     * @param {string} categoryId - 카테고리 ID
     * @returns {HTMLElement} 필터 요소
     */
    function createFilterElement(optionConfig, categoryId) {
        if (!optionConfig.filter) return null;
        
        // filter.visible이 명시적으로 false인 경우 건너뛰기
        if (optionConfig.filter.visible === false) {
            return null;
        }
        
        // 필터 이름
        const filterName = optionConfig.filter.name || optionConfig.id;
        
        // 필터 컨테이너
        const filterContainer = document.createElement('div');
        filterContainer.className = `filter-container filter-type-${optionConfig.filter.type}`;
        filterContainer.dataset.filterId = optionConfig.id;
        
        // 필터 헤더 (이름)
        const filterHeader = document.createElement('div');
        filterHeader.className = 'filter-header';
        filterHeader.textContent = filterName;
        filterContainer.appendChild(filterHeader);
        
        // 필터 타입에 따른 UI 생성
        const filterContent = document.createElement('div');
        filterContent.className = 'filter-content';
        
        switch (optionConfig.filter.type) {
            case 'range':
                // 범위 필터 (최소/최대 값)
                const rangeInputs = document.createElement('div');
                rangeInputs.className = 'range-inputs';
                
                // 최소값 입력
                const minInput = document.createElement('input');
                minInput.type = 'number';
                minInput.className = 'min-value';
                minInput.placeholder = '최소값';
                minInput.dataset.field = 'min';
                
                // 최대값 입력
                const maxInput = document.createElement('input');
                maxInput.type = 'number';
                maxInput.className = 'max-value';
                maxInput.placeholder = '최대값';
                maxInput.dataset.field = 'max';
                
                // 범위 입력 추가
                rangeInputs.appendChild(minInput);
                rangeInputs.appendChild(document.createTextNode(' ~ '));
                rangeInputs.appendChild(maxInput);
                
                // 이벤트 리스너 추가
                [minInput, maxInput].forEach(input => {
                    input.addEventListener('change', () => {
                        triggerFilterChange(optionConfig.id, filterContainer);
                    });
                });
                
                filterContent.appendChild(rangeInputs);
                break;
            
            case 'select':
                // 선택 필터
                const select = document.createElement('select');
                select.className = 'filter-select';
                
                // 기본 옵션
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = '선택 안함';
                select.appendChild(defaultOption);
                
                // 옵션 추가
                if (optionConfig.filter.options && Array.isArray(optionConfig.filter.options)) {
                    for (const option of optionConfig.filter.options) {
                        const optElement = document.createElement('option');
                        optElement.value = option;
                        optElement.textContent = option;
                        select.appendChild(optElement);
                    }
                }
                
                // 이벤트 리스너 추가
                select.addEventListener('change', () => {
                    triggerFilterChange(optionConfig.id, filterContainer);
                });
                
                filterContent.appendChild(select);
                break;
            
            case 'text':
                // 텍스트 필터
                const textInput = document.createElement('input');
                textInput.type = 'text';
                textInput.className = 'filter-text';
                textInput.placeholder = '검색어 입력';
                
                // 이벤트 리스너 추가
                textInput.addEventListener('input', Utils.debounce(() => {
                    triggerFilterChange(optionConfig.id, filterContainer);
                }, 300));
                
                filterContent.appendChild(textInput);
                break;
            
            case 'composite':
                // 복합 필터 (여러 필드로 구성)
                if (optionConfig.filter.fields && Array.isArray(optionConfig.filter.fields)) {
                    for (const field of optionConfig.filter.fields) {
                        const fieldContainer = document.createElement('div');
                        fieldContainer.className = 'composite-field';
                        
                        // 필드 이름
                        const fieldLabel = document.createElement('label');
                        fieldLabel.textContent = field.name || field.field;
                        fieldContainer.appendChild(fieldLabel);
                        
                        // 필드 타입에 따른 입력 요소
                        let inputElement;
                        
                        switch (field.type) {
                            case 'select':
                                inputElement = document.createElement('select');
                                inputElement.className = 'field-select';
                                
                                // 기본 옵션
                                const defaultOpt = document.createElement('option');
                                defaultOpt.value = '';
                                defaultOpt.textContent = '선택 안함';
                                inputElement.appendChild(defaultOpt);
                                
                                // 옵션 추가
                                if (field.options && Array.isArray(field.options)) {
                                    for (const option of field.options) {
                                        const optElement = document.createElement('option');
                                        optElement.value = option;
                                        optElement.textContent = option;
                                        inputElement.appendChild(optElement);
                                    }
                                }
                                break;
                            
                            case 'range':
                                inputElement = document.createElement('input');
                                inputElement.type = 'number';
                                inputElement.className = 'field-range';
                                inputElement.placeholder = '값 입력';
                                break;
                            
                            default:
                                inputElement = document.createElement('input');
                                inputElement.type = 'text';
                                inputElement.className = 'field-text';
                                inputElement.placeholder = '값 입력';
                        }
                        
                        // 필드 속성 설정
                        inputElement.dataset.field = field.field;
                        
                        // 이벤트 리스너 추가
                        inputElement.addEventListener('change', () => {
                            triggerFilterChange(optionConfig.id, filterContainer);
                        });
                        
                        fieldContainer.appendChild(inputElement);
                        filterContent.appendChild(fieldContainer);
                    }
                }
                break;
            
            case 'reforge':
                // 세공 필터 (메타데이터 기반)
                (async () => {
                    const metaPath = optionConfig.filter.meta_path;
                    
                    if (metaPath) {
                        // 메타데이터 로드
                        const metadata = await loadMetadata(metaPath, {
                            category: categoryId
                        });
                        
                        if (metadata && metadata.reforges) {
                            // 세공 옵션이 있는 경우
                            const categoryReforges = metadata.reforges[categoryId];
                            
                            if (categoryReforges && Array.isArray(categoryReforges)) {
                                // 세공 선택 드롭다운
                                const reforgeSelect = document.createElement('select');
                                reforgeSelect.className = 'reforge-select';
                                
                                // 기본 옵션
                                const defaultOption = document.createElement('option');
                                defaultOption.value = '';
                                defaultOption.textContent = '세공 선택';
                                reforgeSelect.appendChild(defaultOption);
                                
                                // 세공 옵션 추가
                                for (const reforge of categoryReforges) {
                                    const option = document.createElement('option');
                                    option.value = reforge;
                                    option.textContent = reforge;
                                    reforgeSelect.appendChild(option);
                                }
                                
                                // 이벤트 리스너 추가
                                reforgeSelect.addEventListener('change', () => {
                                    // 세공 레벨 입력 활성화/비활성화
                                    const hasValue = reforgeSelect.value !== '';
                                    reforgeLevel.disabled = !hasValue;
                                    
                                    triggerFilterChange(optionConfig.id, filterContainer);
                                });
                                
                                // 세공 레벨 입력
                                const reforgeLevel = document.createElement('input');
                                reforgeLevel.type = 'number';
                                reforgeLevel.className = 'reforge-level';
                                reforgeLevel.placeholder = '레벨';
                                reforgeLevel.min = 1;
                                reforgeLevel.max = 20;
                                reforgeLevel.disabled = true;
                                
                                // 이벤트 리스너 추가
                                reforgeLevel.addEventListener('change', () => {
                                    triggerFilterChange(optionConfig.id, filterContainer);
                                });
                                
                                // UI 추가
                                const reforgeContainer = document.createElement('div');
                                reforgeContainer.className = 'reforge-inputs';
                                reforgeContainer.appendChild(reforgeSelect);
                                reforgeContainer.appendChild(reforgeLevel);
                                
                                filterContent.appendChild(reforgeContainer);
                            }
                        }
                    }
                })();
                break;
            
            case 'set_effect':
                // 세트 효과 필터 (메타데이터 기반)
                (async () => {
                    const metaPath = optionConfig.filter.meta_path;
                    
                    if (metaPath) {
                        // 메타데이터 로드
                        const metadata = await loadMetadata(metaPath, {
                            category: categoryId
                        });
                        
                        if (metadata && metadata.set_effects) {
                            // 세트 효과 선택 드롭다운
                            const setSelect = document.createElement('select');
                            setSelect.className = 'set-effect-select';
                            
                            // 기본 옵션
                            const defaultOption = document.createElement('option');
                            defaultOption.value = '';
                            defaultOption.textContent = '세트 효과 선택';
                            setSelect.appendChild(defaultOption);
                            
                            // 세트 효과 옵션 추가
                            for (const setEffect of metadata.set_effects) {
                                const option = document.createElement('option');
                                option.value = setEffect;
                                option.textContent = setEffect;
                                setSelect.appendChild(option);
                            }
                            
                            // 이벤트 리스너 추가
                            setSelect.addEventListener('change', () => {
                                triggerFilterChange(optionConfig.id, filterContainer);
                            });
                            
                            filterContent.appendChild(setSelect);
                        }
                    }
                })();
                break;
            
            default:
                // 지원하지 않는 필터 타입
                console.warn(`지원하지 않는 필터 타입: ${optionConfig.filter.type}`);
                return null;
        }
        
        // 필터 내용 추가
        filterContainer.appendChild(filterContent);
        
        return filterContainer;
    }
    
    /**
     * 필터 변경 이벤트 발생
     * @param {string} filterId - 필터 ID
     * @param {HTMLElement} filterContainer - 필터 컨테이너
     */
    function triggerFilterChange(filterId, filterContainer) {
        // 필터 값 추출
        const filterValue = getFilterValue(filterContainer);
        
        // 필터 변경 이벤트 발생
        const event = new CustomEvent('filterValueChanged', {
            detail: {
                filterId,
                filterValue
            }
        });
        
        document.dispatchEvent(event);
    }
    
    /**
     * 필터 값 추출
     * @param {HTMLElement} filterContainer - 필터 컨테이너
     * @returns {Object} 필터 값
     */
    function getFilterValue(filterContainer) {
        // 필터 유형 확인
        const filterType = filterContainer.className.match(/filter-type-(\w+)/);
        
        if (!filterType) return null;
        
        const type = filterType[1];
        const result = { type };
        
        switch (type) {
            case 'range':
                // 범위 필터 값 추출
                const minInput = filterContainer.querySelector('.min-value');
                const maxInput = filterContainer.querySelector('.max-value');
                
                if (minInput) result.min = minInput.value;
                if (maxInput) result.max = maxInput.value;
                break;
            
            case 'select':
                // 선택 필터 값 추출
                const select = filterContainer.querySelector('.filter-select');
                if (select) result.value = select.value;
                break;
            
            case 'text':
                // 텍스트 필터 값 추출
                const textInput = filterContainer.querySelector('.filter-text');
                if (textInput) result.value = textInput.value;
                break;
            
            case 'composite':
                // 복합 필터 값 추출
                result.fields = {};
                
                // 모든 필드 입력 요소 가져오기
                const fieldInputs = filterContainer.querySelectorAll('[data-field]');
                
                fieldInputs.forEach(input => {
                    const fieldName = input.dataset.field;
                    result.fields[fieldName] = input.value;
                });
                break;
            
            case 'reforge':
                // 세공 필터 값 추출
                const reforgeSelect = filterContainer.querySelector('.reforge-select');
                const reforgeLevel = filterContainer.querySelector('.reforge-level');
                
                if (reforgeSelect) result.name = reforgeSelect.value;
                if (reforgeLevel) result.level = reforgeLevel.value;
                break;
            
            case 'set_effect':
                // 세트 효과 필터 값 추출
                const setSelect = filterContainer.querySelector('.set-effect-select');
                if (setSelect) result.value = setSelect.value;
                break;
            
            default:
                // 지원하지 않는 필터 타입
                console.warn(`지원하지 않는 필터 타입: ${type}`);
                return null;
        }
        
        return result;
    }
    
    /**
     * 이벤트 리스너 설정
     */
    function setupEventListeners() {
        // 카테고리 변경 이벤트 리스너
        document.addEventListener('categoryChanged', async (e) => {
            const { mainCategory, subCategory } = e.detail;
            
            if (subCategory) {
                // 해당 카테고리의 옵션 구조 로드
                await loadOptionStructure(subCategory);
                
                // 필터 UI 업데이트
                const filterContainer = document.getElementById('detail-options-list');
                if (filterContainer) {
                    generateFilterUI(subCategory, filterContainer);
                }
            }
        });
    }
    
    // 공개 API
    return {
        init,
        loadOptionStructure,
        renderItemDetails,
        generateFilterUI
    };
})();
