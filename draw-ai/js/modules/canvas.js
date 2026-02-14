import {
    state,
    layers,
    canvasBg,
    lassoCanvas,
    selectionCanvas,
    eventCanvas,
    layerContainer,
    createLayer,
    getActiveLayer
} from './state.js';

// ============================================
// Canvas Initialization
// ============================================

/**
 * Initialize all canvases - called on app start and resize
 */
export async function initCanvas() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Initialize background
    canvasBg.style.width = w + 'px';
    canvasBg.style.height = h + 'px';

    // Resize all existing layers
    for (const layer of layers) {
        layer.canvas.width = w;
        layer.canvas.height = h;
        layer.ctx.clearRect(0, 0, w, h);
    }

    // Create initial layer if none exist
    if (layers.length === 0) {
        createLayer();
    }

    // Initialize utility canvases
    lassoCanvas.width = w;
    lassoCanvas.height = h;

    selectionCanvas.width = w;
    selectionCanvas.height = h;

    eventCanvas.width = w;
    eventCanvas.height = h;

    applyTransform();

    return true;
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

    // Event canvas follows transform for coordinate mapping
    eventCanvas.style.transform = transform;

    // Apply to flash overlay if it exists
    const flashOverlay = document.getElementById('flash-overlay');
    if (flashOverlay) {
        flashOverlay.style.transform = transform;
    }
    // Note: lassoCanvas uses screen coordinates, no transform

    const resetBtn = document.getElementById('resetZoomBtn');
    if (resetBtn) {
        if (Math.abs(state.scale - 1) > 0.01 || Math.abs(state.translateX) > 1 || Math.abs(state.translateY) > 1) {
            resetBtn.classList.add('visible');
        } else {
            resetBtn.classList.remove('visible');
        }
    }
}
