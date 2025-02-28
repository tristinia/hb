const spirits = [
    {
        name: "블랙 라벨",
        imageUrl: "path/to/black_label.jpg",
        description: "클래식한 위스키"
    },
    {
        name: "화이트 호스",
        imageUrl: "path/to/white_horse.jpg", 
        description: "부드러운 풍미"
    },
    // 다른 spirits 추가
];

function rotateThumbnails(spirits) {
    let currentIndex = 0;
    const thumbnailElement = document.getElementById('thumbnail');

    setInterval(() => {
        const spirit = spirits[currentIndex];
        thumbnailElement.src = spirit.imageUrl;
        thumbnailElement.alt = spirit.name;
        
        currentIndex = (currentIndex + 1) % spirits.length;
    }, 7000);  // 7초마다 변경
}

document.addEventListener('DOMContentLoaded', () => {
    rotateThumbnails(spirits);
});
