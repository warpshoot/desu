import { makeDefaultBrushes, makeDefaultFillSlots, makeDefaultEraserSlots } from './brushes.js';

// キャンバス用 DPR: iOS 3x 等で 6000×6000 になるのを防ぐため 2 に上限設定
// 2x で十分なシャープさを保ちつつ、GPU/メモリ負荷を大幅削減
export const CANVAS_DPR = Math.min(window.devicePixelRatio || 1, 2);
// ============================================
// DOM Elements - Utility Canvases (always present)
// ============================================
export let canvasBg = null;
export let lassoCanvas = null;
export let lassoCtx = null;
export let selectionCanvas = null;
export let eventCanvas = null;
export let layerContainer = null;
export let strokeCanvas = null;
export let strokeCtx = null;

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
    strokeCanvas = document.getElementById('stroke-canvas');
    strokeCtx = strokeCanvas.getContext('2d');
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
    
    // Use fixed paper size; fall back to current viewport only if not yet initialized
    const w = state.paperW || 2000;
    const h = state.paperH || 2000;

    canvas.width = w * CANVAS_DPR;
    canvas.height = h * CANVAS_DPR;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.scale(CANVAS_DPR, CANVAS_DPR);
    ctx.clearRect(0, 0, w, h);

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

/**
 * Merge a layer into the one below it
 * id: ID of the layer to merge down
 */
export function mergeLayerDown(id) {
    const index = layers.findIndex(l => l.id === id);
    if (index === -1) return false;
    if (index === 0) return false; // Bottom-most layer cannot merge down

    const topLayer = layers[index];
    const bottomLayer = layers[index - 1];

    // Draw top layer onto bottom layer
    // Use globalAlpha to preserve top layer's opacity
    bottomLayer.ctx.save();
    bottomLayer.ctx.globalAlpha = topLayer.opacity;
    bottomLayer.ctx.drawImage(topLayer.canvas, 0, 0, topLayer.canvas.width / CANVAS_DPR, topLayer.canvas.height / CANVAS_DPR);
    bottomLayer.ctx.restore();

    // Remove the top layer
    topLayer.canvas.remove();
    layers.splice(index, 1);

    updateLayerZIndices();

    // If the merged layer was active, set active layer to the bottom one (now merged)
    if (state.activeLayer === id) {
        state.activeLayer = bottomLayer.id;
    }

    return true;
}

// ============================================
// State Object to manage application state
// ============================================
export const state = {
    // Color State
    inkColor: '#000000',
    canvasColor: '#ffffff',

    // Tool settings — 4-mode architecture
    // mode:    'pen' (freehand stroke) | 'fill' (lasso/bucket) | 'eraser' (erase) | 'select' (selection)
    // subTool: per-mode sub-tool selection
    //   pen:    'pen' | 'stipple'
    //   fill:   'fill' | 'tone'
    //   eraser: 'pen' | 'lasso'
    //   select: 'rect' | 'lasso'
    mode: 'pen',
    subTool: 'pen',

    // Backward-compatible getters (used by pen.js, fill.js, ui.js internals)
    get currentTool() {
        if (this.mode === 'eraser') return this.mode;
        return this.subTool;
    },
    get isEraserActive() { return this.mode === 'eraser'; },
    get currentEraser() { return this.mode === 'eraser' ? this.subTool : 'pen'; },
    get isErasing() { return this.mode === 'eraser' && this.subTool === 'pen'; },
    set isErasing(_v) { /* no-op: derived from mode */ },

    activeLayer: 1,          // ID of the currently active layer
    pressureEnabled: true,   // toggle for smooth brush vs binary brush

    // Brush Palette — ペンカテゴリスロット
    brushes: makeDefaultBrushes(),  // ペンカテゴリスロット (各スロットに subTool 属性あり)
    activeBrushIndex: 0,            // 現在選択中のペンスロット番号
    get activeBrush() { return this.brushes[this.activeBrushIndex]; },

    // 塗り/投げ縄カテゴリスロット
    fillSlots: makeDefaultFillSlots(),
    activeFillSlotIndex: 0,
    get activeFillSlot() { return this.fillSlots[this.activeFillSlotIndex]; },

    // 消しゴムカテゴリスロット
    eraserSlots: makeDefaultEraserSlots(),
    activeEraserSlotIndex: 0,
    get activeEraserSlot() { return this.eraserSlots[this.activeEraserSlotIndex]; },

    // Fixed canvas paper size (set once at first init, never changes)
    paperW: 0,
    paperH: 0,

    // Zoom & Pan
    scale: 1,
    translateX: 0,
    translateY: 0,

    // Global History (unified, no per-layer stacks)
    MAX_HISTORY: 20,
    undoStack: [],   // Each entry: Map<layerId, ImageBitmap>
    redoStack: [],

    // Pointer Management
    activePointers: new Map(),
    pencilDetected: false,
    _pencilResetTimer: null,
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
    isShiftPressed: false,
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
    // isErasing is defined as a getter above (line ~222) — do NOT redeclare here

    // Save Mode
    isSaveMode: false,
    selectionStart: null,
    selectionEnd: null,
    confirmedSelection: null,
    selectedAspect: 'free',
    selectedScale: 1,

    // Selection Tool
    selectionMask: null,          // { type:'rect'|'lasso', rect?:{x,y,w,h}, points?:[...] }
    floatingSelection: null,      // { imageData, srcX, srcY, w, h, offsetX, offsetY }
    _selectionClipboard: null,    // { imageData, w, h }
    isMovingSelection: false,
    _selMoveStartX: 0,
    _selMoveStartY: 0,

    // Brush Sizes
    penSize: 2,
    eraserSize: 5,
    stippleSize: 31,

    // Tone Menu State
    isToneMenuPinned: false
};
