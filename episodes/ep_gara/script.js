// 台詞データ
const dialogues = [
    { speaker: 'shi', text: 'はい', background: 'images/mdgc_nomi.jpg' },
    { speaker: 'desu', text: 'どうも', background: 'images/mdgc_kane.jpg' },
    { speaker: 'desu', text: 'ホーレムもらえますか', background: 'images/mdgc_nomi.jpg' },
    { speaker: 'shi', text: 'ホーレム？ ああ、ガラね' },
    { speaker: 'shi', text: 'はい', background: 'images/mdgc_holem.jpg' },
    { speaker: 'desu', text: 'どうも' },
    { speaker: 'sakana', text: 'おつかれさん', background: 'images/kkj.jpg' },
    { speaker: 'desu', text: 'うん キミも' },
    { speaker: 'sakana', text: '俺はなにもしてない' },
    { speaker: 'desu', text: 'まあね' },
    { speaker: 'sakana', text: '…' },
    { speaker: 'desu', text: 'なに？' },
    { speaker: 'sakana', text: 'いや別に。そういや、それいつももらってるけど、もらってどうするの' },
    { speaker: 'desu', text: 'どうもしない' },
    { speaker: 'sakana', text: 'ん？ じゃあなんでもらってるの' },
    { speaker: 'desu', text: '…かわいいから' },
    { speaker: 'sakana', text: 'かわいいか？' },
    { speaker: 'desu', text: 'うん' },
    { speaker: 'sakana', text: 'そうか' }
];

// DOM要素
const titleScreen = document.getElementById('titleScreen');
const fadeOverlay = document.getElementById('fadeOverlay');
const backgroundImage = document.getElementById('backgroundImage');
const faceIcon = document.getElementById('faceIcon');
const nameDisplay = document.getElementById('nameDisplay');
const textContent = document.getElementById('textContent');
const continueIcon = document.getElementById('continueIcon');
const choiceScreen = document.getElementById('choiceScreen');
const replayButton = document.getElementById('replayButton');
const backButton = document.getElementById('backButton');

// 状態管理
let currentDialogueIndex = 0;
let isTyping = false;
let typingTimeout = null;
let canProceed = false;
let gameStarted = false;
let previousSpeaker = null;
let currentBackground = null;
let isChangingBackground = false;

// 初期背景
const initialBackground = 'images/kkj.jpg';

// 名前の表示名
const speakerNames = {
    sakana: 'サカナ',
    desu: 'デス',
    shi: '？'
};

// 顔アイコンのパス
const faceIcons = {
    sakana: 'images/sakana.jpg',
    desu: 'images/desu.jpg',
    shi: 'images/shi_icon.jpg'
};

// AudioContextを1つだけ作成（再利用）
let audioContext = null;

// テキスト表示音を再生
function playTextSound(speaker) {
    try {
        // 初回のみAudioContextを作成
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // キャラクターごとに周波数を変える
        const frequencies = {
            sakana: 300,
            desu: 700,
            shi: 200
        };
        oscillator.frequency.value = frequencies[speaker] || 600;

        gainNode.gain.value = 0.1; // 音量

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.03); // 0.03秒
    } catch (e) {
        // Audio APIが使えない場合は無視
        console.warn('Web Audio API not supported');
    }
}

// 初期化
function init() {
    // クリックイベント
    document.body.addEventListener('click', handleClick);

    // 選択ボタンのイベントリスナー
    replayButton.addEventListener('click', (e) => {
        e.stopPropagation();
        handleReplay();
    });

    backButton.addEventListener('click', (e) => {
        e.stopPropagation();
        handleBack();
    });
}

// クリックハンドラー
function handleClick() {
    if (!gameStarted) {
        // タイトル画面を非表示にしてゲーム開始
        startGame();
    } else if (isChangingBackground) {
        // 背景切り替え中はクリックを無視
        return;
    } else if (isTyping) {
        // テキスト表示中の場合は即座に全文表示
        skipTyping();
    } else if (canProceed) {
        // 次の台詞へ進む
        proceedToNext();
    }
}

// ゲーム開始
function startGame() {
    gameStarted = true;

    // 初期背景を設定（nullの場合はスキップ）
    if (initialBackground) {
        backgroundImage.src = initialBackground;
        currentBackground = initialBackground;
    }

    // タイトル画面をフェードアウト
    titleScreen.classList.add('hidden');

    // 1秒後にフェードアウトして最初の台詞を表示
    setTimeout(() => {
        fadeOverlay.classList.add('fade-out');

        // フェードアウト完了後に最初の台詞を表示
        setTimeout(() => {
            showDialogue(0);
        }, 2000);
    }, 1000);
}

// 台詞を表示
function showDialogue(index) {
    if (index >= dialogues.length) {
        // 最後まで到達したらフェードアウトして最初に戻る
        endStory();
        return;
    }

    const dialogue = dialogues[index];
    currentDialogueIndex = index;
    canProceed = false;
    continueIcon.classList.remove('show');

    // 背景画像の切り替えが必要か確認
    if (dialogue.background && dialogue.background !== currentBackground) {
        // 背景切り替え処理
        changeBackground(dialogue.background, () => {
            // 背景切り替え後に台詞を表示
            displayDialogue(dialogue);
        });
    } else {
        // 背景切り替えが不要な場合は直接台詞を表示
        // 話者が切り替わった場合は少し間を置く
        const speakerChanged = previousSpeaker !== null && previousSpeaker !== dialogue.speaker;
        const delay = speakerChanged ? 500 : 0;

        setTimeout(() => {
            displayDialogue(dialogue);
        }, delay);
    }
}

// 背景画像を切り替え
function changeBackground(newBackground, callback) {
    isChangingBackground = true;

    // フェードイン（黒画面にする）
    fadeOverlay.classList.remove('fade-out');
    fadeOverlay.classList.add('fade-in');

    // フェードイン完了後に画像を切り替え
    setTimeout(() => {
        backgroundImage.src = newBackground;
        currentBackground = newBackground;

        // フェードアウト（画像を表示）
        fadeOverlay.classList.remove('fade-in');
        fadeOverlay.classList.add('fade-out');

        // フェードアウト完了後にコールバックを実行
        setTimeout(() => {
            isChangingBackground = false;
            if (callback) callback();
        }, 2000);
    }, 2000);
}

// 台詞を表示（実際の表示処理）
function displayDialogue(dialogue) {
    // 顔アイコン切り替え
    faceIcon.src = faceIcons[dialogue.speaker];
    faceIcon.alt = speakerNames[dialogue.speaker];

    // 名前表示
    nameDisplay.textContent = speakerNames[dialogue.speaker];
    nameDisplay.className = `name-display ${dialogue.speaker}`;

    // テキストをクリア
    textContent.textContent = '';

    // 話者を記録
    previousSpeaker = dialogue.speaker;

    // テキストを一文字ずつ表示
    typeText(dialogue.text, dialogue.speaker);
}

// テキストを一文字ずつ表示
function typeText(text, speaker) {
    isTyping = true;
    let charIndex = 0;

    // 「…」のみの場合は待機時間を長めに
    const isEllipsis = text === '…';
    const typingSpeed = 50; // 通常の文字表示速度（ミリ秒）
    const lineBreakDelay = 400; // 改行時の遅延（ミリ秒）

    function typeNextChar() {
        if (charIndex < text.length) {
            const currentChar = text[charIndex];

            // 改行文字の場合
            if (currentChar === '\n') {
                textContent.innerHTML += '<br>';
                charIndex++;
                // 改行時は少し長めに待つ
                typingTimeout = setTimeout(typeNextChar, lineBreakDelay);
            } else {
                // 通常の文字
                const tempDiv = document.createElement('div');
                tempDiv.textContent = currentChar;
                textContent.innerHTML += tempDiv.innerHTML;

                // 1文字に1回音を鳴らす
                if (charIndex % 1 === 0) {
                    playTextSound(speaker);
                }

                charIndex++;
                typingTimeout = setTimeout(typeNextChar, typingSpeed);
            }
        } else {
            // 表示完了
            isTyping = false;

            // 「…」の場合は少し長く待ってから進行可能にする
            const delayBeforeContinue = isEllipsis ? 800 : 300;

            setTimeout(() => {
                canProceed = true;
                continueIcon.classList.add('show');
            }, delayBeforeContinue);
        }
    }

    typeNextChar();
}

// テキスト表示をスキップ
function skipTyping() {
    if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
    }

    isTyping = false;

    // 現在の台詞の全文を表示（改行対応）
    const dialogue = dialogues[currentDialogueIndex];
    textContent.innerHTML = dialogue.text.replace(/\n/g, '<br>');

    // 進行可能にする
    canProceed = true;
    continueIcon.classList.add('show');
}

// 次の台詞へ進む
function proceedToNext() {
    currentDialogueIndex++;
    showDialogue(currentDialogueIndex);
}

// ストーリー終了
function endStory() {
    // フェードインで黒画面にする
    fadeOverlay.classList.remove('fade-out');
    fadeOverlay.classList.add('fade-in');

    // テキストウィンドウを非表示
    continueIcon.classList.remove('show');

    // 2秒後に選択画面を表示
    setTimeout(() => {
        choiceScreen.classList.add('show');
        fadeOverlay.classList.remove('fade-in');
        fadeOverlay.classList.add('fade-out');
    }, 2000);
}

// もう一度見る
function handleReplay() {
    // 選択画面を非表示
    choiceScreen.classList.remove('show');

    // フェードインで黒画面にする
    fadeOverlay.classList.remove('fade-out');
    fadeOverlay.classList.add('fade-in');

    // ゲーム状態をリセット
    setTimeout(() => {
        currentDialogueIndex = 0;
        previousSpeaker = null;
        currentBackground = null;
        isChangingBackground = false;
        gameStarted = false;

        // テキストと表示をクリア
        textContent.innerHTML = '';
        nameDisplay.textContent = '';
        continueIcon.classList.remove('show');

        // タイトル画面を再表示
        titleScreen.classList.remove('hidden');

        // フェードアウト
        fadeOverlay.classList.remove('fade-in');
        fadeOverlay.classList.add('fade-out');
    }, 1000);
}

// 戻る
function handleBack() {
    // index.html に遷移
    window.location.href = '../index.html';
}

// ページ読み込み時に初期化
window.addEventListener('load', init);
