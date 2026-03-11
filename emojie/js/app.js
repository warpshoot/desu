// DESU™ emojie - 絵文字コラージュツール

// 絵文字データベース（カテゴリ別）
const emojiData = {
    smileys: [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇',
        '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝',
        '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😶‍🌫️', '😏', '😒',
        '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
        '🤧', '🥵', '🥶', '🥴', '😵', '😵‍💫', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐',
        '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰',
        '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡',
        '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾',
        '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🙈', '🙉', '🙊',
        '💋', '💌', '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️‍🔥',
        '❤️‍🩹', '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '👋', '🤚', '🖐️',
        '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆',
        '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲',
        '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👂',
        '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '👶', '🧒', '👦', '👧',
        '🧑', '👱', '👨', '👨‍🦰', '👨‍🦱', '👨‍🦳', '👨‍🦲', '👩', '👩‍🦰', '👩‍🦱', '👩‍🦳', '👩‍🦲',
        '👱‍♀️', '👱‍♂️', '🧓', '👴', '👵', '警察', '探偵', '衛兵', '忍者', '工事', '王子', '王女', 'ターバン', '👲', '🧕',
        '🤵', '👰', '🤰', '🤱', '👼', '🎅', '🤶', '🦸', '🦹', '魔術師', '妖精', '吸血鬼', '人魚',
        'エルフ', 'ジニー', 'ゾンビ', '💆', '💇', '🚶', '🧍', '🧎', '🏃', '踊る', '🕺', '🕴️', '👯'
    ],
    animals: [
        '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷',
        '🐽', '🐸', '🐵', '🐒', '🦍', '🦧', '🦮', '🐕‍🦺', '🐩', '🐺', '🦝', '🐈‍⬛', '🐅', '🐆',
        '🐴', '🐎', '🦄', '🦓', '🦌', '🦬', '🐂', '🐃', '🐄', '🐖', '🐗', '🐏', '🐑', '🐐',
        '🐪', '🐫', '🦙', '🦒', '🐘', '🦣', '🦏', '🦛', '🐁', '🐀', '🐇', '🐿️', 'ビーバー',
        'ハリネズミ', 'コウモリ', 'ナマケモノ', 'カワウソ', 'スカンク', 'カンガルー', '足跡', 'ターキー',
        'ニワトリ', 'シャモ', 'ひよこ', '🐤', '🐥', 'バード', '鳩', 'イーグル', '鴨', 'スワン',
        '梟', 'フラミンゴ', '孔雀', '鸚鵡', '亀', 'トカゲ', '蛇', '🐲', '🐉', 'プレシオサウルス',
        'T-Rex', 'クジラ', 'マッコウクジラ', 'イルカ', 'アザラシ', '魚', '熱帯魚', 'フグ', '鮫',
        'タコ', 'イカ', '海老', 'ロブスター', 'カニ', '貝殻', '珊瑚', 'カタツムリ', '蝶々', '毛虫',
        '蟻', '蜜蜂', '甲虫', 'テントウムシ', 'コオロギ', '蜘蛛', '蜘蛛の巣', '蠍', '蚊', '蝿',
        'ミミズ', '微生物', 'ブーケ', 'サクラ', '💮', '🏵️', '薔薇', '🥀', 'ハイビスカス', 'ヒマワリ',
        '雛菊', 'チューリップ', '苗', '盆栽', '杉', '木', 'ヤシの木', 'サボテン', '稲穂', '🌿',
        '☘️', '四つ葉のクローバー', '楓', '落ち葉', '風に舞う葉'
    ],
    food: [
        '🍎', '🍏', '🍊', 'レモン', 'バナナ', '🍉', '葡萄', 'イチゴ', 'ブルーベリー', 'メロン', 'チェリー', '桃', 'マンゴー',
        'パイナップル', 'ココナッツ', 'キウイ', 'トマト', 'ナス', 'アボカド', 'ブロッコリー', '葉菜', 'キュウリ', '唐辛子', 'ピーマン', 'トウモロコシ', '人参',
        'オリーブ', 'ニンニク', 'タマネギ', 'ジャガイモ', 'スイートポテト', 'クロワッサン', 'ベーグル', 'パン', 'バゲット', 'プレッツェル', 'チーズ', '卵', '目玉焼き',
        'バター', 'パンケーキ', 'ワッフル', 'ベーコン', 'ステーキ', '鶏肉', '骨付き肉', '骨', 'ホットドッグ', 'ハンバーガー', 'フライドポテト', 'ピザ', 'フラットブレッド',
        'サンドイッチ', 'ピタ', 'ファラフェル', 'タコス', 'ブリトー', 'タマル', 'サラダ', 'パエリア', 'フォンデュ', '缶詰', 'スパゲッティ', 'ラーメン', '鍋',
        'カレー', '寿司', '弁当', '餃子', '牡蠣', '海老天', 'おにぎり', '御飯', '煎餅', 'なると', 'フォーチュンクッキー', '月餅', 'おでん',
        '団子', 'かき氷', 'アイスクリーム', 'ソフトクリーム', 'パイ', 'カップケーキ', 'ショートケーキ', '誕生日ケーキ', 'プリン', 'ロリポップ', '飴', 'チョコ', 'ポップコーン',
        'ドーナツ', 'クッキー', '栗', 'ピーナッツ', '蜂蜜', '牛乳', '哺乳瓶', 'コーヒー', 'ティーポット', 'お茶', 'ジュース', 'ソーダ', 'タピオカ',
        '日本酒', 'ビール', 'ジョッキ', '乾杯', 'ワイン', 'ウイスキー', 'カクテル', 'トロピカルドリンク', 'マテ茶', 'シャンパン', '氷'
    ],
    symbols: [
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞',
        '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯',
        '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
        '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸',
        '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️',
        '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢',
        '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️',
        '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰',
        '♻️', '✅', '🈯', '💹',
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
        '⭐', '🌟', '✨', '💫', '⚡', '💥', '🔥', '🌈', '☀️', '⛅', '雲', '🌤️', '⛈️',
        '🌦️', '🌧️', '⛆', '☔', '💧', '💦', '波', '🌙', 'カボチャ', 'クリスマスツリー', '🎆', '🎇', '🧨',
        'バルーン', '🎉', '🎊', '🎋', '🎍', '🎎', '🎏', '🎐', '🎑', '🧧', 'リボン', 'ギフト', 'チケット',
        'トロフィー', '🥇', '🥈', '🥉', 'サッカー', '野球', 'バスケ', 'バレー', 'アメリカンフットボール', 'テニス', 'ボウリング', 'クリケット', '🏓',
        'バドミントン', 'ボクシング', '道着', 'ゴルフ', 'スケート', '釣り', 'スノーボード', 'スキー', 'ソリ', 'ターゲット', '🎱', 'ビデオゲーム', 'ジョイスティック',
        'ダイス', 'パズル', 'パレット', 'カチンコ', 'マイク', 'ヘッドホン', '🎼', 'キーボード', '鼓', 'ギタ', 'バイオリン', '🚗', 'タクシー',
        '🚙', 'バス', 'パトカー', '救急車', '消防車', 'バン', 'トラック', 'トラクター', '自転車', 'スクーター', 'バイク', '船', '飛行機',
        'ロケット', 'UFO', '家', '庭付き家', 'オフィス', '病院', '銀行', 'ホテル', '学校', 'コンビニ', '工場', '城', '東京タワー',
        '自由の女神', '鳥居', '噴水', 'テント'
    ]
};

// 絵文字キーワード辞書
// Loaded from emojis.js as window.emojiKeywords

// すべての絵文字リスト (loaded from emojis.js)
const allEmojis = [];

// カテゴリ用アイコンマッピング
const categoryIcons = {
    recent: '🕒',
    smileys: '😀',
    people: '👋',
    animals: '🐶',
    food: '🍎',
    travel: '🚗',
    activities: '⚽',
    objects: '💡',
    symbols: '⭐',
    flags: '🏁'
};

// 初期化時にデータを統合
function initializeEmojiData() {
    if (window.emojiData) {
        Object.keys(window.emojiData).forEach(key => {
            if (Array.isArray(window.emojiData[key])) {
                allEmojis.push(...window.emojiData[key]);
            }
        });
    }
}

// アプリケーション状態
let state = {
    canvasEmojis: [], // [{id, emoji, x, y, size, rotation, zIndex}]
    selectedEmoji: null, // 編集中の絵文字
    editMode: 'new', // 'new' or 'edit'
    currentEmoji: '😀',
    currentSize: 60,
    currentRotation: 0,
    currentRotation: 0,
    bgMode: 'white', // always white/color base, transparent is option on save
    canvasColor: '#ffffff',
    recentEmojis: [],
    nextId: 1,
    saveScale: 1,
    selectionMode: false,
    selectionRect: null,
    toolMode: 'draw', // 'draw' or 'select'
    toolMode: 'draw', // 'draw' or 'select'
    historyStack: [],
    redoStack: [],
    // Gesture State
    maxFingers: 0,
    isGestureActive: false,
    touchStartTime: 0,
    didInteract: false, // moved/dragged/pinched
    isResizing: false, // slider interaction state
    isRotating: false // slider interaction state
};

// DOM要素
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvas-container');
const emojiList = document.getElementById('emoji-list');
const emojiSearch = document.getElementById('emoji-search');
// const categoryTabs = document.querySelectorAll('.category-tab'); // Dynamic now
const editPanel = document.getElementById('edit-panel');
const emojiPreview = document.getElementById('emoji-preview');
const sizeSlider = document.getElementById('size-slider');
const sizeValue = document.getElementById('size-value');
const rotationSlider = document.getElementById('rotation-slider');
const rotationValue = document.getElementById('rotation-value');
// const placeEmojiBtn = document.getElementById('place-emoji'); // Deleted
const deleteEmojiBtn = document.getElementById('delete-emoji');
const flipHBtn = document.getElementById('flip-h');
const layerControls = document.getElementById('layer-controls');
const bringFrontBtn = document.getElementById('bring-front');
const bringForwardBtn = document.getElementById('bring-forward');
const sendBackwardBtn = document.getElementById('send-backward');
const sendBackBtn = document.getElementById('send-back');
const bgToggleBtn = document.getElementById('bgToggleBtn');
const bgColorPicker = document.getElementById('bgColorPicker');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const creditBtn = document.getElementById('credit-btn');
const creditModal = document.getElementById('credit-modal');
const saveOverlay = document.getElementById('save-overlay');
const saveUI = document.getElementById('save-ui');
const saveAllBtn = document.getElementById('saveAllBtn');
const confirmSelectionBtn = document.getElementById('confirmSelectionBtn');
const copyClipboardBtn = document.getElementById('copyClipboardBtn');
const redoSelectionBtn = document.getElementById('redoSelectionBtn');
const cancelSaveBtn = document.getElementById('cancelSaveBtn');
const transparentBgCheckbox = document.getElementById('transparentBg');
const selectionCanvas = document.getElementById('selection-canvas');
const selectionCtx = selectionCanvas.getContext('2d');
const selectionSize = document.getElementById('selection-size');
const recentEmojisContainer = null; // Removed persistent section
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const sizeLabel = document.getElementById('size-label');
const rotationLabel = document.getElementById('rotation-label');

// History Management
function saveToHistory() {
    const currentState = JSON.stringify(state.canvasEmojis);

    // 直前の状態と同じなら保存しない (重複回避)
    if (state.historyStack.length > 0) {
        const lastState = state.historyStack[state.historyStack.length - 1];
        if (lastState === currentState) return;
    }

    state.historyStack.push(currentState);
    state.redoStack = []; // Clear redo stack on new action
    updateHistoryUI();
}

function undo() {
    if (state.historyStack.length === 0) return;

    // Save current state to redo stack
    state.redoStack.push(JSON.stringify(state.canvasEmojis));

    // Restore from history
    const prevState = state.historyStack.pop();
    state.canvasEmojis = JSON.parse(prevState);

    // 選択状態の復元は難しいので解除推奨だが、IDが変わらなければ維持できるかも
    // いったん解除する
    state.selectedEmoji = null;
    hideEditPanel(); // これがredrawも呼ぶ

    saveStorage(); // Save new state
    updateHistoryUI();
}

function redo() {
    if (state.redoStack.length === 0) return;

    // Save current state to history
    state.historyStack.push(JSON.stringify(state.canvasEmojis));

    // Restore from redo
    const nextState = state.redoStack.pop();
    state.canvasEmojis = JSON.parse(nextState);

    state.selectedEmoji = null;
    hideEditPanel();

    saveStorage(); // Save new state
    updateHistoryUI();
}

function updateHistoryUI() {
    if (state.historyStack.length > 0) {
        undoBtn.classList.remove('disabled');
    } else {
        undoBtn.classList.add('disabled');
    }

    if (state.redoStack.length > 0) {
        redoBtn.classList.remove('disabled');
    } else {
        redoBtn.classList.add('disabled');
    }
}

// 初期化
function init() {
    // キャンバスサイズを設定
    canvas.width = 600;
    canvas.height = 600;

    // データを初期化
    initializeEmojiData();

    // カテゴリタブを生成
    renderCategoryTabs();

    // セレクションキャンバスのサイズを設定
    selectionCanvas.width = window.innerWidth;
    selectionCanvas.height = window.innerHeight;

    // 最近使った絵文字をロード
    loadRecentEmojis();
    // データをロード
    loadStorage();

    // 初期絵文字リストを表示 (デフォルトを最近使ったものに)
    displayEmojis('recent');

    // イベントリスナーを設定
    setupEventListeners();

    // ツールモード初期化
    updateToolModeUI();

    // 背景モードを初期化
    updateBackground();

    // 初期描画
    redrawCanvas();

    // プレビューの初期化
    showEditPanel(); // Update button visibility based on initial state
    updateEditPanel();
}

// 絵文字対応チェック
const supportCtx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
supportCtx.canvas.width = 50; // 幅広にしておく
supportCtx.canvas.height = 30;
supportCtx.font = '24px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';

// 基準幅を取得 (😀)
const standardWidth = supportCtx.measureText('😀').width;

function getSupportedEmoji(emoji) {
    if (!emoji) return null;

    // 1. 強制表示リスト (VS16付与)
    const whitelist = ['👀', '🙏', '☝️', '✋', '✊', '🙌', '💅', '👣'];
    if (whitelist.includes(emoji)) {
        return emoji.endsWith('\uFE0F') ? emoji : emoji + '\uFE0F';
    }

    // 2. 幅チェック (ZWJ結合失敗の検出)
    // 結合に失敗すると2文字分以上の幅になることが多い
    const width = supportCtx.measureText(emoji).width;
    // 基準の1.8倍以上ならアウトとする (多少の誤差許容)
    if (width > standardWidth * 1.8) {
        return '?';
    }

    // 3. カラーチェック
    const isColor = (text) => {
        supportCtx.clearRect(0, 0, 50, 30);

        supportCtx.fillText(text, 0, 24);

        // ピクセルチェック (中心部 + 全体スキャン)
        const fullData = supportCtx.getImageData(0, 0, 50, 30).data;
        let hasColor = false;
        let hasPixels = false;

        for (let i = 0; i < fullData.length; i += 4) {
            const r = fullData[i];
            const g = fullData[i + 1];
            const b = fullData[i + 2];
            const a = fullData[i + 3];

            if (a > 20) {
                hasPixels = true;
                // 彩度があるか確認 (グレーでない)
                if (Math.abs(r - g) > 5 || Math.abs(r - b) > 5 || Math.abs(g - b) > 5) {
                    hasColor = true;
                    break;
                }
            }
        }
        return { hasPixels, hasColor };
    };

    const res1 = isColor(emoji);
    if (res1.hasColor) return emoji;

    // 白黒 -> VS16試行
    if (!res1.hasColor) {
        const withVS16 = emoji + '\uFE0F';

        // VS16つけても幅が爆発していないか確認
        if (supportCtx.measureText(withVS16).width > standardWidth * 1.8) {
            return '?';
        }

        const res2 = isColor(withVS16);
        if (res2.hasColor) return withVS16;

        return '?';
    }

    return '?';
}

// 絵文字リストを表示
function displayEmojis(filter) {

    emojiList.innerHTML = '';

    let emojisToShow = [];
    if (filter === 'recent') {
        emojisToShow = state.recentEmojis;
        if (emojisToShow.length === 0) {
            emojiList.innerHTML = '<div class="no-recent">🕒 まだ使った絵文字がありません</div>';
            return;
        }
    } else if (Array.isArray(filter)) {
        emojisToShow = filter;
    } else if (window.emojiData && window.emojiData[filter]) {
        emojisToShow = window.emojiData[filter];
    }

    emojisToShow.forEach(emoji => {
        const item = document.createElement('div');
        item.className = 'emoji-item';

        // サポートチェック & 整形
        const supported = getSupportedEmoji(emoji);

        if (supported && supported !== '?') {
            item.textContent = supported;
            item.addEventListener('click', () => selectEmojiForPlacement(supported));
            emojiList.appendChild(item);
        } else {
            // 非対応の場合は「？」を表示するか、非表示にするか
            item.textContent = '?';
            item.classList.add('unsupported');
            // item.title = 'この環境では表示できません';
            // emojiList.appendChild(item); // 邪魔なら追加しない
        }
    });
}

// 絵文字を選択して配置モードに
// 絵文字を選択して配置モードに
function selectEmojiForPlacement(emoji) {
    // 既に絵文字を選択中の場合は、その絵文字を差し替える（位置・回転・サイズ維持）
    if (state.editMode === 'edit' && state.selectedEmoji) {
        saveToHistory();
        state.selectedEmoji.emoji = emoji;

        // プレビューとキャンバスを更新
        updateEditPanel();
        redrawCanvas();
        saveStorage();

        // 最近使った絵文字に追加
        addToRecentEmojis(emoji);
        return;
    }

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
    // placeEmojiBtn.style.display = 'none'; // 完了ボタン自体を隠す方針に変更

    // 削除ボタンとレイヤー操作は常に表示するが、編集モード以外は無効化（グレーアウト）
    // これによりUIの高さを固定し、ガタつきを防ぐ
    deleteEmojiBtn.style.display = 'block';
    layerControls.style.display = 'flex';

    if (state.editMode === 'edit' && state.selectedEmoji) {
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
    let flipScale = 1;
    if (state.editMode === 'new') {
        flipScale = state.currentFlipX ? -1 : 1;
    } else if (state.editMode === 'edit' && state.selectedEmoji) {
        flipScale = state.selectedEmoji.flipX ? -1 : 1;
    }

    emojiPreview.style.fontSize = '40px'; // Fixed size for preview box
    emojiPreview.style.transform = `rotate(${rotationSlider.value}deg) scaleX(${flipScale})`;

    // Update flip button state
    const flipHBtn = document.getElementById('flip-h');
    if (flipHBtn) {
        const isFlipped = flipScale < 0; // -1 means flipped
        if (isFlipped) {
            flipHBtn.classList.add('active');
        } else {
            flipHBtn.classList.remove('active');
        }
    }
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
        saveToHistory(); // Save before adding
        const newEmoji = {
            id: state.nextId++,
            emoji: state.currentEmoji,
            x: x,
            y: y,
            size: state.currentSize,
            rotation: state.currentRotation,
            flipX: state.currentFlipX,
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
    saveStorage(); // Save new state
}

// キャンバスを再描画
function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 背景を描画
    if (state.bgMode === 'white') {
        ctx.fillStyle = state.canvasColor;
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
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            const metrics = ctx.measureText(emojiObj.emoji);
            const textWidth = metrics.width;
            const textHeight = emojiObj.size;
            ctx.strokeRect(-textWidth / 2 - 5, -textHeight / 2 - 5, textWidth + 10, textHeight + 10);
        }

        if (emojiObj.flipX) {
            ctx.scale(-1, 1);
        }

        ctx.fillText(emojiObj.emoji, 0, 0);
        ctx.restore();
    });

    // Draw Ghost Preview (Center) if Resizing (ONLY in Draw Mode)
    // User requested: "Don't need ghost in select mode because selected object updates directly"
    if ((state.isResizing || state.isRotating) && state.editMode !== 'edit') {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((state.currentRotation * Math.PI) / 180);
        ctx.font = `${state.currentSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.5; // Semi-transparent ghost

        let displayEmoji = state.currentEmoji;
        let flip = state.currentFlipX;

        if (flip) {
            ctx.scale(-1, 1);
        }

        ctx.fillText(displayEmoji, 0, 0);
        ctx.restore();
    }
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
        saveToHistory(); // Save before delete
        state.canvasEmojis = state.canvasEmojis.filter(e => e.id !== state.selectedEmoji.id);
        hideEditPanel();
        redrawCanvas();
        saveStorage(); // Save new state
    }
}

// レイヤー順序を変更
function bringToFront() {
    if (state.selectedEmoji) {
        saveToHistory();
        const maxZ = Math.max(...state.canvasEmojis.map(e => e.zIndex));
        state.selectedEmoji.zIndex = maxZ + 1;
        redrawCanvas();
        saveStorage();
    }
}

function bringForward() {
    if (state.selectedEmoji) {
        saveToHistory();
        const currentZ = state.selectedEmoji.zIndex;
        const nextEmoji = state.canvasEmojis.find(e => e.zIndex === currentZ + 1);
        if (nextEmoji) {
            nextEmoji.zIndex = currentZ;
            state.selectedEmoji.zIndex = currentZ + 1;
            redrawCanvas();
            saveStorage();
        }
    }
}

function sendBackward() {
    if (state.selectedEmoji) {
        saveToHistory();
        const currentZ = state.selectedEmoji.zIndex;
        const prevEmoji = state.canvasEmojis.find(e => e.zIndex === currentZ - 1);
        if (prevEmoji) {
            prevEmoji.zIndex = currentZ;
            state.selectedEmoji.zIndex = currentZ - 1;
            redrawCanvas();
            saveStorage();
        }
    }
}

function sendToBack() {
    if (state.selectedEmoji) {
        saveToHistory();
        const minZ = Math.min(...state.canvasEmojis.map(e => e.zIndex));
        state.selectedEmoji.zIndex = minZ - 1;
        redrawCanvas();
        saveStorage();
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
        canvas.style.backgroundColor = 'transparent';
    } else {
        document.body.classList.add('bg-white');
        document.body.classList.remove('bg-transparent');
        canvas.style.backgroundColor = state.canvasColor;
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
    // displayEmojis('recent'); // Don't switch view automatically
}

function flipEmoji() {
    if (state.editMode === 'edit' && state.selectedEmoji) {
        saveToHistory();
        state.selectedEmoji.flipX = !state.selectedEmoji.flipX;
        // 編集中はcurrentFlipXも同期（次回の新規作成のため）
        state.currentFlipX = state.selectedEmoji.flipX;
        updateEditPanel();
        redrawCanvas();
        saveStorage();
    } else {
        // 新規配置モード
        state.currentFlipX = !state.currentFlipX;
        updateEditPanel();
    }
}

// カテゴリタブを動的に生成
function renderCategoryTabs() {
    const container = document.getElementById('emoji-categories');
    container.innerHTML = '';

    // Recent Tab
    const recentBtn = document.createElement('button');
    recentBtn.className = 'category-tab active';
    recentBtn.dataset.category = 'recent';
    recentBtn.title = '最近使ったもの';
    recentBtn.textContent = categoryIcons['recent'];
    container.appendChild(recentBtn);

    // Other Tabs from Data
    if (window.emojiData) {
        Object.keys(window.emojiData).forEach(category => {
            if (category === 'component') return; // Hide skin tone modifiers
            const btn = document.createElement('button');
            btn.className = 'category-tab';
            btn.dataset.category = category;
            btn.textContent = categoryIcons[category] || '📦'; // Default icon
            container.appendChild(btn);
        });
    }

    // Add event listeners to new tabs
    const tabs = container.querySelectorAll('.category-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // UI Update
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Scroll to top
            if (emojiList) emojiList.scrollTop = 0;

            const category = tab.dataset.category;
            displayEmojis(category);
        });
    });
}

function saveRecentEmojis() {
    try {
        localStorage.setItem('desu-emojie-recent', JSON.stringify(state.recentEmojis));
    } catch (e) {
        console.error('Failed to save recent emojis:', e);
    }
}

const STORAGE_KEY = 'desu-emojie-canvas';

function saveStorage() {
    try {
        const data = {
            canvasEmojis: state.canvasEmojis,
            canvasColor: state.canvasColor,
            bgMode: state.bgMode
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Failed to save canvas storage:', e);
    }
}

function loadStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            if (data.canvasEmojis) state.canvasEmojis = data.canvasEmojis;
            if (data.canvasColor) state.canvasColor = data.canvasColor;
            if (data.bgMode) {
                state.bgMode = data.bgMode;
                // Update checkbox UI if it exists, though logic uses state.bgMode
                // No, updateBackground() handles the visual application
            }
        }
    } catch (e) {
        console.error('Failed to load canvas storage:', e);
    }
}

function loadRecentEmojis() {
    try {
        const saved = localStorage.getItem('desu-emojie-recent');
        if (saved) {
            state.recentEmojis = JSON.parse(saved);
            displayEmojis('recent');
        }
    } catch (e) {
        console.error('Failed to load recent emojis:', e);
    }
}

// 全消去
function clearCanvas() {
    if (state.canvasEmojis.length === 0) return;

    if (confirm('すべての絵文字を削除しますか?')) {
        saveToHistory();
        state.canvasEmojis = [];
        state.selectedEmoji = null;
        hideEditPanel();
        redrawCanvas();
        saveStorage(); // Save new state
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

async function shareOrDownloadBlob(blob, filename) {
    if (navigator.canShare) {
        const file = new File([blob], filename, { type: blob.type });
        try {
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file] });
                return;
            }
        } catch (e) {
            if (e.name === 'AbortError') return;
        }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function downloadCanvas(canvas, filename) {
    canvas.toBlob(blob => shareOrDownloadBlob(blob, filename));
}

async function copyToClipboard(canvas) {
    try {
        // Safari requires ClipboardItem with Promise factory to maintain user gesture context
        await navigator.clipboard.write([
            new ClipboardItem({
                'image/png': new Promise((resolve) => {
                    canvas.toBlob(resolve, 'image/png');
                })
            })
        ]);

        const originalText = copyClipboardBtn.textContent;
        copyClipboardBtn.textContent = 'コピーしました!';
        setTimeout(() => {
            copyClipboardBtn.textContent = originalText;
        }, 1500);
    } catch (err) {
        console.error('Failed to copy image:', err);
        alert('クリップボードへのコピーに失敗しました');
    }
}

function createRegionCanvas(rect) {
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / canvasRect.width;
    const scaleY = canvas.height / canvasRect.height;

    // キャンバス座標に変換
    let x = (rect.x - canvasRect.left) * scaleX;
    let y = (rect.y - canvasRect.top) * scaleY;
    let w = rect.width * scaleX;
    let h = rect.height * scaleY;

    if (x + w < 0 || x > canvas.width || y + h < 0 || y > canvas.height) {
        alert('選択範囲がキャンバス外です');
        return null;
    }
    if (w < 1 || h < 1) {
        alert('選択範囲が小さすぎます');
        return null;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w * state.saveScale;
    tempCanvas.height = h * state.saveScale;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.scale(state.saveScale, state.saveScale);

    if (!transparentBgCheckbox.checked) {
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, w, h);
    }

    const sortedEmojis = [...state.canvasEmojis].sort((a, b) => a.zIndex - b.zIndex);
    sortedEmojis.forEach(emojiObj => {
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

            // Flip handling
            if (emojiObj.flipX) {
                tempCtx.scale(-1, 1);
            }

            tempCtx.fillText(emojiObj.emoji, 0, 0);
            tempCtx.restore();
        }
    });
    return tempCanvas;
}

function updateSelectionSizeDisplay(startX, startY, currentX, currentY) {
    if (!selectionSize) return;

    let w = 0, h = 0;
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / canvasRect.width;
    const scaleY = canvas.height / canvasRect.height;

    if (startX !== undefined && currentX !== undefined) {
        // ドラッグ中の表示 (ウィンドウ座標 -> キャンバス座標相当に変換)
        w = Math.abs(currentX - startX) * scaleX;
        h = Math.abs(currentY - startY) * scaleY;
    } else if (state.selectionRect) {
        // 確定済みの表示
        w = state.selectionRect.width * scaleX;
        h = state.selectionRect.height * scaleY;
    }

    if (w > 0 && h > 0) {
        const finalW = Math.round(w * state.saveScale);
        const finalH = Math.round(h * state.saveScale);
        selectionSize.textContent = `${finalW} x ${finalH} px`;
        selectionSize.style.display = 'block';
    } else {
        selectionSize.style.display = 'none';
    }
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
    if (selectionSize) selectionSize.style.display = 'none';

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
        selectionCtx.strokeStyle = '#000';
        selectionCtx.lineWidth = 1;
        selectionCtx.strokeRect(startX, startY, currentX - startX, currentY - startY);

        updateSelectionSizeDisplay(startX, startY, currentX, currentY);
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
        copyClipboardBtn.style.display = 'inline-block';
        redoSelectionBtn.style.display = 'inline-block';

        updateSelectionSizeDisplay(); // 確定済みの表示に更新

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
    // Category tabs listeners are handled in renderCategoryTabs(), so removed here.

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
            redrawCanvas(); // Update ghost in real-time
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
            redrawCanvas(); // Show ghost preview
        }
    });

    // Size Slider Listeners
    const handleSizeStart = () => {
        state.isResizing = true;
        if (state.editMode === 'edit' && state.selectedEmoji) saveToHistory();
        redrawCanvas();
    };
    const handleSizeEnd = () => {
        state.isResizing = false;
        redrawCanvas();
        if (state.editMode === 'edit' && state.selectedEmoji) saveStorage();
    };

    sizeSlider.addEventListener('mousedown', handleSizeStart);
    sizeSlider.addEventListener('touchstart', handleSizeStart);
    sizeSlider.addEventListener('mouseup', handleSizeEnd);
    sizeSlider.addEventListener('touchend', handleSizeEnd);
    sizeSlider.addEventListener('mouseleave', handleSizeEnd);

    // Rotation Slider Listeners (History only)
    const handleRotationStart = () => {
        state.isRotating = true;
        if (state.editMode === 'edit' && state.selectedEmoji) saveToHistory();
        redrawCanvas();
    };
    const handleRotationEnd = () => {
        state.isRotating = false;
        redrawCanvas();
        if (state.editMode === 'edit' && state.selectedEmoji) saveStorage();
    };

    rotationSlider.addEventListener('mousedown', handleRotationStart);
    rotationSlider.addEventListener('touchstart', handleRotationStart);
    rotationSlider.addEventListener('mouseup', handleRotationEnd);
    rotationSlider.addEventListener('touchend', handleRotationEnd);
    rotationSlider.addEventListener('mouseleave', handleRotationEnd);

    // 配置ボタン (Deleted)
    // placeEmojiBtn.addEventListener('click', placeEmoji);

    // 削除ボタン
    deleteEmojiBtn.addEventListener('click', deleteEmoji);

    // 反転ボタン
    flipHBtn.addEventListener('click', flipEmoji);

    // レイヤー順序ボタン
    bringFrontBtn.addEventListener('click', bringToFront);
    bringForwardBtn.addEventListener('click', bringForward);
    sendBackwardBtn.addEventListener('click', sendBackward);
    sendBackBtn.addEventListener('click', sendToBack);

    // Undo/Redo
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);

    // Reset Size/Rotation by clicking labels
    sizeLabel.addEventListener('click', () => {
        const defaultSize = 60;
        if (state.editMode === 'edit' && state.selectedEmoji) {
            saveToHistory();
            state.selectedEmoji.size = defaultSize;
            state.currentSize = defaultSize;
        } else {
            state.currentSize = defaultSize;
        }
        sizeSlider.value = defaultSize;
        updateEditPanel();
        redrawCanvas();
        if (state.editMode === 'edit' && state.selectedEmoji) saveStorage();
    });

    rotationLabel.addEventListener('click', () => {
        const defaultRotation = 0;
        if (state.editMode === 'edit' && state.selectedEmoji) {
            saveToHistory();
            state.selectedEmoji.rotation = defaultRotation;
            state.currentRotation = defaultRotation;
        } else {
            state.currentRotation = defaultRotation;
        }
        rotationSlider.value = defaultRotation;
        updateEditPanel();
        redrawCanvas();
        if (state.editMode === 'edit' && state.selectedEmoji) saveStorage();
    });

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

    // Multi-touch state (Global consolidated)
    // Refactored to handle gestures robustly

    const handleCanvasStart = (e) => {
        // Update Gesture Global State
        const touches = e.touches ? e.touches.length : 1;

        // If touches is 1, it implies a new session starting from 0 (since touchstart only fires on new contact).
        // Therefore we should unconditionally reset the session state to prevent getting stuck.
        if (touches === 1) {
            state.maxFingers = 1;
            state.isGestureActive = false;
            state.touchStartTime = Date.now();
            state.didInteract = false;
        } else {
            state.maxFingers = Math.max(state.maxFingers, touches);
        }

        if (state.maxFingers >= 2) {
            state.isGestureActive = true;
        }

        // Standard Logic
        if (e.type === 'touchstart') e.preventDefault();

        // If gesture active, don't start drag/place logic
        if (state.isGestureActive || touches > 1) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const rect = canvas.getBoundingClientRect();
        const canvasX = (clientX - rect.left) * (canvas.width / rect.width);
        const canvasY = (clientY - rect.top) * (canvas.height / rect.height);

        // Always track start position for tap vs drag detection
        dragStartX = clientX;
        dragStartY = clientY;

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
                    saveToHistory();
                    isDragging = true;
                    draggedEmoji = emojiObj;
                    emojiStartX = emojiObj.x;
                    emojiStartY = emojiObj.y;
                    state.didInteract = true;
                    break;
                }
            }
        }

        // Windowにリスナー追加 (キャンバス外でもドラッグ継続)
        window.addEventListener('mousemove', handleCanvasMove);
        window.addEventListener('mouseup', handleCanvasEnd);
        window.addEventListener('touchmove', handleCanvasMove, { passive: false });
        window.addEventListener('touchend', handleCanvasEnd);
        window.addEventListener('touchcancel', handleCanvasEnd);
    };

    const handleCanvasMove = (e) => {
        if (e.touches) {
            state.maxFingers = Math.max(state.maxFingers, e.touches.length);
            if (e.touches.length >= 2) {
                state.isGestureActive = true;
                isDragging = false; // Cancel drag if pinch starts
            }
        }

        // Multi-touch gesture (Zoom/Rotate Emoji - only in edit mode?)
        // The original code handled emoji scaling via pinch IF an emoji was being dragged?
        // Let's preserve specific logic: "Pinch to zoom/rotate currently dragged emoji" 
        // OR "Pinch to zoom canvas"
        // User requested: "Pinch operation ... also implement pan operation with 2 fingers"
        // And "prevent drawing when pinch".

        // If 2+ fingers, we are in Canvas Pan/Zoom mode (handled by canvasContainer listeners), 
        // OR Emoji manipulation mode.
        // Let's decide: If we are 'dragging' an emoji, maybe allow pinch?
        // But user said "Pinch operation ... drawing disabled".
        // Let's defer 2-finger logic to canvasContainer or specific handler to avoid conflict.

        if (state.isGestureActive) return;

        if (!isDragging || !draggedEmoji) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const delta = Math.hypot(clientX - dragStartX, clientY - dragStartY);
        if (delta > 10) state.didInteract = true;

        const rect = canvas.getBoundingClientRect();
        const deltaX = (clientX - dragStartX) * (canvas.width / rect.width);
        const deltaY = (clientY - dragStartY) * (canvas.height / rect.height);

        draggedEmoji.x = emojiStartX + deltaX;
        draggedEmoji.y = emojiStartY + deltaY;

        redrawCanvas();
        if (e.cancelable) e.preventDefault();
    };

    const handleCanvasEnd = (e) => {
        // Windowからリスナー削除 (すべての指が離れた時のみ)
        if (!e.touches || e.touches.length === 0) {
            window.removeEventListener('mousemove', handleCanvasMove);
            window.removeEventListener('mouseup', handleCanvasEnd);
            window.removeEventListener('touchmove', handleCanvasMove);
            window.removeEventListener('touchend', handleCanvasEnd);
        }

        // Check for Undo/Redo Tap Gestures (on clean release)
        if (e.touches && e.touches.length === 0) {
            // All fingers up
            const duration = Date.now() - state.touchStartTime;

            // Undo: 2 fingers, short tap, no significant interaction
            if (state.maxFingers === 2 && duration < 400 && !state.didInteract) {
                undo();
                // Reset
                state.maxFingers = 0;
                return;
            }
            // Redo: 3 fingers
            if (state.maxFingers === 3 && duration < 400 && !state.didInteract) {
                redo();
                state.maxFingers = 0;
                return;
            }
        }

        // If gesture was active, do nothing
        if (state.isGestureActive || state.maxFingers > 1) {
            // Reset if all fingers up
            if (!e.touches || e.touches.length === 0) {
                state.maxFingers = 0;
                state.isGestureActive = false;
                isDragging = false;
                draggedEmoji = null;
            }
            return;
        }

        if (isDragging && draggedEmoji) {
            // ドラッグ終了
            state.selectedEmoji = draggedEmoji;
            state.editMode = 'edit';
            showEditPanel();
            updateEditPanel();
            updateEditPanel();
            redrawCanvas();
            saveStorage();
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
                    // Check for interaction again just to be safe
                    if (!state.didInteract) {
                        placeEmoji(canvasX, canvasY);
                    }
                    return;
                }

                // 選択モード
                if (state.toolMode === 'select') {
                    if (!state.didInteract) {
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
        }

        isDragging = false;
        draggedEmoji = null;

        // Reset state if all fingers up
        if (!e.touches || e.touches.length === 0) {
            state.maxFingers = 0;
            state.isGestureActive = false;
            state.didInteract = false;
        }
    };

    canvas.addEventListener('mousedown', handleCanvasStart);
    // canvas.addEventListener('mousemove', handleCanvasMove); // Windowで管理
    // canvas.addEventListener('mouseup', handleCanvasEnd);   // Windowで管理
    canvas.addEventListener('touchstart', handleCanvasStart, { passive: false });
    // canvas.addEventListener('touchmove', handleCanvasMove, { passive: false }); // Windowで管理
    // canvas.addEventListener('touchend', handleCanvasEnd);   // Windowで管理

    // 背景切り替え (Color Picker)
    // bgToggleBtn.addEventListener('click', toggleBackground); // Old toggle

    // Trigger color picker
    bgToggleBtn.addEventListener('click', (e) => {
        // If clicking the button (not input), trigger input
        if (e.target !== bgColorPicker) {
            bgColorPicker.click();
        }
    });

    bgColorPicker.addEventListener('input', (e) => {
        state.canvasColor = e.target.value;
        state.bgMode = 'white'; // Force white mode (color mode)
        updateBackground();
        redrawCanvas();
    });

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

    // クリップボードにコピー
    if (copyClipboardBtn) {
        copyClipboardBtn.addEventListener('click', async () => {
            if (!state.selectionRect) return;
            const tempCanvas = createRegionCanvas(state.selectionRect);
            if (tempCanvas) {
                await copyToClipboard(tempCanvas);
            }
        });
    }

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
            updateSelectionSizeDisplay(); // サイズ表示を更新
        });
    });

    // 範囲選択ボタン
    if (confirmSelectionBtn) {
        confirmSelectionBtn.addEventListener('click', () => {
            if (!state.selectionRect) return;
            const tempCanvas = createRegionCanvas(state.selectionRect);
            if (tempCanvas) {
                downloadCanvas(tempCanvas, `emojie-selection-${Date.now()}.png`);
                closeSaveUI();
            }
        });
    }
    // 選択範囲やり直し (削除済み - setupEventListeners内で定義済み)

    // ピンチイン/アウトでキャンバス拡大縮小 + PAN
    let currentScale = 1;
    let initialDistance = 0;
    let initialCenter = { x: 0, y: 0 };
    let initialTranslate = { x: -50, y: -50 }; // CSS starts at -50%, -50%
    // We need to track actual translate pixels if we want smooth pan, 
    // but the CSS uses transform: translate(-50%, -50%) scale(X). 
    // Mixing percentage and pixels is hard. 
    // Let's start tracking pan in pixels relative to center.
    let panX = 0;
    let panY = 0;

    const getDistance = (touch1, touch2) => {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const getCenter = (touch1, touch2) => {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
    };

    // Note: canvasContainer listeners need to coordinate with canvas listeners via state
    canvasContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            initialDistance = getDistance(e.touches[0], e.touches[1]);
            initialCenter = getCenter(e.touches[0], e.touches[1]);
            // Store current pan state?
            // panX/Y persists
        }
    }, { passive: true });

    canvasContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialDistance > 0) {
            const currentDistance = getDistance(e.touches[0], e.touches[1]);
            const currentCenter = getCenter(e.touches[0], e.touches[1]);

            // Zoom
            const scale = currentDistance / initialDistance;
            const newScale = Math.max(0.5, Math.min(3, currentScale * scale)); // apply relative change? Or absolute? 
            // Implementation detail: standard pinch is relative to previous frame or initial. 
            // Here we use absolute tracking from start of gesture?
            // "currentScale" is global.
            // Let's apply change to currentScale.

            // Actually, simplistic approach:
            currentScale = Math.max(0.5, Math.min(3, currentScale * (currentDistance / initialDistance)));

            // Pan
            const dx = currentCenter.x - initialCenter.x;
            const dy = currentCenter.y - initialCenter.y;

            panX += dx;
            panY += dy;

            // Update transform
            // Note: need to maintain -50% offset for centering
            canvasContainer.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${currentScale})`;

            // Reset for next frame so we don't compound zoom explosively if using relative math above
            // But 'currentDistance / initialDistance' is absolute ratio of THIS gesture.
            // So we should NOT update initialDistance if we apply to *accumulated* currentScale?
            // Wait, logic above `currentScale * scale` compounds.
            // Correct way:
            // newScale = startScale * (currDist / startDist).
            // But we didn't save startScale.

            // Let's just do incremental updates (standard web habit)
            initialDistance = currentDistance;
            initialCenter = currentCenter;

            state.didInteract = true; // Mark as interacted so we don't Undo
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
        // Reset pan on zoom? No, keep it.
        canvasContainer.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${currentScale})`;
    }, { passive: false });

    // PC用 パン操作 (スペースキー + ドラッグ / ミドルクリックドラッグ)
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let isSpacePressed = false;

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        // Ignore if user is typing in search box
        if (e.target.id === 'emoji-search') return;

        // Undo: Ctrl/Cmd + Z
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
            e.preventDefault();
            undo();
            return;
        }

        // Redo: Ctrl/Cmd + Shift + Z
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
            e.preventDefault();
            redo();
            return;
        }

        // Delete: Delete or Backspace
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            deleteEmoji();
            return;
        }

        // Mode Switch: X
        if (e.key === 'x' || e.key === 'X') {
            e.preventDefault();
            state.toolMode = state.toolMode === 'draw' ? 'select' : 'draw';
            updateToolModeUI();
            return;
        }

        // Space for panning (existing logic below)
        if (e.code === 'Space') {
            isSpacePressed = true;
            canvasContainer.style.cursor = 'grab';
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            isSpacePressed = false;
            canvasContainer.style.cursor = '';
            if (!isPanning) {
                // Stop panning if key released (optional, but keep panning if mouse still down? usually yes)
            }
        }
    });

    canvasContainer.addEventListener('mousedown', (e) => {
        // e.button: 0 = Left, 1 = Middle
        if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
            e.preventDefault(); // Prevent text selection etc.
            isPanning = true;
            panStartX = e.clientX;
            panStartY = e.clientY;
            canvasContainer.style.cursor = 'grabbing';
            state.didInteract = true; // Prevent drawing on mouseup
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;

        e.preventDefault();
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;

        panX += dx;
        panY += dy;

        canvasContainer.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${currentScale})`;

        panStartX = e.clientX;
        panStartY = e.clientY;
    });

    window.addEventListener('mouseup', (e) => {
        if (isPanning) {
            // Check if button released matches pan trigger? 
            // Simplified: Stop panning on ANY mouseup if panning was active
            isPanning = false;
            canvasContainer.style.cursor = isSpacePressed ? 'grab' : '';
        }
    });
}

// アプリケーション起動
init();
