// 台詞データ
const dialogues = [
    { speaker: 'sakana', text: 'このまま少し行けば現場だ' },
    { speaker: 'desu', text: 'うん' },
    { speaker: 'sakana', text: '今度はグロいやつじゃないといいな' },
    { speaker: 'desu', text: 'うん' },
    { speaker: 'sakana', text: '…' },
    { speaker: 'desu', text: '…' },
    { speaker: 'sakana', text: '…ところで\nそれ、下なにか履いてる？' },
    { speaker: 'desu', text: '…いや' },
    { speaker: 'sakana', text: 'そうか…' },
    { speaker: 'desu', text: 'なんで？' },
    { speaker: 'sakana', text: 'いや…\n風邪ひくなよ' },
    { speaker: 'desu', text: '大丈夫\nありがと' },
    { speaker: 'sakana', text: 'ん…\nあ、ここだ' }
];

// DOM要素
const titleScreen = document.getElementById('titleScreen');
const fadeOverlay = document.getElementById('fadeOverlay');
const faceIcon = document.getElementById('faceIcon');
const nameDisplay = document.getElementById('nameDisplay');
const textContent = document.getElementById('textContent');
const continueIcon = document.getElementById('continueIcon');

// 状態管理
let currentDialogueIndex = 0;
let isTyping = false;
let typingTimeout = null;
let canProceed = false;
let gameStarted = false;
let previousSpeaker = null;

// 名前の表示名
const speakerNames = {
    sakana: 'サカナ',
    desu: 'デス'
};

// 顔アイコンのパス
const faceIcons = {
    sakana: 'images/sakana.jpg',
    desu: 'images/desu.jpg'
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
        // サカナ：低めの音（600Hz）、デス：高めの音（1000Hz）
        const frequency = speaker === 'sakana' ? 300 : 700;
        oscillator.frequency.value = frequency;

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
}

// クリックハンドラー
function handleClick() {
    if (!gameStarted) {
        // タイトル画面を非表示にしてゲーム開始
        startGame();
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

    // 話者が切り替わった場合は少し間を置く
    const speakerChanged = previousSpeaker !== null && previousSpeaker !== dialogue.speaker;
    const delay = speakerChanged ? 500 : 0;

    setTimeout(() => {
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
    }, delay);
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

    // 2秒後にタイトル画面に戻る
    setTimeout(() => {
        currentDialogueIndex = 0;
        previousSpeaker = null;
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
    }, 2000);
}

// ページ読み込み時に初期化
window.addEventListener('load', init);
