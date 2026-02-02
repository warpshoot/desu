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
    selectionRect: null
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

    // 背景モードを初期化
    updateBackground();

    // 初期描画
    redrawCanvas();
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

// 編集パネルを表示
function showEditPanel() {
    editPanel.classList.remove('hidden');
    placeEmojiBtn.textContent = state.editMode === 'new' ? '配置' : '完了';
    deleteEmojiBtn.style.display = state.editMode === 'edit' ? 'block' : 'none';
    layerControls.style.display = state.editMode === 'edit' ? 'flex' : 'none';
}

// 編集パネルを非表示
function hideEditPanel() {
    editPanel.classList.add('hidden');
    state.selectedEmoji = null;
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
        state.currentSize = state.selectedEmoji.size;
        state.currentRotation = state.selectedEmoji.rotation;
    }

    sizeValue.textContent = Math.round(state.currentSize) + 'px';
    rotationValue.textContent = Math.round(state.currentRotation) + '°';

    // プレビューのスタイルを更新
    emojiPreview.style.fontSize = state.currentSize + 'px';
    emojiPreview.style.transform = `rotate(${state.currentRotation}deg)`;
}

// キャンバスに絵文字を配置
function placeEmoji() {
    if (state.editMode === 'new') {
        // 新規配置
        const newEmoji = {
            id: state.nextId++,
            emoji: state.currentEmoji,
            x: canvas.width / 2,
            y: canvas.height / 2,
            size: state.currentSize,
            rotation: state.currentRotation,
            zIndex: state.canvasEmojis.length
        };
        state.canvasEmojis.push(newEmoji);
    } else if (state.editMode === 'edit' && state.selectedEmoji) {
        // 既存の絵文字を更新
        state.selectedEmoji.size = state.currentSize;
        state.selectedEmoji.rotation = state.currentRotation;
    }

    hideEditPanel();
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
    state.selectionMode = false;
}

function closeSaveUI() {
    saveOverlay.classList.remove('active');
    saveUI.classList.remove('active');
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
    saveUI.querySelector('h3').textContent = 'キャンバス全体を保存するか、範囲を選択してください';

    let startX, startY;
    let isDrawing = false;

    const handleStart = (e) => {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
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

        // 絵文字自体を検索（部分一致）
        const filtered = allEmojis.filter(emoji => emoji.includes(query));
        displayEmojis(filtered);
    });

    // スライダー
    sizeSlider.addEventListener('input', (e) => {
        state.currentSize = parseInt(e.target.value);
        updateEditPanel();
    });

    rotationSlider.addEventListener('input', (e) => {
        state.currentRotation = parseInt(e.target.value);
        updateEditPanel();
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

    // キャンバスドラッグ&ドロップ
    let isDragging = false;
    let draggedEmoji = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let emojiStartX = 0;
    let emojiStartY = 0;

    const handleCanvasStart = (e) => {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const rect = canvas.getBoundingClientRect();
        const canvasX = (clientX - rect.left) * (canvas.width / rect.width);
        const canvasY = (clientY - rect.top) * (canvas.height / rect.height);

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
                e.preventDefault();
                return;
            }
        }
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
        e.preventDefault();
    };

    const handleCanvasEnd = (e) => {
        if (isDragging && draggedEmoji) {
            // ドラッグが微小な場合は選択として扱う
            const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
            const distance = Math.sqrt(
                Math.pow(clientX - dragStartX, 2) + Math.pow(clientY - dragStartY, 2)
            );

            if (distance < 10) {
                // クリック/タップとして扱う
                state.selectedEmoji = draggedEmoji;
                state.editMode = 'edit';
                showEditPanel();
                updateEditPanel();
                redrawCanvas();
            }
        }

        isDragging = false;
        draggedEmoji = null;
    };

    canvas.addEventListener('mousedown', handleCanvasStart);
    canvas.addEventListener('mousemove', handleCanvasMove);
    canvas.addEventListener('mouseup', handleCanvasEnd);
    canvas.addEventListener('touchstart', handleCanvasStart, { passive: false });
    canvas.addEventListener('touchmove', handleCanvasMove, { passive: false });
    canvas.addEventListener('touchend', handleCanvasEnd);

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
            const x = Math.max(0, (rect.x - canvasRect.left) * (canvas.width / canvasRect.width));
            const y = Math.max(0, (rect.y - canvasRect.top) * (canvas.height / canvasRect.height));
            const w = Math.min(canvas.width - x, rect.width * (canvas.width / canvasRect.width));
            const h = Math.min(canvas.height - y, rect.height * (canvas.height / canvasRect.height));

            if (w <= 0 || h <= 0) {
                alert('選択範囲が無効です');
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
