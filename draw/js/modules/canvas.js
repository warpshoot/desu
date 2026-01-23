
import {
    state,
    canvasBg,
    roughCanvas, roughCtx,
    fillCanvas, fillCtx,
    lineCanvas, lineCtx,
    line2Canvas, line2Ctx,
    line3Canvas, line3Ctx,
    lassoCanvas, selectionCanvas
} from './state.js';

// Initialize all canvases
export async function initCanvas() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // console.log('Initializing canvas:', w, 'x', h);

    // Initialize background
    canvasBg.style.width = w + 'px';
    canvasBg.style.height = h + 'px';

    // Initialize Rough Layer
    roughCanvas.width = w;
    roughCanvas.height = h;
    roughCtx.fillStyle = '#fff';
    roughCtx.fillRect(0, 0, w, h);

    // Initialize Fill Layer (Transparent)
    fillCanvas.width = w;
    fillCanvas.height = h;
    fillCtx.clearRect(0, 0, w, h);

    // Initialize Line Layer (Transparent)
    lineCanvas.width = w;
    lineCanvas.height = h;
    lineCtx.clearRect(0, 0, w, h);

    // Initialize Line2 Layer (Transparent)
    line2Canvas.width = w;
    line2Canvas.height = h;
    line2Ctx.clearRect(0, 0, w, h);

    // Initialize Line3 Layer (Transparent)
    line3Canvas.width = w;
    line3Canvas.height = h;
    line3Ctx.clearRect(0, 0, w, h);

    // console.log('Canvas initialized - rough:', roughCanvas.width, 'x', roughCanvas.height);
    // console.log('Canvas initialized - fill:', fillCanvas.width, 'x', fillCanvas.height);
    // console.log('Canvas initialized - line:', lineCanvas.width, 'x', lineCanvas.height);

    // Initialize utility canvases
    lassoCanvas.width = w;
    lassoCanvas.height = h;

    selectionCanvas.width = w;
    selectionCanvas.height = h;

    applyTransform();

    // Initial state saved in history is handled by history.js or main.js logic
    // Returning true to signal completion
    return true;
}

// Apply zoom and pan transformations via CSS
export function applyTransform() {
    const transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;

    canvasBg.style.transform = transform;
    roughCanvas.style.transform = transform;
    fillCanvas.style.transform = transform;
    lineCanvas.style.transform = transform;
    line2Canvas.style.transform = transform;
    line3Canvas.style.transform = transform;

    const resetBtn = document.getElementById('resetZoomBtn');
    if (Math.abs(state.scale - 1) > 0.01 || Math.abs(state.translateX) > 1 || Math.abs(state.translateY) > 1) {
        resetBtn.classList.add('visible');
    } else {
        resetBtn.classList.remove('visible');
    }
}
