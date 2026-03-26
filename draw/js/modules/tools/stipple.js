import {
    state,
    getActiveLayerCtx
} from '../state.js';
import { saveState } from '../history.js';

// Stipple brush: scatters small dots along the stroke path
// Repeated strokes build up density = tonal variation

const DOTS_PER_STEP = 3;   // dots scattered per interpolation step
const DOT_SIZE = 1;         // each dot is 1px

export function startStippleDrawing(x, y) {
    state.isPenDrawing = true;
    state.lastPenPoint = { x, y };
    drawStippleLine(x, y);
}

export function drawStippleLine(x, y) {
    if (!state.isPenDrawing || !state.lastPenPoint) return;

    const ctx = getActiveLayerCtx();
    if (!ctx) return;

    const radius = Math.max(1, Math.floor(state.penSize));
    const start = state.lastPenPoint;
    const end = { x, y };

    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    // Step every ~2px along the path for responsive dot placement
    const steps = Math.max(1, Math.ceil(dist / 2));

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000000';

    for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const cx = start.x + (end.x - start.x) * t;
        const cy = start.y + (end.y - start.y) * t;

        for (let d = 0; d < DOTS_PER_STEP; d++) {
            // Random point within circle of given radius
            const angle = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * radius;
            const dx = Math.round(cx + Math.cos(angle) * r);
            const dy = Math.round(cy + Math.sin(angle) * r);
            ctx.fillRect(dx, dy, DOT_SIZE, DOT_SIZE);
        }
    }

    state.lastPenPoint = { x, y };
}

export function endStippleDrawing() {
    if (state.isPenDrawing) {
        state.isPenDrawing = false;
        state.lastPenPoint = null;
    }
}
