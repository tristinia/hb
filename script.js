/**
 * 마비노기 정령 형상변환 리큐르 & 부가 효과 뷰어
 * 작성자: WF신의컨트롤
 * 최종 수정: 2025-03-05
 */

// 데이터 및 상태 변수
let effectsData = []; // 현재 표시 중인 데이터
let filteredData = []; // 필터링된 데이터
let currentlyPlayingVideos = new Set(); // 현재 재생 중인 비디오 추적
let isLoading = false; // 로딩 상태
let currentOffset = 0; // 무한 스크롤 오프셋
const ITEMS_PER_PAGE = 20; // 한 번에 로드할 항목 수
let latestUpdateDate = ''; // 최신 업데이트 날짜
let currentPage = 'liqueur'; // 현재 페이지 (기본값: liqueur)

// 이미 로드된 비디오 URL을 저장하는 Set (캐싱)
const loadedVideos = new Set();

// 순차적 비디오 로딩을 위한 변수
let videoLoadQueue = [];
let isLoadingVideo = false;
let maxConcurrentLoads = 3; // 최대 동시 로드 수
let activeLoads = 0; // 현재 로드 중인 수

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

// 페이지 데이터 매핑 - 버튼 텍스트와 페이지 제목 분리
const pageConfig = {
    'liqueur': {
        buttonText: '정령 형변',
        title: '마비노기 정령 형상변환 리큐르',
        dataPath: 'data/spiritLiqueur.json'
    },
    'effectCard': {
        buttonText: '이펙트 변경 카드',
        title: '마비노기 이펙트 변경 카드',
        dataPath: 'data/effectCard.json'
    },
    'titleEffect': {
        buttonText: '2차 타이틀',
        title: '마비노기 2차 타이틀 이펙트',
        dataPath: 'data/titleEffect.json'
    }
};

// 페이지 초기화 및 데이터 로드
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupSticky();
    
    // 초기 페이지 제목 설정
    document.querySelector('h1').textContent = pageConfig[currentPage].title;
    document.querySelector('.sticky-title').textContent = pageConfig[currentPage].title;
    
    loadData(currentPage);
    setupEventListeners();
});

// 페이지 내비게이션 설정
function setupNavigation() {
    const navContainer = document.createElement('div');
    navContainer.className = 'nav-container';
    
    const navButtons = document.createElement('div');
    navButtons.className = 'nav-buttons';
    
    // 내비게이션 버튼 생성
    Object.keys(pageConfig).forEach(pageKey => {
        const button = document.createElement('button');
        button.className = 'nav-button';
        button.textContent = pageConfig[pageKey].buttonText; // buttonText 사용
        button.dataset.page = pageKey;
        
        // 현재 페이지면 활성화
        if (pageKey === currentPage) {
            button.classList.add('active');
        }
        
        // 클릭 이벤트
        button.addEventListener('click', () => {
            if (pageKey !== currentPage) {
                document.querySelectorAll('.nav-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');
                
                // 페이지 변경
                currentPage = pageKey;
                
                // 모든 필터 초기화
                resetFilters();
                
                // 새 데이터 로드
                loadData(currentPage);
                
                // 페이지 타이틀 업데이트 - 여기에서 title 속성 사용
                document.querySelector('h1').textContent = pageConfig[pageKey].title;
                document.querySelector('.sticky-title').textContent = pageConfig[pageKey].title;
            }
        });
        
        navButtons.appendChild(button);
    });
    
    navContainer.appendChild(navButtons);
    
    // 헤더 앞에 삽입
    const header = document.querySelector('header');
    document.body.insertBefore(navContainer, header);
}

// 필터 초기화
function resetFilters() {
    // 색상 필터 초기화
    colors.forEach(color => {
        color.isActive = false;
    });
    activeColorFilters = [];
    updateColorFilterUI();
    
    // 무한지속 필터 초기화
    loopFilterActive = false;
    const loopFilter = document.getElementById('loopFilter');
    if (loopFilter) {
        loopFilter.classList.remove('active');
    }
    
    // 세트 필터 초기화
    selectedSet = '';
    const setFilter = document.getElementById('setFilter');
    if (setFilter) {
        setFilter.value = '';
        setFilter.classList.remove('selected');
    }
    
    // 검색어 초기화
    const searchInput = document.getElementById('search');
    if (searchInput) {
        searchInput.value = '';
    }
}

// 스크롤 시 헤더 고정
function setupSticky() {
    // 스티키 헤더 생성
    const stickyHeader = document.createElement('div');
    stickyHeader.className = 'sticky-header';
    stickyHeader.innerHTML = `
        <div class="sticky-title">${pageConfig[currentPage].title}</div>
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

// 푸터 추가 (데이터 로드 후 최신 날짜 포함)
function addFooter() {
    // 기존 푸터 제거
    const existingFooter = document.querySelector('.footer');
    if (existingFooter) {
        existingFooter.remove();
    }
    
    const footer = document.createElement('div');
    footer.className = 'footer';
    footer.innerHTML = `
        <div class="author">WF신의컨트롤</div>
        <div class="update-date">${latestUpdateDate} 업데이트</div>
    `;
    document.body.appendChild(footer);
}

// JSON 파일 로드
async function loadData(page) {
    try {
        showLoading(true);
        
        // 재생 중인 비디오 모두 정지
        stopAllVideos();
        
        // 카드 컨테이너 비우기
        const container = document.getElementById('card-container');
        container.innerHTML = '';
        
        // 세트 필터 비우기
        const setFilter = document.getElementById('setFilter');
        if (setFilter) {
            setFilter.innerHTML = '<option value="">모든 세트</option>';
        }
        
        // 데이터 로드
        const dataPath = pageConfig[page].dataPath;
        const response = await fetch(dataPath);
        effectsData = await response.json();
        
        // 최신 날짜 찾기
        findLatestUpdateDate();
        
        // 날짜순으로 정렬 (최신 항목이 맨 위로)
        effectsData.sort((a, b) => {
            if (!a.releaseDate) return 1;
            if (!b.releaseDate) return -1;
            return b.releaseDate.localeCompare(a.releaseDate);
        });
        
        filteredData = [...effectsData];
        
        // 색상 필터 버튼 생성 (처음 한 번만)
        const colorFiltersContainer = document.getElementById('colorFilters');
        if (colorFiltersContainer && colorFiltersContainer.children.length === 0) {
            createColorFilters();
        }
        
        // 세트 필터 옵션 생성
        populateSetOptions();
        
        // 첫 페이지 카드 렌더링
        currentOffset = 0;
        renderNextBatch();
        
        // 통계 업데이트
        updateStats();
        
        // 최신 날짜가 있는 푸터 추가
        addFooter();
        
        showLoading(false);
        
        // 비디오 로딩 큐 초기화
        videoLoadQueue = [];
        isLoadingVideo = false;
        activeLoads = 0;
        
        // 첫 페이지 비디오 자동 로드 시작 (약간 지연)
        setTimeout(() => {
            autoLoadAllVideos();
        }, 500);
        
    } catch (error) {
        console.error('데이터 로드 중 오류 발생:', error);
        showLoading(false);
        
        // 오류 메시지 표시
        const container = document.getElementById('card-container');
        container.innerHTML = `<div class="error-message">데이터를 불러오는 데 실패했습니다.</div>`;
        
        // 오류가 발생해도 푸터는 추가
        addFooter();
    }
}

// 최신 업데이트 날짜 찾기
function findLatestUpdateDate() {
    let latestDate = '';
    
    effectsData.forEach(effect => {
        if (effect.releaseDate && effect.releaseDate > latestDate) {
            latestDate = effect.releaseDate;
        }
    });
    
    // 날짜 포맷 변경
    if (latestDate) {
        latestUpdateDate = formatDate(latestDate);
    } else {
        latestUpdateDate = '날짜 정보 없음';
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

// 다음 배치 카드 렌더링
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
    
    // 문서 프래그먼트를 사용해 DOM 조작 최소화
    const fragment = document.createDocumentFragment();
    
    // 카드 생성
    for (let i = 0; i < itemsToRender; i++) {
        const effect = filteredData[currentOffset + i];
        const isImage = effect.videoLink && effect.videoLink.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        
        // 모든 카드 생성 (비디오/이미지)
        const card = createCard(effect, isImage);
        
        // 애니메이션 클래스 추가 (단순화된 방식)
        if (i % 2 === 0) {
            card.classList.add('new-card-left');
        } else {
            card.classList.add('new-card-right');
        }
        
        fragment.appendChild(card);
    }
    
    container.appendChild(fragment);
    currentOffset += itemsToRender;
    isLoading = false;
    
    // 새로 추가된 비디오들을 로딩 큐에 추가
    autoLoadAllVideos();
}

// 스크롤 리스너 설정
function setupScrollListener() {
    // 기존 스크롤 이벤트 제거
    window.removeEventListener('scroll', scrollHandler);
    
    // 새 스크롤 이벤트 추가
    window.addEventListener('scroll', scrollHandler);
}

// 디바운스 적용한 스크롤 핸들러
let scrollTimeout;
function scrollHandler() {
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
    const searchInput = document.getElementById('search');
    searchInput.placeholder = "검색"; // 검색 텍스트로 변경
    
    searchInput.addEventListener('input', debounce(() => {
        applyFilters();
    }, 300));
    
    // 무한지속 필터 이벤트
    document.getElementById('loopFilter').addEventListener('click', () => {
        loopFilterActive = !loopFilterActive;
        document.getElementById('loopFilter').classList.toggle('active', loopFilterActive);
        applyFilters();
    });
    
    // 세트 필터 이벤트
    const setFilter = document.getElementById('setFilter');
    setFilter.addEventListener('change', (e) => {
        selectedSet = e.target.value;
        
        // 선택된 경우 클래스 추가
        if (selectedSet) {
            setFilter.classList.add('selected');
        } else {
            setFilter.classList.remove('selected');
        }
        
        applyFilters();
    });
    
    // iOS 모달창 외부 터치 문제 해결을 위한 이벤트 처리
    const modal = document.getElementById('modal');
    
    // 클릭 이벤트 (PC)
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
    
    // 터치 이벤트 (iOS 전용)
    modal.addEventListener('touchend', (event) => {
        // 모달 외부 터치인지 확인 (모달 컨텐츠가 포함되어 있지 않은지)
        if (!event.target.closest('.modal-content') && event.target === modal) {
            closeModal();
            // 이벤트 전파 중지
            event.preventDefault();
            event.stopPropagation();
        }
    }, { passive: false });
    
    // 키보드 ESC 키 이벤트 (모달 닫기)
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            closeModal();
        }
    });
    
    // 스크롤 이벤트 설정
    setupScrollListener();
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
    if (colorFilters.length > 0) {
        colors.forEach((color, index) => {
            colorFilters[index].classList.toggle('active', color.isActive);
        });
    }
}

// 모든 필터 적용
function applyFilters() {
    // 재생 중인 모든 비디오 정지
    stopAllVideos();
    
    // 필터링 실행
    const searchText = document.getElementById('search').value.toLowerCase();
    
    const newFilteredData = effectsData.filter(effect => {
        // 검색어 필터
        const nameMatch = effect.name && effect.name.toLowerCase().includes(searchText);
        
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
    
    // 카드를 모두 페이드 아웃
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.pointerEvents = 'none'; // 클릭 비활성화
    });
    
    // 약간의 지연 후 새 카드 렌더링
    setTimeout(() => {
        // 카드 컨테이너 비우기
        const container = document.getElementById('card-container');
        container.innerHTML = '';
        
        // 오프셋 초기화 및 새 배치 렌더링
        currentOffset = 0;
        renderNextBatch();
        
        // 통계 업데이트
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

// 자동으로 모든 비디오 로드
function autoLoadAllVideos() {
    console.log('비디오 자동 로드 시작');
    
    const allVideoContainers = document.querySelectorAll('.card-video-container');
    const allVideos = document.querySelectorAll('.card-video');
    
    // 모든 비디오 컨테이너 확인
    allVideoContainers.forEach((container, index) => {
        const video = allVideos[index];
        
        // 이미 로드된 비디오는 건너뛰기
        if (video.src) return;
        
        // 비디오 URL 가져오기
        const title = container.nextElementSibling.querySelector('.card-title').textContent;
        const effect = filteredData.find(e => e.name === title);
        
        if (effect && effect.videoLink) {
            // 이미 캐시된 URL인지 확인
            if (loadedVideos.has(effect.videoLink)) {
                // 이미 로드된 비디오는 로딩 표시 없이 바로 src 설정
                video.src = effect.videoLink;
                container.classList.remove('loading');
            } else {
                // 아직 로드되지 않은 비디오만 큐에 추가
                const alreadyInQueue = videoLoadQueue.some(item => 
                    item.src === effect.videoLink);
                
                if (!alreadyInQueue) {
                    container.classList.add('loading');
                    videoLoadQueue.push({
                        container: container,
                        video: video,
                        src: effect.videoLink
                    });
                }
            }
        }
    });
    
    // 로딩 큐에 항목이 있고 현재 로딩 중이 아니면 로딩 시작
    if (videoLoadQueue.length > 0 && !isLoadingVideo) {
        loadVideosInParallel();
    }
}

// 병렬로 비디오 로드
function loadVideosInParallel() {
    if (videoLoadQueue.length === 0) {
        isLoadingVideo = false;
        activeLoads = 0;
        return;
    }
    
    isLoadingVideo = true;
    
    // 현재 동시 로드 수가 최대치 미만인 경우에만 새 로드 시작
    while (videoLoadQueue.length > 0 && activeLoads < maxConcurrentLoads) {
        activeLoads++;
        const videoInfo = videoLoadQueue.shift();
        loadSingleVideo(videoInfo);
    }
}

// 단일 비디오 로드
function loadSingleVideo(videoInfo) {
    // 이미 로드된 비디오인지 확인 (캐시)
    if (loadedVideos.has(videoInfo.src)) {
        videoInfo.video.src = videoInfo.src;
        videoInfo.container.classList.remove('loading');
        finishVideoLoading();
        return;
    }
    
    // 비디오 로드 시작
    videoInfo.video.src = videoInfo.src;
    videoInfo.video.preload = "metadata"; // 메타데이터만 먼저 로드
    
    // 로드 완료 이벤트
    videoInfo.video.addEventListener('loadeddata', function onLoad() {
        // 로딩 표시 제거
        videoInfo.container.classList.remove('loading');
        
        // 이벤트 리스너 제거
        videoInfo.video.removeEventListener('loadeddata', onLoad);
        
        // 캐시에 추가
        loadedVideos.add(videoInfo.src);
        
        // 로드 완료 처리
        finishVideoLoading();
    });
    
    // 로드 오류 처리
    videoInfo.video.addEventListener('error', function onError(e) {
        console.error('비디오 로드 실패:', videoInfo.src, e);
        
        // 로딩 표시 제거
        videoInfo.container.classList.remove('loading');
        
        // 이벤트 리스너 제거
        videoInfo.video.removeEventListener('error', onError);
        
        // 로드 완료 처리
        finishVideoLoading();
    });
    
    // 타임아웃 설정 (6초 후에도 로드가 안 되면 다음으로 진행)
    const timeoutId = setTimeout(() => {
        if (videoInfo.container.classList.contains('loading')) {
            console.warn('비디오 로드 타임아웃:', videoInfo.src);
            
            // 로딩 표시 제거
            videoInfo.container.classList.remove('loading');
            
            // 로드 완료 처리
            finishVideoLoading();
        }
    }, 6000); // 6초 타임아웃
    
    // 비디오 로드 완료 처리
    function finishVideoLoading() {
        clearTimeout(timeoutId);
        activeLoads--;
        
        // 다음 비디오 로드
        if (activeLoads < maxConcurrentLoads && videoLoadQueue.length > 0) {
            const nextVideoInfo = videoLoadQueue.shift();
            loadSingleVideo(nextVideoInfo);
        } else if (activeLoads === 0) {
            isLoadingVideo = false;
            
            // 만약 큐가 남아있다면 다시 시작
            if (videoLoadQueue.length > 0) {
                loadVideosInParallel();
            }
        }
    }
}

// 개별 카드 생성
function createCard(effect, isImage) {
    const card = document.createElement('div');
    card.className = 'card';
    
    // 색상 표시를 위한 HTML 생성
    const colorsHTML = [];
    if (effect.color1) colorsHTML.push(`<div class="color-dot" style="background-color: ${getColorCode(effect.color1)}" title="${effect.color1}"></div>`);
    if (effect.color2) colorsHTML.push(`<div class="color-dot" style="background-color: ${getColorCode(effect.color2)}" title="${effect.color2}"></div>`);
    if (effect.color3) colorsHTML.push(`<div class="color-dot" style="background-color: ${getColorCode(effect.color3)}" title="${effect.color3}"></div>`);
    
    if (isImage) {
        // 이미지는 바로 로드
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
    } else if (effect.videoLink) {
        // 비디오는 로딩 큐에 추가하기 위해 src 없이 생성
        card.innerHTML = `
            <div class="card-video-container loading">
                <video class="card-video" muted playsinline preload="metadata"></video>
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
        
        // 호버링 이벤트
        videoContainer.addEventListener('mouseenter', () => {
            // 다른 비디오 재생 중이면 중지
            stopAllVideos();
            
            // 비디오가 로드된 경우에만 재생
            if (video.src) {
                video.currentTime = 0;
                video.play().catch(e => console.log('비디오 재생 실패:', e));
                currentlyPlayingVideos.add(video);
            }
        });
        
        // 마우스 나가기 이벤트
        videoContainer.addEventListener('mouseleave', () => {
            if (!video.paused) {
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
                
                // 비디오가 로드된 경우에만 재생
                if (video.src) {
                    video.currentTime = 0;
                    video.play().catch(e => console.log('비디오 재생 실패:', e));
                    currentlyPlayingVideos.add(video);
                }
            }, 200); // 짧은 터치와 구분하기 위한 딜레이
        });
        
        videoContainer.addEventListener('touchend', () => {
            clearTimeout(touchTimer);
            if (!video.paused) {
                video.pause();
                video.currentTime = 0;
                currentlyPlayingVideos.delete(video);
            }
        });
    } else {
        // 비디오 링크가 없는 경우 대체 표시
        card.innerHTML = `
            <div class="card-video-container">
                <div class="no-video">미리보기 없음</div>
            </div>
            <div class="card-info">
                <div class="card-colors">
                    ${colorsHTML.join('')}
                </div>
                <div class="card-title">${effect.name}</div>
            </div>
        `;
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
    
    // 비디오 링크가 있는지 확인
    if (effect.videoLink) {
        // 비디오 링크가 이미지인지 확인
        const isImage = effect.videoLink.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        
        // 미디어 요소 추가 (비디오 또는 이미지)
        if (isImage) {
            modalMediaContainer.innerHTML = `
                <img class="modal-image" src="${effect.videoLink}" alt="${effect.name}">
            `;
        } else {
            // 모든 비디오는 무한 반복 활성화
            modalMediaContainer.innerHTML = `
                <video class="modal-video" src="${effect.videoLink}" controls autoplay loop></video>
            `;
        }
    } else {
        // 비디오 링크가 없는 경우 대체 표시
        modalMediaContainer.innerHTML = `
            <div class="no-media">미리보기 없음</div>
        `;
    }
    
    // 제목 설정
    modalTitle.textContent = effect.name || '제목 없음';
    
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
