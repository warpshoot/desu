import { state, getActiveLayerCtx, getActiveLayer, strokeCanvas, strokeCtx, lassoCanvas, lassoCtx, CANVAS_DPR } from '../state.js';
import { drawBrushSegment } from '../brushes.js';
import { markLayerDirty } from '../history.js';
import { pushSelectionClip, popSelectionClip } from './selection.js';

let strokePoints = [];      // 生の入力点列
let smoothedPoints = [];    // スムージング済みの点列 (描画に使用)
let lastDrawnIndex = 0;
let _strokeOpacity = 1.0;
let _usingStrokeCanvas = false;
let _strokeCtxSaved = false;

// バッチモード — 複数の drawPenLine() 呼び出しをまとめて 1 回の drawBrushSegment で描画
// iOS では RAF ごとに N 回 drawBrushSegment していたのを 1 回に削減するための仕組み
let _batchMode = false;
let _batchDrawFrom = 1;

// Dirty rect tracking — 現在のストロークが触れた領域 (キャンバス座標)
let _dirtyMinX = Infinity, _dirtyMinY = Infinity;
let _dirtyMaxX = -Infinity, _dirtyMaxY = -Infinity;
let _dirtyMargin = 2; // ブラシ半径 + 余白

/**
 * 現ストロークの dirty rect を返す (キャンバス座標, CSS px 基準)
 * まだ何も描いていない場合は null
 */
export function getPenDirtyRect() {
    if (_dirtyMinX > _dirtyMaxX) return null;
    const m = _dirtyMargin;
    return {
        x: _dirtyMinX - m,
        y: _dirtyMinY - m,
        w: (_dirtyMaxX - _dirtyMinX) + m * 2,
        h: (_dirtyMaxY - _dirtyMinY) + m * 2
    };
}

export function clearPenDirtyRect() {
    _dirtyMinX = Infinity; _dirtyMinY = Infinity;
    _dirtyMaxX = -Infinity; _dirtyMaxY = -Infinity;
    _dirtyMargin = 2;
}

// 手ぶれ補正 (糸引きスタビライザー) の状態
let _stabAnchorX = 0;  // ブラシの実際の位置 (カーソルより遅れる)
let _stabAnchorY = 0;

// 筆圧スムージング用リングバッファ (5点ウィンドウ加重平均)
const PRESSURE_WINDOW = 5;
let pressureBuffer = new Float32Array(PRESSURE_WINDOW);
let pressureBufferLen = 0;
let pressureBufferIdx = 0;

/**
 * 手ぶれ補正の「糸」を描画 (lassoCanvasを使用)
 */
function _drawStabString(cursorX, cursorY, brushX, brushY, brush) {
    if (!lassoCtx || !lassoCanvas) return;

    // lassoCanvasはスクリーン座標(=無変形)で使用されることが想定されているため、
    // キャンバス座標をスクリーン座標に変換して戻す
    const s = state.scale;
    const tx = state.translateX;
    const ty = state.translateY;

    const sx1 = cursorX * s + tx;
    const sy1 = cursorY * s + ty;
    const sx2 = brushX * s + tx;
    const sy2 = brushY * s + ty;

    lassoCtx.save();
    // stabilizerDistance はスクリーンpx単位 — scale 依存なし
    const stabDist = brush.stabilizerDistance ?? 20;
    const showGuide  = brush.stabShowGuide ?? true;

    // 糸の描画 (白縁 + 青線で視認性向上)
    lassoCtx.lineWidth = 3;
    lassoCtx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    lassoCtx.beginPath();
    lassoCtx.moveTo(sx1, sy1);
    lassoCtx.lineTo(sx2, sy2);
    lassoCtx.stroke();

    lassoCtx.lineWidth = 1.5;
    lassoCtx.strokeStyle = 'rgba(60, 130, 255, 0.85)';
    lassoCtx.beginPath();
    lassoCtx.moveTo(sx1, sy1);
    lassoCtx.lineTo(sx2, sy2);
    lassoCtx.stroke();

    if (showGuide) {
        // ブラシ位置の円 (アンカー)
        lassoCtx.beginPath();
        lassoCtx.arc(sx2, sy2, 4, 0, Math.PI * 2);
        lassoCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        lassoCtx.fill();
        lassoCtx.lineWidth = 1.5;
        lassoCtx.strokeStyle = 'rgba(60, 130, 255, 0.9)';
        lassoCtx.stroke();

        // カーソル位置の小円
        lassoCtx.beginPath();
        lassoCtx.arc(sx1, sy1, 2.5, 0, Math.PI * 2);
        lassoCtx.fillStyle = 'rgba(60, 130, 255, 0.7)';
        lassoCtx.fill();

        // 補正限界の円 (糸の長さ)
        lassoCtx.beginPath();
        lassoCtx.setLineDash([3, 4]);
        lassoCtx.lineWidth = 1;
        lassoCtx.strokeStyle = 'rgba(60, 130, 255, 0.4)';
        lassoCtx.arc(sx2, sy2, stabDist, 0, Math.PI * 2);
        lassoCtx.stroke();
    }

    lassoCtx.restore();
}

// 消しゴム時は eraserSize を使う専用ブラシを返す (手ぶれ補正設定は消しゴムスロットから取得)
function _getDrawBrush() {
    if (state.isErasing) {
        const eraserSlot = state.activeEraserSlot;
        return {
            ...state.activeBrush,
            size: state.eraserSize,
            pressureSize: eraserSlot.pressureSize ?? true,
            pressureCurve: eraserSlot.pressureCurve ?? 1.0,
            stabilizerEnabled:  eraserSlot.stabilizerEnabled  ?? false,
            stabilizerDistance: eraserSlot.stabilizerDistance ?? 20,
            stabStringVisible:  eraserSlot.stabStringVisible  ?? true,
            stabShowGuide:      eraserSlot.stabShowGuide      ?? true,
        };
    }
    return state.activeBrush;
}

/**
 * 筆圧のウィンドウ平均スムージング
 * 直近N点の加重移動平均で筆圧ノイズを除去
 * O(1) リングバッファで shift() のコストを回避
 */
function _smoothPressure(rawPressure) {
    pressureBuffer[pressureBufferIdx] = rawPressure;
    pressureBufferIdx = (pressureBufferIdx + 1) % PRESSURE_WINDOW;
    if (pressureBufferLen < PRESSURE_WINDOW) pressureBufferLen++;

    // 新しい値ほど重みが大きい加重平均
    // リングバッファ内を古い順 (oldest → newest) に走査
    let sum = 0, weightSum = 0;
    for (let i = 0; i < pressureBufferLen; i++) {
        // oldest = pressureBufferIdx - pressureBufferLen + i (mod WINDOW)
        const idx = (pressureBufferIdx - pressureBufferLen + i + PRESSURE_WINDOW) % PRESSURE_WINDOW;
        const w = i + 1;
        sum += pressureBuffer[idx] * w;
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
// binary モードでは smoothedPoints = strokePoints を直接参照し、コピーを避ける
let _binaryMode = false;

function _rebuildSmoothedPoints(fromRawIdx) {
    const raw = strokePoints;
    if (raw.length < 2) {
        _binaryMode = false;
        smoothedPoints = raw;
        return;
    }

    // 2値ピクセルモードの場合は補間しない (ピクセルパーフェクト維持)
    const brush = _getDrawBrush();
    if (brush.binary) {
        _binaryMode = true;
        smoothedPoints = raw;
        return;
    }
    _binaryMode = false;

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
        for (let j = 0; j < interpolated.length; j++) smoothedPoints.push(interpolated[j]);
    }
}

/**
 * Shift+直線プレビュー: strokeCanvas をクリアして始点→(x,y) の直線を描画
 * pointermove で Shift が押されている間、RAF ごとに呼ばれる
 */
export function previewStraightLine(x, y) {
    if (!state.isPenDrawing || !_usingStrokeCanvas || strokePoints.length === 0) return;
    const brush = _getDrawBrush();
    const start = strokePoints[0];

    // dirty rect をこの直線に更新
    _dirtyMinX = Math.min(start.x, x);
    _dirtyMinY = Math.min(start.y, y);
    _dirtyMaxX = Math.max(start.x, x);
    _dirtyMaxY = Math.max(start.y, y);

    strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
    const pts = [start, { x, y, pressure: start.pressure }];
    drawBrushSegment(strokeCtx, pts, 0, true, brush, false);
    drawBrushSegment(strokeCtx, pts, 1, false, brush, false);
}

export function startPenDrawing(x, y, pressure = 0.5) {
    state.isPenDrawing = true;
    pressureBufferLen = 0;
    pressureBufferIdx = 0;
    const smoothedP = _smoothPressure(pressure);
    strokePoints = [{ x, y, pressure: smoothedP }];
    smoothedPoints = [{ x, y, pressure: smoothedP }];
    lastDrawnIndex = 0;

    // Dirty rect 初期化
    const brush = _getDrawBrush();
    _dirtyMargin = Math.ceil(brush.size * 0.75) + 2; // max radius + 余白
    _dirtyMinX = x; _dirtyMinY = y; _dirtyMaxX = x; _dirtyMaxY = y;

    // 手ぶれ補正: アンカーをカーソル位置で初期化
    _stabAnchorX = x;
    _stabAnchorY = y;

    if (brush.stabilizerEnabled) {
        lassoCanvas.style.display = 'block';
        lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
    }

    _strokeOpacity = brush.opacity ?? 1.0;
    // 消しゴム時は即時反映（レイヤー直描き）に戻す
    _usingStrokeCanvas = !!strokeCanvas && !!strokeCtx && !state.isErasing;
    _strokeCtxSaved = false;

    if (_usingStrokeCanvas) {
        strokeCtx.save();
        _strokeCtxSaved = true;
        strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
        strokeCanvas.style.opacity = _strokeOpacity;
        
        const clipped = pushSelectionClip(strokeCtx);
        drawBrushSegment(strokeCtx, smoothedPoints, 0, true, brush, false);
    } else {
        const ctx = getActiveLayerCtx();
        if (!ctx) return;
        
        const clipped = pushSelectionClip(ctx);
        drawBrushSegment(ctx, smoothedPoints, 0, true, brush, state.isErasing);
        if (clipped) popSelectionClip(ctx);
        
        // レイヤー直描きの場合は即座にDirtyマーク
        const layer = getActiveLayer();
        if (layer) markLayerDirty(layer.id);
    }
}

export function drawPenLine(x, y, pressure = 0.5) {
    if (!state.isPenDrawing) return;

    const brush = _getDrawBrush();

    // 手ぶれ補正 (糸引きスタビライザー)
    // カーソルがアンカーから stabilizerDistance 以上離れたときのみアンカーを移動
    if (brush.stabilizerEnabled) {
        // 糸の描画
        lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
        if (brush.stabStringVisible ?? true) {
            _drawStabString(x, y, _stabAnchorX, _stabAnchorY, brush);
        }

        // stabilizerDistance はスクリーン座標系 (px) で扱う
        // drawPenLine の x,y はキャンバス座標なので scale で割って換算
        const stabDistCanvas = (brush.stabilizerDistance ?? 20) / state.scale;
        const dx = x - _stabAnchorX;
        const dy = y - _stabAnchorY;
        const d = Math.hypot(dx, dy);
        if (d <= stabDistCanvas) return; // ブラシは動かない
        const ratio = (d - stabDistCanvas) / d;
        _stabAnchorX += dx * ratio;
        _stabAnchorY += dy * ratio;
        x = _stabAnchorX;
        y = _stabAnchorY;
    }

    const lastPoint = strokePoints[strokePoints.length - 1];
    const dist = Math.hypot(x - lastPoint.x, y - lastPoint.y);
    if (dist < 0.5) return;

    // Dirty rect を拡張
    if (x < _dirtyMinX) _dirtyMinX = x;
    if (y < _dirtyMinY) _dirtyMinY = y;
    if (x > _dirtyMaxX) _dirtyMaxX = x;
    if (y > _dirtyMaxY) _dirtyMaxY = y;

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

    if (_batchMode) {
        // バッチモード: 描画は flushPenBatch() に委ねる
        // smoothedPoints への追加だけ行い、GPU 呼び出しは一切しない
        return;
    }

    if (_usingStrokeCanvas) {
        if (state.isErasing) {
            strokeCtx.save();
            strokeCtx.fillStyle = '#fff';
            lastDrawnIndex = drawBrushSegment(strokeCtx, smoothedPoints, drawFrom, false, brush, false);
            strokeCtx.restore();
        } else {
            lastDrawnIndex = drawBrushSegment(strokeCtx, smoothedPoints, drawFrom, false, brush, false);
        }
    } else {
        const ctx = getActiveLayerCtx();
        if (ctx) {
            const clipped = pushSelectionClip(ctx);
            lastDrawnIndex = drawBrushSegment(ctx, smoothedPoints, drawFrom, false, brush, state.isErasing);
            if (clipped) popSelectionClip(ctx);
        }
    }
}

/**
 * 1 RAF フレーム分のペン描画をバッチ実行する関数群
 *
 * 使い方:
 *   beginPenBatch();
 *   for (each point) drawPenLine(x, y, p);  // GPU 呼び出しなし
 *   flushPenBatch();                         // ここで 1 回だけ drawBrushSegment
 *
 * iOS では drawBrushSegment ごとに Core Graphics flush が走るため、
 * N 点 → N flush していたものを 1 flush に削減できる。
 */
export function beginPenBatch() {
    _batchMode = true;
    // バッチ開始時点の描画済みインデックスを記録
    _batchDrawFrom = Math.max(1, lastDrawnIndex);
}

export function flushPenBatch() {
    if (!_batchMode) return;
    _batchMode = false;

    if (!state.isPenDrawing) return;

    const drawFrom = _batchDrawFrom;
    if (drawFrom >= smoothedPoints.length) return; // 新規点なし

    const brush = _getDrawBrush();

    if (_usingStrokeCanvas) {
        lastDrawnIndex = drawBrushSegment(strokeCtx, smoothedPoints, drawFrom, false, brush, false);
    } else {
        const ctx = getActiveLayerCtx();
        if (ctx) {
            const clipped = pushSelectionClip(ctx);
            lastDrawnIndex = drawBrushSegment(ctx, smoothedPoints, drawFrom, false, brush, state.isErasing);
            if (clipped) popSelectionClip(ctx);
        }
    }
}

export async function endPenDrawing() {
    if (state.isPenDrawing) {
        if (_usingStrokeCanvas) {
            const layer = getActiveLayer();
            const mainCtx = layer ? layer.ctx : null;
            if (mainCtx) {
                const brush = _getDrawBrush();
                mainCtx.save();

                if (state.isErasing) {
                    // 消しゴム時は合成モードを変更して strokeCanvas の内容（白）で削る
                    mainCtx.globalCompositeOperation = 'destination-out';
                    mainCtx.globalAlpha = 1.0;
                } else {
                    mainCtx.globalAlpha = _strokeOpacity;
                }

                if (brush.binary) mainCtx.imageSmoothingEnabled = false;

                const clipped = pushSelectionClip(mainCtx);

                const dpr = CANVAS_DPR;

                // Dirty Rect 最適化: ストロークが触れた領域だけ strokeCanvas → layer にコピー
                // 全面コピー (4000×4000) は iOS Metal で大きな GPU 負荷になる。
                // 典型的なストロークは canvas の一部なので dirty rect だけコピーすることで
                // GPU 転送量を大幅削減できる。
                if (_dirtyMinX <= _dirtyMaxX) {
                    const m = _dirtyMargin;
                    // 物理ピクセル座標 (strokeCanvas の座標系)
                    const psx = Math.max(0, Math.floor((_dirtyMinX - m) * dpr));
                    const psy = Math.max(0, Math.floor((_dirtyMinY - m) * dpr));
                    const pex = Math.min(strokeCanvas.width,  Math.ceil((_dirtyMaxX + m) * dpr));
                    const pey = Math.min(strokeCanvas.height, Math.ceil((_dirtyMaxY + m) * dpr));
                    const psw = pex - psx;
                    const psh = pey - psy;
                    if (psw > 0 && psh > 0) {
                        // dest は mainCtx の CSS 座標系 (scale(dpr) 済み)
                        mainCtx.drawImage(strokeCanvas, psx, psy, psw, psh,
                            psx / dpr, psy / dpr, psw / dpr, psh / dpr);
                    }
                } else {
                    // dirty rect 未計算 (点描など) → 全面フォールバック
                    mainCtx.drawImage(strokeCanvas, 0, 0, strokeCanvas.width / dpr, strokeCanvas.height / dpr);
                }

                if (clipped) popSelectionClip(mainCtx);
                mainCtx.restore();

                // 履歴管理用にレイヤーの状態変更を通知
                markLayerDirty(layer.id);
            }
            if (_strokeCtxSaved) {
                strokeCtx.restore();
                _strokeCtxSaved = false;
            }
            // clearRect も dirty rect だけに限定 (strokeCtx は scale(dpr) 済みなので CSS 座標)
            if (_dirtyMinX <= _dirtyMaxX) {
                const m = _dirtyMargin;
                const cx = Math.max(0, _dirtyMinX - m);
                const cy = Math.max(0, _dirtyMinY - m);
                const cw = Math.min(strokeCanvas.width / CANVAS_DPR - cx, (_dirtyMaxX - _dirtyMinX) + m * 2);
                const ch = Math.min(strokeCanvas.height / CANVAS_DPR - cy, (_dirtyMaxY - _dirtyMinY) + m * 2);
                if (cw > 0 && ch > 0) strokeCtx.clearRect(cx, cy, cw, ch);
            } else {
                strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
            }
            strokeCanvas.style.opacity = 1;
        }

        if (lassoCtx) {
            lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
            lassoCanvas.style.display = 'none';
        }

        state.isPenDrawing = false;
        strokePoints = [];
        smoothedPoints = [];
        _binaryMode = false;
        lastDrawnIndex = 0;
        pressureBufferLen = 0;
        pressureBufferIdx = 0;
        _usingStrokeCanvas = false;
    }
}
