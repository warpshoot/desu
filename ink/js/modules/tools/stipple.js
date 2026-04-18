import { state, getActiveLayerCtx, getActiveLayer } from '../state.js';
import { applyPressureCurve } from '../brushes.js';
import { markLayerDirty } from '../history.js';
import { pushSelectionClip, popSelectionClip } from './selection.js';

/**
 * Stipple brush — フリーハンドで点描濃淡をつけるツール
 *
 * ストロークに沿って1pxドットをランダム散布。
 * ブラシサイズ=散布半径、重ね塗りで濃くなる。
 * 筆圧対応: 筆圧が高いほどドット密度UP。
 */

const DOT_SIZE = 1;

let strokePoints = [];

// Dirty rect tracking
let _dirtyMinX = Infinity, _dirtyMinY = Infinity;
let _dirtyMaxX = -Infinity, _dirtyMaxY = -Infinity;

// インクだまり: 速度トラッキング
let _lastPointTime = 0;
let _smoothedSpeed = 1.0;
const _INK_POOL_SPEED_MAX = 3.0;

export function getStippleDirtyRect() {
    if (_dirtyMinX > _dirtyMaxX) return null;
    const margin = (state.stippleSize || 31) + 2;
    return {
        x: _dirtyMinX - margin,
        y: _dirtyMinY - margin,
        w: (_dirtyMaxX - _dirtyMinX) + margin * 2,
        h: (_dirtyMaxY - _dirtyMinY) + margin * 2
    };
}

export function clearStippleDirtyRect() {
    _dirtyMinX = Infinity; _dirtyMinY = Infinity;
    _dirtyMaxX = -Infinity; _dirtyMaxY = -Infinity;
}

export function startStippleDrawing(x, y, pressure = 0.5) {
    state.isPenDrawing = true;
    _lastPointTime = performance.now();
    _smoothedSpeed = 1.0;
    strokePoints = [{ x, y, pressure }];
    _dirtyMinX = x; _dirtyMinY = y; _dirtyMaxX = x; _dirtyMaxY = y;
    _scatterDots(x, y, pressure, 1.0);
}

export function drawStippleLine(x, y, pressure = 0.5) {
    if (!state.isPenDrawing) return;

    const last = strokePoints[strokePoints.length - 1];
    const smoothedPressure = last.pressure * 0.5 + pressure * 0.5;

    const dist = Math.hypot(x - last.x, y - last.y);
    if (dist < 0.5) return;

    // 速度計算
    const now = performance.now();
    const dt = now - _lastPointTime;
    _lastPointTime = now;
    const rawSpeed = dt > 0 ? Math.min(1, (dist / dt) / _INK_POOL_SPEED_MAX) : 1.0;
    _smoothedSpeed = _smoothedSpeed * 0.88 + rawSpeed * 0.12;

    strokePoints.push({ x, y, pressure: smoothedPressure });

    if (x < _dirtyMinX) _dirtyMinX = x;
    if (y < _dirtyMinY) _dirtyMinY = y;
    if (x > _dirtyMaxX) _dirtyMaxX = x;
    if (y > _dirtyMaxY) _dirtyMaxY = y;

    // Scatter dots along the segment
    const steps = Math.max(1, Math.ceil(dist / 2));
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const cx = last.x + (x - last.x) * t;
        const cy = last.y + (y - last.y) * t;
        const cp = last.pressure + (smoothedPressure - last.pressure) * t;
        _scatterDots(cx, cy, cp, _smoothedSpeed);
    }
}

export function endStippleDrawing() {
    if (state.isPenDrawing) {
        state.isPenDrawing = false;
        strokePoints = [];
        const layer = getActiveLayer();
        if (layer) markLayerDirty(layer.id);
    }
}

function _scatterDots(cx, cy, pressure, speed = 1.0) {
    const ctx = getActiveLayerCtx();
    if (!ctx) return;

    const radius = Math.max(1, state.stippleSize);
    const density = state.activeBrush ? (state.activeBrush.stippleDensity ?? 5) : 5;
    const pressureDensity = state.activeBrush ? (state.activeBrush.pressureDensity ?? true) : true;
    const gamma = state.activeBrush ? (state.activeBrush.pressureCurve ?? 1.0) : 1.0;
    const inkPooling = state.activeBrush ? (state.activeBrush.inkPooling ?? false) : false;
    const inkPoolingStrength = state.activeBrush ? (state.activeBrush.inkPoolingStrength ?? 1) : 1;

    const effectivePressure = pressureDensity ? applyPressureCurve(pressure, gamma) : 1.0;
    let dotCount = Math.max(1, Math.round(density * effectivePressure));

    // インクだまり: 遅いほどドット密集
    if (inkPooling) {
        const t = 1.0 - speed;
        dotCount = Math.round(dotCount * (1.0 + inkPoolingStrength * 0.8 * t * t));
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000000';

    const clipped = pushSelectionClip(ctx);

    for (let d = 0; d < dotCount; d++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius;
        const dx = Math.round(cx + Math.cos(angle) * r);
        const dy = Math.round(cy + Math.sin(angle) * r);
        ctx.fillRect(dx, dy, DOT_SIZE, DOT_SIZE);
    }

    if (clipped) popSelectionClip(ctx);
}
