// 데이터를 저장할 변수
let effectsData = [];
let filteredData = [];

// 색상 정의 - 순서대로 정렬
const colors = [
    // 기본 무지개 색상 (위쪽 행)
    { name: '빨간색', code: '#ff0000', isActive: false, group: 'basic' },
    { name: '주황색', code: '#ffa500', isActive: false, group: 'basic' },
    { name: '노란색', code: '#ffff00', isActive: false, group: 'basic' },
    { name: '초록색', code: '#00ff00', isActive: false, group: 'basic' },
    { name: '파란색', code: '#0000ff', isActive: false, group: 'basic' },
    { name: '보라색', code: '#800080', isActive: false, group: 'basic' },
    
    // 기타 색상 (아래쪽 행)
    { name: '하얀색', code: '#ffffff', isActive: false, group: 'other' },
    { name: '검은색', code: '#000000', isActive: false, group: 'other' },
    { name: '분홍색', code: '#ffc0cb', isActive: false, group: 'other' },
    { name: '하늘색', code: '#87ceeb', isActive: false, group: 'other' },
    { name: '갈색', code: '#a52a2a', isActive: false, group: 'other' },
    { name: '청록색', code: '#008080', isActive: false, group: 'other' }
];

// 선택된 필터 상태
let loopFilterActive = false;
let activeColorFilters = [];
let selectedSet = '';

// 초기화 및 데이터 로드
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
});

// JSON 파일 로드
async function loadData() {
    try {
        const response = await fetch('effects.json');
        effectsData = await response.json();
        // 역순으로 정렬 (최신 항목이 맨 위로)
        effectsData = effectsData.reverse();
        filteredData = [...effectsData];
        
        // 색상 필터 버튼 생성
        createColorFilters();
        
        // 세트 필터 옵션 생성
        populateSetOptions();
        
        // 카드 렌더링
        renderCards(effectsData);
        
        // 통계 업데이트
        updateStats();
    } catch (error) {
        console.error('데이터 로드 중 오류 발생:', error);
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 검색창 이벤트
    document.getElementById('search').addEventListener('input', applyFilters);
    
    // 무한지속 필터 이벤트
    document.getElementById('loopFilter').addEventListener('click', () => {
        loopFilterActive = !loopFilterActive;
        document.getElementById('loopFilter').classList.toggle('active', loopFilterActive);
        applyFilters();
    });
    
    // 세트 필터 이벤트
    document.getElementById('setFilter').addEventListener('change', (e) => {
        selectedSet = e.target.value;
        applyFilters();
    });
    
    // 모달 닫기 이벤트 (모달 외부 클릭)
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('modal');
        if (event.target === modal) {
            closeModal();
        }
    });
    
    // 키보드 ESC 키 이벤트 (모달 닫기)
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.getElementById('modal').style.display === 'block') {
            closeModal();
        }
    });
}

// 모달 닫기 함수
function closeModal() {
    const modal = document.getElementById('modal');
    const modalVideo = document.querySelector('.modal-video');
    
    if (modalVideo) {
        modalVideo.pause();
    }
    
    modal.style.display = 'none';
}

// 색상 필터 버튼 생성
function createColorFilters() {
    const colorFiltersContainer = document.getElementById('colorFilters');
    
    // 두 행으로 나누기
    const basicColorsDiv = document.createElement('div');
    basicColorsDiv.className = 'basic-colors';
    
    const otherColorsDiv = document.createElement('div');
    otherColorsDiv.className = 'other-colors';
    
    // 색상 필터 버튼 생성
    colors.forEach((color, index) => {
        const colorBtn = document.createElement('div');
        colorBtn.className = 'color-filter';
        colorBtn.style.backgroundColor = color.code;
        
        // 검은색과 하얀색에는 테두리 강화
        if (color.name === '하얀색') {
            colorBtn.style.border = '1px solid #aaa';
        } else if (color.name === '검은색') {
            colorBtn.style.border = '1px solid #ccc';
        }
        
        colorBtn.title = color.name;
        
        // 클릭 이벤트
        colorBtn.addEventListener('click', () => {
            colors[index].isActive = !colors[index].isActive;
            
            // 모든 버튼이 활성화되면 모두 비활성화
            if (colors.every(c => c.isActive)) {
                colors.forEach(c => c.isActive = false);
            }
            
            // UI 업데이트
            updateColorFilterUI();
            
            // 활성화된 색상 필터 업데이트
            activeColorFilters = colors.filter(c => c.isActive).map(c => c.name);
            
            // 필터링 적용
            applyFilters();
        });
        
        // 그룹에 따라 추가
        if (color.group === 'basic') {
            basicColorsDiv.appendChild(colorBtn);
        } else {
            otherColorsDiv.appendChild(colorBtn);
        }
    });
    
    // 컨테이너에 추가
    colorFiltersContainer.appendChild(basicColorsDiv);
    colorFiltersContainer.appendChild(otherColorsDiv);
}

// 세트 필터 옵션 채우기
function populateSetOptions() {
    const setFilter = document.getElementById('setFilter');
    const sets = new Set();
    
    // 세트 이름 수집
    effectsData.forEach(effect => {
        if (effect.set && effect.set.trim() !== '') {
            sets.add(effect.set);
        }
    });
    
    // 세트 옵션 추가 (가나다순 정렬)
    Array.from(sets).sort((a, b) => a.localeCompare(b, 'ko')).forEach(set => {
        const option = document.createElement('option');
        option.value = set;
        option.textContent = set;
        setFilter.appendChild(option);
    });
}

// 색상 필터 UI 업데이트
function updateColorFilterUI() {
    const colorFilters = document.querySelectorAll('.color-filter');
    colors.forEach((color, index) => {
        colorFilters[index].classList.toggle('active', color.isActive);
    });
}

// 모든 필터 적용
function applyFilters() {
    const searchText = document.getElementById('search').value.toLowerCase();
    
    filteredData = effectsData.filter(effect => {
        // 검색어 필터
        const nameMatch = effect.name.toLowerCase().includes(searchText);
        
        // 색상 필터 (모든 선택된 색상을 포함하는 경우만 통과)
        let colorMatch = true;
        if (activeColorFilters.length > 0) {
            colorMatch = activeColorFilters.every(color => {
                return effect.color1 === color || 
                       effect.color2 === color || 
                       effect.color3 === color;
            });
        }
        
        // 세트 필터
        const setMatch = !selectedSet || effect.set === selectedSet;
        
        // 무한지속 필터
        const loopMatch = !loopFilterActive || effect.loop === true;
        
        return nameMatch && colorMatch && setMatch && loopMatch;
    });
    
    // 필터링된 결과 다시 렌더링
    renderCards(filteredData);
    
    // 통계 업데이트
    updateStats();
}

// 카드 렌더링 함수
function renderCards(data) {
    const container = document.getElementById('card-container');
    container.innerHTML = '';
    
    // 데이터가 없는 경우 메시지 표시
    if (data.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.textContent = '검색 결과가 없습니다.';
        container.appendChild(noResults);
        return;
    }
    
    data.forEach(effect => {
        const card = document.createElement('div');
        card.className = 'card';
        
        // 색상 표시를 위한 HTML 생성
        const colorsHTML = [];
        if (effect.color1) colorsHTML.push(`<div class="color-dot" style="background-color: ${getColorCode(effect.color1)}" title="${effect.color1}"></div>`);
        if (effect.color2) colorsHTML.push(`<div class="color-dot" style="background-color: ${getColorCode(effect.color2)}" title="${effect.color2}"></div>`);
        if (effect.color3) colorsHTML.push(`<div class="color-dot" style="background-color: ${getColorCode(effect.color3)}" title="${effect.color3}"></div>`);
        
        // 비디오 링크가 이미지인지 확인
        const isImage = effect.videoLink.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        
        if (isImage) {
            card.innerHTML = `
                <div class="card-video-container">
                    <img class="card-image" src="${effect.videoLink}" alt="${effect.name}">
                </div>
                <div class="card-info">
                    <div class="card-title">${effect.name}</div>
                    <div class="card-colors">
                        ${colorsHTML.join('')}
                    </div>
                </div>
            `;
        } else {
            card.innerHTML = `
                <div class="card-video-container">
                    <video class="card-video" src="${effect.videoLink}" muted playsinline preload="metadata"></video>
                </div>
                <div class="card-info">
                    <div class="card-title">${effect.name}</div>
                    <div class="card-colors">
                        ${colorsHTML.join('')}
                    </div>
                </div>
            `;
            
            // 호버링 시 비디오 재생/정지
            const videoContainer = card.querySelector('.card-video-container');
            const video = card.querySelector('.card-video');
            
            // 마우스 호버 이벤트
            videoContainer.addEventListener('mouseenter', () => {
                video.play().catch(e => console.log('비디오 재생 실패:', e));
            });
            
            // 마우스 나가기 이벤트
            videoContainer.addEventListener('mouseleave', () => {
                video.pause();
                video.currentTime = 0;
            });
            
            // 모바일용 터치 이벤트
            let touchTimer;
            videoContainer.addEventListener('touchstart', () => {
                touchTimer = setTimeout(() => {
                    video.play().catch(e => console.log('비디오 재생 실패:', e));
                }, 200); // 짧은 터치와 구분하기 위한 딜레이
            });
            
            videoContainer.addEventListener('touchend', () => {
                clearTimeout(touchTimer);
                video.pause();
                video.currentTime = 0;
            });
        }
        
        // 카드 클릭 이벤트
        card.addEventListener('click', () => openModal(effect));
        
        container.appendChild(card);
    });
}

// 모달 열기
function openModal(effect) {
    const modal = document.getElementById('modal');
    const modalMediaContainer = document.getElementById('modalMediaContainer');
    const modalTitle = document.getElementById('modalTitle');
    const modalColors = document.getElementById('modalColors');
    const modalAttributes = document.getElementById('modalAttributes');
    const modalReleaseInfo = document.getElementById('modalReleaseInfo');
    
    // 미디어 컨테이너 초기화
    modalMediaContainer.innerHTML = '';
    
    // 비디오 링크가 이미지인지 확인
    const isImage = effect.videoLink.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    
    // 미디어 요소 추가 (비디오 또는 이미지)
    if (isImage) {
        modalMediaContainer.innerHTML = `
            <img class="modal-image" src="${effect.videoLink}" alt="${effect.name}">
        `;
    } else {
        modalMediaContainer.innerHTML = `
            <video class="modal-video" src="${effect.videoLink}" controls autoplay ${effect.loop ? 'loop' : ''}></video>
        `;
    }
    
    // 제목 설정
    modalTitle.textContent = effect.name;
    
    // 색상 정보
    modalColors.innerHTML = '';
    
    if (effect.color1) {
        modalColors.innerHTML += `
            <div class="color-item">
                <div class="color-dot" style="background-color: ${getColorCode(effect.color1)}"></div>
                <span>${effect.color1}</span>
            </div>
        `;
    }
    
    if (effect.color2) {
        modalColors.innerHTML += `
            <div class="color-item">
                <div class="color-dot" style="background-color: ${getColorCode(effect.color2)}"></div>
                <span>${effect.color2}</span>
            </div>
        `;
    }
    
    if (effect.color3) {
        modalColors.innerHTML += `
            <div class="color-item">
                <div class="color-dot" style="background-color: ${getColorCode(effect.color3)}"></div>
                <span>${effect.color3}</span>
            </div>
        `;
    }
    
    // 속성 정보 (세트, 무한지속)
    modalAttributes.innerHTML = '';
    
    // 세트 정보
    if (effect.set && effect.set.trim() !== '') {
        modalAttributes.innerHTML += `
            <div class="attribute-item">
                ${effect.set}
            </div>
        `;
    }
    
    // 무한지속 여부 (true인 경우만 표시)
    if (effect.loop) {
        modalAttributes.innerHTML += `
            <div class="attribute-item">
                무한지속
            </div>
        `;
    }
    
    // 출시 정보 (출시일, 출시 키트)
    modalReleaseInfo.innerHTML = '';
    
    // 출시일
    if (effect.releaseDate) {
        modalReleaseInfo.innerHTML += `<div>${formatDate(effect.releaseDate)}</div>`;
    }
    
    // 출시 키트
    if (effect.releaseKit) {
        modalReleaseInfo.innerHTML += `<div>${effect.releaseKit}</div>`;
    }
    
    // 모달 표시
    modal.style.display = 'block';
}

// 날짜 형식 변경 (YYYY-MM-DD -> YYYY년 MM월 DD일)
function formatDate(dateString) {
    if (!dateString) return '';
    
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    
    return `${parts[0]}년 ${parts[1]}월 ${parts[2]}일`;
}

// 색상 이름에 따른 컬러 코드 반환
function getColorCode(colorName) {
    const colorMap = {
        '하얀색': '#ffffff',
        '검은색': '#000000',
        '빨간색': '#ff0000',
        '주황색': '#ffa500',
        '노란색': '#ffff00',
        '초록색': '#00ff00',
        '파란색': '#0000ff',
        '보라색': '#800080',
        '분홍색': '#ffc0cb',
        '하늘색': '#87ceeb',
        '갈색': '#a52a2a',
        '청록색': '#008080'
    };
    
    return colorMap[colorName] || '#cccccc';
}

// 통계 업데이트
function updateStats() {
    document.getElementById('totalCount').textContent = effectsData.length;
    document.getElementById('filteredCount').textContent = filteredData.length;
}
