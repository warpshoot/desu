// テキストデータ
const paragraphs = [
    "雨が降っている。",
    "デスはフードの端から滴る水滴を気にする様子もなく、自販機の前に立っていた。百円玉を入れて、ボタンを押す。がこん、と缶が落ちる音だけが通りに響く。",
    "「今日はブラックなんだ」\nサカナが横で浮いたまま言った。",
    "「うん」",
    "デスは缶を拾い上げて、そのまま自販機の横にしゃがみ込んだ。屋根のない場所だったが、構わなかった。プルタブを起こすと、コーヒーの匂いが湿った空気に混ざる。",
    "「終わった？」\nサカナが訊く。さっきの仕事のことだ。",
    "「うん。終わった」",
    "「どんなの」",
    "「おじいさん」",
    "「ふうん」",
    "サカナはそれ以上訊かなかった。デスも言わなかった。いつもそうだ。回収の中身について、ふたりとも深く触れない。触れないことが、ふたりの間ではとっくに決まりごとになっている。",
    "雨が少し強くなった。自販機の明かりが濡れたアスファルトに四角く映っている。",
    "「あのさ」\nデスが缶を両手で包みながら言った。",
    "「なに」",
    "「おじいさんの部屋、すごい静かだった」",
    "「……」",
    "「テレビもついてなくて、時計もなくて。なんの音もしなかった」",
    "サカナはしばらく黙っていた。デスはコーヒーを一口飲んだ。",
    "「でも」\nデスが続けた。",
    "「窓のとこに、風鈴があった」",
    "「風鈴」",
    "「うん。鳴ってなかったけど」",
    "「しまい忘れたのかな」",
    "「わかんない」",
    "デスはまた一口飲んで、空を見上げた。フードの隙間から覗く空は、一面灰色だった。",
    "「たぶん」\nデスが言った。",
    "「鳴ってほしかったんだと思う」",
    "サカナは黙った。デスも黙った。",
    "雨粒が自販機の天板を叩く音が、しばらくふたりの間を埋めた。",
    "「……帰る？」\nサカナが言った。",
    "「もうちょっと」",
    "デスは缶をまた口に運んだ。ぬるくなったコーヒーが喉を通る。",
    "自販機の光。雨の匂い。どこかでカラスが一声鳴いて、すぐ黙った。",
    "デスはまだ動かなかった。"
];

// 状態管理
let currentIndex = 0;
let gameStarted = false;
let isAnimating = false;

// Audio
let audioContext = null;
let rainNode = null;
let masterGain = null;
const DESU_SETTINGS_KEY = 'desuSettings';
let isMuted = false;

// DOM要素
const titleScreen = document.getElementById('titleScreen');
const fadeOverlay = document.getElementById('fadeOverlay');
const textWindow = document.getElementById('textWindow');
const textContent = document.getElementById('textContent');
const continueIcon = document.getElementById('continueIcon');
const replayScreen = document.getElementById('replayScreen');
const replayButton = document.getElementById('replayButton');
const closeBtnTop = document.getElementById('closeBtnTop');
const globalMuteBtn = document.getElementById('globalMuteBtn');
const muteIcon = globalMuteBtn.querySelector('.mute-icon');
const unmuteIcon = globalMuteBtn.querySelector('.unmute-icon');

function init() {
    loadSettings();
    updateMuteUI();

    // 画面全体へのクリック判定
    document.body.addEventListener('click', handleClick);

    // ミュートボタン
    globalMuteBtn.addEventListener('click', toggleMute);

    // もう一度見るボタン
    replayButton.addEventListener('click', (e) => {
        e.stopPropagation();
        handleReplay();
    });

    // 閉じるボタン
    closeBtnTop.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = '../index.html';
    });
}

function handleClick() {
    if (isAnimating) return; // アニメーション中はクリック無効

    // Resume audio context if it's suspended (browser policy)
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }

    if (!gameStarted) {
        initAudio(); // 最初のクリックでAudio起動
        startGame();
    } else {
        proceedToNext();
    }
}

function initAudio() {
    if (audioContext) return;

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioContext.createGain();
        masterGain.connect(audioContext.destination);
        masterGain.gain.value = 0; // 最初は無音
    } catch (e) {
        console.warn('Web Audio API not supported');
    }
}

function loadSettings() {
    const saved = localStorage.getItem(DESU_SETTINGS_KEY);
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            isMuted = !!settings.isMuted;
        } catch (e) {
            console.error('Failed to parse settings:', e);
        }
    }
}

function saveSettings() {
    localStorage.setItem(DESU_SETTINGS_KEY, JSON.stringify({ isMuted }));
}

function toggleMute(e) {
    if (e) e.stopPropagation();
    isMuted = !isMuted;
    saveSettings();
    updateMuteUI();
    // ミュートにした場合は再生中の雨音を即停止
    if (isMuted && masterGain) {
        masterGain.gain.cancelScheduledValues(audioContext.currentTime);
        masterGain.gain.setValueAtTime(0, audioContext.currentTime);
    } else if (!isMuted && audioContext && gameStarted) {
        startRain(); // ミュート解除時は雨音を再開
    }
}

function updateMuteUI() {
    if (isMuted) {
        muteIcon.style.display = 'none';
        unmuteIcon.style.display = 'block';
    } else {
        muteIcon.style.display = 'block';
        unmuteIcon.style.display = 'none';
    }
}

function startRain() {
    if (!audioContext || isMuted) return;

    // Stop existing rain if any
    if (rainNode) {
        rainNode.stop();
        rainNode.disconnect();
    }

    const bufferSize = audioContext.sampleRate * 2; // 2 seconds of noise buffer
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = buffer.getChannelData(0);

    // Generate pink-ish noise for rain
    for (let i = 0; i < bufferSize; i++) {
        let white = Math.random() * 2 - 1;
        output[i] = (white + (output[i - 1] || 0)) / 2; // Simple lowpass filter
    }

    rainNode = audioContext.createBufferSource();
    rainNode.buffer = buffer;
    rainNode.loop = true;

    // Filter to make it sound more like gentle rain
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600; // 800 -> 600に下げて少しこもらせる

    const filter2 = audioContext.createBiquadFilter();
    filter2.type = 'highpass';
    filter2.frequency.value = 300; // 低音成分を削って軽い音に

    rainNode.connect(filter);
    filter.connect(filter2);
    filter2.connect(masterGain);

    rainNode.start();

    // Fade in
    masterGain.gain.cancelScheduledValues(audioContext.currentTime);
    masterGain.gain.setValueAtTime(0, audioContext.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 3); // 0.5 -> 0.08に大幅ダウン
}

function stopRain() {
    if (!audioContext || !masterGain) return;

    // Fade out
    masterGain.gain.cancelScheduledValues(audioContext.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, audioContext.currentTime);
    masterGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 2);

    setTimeout(() => {
        if (rainNode && masterGain.gain.value === 0) {
            rainNode.stop();
            rainNode.disconnect();
            rainNode = null;
        }
    }, 2000);
}

function startGame() {
    gameStarted = true;
    isAnimating = true;

    // タイトル画面フェードアウト
    titleScreen.classList.add('hidden');

    // 余韻を残して暗転を解く
    setTimeout(() => {
        fadeOverlay.classList.add('fade-out');
        startRain(); // 雨の音スタート

        // オーバーレイが消えた後、テキスト表示スタート
        setTimeout(() => {
            textWindow.classList.add('active');
            showParagraph(0);
        }, 2000);
    }, 1000); // 1秒保持してからフェードアウト開始
}

function showParagraph(index) {
    if (index >= paragraphs.length) {
        endStory();
        return;
    }

    isAnimating = true;

    // アイコン・テキストを非表示にする
    continueIcon.classList.remove('show');
    textContent.classList.remove('show');

    // テキストが消えるのを少し待ってから次を表示する（入れ替え効果）
    setTimeout(() => {
        // 次のテキストをセット
        textContent.innerHTML = paragraphs[index].replace(/\n/g, '<br>');

        // CSS Transitionによってフェードイン
        textContent.classList.add('show');

        // フェードインが終わる頃に進行許可
        setTimeout(() => {
            continueIcon.classList.add('show');
            isAnimating = false;
        }, 500); // Transition(0.5s)分+α

    }, currentIndex === index ? 0 : 300); // 初回（0文字目）は待たない
}

function proceedToNext() {
    currentIndex++;
    showParagraph(currentIndex);
}

function endStory() {
    isAnimating = true;

    // 暗転
    fadeOverlay.classList.remove('fade-out');
    fadeOverlay.classList.add('fade-in');

    stopRain(); // 雨の音フェードアウト

    // テキスト要素を隠す
    textWindow.classList.remove('active');
    continueIcon.classList.remove('show');

    // 暗転しきった後にエンド画面へ
    setTimeout(() => {
        replayScreen.classList.add('show');
        fadeOverlay.classList.remove('fade-in');
        fadeOverlay.classList.add('fade-out');
        isAnimating = false;
    }, 2000);
}

function handleReplay() {
    isAnimating = true;

    // リプレイ画面を消して暗転
    replayScreen.classList.remove('show');
    fadeOverlay.classList.remove('fade-out');
    fadeOverlay.classList.add('fade-in');

    // 初期状態に戻す
    setTimeout(() => {
        currentIndex = 0;
        gameStarted = false;

        textContent.innerHTML = '';
        textContent.classList.remove('show');

        titleScreen.classList.remove('hidden');
        fadeOverlay.classList.remove('fade-in');
        fadeOverlay.classList.add('fade-out');

        // Ensure audio is stopped before restarting
        if (audioContext && rainNode) {
            rainNode.stop();
            rainNode.disconnect();
            rainNode = null;
        }
        if (masterGain) {
            masterGain.gain.value = 0;
        }

        isAnimating = false;
    }, 1000); // 暗転の時間を考慮
}

window.addEventListener('load', init);
