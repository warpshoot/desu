import {
    state,
    lassoCanvas,
    lassoCtx,
    strokeCanvas,
    strokeCtx
} from '../state.js';
import {
    drawPenLine, previewStraightLine,
    beginPenBatch, flushPenBatch
} from '../tools/pen.js';
import {
    drawStippleLine
} from '../tools/stipple.js';

// RAF-based draw batching — prevents pointermove backlog on iPad
let _pendingDrawPoints = [];
let _drawRafId = null;
let _thumbRafId = null; // Throttled thumbnail update
let _straightLineEnd = null;   // Shift+直線: RAF pending 更新用 (flushで null にリセット)
let _lastStraightEnd = null;   // Shift+直線: ストローク中の最新終点 (pointerup まで保持)
let _strokeStartPoint = null;  // Shift+直線: ストローク開始点 (ガイド描画に使用)

/**
 * 消しゴムペン / 点描の直線プレビューをlassoCanvasに描画
 * ブラシ幅を反映したコリドー（半透明帯 + 中心ダッシュ線）を表示する
 */
export function drawStraightLineGuide(endX, endY) {
    if (!_strokeStartPoint || !lassoCtx || !lassoCanvas) return;

    const isEraser = state.mode === 'eraser';
    const brushSize = isEraser ? state.eraserSize : (state.activeBrush?.size ?? 4);
    const screenW = Math.max(4, brushSize * state.scale);

    const sx0 = _strokeStartPoint.x * state.scale + state.translateX;
    const sy0 = _strokeStartPoint.y * state.scale + state.translateY;
    const sx1 = endX * state.scale + state.translateX;
    const sy1 = endY * state.scale + state.translateY;

    // 色: 消しゴム=赤系、点描=青系
    const rgb = isEraser ? '200, 60, 60' : '60, 120, 220';

    lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
    lassoCtx.save();
    lassoCtx.lineCap = 'round';
    lassoCtx.setLineDash([]);

    // 白縁 (視認性)
    lassoCtx.lineWidth = screenW + 3;
    lassoCtx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    lassoCtx.beginPath();
    lassoCtx.moveTo(sx0, sy0);
    lassoCtx.lineTo(sx1, sy1);
    lassoCtx.stroke();

    // 半透明コリドー (ブラシ幅)
    lassoCtx.lineWidth = screenW;
    lassoCtx.strokeStyle = `rgba(${rgb}, 0.18)`;
    lassoCtx.stroke();

    // 中心ダッシュ線
    lassoCtx.lineWidth = 1.5;
    lassoCtx.strokeStyle = `rgba(${rgb}, 0.75)`;
    lassoCtx.setLineDash([5, 5]);
    lassoCtx.beginPath();
    lassoCtx.moveTo(sx0, sy0);
    lassoCtx.lineTo(sx1, sy1);
    lassoCtx.stroke();

    lassoCtx.restore();
    lassoCanvas.style.display = 'block';
}

export function flushDrawPoints() {
    _drawRafId = null;

    // Shift+直線モード: フリーハンド点は捨て、モードに応じたプレビューを更新
    if (_straightLineEnd !== null) {
        const { x, y } = _straightLineEnd;
        _straightLineEnd = null;
        _pendingDrawPoints = [];
        if (!state.isPenDrawing) return;

        const isPenStroke  = state.mode === 'pen' && state.subTool !== 'stipple';
        const isEraserPen  = state.mode === 'eraser' && state.subTool === 'pen';
        const isStipple    = state.mode === 'pen' && state.subTool === 'stipple';

        if (isPenStroke) {
            // strokeCanvas にリアルタイム描画プレビュー (既存)
            previewStraightLine(x, y);
        } else if (isEraserPen || isStipple) {
            // lassoCanvas にガイドコリドーを表示
            drawStraightLineGuide(x, y);
        }
        return;
    }

    if (_pendingDrawPoints.length === 0) return;
    const pts = _pendingDrawPoints;
    _pendingDrawPoints = [];

    // stipple が含まれるかチェック (stipple はバッチ未対応のため個別処理)
    let hasPen = false, hasStipple = false;
    for (let i = 0; i < pts.length; i++) {
        if (pts[i].isStipple) hasStipple = true; else hasPen = true;
    }

    if (hasPen && !hasStipple) {
        beginPenBatch();
        for (let i = 0; i < pts.length; i++) {
            drawPenLine(pts[i].x, pts[i].y, pts[i].pressure);
        }
        flushPenBatch();
    } else {
        for (let i = 0; i < pts.length; i++) {
            const { x, y, pressure, isStipple } = pts[i];
            if (isStipple) {
                drawStippleLine(x, y, pressure);
            } else {
                drawPenLine(x, y, pressure);
            }
        }
    }
}

export function cancelAndFlushDrawPoints() {
    if (_drawRafId) {
        cancelAnimationFrame(_drawRafId);
        _drawRafId = null;
    }
    _straightLineEnd = null;
    _lastStraightEnd = null;
    clearStraightLineGuide();
    flushDrawPoints();
}

/** ガイドコリドーをクリアして非表示にする */
export function clearStraightLineGuide() {
    if (!lassoCtx || !lassoCanvas) return;
    lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
    lassoCanvas.style.display = 'none';
}

export function addPendingPoints(pts) {
    if (Array.isArray(pts)) {
        _pendingDrawPoints.push(...pts);
    } else {
        _pendingDrawPoints.push(pts);
    }
    if (!_drawRafId) {
        _drawRafId = requestAnimationFrame(flushDrawPoints);
    }
}

export function setStraightLineEnd(pt) {
    _straightLineEnd = pt;
    if (_straightLineEnd && !_drawRafId) {
        _drawRafId = requestAnimationFrame(flushDrawPoints);
    }
}

export function setStrokeStartPoint(pt) {
    _strokeStartPoint = pt;
}

export function getStrokeStartPoint() {
    return _strokeStartPoint;
}

export function setLastStraightEnd(pt) {
    _lastStraightEnd = pt;
}

export function getLastStraightEnd() {
    return _lastStraightEnd;
}

export function clearPendingPoints() {
    _pendingDrawPoints = [];
}
