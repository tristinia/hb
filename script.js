fetch('data/spiritList.json')
    .then(response => response.json())
    .then(data => {
        const container = document.getElementById('video-container');
        
        data.forEach((item, index) => {
            // 리스트 아이템 생성
            const listItem = document.createElement('div');
            listItem.className = 'video-item';
            listItem.innerHTML = `
                <video id="video-${index}" 
                       src="${item.videoLink}" 
                       muted 
                       width="200" 
                       height="150">
                </video>
                <div class="item-name">${item.name}</div>
            `;

            // 클릭 시 상세 정보 모달 
            listItem.addEventListener('click', () => {
                showDetailModal(item);
            });

            container.appendChild(listItem);

            // 비디오 재생 제어
            const video = document.getElementById(`video-${index}`);
            
            // 메타데이터 로드 시 초기화
            video.addEventListener('loadedmetadata', () => {
                video.currentTime = 0;
            });

            // 재생 시간 제한
            video.addEventListener('play', () => {
                const maxPlayTime = Math.min(5000, video.duration * 1000);
                const playTimeout = setTimeout(() => {
                    video.pause();
                    video.currentTime = 0;
                }, maxPlayTime);

                // 수동 정지 시 타임아웃 제거
                video.addEventListener('pause', () => {
                    clearTimeout(playTimeout);
                });
            });
        });
    });

function showDetailModal(item) {
    const modal = document.getElementById('detail-modal');
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn">&times;</span>
            <video 
                src="${item.videoLink}" 
                autoplay 
                muted 
                loop 
                playsinline 
                disablePictureInPicture 
                controlslist="nodownload noplaybackrate noremoteplayback" 
                width="100%">
            </video>
            <h2>${item.name}</h2>
            <p>색상1: ${item.color1}</p>
            <p>색상2: ${item.color2 || '없음'}</p>
            <p>색상3: ${item.color3 || '없음'}</p>
            <p>세트: ${item.set || '없음'}</p>
            <p>출시 날짜: ${item.releaseDate}</p>
            <p>출시 키트: ${item.releaseKit}</p>
        </div>
    `;

    // 모달 표시
    modal.style.display = 'block';

    // 모달 닫기 버튼 이벤트
    const closeBtn = modal.querySelector('.close-btn');
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // 모달 외부 클릭 시 닫기
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
}
