import { state, getActiveLayerCtx } from '../state.js';
import { drawBrushSegment } from '../brushes.js';

let strokePoints = [];
let lastDrawnIndex = 0;

export function startPenDrawing(x, y, pressure = 0.5) {
    state.isPenDrawing = true;
    strokePoints = [{ x, y, pressure }];
    lastDrawnIndex = 0;

    const ctx = getActiveLayerCtx();
    if (!ctx) return;
    const brush = state.activeBrush;
    drawBrushSegment(ctx, strokePoints, 0, true, brush, state.isErasing);
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
    const brush = state.activeBrush;
    lastDrawnIndex = drawBrushSegment(ctx, strokePoints, lastDrawnIndex, false, brush, state.isErasing);
}

export async function endPenDrawing() {
    if (state.isPenDrawing) {
        state.isPenDrawing = false;
        strokePoints = [];
        lastDrawnIndex = 0;
    }
}
