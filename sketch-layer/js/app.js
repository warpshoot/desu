// ============================================
// DESU™ Paint - iPad専用版 v5 (レイヤー機能追加)
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

// レイヤーcanvas
const roughCanvas = document.getElementById('canvas-rough');
const roughCtx = roughCanvas.getContext('2d', { willReadFrequently: true });
const lineCanvas = document.getElementById('canvas-line');
const lineCtx = lineCanvas.getContext('2d', { willReadFrequently: true });
const lassoCanvas = document.getElementById('lasso-canvas');
const lassoCtx = lassoCanvas.getContext('2d');

// --- 状態 ---
let currentTool = 'pen';  // 'sketch', 'pen', or 'eraser'
let activeLayer = 'line';   // 'rough' or 'line'

// レイヤー表示状態
let roughVisible = true;
let lineVisible = true;
let roughOpacity = 1.0;
let lineOpacity = 1.0;

// ズーム/パン
let scale = 1;
let translateX = 0, translateY = 0;

// undo/redo用（ImageBitmap方式）- レイヤーごと
let roughUndoStack = [];
let roughRedoStack = [];
let lineUndoStack = [];
let lineRedoStack = [];
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
let initialPinchCenter = { x: 0, y: 0 };
let isPinching = false;

// 手のひらモード（スペースキー）
let isSpacePressed = false;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panStartTranslateX = 0;
let panStartTranslateY = 0;

// 投げ縄用
let lassoPoints = [];
let isLassoing = false;

// ペンツール用
let isPenDrawing = false;
let lastPenPoint = null;
let isErasing = false;  // 消しゴムモードフラグ

// 保存モード
let isSaveMode = false;
let selectionStart = null;
let selectionEnd = null;
let confirmedSelection = null;  // 確定した選択範囲 {x, y, w, h}
let selectedAspect = 'free';  // 'free', '1:1', '4:5', '16:9', '9:16'
let selectedScale = 1;        // 1, 2, 3

// ============================================
// 初期化
// ============================================

async function initCanvas() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    console.log('Initializing canvas:', w, 'x', h);

    // 白背景の初期化
    const canvasBg = document.getElementById('canvas-background');
    canvasBg.style.width = w + 'px';
    canvasBg.style.height = h + 'px';

    // アタリレイヤー初期化
    roughCanvas.width = w;
    roughCanvas.height = h;
    roughCtx.fillStyle = '#fff';
    roughCtx.fillRect(0, 0, w, h);

    // ペン入れレイヤー初期化（透明）
    lineCanvas.width = w;
    lineCanvas.height = h;
    lineCtx.clearRect(0, 0, w, h);

    console.log('Canvas initialized - rough:', roughCanvas.width, 'x', roughCanvas.height);
    console.log('Canvas initialized - line:', lineCanvas.width, 'x', lineCanvas.height);

    // その他のcanvas
    lassoCanvas.width = w;
    lassoCanvas.height = h;

    const selCanvas = document.getElementById('selection-canvas');
    selCanvas.width = w;
    selCanvas.height = h;

    applyTransform();

    // 両方のレイヤーの初期状態を保存
    const roughBitmap = await createImageBitmap(roughCanvas);
    roughUndoStack.push(roughBitmap);
    const lineBitmap = await createImageBitmap(lineCanvas);
    lineUndoStack.push(lineBitmap);
}

function applyTransform() {
    const transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    const canvasBg = document.getElementById('canvas-background');
    canvasBg.style.transform = transform;
    roughCanvas.style.transform = transform;
    lineCanvas.style.transform = transform;

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


// ============================================
// 塗りつぶし（スキャンライン法）
// ============================================

function floodFill(startX, startY, fillColor) {
    // アクティブレイヤーに応じたcanvasとctxを選択
    const canvas = activeLayer === 'rough' ? roughCanvas : lineCanvas;
    const ctx = activeLayer === 'rough' ? roughCtx : lineCtx;

    const w = canvas.width, h = canvas.height;

    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const idx = (startY * w + startX) * 4;
    const targetR = data[idx], targetG = data[idx + 1], targetB = data[idx + 2], targetA = data[idx + 3];

    if (targetR === fillColor[0] && targetG === fillColor[1] && targetB === fillColor[2] && targetA === fillColor[3]) return;

    const matchTarget = (i) => data[i] === targetR && data[i + 1] === targetG && data[i + 2] === targetB && data[i + 3] === targetA;
    const setPixel = (i) => {
        data[i] = fillColor[0];
        data[i + 1] = fillColor[1];
        data[i + 2] = fillColor[2];
        data[i + 3] = fillColor[3];
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

// 透明で塗りつぶし（ペン入れレイヤー用）
function floodFillTransparent(startX, startY) {
    const canvas = lineCanvas;
    const ctx = lineCtx;

    const w = canvas.width, h = canvas.height;

    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const idx = (startY * w + startX) * 4;
    const targetR = data[idx], targetG = data[idx + 1], targetB = data[idx + 2], targetA = data[idx + 3];

    // 既に透明の場合は何もしない
    if (targetA === 0) return;

    const matchTarget = (i) => data[i] === targetR && data[i + 1] === targetG && data[i + 2] === targetB && data[i + 3] === targetA;
    const setPixel = (i) => {
        data[i + 3] = 0;  // alpha = 0 (透明)
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

// 投げ縄で透明塗りつぶし（ペン入れレイヤーの消しゴム用）
function fillPolygonTransparent(points) {
    if (points.length < 3) {
        console.log('fillPolygonTransparent: Not enough points');
        return;
    }

    const ctx = lineCtx;
    console.log('fillPolygonTransparent: points=', points.length);

    const bounds = getBounds(points);
    console.log('fillPolygonTransparent: bounds=', bounds);

    if (bounds.width <= 0 || bounds.height <= 0) {
        console.log('fillPolygonTransparent: Invalid bounds, skipping');
        return;
    }

    const imgData = ctx.getImageData(bounds.minX, bounds.minY, bounds.width, bounds.height);
    const data = imgData.data;
    let pixelsErased = 0;

    for (let py = 0; py < bounds.height; py++) {
        for (let px = 0; px < bounds.width; px++) {
            const canvasX = bounds.minX + px;
            const canvasY = bounds.minY + py;

            if (isPointInPolygon(canvasX, canvasY, points)) {
                const i = (py * bounds.width + px) * 4;
                // Set alpha to 0 (transparent)
                data[i + 3] = 0;
                pixelsErased++;
            }
        }
    }

    console.log('fillPolygonTransparent: Erased', pixelsErased, 'pixels');
    ctx.putImageData(imgData, bounds.minX, bounds.minY);
    console.log('fillPolygonTransparent: putImageData complete');
}

// ============================================
// 投げ縄塗りつぶし
// ============================================

function startLasso(x, y) {
    isLassoing = true;
    lassoPoints = [{ x, y }];
    lassoCanvas.style.display = 'block';
    lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
    console.log('startLasso at:', x, y, 'currentTool:', currentTool);
}

function updateLasso(x, y) {
    if (!isLassoing) return;

    lassoPoints.push({ x, y });
    if (lassoPoints.length % 10 === 0) {
        console.log('updateLasso - total points:', lassoPoints.length);
    }

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

function fillPolygon(points, color) {
    if (points.length < 3) return;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();
}

function getBounds(points) {
    // アクティブレイヤーのcanvasサイズを取得
    const canvas = activeLayer === 'rough' ? roughCanvas : lineCanvas;

    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.max(0, Math.floor(Math.min(...xs)) - 1);
    const minY = Math.max(0, Math.floor(Math.min(...ys)) - 1);
    const maxX = Math.min(canvas.width, Math.ceil(Math.max(...xs)) + 1);
    const maxY = Math.min(canvas.height, Math.ceil(Math.max(...ys)) + 1);

    console.log('getBounds: canvas size=', canvas.width, 'x', canvas.height, 'bounds=', {minX, minY, width: maxX - minX, height: maxY - minY});

    return {
        minX,
        minY,
        width: maxX - minX,
        height: maxY - minY
    };
}

// Point-in-polygon test (ray casting algorithm)
function isPointInPolygon(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x, yi = points[i].y;
        const xj = points[j].x, yj = points[j].y;

        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// Fill polygon with transparency, no anti-aliasing (pixel-by-pixel)
function fillPolygonNoAA(points, r, g, b, alpha) {
    if (points.length < 3) {
        console.log('fillPolygonNoAA: Not enough points');
        return;
    }

    // アクティブレイヤーに応じたctxを選択
    const ctx = activeLayer === 'rough' ? roughCtx : lineCtx;
    console.log('fillPolygonNoAA: activeLayer=', activeLayer, 'points=', points.length, 'color=', r, g, b, alpha);

    const bounds = getBounds(points);
    console.log('fillPolygonNoAA: bounds=', bounds);

    if (bounds.width <= 0 || bounds.height <= 0) {
        console.log('fillPolygonNoAA: Invalid bounds, skipping');
        return;
    }

    const imgData = ctx.getImageData(bounds.minX, bounds.minY, bounds.width, bounds.height);
    const data = imgData.data;
    let pixelsFilled = 0;

    for (let py = 0; py < bounds.height; py++) {
        for (let px = 0; px < bounds.width; px++) {
            const canvasX = bounds.minX + px;
            const canvasY = bounds.minY + py;

            if (isPointInPolygon(canvasX, canvasY, points)) {
                const i = (py * bounds.width + px) * 4;

                // Alpha blend: new = old * (1 - alpha) + new * alpha
                data[i] = data[i] * (1 - alpha) + r * alpha;
                data[i + 1] = data[i + 1] * (1 - alpha) + g * alpha;
                data[i + 2] = data[i + 2] * (1 - alpha) + b * alpha;
                // Alpha channel stays at 255 (opaque)
                pixelsFilled++;
            }
        }
    }

    console.log('fillPolygonNoAA: Filled', pixelsFilled, 'pixels');
    ctx.putImageData(imgData, bounds.minX, bounds.minY);
    console.log('fillPolygonNoAA: putImageData complete');
}

// ============================================
// ペンツール描画
// ============================================

function startPenDrawing(x, y) {
    isPenDrawing = true;
    lastPenPoint = { x, y };
    console.log('startPenDrawing:', x, y);
}

function drawPenLine(x, y) {
    if (!isPenDrawing || !lastPenPoint) return;

    const brushSizeEl = document.getElementById('brushSize');
    const brushSize = brushSizeEl ? parseFloat(brushSizeEl.value) : 3;

    console.log('drawPenLine: from', lastPenPoint, 'to', {x, y}, 'brushSize=', brushSize, 'isErasing=', isErasing);

    lineCtx.lineWidth = brushSize;
    lineCtx.lineCap = 'round';
    lineCtx.lineJoin = 'round';

    if (isErasing) {
        // 消しゴムモード: destination-outで透明にする
        lineCtx.globalCompositeOperation = 'destination-out';
        lineCtx.strokeStyle = 'rgba(0,0,0,1)';  // 色は何でもいい、alphaが重要
        lineCtx.globalAlpha = 1.0;
    } else {
        // 通常のペンモード
        lineCtx.globalCompositeOperation = 'source-over';
        lineCtx.strokeStyle = '#000000';
        lineCtx.globalAlpha = 1.0;
    }

    lineCtx.beginPath();
    lineCtx.moveTo(lastPenPoint.x, lastPenPoint.y);
    lineCtx.lineTo(x, y);
    lineCtx.stroke();

    // globalCompositeOperationを元に戻す
    lineCtx.globalCompositeOperation = 'source-over';

    lastPenPoint = { x, y };
}

function endPenDrawing() {
    if (isPenDrawing) {
        isPenDrawing = false;
        lastPenPoint = null;
        saveState();
    }
}

// ============================================
// undo/redo（ImageBitmap方式）- レイヤーごと
// ============================================

async function saveState() {
    // アクティブレイヤーの状態を保存
    if (activeLayer === 'rough') {
        const bitmap = await createImageBitmap(roughCanvas);
        roughUndoStack.push(bitmap);
        console.log('Saved rough layer state - stack size:', roughUndoStack.length);

        if (roughUndoStack.length > MAX_HISTORY) {
            roughUndoStack.shift().close();
        }

        roughRedoStack.forEach(b => b.close());
        roughRedoStack = [];
    } else if (activeLayer === 'line') {
        const bitmap = await createImageBitmap(lineCanvas);
        lineUndoStack.push(bitmap);
        console.log('Saved line layer state - stack size:', lineUndoStack.length);

        if (lineUndoStack.length > MAX_HISTORY) {
            lineUndoStack.shift().close();
        }

        lineRedoStack.forEach(b => b.close());
        lineRedoStack = [];
    }
}

function undo() {
    if (activeLayer === 'rough') {
        console.log('Undo rough layer - stack size:', roughUndoStack.length);
        if (roughUndoStack.length <= 1) {
            console.log('Cannot undo - at initial state');
            return;
        }

        const current = roughUndoStack.pop();
        roughRedoStack.push(current);

        const prev = roughUndoStack[roughUndoStack.length - 1];
        roughCtx.clearRect(0, 0, roughCanvas.width, roughCanvas.height);
        roughCtx.drawImage(prev, 0, 0);
        console.log('Undo complete - new stack size:', roughUndoStack.length);
    } else if (activeLayer === 'line') {
        console.log('Undo line layer - stack size:', lineUndoStack.length);
        if (lineUndoStack.length <= 1) {
            console.log('Cannot undo - at initial state');
            return;
        }

        const current = lineUndoStack.pop();
        lineRedoStack.push(current);

        const prev = lineUndoStack[lineUndoStack.length - 1];
        lineCtx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
        lineCtx.drawImage(prev, 0, 0);
        console.log('Undo complete - new stack size:', lineUndoStack.length);
    }
}

function redo() {
    if (activeLayer === 'rough') {
        if (roughRedoStack.length === 0) return;

        const next = roughRedoStack.pop();
        roughUndoStack.push(next);

        roughCtx.clearRect(0, 0, roughCanvas.width, roughCanvas.height);
        roughCtx.drawImage(next, 0, 0);
    } else if (activeLayer === 'line') {
        if (lineRedoStack.length === 0) return;

        const next = lineRedoStack.pop();
        lineUndoStack.push(next);

        lineCtx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
        lineCtx.drawImage(next, 0, 0);
    }
}

// ============================================
// GIF生成（ピクセル振動）
// ============================================


// ============================================
// ポインターイベント
// ============================================

lineCanvas.addEventListener('pointerdown', (e) => {
    if (isSaveMode) return;

    e.preventDefault();
    lineCanvas.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    console.log('pointerdown - id:', e.pointerId, 'activePointers.size:', activePointers.size, 'type:', e.pointerType);

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
        lineCanvas.style.cursor = 'grabbing';
        return;
    }

    const canDraw = e.pointerType === 'pen' || e.pointerType === 'mouse' || (e.pointerType === 'touch' && !pencilDetected);

    if (activePointers.size === 1 && canDraw) {
        if (currentTool === 'pen') {
            // ペンツール: 線を描画
            const p = getCanvasPoint(e.clientX, e.clientY);
            isErasing = false;
            startPenDrawing(p.x, p.y);
        } else {
            // スケッチツールと消しゴム: 投げ縄
            startLasso(e.clientX, e.clientY);
        }
    }
});

lineCanvas.addEventListener('pointermove', (e) => {
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

    // ペンツール描画
    if (isPenDrawing && activePointers.size === 1) {
        const p = getCanvasPoint(e.clientX, e.clientY);
        drawPenLine(p.x, p.y);
        strokeMade = true;
    }

    // 投げ縄
    if (isLassoing && activePointers.size === 1) {
        updateLasso(e.clientX, e.clientY);
        strokeMade = true;
    }
});

lineCanvas.addEventListener('pointerup', (e) => {
    if (isSaveMode) return;

    e.preventDefault();

    console.log('pointerup - id:', e.pointerId, 'activePointers.size before delete:', activePointers.size);

    // 手のひらモード終了
    if (isPanning) {
        isPanning = false;
        lineCanvas.style.cursor = isSpacePressed ? 'grab' : '';
    }

    // ペンツール描画終了
    if (isPenDrawing) {
        endPenDrawing();
    }

    // 投げ縄終了
    if (isLassoing) {
        console.log('Lasso ending - points:', lassoPoints.length, 'currentTool:', currentTool, 'activeLayer:', activeLayer);

        // 移動距離で判定: 短い = タップ、長い = 投げ縄
        if (lassoPoints.length === 0) {
            console.log('No lasso points - canceling');
            isLassoing = false;
            lassoCanvas.style.display = 'none';
            lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
        } else {
            const startP = lassoPoints[0];
            const totalDist = lassoPoints.reduce((acc, p, i) => {
                if (i === 0) return 0;
                const prev = lassoPoints[i - 1];
                return acc + Math.hypot(p.x - prev.x, p.y - prev.y);
            }, 0);

            console.log('Lasso distance:', totalDist);

            if (totalDist < 20) {
                // タップ = 塗りつぶし (eraser tool only)
                if (currentTool === 'eraser') {
                    const p = getCanvasPoint(startP.x, startP.y);
                    console.log('FloodFill at:', p);
                    if (activeLayer === 'line') {
                        // ペン入れレイヤー: 透明で塗りつぶし
                        floodFillTransparent(p.x, p.y);
                    } else {
                        // アタリレイヤー: 白で塗りつぶし
                        floodFill(p.x, p.y, [255, 255, 255, 255]);
                    }
                    saveState();
                    strokeMade = true;
                }
                // スケッチツールでのタップは何もしない
            } else {
                // 投げ縄塗りつぶし
                const canvasPoints = lassoPoints.map(p => getCanvasPoint(p.x, p.y));

                console.log('Canvas points:', canvasPoints.length);

                if (canvasPoints.length >= 3) {
                    if (currentTool === 'sketch') {
                        // 20%透明度のグレー、アンチエイリアスなし
                        console.log('Filling polygon with sketch tool');
                        fillPolygonNoAA(canvasPoints, 128, 128, 128, 0.2);
                        saveState();
                        strokeMade = true;
                    } else if (currentTool === 'eraser') {
                        console.log('Filling polygon with eraser tool');
                        if (activeLayer === 'line') {
                            // ペン入れレイヤー: 透明で塗りつぶし
                            fillPolygonTransparent(canvasPoints);
                        } else {
                            // アタリレイヤー: 白で塗りつぶし
                            fillPolygonNoAA(canvasPoints, 255, 255, 255, 1.0);
                        }
                        saveState();
                        strokeMade = true;
                    }
                } else {
                    console.log('Not enough canvas points:', canvasPoints.length);
                }
            }

            isLassoing = false;
            lassoPoints = [];
            lassoCanvas.style.display = 'none';
            lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
        }
    }

    activePointers.delete(e.pointerId);
    console.log('pointerup - activePointers.size after delete:', activePointers.size, 'pointerId:', e.pointerId);

    // 安全装置: 1本指操作完了時にactivePointersが残っている場合は強制クリア
    // （maxFingers/strokeMadeをリセットする前にチェック）
    const wasOneFingerDrawing = maxFingers === 1 && strokeMade;

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
    } else if (wasOneFingerDrawing && activePointers.size > 0) {
        // 1本指で描画したのにまだポインターが残っている = バグ
        console.log('WARNING: Single-finger drawing ended but activePointers still has', activePointers.size, 'pointers. Remaining IDs:', Array.from(activePointers.keys()), 'Force clearing.');
        activePointers.clear();
        maxFingers = 0;
        touchStartPos = null;
        strokeMade = false;
        isPinching = false;
    }
});

lineCanvas.addEventListener('pointercancel', (e) => {
    activePointers.delete(e.pointerId);
    isLassoing = false;
    isPenDrawing = false;
    isPinching = false;
    lassoCanvas.style.display = 'none';
});

// ============================================
// UIイベント
// ============================================

// アクティブレイヤーのUI表示を更新（消しゴム使用時）
function updateActiveLayerIndicator() {
    const sketchBtn = document.getElementById('sketchBtn');
    const penBtn = document.getElementById('penBtn');

    // 消しゴム使用時のみアクティブレイヤーを視覚的に表示
    if (currentTool === 'eraser') {
        if (activeLayer === 'rough') {
            sketchBtn.classList.add('layer-active');
            penBtn.classList.remove('layer-active');
        } else if (activeLayer === 'line') {
            penBtn.classList.add('layer-active');
            sketchBtn.classList.remove('layer-active');
        }
    } else {
        // 消しゴム以外の時はlayer-activeを削除
        sketchBtn.classList.remove('layer-active');
        penBtn.classList.remove('layer-active');
    }
}

// ブラシサイズスライダーの表示/非表示を更新
function updateBrushSizeVisibility() {
    const sizeSlider = document.getElementById('size-slider-container');
    if (!sizeSlider) return;

    // ペンツール選択時のみ表示
    if (currentTool === 'pen') {
        sizeSlider.classList.remove('hidden');
    } else {
        sizeSlider.classList.add('hidden');
    }
}

// レイヤーを切り替え（消しゴム以外の場合はツールも自動切り替え）
function switchLayer(newLayer) {
    if (activeLayer === newLayer) return;

    activeLayer = newLayer;

    // 消しゴム以外の場合、レイヤーに応じてツールを自動切り替え
    if (currentTool !== 'eraser') {
        if (activeLayer === 'rough') {
            currentTool = 'sketch';
            document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
            document.getElementById('sketchBtn').classList.add('active');
        } else if (activeLayer === 'line') {
            currentTool = 'pen';
            document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
            document.getElementById('penBtn').classList.add('active');
        }
    }

    updateActiveLayerIndicator();
    updateBrushSizeVisibility();
    console.log('Layer switched to:', activeLayer, 'Tool:', currentTool);
}

// ツール切り替えと不透明度スライダー切り替え
document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
        const wasActive = btn.classList.contains('active');
        const newTool = btn.dataset.tool;

        // 同じツールを再度クリック→不透明度スライダーの表示切り替え
        if (wasActive && newTool !== 'eraser') {
            const containerId = newTool === 'sketch' ? 'roughOpacityContainer' : 'lineOpacityContainer';
            const container = document.getElementById(containerId);
            if (container) {
                container.classList.toggle('visible');
            }
            return;
        }

        // 別のツールに切り替え→すべてのスライダーを非表示
        document.querySelectorAll('.opacity-slider-container').forEach(c => {
            c.classList.remove('visible');
        });

        currentTool = newTool;

        // ツールに応じてアクティブレイヤーを切り替え
        if (btn.dataset.layer) {
            activeLayer = btn.dataset.layer;
        }
        // 消しゴムは現在のアクティブレイヤーを維持

        document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // UI更新
        updateActiveLayerIndicator();
        updateBrushSizeVisibility();
    });
});

// クリア
document.getElementById('clearBtn').addEventListener('click', () => {
    // アクティブレイヤーをクリア
    if (activeLayer === 'rough') {
        roughCtx.fillStyle = '#fff';
        roughCtx.fillRect(0, 0, roughCanvas.width, roughCanvas.height);
    } else if (activeLayer === 'line') {
        lineCtx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
    }
    saveState();
});

// レイヤー表示/非表示
const roughVisibleBtn = document.getElementById('roughVisibleBtn');
const lineVisibleBtn = document.getElementById('lineVisibleBtn');

if (roughVisibleBtn) {
    roughVisibleBtn.addEventListener('click', () => {
        roughVisible = !roughVisible;
        roughCanvas.style.display = roughVisible ? 'block' : 'none';
        roughVisibleBtn.classList.toggle('hidden', !roughVisible);
    });
}

if (lineVisibleBtn) {
    lineVisibleBtn.addEventListener('click', () => {
        lineVisible = !lineVisible;
        lineCanvas.style.display = lineVisible ? 'block' : 'none';
        lineVisibleBtn.classList.toggle('hidden', !lineVisible);
    });
}

// レイヤー不透明度
const roughOpacityInput = document.getElementById('roughOpacity');
const lineOpacityInput = document.getElementById('lineOpacity');

if (roughOpacityInput) {
    roughOpacityInput.addEventListener('input', (e) => {
        roughOpacity = parseFloat(e.target.value) / 100;
        roughCanvas.style.opacity = roughOpacity;
    });
}

if (lineOpacityInput) {
    lineOpacityInput.addEventListener('input', (e) => {
        lineOpacity = parseFloat(e.target.value) / 100;
        lineCanvas.style.opacity = lineOpacity;
    });
}

// ブラシサイズ
const brushSizeInput = document.getElementById('brushSize');
const sizeDisplay = document.getElementById('sizeDisplay');

if (brushSizeInput && sizeDisplay) {
    brushSizeInput.addEventListener('input', (e) => {
        sizeDisplay.textContent = e.target.value;
    });
}

// レイヤーコントロールパネルは削除済み（ツールバーに統合）

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


document.getElementById('saveBtn').addEventListener('click', () => {
    isSaveMode = true;
    document.getElementById('save-overlay').style.display = 'block';
    document.getElementById('save-ui').style.display = 'block';
    document.getElementById('selection-canvas').style.display = 'block';
    document.getElementById('toolbar-left').style.display = 'none';
    document.getElementById('toolbar-right').style.display = 'none';
    document.getElementById('layer-controls').style.display = 'none';
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
    document.getElementById('layer-controls').style.display = 'flex';
    document.getElementById('resetZoomBtn').style.display = '';  // インラインスタイルをクリア
    document.getElementById('confirmSelectionBtn').style.display = 'none';
    document.getElementById('copyClipboardBtn').style.display = 'none';
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
    saveRegion(0, 0, roughCanvas.width, roughCanvas.height);
});

document.getElementById('confirmSelectionBtn').addEventListener('click', () => {
    if (confirmedSelection) {
        saveRegion(confirmedSelection.x, confirmedSelection.y, confirmedSelection.w, confirmedSelection.h);
    }
});

document.getElementById('copyClipboardBtn').addEventListener('click', async () => {
    if (confirmedSelection) {
        await copyToClipboard(confirmedSelection.x, confirmedSelection.y, confirmedSelection.w, confirmedSelection.h);
    }
});

document.getElementById('redoSelectionBtn').addEventListener('click', () => {
    // 選択範囲をクリア
    confirmedSelection = null;

    // 確定モードを解除
    document.getElementById('save-ui').classList.remove('in-confirmation-mode');

    // ボタンを非表示
    document.getElementById('confirmSelectionBtn').style.display = 'none';
    document.getElementById('copyClipboardBtn').style.display = 'none';
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

    selCtx.strokeStyle = '#000';
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
        const cx = Math.max(0, Math.min(x1, roughCanvas.width));
        const cy = Math.max(0, Math.min(y1, roughCanvas.height));
        const cw = Math.min(w, roughCanvas.width - cx);
        const ch = Math.min(h, roughCanvas.height - cy);

        if (cw > 0 && ch > 0) {
            // 選択範囲を確定（保存はしない）
            confirmedSelection = { x: cx, y: cy, w: cw, h: ch };

            // 確定モードに入る
            document.getElementById('save-ui').classList.add('in-confirmation-mode');
            document.getElementById('save-ui').classList.remove('hidden-during-selection');

            // 確定・やり直し・コピーボタンを表示
            document.getElementById('confirmSelectionBtn').style.display = 'inline-block';
            document.getElementById('copyClipboardBtn').style.display = 'inline-block';
            document.getElementById('redoSelectionBtn').style.display = 'inline-block';
        }
    }

    selectionStart = null;
    selectionEnd = null;
});

async function saveRegion(x, y, w, h) {
    const transparent = document.getElementById('transparentBg').checked;
    const includeRough = document.getElementById('includeRough').checked;
    const outputScale = selectedScale;

    const flash = document.getElementById('flash');
    flash.style.opacity = '0.7';
    setTimeout(() => { flash.style.opacity = '0'; }, 100);

    try {
        const outputW = w * outputScale;
        const outputH = h * outputScale;

        // レイヤーを合成した一時canvas
        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = w;
        mergedCanvas.height = h;
        const mergedCtx = mergedCanvas.getContext('2d');
        mergedCtx.imageSmoothingEnabled = false;

        // アタリを含める場合は、アタリレイヤーを描画
        if (includeRough) {
            mergedCtx.drawImage(roughCanvas, x, y, w, h, 0, 0, w, h);
        } else if (!transparent) {
            // アタリを含めない & 背景不透過の場合、白背景を塗る
            mergedCtx.fillStyle = '#fff';
            mergedCtx.fillRect(0, 0, w, h);
        }

        // ペン入れレイヤーを描画
        mergedCtx.drawImage(lineCanvas, x, y, w, h, 0, 0, w, h);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = outputW;
        tempCanvas.height = outputH;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.imageSmoothingEnabled = false;

        if (transparent) {
            const imgData = mergedCtx.getImageData(0, 0, w, h);
            const data = imgData.data;

            for (let i = 0; i < data.length; i += 4) {
                if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) {
                    data[i + 3] = 0;
                }
            }

            const sourceCanvas = document.createElement('canvas');
            sourceCanvas.width = w;
            sourceCanvas.height = h;
            sourceCanvas.getContext('2d').putImageData(imgData, 0, 0);
            tempCtx.drawImage(sourceCanvas, 0, 0, outputW, outputH);
        } else {
            tempCtx.drawImage(mergedCanvas, 0, 0, outputW, outputH);
        }

        const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png'));
        const fileName = 'desu_sketch_' + Date.now() + '.png';

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
        alert('保存に失敗しました: ' + err.message);
        exitSaveMode();
    }
}

async function copyToClipboard(x, y, w, h) {
    const transparent = document.getElementById('transparentBg').checked;
    const includeRough = document.getElementById('includeRough').checked;
    const outputScale = selectedScale;

    const flash = document.getElementById('flash');
    flash.style.opacity = '0.7';
    setTimeout(() => { flash.style.opacity = '0'; }, 100);

    try {
        const outputW = w * outputScale;
        const outputH = h * outputScale;

        // レイヤーを合成した一時canvas
        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = w;
        mergedCanvas.height = h;
        const mergedCtx = mergedCanvas.getContext('2d');
        mergedCtx.imageSmoothingEnabled = false;

        // アタリを含める場合は、アタリレイヤーを描画
        if (includeRough) {
            mergedCtx.drawImage(roughCanvas, x, y, w, h, 0, 0, w, h);
        } else if (!transparent) {
            // アタリを含めない & 背景不透過の場合、白背景を塗る
            mergedCtx.fillStyle = '#fff';
            mergedCtx.fillRect(0, 0, w, h);
        }

        // ペン入れレイヤーを描画
        mergedCtx.drawImage(lineCanvas, x, y, w, h, 0, 0, w, h);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = outputW;
        tempCanvas.height = outputH;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.imageSmoothingEnabled = false;

        if (transparent) {
            const imgData = mergedCtx.getImageData(0, 0, w, h);
            const data = imgData.data;

            for (let i = 0; i < data.length; i += 4) {
                if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) {
                    data[i + 3] = 0;
                }
            }

            const sourceCanvas = document.createElement('canvas');
            sourceCanvas.width = w;
            sourceCanvas.height = h;
            sourceCanvas.getContext('2d').putImageData(imgData, 0, 0);
            tempCtx.drawImage(sourceCanvas, 0, 0, outputW, outputH);
        } else {
            tempCtx.drawImage(mergedCanvas, 0, 0, outputW, outputH);
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

        // コピー成功のフィードバック（ボタンテキストを一時的に変更）
        const copyBtn = document.getElementById('copyClipboardBtn');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'コピーしました！';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 1500);

        // モーダルは閉じない
    } catch (err) {
        console.error('クリップボードコピーエラー:', err);
        alert('クリップボードへのコピーに失敗しました: ' + err.message);
    }
}

// ============================================
// 画面回転対応
// ============================================

window.addEventListener('orientationchange', () => {
    setTimeout(async () => {
        // 両方のレイヤーの現在の状態を保存
        const roughBitmap = await createImageBitmap(roughCanvas);
        const lineBitmap = await createImageBitmap(lineCanvas);

        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;

        // アタリレイヤーをリサイズ
        roughCanvas.width = newWidth;
        roughCanvas.height = newHeight;
        roughCtx.fillStyle = '#fff';
        roughCtx.fillRect(0, 0, newWidth, newHeight);
        roughCtx.drawImage(roughBitmap, 0, 0);
        roughBitmap.close();

        // ペン入れレイヤーをリサイズ
        lineCanvas.width = newWidth;
        lineCanvas.height = newHeight;
        lineCtx.drawImage(lineBitmap, 0, 0);
        lineBitmap.close();

        // その他のcanvasもリサイズ
        lassoCanvas.width = newWidth;
        lassoCanvas.height = newHeight;

        const selCanvas = document.getElementById('selection-canvas');
        selCanvas.width = newWidth;
        selCanvas.height = newHeight;

        applyTransform();
    }, 100);
});

// ============================================
// キーボードショートカット
// ============================================

document.addEventListener('keydown', (e) => {
    // 保存UIやモーダル表示中は無効（スペースキーを除く）
    if (e.key !== ' ' && (document.getElementById('save-ui').style.display === 'block' ||
        document.getElementById('credit-modal').classList.contains('visible'))) {
        return;
    }

    // スペースキー: 手のひらモード開始
    if (e.key === ' ' && !isSpacePressed) {
        e.preventDefault();
        isSpacePressed = true;
        if (!isPanning) {
            lineCanvas.style.cursor = 'grab';
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
        case '1':
            // アタリレイヤーをアクティブに
            switchLayer('rough');
            break;

        case '2':
            // ペン入れレイヤーをアクティブに
            switchLayer('line');
            break;

        case 'b':
            // スケッチツール（アタリ）
            document.getElementById('sketchBtn').click();
            break;

        case 'p':
            // ペンツール
            document.getElementById('penBtn').click();
            break;

        case 'e':
            // 消しゴム
            document.getElementById('eraserBtn').click();
            break;

        case 'delete':
        case 'backspace':
            // クリア
            e.preventDefault();
            document.getElementById('clearBtn').click();
            break;
    }
});

document.addEventListener('keyup', (e) => {
    // スペースキー: 手のひらモード終了
    if (e.key === ' ') {
        e.preventDefault();
        isSpacePressed = false;
        isPanning = false;
        lineCanvas.style.cursor = '';
    }
});

// ============================================
// 起動
// ============================================

initCanvas();
updateActiveLayerIndicator();
updateBrushSizeVisibility();
