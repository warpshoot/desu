// 定数・DOM要素
const INITIAL_BACKGROUND = 'images/kkj.jpg';
const SHI_ICON = 'images/shi_icon.jpg';

const fadeOverlay = document.getElementById('fadeOverlay');
const backgroundImage = document.getElementById('backgroundImage');
const textWindow = document.getElementById('textWindow');
const faceIcon = document.getElementById('faceIcon');
const nameDisplay = document.getElementById('nameDisplay');
const textContent = document.getElementById('textContent');
const continueIcon = document.getElementById('continueIcon');
const menuScreen = document.getElementById('menuScreen');
const startPrompt = document.getElementById('startPrompt');
const closeMenuButton = document.getElementById('closeMenuButton');

const episodesLink = document.getElementById('episodesLink');
const episodesScreen = document.getElementById('episodesScreen');
const closeEpisodesButton = document.getElementById('closeEpisodesButton');

const charactersLink = document.getElementById('charactersLink');
const charactersScreen = document.getElementById('charactersScreen');
const closeCharactersButton = document.getElementById('closeCharactersButton');

const toolsLink = document.getElementById('toolsLink');
const toolsScreen = document.getElementById('toolsScreen');
const closeToolsButton = document.getElementById('closeToolsButton');

// 名簿の切り替え用
const characterIcons = document.querySelectorAll('.character-icon');
const characterCards = document.querySelectorAll('.character-card');

// セリフバリエーション
const dialogues = [
    '…なにか用か',
    '……',
    '…なんだ',
    '…お前か'
];

const partingDialogues = [
    '……',
    '…またな',
    '…おつかれさん'
];

// 状態管理
// 0: 初期(背景のみ・プロンプト待ち)
// 1: 挨拶テキスト表示中
// 2: 挨拶テキスト完了(待機中)
// 3: メニュー表示
// 4: ツール画面表示
// 5: 記録画面表示
// 6: 名簿画面表示
// 7: 別れテキスト表示中
// 8: 別れテキスト完了(待機中)
// 9: ツール説明テキスト表示中
// 10: ツール説明テキスト完了(待機中)
let currentState = 0;
let isTyping = false;
let typingTimeout = null;

let audioContext = null;

// テキスト表示音（ep_garaから流用）
function playTextSound() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // 「？」の音（shi）
        oscillator.frequency.value = 200;
        gainNode.gain.value = 0.1;

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.03);
    } catch (e) {
        console.warn('Web Audio API not supported');
    }
}

// 初期化
function init() {
    // 初期背景設定
    backgroundImage.src = INITIAL_BACKGROUND;

    // 1秒後に黒フェードアウトして背景を見せる
    setTimeout(() => {
        fadeOverlay.classList.add('fade-out');
        textWindow.classList.add('empty'); // 最初は完全透明

        // 少し遅れて「＞ 声をかける」を表示
        setTimeout(() => {
            startPrompt.classList.add('show');
        }, 1000);
    }, 500);

    // クリックイベント
    document.body.addEventListener('click', handleClick);

    // メニュー閉じるイベント
    closeMenuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        startPartingDialogue();
    });

    // ツール画面のイベント
    toolsLink.addEventListener('click', (e) => {
        e.stopPropagation();
        showSubScreen(toolsScreen, 4);
    });
    closeToolsButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentState === 4 || currentState === 9 || currentState === 10) {
            if (currentState === 9 || currentState === 10) {
                if (typingTimeout) {
                    clearTimeout(typingTimeout);
                    typingTimeout = null;
                }
                textWindow.classList.remove('active');
                textWindow.classList.remove('overlay-mode');
                setTimeout(() => {
                    textWindow.classList.add('empty');
                }, 500);
            }
            currentState = 4;
            hideSubScreen(toolsScreen, 4);
        }
    });

    // ツール説明のイベント
    const toolInfoBtns = document.querySelectorAll('.tool-info-btn');
    toolInfoBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentState !== 4 && currentState !== 9 && currentState !== 10) return;

            if (typingTimeout) {
                clearTimeout(typingTimeout);
                typingTimeout = null;
            }

            const toolName = btn.dataset.tool;
            startToolInfoDialogue(`${toolName}だ。`);
        });
    });

    // 記録画面のイベント
    episodesLink.addEventListener('click', (e) => {
        e.stopPropagation();
        showSubScreen(episodesScreen, 5);
    });
    closeEpisodesButton.addEventListener('click', (e) => {
        e.stopPropagation();
        hideSubScreen(episodesScreen, 5);
    });

    // 名簿画面のイベント
    charactersLink.addEventListener('click', (e) => {
        e.stopPropagation();
        showSubScreen(charactersScreen, 6);
    });
    closeCharactersButton.addEventListener('click', (e) => {
        e.stopPropagation();
        hideSubScreen(charactersScreen, 6);
    });

    // 名簿のキャラクター切り替え
    characterIcons.forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation(); // 誤爆防止
            const character = icon.dataset.character;

            // Update icon active state
            characterIcons.forEach(i => i.classList.remove('active'));
            icon.classList.add('active');

            // Show selected character card
            characterCards.forEach(card => {
                if (card.dataset.character === character) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
}

// クリックハンドラー
function handleClick(e) {
    // メニューのリンクをクリックした場合は何もしない（デフォルト動作に任せる）
    if (e.target.tagName.toLowerCase() === 'a') {
        return;
    }

    if (currentState === 0) {
        // スタートプロンプト非表示
        startPrompt.classList.remove('show');
        currentState = 1;
        // ランダムなセリフを選択
        const randomText = dialogues[Math.floor(Math.random() * dialogues.length)];
        // テキスト表示開始
        startDialogue(randomText, 1);
    } else if ((currentState === 1 || currentState === 7 || currentState === 9) && isTyping) {
        // タイピング即時完了
        skipTyping();
    } else if (currentState === 2) {
        // メニュー画面へ
        continueIcon.classList.remove('show');
        showMenu();
    } else if (currentState === 8) {
        // 初期状態へ戻る
        continueIcon.classList.remove('show');
        resetToInitialState();
    } else if (currentState === 10) {
        // ツール説明完了後、テキストウィンドウだけを閉じる
        continueIcon.classList.remove('show');
        textWindow.classList.remove('active');
        setTimeout(() => {
            textWindow.classList.add('empty');
            textWindow.classList.remove('overlay-mode');
            currentState = 4; // ツール画面の待機状態へ戻る
        }, 500);
    }
}

function startDialogue(text, targetState = 1) {
    currentState = targetState;

    // AudioContextを初期化（ユーザー操作起点）
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    textWindow.classList.remove('empty');
    textWindow.classList.add('active');

    faceIcon.src = SHI_ICON;
    faceIcon.alt = '？';

    nameDisplay.textContent = '？';
    nameDisplay.className = 'name-display shi';

    textContent.textContent = '';
    continueIcon.classList.remove('show');

    // 現在のテキストを保存してタイプ開始
    textContent.dataset.currentText = text;
    typeText(text);
}

function typeText(text) {
    isTyping = true;
    let charIndex = 0;
    const typingSpeed = 50;

    function typeNextChar() {
        if (charIndex < text.length) {
            const currentChar = text[charIndex];

            const tempDiv = document.createElement('div');
            tempDiv.textContent = currentChar;
            textContent.innerHTML += tempDiv.innerHTML;

            playTextSound();

            charIndex++;
            typingTimeout = setTimeout(typeNextChar, typingSpeed);
        } else {
            // 表示完了
            isTyping = false;
            if (currentState === 1) currentState = 2;
            else if (currentState === 7) currentState = 8;
            else if (currentState === 9) currentState = 10;

            // 「…」の場合は少し長く待ってから進行可能にする
            setTimeout(() => {
                continueIcon.classList.add('show');
            }, 800);
        }
    }

    typeNextChar();
}

function skipTyping() {
    if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
    }

    isTyping = false;
    if (currentState === 1) currentState = 2;
    else if (currentState === 7) currentState = 8;
    else if (currentState === 9) currentState = 10;

    textContent.textContent = textContent.dataset.currentText || '…';
    continueIcon.classList.add('show');
}

function showMenu() {
    currentState = 3;

    // テキストウィンドウを非表示
    textWindow.classList.remove('active');
    continueIcon.classList.remove('show');

    // 背景を暗くしてメニューを表示
    setTimeout(() => {
        menuScreen.classList.add('show');
    }, 500); // ウィンドウが消えるのを少し待つ
}

function startPartingDialogue() {
    if (currentState !== 3) return;

    // メニューを隠す
    menuScreen.classList.remove('show');

    setTimeout(() => {
        currentState = 7;
        const randomText = partingDialogues[Math.floor(Math.random() * partingDialogues.length)];
        startDialogue(randomText, 7);
    }, 600);
}

function startToolInfoDialogue(text) {
    // ツール説明ダイアログは背面にメニューを表示したまま上にオーバーレイする
    currentState = 9;

    // サブスクリーンよりも前面に出すためのクラスを追加
    textWindow.classList.add('overlay-mode');

    // 以下startDialogueとほぼ同じ処理だが、音声コンテキスト確認などを使い回す
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    textWindow.classList.remove('empty');
    textWindow.classList.add('active');

    faceIcon.src = SHI_ICON;
    faceIcon.alt = '？';
    nameDisplay.textContent = '？';
    nameDisplay.className = 'name-display shi';

    textContent.textContent = '';
    continueIcon.classList.remove('show');

    textContent.dataset.currentText = text;
    typeText(text);
}

function resetToInitialState() {
    // 全てを非表示にしてリセット
    textWindow.classList.remove('active');

    setTimeout(() => {
        textWindow.classList.add('empty'); // 中身を消す
        currentState = 0;

        // プロンプトを再表示
        setTimeout(() => {
            startPrompt.classList.add('show');
        }, 1000);
    }, 500);
}

function showSubScreen(screenElement, targetState) {
    if (currentState !== 3) return;
    currentState = targetState;

    menuScreen.classList.add('sub-active');
    screenElement.classList.add('show');
}

function hideSubScreen(screenElement, currentStateValue) {
    if (currentState !== currentStateValue) return;
    currentState = 3;

    screenElement.classList.remove('show');
    menuScreen.classList.remove('sub-active');
}

window.addEventListener('load', init);
