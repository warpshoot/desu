
import {
    state,
    lineCanvas, lassoCanvas, eventCanvas,
    canvasBg, roughCanvas, fillCanvas
} from './state.js';
import {
    startPenDrawing, drawPenLine, endPenDrawing
} from './tools/pen.js';
import {
    startLasso, updateLasso, finishLasso,
    floodFill, floodFillTransparent, fillPolygonNoAA, fillPolygonTransparent
} from './tools/fill.js';
import {
    getCanvasPoint
} from './utils.js';
import {
    undo, redo, saveState, saveAllStates, restoreLayer
} from './history.js';
import {
    saveRegion, copyToClipboard, exitSaveMode
} from './save.js';
import { applyTransform, updateBackgroundColor, hexToRgba } from './canvas.js';


// ============================================
// UI Initializer
// ============================================

export function initUI() {
    setupPointerEvents();
    setupToolButtons();
    setupColorPickers();
    setupLayerControls();
    setupClearButtons(); // Added this as it was missing from init but defined
    setupZoomControls();
    setupSaveUI();
    setupCreditModal();
    setupOrientationHandler();
    setupKeyboardShortcuts();
    updateBrushSizeVisibility();
}

// ============================================
// Helper Functions (UI Updates)
// ============================================

function updateActiveLayerIndicator() {
    const sketchBtn = document.getElementById('sketchBtn');
    const fillBtn = document.getElementById('fillBtn');
    const penBtn = document.getElementById('penBtn');
    const penBtn2 = document.getElementById('penBtn2');
    const penBtn3 = document.getElementById('penBtn3');

    // Remove active class first
    sketchBtn.classList.remove('layer-active');
    fillBtn.classList.remove('layer-active');
    if (penBtn) penBtn.classList.remove('layer-active');
    if (penBtn2) penBtn2.classList.remove('layer-active');
    if (penBtn3) penBtn3.classList.remove('layer-active');

    // Only show indicator when eraser is active
    if (state.currentTool === 'eraser') {
        if (state.activeLayer === 'rough') {
            sketchBtn.classList.add('layer-active');
        } else if (state.activeLayer === 'fill') {
            fillBtn.classList.add('layer-active');
        } else if (state.activeLayer === 'line') {
            if (penBtn) penBtn.classList.add('layer-active');
        } else if (state.activeLayer === 'line2') {
            if (penBtn2) penBtn2.classList.add('layer-active');
        } else if (state.activeLayer === 'line3') {
            if (penBtn3) penBtn3.classList.add('layer-active');
        }
    }
}

function updateBrushSizeVisibility() {
    const sizeSlider = document.getElementById('size-slider-container');
    if (!sizeSlider) return;

    if (state.currentTool === 'pen' || state.currentTool === 'sketch_pen' || (state.currentTool === 'eraser' && state.eraserMode === 'pen')) {
        sizeSlider.classList.remove('hidden');
    } else {
        sizeSlider.classList.add('hidden');
    }
}

function updateBrushSizeSlider() {
    const brushSizeInput = document.getElementById('brushSize');
    const sizeDisplay = document.getElementById('sizeDisplay');
    if (!brushSizeInput || !sizeDisplay) return;

    let size = state.penSize; // Default or fallback
    if (state.currentTool === 'pen') {
        size = state.penSize;
    } else if (state.currentTool === 'sketch_pen') {
        size = state.sketchPenSize;
    } else if (state.currentTool === 'eraser') {
        size = state.eraserSize;
    }

    brushSizeInput.value = size;
    sizeDisplay.textContent = size;
}

function switchLayer(newLayer) {
    if (state.activeLayer === newLayer) return;

    state.activeLayer = newLayer;

    // Auto-switch tool if not using eraser
    if (state.currentTool !== 'eraser') {
        if (state.activeLayer === 'rough') {
            state.currentTool = 'sketch';
            document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
            document.getElementById('sketchBtn').classList.add('active');
        } else if (state.activeLayer === 'fill') {
            state.currentTool = 'fill';
            document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
            document.getElementById('fillBtn').classList.add('active');
        } else if (state.activeLayer === 'line') {
            state.currentTool = 'pen';
            document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
            document.getElementById('penBtn').classList.add('active');
        } else if (state.activeLayer === 'line2') {
            state.currentTool = 'pen';
            document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
            document.getElementById('penBtn2').classList.add('active');
        } else if (state.activeLayer === 'line3') {
            state.currentTool = 'pen';
            document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
            document.getElementById('penBtn3').classList.add('active');
        }
    }

    updateActiveLayerIndicator();
    updateBrushSizeVisibility();
    if (state.currentTool === 'pen') {
        updateBrushSizeSlider();
    }
}


// ============================================
// Event Listeners Setup
// ============================================

function setupPointerEvents() {
    // --- pointerdown ---
    eventCanvas.addEventListener('pointerdown', (e) => {
        if (state.isSaveMode) return;

        // Don't handle events from interactive UI elements (sliders, buttons)
        // This prevents interference with UI controls, especially with pen tablets
        // But still allow gesture detection (undo/redo) to work
        const isInteractiveUI = e.target.tagName === 'INPUT' ||
                                e.target.tagName === 'BUTTON' ||
                                e.target.closest('.tool-btn') ||
                                e.target.closest('.layer-visible-btn') ||
                                e.target.closest('.save-btn') ||
                                e.target.closest('.option-btn');

        if (isInteractiveUI) return;

        e.preventDefault();
        eventCanvas.setPointerCapture(e.pointerId);
        state.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        // console.log('pointerdown - id:', e.pointerId, 'type:', e.pointerType);

        if (e.pointerType === 'pen') {
            state.pencilDetected = true;
        }

        if (state.activePointers.size === 1) {
            state.touchStartTime = Date.now();
            state.touchStartPos = { x: e.clientX, y: e.clientY };
            state.maxFingers = 1;
            state.isPinching = false;
            state.strokeMade = false;
        }
        state.maxFingers = Math.max(state.maxFingers, state.activePointers.size);

        // 2 fingers = Pinch/Pan
        if (state.activePointers.size === 2) {
            state.isLassoing = false;
            lassoCanvas.style.display = 'none';
            state.isPinching = false;

            const pts = Array.from(state.activePointers.values());
            state.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            state.lastPinchCenter = {
                x: (pts[0].x + pts[1].x) / 2,
                y: (pts[0].y + pts[1].y) / 2
            };
            state.initialPinchDist = state.lastPinchDist;
            state.initialPinchCenter = { x: state.lastPinchCenter.x, y: state.lastPinchCenter.y };
            return;
        }

        // Palm Mode (Space key)
        if (state.activePointers.size === 1 && state.isSpacePressed) {
            state.isPanning = true;
            state.panStartX = e.clientX;
            state.panStartY = e.clientY;
            state.panStartTranslateX = state.translateX;
            state.panStartTranslateY = state.translateY;
            eventCanvas.style.cursor = 'grabbing';
            return;
        }

        const canDraw = e.pointerType === 'pen' || e.pointerType === 'mouse' || (e.pointerType === 'touch' && !state.pencilDetected);

        if (state.activePointers.size === 1 && canDraw) {
            const p = getCanvasPoint(e.clientX, e.clientY);

            // Register this pointer as the drawing pointer
            state.drawingPointerId = e.pointerId;
            state.totalDragDistance = 0;

            if (state.currentTool === 'pen' || state.currentTool === 'sketch_pen') {
                state.isErasing = false;
                startPenDrawing(p.x, p.y);
            } else if (state.currentTool === 'eraser' && state.eraserMode === 'pen') {
                state.isErasing = true;
                startPenDrawing(p.x, p.y);
            } else {
                // sketch or lasso eraser
                startLasso(e.clientX, e.clientY);
            }
        }
    });

    // --- pointermove ---
    eventCanvas.addEventListener('pointermove', (e) => {
        if (!state.activePointers.has(e.pointerId)) return;
        if (state.isSaveMode) return;

        e.preventDefault();
        state.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        // Pinch Zoom / Pan
        if (state.activePointers.size === 2) {
            const pts = Array.from(state.activePointers.values());
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            const center = {
                x: (pts[0].x + pts[1].x) / 2,
                y: (pts[0].y + pts[1].y) / 2
            };

            const distDelta = Math.abs(dist - state.initialPinchDist);
            const centerDelta = Math.hypot(center.x - state.initialPinchCenter.x, center.y - state.initialPinchCenter.y);

            if (distDelta > 10 || centerDelta > 10) {
                state.isPinching = true;
            }

            if (state.isPinching) {
                const zoomFactor = dist / state.lastPinchDist;
                const oldScale = state.scale;
                state.scale = Math.max(0.1, Math.min(20, state.scale * zoomFactor));

                state.translateX = center.x - (center.x - state.translateX) * (state.scale / oldScale);
                state.translateY = center.y - (center.y - state.translateY) * (state.scale / oldScale);

                state.translateX += center.x - state.lastPinchCenter.x;
                state.translateY += center.y - state.lastPinchCenter.y;

                applyTransform();
            }

            state.lastPinchDist = dist;
            state.lastPinchCenter = center;
            return;
        }

        // Palm Pan
        if (state.isPanning && state.activePointers.size === 1) {
            state.translateX = state.panStartTranslateX + (e.clientX - state.panStartX);
            state.translateY = state.panStartTranslateY + (e.clientY - state.panStartY);
            applyTransform();
            return;
        }

        // Drawing - Only process events from the registered drawing pointer
        if (state.drawingPointerId === e.pointerId && state.activePointers.size === 1) {
            const p = getCanvasPoint(e.clientX, e.clientY);

            // Calculate distance for gesture handling
            if (state.lastPenPoint) {
                // Simple Manhattan distance for performance or Euclidian
                state.totalDragDistance += Math.hypot(p.x - state.lastPenPoint.x, p.y - state.lastPenPoint.y);
            }

            if (state.isPenDrawing) {
                drawPenLine(p.x, p.y);
                state.strokeMade = true;
            }

            if (state.isLassoing) {
                updateLasso(e.clientX, e.clientY);
                state.strokeMade = true;
            }
        }
    });

    // --- pointerup ---
    eventCanvas.addEventListener('pointerup', async (e) => {
        if (state.isSaveMode) return;

        // Don't handle events from interactive UI elements
        const isInteractiveUI = e.target.tagName === 'INPUT' ||
                                e.target.tagName === 'BUTTON' ||
                                e.target.closest('.tool-btn') ||
                                e.target.closest('.layer-visible-btn') ||
                                e.target.closest('.save-btn') ||
                                e.target.closest('.option-btn');

        if (isInteractiveUI) return;

        e.preventDefault();
        let skipUndoGestureThisEvent = false;

        if (state.isPanning) {
            state.isPanning = false;
            eventCanvas.style.cursor = state.isSpacePressed ? 'grab' : '';
        }

        if (state.isPenDrawing && state.activePointers.size === 1) {

            // Check for valid undo gesture: 2 fingers, short duration, small drag distance
            const duration = Date.now() - state.touchStartTime;
            if (state.maxFingers === 2 && duration < 400 && state.totalDragDistance < 10) {
                // It was likely a 2-finger tap, so cancel the stroke
                state.isPenDrawing = false;
                state.lastPenPoint = null;
                // Restore layer to last saved state to discard micro-stroke
                restoreLayer(state.activeLayer);
                skipUndoGestureThisEvent = true;
            } else {
                await endPenDrawing();
                skipUndoGestureThisEvent = true;
            }
        }

        if (state.isLassoing) {
            // Logic moved to finishLasso, but we need to handle tap detection here
            // because finishLasso expects to just finish a valid lasso.
            // Tap detection relies on distance check.

            // Calculate total distance to differentiate tap vs lasso
            let totalDist = 0;
            if (state.lassoPoints.length > 0) {
                totalDist = state.lassoPoints.reduce((acc, p, i) => {
                    if (i === 0) return 0;
                    const prev = state.lassoPoints[i - 1];
                    return acc + Math.hypot(p.x - prev.x, p.y - prev.y);
                }, 0);
            }

            if (totalDist < 20 && state.lassoPoints.length > 0) {
                // Tap detected
                if (state.currentTool === 'eraser') {
                    const p = getCanvasPoint(state.lassoPoints[0].x, state.lassoPoints[0].y);
                    floodFillTransparent(p.x, p.y);
                    saveState();
                    state.strokeMade = true;
                } else if (state.currentTool === 'fill') {
                    // Hybrid Fill: Tap => Bucket Fill (Black)
                    const p = getCanvasPoint(state.lassoPoints[0].x, state.lassoPoints[0].y);
                    floodFill(p.x, p.y, [0, 0, 0, 255]);
                    saveState();
                    state.strokeMade = true;
                } else if (state.currentTool === 'sketch') {
                    // Hybrid Sketch: Tap => Bucket Fill (Grey Transparent)
                    const p = getCanvasPoint(state.lassoPoints[0].x, state.lassoPoints[0].y);
                    floodFill(p.x, p.y, [128, 128, 128, 51]); // 20% alpha approx (51/255)
                    // Note: floodFill function assumes opaque override? Need to check fill.js
                    // fillPolygonNoAA handles transparent blend. 
                    // floodFill function normally takes [r,g,b,a] and replaces?
                    // If floodFill is opaque replacement, it might not blend.
                    // For now, let's try. Ideally we use a blend-aware floodfill.
                    // The standard floodFill replaces pixels matching target color.
                    // If we want transparency blend, floodFill algorithm needs update.
                    // But for now let's apply the color.
                    floodFill(p.x, p.y, [128, 128, 128, 51]);
                    saveState();
                    state.strokeMade = true;
                }

                // Reset lasso state
                state.isLassoing = false;
                state.lassoPoints = [];
                lassoCanvas.style.display = 'none';
            } else {
                // Regular lasso finish
                const canvasPoints = finishLasso();

                if (canvasPoints && canvasPoints.length >= 3) {
                    if (state.currentTool === 'sketch' || state.currentTool === 'sketch_pen') {
                        // 20%透明度のグレー、アンチエイリアスなし
                        // Note: sketch_pen usually draws lines, but if user drags it acts as lasso?
                        // If we want sketch_pen to ONLY be pen, we should prevent Lasso start.
                        // But 'startLasso' is default for non-pen tools. 
                        // In pointerdown, we check: if currentTool === 'pen' || currentTool === 'sketch_pen' -> startPenDrawing.
                        // So sketch_pen should NOT reach here unless logic in pointerdown allows it.
                        // Assuming pointerdown handles 'sketch_pen' as PEN.
                        // But 'sketch' tool uses Lasso.

                        // If currentTool is 'sketch', fill grey
                        fillPolygonNoAA(canvasPoints, 128, 128, 128, 0.2);
                        saveState();
                        state.strokeMade = true;
                    } else if (state.currentTool === 'fill' || state.currentTool === 'pen') {
                        // ベタ塗り系: 100%黒
                        // 'pen' might reach here if we allow lassoing with pen tool (e.g. by modifier? or if logic falls through)
                        // But Pen uses startPenDrawing. 
                        // If 'fill' tool: fills black.
                        fillPolygonNoAA(canvasPoints, 0, 0, 0, 1.0);
                        saveState();
                        state.strokeMade = true;
                    } else if (state.currentTool === 'eraser') {
                        // ... existing eraser logic ...
                        if (state.activeLayer === 'line' || state.activeLayer === 'fill' || state.activeLayer === 'line2' || state.activeLayer === 'line3' || state.activeLayer === 'rough') {
                            fillPolygonTransparent(canvasPoints);
                        } else {
                            fillPolygonNoAA(canvasPoints, 255, 255, 255, 1.0);
                        }
                        saveState();
                        state.strokeMade = true;
                    }
                }
            }
        }

        state.activePointers.delete(e.pointerId);

        const wasOneFingerDrawing = state.maxFingers === 1 && state.strokeMade;

        if (state.activePointers.size === 0) {
            const duration = Date.now() - state.touchStartTime;

            if (state.maxFingers >= 2 && duration < 400 && !state.isPinching && !state.strokeMade && !skipUndoGestureThisEvent) {
                if (state.maxFingers === 2) undo();
                if (state.maxFingers === 3) redo();
            }

            state.maxFingers = 0;
            state.touchStartPos = null;
            state.strokeMade = false;
            state.isPinching = false;
        } else if (wasOneFingerDrawing && state.activePointers.size > 0) {
            state.activePointers.clear();
            state.maxFingers = 0;
            state.touchStartPos = null;
            state.strokeMade = false;
            state.isPinching = false;
        }
    });

    eventCanvas.addEventListener('pointercancel', (e) => {
        // Don't handle events from interactive UI elements
        const isInteractiveUI = e.target.tagName === 'INPUT' ||
                                e.target.tagName === 'BUTTON' ||
                                e.target.closest('.tool-btn') ||
                                e.target.closest('.layer-visible-btn') ||
                                e.target.closest('.save-btn') ||
                                e.target.closest('.option-btn');

        if (isInteractiveUI) return;

        state.activePointers.delete(e.pointerId);
        state.isLassoing = false;
        state.isPenDrawing = false;
        state.isPinching = false;
        lassoCanvas.style.display = 'none';
    });

    // Ctrl + Space + Click: Zoom in/out
    eventCanvas.addEventListener('click', (e) => {
        if (state.isSaveMode) return;

        // Don't handle events from interactive UI elements
        const isInteractiveUI = e.target.tagName === 'INPUT' ||
                                e.target.tagName === 'BUTTON' ||
                                e.target.closest('.tool-btn') ||
                                e.target.closest('.layer-visible-btn') ||
                                e.target.closest('.save-btn') ||
                                e.target.closest('.option-btn');

        if (isInteractiveUI) return;

        if (state.activePointers.size === 0) {
            // Skip click if panning or pinching occurred
            if (state.isPanning || state.isPinching) {
                return;
            }

            // Ctrl + Space + Click: Zoom in/out
            if (state.isCtrlPressed && state.isSpacePressed) {
                e.preventDefault();
                const zoomAmount = state.isAltPressed ? 0.8 : 1.25;
                const oldScale = state.scale;
                state.scale = Math.max(0.1, Math.min(20, state.scale * zoomAmount));

                const centerX = e.clientX;
                const centerY = e.clientY;

                state.translateX = centerX - (centerX - state.translateX) * (state.scale / oldScale);
                state.translateY = centerY - (centerY - state.translateY) * (state.scale / oldScale);

                applyTransform();
            }
        }
    });
}

// Long Press State
let currentMenuTargetBtn = null;

function setupToolButtons() {
    // Menu item click handlers (Event Delegation)
    const menuContainer = document.getElementById('tool-mode-menu');
    if (menuContainer) {
        menuContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.menu-item');
            if (!item) return;

            e.stopPropagation(); // prevent closing immediately
            const mode = item.dataset.mode;
            if (currentMenuTargetBtn && mode) {
                applyToolMode(currentMenuTargetBtn, mode);
                hideToolMenu();
            }
        });
    }

    // Close menu on outside click
    document.addEventListener('pointerdown', (e) => {
        if (!e.target.closest('#tool-mode-menu') &&
            !e.target.closest('.tool-btn') &&
            document.getElementById('tool-mode-menu').classList.contains('visible')) {
            hideToolMenu();
        }
    });

    document.querySelectorAll('[data-tool]').forEach(btn => {
        let isLongPressActive = false;
        let longPressTimer = null;

        // Pointer Down: Start Timer
        btn.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.tool-tooltip')) return; // Ignore tooltip clicks if any

            isLongPressActive = false;
            longPressTimer = setTimeout(() => {
                isLongPressActive = true;
                showToolMenu(btn);
            }, 400); // Reduced to 400ms for better feel
        });

        // Pointer Up/Leave/Cancel: Cancel Timer
        const cancelTimer = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };
        btn.addEventListener('pointerup', cancelTimer);
        btn.addEventListener('pointerleave', cancelTimer);
        btn.addEventListener('pointercancel', cancelTimer); // Handle cancellation

        // Click Handler (Short Tap)
        btn.addEventListener('click', (e) => {
            if (isLongPressActive) {
                // Ignore click if long press triggered
                e.stopPropagation();
                e.preventDefault();
                isLongPressActive = false;
                return;
            }

            // --- Existing Tap Logic ---
            const wasActive = btn.classList.contains('active');
            const toolType = btn.dataset.tool;

            if (wasActive) {
                if (btn.id === 'eraserBtn' || toolType === 'eraser') {
                    // Eraser Toggle Logic
                    const nextMode = state.eraserMode === 'lasso' ? 'eraser_pen' : 'eraser_lasso';
                    applyToolMode(btn, nextMode);
                    return;
                }

                // 4-Way Toggle for Layer Buttons (Pen/Fill/Sketch/SketchPen)
                // Cycle: pen -> fill -> sketch -> sketch_pen -> pen ...

                // Determine current mode
                let currentMode = 'pen';
                // Check classes first
                if (btn.classList.contains('fill-mode')) currentMode = 'fill';
                else if (btn.classList.contains('sketch-mode')) currentMode = 'sketch';
                else if (btn.classList.contains('sketch-pen-mode')) currentMode = 'sketch_pen';
                else if (btn.classList.contains('pen-mode')) currentMode = 'pen';
                else {
                    const type = btn.dataset.tool;
                    if (type === 'fill') currentMode = 'fill';
                    else if (type === 'sketch') currentMode = 'sketch';
                    else currentMode = 'pen';
                }

                let nextMode = 'pen';
                if (currentMode === 'pen') nextMode = 'fill';
                else if (currentMode === 'fill') nextMode = 'sketch';
                else if (currentMode === 'sketch') nextMode = 'sketch_pen';
                else if (currentMode === 'sketch_pen') nextMode = 'pen';

                applyToolMode(btn, nextMode);
                return;
            }

            // --- Switch Tool (Inactive -> Active) ---
            activateTool(btn);
        });
    });

    // Sync Initial State from HTML
    const activeBtn = document.querySelector('.tool-btn.active');
    if (activeBtn) {
        activateTool(activeBtn);
    }
}

function activateTool(btn) {
    const toolType = btn.dataset.tool;

    // Check button state to set correct tool
    let selectedTool = 'pen'; // Default
    if (toolType === 'eraser') selectedTool = 'eraser';
    else if (btn.classList.contains('fill-mode')) selectedTool = 'fill';
    else if (btn.classList.contains('sketch-mode')) selectedTool = 'sketch';
    else if (btn.classList.contains('sketch-pen-mode')) selectedTool = 'sketch_pen';
    else if (btn.classList.contains('pen-mode')) selectedTool = 'pen';
    else {
        // Fallback to data-tool
        const type = btn.dataset.tool;
        if (type === 'fill') selectedTool = 'fill';
        else if (type === 'sketch') selectedTool = 'sketch';
        else selectedTool = 'pen';
    }

    state.currentTool = selectedTool;

    if (btn.dataset.layer) {
        state.activeLayer = btn.dataset.layer;
    }

    document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    updateActiveLayerIndicator();
    updateBrushSizeVisibility();
    updateBrushSizeSlider();

    // Flash the layer to indicate selection (Only on Activation)
    if (btn.dataset.layer) {
        flashLayer(btn.dataset.layer);
    }
}

// Helper to apply mode logic (used by both Cycle and Menu)
function applyToolMode(btn, mode) {
    // Check if Eraser Mode
    if (mode === 'eraser_lasso' || mode === 'eraser_pen') {
        state.eraserMode = (mode === 'eraser_pen') ? 'pen' : 'lasso';
        const tooltip = btn.querySelector('.tool-tooltip');

        if (state.eraserMode === 'pen') {
            btn.classList.add('pen-mode');
            if (tooltip) tooltip.textContent = '消ペン (6)';
        } else {
            btn.classList.remove('pen-mode');
            if (tooltip) tooltip.textContent = '投げ縄消し/消しつぶし (6)';
        }

        // Active tool update if currently active
        // state.currentTool is simply 'eraser' for both, but behavior depends on eraserMode
        if (btn.classList.contains('active')) {
            updateBrushSizeSlider(); // Brush size might change context
            updateBrushSizeVisibility();
        }
        return;
    }

    // Normal Tool Modes
    // Reset Classes
    btn.classList.remove('fill-mode', 'sketch-mode', 'sketch-pen-mode', 'pen-mode');

    let nextTool = 'pen';
    let tooltipText = '';

    let shortcut = '';
    if (btn.id === 'penBtn') shortcut = ' (1)';
    else if (btn.id === 'penBtn2') shortcut = ' (2)';
    else if (btn.id === 'penBtn3') shortcut = ' (3)';
    else if (btn.id === 'fillBtn') shortcut = ' (4)';
    else if (btn.id === 'sketchBtn') shortcut = ' (5)';
    else if (btn.id === 'eraserBtn') shortcut = ' (6)';

    if (mode === 'pen') {
        nextTool = 'pen';
        tooltipText = 'ペン' + shortcut;
    } else if (mode === 'fill') {
        nextTool = 'fill';
        tooltipText = '投げ縄塗り/塗りつぶし' + shortcut;
    } else if (mode === 'sketch') {
        nextTool = 'sketch';
        tooltipText = '薄投げ縄塗り/薄塗りつぶし' + shortcut;
    } else if (mode === 'sketch_pen') {
        nextTool = 'sketch_pen';
        tooltipText = '薄ペン' + shortcut;
    }

    // Add Mode Class
    if (mode === 'fill') btn.classList.add('fill-mode');
    else if (mode === 'sketch') btn.classList.add('sketch-mode');
    else if (mode === 'sketch_pen') btn.classList.add('sketch-pen-mode');
    else if (mode === 'pen') btn.classList.add('pen-mode');

    // Update State (only if button is active)
    if (btn.classList.contains('active')) {
        state.currentTool = nextTool;
        updateBrushSizeVisibility();
        updateBrushSizeSlider();
    }

    // Update Tooltip
    const tooltip = btn.querySelector('.tool-tooltip');
    if (tooltip) tooltip.textContent = tooltipText;

    // NO Flash here (per user request: only on tool switch, not mode switch)
}

function showToolMenu(btn) {
    // Auto-activate tool if not active
    if (!btn.classList.contains('active')) {
        activateTool(btn);
    }

    const menu = document.getElementById('tool-mode-menu');
    currentMenuTargetBtn = btn;

    // Determine Menu Type (Eraser vs Drawing)
    const isEraser = (btn.id === 'eraserBtn' || btn.dataset.tool === 'eraser');

    // Toggle Menu Items Visibility
    if (isEraser) {
        menu.querySelectorAll('.drawing-mode').forEach(el => el.style.display = 'none');
        menu.querySelectorAll('.eraser-mode').forEach(el => el.style.display = 'flex');
    } else {
        menu.querySelectorAll('.drawing-mode').forEach(el => el.style.display = 'flex');
        menu.querySelectorAll('.eraser-mode').forEach(el => el.style.display = 'none');
    }

    // Highlight current selection
    menu.querySelectorAll('.menu-item').forEach(item => item.classList.remove('selected'));

    let currentMode;
    if (isEraser) {
        currentMode = (state.eraserMode === 'pen') ? 'eraser_pen' : 'eraser_lasso';
    } else {
        currentMode = 'pen';
        if (btn.classList.contains('fill-mode')) currentMode = 'fill';
        else if (btn.classList.contains('sketch-mode')) currentMode = 'sketch';
        else if (btn.classList.contains('sketch-pen-mode')) currentMode = 'sketch_pen';
        else if (btn.classList.contains('pen-mode')) currentMode = 'pen';
        else {
            const type = btn.dataset.tool;
            if (type === 'fill') currentMode = 'fill';
            else if (type === 'sketch') currentMode = 'sketch';
        }
    }

    const selectedItem = menu.querySelector(`.menu-item[data-mode="${currentMode}"]`);
    if (selectedItem) selectedItem.classList.add('selected');

    // Position Menu
    const rect = btn.getBoundingClientRect();
    const isLeft = rect.left < window.innerWidth / 2;
    const isBottom = rect.top > window.innerHeight / 2;

    // Horizontal
    if (isLeft) {
        menu.style.left = `${rect.right + 10}px`;
        menu.style.right = 'auto';
    } else {
        menu.style.right = `${window.innerWidth - rect.left + 10}px`;
        menu.style.left = 'auto';
    }

    // Vertical
    if (isBottom) {
        // Show upwards from bottom aligned with button bottom
        menu.style.bottom = `${window.innerHeight - rect.bottom}px`;
        menu.style.top = 'auto';
    } else {
        // Show downwards from top
        menu.style.top = `${rect.top}px`;
        menu.style.bottom = 'auto';
    }

    menu.classList.remove('hidden');
    requestAnimationFrame(() => menu.classList.add('visible'));
}

function hideToolMenu() {
    const menu = document.getElementById('tool-mode-menu');
    menu.classList.remove('visible');
    setTimeout(() => {
        if (!menu.classList.contains('visible')) {
            // menu.classList.add('hidden'); // hidden class logic handled by opacity transition?
            // Actually hidden class is good for pointer events.
            // But CSS handles opacity. Let's just keep it simple.
        }
    }, 200);
}

function flashLayer(layerName) {
    const layerMap = {
        'rough': 'canvas-rough',
        'fill': 'canvas-fill',
        'line': 'canvas-line',
        'line2': 'canvas-line-2',
        'line3': 'canvas-line-3'
    };

    const canvasId = layerMap[layerName];
    if (!canvasId) return;

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Reset animation
    canvas.classList.remove('layer-flash');
    void canvas.offsetWidth; // Trigger reflow

    // Start animation
    canvas.classList.add('layer-flash');

    // Remove class after animation ends to clean up
    setTimeout(() => {
        canvas.classList.remove('layer-flash');
    }, 500);
}

function hideAllOpacitySliders() {
    document.querySelectorAll('.opacity-slider-container').forEach(c => c.classList.remove('visible'));
}

function showOpacitySlider(containerId) {
    hideAllOpacitySliders();
    const container = document.getElementById(containerId);
    if (container) container.classList.add('visible');
}

function setupColorPickers() {
    const bgBtn = document.getElementById('bgColorBtn');

    if (bgBtn) {
        bgBtn.addEventListener('input', (e) => {
            updateBackgroundColor(e.target.value);
        });
        bgBtn.addEventListener('change', (e) => {
            saveState();
        });
    }
}

function setupLayerControls() {
    // Visibility Toggles + Long Press for Opacity Slider
    const layerConfig = [
        { btnId: 'lineVisibleBtn', stateKey: 'lineVisible', canvasEl: lineCanvas, sliderId: 'lineOpacityContainer' },
        { btnId: 'line2VisibleBtn', stateKey: 'line2Visible', canvasId: 'canvas-line-2', sliderId: 'line2OpacityContainer' },
        { btnId: 'line3VisibleBtn', stateKey: 'line3Visible', canvasId: 'canvas-line-3', sliderId: 'line3OpacityContainer' },
        { btnId: 'fillVisibleBtn', stateKey: 'fillVisible', canvasEl: fillCanvas, sliderId: 'fillOpacityContainer' },
        { btnId: 'roughVisibleBtn', stateKey: 'roughVisible', canvasEl: roughCanvas, sliderId: 'roughOpacityContainer' }
    ];

    layerConfig.forEach(({ btnId, stateKey, canvasEl, canvasId, sliderId }) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;

        let longPressTimer = null;
        let isLongPress = false;

        btn.addEventListener('pointerdown', () => {
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                showOpacitySlider(sliderId);
            }, 400);
        });

        const cancelTimer = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };
        btn.addEventListener('pointerup', cancelTimer);
        btn.addEventListener('pointerleave', cancelTimer);
        btn.addEventListener('pointercancel', cancelTimer);

        btn.addEventListener('click', () => {
            if (isLongPress) {
                isLongPress = false;
                return;
            }
            state[stateKey] = !state[stateKey];
            const canvas = canvasEl || document.getElementById(canvasId);
            canvas.style.display = state[stateKey] ? 'block' : 'none';
            btn.classList.toggle('hidden', !state[stateKey]);
        });
    });

    // Dismiss opacity slider on outside click
    document.addEventListener('pointerdown', (e) => {
        if (!e.target.closest('.opacity-slider-container') && !e.target.closest('.layer-visible-btn')) {
            hideAllOpacitySliders();
        }
    });

    // Opacity Sliders
    const roughOpacityInput = document.getElementById('roughOpacity');
    if (roughOpacityInput) {
        roughOpacityInput.addEventListener('input', (e) => {
            state.roughOpacity = parseFloat(e.target.value) / 100;
            roughCanvas.style.opacity = state.roughOpacity;
        });
    }

    const fillOpacityInput = document.getElementById('fillOpacity');
    if (fillOpacityInput) {
        fillOpacityInput.addEventListener('input', (e) => {
            state.fillOpacity = parseFloat(e.target.value) / 100;
            fillCanvas.style.opacity = state.fillOpacity;
        });
    }

    const lineOpacityInput = document.getElementById('lineOpacity');
    if (lineOpacityInput) {
        lineOpacityInput.addEventListener('input', (e) => {
            state.lineOpacity = parseFloat(e.target.value) / 100;
            lineCanvas.style.opacity = state.lineOpacity;
        });
    }

    const line2OpacityInput = document.getElementById('line2Opacity');
    if (line2OpacityInput) {
        line2OpacityInput.addEventListener('input', (e) => {
            state.line2Opacity = parseFloat(e.target.value) / 100;
            document.getElementById('canvas-line-2').style.opacity = state.line2Opacity;
        });
    }

    const line3OpacityInput = document.getElementById('line3Opacity');
    if (line3OpacityInput) {
        line3OpacityInput.addEventListener('input', (e) => {
            state.line3Opacity = parseFloat(e.target.value) / 100;
            document.getElementById('canvas-line-3').style.opacity = state.line3Opacity;
        });
    }

    // Brush Size
    const brushSizeInput = document.getElementById('brushSize');
    const sizeDisplay = document.getElementById('sizeDisplay');
    if (brushSizeInput && sizeDisplay) {
        brushSizeInput.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            sizeDisplay.textContent = val;
            if (state.currentTool === 'pen') {
                state.penSize = val;
            } else if (state.currentTool === 'sketch_pen') {
                state.sketchPenSize = val;
            } else if (state.currentTool === 'eraser') {
                state.eraserSize = val;
            }
        });
    }
}

function setupClearButtons() {
    document.getElementById('clearBtn').addEventListener('click', () => {
        roughCanvas.getContext('2d').clearRect(0, 0, roughCanvas.width, roughCanvas.height);
        fillCanvas.getContext('2d').clearRect(0, 0, fillCanvas.width, fillCanvas.height);
        lineCanvas.getContext('2d').clearRect(0, 0, lineCanvas.width, lineCanvas.height);
        document.getElementById('canvas-line-2').getContext('2d').clearRect(0, 0, lineCanvas.width, lineCanvas.height);
        document.getElementById('canvas-line-3').getContext('2d').clearRect(0, 0, lineCanvas.width, lineCanvas.height);

        saveAllStates();

        const btn = document.getElementById('clearBtn');
        const tooltip = btn.querySelector('.tool-tooltip');
        const originalText = tooltip.textContent;
        tooltip.textContent = '全消去しました';
        setTimeout(() => tooltip.textContent = originalText, 2000);
    });

    const layerClearBtn = document.getElementById('layerClearBtn');
    if (layerClearBtn) {
        layerClearBtn.addEventListener('click', () => {
            if (state.activeLayer === 'rough') {
                const ctx = roughCanvas.getContext('2d');
                ctx.clearRect(0, 0, roughCanvas.width, roughCanvas.height);
            } else if (state.activeLayer === 'fill') {
                fillCanvas.getContext('2d').clearRect(0, 0, fillCanvas.width, fillCanvas.height);
            } else if (state.activeLayer === 'line') {
                lineCanvas.getContext('2d').clearRect(0, 0, lineCanvas.width, lineCanvas.height);
            } else if (state.activeLayer === 'line2') {
                const l2 = document.getElementById('canvas-line-2');
                l2.getContext('2d').clearRect(0, 0, l2.width, l2.height);
            } else if (state.activeLayer === 'line3') {
                const l3 = document.getElementById('canvas-line-3');
                l3.getContext('2d').clearRect(0, 0, l3.width, l3.height);
            }
            saveState();

            // Visual feedback
            layerClearBtn.classList.add('active');
            setTimeout(() => layerClearBtn.classList.remove('active'), 200);

            const tooltip = layerClearBtn.querySelector('.tool-tooltip');
            const originalText = tooltip.textContent;
            tooltip.textContent = 'レイヤー消去しました';
            setTimeout(() => tooltip.textContent = originalText, 1000);
        });
    }
}

function setupZoomControls() {
    document.getElementById('resetZoomBtn').addEventListener('click', () => {
        state.scale = 1;
        state.translateX = 0;
        state.translateY = 0;
        applyTransform();
    });
}

function setupSaveUI() {
    // Open Save UI
    document.getElementById('saveBtn').addEventListener('click', () => {
        state.isSaveMode = true;
        document.getElementById('save-overlay').style.display = 'block';
        document.getElementById('save-ui').style.display = 'block';
        document.getElementById('selection-canvas').style.display = 'block';
        document.getElementById('toolbar-left').style.display = 'none';
        document.getElementById('toolbar-right').style.display = 'none';
        document.getElementById('resetZoomBtn').style.display = 'none';
    });

    // Close / Cancel
    document.getElementById('cancelSaveBtn').addEventListener('click', exitSaveMode);

    // Save All
    document.getElementById('saveAllBtn').addEventListener('click', () => {
        saveRegion(0, 0, roughCanvas.width, roughCanvas.height);
    });

    // Confirm Selection
    document.getElementById('confirmSelectionBtn').addEventListener('click', () => {
        if (state.confirmedSelection) {
            saveRegion(state.confirmedSelection.x, state.confirmedSelection.y, state.confirmedSelection.w, state.confirmedSelection.h);
        }
    });

    // Copy
    document.getElementById('copyClipboardBtn').addEventListener('click', async () => {
        if (state.confirmedSelection) {
            await copyToClipboard(state.confirmedSelection.x, state.confirmedSelection.y, state.confirmedSelection.w, state.confirmedSelection.h);
        }
    });

    // Redo Selection
    document.getElementById('redoSelectionBtn').addEventListener('click', () => {
        state.confirmedSelection = null;
        const sizeDisplay = document.getElementById('selection-size');
        if (sizeDisplay) sizeDisplay.style.display = 'none';
        document.getElementById('save-ui').classList.remove('in-confirmation-mode');
        document.getElementById('confirmSelectionBtn').style.display = 'none';
        document.getElementById('copyClipboardBtn').style.display = 'none';
        document.getElementById('redoSelectionBtn').style.display = 'none';

        const selCanvas = document.getElementById('selection-canvas');
        selCanvas.getContext('2d').clearRect(0, 0, selCanvas.width, selCanvas.height);
    });

    // Aspect Ratio
    document.querySelectorAll('[data-aspect]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-aspect]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedAspect = btn.dataset.aspect;
        });
    });

    // Scale
    document.querySelectorAll('[data-scale]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-scale]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedScale = parseInt(btn.dataset.scale);

            if (state.confirmedSelection) {
                const sizeDisplay = document.getElementById('selection-size');
                if (sizeDisplay) {
                    const finalW = state.confirmedSelection.w * state.selectedScale;
                    const finalH = state.confirmedSelection.h * state.selectedScale;
                    sizeDisplay.textContent = `${finalW}px × ${finalH}px`;
                }
            }
        });
    });

    // Overlay Events for Selection
    const overlay = document.getElementById('save-overlay');

    overlay.addEventListener('pointerdown', (e) => {
        if (!state.isSaveMode) return;
        state.selectionStart = { x: e.clientX, y: e.clientY };
        state.selectionEnd = { x: e.clientX, y: e.clientY };
        document.getElementById('save-ui').classList.add('hidden-during-selection');
    });

    document.getElementById('save-ui').addEventListener('pointerdown', (e) => {
        if (e.target.closest('button, input, label')) return;
        if (!state.isSaveMode) return;
        state.selectionStart = { x: e.clientX, y: e.clientY };
        state.selectionEnd = { x: e.clientX, y: e.clientY };
        document.getElementById('save-ui').classList.add('hidden-during-selection');
    });

    overlay.addEventListener('pointermove', (e) => {
        if (!state.isSaveMode || !state.selectionStart) return;
        state.selectionEnd = { x: e.clientX, y: e.clientY };

        const selCanvas = document.getElementById('selection-canvas');
        const selCtx = selCanvas.getContext('2d');
        selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);

        let rectX = state.selectionStart.x;
        let rectY = state.selectionStart.y;
        let rectW = state.selectionEnd.x - state.selectionStart.x;
        let rectH = state.selectionEnd.y - state.selectionStart.y;

        if (state.selectedAspect !== 'free') {
            const aspectRatios = { '1:1': 1, '4:5': 0.8, '16:9': 16 / 9, '9:16': 9 / 16 };
            const ratio = aspectRatios[state.selectedAspect];
            const signW = rectW < 0 ? -1 : 1;
            const signH = rectH < 0 ? -1 : 1;

            if (Math.abs(rectW) / Math.abs(rectH) > ratio) {
                rectW = Math.abs(rectH) * ratio * signW;
            } else {
                rectH = Math.abs(rectW) / ratio * signH;
            }
        }

        selCtx.strokeStyle = '#000';
        selCtx.lineWidth = 2;
        selCtx.setLineDash([8, 8]);
        selCtx.strokeRect(rectX, rectY, rectW, rectH);
    });

    overlay.addEventListener('pointerup', (e) => {
        if (!state.isSaveMode || !state.selectionStart) return;

        // Same logic as pointermove to finalize rect
        state.selectionEnd = { x: e.clientX, y: e.clientY };
        let rectX = state.selectionStart.x;
        let rectY = state.selectionStart.y;
        let rectW = state.selectionEnd.x - state.selectionStart.x;
        let rectH = state.selectionEnd.y - state.selectionStart.y;

        if (state.selectedAspect !== 'free') {
            const aspectRatios = { '1:1': 1, '4:5': 0.8, '16:9': 16 / 9, '9:16': 9 / 16 };
            const ratio = aspectRatios[state.selectedAspect];
            const signW = rectW < 0 ? -1 : 1;
            const signH = rectH < 0 ? -1 : 1;

            if (Math.abs(rectW) / Math.abs(rectH) > ratio) {
                rectW = Math.abs(rectH) * ratio * signW;
            } else {
                rectH = Math.abs(rectW) / ratio * signH;
            }
        }

        // Convert to canvas coordinates
        const x1 = Math.floor((Math.min(rectX, rectX + rectW) - state.translateX) / state.scale);
        const y1 = Math.floor((Math.min(rectY, rectY + rectH) - state.translateY) / state.scale);
        const x2 = Math.floor((Math.max(rectX, rectX + rectW) - state.translateX) / state.scale);
        const y2 = Math.floor((Math.max(rectY, rectY + rectH) - state.translateY) / state.scale);

        const w = x2 - x1;
        const h = y2 - y1;

        if (w > 5 && h > 5) {
            const cx = Math.max(0, Math.min(x1, roughCanvas.width));
            const cy = Math.max(0, Math.min(y1, roughCanvas.height));
            const cw = Math.min(w, roughCanvas.width - cx);
            const ch = Math.min(h, roughCanvas.height - cy);

            if (cw > 0 && ch > 0) {
                state.confirmedSelection = { x: cx, y: cy, w: cw, h: ch };

                const sizeDisplay = document.getElementById('selection-size');
                if (sizeDisplay) {
                    const finalW = cw * state.selectedScale;
                    const finalH = ch * state.selectedScale;
                    sizeDisplay.textContent = `${finalW}px × ${finalH}px`;
                    sizeDisplay.style.display = 'block';
                }

                document.getElementById('save-ui').classList.add('in-confirmation-mode');
                document.getElementById('save-ui').classList.remove('hidden-during-selection');
                document.getElementById('confirmSelectionBtn').style.display = 'inline-block';
                document.getElementById('copyClipboardBtn').style.display = 'inline-block';
                document.getElementById('redoSelectionBtn').style.display = 'inline-block';
            }
        } else {
            exitSaveMode();
        }

        state.selectionStart = null;
        state.selectionEnd = null;
    });
}

function setupCreditModal() {
    document.getElementById('credit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('credit-modal').classList.add('visible');
        document.body.classList.add('help-mode');
    });

    document.getElementById('credit-modal').addEventListener('click', (e) => {
        if (e.target.id === 'credit-modal') {
            document.getElementById('credit-modal').classList.remove('visible');
            document.body.classList.remove('help-mode');
        }
    });

    document.addEventListener('click', (e) => {
        if (!document.body.classList.contains('help-mode')) return;
        const creditContent = document.getElementById('credit-content');
        if (creditContent.contains(e.target)) return;

        e.preventDefault();
        e.stopPropagation();
        document.getElementById('credit-modal').classList.remove('visible');
        document.body.classList.remove('help-mode');
    }, true);
}

function setupOrientationHandler() {
    window.addEventListener('orientationchange', () => {
        setTimeout(async () => {
            const roughBitmap = await createImageBitmap(roughCanvas);
            const fillBitmap = await createImageBitmap(fillCanvas);
            const lineBitmap = await createImageBitmap(lineCanvas);

            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;

            // Resize rough
            roughCanvas.width = newWidth;
            roughCanvas.height = newHeight;
            const ctxR = roughCanvas.getContext('2d');
            ctxR.fillStyle = '#fff';
            ctxR.fillRect(0, 0, newWidth, newHeight);
            ctxR.drawImage(roughBitmap, 0, 0);
            roughBitmap.close();

            // Resize fill
            fillCanvas.width = newWidth;
            fillCanvas.height = newHeight;
            fillCanvas.getContext('2d').drawImage(fillBitmap, 0, 0);
            fillBitmap.close();

            // Resize line
            lineCanvas.width = newWidth;
            lineCanvas.height = newHeight;
            lineCanvas.getContext('2d').drawImage(lineBitmap, 0, 0);
            lineBitmap.close();

            // Update utils
            lassoCanvas.width = newWidth;
            lassoCanvas.height = newHeight;
            document.getElementById('selection-canvas').width = newWidth;
            document.getElementById('selection-canvas').height = newHeight;
            document.getElementById('canvas-background').style.width = newWidth + 'px';
            document.getElementById('canvas-background').style.height = newHeight + 'px';

            // Update event canvas
            eventCanvas.width = newWidth;
            eventCanvas.height = newHeight;

            applyTransform();
        }, 300);
    });
}


function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        if (state.isSaveMode) return;

        // Track modifier keys (always track these)
        if (e.key === 'Control' || e.metaKey) state.isCtrlPressed = true;
        if (e.key === 'Alt') state.isAltPressed = true;

        // Undo / Redo (should work even when INPUT is focused)
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
            e.preventDefault();
            if (e.shiftKey) {
                redo();
            } else {
                undo();
            }
            return;
        } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
            e.preventDefault();
            redo();
            return;
        }

        // Skip other shortcuts if INPUT is focused (e.g., brush size slider)
        if (e.target.tagName === 'INPUT') return;

        // Space key (Palm mode)
        if (e.code === 'Space') {
            state.isSpacePressed = true;
            eventCanvas.style.cursor = state.isCtrlPressed ? 'zoom-in' : 'grab';
        }

        // Tools
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
            switch (e.code) {
                case 'Digit1': // Pen 1
                    document.getElementById('penBtn').click();
                    break;
                case 'Digit2': // Pen 2
                    document.getElementById('penBtn2').click();
                    break;
                case 'Digit3': // Pen 3
                    document.getElementById('penBtn3').click();
                    break;
                case 'Digit4': // Fill
                    document.getElementById('fillBtn').click();
                    break;
                case 'Digit5': // Sketch
                    document.getElementById('sketchBtn').click();
                    break;
                case 'Digit6': // Eraser
                    document.getElementById('eraserBtn').click();
                    break;
                case 'Digit7': // Layer Clear
                    const layerClearBtn = document.getElementById('layerClearBtn');
                    if (layerClearBtn) layerClearBtn.click();
                    break;

                case 'Delete':
                case 'Backspace':
                    // Trigger active layer clear (All Clear or Layer Clear?)
                    // User requested "Del" for "All Clear" in Top Right.
                    // This logic triggers "layerClearBtn" (Top Right? No, Top Right is clearBtn).
                    // Wait, previous step I mapped Del to clearBtn.
                    // I should KEEP Del -> clearBtn (All Clear).
                    const clearBtn = document.getElementById('clearBtn');
                    if (clearBtn) clearBtn.click();
                    break;
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'Control' || e.metaKey) state.isCtrlPressed = false;
        if (e.key === 'Alt') state.isAltPressed = false;

        if (e.code === 'Space') {
            state.isSpacePressed = false;
            eventCanvas.style.cursor = '';
        }
    });
}
