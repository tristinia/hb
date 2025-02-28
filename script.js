async function loadSpirits() {
    const response = await fetch('data/spiritList.json');
    const spirits = await response.json();
    const container = document.getElementById('spiritContainer');

    spirits.forEach(spirit => {
        const spiritElement = document.createElement('div');
        spiritElement.className = 'spirit-item';
        
        // 썸네일 이미지 (YouTube 등에서 추출)
        const thumbnail = document.createElement('img');
        thumbnail.src = `https://img.youtube.com/vi/${extractVideoId(spirit.videoLink)}/mqdefault.jpg`;
        thumbnail.className = 'spirit-thumbnail';
        
        // 클릭 시 원본 비디오 모달
        thumbnail.onclick = () => openVideoModal(spirit.videoLink);

        // 제목
        const title = document.createElement('h3');
        title.textContent = spirit.name;

        spiritElement.appendChild(thumbnail);
        spiritElement.appendChild(title);
        container.appendChild(spiritElement);
    });
}

function extractVideoId(videoLink) {
    // YouTube 링크에서 비디오 ID 추출
    const match = videoLink.match(/[?&]v=([^&]+)/);
    return match ? match[1] : '';
}

function openVideoModal(videoLink) {
    // 비디오 모달 구현
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; justify-content:center; align-items:center;">
            <iframe width="800" height="450" src="${videoLink}" frameborder="0" allowfullscreen></iframe>
            <button onclick="this.parentElement.remove()">닫기</button>
        </div>
    `;
    document.body.appendChild(modal);
}

loadSpirits();
