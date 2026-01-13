// ============================================
// DESU™ Paint - iPad専用版 v4 (GIF振動機能追加)
// ============================================

// デバッグログ機能
const debugLog = document.getElementById('debug-log');
const debugToggle = document.getElementById('debug-toggle');
const debugActivator = document.getElementById('debug-activator');
let debugVisible = false;
let debugButtonVisible = false;
let debugActivatorTimer = null;
let debugToggleTimer = null;

// 左下長押し（500ms）でデバッグボタン表示
debugActivator.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    debugActivatorTimer = setTimeout(() => {
        if (!debugButtonVisible) {
            debugButtonVisible = true;
            debugToggle.classList.add('visible');
        }
        debugActivatorTimer = null;
    }, 500);
});

debugActivator.addEventListener('pointerup', () => {
    if (debugActivatorTimer) {
        clearTimeout(debugActivatorTimer);
        debugActivatorTimer = null;
    }
});

debugActivator.addEventListener('pointercancel', () => {
    if (debugActivatorTimer) {
        clearTimeout(debugActivatorTimer);
        debugActivatorTimer = null;
    }
});

// デバッグボタン：クリック（短押し）でログ表示切り替え、長押し（500ms）でボタン非表示
debugToggle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    debugToggleTimer = setTimeout(() => {
        // 長押し → ボタン非表示
        debugButtonVisible = false;
        debugToggle.classList.remove('visible');
        debugLog.classList.remove('visible');
        debugVisible = false;
        debugToggleTimer = null;
    }, 500);
});

debugToggle.addEventListener('pointerup', () => {
    if (debugToggleTimer) {
        // 短押し → ログ表示切り替え
        clearTimeout(debugToggleTimer);
        debugToggleTimer = null;

        debugVisible = !debugVisible;
        if (debugVisible) {
            debugLog.classList.add('visible');
        } else {
            debugLog.classList.remove('visible');
        }
    }
});

debugToggle.addEventListener('pointercancel', () => {
    if (debugToggleTimer) {
        clearTimeout(debugToggleTimer);
        debugToggleTimer = null;
    }
});

// 元のconsole.logとconsole.errorを保存
const originalLog = console.log;
const originalError = console.error;

function addToDebugLog(message, isError = false) {
    const div = document.createElement('div');
    if (isError) {
        div.style.color = '#f00';
    }
    div.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    debugLog.appendChild(div);
    debugLog.scrollTop = debugLog.scrollHeight;
}

// console.logを上書き
console.log = function(...args) {
    originalLog.apply(console, args);
    const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    addToDebugLog(message, false);
};

// console.errorを上書き
console.error = function(...args) {
    originalError.apply(console, args);
    const message = 'ERROR: ' + args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    addToDebugLog(message, true);
};

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const lassoCanvas = document.getElementById('lasso-canvas');
const lassoCtx = lassoCanvas.getContext('2d');

// --- 状態 ---
let isDarkMode = false;
let currentTool = 'pen';  // 'pen' or 'fill'
let currentColor = 'black';  // 'black' or 'white'
let isDrawing = false;
let lastX = 0, lastY = 0;

// ズーム/パン
let scale = 1;
let translateX = 0, translateY = 0;

// 色ごとのブラシサイズ保持
const colorSizes = { black: 1, white: 5 };

// undo/redo用（ImageBitmap方式）
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 15;

// ポインター管理
let activePointers = new Map();
let pencilDetected = false;

// タップ判定用
let touchStartTime = 0;
let touchStartPos = null;
let maxFingers = 0;
let strokeMade = false;

// ピンチ用
let lastPinchDist = 0;
let lastPinchCenter = { x: 0, y: 0 };
let initialPinchDist = 0;

// 手のひらモード（スペースキー）
let isSpacePressed = false;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panStartTranslateX = 0;
let panStartTranslateY = 0;
let initialPinchCenter = { x: 0, y: 0 };
let isPinching = false;

// 投げ縄用
let lassoPoints = [];
let isLassoing = false;

// 保存モード
let isSaveMode = false;
let selectionStart = null;
let selectionEnd = null;
let confirmedSelection = null;  // 確定した選択範囲 {x, y, w, h}
let selectedAspect = 'free';  // 'free', '1:1', '4:5', '16:9', '9:16'
let selectedScale = 1;        // 1, 2, 3
let selectedNoise = 1;        // 0, 1, 2, 3

// ============================================
// 初期化
// ============================================

function initCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    lassoCanvas.width = window.innerWidth;
    lassoCanvas.height = window.innerHeight;

    const selCanvas = document.getElementById('selection-canvas');
    selCanvas.width = window.innerWidth;
    selCanvas.height = window.innerHeight;

    applyTransform();
    updateColorButton();
    saveState();
}

function applyTransform() {
    canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

    const resetBtn = document.getElementById('resetZoomBtn');
    if (Math.abs(scale - 1) > 0.01 || Math.abs(translateX) > 1 || Math.abs(translateY) > 1) {
        resetBtn.classList.add('visible');
    } else {
        resetBtn.classList.remove('visible');
    }
}

function getCanvasPoint(clientX, clientY) {
    return {
        x: Math.floor((clientX - translateX) / scale),
        y: Math.floor((clientY - translateY) / scale)
    };
}

// 現在の描画色を取得
function getDrawColor() {
    if (currentColor === 'black') {
        return isDarkMode ? '#fff' : '#000';
    } else {
        return isDarkMode ? '#000' : '#fff';
    }
}

// 色ボタンの表示更新
function updateColorButton() {
    const circle = document.getElementById('colorCircle');

    // 黒選択時は塗りつぶし、白選択時は白抜き（ストロークのみ）
    if (currentColor === 'black') {
        circle.classList.add('filled');
        circle.style.stroke = 'none';
    } else {
        circle.classList.remove('filled');
        circle.style.stroke = 'currentColor';
        circle.style.strokeWidth = '2';
    }
}

// ============================================
// 描画エンジン（2値・ブレゼンハム）
// ============================================

function drawLine(x1, y1, x2, y2) {
    const size = colorSizes[currentColor];
    ctx.fillStyle = getDrawColor();

    const r = Math.floor(size / 2);
    let dx = Math.abs(x2 - x1), sx = x1 < x2 ? 1 : -1;
    let dy = -Math.abs(y2 - y1), sy = y1 < y2 ? 1 : -1;
    let err = dx + dy;

    while (true) {
        if (size === 1) {
            ctx.fillRect(x1, y1, 1, 1);
        } else {
            ctx.fillRect(x1 - r, y1 - r, size, size);
        }

        if (x1 === x2 && y1 === y2) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x1 += sx; }
        if (e2 <= dx) { err += dx; y1 += sy; }
    }
}

// ============================================
// 塗りつぶし（スキャンライン法）
// ============================================

function floodFill(startX, startY) {
    const w = canvas.width, h = canvas.height;

    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const idx = (startY * w + startX) * 4;
    const targetR = data[idx], targetG = data[idx + 1], targetB = data[idx + 2];

    // 塗りつぶし色を決定
    const fillColorHex = getDrawColor();
    const fillColor = fillColorHex === '#fff' || fillColorHex === '#FFF'
        ? [255, 255, 255]
        : [0, 0, 0];

    if (targetR === fillColor[0] && targetG === fillColor[1] && targetB === fillColor[2]) return;

    const matchTarget = (i) => data[i] === targetR && data[i + 1] === targetG && data[i + 2] === targetB;
    const setPixel = (i) => {
        data[i] = fillColor[0];
        data[i + 1] = fillColor[1];
        data[i + 2] = fillColor[2];
        data[i + 3] = 255;
    };

    const stack = [[startX, startY]];

    while (stack.length > 0) {
        let [x, y] = stack.pop();
        let i = (y * w + x) * 4;

        while (x >= 0 && matchTarget(i)) {
            x--;
            i -= 4;
        }
        x++;
        i += 4;

        let spanAbove = false, spanBelow = false;

        while (x < w && matchTarget(i)) {
            setPixel(i);

            if (y > 0) {
                const above = i - w * 4;
                if (matchTarget(above)) {
                    if (!spanAbove) {
                        stack.push([x, y - 1]);
                        spanAbove = true;
                    }
                } else {
                    spanAbove = false;
                }
            }

            if (y < h - 1) {
                const below = i + w * 4;
                if (matchTarget(below)) {
                    if (!spanBelow) {
                        stack.push([x, y + 1]);
                        spanBelow = true;
                    }
                } else {
                    spanBelow = false;
                }
            }

            x++;
            i += 4;
        }
    }

    ctx.putImageData(imgData, 0, 0);
}

// ============================================
// 投げ縄塗りつぶし
// ============================================

function startLasso(x, y) {
    isLassoing = true;
    lassoPoints = [{ x, y }];
    lassoCanvas.style.display = 'block';
    lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
}

function updateLasso(x, y) {
    if (!isLassoing) return;

    lassoPoints.push({ x, y });

    // 青い線で軌跡を描画
    lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
    lassoCtx.strokeStyle = '#0066ff';
    lassoCtx.lineWidth = 2;
    lassoCtx.beginPath();
    lassoCtx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
    for (let i = 1; i < lassoPoints.length; i++) {
        lassoCtx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
    }
    // 始点に戻る線（プレビュー）
    lassoCtx.lineTo(lassoPoints[0].x, lassoPoints[0].y);
    lassoCtx.stroke();
}

function finishLasso() {
    if (!isLassoing || lassoPoints.length < 3) {
        isLassoing = false;
        lassoPoints = [];
        lassoCanvas.style.display = 'none';
        return false;
    }

    // 画面座標からキャンバス座標に変換
    const canvasPoints = lassoPoints.map(p => getCanvasPoint(p.x, p.y));

    // 投げ縄の内側を塗りつぶし
    fillPolygon(canvasPoints);

    isLassoing = false;
    lassoPoints = [];
    lassoCanvas.style.display = 'none';
    lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);

    return true;
}

function fillPolygon(points) {
    if (points.length < 3) return;

    ctx.fillStyle = getDrawColor();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();

    // アンチエイリアスで発生した中間色を2値化
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const val = avg > 127 ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);
}

// ============================================
// undo/redo（ImageBitmap方式）
// ============================================

async function saveState() {
    const bitmap = await createImageBitmap(canvas);
    undoStack.push(bitmap);

    if (undoStack.length > MAX_HISTORY) {
        undoStack.shift().close();
    }

    redoStack.forEach(b => b.close());
    redoStack = [];
}

function undo() {
    if (undoStack.length <= 1) return;

    const current = undoStack.pop();
    redoStack.push(current);

    const prev = undoStack[undoStack.length - 1];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(prev, 0, 0);
}

function redo() {
    if (redoStack.length === 0) return;

    const next = redoStack.pop();
    undoStack.push(next);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(next, 0, 0);
}

// ============================================
// GIF生成（ピクセル振動）
// ============================================

function generateGlitchFrames(imgData, transparent, noiseLevel = 1) {
    const w = imgData.width;
    const h = imgData.height;
    const data = imgData.data;

    // 背景色判定用
    const bgR = isDarkMode ? 0 : 255;
    const bgG = isDarkMode ? 0 : 255;
    const bgB = isDarkMode ? 0 : 255;

    // 黒ドット（描画部分）の座標を収集
    const pixels = [];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // 背景色でない = 描画部分
            if (r !== bgR || g !== bgG || b !== bgB) {
                pixels.push({ x, y, r, g, b });
            } else if (Math.random() < 0.05) {
                // 背景の5%にもノイズを適用
                pixels.push({ x, y, r, g, b });
            }
        }
    }

    // シード可能な疑似乱数生成器
    function seededRandom(seed) {
        let x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }

    // ノイズレベルに応じたパーセンテージ設定と動作
    const noiseLevelSettings = {
        1: { mode: 'normal', percentages: [0.1, 0.3, 0.3] },           // 弱: 10%, 30%, 30% (1px移動)
        2: { mode: 'large-offset', percentages: [1.0, 1.0, 1.0] },     // 中: 100% (2-5px移動)
        3: { mode: 'random-position', percentages: [0.7, 0.85, 1.0] }  // 強: 70%, 85%, 100% (完全ランダム配置)
    };
    const noiseSetting = noiseLevelSettings[noiseLevel] || noiseLevelSettings[1];
    const noisePercentages = noiseSetting.percentages;
    const noiseMode = noiseSetting.mode;

    // フレーム生成関数（異なる偏り方とノイズ量）
    function createFrame(seed, distributionMode, noisePercentage = 0.3, glitchMode = 'normal') {
        const frameData = new Uint8ClampedArray(data);
        const frameCopy = new ImageData(frameData, w, h);
        const targetPixels = [...pixels];

        let randomSeed = seed * 1000;

        // モードによって異なる分布方法を使用
        if (distributionMode === 'bottom-bias') {
            // 下側に偏るノイズ（元のsort方式）
            targetPixels.sort(() => seededRandom(randomSeed++) - 0.5);
        } else if (distributionMode === 'uniform') {
            // 均等分布（Fisher-Yatesシャッフル）
            for (let i = targetPixels.length - 1; i > 0; i--) {
                const j = Math.floor(seededRandom(randomSeed++) * (i + 1));
                [targetPixels[i], targetPixels[j]] = [targetPixels[j], targetPixels[i]];
            }
        } else if (distributionMode === 'top-bias') {
            // 上側に偏るノイズ（逆順sort）
            targetPixels.sort(() => 0.5 - seededRandom(randomSeed++));
        }

        // 指定された割合でランダム選択
        const count = Math.floor(pixels.length * noisePercentage);
        const shuffled = targetPixels.slice(0, count);

        if (glitchMode === 'random-position') {
            // レベル3: 完全ランダム配置
            shuffled.forEach(p => {
                const newX = Math.floor(seededRandom(randomSeed++) * w);
                const newY = Math.floor(seededRandom(randomSeed++) * h);

                const oldIdx = (p.y * w + p.x) * 4;
                const newIdx = (newY * w + newX) * 4;

                // 元の位置を背景色で塗りつぶし
                frameData[oldIdx] = bgR;
                frameData[oldIdx + 1] = bgG;
                frameData[oldIdx + 2] = bgB;
                if (transparent) frameData[oldIdx + 3] = 0;

                // 新しい位置に描画
                frameData[newIdx] = p.r;
                frameData[newIdx + 1] = p.g;
                frameData[newIdx + 2] = p.b;
                frameData[newIdx + 3] = 255;
            });
        } else if (glitchMode === 'large-offset') {
            // レベル2: 2～5ピクセルのランダム距離移動
            shuffled.forEach(p => {
                const distance = Math.floor(seededRandom(randomSeed++) * 4) + 2; // 2～5
                const angle = seededRandom(randomSeed++) * Math.PI * 2;
                const offsetX = Math.round(Math.cos(angle) * distance);
                const offsetY = Math.round(Math.sin(angle) * distance);

                const newX = p.x + offsetX;
                const newY = p.y + offsetY;

                if (newX >= 0 && newX < w && newY >= 0 && newY < h) {
                    const oldIdx = (p.y * w + p.x) * 4;
                    const newIdx = (newY * w + newX) * 4;

                    // 元の位置を背景色で塗りつぶし
                    frameData[oldIdx] = bgR;
                    frameData[oldIdx + 1] = bgG;
                    frameData[oldIdx + 2] = bgB;
                    if (transparent) frameData[oldIdx + 3] = 0;

                    // 新しい位置に描画
                    frameData[newIdx] = p.r;
                    frameData[newIdx + 1] = p.g;
                    frameData[newIdx + 2] = p.b;
                    frameData[newIdx + 3] = 255;
                }
            });
        } else {
            // レベル1: 通常の8方向1ピクセル移動
            const offsets = [
                [-1, -1], [0, -1], [1, -1],
                [-1,  0],          [1,  0],
                [-1,  1], [0,  1], [1,  1]
            ];

            shuffled.forEach(p => {
                const offset = offsets[Math.floor(seededRandom(randomSeed++) * offsets.length)];
                const newX = p.x + offset[0];
                const newY = p.y + offset[1];

                if (newX >= 0 && newX < w && newY >= 0 && newY < h) {
                    const oldIdx = (p.y * w + p.x) * 4;
                    const newIdx = (newY * w + newX) * 4;

                    // 元の位置を背景色で塗りつぶし
                    frameData[oldIdx] = bgR;
                    frameData[oldIdx + 1] = bgG;
                    frameData[oldIdx + 2] = bgB;
                    if (transparent) frameData[oldIdx + 3] = 0;

                    // 新しい位置に描画
                    frameData[newIdx] = p.r;
                    frameData[newIdx + 1] = p.g;
                    frameData[newIdx + 2] = p.b;
                    frameData[newIdx + 3] = 255;
                }
            });
        }

        return new ImageData(frameData, w, h);
    }

    // 3フレーム生成（異なる偏り方とノイズ量）
    return [
        createFrame(0.2, 'uniform', noisePercentages[0], noiseMode),      // フレーム1
        createFrame(0.5, 'bottom-bias', noisePercentages[1], noiseMode),  // フレーム2
        createFrame(0.8, 'top-bias', noisePercentages[2], noiseMode)      // フレーム3
    ];
}

async function createGIF(frames, w, h, updateProgress) {
    return new Promise((resolve, reject) => {
        try {
            if (typeof GIF === 'undefined') {
                throw new Error('gif.js が読み込まれていません');
            }

            const gif = new GIF({
                workers: 1,
                quality: 10,
                width: w,
                height: h,
                workerScript: './gif.worker.js'  // 同一オリジン
            });

            console.log('GIF設定:', { workers: 1, quality: 10, width: w, height: h, workerScript: './gif.worker.js' });

            frames.forEach((frameData, index) => {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = w;
                tempCanvas.height = h;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.putImageData(frameData, 0, 0);

                gif.addFrame(tempCanvas, { delay: 50 });
                console.log(`フレーム ${index + 1}/${frames.length} 追加完了`);
            });

            gif.on('progress', (progress) => {
                const percentage = 50 + Math.round(progress * 50);
                console.log('GIF生成進行:', percentage + '%');
                if (updateProgress) {
                    updateProgress(percentage, `GIF変換中... ${percentage}%`);
                }
            });

            gif.on('finished', blob => {
                console.log('GIF生成完了:', blob.size, 'bytes');
                if (updateProgress) {
                    updateProgress(100, '完了！');
                }
                resolve(blob);
            });

            gif.on('error', err => {
                console.error('GIF生成エラー:', err);
                reject(err);
            });

            console.log('GIF render開始');
            gif.render();
        } catch (err) {
            console.error('GIF生成初期化エラー:', err);
            reject(err);
        }
    });
}

// ============================================
// ポインターイベント
// ============================================

canvas.addEventListener('pointerdown', (e) => {
    if (isSaveMode) return;

    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (e.pointerType === 'pen') {
        pencilDetected = true;
    }

    if (activePointers.size === 1) {
        touchStartTime = Date.now();
        touchStartPos = { x: e.clientX, y: e.clientY };
        maxFingers = 1;
        isPinching = false;
        strokeMade = false;
    }
    maxFingers = Math.max(maxFingers, activePointers.size);

    // 2本指 = ピンチ/パン準備
    if (activePointers.size === 2) {
        isDrawing = false;
        isLassoing = false;
        lassoCanvas.style.display = 'none';
        isPinching = false;
        const pts = Array.from(activePointers.values());
        lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        lastPinchCenter = {
            x: (pts[0].x + pts[1].x) / 2,
            y: (pts[0].y + pts[1].y) / 2
        };
        initialPinchDist = lastPinchDist;
        initialPinchCenter = { x: lastPinchCenter.x, y: lastPinchCenter.y };
        return;
    }

    // 手のひらモード（スペースキー押下中）
    if (activePointers.size === 1 && isSpacePressed) {
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panStartTranslateX = translateX;
        panStartTranslateY = translateY;
        canvas.style.cursor = 'grabbing';
        return;
    }

    const canDraw = e.pointerType === 'pen' || e.pointerType === 'mouse' || (e.pointerType === 'touch' && !pencilDetected);

    if (activePointers.size === 1 && canDraw) {
        const p = getCanvasPoint(e.clientX, e.clientY);

        if (currentTool === 'pen') {
            isDrawing = true;
            lastX = p.x;
            lastY = p.y;
            drawLine(p.x, p.y, p.x, p.y);
        } else if (currentTool === 'fill') {
            // バケツツール: タップか投げ縄か、pointerupで判定
            startLasso(e.clientX, e.clientY);
        }
    }
});

canvas.addEventListener('pointermove', (e) => {
    if (!activePointers.has(e.pointerId)) return;
    if (isSaveMode) return;

    e.preventDefault();
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 2本指 = ピンチズーム / パン
    if (activePointers.size === 2) {
        const pts = Array.from(activePointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const center = {
            x: (pts[0].x + pts[1].x) / 2,
            y: (pts[0].y + pts[1].y) / 2
        };

        const distDelta = Math.abs(dist - initialPinchDist);
        const centerDelta = Math.hypot(center.x - initialPinchCenter.x, center.y - initialPinchCenter.y);

        if (distDelta > 10 || centerDelta > 10) {
            isPinching = true;
        }

        if (isPinching) {
            const zoomFactor = dist / lastPinchDist;
            const oldScale = scale;
            scale = Math.max(0.1, Math.min(20, scale * zoomFactor));

            translateX = center.x - (center.x - translateX) * (scale / oldScale);
            translateY = center.y - (center.y - translateY) * (scale / oldScale);

            translateX += center.x - lastPinchCenter.x;
            translateY += center.y - lastPinchCenter.y;

            applyTransform();
        }

        lastPinchDist = dist;
        lastPinchCenter = center;

        return;
    }

    // 手のひらモード（スペースキーでパン）
    if (isPanning && activePointers.size === 1) {
        translateX = panStartTranslateX + (e.clientX - panStartX);
        translateY = panStartTranslateY + (e.clientY - panStartY);
        applyTransform();
        return;
    }

    // 描画
    if (isDrawing && activePointers.size === 1) {
        const p = getCanvasPoint(e.clientX, e.clientY);
        drawLine(lastX, lastY, p.x, p.y);
        lastX = p.x;
        lastY = p.y;
        strokeMade = true;
    }

    // 投げ縄
    if (isLassoing && activePointers.size === 1) {
        updateLasso(e.clientX, e.clientY);
        strokeMade = true;
    }
});

canvas.addEventListener('pointerup', (e) => {
    if (isSaveMode) return;

    e.preventDefault();

    // 手のひらモード終了
    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = isSpacePressed ? 'grab' : '';
    }

    // 描画終了
    if (isDrawing) {
        saveState();
        strokeMade = true;
    }

    // 投げ縄終了
    if (isLassoing) {
        // 移動距離で判定: 短い = タップ、長い = 投げ縄
        const startP = lassoPoints[0];
        const totalDist = lassoPoints.reduce((acc, p, i) => {
            if (i === 0) return 0;
            const prev = lassoPoints[i - 1];
            return acc + Math.hypot(p.x - prev.x, p.y - prev.y);
        }, 0);

        if (totalDist < 20) {
            // タップ = 通常の塗りつぶし
            const p = getCanvasPoint(startP.x, startP.y);
            floodFill(p.x, p.y);
            saveState();
            strokeMade = true;
        } else {
            // 投げ縄塗りつぶし
            if (finishLasso()) {
                saveState();
                strokeMade = true;
            }
        }

        isLassoing = false;
        lassoPoints = [];
        lassoCanvas.style.display = 'none';
        lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
    }

    activePointers.delete(e.pointerId);

    // 全指離した時のタップ判定
    if (activePointers.size === 0) {
        const duration = Date.now() - touchStartTime;

        if (maxFingers >= 2 && duration < 400 && !isPinching && !strokeMade) {
            if (maxFingers === 2) undo();
            if (maxFingers === 3) redo();
        }

        maxFingers = 0;
        touchStartPos = null;
        strokeMade = false;
        isPinching = false;
    }

    isDrawing = false;
});

canvas.addEventListener('pointercancel', (e) => {
    activePointers.delete(e.pointerId);
    isDrawing = false;
    isLassoing = false;
    isPinching = false;
    lassoCanvas.style.display = 'none';
});

// ============================================
// UIイベント
// ============================================

// ツール切り替え
document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
        currentTool = btn.dataset.tool;
        document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// 色切り替え
document.getElementById('colorBtn').addEventListener('click', () => {
    currentColor = currentColor === 'black' ? 'white' : 'black';
    updateColorButton();

    // サイズを色に応じて復元
    document.getElementById('brushSize').value = colorSizes[currentColor];
    document.getElementById('sizeDisplay').textContent = colorSizes[currentColor];
});

// ブラシサイズ
document.getElementById('brushSize').addEventListener('input', (e) => {
    const size = parseInt(e.target.value);
    colorSizes[currentColor] = size;
    document.getElementById('sizeDisplay').textContent = size;
});

// ノイズ生成
document.getElementById('noiseBtn').addEventListener('click', () => {
    // ノイズレベルは1固定（重ねがけで調整可能）
    const noiseLevel = 1;

    // 現在のキャンバスから画像データを取得
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // ノイズフレームを生成（背景透過なし）
    const frames = generateGlitchFrames(imgData, false, noiseLevel);

    // 最初のフレームをキャンバスに描画
    ctx.putImageData(frames[0], 0, 0);

    // undo履歴に追加
    saveState();
});

// クリア
document.getElementById('clearBtn').addEventListener('click', () => {
    ctx.fillStyle = isDarkMode ? '#000' : '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
});

// 反転
document.getElementById('invertBtn').addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark');
    document.body.classList.toggle('light');

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
    }
    ctx.putImageData(imgData, 0, 0);

    updateColorButton();
    saveState();
});

// ズームリセット
document.getElementById('resetZoomBtn').addEventListener('click', () => {
    scale = 1;
    translateX = 0;
    translateY = 0;
    applyTransform();
});

// ============================================
// クレジット機能とヘルプモード
// ============================================

document.getElementById('credit-btn').addEventListener('click', (e) => {
    e.stopPropagation(); // イベント伝播を止める
    document.getElementById('credit-modal').classList.add('visible');
    // ヘルプモード有効化（ツールチップ表示）
    document.body.classList.add('help-mode');
});

// モーダル背景クリックで閉じる
document.getElementById('credit-modal').addEventListener('click', (e) => {
    if (e.target.id === 'credit-modal') {
        document.getElementById('credit-modal').classList.remove('visible');
        // ヘルプモード無効化
        document.body.classList.remove('help-mode');
    }
});

// ヘルプモード時、モーダル外（ツールバーや？ボタン含む）のクリックで復帰
document.addEventListener('click', (e) => {
    if (!document.body.classList.contains('help-mode')) return;

    const modal = document.getElementById('credit-modal');
    const creditContent = document.getElementById('credit-content');

    // credit-content内のクリックは無視
    if (creditContent.contains(e.target)) return;

    // それ以外の場所（ツール、？ボタン、モーダル背景など）ならヘルプモード解除
    e.preventDefault();
    e.stopPropagation();
    modal.classList.remove('visible');
    document.body.classList.remove('help-mode');
}, true); // キャプチャフェーズで処理（ツールボタンのリスナーより先に実行）

// ============================================
// 保存機能
// ============================================

// 縦横比選択
document.querySelectorAll('[data-aspect]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-aspect]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedAspect = btn.dataset.aspect;
    });
});

// 倍率選択
document.querySelectorAll('[data-scale]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-scale]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedScale = parseInt(btn.dataset.scale);
    });
});

// ノイズ強度選択
document.querySelectorAll('[data-noise]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-noise]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedNoise = parseInt(btn.dataset.noise);
    });
});

// 背景透過チェックボックスの変更監視
document.getElementById('transparentBg').addEventListener('change', (e) => {
    const isTransparent = e.target.checked;
    const noiseButtons = document.querySelectorAll('[data-noise]');

    if (isTransparent) {
        // 背景透過ON: ノイズ1/2/3を無効化
        noiseButtons.forEach(btn => {
            const noiseValue = parseInt(btn.dataset.noise);
            if (noiseValue > 0) {
                btn.classList.add('disabled');
            }
        });

        // 現在の選択がノイズ1/2/3の場合、自動的にノイズ0に切り替え
        if (selectedNoise > 0) {
            selectedNoise = 0;
            noiseButtons.forEach(b => b.classList.remove('active'));
            document.querySelector('[data-noise="0"]').classList.add('active');
        }
    } else {
        // 背景透過OFF: すべてのノイズボタンを有効化
        noiseButtons.forEach(btn => {
            btn.classList.remove('disabled');
        });
    }
});

document.getElementById('saveBtn').addEventListener('click', () => {
    isSaveMode = true;
    document.getElementById('save-overlay').style.display = 'block';
    document.getElementById('save-ui').style.display = 'block';
    document.getElementById('selection-canvas').style.display = 'block';
    document.getElementById('toolbar-left').style.display = 'none';
    document.getElementById('toolbar-right').style.display = 'none';
    document.getElementById('resetZoomBtn').style.display = 'none';
});

function exitSaveMode() {
    isSaveMode = false;
    document.getElementById('save-overlay').style.display = 'none';
    document.getElementById('save-ui').style.display = 'none';
    document.getElementById('save-ui').classList.remove('hidden-during-selection');
    document.getElementById('save-ui').classList.remove('in-confirmation-mode');
    document.getElementById('selection-canvas').style.display = 'none';
    document.getElementById('generating').style.display = 'none';
    document.getElementById('toolbar-left').style.display = 'flex';
    document.getElementById('toolbar-right').style.display = 'flex';
    document.getElementById('resetZoomBtn').style.display = '';  // インラインスタイルをクリア
    document.getElementById('confirmSelectionBtn').style.display = 'none';
    document.getElementById('copySelectionBtn').style.display = 'none';
    document.getElementById('redoSelectionBtn').style.display = 'none';
    applyTransform();

    const selCanvas = document.getElementById('selection-canvas');
    const selCtx = selCanvas.getContext('2d');
    selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);

    selectionStart = null;
    selectionEnd = null;
    confirmedSelection = null;
}

document.getElementById('cancelSaveBtn').addEventListener('click', exitSaveMode);

document.getElementById('saveAllBtn').addEventListener('click', () => {
    saveRegion(0, 0, canvas.width, canvas.height);
});

document.getElementById('confirmSelectionBtn').addEventListener('click', () => {
    if (confirmedSelection) {
        saveRegion(confirmedSelection.x, confirmedSelection.y, confirmedSelection.w, confirmedSelection.h);
    }
});

document.getElementById('copySelectionBtn').addEventListener('click', async () => {
    if (!confirmedSelection) return;

    const btn = document.getElementById('copySelectionBtn');
    const originalText = btn.textContent;

    try {
        const { x, y, w, h } = confirmedSelection;
        const transparent = document.getElementById('transparentBg').checked;
        const outputScale = selectedScale;

        // 出力サイズ
        const outputW = w * outputScale;
        const outputH = h * outputScale;

        // 一時キャンバスを作成
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = outputW;
        tempCanvas.height = outputH;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.imageSmoothingEnabled = false;

        if (transparent) {
            const imgData = ctx.getImageData(x, y, w, h);
            const data = imgData.data;
            const bgR = isDarkMode ? 0 : 255;
            const bgG = isDarkMode ? 0 : 255;
            const bgB = isDarkMode ? 0 : 255;

            for (let i = 0; i < data.length; i += 4) {
                if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
                    data[i + 3] = 0;
                }
            }

            const sourceCanvas = document.createElement('canvas');
            sourceCanvas.width = w;
            sourceCanvas.height = h;
            sourceCanvas.getContext('2d').putImageData(imgData, 0, 0);
            tempCtx.drawImage(sourceCanvas, 0, 0, outputW, outputH);
        } else {
            tempCtx.drawImage(canvas, x, y, w, h, 0, 0, outputW, outputH);
        }

        // Safari/iPadでの互換性のためにClipboardItemにPromiseを渡す
        await navigator.clipboard.write([
            new ClipboardItem({
                'image/png': new Promise((resolve, reject) => {
                    tempCanvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Blob generation failed'));
                    }, 'image/png');
                })
            })
        ]);

        // ボタンのテキストを変更
        btn.textContent = 'コピーしました！';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 1500);
    } catch (err) {
        console.error('クリップボードへのコピーエラー:', err);
        btn.textContent = 'コピー失敗';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 1500);
    }
});

document.getElementById('redoSelectionBtn').addEventListener('click', () => {
    // 選択範囲をクリア
    confirmedSelection = null;

    // 確定モードを解除
    document.getElementById('save-ui').classList.remove('in-confirmation-mode');

    // ボタンを非表示
    document.getElementById('confirmSelectionBtn').style.display = 'none';
    document.getElementById('copySelectionBtn').style.display = 'none';
    document.getElementById('redoSelectionBtn').style.display = 'none';

    // 選択矩形をクリア
    const selCanvas = document.getElementById('selection-canvas');
    const selCtx = selCanvas.getContext('2d');
    selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
});

const overlay = document.getElementById('save-overlay');

overlay.addEventListener('pointerdown', (e) => {
    if (!isSaveMode) return;
    selectionStart = { x: e.clientX, y: e.clientY };
    selectionEnd = { x: e.clientX, y: e.clientY };

    // 範囲選択開始時にモーダルを非表示
    document.getElementById('save-ui').classList.add('hidden-during-selection');
});

overlay.addEventListener('pointermove', (e) => {
    if (!isSaveMode || !selectionStart) return;
    selectionEnd = { x: e.clientX, y: e.clientY };

    const selCanvas = document.getElementById('selection-canvas');
    const selCtx = selCanvas.getContext('2d');
    selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);

    // 縦横比に基づいて矩形を調整
    let rectX = selectionStart.x;
    let rectY = selectionStart.y;
    let rectW = selectionEnd.x - selectionStart.x;
    let rectH = selectionEnd.y - selectionStart.y;

    if (selectedAspect !== 'free') {
        const aspectRatios = {
            '1:1': 1 / 1,
            '4:5': 4 / 5,
            '16:9': 16 / 9,
            '9:16': 9 / 16
        };
        const ratio = aspectRatios[selectedAspect];

        // 符号を保存
        const signW = rectW < 0 ? -1 : 1;
        const signH = rectH < 0 ? -1 : 1;

        // 幅と高さの短い方を基準にして縦横比を維持
        if (Math.abs(rectW) / Math.abs(rectH) > ratio) {
            // 幅が長すぎる → 高さに合わせる
            rectW = Math.abs(rectH) * ratio * signW;
        } else {
            // 高さが長すぎる → 幅に合わせる
            rectH = Math.abs(rectW) / ratio * signH;
        }
    }

    selCtx.strokeStyle = isDarkMode ? '#fff' : '#000';
    selCtx.lineWidth = 2;
    selCtx.setLineDash([8, 8]);
    selCtx.strokeRect(rectX, rectY, rectW, rectH);
});

overlay.addEventListener('pointerup', (e) => {
    if (!isSaveMode || !selectionStart) return;

    // 縦横比に基づいて矩形を調整（pointermoveと同じロジック）
    let rectX = selectionStart.x;
    let rectY = selectionStart.y;
    let rectW = selectionEnd.x - selectionStart.x;
    let rectH = selectionEnd.y - selectionStart.y;

    if (selectedAspect !== 'free') {
        const aspectRatios = {
            '1:1': 1 / 1,
            '4:5': 4 / 5,
            '16:9': 16 / 9,
            '9:16': 9 / 16
        };
        const ratio = aspectRatios[selectedAspect];

        // 符号を保存
        const signW = rectW < 0 ? -1 : 1;
        const signH = rectH < 0 ? -1 : 1;

        if (Math.abs(rectW) / Math.abs(rectH) > ratio) {
            rectW = Math.abs(rectH) * ratio * signW;
        } else {
            rectH = Math.abs(rectW) / ratio * signH;
        }
    }

    const x1 = Math.floor((Math.min(rectX, rectX + rectW) - translateX) / scale);
    const y1 = Math.floor((Math.min(rectY, rectY + rectH) - translateY) / scale);
    const x2 = Math.floor((Math.max(rectX, rectX + rectW) - translateX) / scale);
    const y2 = Math.floor((Math.max(rectY, rectY + rectH) - translateY) / scale);

    const w = x2 - x1;
    const h = y2 - y1;

    if (w > 5 && h > 5) {
        const cx = Math.max(0, Math.min(x1, canvas.width));
        const cy = Math.max(0, Math.min(y1, canvas.height));
        const cw = Math.min(w, canvas.width - cx);
        const ch = Math.min(h, canvas.height - cy);

        if (cw > 0 && ch > 0) {
            // 選択範囲を確定（保存はしない）
            confirmedSelection = { x: cx, y: cy, w: cw, h: ch };

            // 確定モードに入る
            document.getElementById('save-ui').classList.add('in-confirmation-mode');
            document.getElementById('save-ui').classList.remove('hidden-during-selection');

            // 確定・コピー・やり直しボタンを表示
            document.getElementById('confirmSelectionBtn').style.display = 'inline-block';
            document.getElementById('copySelectionBtn').style.display = 'inline-block';
            document.getElementById('redoSelectionBtn').style.display = 'inline-block';
        }
    }

    selectionStart = null;
    selectionEnd = null;
});

async function saveRegion(x, y, w, h) {
    const transparent = document.getElementById('transparentBg').checked;
    const noiseLevel = selectedNoise;  // 0, 1, 2, 3
    const outputScale = selectedScale;  // 1, 2, 3

    const flash = document.getElementById('flash');
    flash.style.opacity = '0.7';
    setTimeout(() => { flash.style.opacity = '0'; }, 100);

    let blob, fileName;

    try {
        if (noiseLevel > 0) {
            // GIF生成
            document.getElementById('generating').style.display = 'block';

            // プログレスバーをリセット
            const progressFill = document.getElementById('progress-fill');
            const progressText = document.getElementById('progress-text');

            function updateProgress(percent, text) {
                if (progressFill) progressFill.style.width = percent + '%';
                if (progressText) progressText.textContent = text;
            }

            console.log('GIF保存開始:', { x, y, w, h, transparent });

            updateProgress(0, '準備中...');
            await new Promise(resolve => setTimeout(resolve, 100)); // UI更新を待つ

            updateProgress(10, '画像データ読み込み中...');
            const imgData = ctx.getImageData(x, y, w, h);
            console.log('画像データ取得:', imgData.width, 'x', imgData.height);
            await new Promise(resolve => setTimeout(resolve, 50));

            // 背景透過処理
            if (transparent) {
                updateProgress(20, '背景透過処理中...');
                const data = imgData.data;
                const bgR = isDarkMode ? 0 : 255;
                const bgG = isDarkMode ? 0 : 255;
                const bgB = isDarkMode ? 0 : 255;

                for (let i = 0; i < data.length; i += 4) {
                    if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
                        data[i + 3] = 0;
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            updateProgress(30, 'グリッチフレーム生成中...');
            await new Promise(resolve => setTimeout(resolve, 50));

            const frames = generateGlitchFrames(imgData, transparent, noiseLevel);
            console.log('グリッチフレーム生成完了:', frames.length, 'フレーム');

            updateProgress(50, 'GIF変換中...');

            // 倍率を適用した出力サイズ
            const outputW = w * outputScale;
            const outputH = h * outputScale;

            // フレームを拡大
            const scaledFrames = frames.map(frameData => {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = w;
                tempCanvas.height = h;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.putImageData(frameData, 0, 0);

                const scaledCanvas = document.createElement('canvas');
                scaledCanvas.width = outputW;
                scaledCanvas.height = outputH;
                const scaledCtx = scaledCanvas.getContext('2d');
                scaledCtx.imageSmoothingEnabled = false;  // ピクセル感を維持
                scaledCtx.drawImage(tempCanvas, 0, 0, outputW, outputH);

                return scaledCtx.getImageData(0, 0, outputW, outputH);
            });

            blob = await createGIF(scaledFrames, outputW, outputH, updateProgress);
            fileName = `desu_${Date.now()}.gif`;
            console.log('GIF生成完了');

            document.getElementById('generating').style.display = 'none';
        } else {
            // PNG生成（ノイズ0の静止画）
            const outputW = w * outputScale;
            const outputH = h * outputScale;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = outputW;
            tempCanvas.height = outputH;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.imageSmoothingEnabled = false;  // ピクセル感を維持

            if (transparent) {
                const imgData = ctx.getImageData(x, y, w, h);
                const data = imgData.data;
                const bgR = isDarkMode ? 0 : 255;
                const bgG = isDarkMode ? 0 : 255;
                const bgB = isDarkMode ? 0 : 255;

                for (let i = 0; i < data.length; i += 4) {
                    if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
                        data[i + 3] = 0;
                    }
                }

                // 拡大して描画
                const sourceCanvas = document.createElement('canvas');
                sourceCanvas.width = w;
                sourceCanvas.height = h;
                sourceCanvas.getContext('2d').putImageData(imgData, 0, 0);
                tempCtx.drawImage(sourceCanvas, 0, 0, outputW, outputH);
            } else {
                tempCtx.drawImage(canvas, x, y, w, h, 0, 0, outputW, outputH);
            }

            blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png'));
            fileName = `desu_${Date.now()}.png`;
        }

        // iOS Safari対応：download属性で直接ダウンロード
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => URL.revokeObjectURL(url), 1000);

        exitSaveMode();
    } catch (err) {
        console.error('保存エラー:', err);
        document.getElementById('generating').style.display = 'none';

        const progressText = document.getElementById('progress-text');
        if (progressText) {
            progressText.textContent = 'エラー: ' + err.message;
        }

        setTimeout(() => {
            alert('保存に失敗しました。コンソールを確認してください。\nエラー: ' + err.message);
            exitSaveMode();
        }, 500);
    }
}

// ============================================
// 画面回転対応
// ============================================

window.addEventListener('orientationchange', () => {
    setTimeout(async () => {
        const bitmap = await createImageBitmap(canvas);

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        lassoCanvas.width = window.innerWidth;
        lassoCanvas.height = window.innerHeight;

        ctx.fillStyle = isDarkMode ? '#000' : '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();

        const selCanvas = document.getElementById('selection-canvas');
        selCanvas.width = window.innerWidth;
        selCanvas.height = window.innerHeight;

        applyTransform();
    }, 100);
});

// ============================================
// キーボードショートカット
// ============================================

document.addEventListener('keydown', (e) => {
    // 保存モード中は無効（スペースキーを除く）
    if (isSaveMode && e.key !== ' ') return;

    // スペースキー: 手のひらモード開始
    if (e.key === ' ' && !isSpacePressed) {
        e.preventDefault();
        isSpacePressed = true;
        if (!isPanning) {
            canvas.style.cursor = 'grab';
        }
        return;
    }

    // Cmd/Ctrl + S: 保存モード
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        document.getElementById('saveBtn').click();
        return;
    }

    // Cmd/Ctrl + Shift + Z: Redo
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
        return;
    }

    // Cmd/Ctrl + Y: Redo（代替ショートカット）
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'y') {
        e.preventDefault();
        redo();
        return;
    }

    // Cmd/Ctrl + Z: Undo
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
    }

    // 以下、修飾キーなしのショートカット
    // 修飾キーが押されている場合はスキップ
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    switch(e.key.toLowerCase()) {
        case 'b':
            // ペンツール（Photoshop準拠）
            document.getElementById('penBtn').click();
            break;

        case 'g':
            // 塗りつぶしツール
            document.getElementById('fillBtn').click();
            break;

        case 'e':
            // 消しゴム（背景色に切り替え + ペンツール）
            const eraserColor = isDarkMode ? 'black' : 'white';
            if (currentColor !== eraserColor) {
                document.getElementById('colorBtn').click();
            }
            if (currentTool !== 'pen') {
                document.getElementById('penBtn').click();
            }
            break;

        case 'x':
            // 色切り替え
            document.getElementById('colorBtn').click();
            break;

        case 'd':
            // デフォルトカラー（黒に戻す）
            if (currentColor !== 'black') {
                document.getElementById('colorBtn').click();
            }
            break;

        case '[':
            // ブラシサイズ縮小
            {
                const currentSize = colorSizes[currentColor];
                if (currentSize > 1) {
                    const newSize = currentSize - 1;
                    colorSizes[currentColor] = newSize;
                    document.getElementById('brushSize').value = newSize;
                    document.getElementById('sizeDisplay').textContent = newSize;
                }
            }
            break;

        case ']':
            // ブラシサイズ拡大
            {
                const currentSize = colorSizes[currentColor];
                if (currentSize < 20) {
                    const newSize = currentSize + 1;
                    colorSizes[currentColor] = newSize;
                    document.getElementById('brushSize').value = newSize;
                    document.getElementById('sizeDisplay').textContent = newSize;
                }
            }
            break;

        case 'tab':
            // ツールバー表示/非表示
            e.preventDefault();
            const toolbarLeft = document.getElementById('toolbar-left');
            const toolbarRight = document.getElementById('toolbar-right');
            const creditBtn = document.getElementById('credit-btn');

            if (toolbarLeft.style.display === 'none') {
                toolbarLeft.style.display = 'flex';
                toolbarRight.style.display = 'flex';
                creditBtn.style.display = 'flex';
            } else {
                toolbarLeft.style.display = 'none';
                toolbarRight.style.display = 'none';
                creditBtn.style.display = 'none';
            }
            break;

        case 'delete':
        case 'backspace':
            // クリア
            e.preventDefault();
            document.getElementById('clearBtn').click();
            break;

        case 'i':
            // 反転
            document.getElementById('invertBtn').click();
            break;

        case 'n':
            // ノイズ
            document.getElementById('noiseBtn').click();
            break;
    }
});

document.addEventListener('keyup', (e) => {
    // スペースキー: 手のひらモード終了
    if (e.key === ' ') {
        e.preventDefault();
        isSpacePressed = false;
        isPanning = false;
        canvas.style.cursor = '';
    }
});

// ============================================
// 起動
// ============================================

initCanvas();
