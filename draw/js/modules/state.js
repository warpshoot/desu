// DOM Elements - Canvas
export let canvasBg = null;
export let roughCanvas = null;
export let roughCtx = null;
export let fillCanvas = null;
export let fillCtx = null;
export let lineCanvas = null;
export let lineCtx = null;
export let line2Canvas = null;
export let line2Ctx = null;
export let line3Canvas = null;
export let line3Ctx = null;
export let lassoCanvas = null;
export let lassoCtx = null;
export let selectionCanvas = null;

export function initDOM() {
    canvasBg = document.getElementById('canvas-background');

    roughCanvas = document.getElementById('canvas-rough');
    roughCtx = roughCanvas.getContext('2d', { willReadFrequently: true });

    fillCanvas = document.getElementById('canvas-fill');
    fillCtx = fillCanvas.getContext('2d', { willReadFrequently: true });

    lineCanvas = document.getElementById('canvas-line');
    lineCtx = lineCanvas.getContext('2d', { willReadFrequently: true });

    line2Canvas = document.getElementById('canvas-line-2');
    line2Ctx = line2Canvas.getContext('2d', { willReadFrequently: true });

    line3Canvas = document.getElementById('canvas-line-3');
    line3Ctx = line3Canvas.getContext('2d', { willReadFrequently: true });

    lassoCanvas = document.getElementById('lasso-canvas');
    lassoCtx = lassoCanvas.getContext('2d');

    selectionCanvas = document.getElementById('selection-canvas');
}

// State Object to manage application state
export const state = {
    // Tool settings
    currentTool: 'sketch',  // 'sketch', 'fill', 'pen' or 'eraser'
    activeLayer: 'rough',   // 'rough', 'fill', 'line', 'line2' or 'line3'
    eraserMode: 'lasso',    // 'lasso' or 'pen'

    // Layer visibility
    roughVisible: true,
    fillVisible: true,
    lineVisible: true,
    line2Visible: true,
    line3Visible: true,

    roughOpacity: 1.0,
    fillOpacity: 1.0,
    lineOpacity: 1.0,
    line2Opacity: 1.0,
    line3Opacity: 1.0,

    // Zoom & Pan
    scale: 1,
    translateX: 0,
    translateY: 0,

    // History Stacks
    MAX_HISTORY: 15,
    roughUndoStack: [],
    roughRedoStack: [],
    fillUndoStack: [],
    fillRedoStack: [],
    lineUndoStack: [],
    lineRedoStack: [],
    line2UndoStack: [],
    line2RedoStack: [],
    line3UndoStack: [],
    line3RedoStack: [],

    // Pointer Management
    activePointers: new Map(),
    pencilDetected: false,
    maxFingers: 0,
    strokeMade: false,

    // Touch & Gesture
    touchStartTime: 0,
    touchStartPos: null,
    drawingPointerId: null, // ID of the pointer responsible for drawing
    totalDragDistance: 0,   // Total distance moved during the current gesture

    // Pinch Zoom
    isPinching: false,
    lastPinchDist: 0,
    lastPinchCenter: { x: 0, y: 0 },
    initialPinchDist: 0,
    initialPinchCenter: { x: 0, y: 0 },

    // Pan (Palm mode)
    isSpacePressed: false,
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
