// DESU™ emojie - 絵文字コラージュツール

// 絵文字データベース（カテゴリ別）
const emojiData = {
    smileys: [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇',
        '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝',
        '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄',
        '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧',
        '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁',
        '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭',
        '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈',
        '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸'
    ],
    animals: [
        '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷',
        '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥',
        '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞',
        '🐜', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑',
        '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆',
        '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄'
    ],
    food: [
        '🍎', '🍏', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭',
        '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕',
        '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳',
        '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓',
        '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲',
        '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢',
        '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿',
        '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🫖', '🍵', '🧃', '🥤', '🧋',
        '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊'
    ],
    symbols: [
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞',
        '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯',
        '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
        '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸',
        '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️',
        '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢',
        '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️',
        '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹',
        '❇️', '✳️', '❎', '🌐', '💠', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️',
        '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧️', '🚻', '🚮', '🎦', '📶', '🈁',
        '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣',
        '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️',
        '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽',
        '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️',
        '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '🟰',
        '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔝',
        '🔜', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤',
        '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️',
        '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉',
        '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏',
        '🎴', '🀄', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚',
        '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧',
        '⭐', '🌟', '✨', '💫', '⚡', '💥', '🔥', '🌈', '☀️', '⛅', '☁️', '🌤️', '⛈️',
        '🌦️', '🌧️', '⛆', '☔', '💧', '💦', '🌊', '🌙', '⭐'
    ]
};

// 絵文字キーワード辞書 (簡易版)
const emojiKeywords = {
    // Smileys & People
    '😀': '笑顔 smile happy', '😃': '笑顔 smile happy', '😄': '笑顔 smile happy',
    '😁': '笑顔 smile happy', '😆': '笑顔 smile happy', '😅': '汗 苦笑 sweat',
    '🤣': '爆笑 涙 lol', '😂': '泣き笑い 涙 lol', '😊': 'ニコニコ smile',
    '😇': '天使 angel', '🥰': 'ラブ love heart', '😍': '好き love heart',
    '🤩': 'スター 星 star wow', '😘': 'キス kiss', '😗': 'キス kiss',
    '😭': '泣く cry tear', '😢': '泣く cry', '😤': '怒る angry',
    '😡': '怒る angry', '🤬': '罵倒 angry', '💀': 'ドクロ 骸骨 skull',
    '💩': 'うんち poop', '🤡': 'ピエロ clown', '👻': 'お化け ghost',
    '👽': 'エイリアン alien', '👾': 'ゲーム game', '🤖': 'ロボット robot',
    '😺': '猫 cat', '😸': '猫 cat',

    // Animals
    '🐶': '犬 dog', '🐱': '猫 cat', '🐭': 'ネズミ mouse', '🐹': 'ハムスター',
    '🐰': 'うさぎ rabbit', '🦊': 'キツネ fox', '🐻': '熊 bear',
    '🐼': 'パンダ panda', '🐨': 'コアラ koala', '🐯': '虎 tiger',
    '🦁': 'ライオン lion', '🐮': '牛 cow', '🐷': '豚 pig',
    '🐸': 'カエル frog', '🐵': '猿 monkey', '🐔': '鶏 chicken',
    '🐧': 'ペンギン penguin', '🐦': '鳥 bird', '🦆': 'カモ duck',
    '🦅': '鷲 eagle', '🦉': 'フクロウ owl', '🐺': '狼 wolf',
    '🐗': '猪 boar', '🐴': '馬 horse', '🦄': 'ユニコーン unicorn',
    '🐝': '蜂 bee', '🐛': '毛虫 bug', '🦋': '蝶 butterfly',
    '🐢': '亀 turtle', '🐍': '蛇 snake', '🐙': 'タコ octopus',
    '🦑': 'イカ squid', '🦐': 'エビ shrimp', '🦀': 'カニ crab',
    '🐡': 'フグ blowfish', '🐠': '魚 fish', '🐟': '魚 fish',
    '🐬': 'イルカ dolphin', '🐳': 'クジラ whale', '🦈': 'サメ shark',

    // Food
    '🍎': 'リンゴ apple', '🍏': 'リンゴ apple', '🍊': 'みかん orange',
    '🍋': 'レモン lemon', '🍌': 'バナナ banana', '🍉': 'スイカ watermelon',
    '🍇': 'ぶどう grape', '🍓': 'イチゴ strawberry', '🍑': '桃 peach',
    '🍒': 'さくらんぼ cherry', '🍍': 'パイナップル pineapple', '🥝': 'キウイ kiwi',
    '🍅': 'トマト tomato', '🍆': 'ナス eggplant', '🌽': 'トウモロコシ corn',
    '🥕': '人参 carrot', '🍔': 'ハンバーガー burger', '🍟': 'ポテト fries',
    '🍕': 'ピザ pizza', '🌭': 'ホットドッグ hotdog', '🥪': 'サンドイッチ sandwich',
    '🌮': 'タコス taco', '🍣': '寿司 sushi', '🍙': 'おにぎり rice',
    '🍚': 'ご飯 rice', '🍛': 'カレー curry', '🍜': 'ラーメン ramen',
    '🍝': 'パスタ pasta', '🍞': 'パン bread', '🥐': 'クロワッサン',
    '🍰': 'ケーキ cake', '🎂': '誕生日 birthday', '🍦': 'アイス icecream',
    '🍩': 'ドーナツ donut', '🍪': 'クッキー cookie', '🍫': 'チョコ chocolate',
    '🍬': '飴 candy', '🍭': 'キャンディ candy', '☕': 'コーヒー coffee',
    '🍵': 'お茶 tea', '🍺': 'ビール beer', '🍷': 'ワイン wine',
    '🍹': 'カクテル cocktail',

    // Symbols
    '❤️': 'ハート heart love', '🧡': 'ハート heart', '💛': 'ハート heart',
    '💚': 'ハート heart', '💙': 'ハート heart', '💜': 'ハート heart',
    '💔': '失恋 heart break', '⭐': '星 star', '🌟': '星 starキラキラ',
    '✨': 'キラキラ sparkle', '⚡': '雷 thunder', '🔥': '炎 fire',
    '☀️': '太陽 sun', '☁️': '雲 cloud', '雨': '雨 rain', '☔': '傘 umbrella',
    '❄️': '雪 snow', '⛄': '雪だるま snowman', '🌸': '桜 flower',
    '🌹': 'バラ rose', '🌺': 'ハイビスカス flower', '🌻': 'ひまわり flower',
    '🎵': '音符 music', '🎶': '音符 music', '💯': '100点 score',
    '💢': '怒り angry', '💤': '睡眠 sleep', '💦': '汗 sweat water',
    '🎉': 'クラッカー party', '🎊': 'くす玉 party', '🎈': '風船 balloon'
};

// すべての絵文字リスト
const allEmojis = [
    ...emojiData.smileys,
    ...emojiData.animals,
    ...emojiData.food,
    ...emojiData.symbols
];

// アプリケーション状態
let state = {
    canvasEmojis: [], // [{id, emoji, x, y, size, rotation, zIndex}]
    selectedEmoji: null, // 編集中の絵文字
    editMode: 'new', // 'new' or 'edit'
    currentEmoji: '😀',
    currentSize: 60,
    currentRotation: 0,
    bgMode: 'transparent', // 'transparent' or 'white'
    recentEmojis: [],
    nextId: 1,
    saveScale: 1,
    selectionMode: false,
    selectionRect: null,
    toolMode: 'draw' // 'draw' or 'select'
};

// DOM要素
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvas-container');
const emojiList = document.getElementById('emoji-list');
const emojiSearch = document.getElementById('emoji-search');
const categoryTabs = document.querySelectorAll('.category-tab');
const editPanel = document.getElementById('edit-panel');
const emojiPreview = document.getElementById('emoji-preview');
const sizeSlider = document.getElementById('size-slider');
const sizeValue = document.getElementById('size-value');
const rotationSlider = document.getElementById('rotation-slider');
const rotationValue = document.getElementById('rotation-value');
const placeEmojiBtn = document.getElementById('place-emoji');
const deleteEmojiBtn = document.getElementById('delete-emoji');
const layerControls = document.getElementById('layer-controls');
const bringFrontBtn = document.getElementById('bring-front');
const bringForwardBtn = document.getElementById('bring-forward');
const sendBackwardBtn = document.getElementById('send-backward');
const sendBackBtn = document.getElementById('send-back');
const bgToggleBtn = document.getElementById('bgToggleBtn');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const creditBtn = document.getElementById('credit-btn');
const creditModal = document.getElementById('credit-modal');
const saveOverlay = document.getElementById('save-overlay');
const saveUI = document.getElementById('save-ui');
const saveAllBtn = document.getElementById('saveAllBtn');
const confirmSelectionBtn = document.getElementById('confirmSelectionBtn');
const redoSelectionBtn = document.getElementById('redoSelectionBtn');
const cancelSaveBtn = document.getElementById('cancelSaveBtn');
const transparentBgCheckbox = document.getElementById('transparentBg');
const selectionCanvas = document.getElementById('selection-canvas');
const selectionCtx = selectionCanvas.getContext('2d');
const recentEmojisSection = document.getElementById('recent-emojis-section');
const recentEmojisContainer = document.getElementById('recent-emojis');

// 初期化
function init() {
    // キャンバスサイズを設定
    canvas.width = 600;
    canvas.height = 600;

    // セレクションキャンバスのサイズを設定
    selectionCanvas.width = window.innerWidth;
    selectionCanvas.height = window.innerHeight;

    // 最近使った絵文字をロード
    loadRecentEmojis();

    // 初期絵文字リストを表示
    displayEmojis(emojiData.smileys);

    // イベントリスナーを設定
    setupEventListeners();

    // ツールモード初期化
    updateToolModeUI();

    // 背景モードを初期化
    updateBackground();

    // 初期描画
    redrawCanvas();

    // プレビューの初期化
    updateEditPanel();
}

// 絵文字リストを表示
function displayEmojis(emojis) {
    emojiList.innerHTML = '';
    emojis.forEach(emoji => {
        const item = document.createElement('div');
        item.className = 'emoji-item';
        item.textContent = emoji;
        item.addEventListener('click', () => selectEmojiForPlacement(emoji));
        emojiList.appendChild(item);
    });
}

// 絵文字を選択して配置モードに
function selectEmojiForPlacement(emoji) {
    state.currentEmoji = emoji;
    state.editMode = 'new';
    state.selectedEmoji = null;
    state.currentSize = 60;
    state.currentRotation = 0;

    // 編集パネルを表示
    showEditPanel();
    updateEditPanel();

    // 最近使った絵文字に追加
    addToRecentEmojis(emoji);
}

// 編集パネルの状態更新（表示/非表示の切り替えではなく、中身の切り替え）
function showEditPanel() {
    // パネル自体の表示・非表示は制御しない（常時表示のため）
    // placeEmojiBtn.textContent = '完了'; // 完了ボタンは削除（または非表示）
    placeEmojiBtn.style.display = 'none'; // 完了ボタン自体を隠す方針に変更

    // 削除ボタンとレイヤー操作は常に表示するが、編集モード以外は無効化（グレーアウト）
    // これによりUIの高さを固定し、ガタつきを防ぐ
    deleteEmojiBtn.style.display = 'block';
    layerControls.style.display = 'flex';

    if (state.editMode === 'edit') {
        deleteEmojiBtn.classList.remove('disabled');
        layerControls.classList.remove('disabled');
    } else {
        deleteEmojiBtn.classList.add('disabled');
        layerControls.classList.add('disabled');
    }

    // 編集モードならプレビュー等を更新
    updateEditPanel();
}

// 編集パネルのリセット（選択解除）
function hideEditPanel() {
    // パネルは隠さないが、状態をリセットする
    state.selectedEmoji = null;
    state.editMode = 'new';

    // UIを初期状態（新規配置モード）に戻す
    showEditPanel();

    // プレビューを現在の選択（またはデフォルト）に戻す
    updateEditPanel();

    redrawCanvas();
}

// 編集パネルを更新
function updateEditPanel() {
    if (state.editMode === 'new') {
        emojiPreview.textContent = state.currentEmoji;
        sizeSlider.value = state.currentSize;
        rotationSlider.value = state.currentRotation;
    } else if (state.editMode === 'edit' && state.selectedEmoji) {
        emojiPreview.textContent = state.selectedEmoji.emoji;
        sizeSlider.value = state.selectedEmoji.size;
        rotationSlider.value = state.selectedEmoji.rotation;

        // 編集中はスライダーの値を一時変数にも同期（次回の新規作成のため）
        // あえて同期しないほうがいいかもしれないが、使い勝手的に同期させる
        state.currentSize = state.selectedEmoji.size;
        state.currentRotation = state.selectedEmoji.rotation;
    }

    sizeValue.textContent = Math.round(sizeSlider.value) + 'px';
    rotationValue.textContent = Math.round(rotationSlider.value) + '°';

    // プレビューのスタイルを更新
    emojiPreview.style.fontSize = sizeSlider.value + 'px';
    emojiPreview.style.transform = `rotate(${rotationSlider.value}deg)`;
}

function updateToolModeUI() {
    document.querySelectorAll('.segment-btn[data-mode]').forEach(btn => {
        if (btn.dataset.mode === state.toolMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// キャンバスに絵文字を配置 / 編集完了
function placeEmoji(x, y) {
    if (state.editMode === 'new' && x !== undefined && y !== undefined) {
        // 新規配置（座標指定あり）
        const newEmoji = {
            id: state.nextId++,
            emoji: state.currentEmoji,
            x: x,
            y: y,
            size: state.currentSize,
            rotation: state.currentRotation,
            zIndex: state.canvasEmojis.length
        };
        state.canvasEmojis.push(newEmoji);

        // 配置後、そのままその絵文字を選択状態にする（連続操作しやすくする）
        // ただし、描画モード(draw)の場合は連続スタンプしたいので、選択状態にしない
        if (state.toolMode === 'draw') {
            // 選択しない。editModeもnewのまま
            // showEditPanelはnewモードの内容で更新されるはず
        } else {
            // 選択モードやその他の場合（もしあれば）は選択状態にする
            state.selectedEmoji = newEmoji;
            state.editMode = 'edit';
        }
        showEditPanel();

    } else {
        // ボタンから呼ばれた場合など（完了扱い）
        // 編集完了（選択解除）
        state.selectedEmoji = null; // 選択解除
        state.editMode = 'new';
        // UIをリセット
        showEditPanel();
    }

    redrawCanvas();
}

// キャンバスを再描画
function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 背景を描画（白背景の場合のみ）
    if (state.bgMode === 'white') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // zIndex順にソート
    const sortedEmojis = [...state.canvasEmojis].sort((a, b) => a.zIndex - b.zIndex);

    sortedEmojis.forEach(emojiObj => {
        ctx.save();
        ctx.translate(emojiObj.x, emojiObj.y);
        ctx.rotate((emojiObj.rotation * Math.PI) / 180);
        ctx.font = `${emojiObj.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 選択中の絵文字をハイライト
        if (state.selectedEmoji && state.selectedEmoji.id === emojiObj.id) {
            ctx.strokeStyle = '#2196F3';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            const metrics = ctx.measureText(emojiObj.emoji);
            const textWidth = metrics.width;
            const textHeight = emojiObj.size;
            ctx.strokeRect(-textWidth / 2 - 5, -textHeight / 2 - 5, textWidth + 10, textHeight + 10);
            ctx.setLineDash([]);
        }

        ctx.fillText(emojiObj.emoji, 0, 0);
        ctx.restore();
    });
}

// キャンバス上の絵文字を選択
function selectEmojiOnCanvas(x, y) {
    // 座標をキャンバス座標に変換
    const rect = canvas.getBoundingClientRect();
    const canvasX = (x - rect.left) * (canvas.width / rect.width);
    const canvasY = (y - rect.top) * (canvas.height / rect.height);

    // 最前面から検索（逆順）
    const sortedEmojis = [...state.canvasEmojis].sort((a, b) => b.zIndex - a.zIndex);

    for (const emojiObj of sortedEmojis) {
        // 簡易的な当たり判定（矩形）
        const halfSize = emojiObj.size / 2;
        if (
            canvasX >= emojiObj.x - halfSize &&
            canvasX <= emojiObj.x + halfSize &&
            canvasY >= emojiObj.y - halfSize &&
            canvasY <= emojiObj.y + halfSize
        ) {
            state.selectedEmoji = emojiObj;
            state.editMode = 'edit';
            showEditPanel();
            updateEditPanel();
            redrawCanvas();
            return true;
        }
    }

    return false;
}

// 絵文字を削除
function deleteEmoji() {
    if (state.selectedEmoji) {
        state.canvasEmojis = state.canvasEmojis.filter(e => e.id !== state.selectedEmoji.id);
        hideEditPanel();
        redrawCanvas();
    }
}

// レイヤー順序を変更
function bringToFront() {
    if (state.selectedEmoji) {
        const maxZ = Math.max(...state.canvasEmojis.map(e => e.zIndex));
        state.selectedEmoji.zIndex = maxZ + 1;
        redrawCanvas();
    }
}

function bringForward() {
    if (state.selectedEmoji) {
        const currentZ = state.selectedEmoji.zIndex;
        const nextEmoji = state.canvasEmojis.find(e => e.zIndex === currentZ + 1);
        if (nextEmoji) {
            nextEmoji.zIndex = currentZ;
            state.selectedEmoji.zIndex = currentZ + 1;
            redrawCanvas();
        }
    }
}

function sendBackward() {
    if (state.selectedEmoji) {
        const currentZ = state.selectedEmoji.zIndex;
        const prevEmoji = state.canvasEmojis.find(e => e.zIndex === currentZ - 1);
        if (prevEmoji) {
            prevEmoji.zIndex = currentZ;
            state.selectedEmoji.zIndex = currentZ - 1;
            redrawCanvas();
        }
    }
}

function sendToBack() {
    if (state.selectedEmoji) {
        const minZ = Math.min(...state.canvasEmojis.map(e => e.zIndex));
        state.selectedEmoji.zIndex = minZ - 1;
        redrawCanvas();
    }
}

// 背景モードを切り替え
function toggleBackground() {
    state.bgMode = state.bgMode === 'transparent' ? 'white' : 'transparent';
    updateBackground();
    redrawCanvas();
}

function updateBackground() {
    if (state.bgMode === 'transparent') {
        document.body.classList.add('bg-transparent');
        document.body.classList.remove('bg-white');
    } else {
        document.body.classList.add('bg-white');
        document.body.classList.remove('bg-transparent');
    }
}

// 最近使った絵文字を追加
function addToRecentEmojis(emoji) {
    // 既存のものを削除
    state.recentEmojis = state.recentEmojis.filter(e => e !== emoji);
    // 先頭に追加
    state.recentEmojis.unshift(emoji);
    // 最大10個まで
    if (state.recentEmojis.length > 10) {
        state.recentEmojis.pop();
    }
    saveRecentEmojis();
    displayRecentEmojis();
}

function displayRecentEmojis() {
    if (state.recentEmojis.length === 0) {
        recentEmojisSection.classList.remove('visible');
        return;
    }

    recentEmojisSection.classList.add('visible');
    recentEmojisContainer.innerHTML = '';
    state.recentEmojis.forEach(emoji => {
        const item = document.createElement('div');
        item.className = 'emoji-item';
        item.textContent = emoji;
        item.addEventListener('click', () => selectEmojiForPlacement(emoji));
        recentEmojisContainer.appendChild(item);
    });
}

function saveRecentEmojis() {
    try {
        localStorage.setItem('desu-emojie-recent', JSON.stringify(state.recentEmojis));
    } catch (e) {
        console.error('Failed to save recent emojis:', e);
    }
}

function loadRecentEmojis() {
    try {
        const saved = localStorage.getItem('desu-emojie-recent');
        if (saved) {
            state.recentEmojis = JSON.parse(saved);
            displayRecentEmojis();
        }
    } catch (e) {
        console.error('Failed to load recent emojis:', e);
    }
}

// 全消去
function clearCanvas() {
    if (state.canvasEmojis.length === 0) return;

    if (confirm('すべての絵文字を削除しますか?')) {
        state.canvasEmojis = [];
        state.selectedEmoji = null;
        hideEditPanel();
        redrawCanvas();
    }
}

// 保存機能
function openSaveUI() {
    saveOverlay.classList.add('active');
    saveUI.classList.add('active');
    // 選択モード開始
    startSelection();
}

function closeSaveUI() {
    saveOverlay.classList.remove('active');
    saveUI.classList.remove('active');
    // インラインスタイルが残っている可能性があるので削除
    saveUI.style.display = '';

    state.selectionMode = false;
    state.selectionRect = null;
    selectionCanvas.style.display = 'none';
    confirmSelectionBtn.style.display = 'none';
    redoSelectionBtn.style.display = 'none';
}

function saveAll() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width * state.saveScale;
    tempCanvas.height = canvas.height * state.saveScale;
    const tempCtx = tempCanvas.getContext('2d');

    // スケーリング
    tempCtx.scale(state.saveScale, state.saveScale);

    // 背景を描画
    if (!transparentBgCheckbox.checked) {
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 絵文字を描画
    const sortedEmojis = [...state.canvasEmojis].sort((a, b) => a.zIndex - b.zIndex);
    sortedEmojis.forEach(emojiObj => {
        tempCtx.save();
        tempCtx.translate(emojiObj.x, emojiObj.y);
        tempCtx.rotate((emojiObj.rotation * Math.PI) / 180);
        tempCtx.font = `${emojiObj.size}px Arial`;
        tempCtx.textAlign = 'center';
        tempCtx.textBaseline = 'middle';
        tempCtx.fillText(emojiObj.emoji, 0, 0);
        tempCtx.restore();
    });

    // ダウンロード
    downloadCanvas(tempCanvas, `emojie-${Date.now()}.png`);
    closeSaveUI();
}

function downloadCanvas(canvas, filename) {
    canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    });
}

// 範囲選択保存（簡易版）
function startSelection() {
    state.selectionMode = true;
    selectionCanvas.style.display = 'block';
    // キャンバスサイズを再度合わせる（ウィンドウリサイズ対応）
    selectionCanvas.width = window.innerWidth;
    selectionCanvas.height = window.innerHeight;

    // 前回の描画をクリア
    selectionCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    state.selectionRect = null;
    confirmSelectionBtn.style.display = 'none';
    redoSelectionBtn.style.display = 'none';

    saveUI.querySelector('h3').textContent = 'キャンバス全体を保存するか、範囲を選択してください';

    let startX, startY;
    let isDrawing = false;

    const handleStart = (e) => {
        isDrawing = true;
        // 描画中はUIを隠す
        saveUI.style.display = 'none';

        const rect = selectionCanvas.getBoundingClientRect(); // ウィンドウ全体
        if (e.touches) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        } else {
            startX = e.clientX;
            startY = e.clientY;
        }
    };

    const handleMove = (e) => {
        if (!isDrawing) return;
        const currentX = e.touches ? e.touches[0].clientX : e.clientX;
        const currentY = e.touches ? e.touches[0].clientY : e.clientY;

        selectionCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
        selectionCtx.strokeStyle = '#2196F3';
        selectionCtx.lineWidth = 2;
        selectionCtx.setLineDash([5, 5]);
        selectionCtx.strokeRect(startX, startY, currentX - startX, currentY - startY);
    };

    const handleEnd = (e) => {
        if (!isDrawing) return;
        isDrawing = false;
        const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const endY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

        // UIを再表示 (インラインスタイルを消してCSSの制御に戻す)
        saveUI.style.display = '';

        state.selectionRect = {
            x: Math.min(startX, endX),
            y: Math.min(startY, endY),
            width: Math.abs(endX - startX),
            height: Math.abs(endY - startY)
        };

        confirmSelectionBtn.style.display = 'inline-block';
        redoSelectionBtn.style.display = 'inline-block';

        selectionCanvas.removeEventListener('mousedown', handleStart);
        selectionCanvas.removeEventListener('mousemove', handleMove);
        selectionCanvas.removeEventListener('mouseup', handleEnd);
        selectionCanvas.removeEventListener('touchstart', handleStart);
        selectionCanvas.removeEventListener('touchmove', handleMove);
        selectionCanvas.removeEventListener('touchend', handleEnd);
    };

    selectionCanvas.addEventListener('mousedown', handleStart);
    selectionCanvas.addEventListener('mousemove', handleMove);
    selectionCanvas.addEventListener('mouseup', handleEnd);
    selectionCanvas.addEventListener('touchstart', handleStart);
    selectionCanvas.addEventListener('touchmove', handleMove);
    selectionCanvas.addEventListener('touchend', handleEnd);
}

// イベントリスナーの設定
function setupEventListeners() {
    // カテゴリタブ
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            categoryTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const category = tab.dataset.category;
            if (category === 'all') {
                displayEmojis(allEmojis);
            } else {
                displayEmojis(emojiData[category]);
            }
        });
    });

    // 検索
    emojiSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query === '') {
            displayEmojis(emojiData.smileys);
            return;
        }

        // 絵文字キーワードまたは絵文字そのもので検索
        const filtered = allEmojis.filter(emoji => {
            const keywords = emojiKeywords[emoji] || '';
            return emoji.includes(query) || keywords.includes(query);
        });
        displayEmojis(filtered);
    });

    // スライダー
    sizeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (state.editMode === 'edit' && state.selectedEmoji) {
            state.selectedEmoji.size = val;
            // currentSizeも更新しておくと、次に新規作成するときに引き継がれる
            state.currentSize = val;
            updateEditPanel();
            redrawCanvas();
        } else {
            state.currentSize = val;
            updateEditPanel();
        }
    });

    rotationSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (state.editMode === 'edit' && state.selectedEmoji) {
            state.selectedEmoji.rotation = val;
            state.currentRotation = val;
            updateEditPanel();
            redrawCanvas();
        } else {
            state.currentRotation = val;
            updateEditPanel();
        }
    });

    // 配置ボタン
    placeEmojiBtn.addEventListener('click', placeEmoji);

    // 削除ボタン
    deleteEmojiBtn.addEventListener('click', deleteEmoji);

    // レイヤー順序ボタン
    bringFrontBtn.addEventListener('click', bringToFront);
    bringForwardBtn.addEventListener('click', bringForward);
    sendBackwardBtn.addEventListener('click', sendBackward);
    sendBackBtn.addEventListener('click', sendToBack);

    // ツール切り替えボタン
    document.querySelectorAll('.segment-btn[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.toolMode = btn.dataset.mode;
            // ツール変更時は選択状態を解除して新規モードに戻すのが自然
            state.selectedEmoji = null;
            state.editMode = 'new';
            updateToolModeUI();
            showEditPanel();
            redrawCanvas();
        });
    });

    // キャンバスドラッグ&ドロップ
    let isDragging = false;
    let draggedEmoji = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let emojiStartX = 0;
    let emojiStartY = 0;

    const handleCanvasStart = (e) => {
        // e.preventDefault(); // スクロール防止はCanvas内のみ有効にしたいが、タッチ開始時は防ぐ
        if (e.type === 'touchstart') e.preventDefault();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const rect = canvas.getBoundingClientRect();
        const canvasX = (clientX - rect.left) * (canvas.width / rect.width);
        const canvasY = (clientY - rect.top) * (canvas.height / rect.height);

        // 描画モード: ドラッグなし、タップ判定のみ後で行う
        // 選択モード: ドラッグ判定を行う
        if (state.toolMode === 'select') {
            // 最前面から検索
            const sortedEmojis = [...state.canvasEmojis].sort((a, b) => b.zIndex - a.zIndex);

            for (const emojiObj of sortedEmojis) {
                const halfSize = emojiObj.size / 2;
                if (
                    canvasX >= emojiObj.x - halfSize &&
                    canvasX <= emojiObj.x + halfSize &&
                    canvasY >= emojiObj.y - halfSize &&
                    canvasY <= emojiObj.y + halfSize
                ) {
                    isDragging = true;
                    draggedEmoji = emojiObj;
                    dragStartX = clientX;
                    dragStartY = clientY;
                    emojiStartX = emojiObj.x;
                    emojiStartY = emojiObj.y;
                    break;
                }
            }
        }

        // Windowにリスナー追加 (キャンバス外でもドラッグ継続)
        window.addEventListener('mousemove', handleCanvasMove);
        window.addEventListener('mouseup', handleCanvasEnd);
        window.addEventListener('touchmove', handleCanvasMove, { passive: false });
        window.addEventListener('touchend', handleCanvasEnd);
    };

    const handleCanvasMove = (e) => {
        if (!isDragging || !draggedEmoji) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const rect = canvas.getBoundingClientRect();
        const deltaX = (clientX - dragStartX) * (canvas.width / rect.width);
        const deltaY = (clientY - dragStartY) * (canvas.height / rect.height);

        draggedEmoji.x = emojiStartX + deltaX;
        draggedEmoji.y = emojiStartY + deltaY;

        redrawCanvas();
        if (e.cancelable) e.preventDefault();
    };

    const handleCanvasEnd = (e) => {
        // Windowからリスナー削除
        window.removeEventListener('mousemove', handleCanvasMove);
        window.removeEventListener('mouseup', handleCanvasEnd);
        window.removeEventListener('touchmove', handleCanvasMove);
        window.removeEventListener('touchend', handleCanvasEnd);

        if (isDragging && draggedEmoji) {
            // ドラッグ終了
            state.selectedEmoji = draggedEmoji;
            state.editMode = 'edit';
            showEditPanel();
            updateEditPanel();
            redrawCanvas();
        } else if (!isDragging && !draggedEmoji) {
            // タップ判定
            // (mouseup/touchendの座標は、changedTouchesを見る)
            const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

            const rect = canvas.getBoundingClientRect();

            // キャンバス内でのリリースか判定
            if (clientX >= rect.left && clientX <= rect.right &&
                clientY >= rect.top && clientY <= rect.bottom) {

                const canvasX = (clientX - rect.left) * (canvas.width / rect.width);
                const canvasY = (clientY - rect.top) * (canvas.height / rect.height);

                // 描画モード
                if (state.toolMode === 'draw') {
                    placeEmoji(canvasX, canvasY);
                    return;
                }

                // 選択モード
                if (state.toolMode === 'select') {
                    if (selectEmojiOnCanvas(clientX, clientY)) {
                        // 選択成功
                    } else {
                        // 空白タップ -> 選択解除
                        state.selectedEmoji = null;
                        state.editMode = 'new';
                        showEditPanel();
                        redrawCanvas();
                    }
                }
            }
        }

        isDragging = false;
        draggedEmoji = null;
    };

    canvas.addEventListener('mousedown', handleCanvasStart);
    // canvas.addEventListener('mousemove', handleCanvasMove); // Windowで管理
    // canvas.addEventListener('mouseup', handleCanvasEnd);   // Windowで管理
    canvas.addEventListener('touchstart', handleCanvasStart, { passive: false });
    // canvas.addEventListener('touchmove', handleCanvasMove, { passive: false }); // Windowで管理
    // canvas.addEventListener('touchend', handleCanvasEnd);   // Windowで管理

    // 背景切り替え
    bgToggleBtn.addEventListener('click', toggleBackground);

    // 保存
    saveBtn.addEventListener('click', openSaveUI);
    saveAllBtn.addEventListener('click', saveAll);
    cancelSaveBtn.addEventListener('click', closeSaveUI);

    // 全消去
    clearBtn.addEventListener('click', clearCanvas);

    // クレジット
    creditBtn.addEventListener('click', () => {
        creditModal.classList.add('visible');
    });

    creditModal.addEventListener('click', () => {
        creditModal.classList.remove('visible');
    });

    // 選択範囲やり直し
    if (redoSelectionBtn) {
        redoSelectionBtn.addEventListener('click', startSelection);
    }

    // スケール選択
    document.querySelectorAll('.option-btn[data-scale]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.option-btn[data-scale]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.saveScale = parseInt(btn.dataset.scale);
        });
    });

    // 範囲選択ボタン
    if (confirmSelectionBtn) {
        confirmSelectionBtn.addEventListener('click', () => {
            // 範囲選択の確定処理
            if (!state.selectionRect) return;

            const canvasRect = canvas.getBoundingClientRect();
            const rect = state.selectionRect;

            // キャンバス座標に変換
            // x, y はキャンバス内の描画座標 (0 ~ 600)
            const scaleX = canvas.width / canvasRect.width;
            const scaleY = canvas.height / canvasRect.height;

            // 選択範囲の左上 (ウィンドウ座標 -> キャンバスローカル座標)
            let x = (rect.x - canvasRect.left) * scaleX;
            let y = (rect.y - canvasRect.top) * scaleY;
            let w = rect.width * scaleX;
            let h = rect.height * scaleY;

            // キャンバスからはみ出している部分をカットするか、単純にそのまま使うか。
            // ユーザーは「見たまま」を期待するはず。キャンバス外は白(または透明)になるべき。
            // しかし描画ループなどではキャンバス外除外が必要。
            // ここでは startX/Y が負になってもOKとして、width/heightを正しく維持する方針にする。
            // ただし、もし選択範囲がキャンバスと全く重なっていない場合はエラーにする。

            // キャンバス矩形(0,0,600,600)と選択矩形(x,y,w,h)の交差判定
            if (x + w < 0 || x > canvas.width || y + h < 0 || y > canvas.height) {
                alert('選択範囲がキャンバス外です');
                return;
            }

            // w, h が極端に小さい場合は無視
            if (w < 1 || h < 1) {
                alert('選択範囲が小さすぎます');
                return;
            }

            // 選択範囲を保存
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w * state.saveScale;
            tempCanvas.height = h * state.saveScale;
            const tempCtx = tempCanvas.getContext('2d');

            // スケーリング
            tempCtx.scale(state.saveScale, state.saveScale);

            // 背景を描画
            if (!transparentBgCheckbox.checked) {
                tempCtx.fillStyle = '#ffffff';
                tempCtx.fillRect(0, 0, w, h);
            }

            // 絵文字を描画（範囲内のみ）
            const sortedEmojis = [...state.canvasEmojis].sort((a, b) => a.zIndex - b.zIndex);
            sortedEmojis.forEach(emojiObj => {
                // 範囲内にあるかチェック
                const halfSize = emojiObj.size / 2;
                if (
                    emojiObj.x + halfSize >= x &&
                    emojiObj.x - halfSize <= x + w &&
                    emojiObj.y + halfSize >= y &&
                    emojiObj.y - halfSize <= y + h
                ) {
                    tempCtx.save();
                    tempCtx.translate(emojiObj.x - x, emojiObj.y - y);
                    tempCtx.rotate((emojiObj.rotation * Math.PI) / 180);
                    tempCtx.font = `${emojiObj.size}px Arial`;
                    tempCtx.textAlign = 'center';
                    tempCtx.textBaseline = 'middle';
                    tempCtx.fillText(emojiObj.emoji, 0, 0);
                    tempCtx.restore();
                }
            });

            // ダウンロード
            downloadCanvas(tempCanvas, `emojie-selection-${Date.now()}.png`);
            closeSaveUI();
        });
    }

    if (redoSelectionBtn) {
        redoSelectionBtn.addEventListener('click', () => {
            // 範囲選択のやり直し
            state.selectionRect = null;
            selectionCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
            confirmSelectionBtn.style.display = 'none';
            redoSelectionBtn.style.display = 'none';
            startSelection();
        });
    }

    // ピンチイン/アウトでキャンバス拡大縮小
    let currentScale = 1;
    let initialDistance = 0;

    const getDistance = (touch1, touch2) => {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    canvasContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            initialDistance = getDistance(e.touches[0], e.touches[1]);
        }
    }, { passive: true });

    canvasContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialDistance > 0) {
            const currentDistance = getDistance(e.touches[0], e.touches[1]);
            const scale = currentDistance / initialDistance;
            currentScale = Math.max(0.5, Math.min(3, currentScale * scale));
            canvasContainer.style.transform = `translate(-50%, -50%) scale(${currentScale})`;
            initialDistance = currentDistance;
        }
    }, { passive: true });

    canvasContainer.addEventListener('touchend', () => {
        initialDistance = 0;
    }, { passive: true });

    // マウスホイールでズーム（デスクトップ用）
    canvasContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        currentScale = Math.max(0.5, Math.min(3, currentScale * delta));
        canvasContainer.style.transform = `translate(-50%, -50%) scale(${currentScale})`;
    }, { passive: false });
}

// アプリケーション起動
init();
