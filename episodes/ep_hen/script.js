// 要素の取得
const titleScreen = document.getElementById('titleScreen');
const page1 = document.getElementById('page1');
const page2 = document.getElementById('page2');
const choiceScreen = document.getElementById('choiceScreen');
const replayButton = document.getElementById('replayButton');
const backButton = document.getElementById('backButton');

// 現在のページ状態
let currentPage = 'title'; // 'title', 'page1', 'page2', 'choice'

// タイトル画面をクリックしたら page1 を表示
titleScreen.addEventListener('click', () => {
    if (currentPage === 'title') {
        titleScreen.classList.add('hidden');
        setTimeout(() => {
            page1.classList.add('show');
            currentPage = 'page1';
        }, 1000);
    }
});

// page1 をクリックしたら page2 を表示
page1.addEventListener('click', () => {
    if (currentPage === 'page1') {
        page1.classList.remove('show');
        setTimeout(() => {
            page2.classList.add('show');
            currentPage = 'page2';
        }, 500);
    }
});

// page2 をクリックしたら選択画面を表示
page2.addEventListener('click', () => {
    if (currentPage === 'page2') {
        page2.classList.remove('show');
        setTimeout(() => {
            choiceScreen.classList.add('show');
            currentPage = 'choice';
        }, 500);
    }
});

// ↻ボタン: タイトル画面に戻る
replayButton.addEventListener('click', (e) => {
    e.stopPropagation();
    choiceScreen.classList.remove('show');
    setTimeout(() => {
        titleScreen.classList.remove('hidden');
        currentPage = 'title';
    }, 1000);
});

// ×ボタン: episodes ページに戻る
backButton.addEventListener('click', (e) => {
    e.stopPropagation();
    window.location.href = '../';
});
