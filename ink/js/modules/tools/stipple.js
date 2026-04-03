import { state, getActiveLayerCtx } from '../state.js';
import { applyPressureCurve } from '../brushes.js';

/**
 * Stipple brush — フリーハンドで点描濃淡をつけるツール
 *
 * ストロークに沿って1pxドットをランダム散布。
 * ブラシサイズ=散布半径、重ね塗りで濃くなる。
 * 筆圧対応: 筆圧が高いほどドット密度UP。
 */

const DOT_SIZE = 1;

let strokePoints = [];

export function startStippleDrawing(x, y, pressure = 0.5) {
    state.isPenDrawing = true;
    strokePoints = [{ x, y, pressure }];
    _scatterDots(x, y, pressure);
}

export function drawStippleLine(x, y, pressure = 0.5) {
    if (!state.isPenDrawing) return;

    const last = strokePoints[strokePoints.length - 1];
    const smoothedPressure = last.pressure * 0.5 + pressure * 0.5;

    const dist = Math.hypot(x - last.x, y - last.y);
    if (dist < 0.5) return;

    strokePoints.push({ x, y, pressure: smoothedPressure });

    // Scatter dots along the segment
    const steps = Math.max(1, Math.ceil(dist / 2));
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const cx = last.x + (x - last.x) * t;
        const cy = last.y + (y - last.y) * t;
        const cp = last.pressure + (smoothedPressure - last.pressure) * t;
        _scatterDots(cx, cy, cp);
    }
}

export function endStippleDrawing() {
    if (state.isPenDrawing) {
        state.isPenDrawing = false;
        strokePoints = [];
    }
}

function _scatterDots(cx, cy, pressure) {
    const ctx = getActiveLayerCtx();
    if (!ctx) return;

    const radius = Math.max(1, state.stippleSize);
    // 密度設定でドット数を決定 (密度1〜20、デフォルト5)
    const density = state.activeBrush ? (state.activeBrush.stippleDensity ?? 5) : 5;
    const pressureDensity = state.activeBrush ? (state.activeBrush.pressureDensity ?? true) : true;
    const gamma = state.activeBrush ? (state.activeBrush.pressureCurve ?? 1.0) : 1.0;

    const effectivePressure = pressureDensity ? applyPressureCurve(pressure, gamma) : 1.0;
    const dotCount = Math.max(1, Math.round(density * effectivePressure));

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000000';

    for (let d = 0; d < dotCount; d++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius;
        const dx = Math.round(cx + Math.cos(angle) * r);
        const dy = Math.round(cy + Math.sin(angle) * r);
        ctx.fillRect(dx, dy, DOT_SIZE, DOT_SIZE);
    }
}
