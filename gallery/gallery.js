// ギャラリー画像リスト（後で画像を追加したらここに追記）
const images = [
    // 例：
    // { src: 'images/001.jpg', alt: 'DESU Illustration 1' },
    // { src: 'images/002.jpg', alt: 'DESU Illustration 2' },
];

// DOM要素
const galleryGrid = document.getElementById('galleryGrid');
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxClose = document.getElementById('lightboxClose');

// ギャラリーを初期化
function initGallery() {
    if (images.length === 0) {
        // 画像がない場合はプレースホルダーを表示（既にHTMLに含まれている）
        return;
    }

    // プレースホルダーを削除
    galleryGrid.innerHTML = '';

    // 画像を表示
    images.forEach((image, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = `<img src="${image.src}" alt="${image.alt}">`;
        item.addEventListener('click', () => openLightbox(image.src));
        galleryGrid.appendChild(item);
    });
}

// ライトボックスを開く
function openLightbox(src) {
    lightboxImage.src = src;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// ライトボックスを閉じる
function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
}

// イベントリスナー
lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
        closeLightbox();
    }
});

// ESCキーで閉じる
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
        closeLightbox();
    }
});

// ページ読み込み時に初期化
window.addEventListener('load', initGallery);
