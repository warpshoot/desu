import {
    state,
    getActiveLayerCtx
} from '../state.js';
import { saveState } from '../history.js';

// Brush cache for pixel-perfect circles
const brushCache = new Map();

function getPixelatedBrush(size, color) {
    const key = size + '-' + color;
    if (brushCache.has(key)) {
        return brushCache.get(key);
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Convert color to RGBA for pixel manipulation
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const cData = ctx.getImageData(0, 0, 1, 1).data;
    const r = cData[0], g = cData[1], b = cData[2], a = cData[3];
    ctx.clearRect(0, 0, size, size);

    // Pixel-perfect circle drawing
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    const center = size / 2;
    const radiusSq = (size / 2) * (size / 2);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dy = y - center + 0.5;
            const dx = x - center + 0.5;

            if (dx * dx + dy * dy <= radiusSq) {
                const idx = (y * size + x) * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = a;
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);
    brushCache.set(key, canvas);
    return canvas;
}

export function startPenDrawing(x, y) {
    state.isPenDrawing = true;
    state.lastPenPoint = { x, y };

    // Draw the initial point (dot)
    drawPenLine(x, y);
}

export function drawPenLine(x, y) {
    if (!state.isPenDrawing || !state.lastPenPoint) return;

    // Get brush size from state based on current tool
    let brushSize;
    if (state.isErasing) {
        brushSize = state.eraserSize;
    } else {
        brushSize = state.penSize;
    }
    const size = Math.max(1, Math.floor(brushSize));

    // Get active context dynamically
    const ctx = getActiveLayerCtx();
    if (!ctx) return;

    // Determine Color
    let color = '#000000';
    if (!state.isErasing) {
        if (state.currentTool === 'sketch') {
            color = '#808080'; // Grey for sketch
        } else {
            color = '#000000'; // Fixed Black
        }
    }

    const brush = getPixelatedBrush(size, color);
    const halfSize = size / 2;

    const start = state.lastPenPoint;
    const end = { x, y };

    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    const steps = Math.ceil(dist);

    if (state.isErasing) {
        ctx.globalCompositeOperation = 'destination-out';
    } else {
        ctx.globalCompositeOperation = 'source-over';
    }

    for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const cx = start.x + (end.x - start.x) * t;
        const cy = start.y + (end.y - start.y) * t;
        ctx.drawImage(brush, Math.floor(cx - halfSize), Math.floor(cy - halfSize));
    }

    ctx.globalCompositeOperation = 'source-over';
    state.lastPenPoint = { x, y };
}

export async function endPenDrawing() {
    if (state.isPenDrawing) {
        state.isPenDrawing = false;
        state.lastPenPoint = null;

        await saveState();
    }
}
