import { state, getActiveLayerCtx } from '../state.js';
import { drawBrushSegment } from '../brushes.js';

let strokePoints = [];
let lastDrawnIndex = 0;

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

    const ctx = getActiveLayerCtx();
    if (!ctx) return;
    drawBrushSegment(ctx, strokePoints, 0, true, _getDrawBrush(), state.isErasing);
}

export function drawPenLine(x, y, pressure = 0.5) {
    if (!state.isPenDrawing) return;

    const lastPoint = strokePoints[strokePoints.length - 1];
    const smoothedPressure = lastPoint.pressure * 0.5 + pressure * 0.5;

    const dist = Math.hypot(x - lastPoint.x, y - lastPoint.y);
    if (dist < 0.5) return;

    strokePoints.push({ x, y, pressure: smoothedPressure });

    const ctx = getActiveLayerCtx();
    if (!ctx) return;
    lastDrawnIndex = drawBrushSegment(ctx, strokePoints, lastDrawnIndex, false, _getDrawBrush(), state.isErasing);
}

export async function endPenDrawing() {
    if (state.isPenDrawing) {
        state.isPenDrawing = false;
        strokePoints = [];
        lastDrawnIndex = 0;
    }
}
