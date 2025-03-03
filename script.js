// 데이터를 저장할 변수
let effectsData = [];
let filteredData = [];
let observer; // Intersection Observer를 위한 변수

// 색상 정의
const colors = [
    { name: '하얀색', code: '#ffffff', isActive: false },
    { name: '검은색', code: '#000000', isActive: false },
    { name: '빨간색', code: '#ff0000', isActive: false },
    { name: '주황색', code: '#ffa500', isActive: false },
    { name: '노란색', code: '#ffff00', isActive: false },
    { name: '초록색', code: '#00ff00', isActive: false },
    { name: '파란색', code: '#0000ff', isActive: false },
    { name: '보라색', code: '#800080', isActive: false },
    { name: '분홍색', code: '#ffc0cb', isActive: false },
    { name: '하늘색', code: '#87ceeb', isActive: false },
    { name: '갈색', code: '#a52a2a', isActive: false },
    { name: '청록색', code: '#008080', isActive: false }
];

// 선택된 필터 상태
let loopFilterActive = false;
let activeColorFilters = [];
let selectedSet = '';

// 초기화 및 데이터 로드
document.addEventListener('DOMContentLoaded', () => {
    initIntersectionObserver();
    loadData();
    setupEventListeners();
});

// Intersection Observer 초기화
function initIntersectionObserver() {
    observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const cardEl = entry.target;
            const videoEl = cardEl.querySelector('video');
            
            if (entry.isIntersecting) {
                if (videoEl && !videoEl.dataset.played) {
                    playPreviewVideo(videoEl);
                }
            } else {
                if (videoEl) {
                    videoEl.pause();
                    videoEl.currentTime = 0;
                }
            }
        });
    }, { threshold: 0.1 });
}

// 비디오 미리보기 재생 (5초만 재생)
function playPreviewVideo(videoEl) {
    videoEl.currentTime = 0;
    videoEl.dataset.played = 'true';
    
    videoEl.play().catch(e => console.log('비디오 재생 실패:', e));
    
    // 5초 후에 정지
    setTimeout(() => {
        if (!videoEl.paused) {
            videoEl.pause();
            videoEl.currentTime = 0;
        }
    }, 5000);
}

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
        
        // 카드 렌더링 (청크 단위로)
        renderCardsInChunks(effectsData);
        
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
        
        colorFiltersContainer.appendChild(colorBtn);
    });
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
    
    // 세트 옵션 추가
    Array.from(sets).sort().forEach(set => {
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
        
        // 색상 필터 (여러 색상 중 하나라도 일치하면 통과)
        let colorMatch = true;
        if (activeColorFilters.length > 0) {
            colorMatch = activeColorFilters.some(color => 
                effect.color1 === color || 
                effect.color2 === color || 
                effect.color3 === color
            );
        }
        
        // 세트 필터
        const setMatch = !selectedSet || effect.set === selectedSet;
        
        // 무한지속 필터
        const loopMatch = !loopFilterActive || effect.loop === true;
        
        return nameMatch && colorMatch && setMatch && loopMatch;
    });
    
    // 필터링된 결과 다시 렌더링 (청크 단위로)
    renderCardsInChunks(filteredData);
    
    // 통계 업데이트
    updateStats();
}

// 카드를 청크 단위로 렌더링 (성능 최적화)
function renderCardsInChunks(data, chunkSize = 15) {
    const container = document.getElementById('card-container');
    container.innerHTML = '';
    
    // Intersection Observer에서 이전 관찰 중단
    if (observer) {
        document.querySelectorAll('.card').forEach(card => {
            observer.unobserve(card);
        });
    }
    
    // 데이터가 없는 경우 메시지 표시
    if (data.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.textContent = '검색 결과가 없습니다.';
        container.appendChild(noResults);
        return;
    }
    
    let index = 0;
    
    function renderNextChunk() {
        if (index >= data.length) return;
        
        const chunk = data.slice(index, index + chunkSize);
        chunk.forEach(effect => createCard(effect, container));
        
        index += chunkSize;
        
        if (index < data.length) {
            // 다음 청크는 requestAnimationFrame으로 브라우저가 준비되었을 때 렌더링
            window.requestAnimationFrame(renderNextChunk);
        }
    }
    
    renderNextChunk();
}

// 개별 카드 생성
function createCard(effect, container) {
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
    }
    
    // 카드 클릭 이벤트
    card.addEventListener('click', () => openModal(effect));
    
    container.appendChild(card);
    
    // 새로 추가된 카드를 Intersection Observer로 관찰
    observer.observe(card);
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
    
    // 색상 정보 - 항상 동일한 레이아웃 유지
    modalColors.innerHTML = '<div class="color-list"></div>';
    const colorList = modalColors.querySelector('.color-list');
    
    // 색상 정보 추가 (색상이 1~3개여도 동일한 레이아웃)
    for (let i = 1; i <= 3; i++) {
        const colorKey = `color${i}`;
        const colorItem = document.createElement('div');
        colorItem.className = 'color-item';
        
        if (effect[colorKey]) {
            colorItem.innerHTML = `
                <div class="color-dot" style="background-color: ${getColorCode(effect[colorKey])}"></div>
                <span>${effect[colorKey]}</span>
            `;
        } else {
            // 빈 색상 자리 (레이아웃 유지를 위해)
            colorItem.style.visibility = 'hidden';
            colorItem.innerHTML = `
                <div class="color-dot"></div>
                <span>없음</span>
            `;
        }
        
        colorList.appendChild(colorItem);
    }
    
    // 속성 정보 (세트, 무한지속)
    modalAttributes.innerHTML = '';
    
    // 세트 정보
    if (effect.set && effect.set.trim() !== '') {
        const setItem = document.createElement('div');
        setItem.className = 'attribute-item';
        setItem.innerHTML = `<span class="attribute-label">세트:</span> ${effect.set}`;
        modalAttributes.appendChild(setItem);
    }
    
    // 무한지속 여부
    const loopItem = document.createElement('div');
    loopItem.className = 'attribute-item';
    loopItem.innerHTML = `<span class="attribute-label">무한지속:</span> ${effect.loop ? '예' : '아니오'}`;
    modalAttributes.appendChild(loopItem);
    
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
