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
                       loop 
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

            // 자동 재생 설정
            const video = document.getElementById(`video-${index}`);
            video.addEventListener('loadedmetadata', () => {
                video.currentTime = 0;
                video.play();
            });
        });
    });

function showDetailModal(item) {
    const modal = document.getElementById('detail-modal');
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn">&times;</span>
            <video src="${item.videoLink}" controls width="100%"></video>
            <h2>${item.name}</h2>
            <p>색상1: ${item.color1}</p>
            <p>색상2: ${item.color2 || '없음'}</p>
            <p>색상3: ${item.color3 || '없음'}</p>
            <p>세트: ${item.set || '없음'}</p>
            <p>출시 날짜: ${item.releaseDate}</p>
            <p>출시 키트: ${item.releaseKit}</p>
        </div>
    `;

    modal.style.display = 'block';

    // 모달 닫기 버튼
    const closeBtn = modal.querySelector('.close-btn');
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };
}
