import { state, getActiveLayerCtx, strokeCanvas, strokeCtx } from '../state.js';
import { drawBrushSegment } from '../brushes.js';

let strokePoints = [];
let lastDrawnIndex = 0;
let _strokeOpacity = 1.0;
let _usingStrokeCanvas = false;

// 消しゴム時は eraserSize を使う専用ブラシを返す
function _getDrawBrush() {
    if (state.isErasing) {
        return { ...state.activeBrush, size: state.eraserSize, pressureSize: true };
    }
    return state.activeBrush;
}

export function startPenDrawing(x, y, pressure = 0.5) {
    state.isPenDrawing = true;
    strokePoints = [{ x, y, pressure }];
    lastDrawnIndex = 0;

    const brush = _getDrawBrush();
    _strokeOpacity = brush.opacity ?? 1.0;
    _usingStrokeCanvas = !state.isErasing && !!strokeCanvas && !!strokeCtx;

    if (_usingStrokeCanvas) {
        // ストロークキャンバスをクリアし、CSS opacity でプレビュー表示
        strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
        strokeCanvas.style.opacity = _strokeOpacity;
        drawBrushSegment(strokeCtx, strokePoints, 0, true, brush, false);
    } else {
        const ctx = getActiveLayerCtx();
        if (!ctx) return;
        drawBrushSegment(ctx, strokePoints, 0, true, brush, state.isErasing);
    }
}

export function drawPenLine(x, y, pressure = 0.5) {
    if (!state.isPenDrawing) return;

    const lastPoint = strokePoints[strokePoints.length - 1];
    const smoothedPressure = lastPoint.pressure * 0.5 + pressure * 0.5;

    const dist = Math.hypot(x - lastPoint.x, y - lastPoint.y);
    if (dist < 0.5) return;

    strokePoints.push({ x, y, pressure: smoothedPressure });

    const brush = _getDrawBrush();

    if (_usingStrokeCanvas) {
        lastDrawnIndex = drawBrushSegment(strokeCtx, strokePoints, lastDrawnIndex, false, brush, false);
    } else {
        const ctx = getActiveLayerCtx();
        if (!ctx) return;
        lastDrawnIndex = drawBrushSegment(ctx, strokePoints, lastDrawnIndex, false, brush, state.isErasing);
    }
}

export async function endPenDrawing() {
    if (state.isPenDrawing) {
        if (_usingStrokeCanvas) {
            // ストロークキャンバスをアクティブレイヤーに合成してクリア
            const mainCtx = getActiveLayerCtx();
            if (mainCtx) {
                mainCtx.save();
                mainCtx.globalAlpha = _strokeOpacity;
                mainCtx.drawImage(strokeCanvas, 0, 0);
                mainCtx.restore();
            }
            strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
            strokeCanvas.style.opacity = 1;
        }
        state.isPenDrawing = false;
        strokePoints = [];
        lastDrawnIndex = 0;
        _usingStrokeCanvas = false;
    }
}
