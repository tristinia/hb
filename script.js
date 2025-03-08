/**
 * 마비노기 정령 형상변환 리큐르 & 부가 효과 뷰어
 * 작성자: WF신의컨트롤
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
        title: '정령 형상변환 리큐르',
        dataPath: 'data/web/spiritLiqueur.json',
        imagePath: 'image/spiritLiqueur'   // 이미지 경로 추가
    },
    'effectCard': {
        buttonText: '이펙트 변경 카드',
        title: '이펙트 변경 카드',
        dataPath: 'data/web/effectCard.json',
        imagePath: 'image/effectCard'      // 이미지 경로 추가
    },
    'titleEffect': {
        buttonText: '2차 타이틀',
        title: '2차 타이틀 이펙트',
        dataPath: 'data/web/titleEffect.json',
        imagePath: 'image/titleEffect'     // 이미지 경로 추가
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
    
    // 무한 지속 필터 초기화
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

// 다음 배치 카드 렌더링 - 개선된 방식
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
        
        // 카드 생성
        const card = createCard(effect);
        
        // 애니메이션 클래스 추가
        card.classList.add('new-card');
        
        fragment.appendChild(card);
    }
    
    container.appendChild(fragment);
    currentOffset += itemsToRender;
    
    // DOM에 카드가 추가된 후 visible 클래스 추가 (애니메이션용)
    requestAnimationFrame(() => {
        setTimeout(() => {
            const newCards = container.querySelectorAll('.card:not(.visible)');
            newCards.forEach(card => {
                card.classList.add('visible');
            });
            isLoading = false;
        }, 20);
    });
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
    }, 200); // 200ms 디바운스
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
    
    // 무한 지속 필터 이벤트
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

// 모달 열기 함수
function openModal(effect) {
    const modal = document.getElementById('modal');
    const modalContent = modal.querySelector('.modal-content');
    const modalMediaContainer = document.getElementById('modalMediaContainer');
    const modalTitle = document.getElementById('modalTitle');
    const modalColors = document.getElementById('modalColors');
    const modalAttributes = document.getElementById('modalAttributes');
    const modalReleaseInfo = document.getElementById('modalReleaseInfo');
    
    // 모달 콘텐츠를 먼저 숨기고 표시
    modalContent.style.opacity = '0';
    modalContent.style.transform = 'translateY(30px)';
    
    // 모달 표시 (배경만 먼저)
    modal.style.display = 'block';
    
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
            // 모달에서는 항상 원본 고화질 비디오 사용
            modalMediaContainer.innerHTML = `
                <video class="modal-video" src="${effect.videoLink}" controls autoplay loop></video>
            `;
            
            // 로딩 상태 표시
            const modalVideo = modalMediaContainer.querySelector('.modal-video');
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'modal-loading';
            loadingIndicator.innerHTML = '<div class="spinner"></div>';
            modalMediaContainer.appendChild(loadingIndicator);
            
            // 비디오 로드 완료 시
            modalVideo.addEventListener('loadeddata', () => {
                modalMediaContainer.querySelector('.modal-loading')?.remove();
            });
            
            // 비디오 로드 에러 시
            modalVideo.addEventListener('error', () => {
                modalMediaContainer.querySelector('.modal-loading')?.remove();
                modalMediaContainer.innerHTML = `
                    <div class="no-media">비디오 로드 실패</div>
                `;
            });
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
    
    // 속성 정보 (세트, 무한 지속)
    modalAttributes.innerHTML = '';
    
    // 세트 정보
    if (effect.set && effect.set.trim() !== '') {
        modalAttributes.innerHTML += `
            <div class="attribute-tag set-tag">
                ${effect.set}
            </div>
        `;
    }
    
    // 무한 지속 여부 (true인 경우만 표시)
    if (effect.loop) {
        modalAttributes.innerHTML += `
            <div class="attribute-tag loop-tag">
                무한 지속
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
    
    // 배경을 서서히 표시 (1프레임 지연)
    requestAnimationFrame(() => {
        modal.classList.add('open');
        
        // 콘텐츠를 서서히 표시 (배경 페이드인 후)
        setTimeout(() => {
            modalContent.style.transition = 'transform 0.4s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.4s cubic-bezier(0.19, 1, 0.22, 1)';
            modalContent.style.opacity = '1';
            modalContent.style.transform = 'translateY(0)';
        }, 100);
    });
}

// 모달 닫기 함수
function closeModal() {
    const modal = document.getElementById('modal');
    const modalContent = modal.querySelector('.modal-content');
    const modalVideo = document.querySelector('.modal-video');
    
    // 비디오 정지
    if (modalVideo) {
        modalVideo.pause();
    }
    
    // 콘텐츠 먼저 페이드 아웃
    modalContent.style.opacity = '0';
    modalContent.style.transform = 'translateY(30px)';
    
    // 콘텐츠가 사라진 후 배경 페이드 아웃
    setTimeout(() => {
        modal.classList.remove('open');
        
        // 배경이 사라진 후 모달 숨기기
        setTimeout(() => {
            modal.style.display = 'none';
            
            // 모달 콘텐츠 초기화 (다음 열기를 위해)
            modalContent.style.transition = 'none';
        }, 400);
    }, 200);
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

// 모든 필터 적용 - 깜빡임 방지 최적화
function applyFilters() {
    // 재생 중인 모든 비디오 정지
    stopAllVideos();
    
    // 필터링 실행
    const searchText = document.getElementById('search').value.toLowerCase();
    
    const newFilteredData = effectsData.filter(effect => {
        // 검색어 필터
        const nameMatch = effect.name && effect.name.toLowerCase().includes(searchText);
        
        // 색상 필터 (선택된 색상 중 하나라도 포함하는 경우 통과) - OR 로직
        let colorMatch = true;
        if (activeColorFilters.length > 0) {
            colorMatch = activeColorFilters.some(color => {
                return effect.color1 === color || 
                    effect.color2 === color || 
                    effect.color3 === color;
            });
        }
        
        // 세트 필터
        const setMatch = !selectedSet || effect.set === selectedSet;
        
        // 무한 지속 필터
        const loopMatch = !loopFilterActive || effect.loop === true;
        
        return nameMatch && colorMatch && setMatch && loopMatch;
    });
    
    // 필터링 결과 저장 
    filteredData = newFilteredData;
    
    // 컨테이너 페이드 아웃
    const container = document.getElementById('card-container');
    container.style.transition = 'opacity 0.2s ease';
    container.style.opacity = '0';
    
    // 페이드 아웃 완료 후 내용 비우기
    setTimeout(() => {
        // 트랜지션 제거 후 내용 변경
        container.style.transition = 'none';
        container.innerHTML = '';
        
        // 다음 프레임에서 오프셋 초기화 및 렌더링 
        requestAnimationFrame(() => {
            currentOffset = 0;
            renderNextBatch();
            
            // 통계 업데이트
            updateStats();
            
            // 트랜지션 복원 및 페이드인
            requestAnimationFrame(() => {
                container.style.transition = 'opacity 0.3s ease';
                container.style.opacity = '1';
            });
        });
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

// 개별 카드 생성 - webp 이미지 사용하도록 수정
function createCard(effect) {
    const card = document.createElement('div');
    card.className = 'card';
    
    // 색상 표시를 위한 HTML 생성
    const colorsHTML = [];
    if (effect.color1) colorsHTML.push(`<div class="color-dot" style="background-color: ${getColorCode(effect.color1)}" title="${effect.color1}"></div>`);
    if (effect.color2) colorsHTML.push(`<div class="color-dot" style="background-color: ${getColorCode(effect.color2)}" title="${effect.color2}"></div>`);
    if (effect.color3) colorsHTML.push(`<div class="color-dot" style="background-color: ${getColorCode(effect.color3)}" title="${effect.color3}"></div>`);
    
    // 이미지 경로 생성 (webp 이미지 사용)
    const imagePath = `${pageConfig[currentPage].imagePath}/${effect.name}.webp`;
    
    // 카드 HTML 생성 (기본적으로 '이미지 없음' 표시)
    card.innerHTML = `
        <div class="card-video-container">
            <div class="no-video">이미지 없음</div>
        </div>
        <div class="card-info">
            <div class="card-colors">
                ${colorsHTML.join('')}
            </div>
            <div class="card-title">${effect.name}</div>
        </div>
    `;
    
    // 이미지 로드 테스트
    const img = new Image();
    img.onload = () => {
        // 이미지 로드 성공하면 이미지로 교체
        const videoContainer = card.querySelector('.card-video-container');
        if (videoContainer) {
            videoContainer.innerHTML = `<img class="card-image" src="${imagePath}" alt="${effect.name}">`;
        }
    };
    img.onerror = () => {
        // 이미지 로드 실패하면 다시 확인 (비디오 URL이 이미지인 경우 시도)
        if (effect.videoLink && effect.videoLink.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            const videoContainer = card.querySelector('.card-video-container');
            if (videoContainer) {
                videoContainer.innerHTML = `<img class="card-image" src="${effect.videoLink}" alt="${effect.name}">`;
            }
        }
        // 이미지도 실패하면 "이미지 없음" 유지 (이미 설정됨)
    };
    
    // 이미지 로드 시작
    img.src = imagePath;
    
    // 카드 클릭 이벤트 (모달 열기)
    card.addEventListener('click', () => openModal(effect));
    
    return card;
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
