import { state, getActiveLayerCtx, strokeCanvas, strokeCtx } from '../state.js';
import { drawBrushSegment } from '../brushes.js';

let strokePoints = [];      // 生の入力点列
let smoothedPoints = [];    // スムージング済みの点列 (描画に使用)
let lastDrawnIndex = 0;
let _strokeOpacity = 1.0;
let _usingStrokeCanvas = false;

// 手ぶれ補正 (糸引きスタビライザー) の状態
let _stabAnchorX = 0;  // ブラシの実際の位置 (カーソルより遅れる)
let _stabAnchorY = 0;

// 筆圧スムージング用リングバッファ (5点ウィンドウ平均)
const PRESSURE_WINDOW = 5;
let pressureBuffer = [];

// 消しゴム時は eraserSize を使う専用ブラシを返す
function _getDrawBrush() {
    if (state.isErasing) {
        return { ...state.activeBrush, size: state.eraserSize, pressureSize: true };
    }
    return state.activeBrush;
}

/**
 * 筆圧のウィンドウ平均スムージング
 * 直近N点の加重移動平均で筆圧ノイズを除去
 */
function _smoothPressure(rawPressure) {
    pressureBuffer.push(rawPressure);
    if (pressureBuffer.length > PRESSURE_WINDOW) {
        pressureBuffer.shift();
    }
    // 新しい値ほど重みが大きい加重平均
    let sum = 0, weightSum = 0;
    for (let i = 0; i < pressureBuffer.length; i++) {
        const w = i + 1; // 1,2,3,4,5
        sum += pressureBuffer[i] * w;
        weightSum += w;
    }
    return sum / weightSum;
}

/**
 * Catmull-Rom スプライン補間で滑らかな点列を生成
 * 入力点 p0,p1,p2,p3 間の p1→p2 区間を subdivisions 分割して返す
 */
function _catmullRomSegment(p0, p1, p2, p3, subdivisions) {
    const result = [];
    for (let i = 1; i <= subdivisions; i++) {
        const t = i / subdivisions;
        const t2 = t * t;
        const t3 = t2 * t;

        // Catmull-Rom 行列 (tension=0, uniform)
        const x = 0.5 * (
            (2 * p1.x) +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );
        const y = 0.5 * (
            (2 * p1.y) +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );
        const pressure = 0.5 * (
            (2 * p1.pressure) +
            (-p0.pressure + p2.pressure) * t +
            (2 * p0.pressure - 5 * p1.pressure + 4 * p2.pressure - p3.pressure) * t2 +
            (-p0.pressure + 3 * p1.pressure - 3 * p2.pressure + p3.pressure) * t3
        );

        result.push({ x, y, pressure: Math.max(0, Math.min(1, pressure)) });
    }
    return result;
}

/**
 * 生の入力点列から Catmull-Rom 補間済みの滑らかな点列を生成
 * fromRawIdx: この生インデックス以降のセグメントを補間
 * returns: 新たに追加された smoothedPoints のインデックス範囲
 */
function _rebuildSmoothedPoints(fromRawIdx) {
    const raw = strokePoints;
    if (raw.length < 2) {
        smoothedPoints = [...raw];
        return;
    }

    // 2値ピクセルモードの場合は補間しない (ピクセルパーフェクト維持)
    const brush = _getDrawBrush();
    if (brush.binary) {
        smoothedPoints = [...raw];
        return;
    }

    // fromRawIdx が 0 または 1 のときは全体を再構築
    const startIdx = Math.max(1, fromRawIdx);
    if (startIdx <= 1) {
        smoothedPoints = [raw[0]];
    }

    for (let i = startIdx; i < raw.length; i++) {
        // Catmull-Rom は4点必要: p0, p1, p2, p3
        // セグメント p1→p2 を補間
        const p0 = raw[Math.max(0, i - 2)];
        const p1 = raw[i - 1];
        const p2 = raw[i];
        const p3 = raw[Math.min(raw.length - 1, i + 1)];

        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        // 距離に応じた分割数 (短い区間は少ない分割でOK)
        const subdivisions = Math.max(2, Math.min(8, Math.ceil(dist / 3)));

        const interpolated = _catmullRomSegment(p0, p1, p2, p3, subdivisions);
        smoothedPoints.push(...interpolated);
    }
}

export function startPenDrawing(x, y, pressure = 0.5) {
    state.isPenDrawing = true;
    pressureBuffer = [];
    const smoothedP = _smoothPressure(pressure);
    strokePoints = [{ x, y, pressure: smoothedP }];
    smoothedPoints = [{ x, y, pressure: smoothedP }];
    lastDrawnIndex = 0;

    // 手ぶれ補正: アンカーをカーソル位置で初期化
    _stabAnchorX = x;
    _stabAnchorY = y;

    const brush = _getDrawBrush();
    _strokeOpacity = brush.opacity ?? 1.0;
    _usingStrokeCanvas = !state.isErasing && !!strokeCanvas && !!strokeCtx;

    if (_usingStrokeCanvas) {
        strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
        strokeCanvas.style.opacity = _strokeOpacity;
        drawBrushSegment(strokeCtx, smoothedPoints, 0, true, brush, false);
    } else {
        const ctx = getActiveLayerCtx();
        if (!ctx) return;
        drawBrushSegment(ctx, smoothedPoints, 0, true, brush, state.isErasing);
    }
}

export function drawPenLine(x, y, pressure = 0.5) {
    if (!state.isPenDrawing) return;

    const brush = _getDrawBrush();

    // 手ぶれ補正 (糸引きスタビライザー)
    // カーソルがアンカーから stabilizerDistance 以上離れたときのみアンカーを移動
    if (brush.stabilizerEnabled && !state.isErasing) {
        const stabDist = brush.stabilizerDistance ?? 20;
        const dx = x - _stabAnchorX;
        const dy = y - _stabAnchorY;
        const d = Math.hypot(dx, dy);
        if (d <= stabDist) return; // ブラシは動かない
        const ratio = (d - stabDist) / d;
        _stabAnchorX += dx * ratio;
        _stabAnchorY += dy * ratio;
        x = _stabAnchorX;
        y = _stabAnchorY;
    }

    const lastPoint = strokePoints[strokePoints.length - 1];
    const dist = Math.hypot(x - lastPoint.x, y - lastPoint.y);
    if (dist < 0.5) return;

    // 5点ウィンドウ加重移動平均で筆圧スムージング
    const smoothedP = _smoothPressure(pressure);

    const prevRawLen = strokePoints.length;
    strokePoints.push({ x, y, pressure: smoothedP });

    // Catmull-Rom 補間で滑らかな点列を再構築
    const prevSmoothedLen = smoothedPoints.length;
    _rebuildSmoothedPoints(prevRawLen);

    // lastDrawnIndex は smoothedPoints 上のインデックス
    // 前回の末尾から描画再開
    const drawFrom = Math.max(1, prevSmoothedLen - 1);

    if (_usingStrokeCanvas) {
        lastDrawnIndex = drawBrushSegment(strokeCtx, smoothedPoints, drawFrom, false, brush, false);
    } else {
        const ctx = getActiveLayerCtx();
        if (!ctx) return;
        lastDrawnIndex = drawBrushSegment(ctx, smoothedPoints, drawFrom, false, brush, state.isErasing);
    }
}

export async function endPenDrawing() {
    if (state.isPenDrawing) {
        if (_usingStrokeCanvas) {
            const mainCtx = getActiveLayerCtx();
            if (mainCtx) {
                const brush = _getDrawBrush();
                mainCtx.save();
                mainCtx.globalAlpha = _strokeOpacity;
                if (brush.binary) mainCtx.imageSmoothingEnabled = false;
                const dpr = window.devicePixelRatio || 1;
                mainCtx.drawImage(strokeCanvas, 0, 0, strokeCanvas.width / dpr, strokeCanvas.height / dpr);
                mainCtx.restore();
            }
            strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
            strokeCanvas.style.opacity = 1;
        }
        state.isPenDrawing = false;
        strokePoints = [];
        smoothedPoints = [];
        lastDrawnIndex = 0;
        pressureBuffer = [];
        _usingStrokeCanvas = false;
    }
}
