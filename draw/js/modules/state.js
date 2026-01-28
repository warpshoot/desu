// ============================================
// DOM Elements - Utility Canvases (always present)
// ============================================
export let canvasBg = null;
export let lassoCanvas = null;
export let lassoCtx = null;
export let selectionCanvas = null;
export let eventCanvas = null;
export let layerContainer = null;

// ============================================
// Dynamic Layer Management
// ============================================
// Each layer: { id: number, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, visible: boolean, opacity: number }
export const layers = [];
export const MAX_LAYERS = 5;
let nextLayerId = 1;

export function initDOM() {
    canvasBg = document.getElementById('canvas-background');
    lassoCanvas = document.getElementById('lasso-canvas');
    lassoCtx = lassoCanvas.getContext('2d');
    selectionCanvas = document.getElementById('selection-canvas');
    eventCanvas = document.getElementById('event-canvas');
    layerContainer = document.getElementById('layer-container');
}

/**
 * Create a new layer and add it to the DOM
 * New layers are inserted above existing layers (higher z-index)
 */
export function createLayer() {
    if (layers.length >= MAX_LAYERS) return null;

    const id = nextLayerId++;
    const canvas = document.createElement('canvas');
    canvas.id = `layer-${id}`;
    canvas.className = 'drawing-layer';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Insert canvas into DOM (before lasso-canvas to keep proper z-order)
    layerContainer.appendChild(canvas);
    updateLayerZIndices();

    const layer = {
        id,
        canvas,
        ctx,
        visible: true,
        opacity: 1.0
    };
    layers.push(layer);

    // Set as active layer
    state.activeLayer = id;

    return layer;
}

/**
 * Delete a layer by ID and renumber remaining layers
 */
export function deleteLayer(id) {
    const index = layers.findIndex(l => l.id === id);
    if (index === -1) return false;
    if (layers.length <= 1) return false; // Must have at least one layer

    const layer = layers[index];
    layer.canvas.remove();
    layers.splice(index, 1);

    updateLayerZIndices();

    // Set active layer to the one at same index or last
    state.activeLayer = layers[Math.min(index, layers.length - 1)].id;

    return true;
}

/**
 * Get layer by ID
 */
export function getLayer(id) {
    return layers.find(l => l.id === id) || null;
}

/**
 * Get active layer object
 */
export function getActiveLayer() {
    return getLayer(state.activeLayer);
}

/**
 * Get active layer's context
 */
export function getActiveLayerCtx() {
    const layer = getActiveLayer();
    return layer ? layer.ctx : null;
}

/**
 * Get active layer's canvas
 */
export function getActiveLayerCanvas() {
    const layer = getActiveLayer();
    return layer ? layer.canvas : null;
}

/**
 * Update z-indices so layer order is: layer1 (bottom) → layer2 → ... → layerN (top)
 */
function updateLayerZIndices() {
    layers.forEach((layer, index) => {
        layer.canvas.style.zIndex = 10 + index;
    });
}

/**
 * Clear a specific layer
 */
export function clearLayer(id) {
    const layer = getLayer(id);
    if (!layer) return;
    layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
}

/**
 * Move layer up or down in the stack
 * direction: 'up' (higher z-index) or 'down' (lower z-index)
 */
export function moveLayer(id, direction) {
    const index = layers.findIndex(l => l.id === id);
    if (index === -1) return false;

    if (direction === 'up') {
        if (index >= layers.length - 1) return false; // Already at top
        // Swap with next
        [layers[index], layers[index + 1]] = [layers[index + 1], layers[index]];
    } else if (direction === 'down') {
        if (index <= 0) return false; // Already at bottom
        // Swap with prev
        [layers[index], layers[index - 1]] = [layers[index - 1], layers[index]];
    } else {
        return false;
    }

    updateLayerZIndices();
    return true;
}

// ============================================
// State Object to manage application state
// ============================================
export const state = {
    // Color State
    inkColor: '#000000',
    canvasColor: '#ffffff',

    // Tool settings (decoupled from layers)
    currentTool: 'pen',      // 'pen', 'fill', 'sketch'
    currentEraser: 'pen',  // 'lasso', 'pen'
    isEraserActive: false,   // true when eraser tool is selected
    activeLayer: 1,          // ID of the currently active layer

    // Zoom & Pan
    scale: 1,
    translateX: 0,
    translateY: 0,

    // Global History (unified, no per-layer stacks)
    MAX_HISTORY: 10,
    undoStack: [],   // Each entry: Map<layerId, ImageBitmap>
    redoStack: [],

    // Pointer Management
    activePointers: new Map(),
    pencilDetected: false,
    maxFingers: 0,
    strokeMade: false,

    // Touch & Gesture
    touchStartTime: 0,
    touchStartPos: null,
    drawingPointerId: null,
    totalDragDistance: 0,
    didInteract: false,
    wasPinching: false,
    wasPanning: false,

    // Pinch Zoom
    isPinching: false,
    lastPinchDist: 0,
    lastPinchCenter: { x: 0, y: 0 },
    initialPinchDist: 0,
    initialPinchCenter: { x: 0, y: 0 },

    // Pan (Palm mode)
    isSpacePressed: false,
    isCtrlPressed: false,
    isAltPressed: false,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panStartTranslateX: 0,
    panStartTranslateY: 0,

    // Drawing States
    isLassoing: false,
    lassoPoints: [],

    isPenDrawing: false,
    lastPenPoint: null,
    isErasing: false,

    // Save Mode
    isSaveMode: false,
    selectionStart: null,
    selectionEnd: null,
    confirmedSelection: null,
    selectedAspect: 'free',
    selectedScale: 1,

    // Brush Sizes
    penSize: 2,
    eraserSize: 5
};
