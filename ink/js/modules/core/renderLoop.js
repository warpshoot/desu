import {
    state,
    lassoCanvas,
    lassoCtx,
    strokeCanvas,
    strokeCtx
} from '../state.js';
import {
    drawPenLine, previewStraightLine,
    beginPenBatch, flushPenBatch,
    getLastStrokePoint
} from '../tools/pen.js';
import {
    drawStippleLine
} from '../tools/stipple.js';

// RAF-based draw batching — prevents pointermove backlog on iPad
let _pendingDrawPoints = [];
let _predictedPoints = [];
let _drawRafId = null;
let _thumbRafId = null; // Throttled thumbnail update
let _straightLineEnd = null;   // Shift+直線: RAF pending 更新用 (flushで null にリセット)
let _lastStraightEnd = null;   // Shift+直線: ストローク中の最新終点 (pointerup まで保持)
let _strokeStartPoint = null;  // Shift+直線: ストローク開始点 (ガイド描画に使用)

// Bounding box of the current stroke (canvas coords)
let _strokeBounds = null;

/**
 * 矩形を現在のストローク範囲に統合
 */
function _updateStrokeBounds(x, y, padding = 0) {
    if (!_strokeBounds) {
        _strokeBounds = { minX: x - padding, minY: y - padding, maxX: x + padding, maxY: y + padding };
        return;
    }
    _strokeBounds.minX = Math.min(_strokeBounds.minX, x - padding);
    _strokeBounds.minY = Math.min(_strokeBounds.minY, y - padding);
    _strokeBounds.maxX = Math.max(_strokeBounds.maxX, x + padding);
    _strokeBounds.maxY = Math.max(_strokeBounds.maxY, y + padding);
}

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

    if (_pendingDrawPoints.length === 0 && _predictedPoints.length === 0) return;
    const pts = _pendingDrawPoints;
    const preds = _predictedPoints;
    _pendingDrawPoints = [];
    _predictedPoints = [];

    // Clear previous prediction ghost if any
    if (lassoCtx && lassoCanvas) {
        // If not in stabilizer mode, we clear lassoCanvas for prediction segments
        // (Stabilizer handles its own clear)
        if (!state.activeBrush?.stabilizerEnabled) {
            lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
        }
    }

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

    // Draw Predicted Points to lassoCtx for low-latency visual hint
    if (preds.length > 0 && lassoCtx) {
        // Predict segments are drawn to the screen-space lassoCanvas
        // They are purely visual and NOT part of the stroke data.
        const brush = state.activeBrush;
        if (brush && state.activeBrush?.stabilizerEnabled) {
            lassoCanvas.style.display = 'block';
            lassoCtx.save();
            
            // Screen-space transform for lassoCtx
            const s = state.scale;
            const tx = state.translateX;
            const ty = state.translateY;
            lassoCtx.translate(tx, ty);
            lassoCtx.scale(s, s);

            lassoCtx.globalAlpha = 0.3; // Make ghost even more subtle
            
            // --- Chain prediction segments ---
            // Start chain from the very last DRAWN point
            let currentPredTail = getLastStrokePoint(); 
            if (currentPredTail) {
                for (let i = 0; i < preds.length; i++) {
                    const p = preds[i];
                    if (p.isStipple) {
                        // Stipple prediction (just the tip)
                        if (i === preds.length - 1) drawStippleLine(p.x, p.y, p.pressure, { previewCtx: lassoCtx });
                    } else {
                        // Connect tail -> p
                        drawPenLine(p.x, p.y, p.pressure, { previewCtx: lassoCtx, forcedLastPoint: currentPredTail });
                        currentPredTail = p;
                    }
                }
            }
            lassoCtx.restore();
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

export function addPendingPoints(pts, predictedPts = []) {
    const isEraser = state.mode === 'eraser';
    const brushSize = isEraser ? state.eraserSize : (state.activeBrush?.size ?? 4);
    const padding = brushSize / 2 + 2;

    if (Array.isArray(pts)) {
        _pendingDrawPoints.push(...pts);
        pts.forEach(p => _updateStrokeBounds(p.x, p.y, padding));
    } else if (pts) {
        _pendingDrawPoints.push(pts);
        _updateStrokeBounds(pts.x, pts.y, padding);
    }

    if (predictedPts.length > 0) {
        _predictedPoints.push(...predictedPts);
    }

    if (!_drawRafId) {
        _drawRafId = requestAnimationFrame(flushDrawPoints);
    }
}

export function setStraightLineEnd(pt) {
    _straightLineEnd = pt;
    if (pt) {
        const isEraser = state.mode === 'eraser';
        const brushSize = isEraser ? state.eraserSize : (state.activeBrush?.size ?? 4);
        const padding = brushSize / 2 + 2;
        _updateStrokeBounds(pt.x, pt.y, padding);
    }
    if (_straightLineEnd && !_drawRafId) {
        _drawRafId = requestAnimationFrame(flushDrawPoints);
    }
}

export function setStrokeStartPoint(pt) {
    _strokeStartPoint = pt;
    if (pt) {
        const isEraser = state.mode === 'eraser';
        const brushSize = isEraser ? state.eraserSize : (state.activeBrush?.size ?? 4);
        const padding = brushSize / 2 + 2;
        _updateStrokeBounds(pt.x, pt.y, padding);
    }
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

export function getStrokeBounds() {
    return _strokeBounds;
}

export function resetStrokeBounds() {
    _strokeBounds = null;
}
