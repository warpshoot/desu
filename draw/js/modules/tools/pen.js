
import {
    state,
    roughCtx,
    fillCtx,
    lineCtx,
    line2Ctx,
    line3Ctx,
    lassoCanvas,
    lassoCtx
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
    ctx.clearRect(0, 0, size, size); // Clear temp pixel

    // Pixel-perfect circle drawing
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    const center = size / 2;
    // Radius adjusted slightly
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

    // If Sketch Pen, use temp buffer regardless of layer
    if (state.currentTool === 'sketch_pen' && !state.isErasing) {
        // Setup Lasso Canvas as buffer for Sketch Pen
        lassoCanvas.style.display = 'block';
        lassoCanvas.style.opacity = '0.5'; // Preview transparency
        lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
        // Apply transform for sketch pen (it draws in canvas coordinates)
        const transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
        lassoCanvas.style.transform = transform;
    }

    // Draw the initial point (dot)
    drawPenLine(x, y);
}

export function drawPenLine(x, y) {
    if (!state.isPenDrawing || !state.lastPenPoint) return;

    // Get brush size from state based on current tool
    let brushSize;
    if (state.isErasing) {
        brushSize = state.eraserSize;
    } else if (state.currentTool === 'sketch_pen') {
        brushSize = state.sketchPenSize;
    } else {
        brushSize = state.penSize;
    }
    const size = Math.max(1, Math.floor(brushSize));

    // Get active context
    let ctx;
    let color = '#000000';

    if (state.isErasing) {
        // Eraser logic
        if (state.activeLayer === 'rough') {
            ctx = roughCtx;
        } else if (state.activeLayer === 'fill') {
            ctx = fillCtx;
        } else if (state.activeLayer === 'line') {
            ctx = lineCtx;
        } else if (state.activeLayer === 'line2') {
            ctx = line2Ctx;
        } else if (state.activeLayer === 'line3') {
            ctx = line3Ctx;
        } else {
            ctx = lineCtx;
        }
    } else {
        // Determine Color
        if (state.currentTool === 'sketch' || state.currentTool === 'sketch_pen') {
            color = '#808080'; // Sketch stays gray for now as requested "Monochrome Ink + BG" usually implies main ink
        } else {
            color = '#000000'; // Fixed Black
        }

        // Drawing logic
        if (state.currentTool === 'sketch_pen') {
            ctx = lassoCtx; // Draw to buffer
        } else {
            // Standard Pen
            if (state.activeLayer === 'rough') {
                ctx = roughCtx;
            } else if (state.activeLayer === 'fill') {
                ctx = fillCtx;
            } else if (state.activeLayer === 'line') {
                ctx = lineCtx;
            } else if (state.activeLayer === 'line2') {
                ctx = line2Ctx;
            } else if (state.activeLayer === 'line3') {
                ctx = line3Ctx;
            } else {
                ctx = lineCtx;
            }
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

        // If Sketch Pen, transfer buffer to Active Layer
        if (state.currentTool === 'sketch_pen' && !state.isErasing) {
            let targetCtx;
            if (state.activeLayer === 'rough') targetCtx = roughCtx;
            else if (state.activeLayer === 'fill') targetCtx = fillCtx;
            else if (state.activeLayer === 'line') targetCtx = lineCtx;
            else if (state.activeLayer === 'line2') targetCtx = line2Ctx;
            else if (state.activeLayer === 'line3') targetCtx = line3Ctx;
            else targetCtx = lineCtx;

            targetCtx.globalAlpha = 0.5; // Merge with alpha
            targetCtx.drawImage(lassoCanvas, 0, 0);
            targetCtx.globalAlpha = 1.0;

            // Clean up buffer
            lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
            lassoCanvas.style.display = 'none';
            lassoCanvas.style.opacity = '1.0';
            // Reset transform (lasso tools use screen coordinates)
            lassoCanvas.style.transform = '';
        }

        await saveState();
    }
}
