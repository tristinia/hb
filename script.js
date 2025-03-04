// 데이터를 저장할 변수
let effectsData = [];
let filteredData = [];
let currentlyPlayingVideos = new Set();
let isLoading = false;
let currentOffset = 0;
const ITEMS_PER_PAGE = 20;
let videoPreloadTimeout = null;

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
    setupSticky();
    loadData();
    setupEventListeners();
    addFooter();
});

// 스크롤 시 헤더 고정
function setupSticky() {
    // 스티키 헤더 생성
    const stickyHeader = document.createElement('div');
    stickyHeader.className = 'sticky-header';
    stickyHeader.innerHTML = `
        <div class="sticky-title">마비노기 정령 형상변환 리큐르</div>
    `;
    document.body.appendChild(stickyHeader);
    
    // 스크롤 이벤트 리스너
    window.addEventListener('scroll', () => {
        const header = document.querySelector('header');
        const headerBottom = header.getBoundingClientRect().bottom;
        
        if (headerBottom <= 0) {
            stickyHeader.classList.add('visible');
        } else {
            stickyHeader.classList.remove('visible');
        }
    });
}

// 푸터 추가
function addFooter() {
    const footer = document.createElement('div');
    footer.className = 'footer';
    footer.textContent = 'WF신의컨트롤';
    document.body.appendChild(footer);
}

// JSON 파일 로드
async function loadData() {
    try {
        showLoading(true);
        const response = await fetch('effects.json');
        effectsData = await response.json();
        // 역순으로 정렬 (최신 항목이 맨 위로)
        effectsData = effectsData.reverse();
        filteredData = [...effectsData];
        
        // 색상 필터 버튼 생성
        createColorFilters();
        
        // 세트 필터 옵션 생성
        populateSetOptions();
        
        // 첫 페이지 카드 렌더링
        renderInitialCards();
        
        // 통계 업데이트
        updateStats();
        showLoading(false);
        
        // 스크롤 이벤트 리스너 설정
        setupScrollListener();
    } catch (error) {
        console.error('데이터 로드 중 오류 발생:', error);
        showLoading(false);
    }
}

// 로딩 상태 표시
function showLoading(isLoading) {
    const container = document.getElementById('card-container');
    if (isLoading) {
        container.style.opacity = '0.7';
    } else {
        container.style.opacity = '1';
    }
}

// 초기 카드 렌더링
function renderInitialCards() {
    currentOffset = 0;
    const container = document.getElementById('card-container');
    container.innerHTML = '';
    
    renderNextBatch();
}

// 다음 배치 카드 렌더링 (성능 최적화)
function renderNextBatch() {
    if (isLoading || currentOffset >= filteredData.length) return;
    
    const container = document.getElementById('card-container');
    const itemsToRender = Math.min(ITEMS_PER_PAGE, filteredData.length - currentOffset);
    
    if (itemsToRender <= 0) {
        if (filteredData.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.textContent = '검색 결과가 없습니다.';
            container.appendChild(noResults);
        }
        return;
    }
    
    isLoading = true;
    
    // requestAnimationFrame을 사용해 최적의 타이밍에 렌더링
    requestAnimationFrame(() => {
        // 문서 프래그먼트를 사용해 DOM 조작 최소화
        const fragment = document.createDocumentFragment();
        
        // 배치 처리로 카드 생성
        for (let i = 0; i < itemsToRender; i++) {
            const effect = filteredData[currentOffset + i];
            const card = createCard(effect);
            
            // 적은 수의 카드만 애니메이션 적용 (최대 10개)
            if (i < 10) {
                if (i % 2 === 0) {
                    card.classList.add('new-card-left');
                } else {
                    card.classList.add('new-card-right');
                }
            }
            
            fragment.appendChild(card);
        }
        
        container.appendChild(fragment);
        currentOffset += itemsToRender;
        
        isLoading = false;
    });
}

// 스크롤 리스너 설정 (성능 최적화)
function setupScrollListener() {
    // 디바운스 적용한 스크롤 핸들러
    let scrollTimeout;
    
    window.addEventListener('scroll', () => {
        if (isLoading) return;
        
        // 스크롤 이벤트 디바운싱
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        
        scrollTimeout = setTimeout(() => {
            const scrollHeight = document.documentElement.scrollHeight;
            const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            const clientHeight = document.documentElement.clientHeight;
            
            // 페이지 하단에 도달하면 다음 배치 로드
            if (scrollTop + clientHeight >= scrollHeight - 500) {
                renderNextBatch();
            }
        }, 100); // 100ms 디바운스
    });
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 제목 클릭 시 상단으로 스크롤
    document.querySelector('h1').addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    // 스티키 헤더 제목 클릭 시 상단으로 스크롤
    document.querySelector('.sticky-title').addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    // 검색창 이벤트
    document.getElementById('search').addEventListener('input', debounce(() => {
        applyFilters();
    }, 300));
    
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

// 디바운스 함수 (연속 호출 방지)
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
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

// 모든 필터 적용 (성능 최적화)
function applyFilters() {
    // 재생 중인 모든 비디오 정지
    stopAllVideos();
    
    // 애니메이션 타이머 초기화
    if (videoPreloadTimeout) {
        clearTimeout(videoPreloadTimeout);
    }
    
    // 필터링 실행
    const searchText = document.getElementById('search').value.toLowerCase();
    
    const newFilteredData = effectsData.filter(effect => {
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
    
    // 필터링 결과 저장 
    filteredData = newFilteredData;
    
    // 최적화된 카드 전환 처리
    const cards = document.querySelectorAll('.card');
    
    // 카드를 모두 페이드 아웃 (성능을 위해 opacity 변경만 사용)
    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.pointerEvents = 'none'; // 클릭 비활성화
    });
    
    // 약간의 지연 후 새 카드 렌더링
    setTimeout(() => {
        renderInitialCards();
        updateStats();
    }, 200);
}

// 모든 재생 중인 비디오 정지
function stopAllVideos() {
    currentlyPlayingVideos.forEach(videoEl => {
        if (!videoEl.paused) {
            videoEl.pause();
            videoEl.currentTime = 0;
        }
    });
    currentlyPlayingVideos.clear();
}

// 비디오 지연 로드 (성능 최적화)
function lazyLoadVideo(video, src) {
    if (!video.getAttribute('src') && src) {
        video.setAttribute('src', src);
    }
}

// 개별 카드 생성 (성능 최적화)
function createCard(effect) {
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
                <div class="card-colors">
                    ${colorsHTML.join('')}
                </div>
                <div class="card-title">${effect.name}</div>
            </div>
        `;
    } else {
        // 비디오 태그에는 처음에 src를 설정하지 않고 placeholder 표시
        card.innerHTML = `
            <div class="card-video-container">
                <video class="card-video" muted playsinline preload="none"></video>
            </div>
            <div class="card-info">
                <div class="card-colors">
                    ${colorsHTML.join('')}
                </div>
                <div class="card-title">${effect.name}</div>
            </div>
        `;
        
        // 비디오 요소 참조
        const video = card.querySelector('.card-video');
        const videoContainer = card.querySelector('.card-video-container');
        
        // 마우스 호버 이벤트 - 최적화된 비디오 처리
        videoContainer.addEventListener('mouseenter', () => {
            // 다른 비디오 재생 중이면 중지
            stopAllVideos();
            
            // 필요한 경우 비디오 소스 로드
            lazyLoadVideo(video, effect.videoLink);
            
            // 타임아웃 설정: 사용자가 실수로 호버하는 경우 즉시 로드되지 않도록
            videoPreloadTimeout = setTimeout(() => {
                video.currentTime = 0;
                video.play().catch(e => console.log('비디오 재생 실패:', e));
                currentlyPlayingVideos.add(video);
            }, 100);
        });
        
        // 마우스 나가기 이벤트
        videoContainer.addEventListener('mouseleave', () => {
            // 타임아웃 취소
            if (videoPreloadTimeout) {
                clearTimeout(videoPreloadTimeout);
            }
            
            if (video.src) { // src가 설정된 경우에만 처리
                video.pause();
                video.currentTime = 0;
                currentlyPlayingVideos.delete(video);
            }
        });
        
        // 모바일용 터치 이벤트
        let touchTimer;
        videoContainer.addEventListener('touchstart', () => {
            touchTimer = setTimeout(() => {
                // 다른 비디오 재생 중이면 중지
                stopAllVideos();
                
                // 필요한 경우 비디오 소스 로드
                lazyLoadVideo(video, effect.videoLink);
                
                // 현재 비디오 재생
                video.currentTime = 0;
                video.play().catch(e => console.log('비디오 재생 실패:', e));
                currentlyPlayingVideos.add(video);
            }, 200); // 짧은 터치와 구분하기 위한 딜레이
        });
        
        videoContainer.addEventListener('touchend', () => {
            clearTimeout(touchTimer);
            if (video.src) {
                video.pause();
                video.currentTime = 0;
                currentlyPlayingVideos.delete(video);
            }
        });
    }
    
    // 카드 클릭 이벤트
    card.addEventListener('click', () => openModal(effect));
    
    return card;
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
            <div class="color-dot" style="background-color: ${getColorCode(effect.color1)}" title="${effect.color1}"></div>
        `;
    }
    
    if (effect.color2) {
        modalColors.innerHTML += `
            <div class="color-dot" style="background-color: ${getColorCode(effect.color2)}" title="${effect.color2}"></div>
        `;
    }
    
    if (effect.color3) {
        modalColors.innerHTML += `
            <div class="color-dot" style="background-color: ${getColorCode(effect.color3)}" title="${effect.color3}"></div>
        `;
    }
    
    // 속성 정보 (세트, 무한지속)
    modalAttributes.innerHTML = '';
    
    // 세트 정보
    if (effect.set && effect.set.trim() !== '') {
        modalAttributes.innerHTML += `
            <div class="attribute-tag set-tag">
                ${effect.set}
            </div>
        `;
    }
    
    // 무한지속 여부 (true인 경우만 표시)
    if (effect.loop) {
        modalAttributes.innerHTML += `
            <div class="attribute-tag loop-tag">
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
