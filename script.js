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
                       playsinline 
                       width="200" 
                       height="150">
                </video>
                <div class="item-name">${item.name}</div>
            `;

            // 클릭 이벤트 핸들러
            listItem.addEventListener('click', () => {
                showDetailModal(item);
            });

            // 비디오 이벤트 디버깅용 리스너 추가
            const video = listItem.querySelector('video');
            
            video.addEventListener('error', (e) => {
                console.error('비디오 로딩 에러:', e);
            });

            video.addEventListener('loadedmetadata', () => {
                console.log(`비디오 ${index} 메타데이터 로드 완료`);
                video.currentTime = 0;
            });

            // 호버 시 재생/정지 로직
            listItem.addEventListener('mouseenter', () => {
                video.play().catch(err => {
                    console.error('재생 실패:', err);
                });
            });

            listItem.addEventListener('mouseleave', () => {
                video.pause();
                video.currentTime = 0;
            });

            container.appendChild(listItem);
        });
    })
    .catch(error => {
        console.error('데이터 로딩 중 오류:', error);
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
