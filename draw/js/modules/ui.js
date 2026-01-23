
import {
    state,
    lineCanvas, lassoCanvas,
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
    undo, redo, saveState, saveAllStates
} from './history.js';
import {
    saveRegion, copyToClipboard, exitSaveMode
} from './save.js';
import { applyTransform } from './canvas.js';


// ============================================
// UI Initializer
// ============================================

export function initUI() {
    setupPointerEvents();
    setupToolButtons();
    setupLayerControls();
    setupClearButtons();
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

    if (state.currentTool === 'pen' || (state.currentTool === 'eraser' && state.eraserMode === 'pen')) {
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
    lineCanvas.addEventListener('pointerdown', (e) => {
        if (state.isSaveMode) return;

        e.preventDefault();
        lineCanvas.setPointerCapture(e.pointerId);
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
            lineCanvas.style.cursor = 'grabbing';
            return;
        }

        const canDraw = e.pointerType === 'pen' || e.pointerType === 'mouse' || (e.pointerType === 'touch' && !state.pencilDetected);

        if (state.activePointers.size === 1 && canDraw) {
            const p = getCanvasPoint(e.clientX, e.clientY);

            // Register this pointer as the drawing pointer
            state.drawingPointerId = e.pointerId;
            state.totalDragDistance = 0;

            if (state.currentTool === 'pen') {
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
    lineCanvas.addEventListener('pointermove', (e) => {
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
    lineCanvas.addEventListener('pointerup', async (e) => {
        if (state.isSaveMode) return;

        e.preventDefault();
        let skipUndoGestureThisEvent = false;

        if (state.isPanning) {
            state.isPanning = false;
            lineCanvas.style.cursor = state.isSpacePressed ? 'grab' : '';
        }

        if (state.isPenDrawing && state.activePointers.size === 1) {

            // Check for valid undo gesture: 2 fingers, short duration, small drag distance
            const duration = Date.now() - state.touchStartTime;
            if (state.maxFingers === 2 && duration < 400 && state.totalDragDistance < 10) {
                // It was likely a 2-finger tap, so cancel the stroke
                state.isPenDrawing = false;
                state.lastPenPoint = null;
                // Force undo to clean up the micro-stroke
                undo();
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
                    const startP = state.lassoPoints[0]; // Canvas relative? No, lassoPoints are stored as clientXY in startLasso??
                    // Wait, startLasso stores {x,y} from clientX/Y.
                    const p = getCanvasPoint(state.lassoPoints[0].x, state.lassoPoints[0].y);

                    if (state.activeLayer === 'line') {
                        floodFillTransparent(p.x, p.y);
                    } else {
                        floodFill(p.x, p.y, [255, 255, 255, 255]); // Erase rough with white
                    }
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
                    if (state.currentTool === 'sketch') {
                        // 20%透明度のグレー、アンチエイリアスなし
                        // console.log('Filling polygon with sketch tool');
                        fillPolygonNoAA(canvasPoints, 128, 128, 128, 0.2);
                        saveState();
                        state.strokeMade = true;
                    } else if (state.currentTool === 'fill') {
                        // ベタ塗りツール: 100%黒、アンチエイリアスなし
                        // console.log('Filling polygon with fill tool');
                        fillPolygonNoAA(canvasPoints, 0, 0, 0, 1.0);
                        saveState();
                        state.strokeMade = true;
                    } else if (state.currentTool === 'pen') {
                        // ペンツール: 投げ縄で100%黒塗り
                        // console.log('Filling polygon with pen tool');
                        fillPolygonNoAA(canvasPoints, 0, 0, 0, 1.0);
                        saveState();
                        state.strokeMade = true;
                    } else if (state.currentTool === 'eraser') {
                        // console.log('Filling polygon with eraser tool');
                        if (state.activeLayer === 'line' || state.activeLayer === 'fill') {
                            // ペン入れレイヤー・ベタレイヤー: 透明で塗りつぶし
                            fillPolygonTransparent(canvasPoints);
                        } else {
                            // アタリレイヤー: 白で塗りつぶし
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

    lineCanvas.addEventListener('pointercancel', (e) => {
        state.activePointers.delete(e.pointerId);
        state.isLassoing = false;
        state.isPenDrawing = false;
        state.isPinching = false;
        lassoCanvas.style.display = 'none';
    });
}

function setupToolButtons() {
    document.querySelectorAll('[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            const wasActive = btn.classList.contains('active');
            const newTool = btn.dataset.tool;

            if (wasActive && newTool !== 'eraser') {
                // Toggle opacity slider
                const containerIdMap = {
                    'sketch': 'roughOpacityContainer',
                    'fill': 'fillOpacityContainer',
                    'pen': state.activeLayer === 'line2' ? 'line2OpacityContainer' : (state.activeLayer === 'line3' ? 'line3OpacityContainer' : 'lineOpacityContainer')
                };

                // Special check for pen buttons to ensure we toggle the correct container for the clicked button
                // (Since data-tool is same 'pen' for all 3 buttons)
                let targetContainerId = containerIdMap[newTool];

                if (newTool === 'pen') {
                    if (btn.dataset.layer === 'line') targetContainerId = 'lineOpacityContainer';
                    else if (btn.dataset.layer === 'line2') targetContainerId = 'line2OpacityContainer';
                    else if (btn.dataset.layer === 'line3') targetContainerId = 'line3OpacityContainer';
                }

                const container = document.getElementById(targetContainerId);
                if (container) container.classList.toggle('visible');
                return;
            }

            if (wasActive && newTool === 'eraser') {
                // Toggle Eraser Mode
                state.eraserMode = state.eraserMode === 'lasso' ? 'pen' : 'lasso';
                const eraserBtn = document.getElementById('eraserBtn');
                const tooltip = eraserBtn.querySelector('.tool-tooltip');

                if (state.eraserMode === 'pen') {
                    eraserBtn.classList.add('pen-mode');
                    tooltip.textContent = '消しゴム (E) - ペン';
                    updateBrushSizeSlider();
                } else {
                    eraserBtn.classList.remove('pen-mode');
                    tooltip.textContent = '消しゴム (E) - 投げ縄';
                }

                updateBrushSizeVisibility();
                return;
            }

            // Switch Tool
            document.querySelectorAll('.opacity-slider-container').forEach(c => c.classList.remove('visible'));
            state.currentTool = newTool;

            if (btn.dataset.layer) {
                state.activeLayer = btn.dataset.layer;
            }

            document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            updateActiveLayerIndicator();
            updateBrushSizeVisibility();
            updateBrushSizeSlider();
        });
    });
}

function setupLayerControls() {
    // Visibility Toggles
    const roughVisibleBtn = document.getElementById('roughVisibleBtn');
    if (roughVisibleBtn) {
        roughVisibleBtn.addEventListener('click', () => {
            state.roughVisible = !state.roughVisible;
            roughCanvas.style.display = state.roughVisible ? 'block' : 'none';
            roughVisibleBtn.classList.toggle('hidden', !state.roughVisible);
        });
    }

    const fillVisibleBtn = document.getElementById('fillVisibleBtn');
    if (fillVisibleBtn) {
        fillVisibleBtn.addEventListener('click', () => {
            state.fillVisible = !state.fillVisible;
            fillCanvas.style.display = state.fillVisible ? 'block' : 'none';
            fillVisibleBtn.classList.toggle('hidden', !state.fillVisible);
        });
    }

    const lineVisibleBtn = document.getElementById('lineVisibleBtn');
    if (lineVisibleBtn) {
        lineVisibleBtn.addEventListener('click', () => {
            state.lineVisible = !state.lineVisible;
            lineCanvas.style.display = state.lineVisible ? 'block' : 'none';
            lineVisibleBtn.classList.toggle('hidden', !state.lineVisible);
        });
    }

    const line2VisibleBtn = document.getElementById('line2VisibleBtn');
    if (line2VisibleBtn) {
        line2VisibleBtn.addEventListener('click', () => {
            state.line2Visible = !state.line2Visible;
            document.getElementById('canvas-line-2').style.display = state.line2Visible ? 'block' : 'none';
            line2VisibleBtn.classList.toggle('hidden', !state.line2Visible);
        });
    }

    const line3VisibleBtn = document.getElementById('line3VisibleBtn');
    if (line3VisibleBtn) {
        line3VisibleBtn.addEventListener('click', () => {
            state.line3Visible = !state.line3Visible;
            document.getElementById('canvas-line-3').style.display = state.line3Visible ? 'block' : 'none';
            line3VisibleBtn.classList.toggle('hidden', !state.line3Visible);
        });
    }

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
            } else if (state.currentTool === 'eraser') {
                state.eraserSize = val;
            }
        });
    }
}

function setupClearButtons() {
    document.getElementById('clearBtn').addEventListener('click', () => {
        roughCanvas.getContext('2d').fillStyle = '#fff';
        roughCanvas.getContext('2d').fillRect(0, 0, roughCanvas.width, roughCanvas.height);
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
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, roughCanvas.width, roughCanvas.height);
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

            applyTransform();
        }, 300);
    });
}


function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        if (state.isSaveMode) return;
        if (e.target.tagName === 'INPUT') return; // スライダー操作中などは無視

        // Space key (Palm mode)
        if (e.code === 'Space') {
            state.isSpacePressed = true;
            lineCanvas.style.cursor = 'grab';
        }

        // Undo / Redo
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
            e.preventDefault();
            if (e.shiftKey) {
                redo();
            } else {
                undo();
            }
        } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
            e.preventDefault();
            redo();
        }

        // Tools
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
            switch (e.code) {
                case 'KeyE': // Eraser
                    const eraserBtn = document.getElementById('eraserBtn');
                    if (state.currentTool === 'eraser') {
                        // Toggle Mode
                        eraserBtn.click(); // Reuse existing logic
                    } else {
                        // Switch to Eraser
                        eraserBtn.click();
                    }
                    break;
                case 'KeyB': // Brush / Sketch
                case 'KeyS': // Sketch
                case 'Digit1': // Layer 1 (Rough)
                    document.getElementById('sketchBtn').click();
                    break;
                case 'KeyF': // Fill
                case 'Digit2': // Layer 2 (Fill)
                    document.getElementById('fillBtn').click();
                    break;
                case 'KeyP': // Pen
                case 'Digit3': // Layer 3 (Line)
                    document.getElementById('penBtn').click();
                    break;
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            state.isSpacePressed = false;
            lineCanvas.style.cursor = '';
        }
    });
}
