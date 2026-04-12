import {
    state,
    layers,
    canvasBg,
    lassoCanvas,
    selectionCanvas,
    eventCanvas,
    layerContainer,
    strokeCanvas,
    strokeCtx,
    createLayer,
    getActiveLayer,
    CANVAS_DPR
} from './state.js';
import { resizeSelectionOverlay } from './tools/selection.js';

// ============================================
// Canvas Initialization
// ============================================

// Paper size fixed at first init — module-level, never reset
let _paperW = 0;
let _paperH = 0;

export function getPaperSize() {
    return { w: _paperW, h: _paperH };
}

/**
 * Manually resize the paper (drawing area) - used when loading projects
 */
export function resizePaper(w, h) {
    const dpr = CANVAS_DPR;
    _paperW = w;
    _paperH = h;
    state.paperW = w;
    state.paperH = h;

    canvasBg.style.width  = w + 'px';
    canvasBg.style.height = h + 'px';

    for (const layer of layers) {
        layer.canvas.width  = w * dpr;
        layer.canvas.height = h * dpr;
        layer.canvas.style.width  = w + 'px';
        layer.canvas.style.height = h + 'px';
        
        layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
        layer.ctx.scale(dpr, dpr);
        layer.ctx.imageSmoothingEnabled = false;
        layer.ctx.clearRect(0, 0, w, h);
    }
    
    strokeCanvas.width  = w * dpr;
    strokeCanvas.height = h * dpr;
    strokeCanvas.style.width  = w + 'px';
    strokeCanvas.style.height = h + 'px';
    strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
    strokeCtx.scale(dpr, dpr);
}

/**
 * Initialize all canvases - called on app start and resize.
 * Drawing layers (paper) are fixed to the first-call viewport size.
 * Only viewport overlays (event, lasso, selection) resize with the window.
 */
export async function initCanvas() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dpr = CANVAS_DPR;

    const isFirstInit = _paperW === 0 || _paperH === 0;

    if (isFirstInit) {
        _paperW = state.paperW || 2000;
        _paperH = state.paperH || 2000;
        // Also store on state so createLayer() and save code can read it
        state.paperW = _paperW;
        state.paperH = _paperH;
    }

    const pw = _paperW;
    const ph = _paperH;

    // ── Drawing layers & background: fixed paper size, only on first init ──
    if (isFirstInit) {
        canvasBg.style.width  = pw + 'px';
        canvasBg.style.height = ph + 'px';

        for (const layer of layers) {
            const oldW = layer.canvas.width;
            const oldH = layer.canvas.height;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width  = oldW;
            tempCanvas.height = oldH;
            tempCanvas.getContext('2d').drawImage(layer.canvas, 0, 0);

            layer.canvas.width  = pw * dpr;
            layer.canvas.height = ph * dpr;
            layer.canvas.style.width  = pw + 'px';
            layer.canvas.style.height = ph + 'px';

            layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
            layer.ctx.scale(dpr, dpr);
            layer.ctx.imageSmoothingEnabled = false;
            layer.ctx.clearRect(0, 0, pw, ph);
            layer.ctx.drawImage(tempCanvas, 0, 0, oldW / dpr, oldH / dpr);
        }

        if (layers.length === 0) {
            createLayer();
        }

        // strokeCanvas is in paper coordinate space — fixed size
        strokeCanvas.width  = pw * dpr;
        strokeCanvas.height = ph * dpr;
        strokeCanvas.style.width  = pw + 'px';
        strokeCanvas.style.height = ph + 'px';
        strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
        strokeCtx.scale(dpr, dpr);
    }

    // ── Viewport overlays: always match current window size ──
    lassoCanvas.width  = vw * dpr;
    lassoCanvas.height = vh * dpr;
    lassoCanvas.style.width  = vw + 'px';
    lassoCanvas.style.height = vh + 'px';
    const lCtx = lassoCanvas.getContext('2d');
    lCtx.setTransform(1, 0, 0, 1, 0, 0);
    lCtx.scale(dpr, dpr);

    selectionCanvas.width  = vw * dpr;
    selectionCanvas.height = vh * dpr;
    selectionCanvas.style.width  = vw + 'px';
    selectionCanvas.style.height = vh + 'px';
    const sCtx = selectionCanvas.getContext('2d');
    sCtx.setTransform(1, 0, 0, 1, 0, 0);
    sCtx.scale(dpr, dpr);

    eventCanvas.width  = vw;
    eventCanvas.height = vh;
    eventCanvas.style.width  = vw + 'px';
    eventCanvas.style.height = vh + 'px';

    applyTransform();
    if (isFirstInit) centerCanvas();
    resizeSelectionOverlay();

    return true;
}

/**
 * Called only on window resize.
 * Resizes viewport-overlay canvases (event, lasso, selection) to the new window size.
 * Drawing layers and background are NEVER touched here.
 */
export function resizeViewport() {
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    const dpr = CANVAS_DPR;

    lassoCanvas.width  = vw * dpr;
    lassoCanvas.height = vh * dpr;
    lassoCanvas.style.width  = vw + 'px';
    lassoCanvas.style.height = vh + 'px';
    const lCtx = lassoCanvas.getContext('2d');
    lCtx.setTransform(1, 0, 0, 1, 0, 0);
    lCtx.scale(dpr, dpr);

    selectionCanvas.width  = vw * dpr;
    selectionCanvas.height = vh * dpr;
    selectionCanvas.style.width  = vw + 'px';
    selectionCanvas.style.height = vh + 'px';
    const sCtx = selectionCanvas.getContext('2d');
    sCtx.setTransform(1, 0, 0, 1, 0, 0);
    sCtx.scale(dpr, dpr);

    eventCanvas.width  = vw;
    eventCanvas.height = vh;

    resizeSelectionOverlay();
}

// ============================================
// Color Utilities
// ============================================

/**
 * Convert Hex to RGBA [r,g,b,a]
 */
export function hexToRgba(hex, alpha = 255) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b, alpha];
}

/**
 * Update Background Color
 */
export function updateBackgroundColor(color) {
    state.canvasColor = color;
    canvasBg.style.backgroundColor = color;
}

// ============================================
// Transform (Zoom & Pan)
// ============================================

/**
 * Apply zoom and pan transformations via CSS
 */
export function applyTransform() {
    const transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;

    canvasBg.style.transform = transform;

    // Apply to all dynamic layers
    for (const layer of layers) {
        layer.canvas.style.transform = transform;
    }

    // Stroke canvas follows same transform as layers
    strokeCanvas.style.transform = transform;

    // Apply to flash overlay if it exists
    const flashOverlay = document.getElementById('flash-overlay');
    if (flashOverlay) {
        flashOverlay.style.transform = transform;
    }
    // Note: lassoCanvas uses screen coordinates, no transform

    const resetBtn = document.getElementById('resetZoomBtn');
    if (resetBtn) {
        // Calculate centered position for "Reset" check
        const pw = state.paperW || 2000;
        const ph = state.paperH || 2000;
        const targetX = Math.round((window.innerWidth - pw) / 2);
        const targetY = Math.round((window.innerHeight - ph) / 2);

        const isCentered = Math.abs(state.scale - 1) < 0.01 && 
                           Math.abs(state.translateX - targetX) < 1 && 
                           Math.abs(state.translateY - targetY) < 1;

        if (!isCentered) {
            resetBtn.classList.add('visible');
        } else {
            resetBtn.classList.remove('visible');
        }
    }
}

/**
 * Center the canvas in the viewport
 */
export function centerCanvas() {
    const pw = state.paperW || 2000;
    const ph = state.paperH || 2000;
    
    state.scale = 1;
    state.translateX = Math.round((window.innerWidth - pw * state.scale) / 2);
    state.translateY = Math.round((window.innerHeight - ph * state.scale) / 2);
    
    applyTransform();
}
