// spirits.js
async function loadSpirits() {
    try {
        const response = await fetch('data/spiritList.json');
        const spirits = await response.json();
        const container = document.getElementById('spiritContainer');

        spirits.forEach(spirit => {
            // 컨테이너 div 생성
            const spiritElement = document.createElement('div');
            spiritElement.className = 'spirit-item';
            
            // 썸네일 이미지 생성
            const thumbnail = document.createElement('img');
            thumbnail.src = spirit.videoLink.replace('.mp4', '.jpg') || 'default-thumbnail.jpg';
            thumbnail.className = 'spirit-thumbnail';
            thumbnail.onerror = () => {
                thumbnail.src = 'default-thumbnail.jpg';
            };
            
            // 클릭 이벤트 추가
            thumbnail.onclick = () => openVideoModal(spirit.videoLink);

            // 제목 생성
            const title = document.createElement('h3');
            title.textContent = spirit.name;

            // 요소들 조립
            spiritElement.appendChild(thumbnail);
            spiritElement.appendChild(title);
            container.appendChild(spiritElement);
        });
    } catch (error) {
        console.error('정신 목록을 불러오는 중 오류 발생:', error);
    }
}

function openVideoModal(videoLink) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    const videoElement = document.createElement('video');
    videoElement.src = videoLink;
    videoElement.controls = true;
    videoElement.style.width = '100%';
    
    modalContent.appendChild(videoElement);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // 모달 클릭 시 닫기
    modal.onclick = (event) => {
        if (event.target === modal) {
            document.body.removeChild(modal);
        }
    };
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', loadSpirits);
