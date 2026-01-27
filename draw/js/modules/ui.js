import {
    state,
    layers,
    lassoCanvas,
    lassoCtx,
    eventCanvas,
    canvasBg,
    layerContainer,
    createLayer,
    deleteLayer,
    getLayer,
    getActiveLayer,
    getActiveLayerCtx,
    getActiveLayerCanvas,
    clearLayer,
    MAX_LAYERS
} from './state.js';
import {
    startPenDrawing, drawPenLine, endPenDrawing
} from './tools/pen.js';
import {
    startLasso, updateLasso, finishLasso,
    fillPolygon, fillPolygonTransparent, floodFill, floodFillTransparent
} from './tools/fill.js';
import { saveState, undo, redo, restoreLayer, resetHistory } from './history.js';
import {
    showSelectionUI, hideSelectionUI, confirmSelection, redoSelection,
    saveSelectedRegion, saveAllCanvas, copyToClipboard, saveRegion
} from './save.js';
import { applyTransform, updateBackgroundColor, hexToRgba } from './canvas.js';
import { getCanvasPoint } from './utils.js';

// ============================================
// UI Initializer
// ============================================

export function initUI() {
    setupLayerPanel();
    setupToolPanel();
    setupPointerEvents();
    setupColorPickers();
    setupClearButtons();
    setupZoomControls();
    setupSaveUI();
    setupCreditModal();
    setupOrientationHandler();
    setupKeyboardShortcuts();
}

// ============================================
// Layer Panel (Dynamic Layer Buttons)
// ============================================

function setupLayerPanel() {
    const layerButtons = document.getElementById('layer-buttons');
    const addBtn = document.getElementById('addLayerBtn');

    // Re-render layer buttons
    function renderLayerButtons() {
        layerButtons.innerHTML = '';

        for (const layer of layers) {
            const btn = document.createElement('div');
            btn.className = 'layer-btn' + (layer.id === state.activeLayer ? ' active' : '');
            btn.dataset.layerId = layer.id;
            btn.textContent = layer.id;

            if (!layer.visible) {
                btn.classList.add('hidden-layer');
            }

            btn.style.opacity = layer.opacity;

            layerButtons.appendChild(btn);
        }

        // Show/hide add button based on max layers
        addBtn.style.display = layers.length >= MAX_LAYERS ? 'none' : 'flex';
    }

    // Initial render
    renderLayerButtons();

    // Add layer button
    addBtn.addEventListener('click', async () => {
        const layer = createLayer();
        if (layer) {
            await resetHistory();
            renderLayerButtons();
            updateActiveLayerIndicator();
        }
    });

    // Layer button click/long-press handlers
    let longPressTimer = null;
    let longPressTriggered = false;

    layerButtons.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest('.layer-btn');
        if (!btn) return;

        longPressTriggered = false;
        longPressTimer = setTimeout(() => {
            longPressTriggered = true;
            showLayerMenu(btn);
        }, 500);
    });

    layerButtons.addEventListener('pointerup', (e) => {
        clearTimeout(longPressTimer);
        if (longPressTriggered) return;

        const btn = e.target.closest('.layer-btn');
        if (!btn) return;

        // Close any open menus first
        hideAllMenus();

        // Quick tap: switch layer (and always flash)
        const layerId = parseInt(btn.dataset.layerId);
        flashLayer(layerId);

        if (layerId !== state.activeLayer) {
            state.activeLayer = layerId;
            renderLayerButtons();
            updateActiveLayerIndicator();
        }
    });

    layerButtons.addEventListener('pointerleave', () => {
        clearTimeout(longPressTimer);
    });

    layerButtons.addEventListener('pointercancel', () => {
        clearTimeout(longPressTimer);
    });

    // Expose render function for external updates
    window.renderLayerButtons = renderLayerButtons;
}

// ============================================
// Tool Panel (Draw + Eraser)
// ============================================

function setupToolPanel() {
    const drawBtn = document.getElementById('drawToolBtn');
    const eraserBtn = document.getElementById('eraserToolBtn');

    // Tool button click/long-press
    let longPressTimer = null;
    let longPressTriggered = false;

    function setupToolButton(btn, menuId, isEraser) {
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            longPressTriggered = false;
            longPressTimer = setTimeout(() => {
                longPressTriggered = true;
                showToolMenu(menuId, btn);
            }, 500);
        });

        btn.addEventListener('pointerup', () => {
            clearTimeout(longPressTimer);
            if (longPressTriggered) return;

            // Quick tap: activate/toggle
            if (isEraser) {
                state.isEraserActive = true;
                state.isErasing = true;
            } else {
                state.isEraserActive = false;
                state.isErasing = false;
            }
            updateToolButtonStates();
            updateBrushSizeSlider();
        });

        btn.addEventListener('pointerleave', () => clearTimeout(longPressTimer));
        btn.addEventListener('pointercancel', () => clearTimeout(longPressTimer));
    }

    setupToolButton(drawBtn, 'draw-tool-menu', false);
    setupToolButton(eraserBtn, 'eraser-tool-menu', true);

    // Setup draw tool menu - toggle behavior
    const drawMenu = document.getElementById('draw-tool-menu');
    const drawModes = ['pen', 'fill', 'sketch'];
    drawMenu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const mode = item.dataset.mode;

            // Toggle: if same tool, cycle to next
            if (state.currentTool === mode && !state.isEraserActive) {
                const currentIndex = drawModes.indexOf(mode);
                state.currentTool = drawModes[(currentIndex + 1) % drawModes.length];
            } else {
                state.currentTool = mode;
            }

            state.isEraserActive = false;
            state.isErasing = false;
            updateDrawToolIcon();
            updateToolButtonStates();
            hideAllMenus();
        });
    });

    // Setup eraser tool menu - toggle behavior (except layer_clear)
    const eraserMenu = document.getElementById('eraser-tool-menu');
    const eraserModes = ['eraser_lasso', 'eraser_pen'];
    eraserMenu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', async () => {
            const mode = item.dataset.mode;

            if (mode === 'layer_clear') {
                // Instant layer clear - no toggle
                await saveState();
                clearLayer(state.activeLayer);
                await saveState();
                flashLayer(state.activeLayer);
            } else if (eraserModes.includes(mode)) {
                // Toggle: if same eraser mode, cycle to next
                const eraserType = mode === 'eraser_lasso' ? 'lasso' : 'pen';
                if (state.currentEraser === eraserType && state.isEraserActive) {
                    const currentIndex = eraserModes.indexOf(mode);
                    const nextMode = eraserModes[(currentIndex + 1) % eraserModes.length];
                    state.currentEraser = nextMode === 'eraser_lasso' ? 'lasso' : 'pen';
                } else {
                    state.currentEraser = eraserType;
                }
                state.isEraserActive = true;
                state.isErasing = true;
                updateEraserToolIcon();
                updateToolButtonStates();
            }

            hideAllMenus();
        });
    });

    // Initial state
    updateToolButtonStates();
}

function updateDrawToolIcon() {
    const btn = document.getElementById('drawToolBtn');
    btn.querySelectorAll('.tool-icon').forEach(icon => {
        icon.style.display = 'none';
        icon.classList.remove('active');
    });

    let selector;
    switch (state.currentTool) {
        case 'fill': selector = '.tool-fill'; break;
        case 'sketch': selector = '.tool-sketch'; break;
        default: selector = '.tool-pen'; break;
    }

    const activeIcon = btn.querySelector(selector);
    if (activeIcon) {
        activeIcon.style.display = 'block';
        activeIcon.classList.add('active');
    }
}

function updateEraserToolIcon() {
    const btn = document.getElementById('eraserToolBtn');
    btn.querySelectorAll('.tool-icon').forEach(icon => {
        icon.style.display = 'none';
        icon.classList.remove('active');
    });

    const selector = state.currentEraser === 'pen' ? '.eraser-pen' : '.eraser-lasso';
    const activeIcon = btn.querySelector(selector);
    if (activeIcon) {
        activeIcon.style.display = 'block';
        activeIcon.classList.add('active');
    }
}

function updateToolButtonStates() {
    const drawBtn = document.getElementById('drawToolBtn');
    const eraserBtn = document.getElementById('eraserToolBtn');

    drawBtn.classList.toggle('active', !state.isEraserActive);
    eraserBtn.classList.toggle('active', state.isEraserActive);

    updateBrushSizeVisibility();
}

// ============================================
// Tool Menus (Long Press Popovers)
// ============================================

function showToolMenu(menuId, anchorBtn) {
    hideAllMenus();

    const menu = document.getElementById(menuId);
    if (!menu) return;

    // Remove active class from all menu items
    menu.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });

    // Add active class to current tool
    if (menuId === 'draw-tool-menu') {
        const activeMode = state.currentTool;
        const activeItem = menu.querySelector(`[data-mode="${activeMode}"]`);
        if (activeItem) activeItem.classList.add('active');
    } else if (menuId === 'eraser-tool-menu') {
        const activeMode = state.currentEraser === 'lasso' ? 'eraser_lasso' : 'eraser_pen';
        const activeItem = menu.querySelector(`[data-mode="${activeMode}"]`);
        if (activeItem) activeItem.classList.add('active');
    }

    const rect = anchorBtn.getBoundingClientRect();
    menu.style.left = rect.right + 10 + 'px';
    menu.style.top = rect.top + 'px';
    menu.classList.remove('hidden');

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('pointerdown', handleOutsideClick);
    }, 10);
}

function showLayerMenu(anchorBtn) {
    hideAllMenus();

    const menu = document.getElementById('layer-menu');
    const layerId = parseInt(anchorBtn.dataset.layerId);
    const layer = getLayer(layerId);
    if (!menu || !layer) return;

    // Update slider value
    const slider = document.getElementById('layerOpacitySlider');
    slider.value = layer.opacity * 100;

    // Update visibility toggle
    const visToggle = menu.querySelector('.layer-visible-toggle');
    visToggle.classList.toggle('hidden-state', !layer.visible);

    // Store target layer
    menu.dataset.targetLayerId = layerId;

    const rect = anchorBtn.getBoundingClientRect();
    menu.style.left = rect.right + 10 + 'px';
    menu.style.top = rect.top + 'px';
    menu.classList.remove('hidden');

    // Setup menu actions
    setupLayerMenuActions(menu, layerId);

    setTimeout(() => {
        document.addEventListener('pointerdown', handleOutsideClick);
    }, 10);
}

function setupLayerMenuActions(menu, layerId) {
    const slider = document.getElementById('layerOpacitySlider');
    const visToggle = menu.querySelector('.layer-visible-toggle');
    const deleteBtn = menu.querySelector('.layer-delete');

    // Remove old listeners
    const newSlider = slider.cloneNode(true);
    slider.parentNode.replaceChild(newSlider, slider);

    const newVisToggle = visToggle.cloneNode(true);
    visToggle.parentNode.replaceChild(newVisToggle, visToggle);

    const newDeleteBtn = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);

    // Opacity slider
    newSlider.addEventListener('input', (e) => {
        const layer = getLayer(layerId);
        if (layer) {
            layer.opacity = e.target.value / 100;
            layer.canvas.style.opacity = layer.opacity;

            const btn = document.querySelector(`.layer-btn[data-layer-id="${layerId}"]`);
            if (btn) btn.style.opacity = layer.opacity;
        }
    });

    // Visibility toggle
    newVisToggle.addEventListener('click', () => {
        const layer = getLayer(layerId);
        if (layer) {
            layer.visible = !layer.visible;
            layer.canvas.style.display = layer.visible ? 'block' : 'none';
            newVisToggle.classList.toggle('hidden-state', !layer.visible);

            const btn = document.querySelector(`.layer-btn[data-layer-id="${layerId}"]`);
            if (btn) btn.classList.toggle('hidden-layer', !layer.visible);
        }
    });

    // Delete button
    newDeleteBtn.addEventListener('click', async () => {
        if (layers.length <= 1) return; // Can't delete last layer

        if (deleteLayer(layerId)) {
            await resetHistory();
            window.renderLayerButtons();
            updateActiveLayerIndicator();
            hideAllMenus();
        }
    });

    // Disable delete if only one layer
    newDeleteBtn.classList.toggle('disabled', layers.length <= 1);
}

function hideAllMenus() {
    document.querySelectorAll('.tool-menu').forEach(menu => {
        menu.classList.add('hidden');
    });
    document.removeEventListener('pointerdown', handleOutsideClick);
}

function handleOutsideClick(e) {
    if (!e.target.closest('.tool-menu') && !e.target.closest('.layer-btn') && !e.target.closest('.tool-btn')) {
        hideAllMenus();
    }
}

// ============================================
// Helper Functions (UI Updates)
// ============================================

function updateActiveLayerIndicator() {
    // Flash effect on layer switch
    const layer = getActiveLayer();
    if (layer) {
        flashLayer(layer.id);
    }
}

function updateBrushSizeVisibility() {
    const container = document.getElementById('size-slider-container');

    // Show slider always, but disable for lasso-based tools
    const isPenMode = (state.currentTool === 'pen' || state.currentTool === 'sketch') && !state.isEraserActive;
    const isEraserPen = state.isEraserActive && state.currentEraser === 'pen';

    container.classList.toggle('disabled', !(isPenMode || isEraserPen));
}

function updateBrushSizeSlider() {
    const slider = document.getElementById('brushSize');
    const display = document.getElementById('sizeDisplay');

    if (state.isEraserActive) {
        slider.value = state.eraserSize;
        display.textContent = state.eraserSize;
    } else {
        slider.value = state.penSize;
        display.textContent = state.penSize;
    }
}

function flashLayer(layerId) {
    const layer = getLayer(layerId);
    if (!layer) return;

    const canvas = layer.canvas;

    // Blue flash effect using CSS filter
    canvas.style.transition = 'filter 0.1s';
    canvas.style.filter = 'drop-shadow(0 0 6px #00aaff) brightness(1.2)';

    setTimeout(() => {
        canvas.style.filter = 'none';
        setTimeout(() => {
            canvas.style.transition = '';
        }, 200);
    }, 200);
}

// ============================================
// Event Listeners Setup
// ============================================

function setupPointerEvents() {
    eventCanvas.addEventListener('pointerdown', handlePointerDown);
    eventCanvas.addEventListener('pointermove', handlePointerMove);
    eventCanvas.addEventListener('pointerup', handlePointerUp);
    eventCanvas.addEventListener('pointercancel', handlePointerCancel);
    eventCanvas.addEventListener('pointerleave', handlePointerUp);

    // Prevent context menu
    eventCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch events for pinch zoom
    eventCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    eventCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    eventCanvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Wheel for zoom
    eventCanvas.addEventListener('wheel', handleWheel, { passive: false });
}

async function handlePointerDown(e) {
    if (state.isSaveMode) return;

    // Track active pointers
    state.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Detect pencil
    if (e.pointerType === 'pen') {
        state.pencilDetected = true;
    }

    // Zoom with Ctrl + Space + Click (zoom in) or Ctrl + Space + Alt + Click (zoom out)
    if (state.isSpacePressed && state.isCtrlPressed) {
        const zoomFactor = state.isAltPressed ? 0.8 : 1.25;
        const newScale = Math.max(0.1, Math.min(10, state.scale * zoomFactor));

        // Zoom centered on click position
        const clickX = e.clientX;
        const clickY = e.clientY;

        // Calculate the point in canvas space before zoom
        const canvasX = (clickX - state.translateX) / state.scale;
        const canvasY = (clickY - state.translateY) / state.scale;

        // Update scale
        state.scale = newScale;

        // Adjust translation so the click point stays under the cursor
        state.translateX = clickX - canvasX * state.scale;
        state.translateY = clickY - canvasY * state.scale;

        applyTransform();
        return;
    }

    // Pan with space or two fingers
    if (state.isSpacePressed || state.activePointers.size > 1) {
        state.isPanning = true;
        state.panStartX = e.clientX;
        state.panStartY = e.clientY;
        state.panStartTranslateX = state.translateX;
        state.panStartTranslateY = state.translateY;
        return;
    }

    // Record touch start info
    state.touchStartTime = Date.now();
    state.touchStartPos = { x: e.clientX, y: e.clientY };
    state.totalDragDistance = 0;
    state.drawingPointerId = e.pointerId;
    state.strokeMade = false;

    const canvasPoint = getCanvasPoint(e.clientX, e.clientY);

    // Determine action based on tool
    if (state.isEraserActive) {
        // Eraser mode
        if (state.currentEraser === 'lasso') {
            startLasso(e.clientX, e.clientY);
        } else {
            // Pen eraser
            await saveState();
            state.isErasing = true;
            startPenDrawing(canvasPoint.x, canvasPoint.y);
        }
    } else {
        // Drawing mode
        if (state.currentTool === 'fill' || state.currentTool === 'sketch') {
            // Lasso fill
            startLasso(e.clientX, e.clientY);
        } else {
            // Pen drawing
            await saveState();
            startPenDrawing(canvasPoint.x, canvasPoint.y);
        }
    }

    state.strokeMade = true;
}

async function handlePointerMove(e) {
    if (state.isSaveMode) return;

    // Update pointer position
    if (state.activePointers.has(e.pointerId)) {
        state.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Calculate drag distance
    if (state.touchStartPos) {
        const dx = e.clientX - state.touchStartPos.x;
        const dy = e.clientY - state.touchStartPos.y;
        state.totalDragDistance += Math.sqrt(dx * dx + dy * dy);
    }

    // Pan
    if (state.isPanning) {
        state.translateX = state.panStartTranslateX + (e.clientX - state.panStartX);
        state.translateY = state.panStartTranslateY + (e.clientY - state.panStartY);
        applyTransform();
        return;
    }

    // Only handle drawing pointer
    if (e.pointerId !== state.drawingPointerId) return;

    const canvasPoint = getCanvasPoint(e.clientX, e.clientY);

    if (state.isLassoing) {
        updateLasso(e.clientX, e.clientY);
    } else if (state.isPenDrawing) {
        drawPenLine(canvasPoint.x, canvasPoint.y);
    }
}

async function handlePointerUp(e) {
    state.activePointers.delete(e.pointerId);

    if (state.isPanning && state.activePointers.size === 0) {
        state.isPanning = false;
        return;
    }

    if (e.pointerId !== state.drawingPointerId) return;
    state.drawingPointerId = null;

    const touchDuration = Date.now() - state.touchStartTime;
    const canvasPoint = getCanvasPoint(e.clientX, e.clientY);

    // Check for two-finger tap (undo) - only if no stroke made
    if (state.maxFingers >= 2 && touchDuration < 300 && state.totalDragDistance < 20 && !state.strokeMade) {
        undo();
        state.maxFingers = 0;
        return;
    }

    state.maxFingers = 0;

    // Finish current operation
    if (state.isLassoing) {
        const points = finishLasso();
        if (points && points.length >= 3) {
            await saveState();

            if (state.isEraserActive) {
                fillPolygonTransparent(points);
            } else {
                fillPolygon(points);
            }

            await saveState();
        }
    } else if (state.isPenDrawing) {
        await endPenDrawing();
    }

    // Handle tap for flood fill
    if (state.currentTool === 'fill' && !state.isEraserActive && touchDuration < 200 && state.totalDragDistance < 10) {
        await saveState();
        const color = hexToRgba('#000000', 255);
        floodFill(Math.floor(canvasPoint.x), Math.floor(canvasPoint.y), color);
        await saveState();
    }

    state.isErasing = false;
}

function handlePointerCancel(e) {
    state.activePointers.delete(e.pointerId);

    if (state.isLassoing) {
        const layer = getActiveLayer();
        if (layer) restoreLayer(layer.id);
        finishLasso();
    }

    if (state.isPenDrawing) {
        const layer = getActiveLayer();
        if (layer) restoreLayer(layer.id);
        state.isPenDrawing = false;
        state.lastPenPoint = null;
    }

    state.drawingPointerId = null;
    state.isPanning = false;
    state.isErasing = false;
}

// Touch handlers for pinch zoom
function handleTouchStart(e) {
    state.maxFingers = Math.max(state.maxFingers, e.touches.length);

    if (e.touches.length === 2) {
        e.preventDefault();
        state.isPinching = true;

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        state.initialPinchDist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        state.initialPinchCenter = {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
        state.lastPinchDist = state.initialPinchDist;
        state.lastPinchCenter = { ...state.initialPinchCenter };
    }
}

function handleTouchMove(e) {
    if (state.isPinching && e.touches.length === 2) {
        e.preventDefault();

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        const currentDist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        const currentCenter = {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };

        // Zoom
        const scaleFactor = currentDist / state.lastPinchDist;
        const newScale = Math.min(Math.max(state.scale * scaleFactor, 0.1), 10);

        // Pan
        const dx = currentCenter.x - state.lastPinchCenter.x;
        const dy = currentCenter.y - state.lastPinchCenter.y;

        // Adjust for zoom center
        const zoomCenterX = currentCenter.x - state.translateX;
        const zoomCenterY = currentCenter.y - state.translateY;

        state.translateX += dx + zoomCenterX * (1 - scaleFactor);
        state.translateY += dy + zoomCenterY * (1 - scaleFactor);
        state.scale = newScale;

        state.lastPinchDist = currentDist;
        state.lastPinchCenter = currentCenter;

        applyTransform();
    }
}

function handleTouchEnd(e) {
    if (e.touches.length < 2) {
        state.isPinching = false;
    }
}

function handleWheel(e) {
    e.preventDefault();

    const zoomSpeed = 0.001;
    const delta = -e.deltaY * zoomSpeed;
    const newScale = Math.min(Math.max(state.scale * (1 + delta), 0.1), 10);

    // Zoom centered on mouse position
    const rect = eventCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleFactor = newScale / state.scale;
    state.translateX = mouseX - (mouseX - state.translateX) * scaleFactor;
    state.translateY = mouseY - (mouseY - state.translateY) * scaleFactor;
    state.scale = newScale;

    applyTransform();
}

// ============================================
// Color Pickers
// ============================================

function setupColorPickers() {
    const bgColorBtn = document.getElementById('bgColorBtn');

    bgColorBtn.addEventListener('input', (e) => {
        updateBackgroundColor(e.target.value);
    });

    // Brush size slider
    const brushSizeSlider = document.getElementById('brushSize');
    const sizeDisplay = document.getElementById('sizeDisplay');

    brushSizeSlider.addEventListener('input', (e) => {
        const size = parseInt(e.target.value);
        sizeDisplay.textContent = size;

        if (state.isEraserActive) {
            state.eraserSize = size;
        } else {
            state.penSize = size;
        }
    });
}

// ============================================
// Clear Buttons
// ============================================

function setupClearButtons() {
    const clearBtn = document.getElementById('clearBtn');

    clearBtn.addEventListener('click', async () => {
        await saveState();

        // Clear all layers
        for (const layer of layers) {
            layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        }

        await saveState();
    });
}

// ============================================
// Zoom Controls
// ============================================

function setupZoomControls() {
    const resetBtn = document.getElementById('resetZoomBtn');

    resetBtn.addEventListener('click', () => {
        state.scale = 1;
        state.translateX = 0;
        state.translateY = 0;
        applyTransform();
    });
}

// ============================================
// Save UI
// ============================================

function setupSaveUI() {
    const saveBtn = document.getElementById('saveBtn');
    const saveOverlay = document.getElementById('save-overlay');
    const saveUI = document.getElementById('save-ui');
    const cancelBtn = document.getElementById('cancelSaveBtn');
    const saveAllBtn = document.getElementById('saveAllBtn');
    const confirmBtn = document.getElementById('confirmSelectionBtn');
    const copyBtn = document.getElementById('copyClipboardBtn');
    const redoBtn = document.getElementById('redoSelectionBtn');
    const transparentBgCheckbox = document.getElementById('transparentBg');
    const selCanvas = document.getElementById('selection-canvas');
    const selCtx = selCanvas.getContext('2d');

    saveBtn.addEventListener('click', () => {
        state.isSaveMode = true;
        state.selectionStart = null;
        state.selectionEnd = null;
        state.confirmedSelection = null;

        saveOverlay.style.display = 'block';
        saveUI.style.display = 'block';

        // Reset buttons to hidden state
        confirmBtn.style.display = 'none';
        copyBtn.style.display = 'none';
        redoBtn.style.display = 'none';

        // Reset size display
        document.getElementById('selection-size').style.display = 'none';

        showSelectionUI();
    });

    cancelBtn.addEventListener('click', () => {
        state.isSaveMode = false;
        saveOverlay.style.display = 'none';
        saveUI.style.display = 'none';
        hideSelectionUI();
    });

    saveOverlay.addEventListener('click', () => {
        state.isSaveMode = false;
        saveOverlay.style.display = 'none';
        saveUI.style.display = 'none';
        hideSelectionUI();
    });

    saveAllBtn.addEventListener('click', () => {
        saveAllCanvas(transparentBgCheckbox.checked);
    });

    confirmBtn.addEventListener('click', async () => {
        if (state.confirmedSelection) {
            const { x, y, w, h } = state.confirmedSelection;
            await saveRegion(x, y, w, h);
        }
    });

    copyBtn.addEventListener('click', async () => {
        if (state.confirmedSelection) {
            const { x, y, w, h } = state.confirmedSelection;
            await copyToClipboard(x, y, w, h);
        }
    });

    redoBtn.addEventListener('click', () => {
        redoSelection();
        // Hide confirm/copy buttons
        confirmBtn.style.display = 'none';
        copyBtn.style.display = 'none';
        redoBtn.style.display = 'none';

        // Hide size display
        document.getElementById('selection-size').style.display = 'none';
    });

    // Selection rectangle drag events
    let isSelecting = false;

    selCanvas.addEventListener('pointerdown', (e) => {
        if (!state.isSaveMode) return;
        isSelecting = true;
        saveUI.classList.add('hidden-during-selection');
        state.selectionStart = { x: e.clientX, y: e.clientY };
        state.selectionEnd = null;
        state.confirmedSelection = null;
        selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);

        // Hide buttons when starting new selection
        confirmBtn.style.display = 'none';
        copyBtn.style.display = 'none';
        redoBtn.style.display = 'none';
    });

    selCanvas.addEventListener('pointermove', (e) => {
        if (!isSelecting || !state.isSaveMode) return;

        let endX = e.clientX;
        let endY = e.clientY;

        // Apply aspect ratio constraint
        if (state.selectedAspect && state.selectedAspect !== 'free') {
            const startX = state.selectionStart.x;
            const startY = state.selectionStart.y;
            const dx = endX - startX;
            const dy = endY - startY;

            let targetRatio;
            if (state.selectedAspect === '1:1') targetRatio = 1;
            else if (state.selectedAspect === '4:3') targetRatio = 4 / 3;
            else if (state.selectedAspect === '16:9') targetRatio = 16 / 9;
            else targetRatio = null;

            if (targetRatio) {
                const absDx = Math.abs(dx);
                const absDy = Math.abs(dy);

                // Constrain to aspect ratio
                if (absDx / targetRatio > absDy) {
                    // Height is limiting factor
                    endX = startX + Math.sign(dx) * absDy * targetRatio;
                } else {
                    // Width is limiting factor
                    endY = startY + Math.sign(dy) * absDx / targetRatio;
                }
            }
        }

        state.selectionEnd = { x: endX, y: endY };
        drawSelectionRect(selCtx, state.selectionStart, state.selectionEnd, selCanvas);
        // Update size display during drag
        updateSelectionSizeDisplay();
    });

    selCanvas.addEventListener('pointerup', (e) => {
        if (!isSelecting || !state.isSaveMode) return;
        isSelecting = false;
        saveUI.classList.remove('hidden-during-selection');

        // Use last calculated end point (with aspect ratio applied)
        if (state.selectionStart && state.selectionEnd) {
            // Calculate screen coordinates limits
            const sx = Math.min(state.selectionStart.x, state.selectionEnd.x);
            const sy = Math.min(state.selectionStart.y, state.selectionEnd.y);
            const sw = Math.abs(state.selectionEnd.x - state.selectionStart.x);
            const sh = Math.abs(state.selectionEnd.y - state.selectionStart.y);

            // Convert to canvas coordinates for saving
            const p1 = getCanvasPoint(sx, sy);
            const p2 = getCanvasPoint(sx + sw, sy + sh);

            state.confirmedSelection = {
                x: p1.x,
                y: p1.y,
                w: Math.abs(p2.x - p1.x),
                h: Math.abs(p2.y - p1.y)
            };

            // Show confirm/copy buttons only if valid selection (in screen pixels)
            if (sw > 5 && sh > 5) {
                confirmBtn.style.display = 'inline-block';
                copyBtn.style.display = 'inline-block';
                redoBtn.style.display = 'inline-block';

                // Show final size
                updateSelectionSizeDisplay();
            }
        }
    });

    // Aspect ratio buttons
    document.querySelectorAll('[data-aspect]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-aspect]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedAspect = btn.dataset.aspect;
        });
    });

    // Scale buttons
    document.querySelectorAll('[data-scale]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-scale]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedScale = parseInt(btn.dataset.scale);

            // Update size display if selection exists
            if (state.confirmedSelection) {
                updateSelectionSizeDisplay();
            }
        });
    });
}

function updateSelectionSizeDisplay() {
    const sizeDiv = document.getElementById('selection-size');

    let w = 0, h = 0;
    const scale = state.selectedScale || 1;

    if (state.selectionStart && state.selectionEnd) {
        // Calculating from screen coordinates during drag
        const screenW = Math.abs(state.selectionEnd.x - state.selectionStart.x);
        const screenH = Math.abs(state.selectionEnd.y - state.selectionStart.y);

        // Convert screen size to canvas size
        w = Math.round(screenW / state.scale);
        h = Math.round(screenH / state.scale);
    } else if (state.confirmedSelection) {
        // Already in canvas coordinates
        w = state.confirmedSelection.w;
        h = state.confirmedSelection.h;
    }

    if (w > 0 && h > 0) {
        const finalW = Math.round(w * scale);
        const finalH = Math.round(h * scale);

        sizeDiv.textContent = `サイズ: ${finalW} x ${finalH} px`;
        sizeDiv.style.display = 'block';
    } else {
        sizeDiv.style.display = 'none';
    }
}

function drawSelectionRect(ctx, start, end, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);

    // Dim outside area
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(x, y, w, h);

    // Draw border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
}

// ============================================
// Credit Modal
// ============================================

function setupCreditModal() {
    const creditBtn = document.getElementById('credit-btn');
    const creditModal = document.getElementById('credit-modal');
    const modalContent = creditModal.querySelector('.credit-modal-content');

    creditBtn.addEventListener('click', () => {
        creditModal.classList.toggle('visible');
        document.body.classList.toggle('help-mode', creditModal.classList.contains('visible'));
    });

    // Close help mode on any click outside modal content (except links inside modal)
    document.addEventListener('click', (e) => {
        if (!document.body.classList.contains('help-mode')) return;

        // If clicked inside modal content, only allow link navigation
        if (modalContent && modalContent.contains(e.target)) {
            // Let links work normally
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                return;
            }
        }

        // Close modal on any other click (including toolbar buttons, canvas, etc.)
        if (e.target !== creditBtn && !creditBtn.contains(e.target)) {
            creditModal.classList.remove('visible');
            document.body.classList.remove('help-mode');
        }
    });
}

// ============================================
// Orientation Handler
// ============================================

function setupOrientationHandler() {
    // Handle orientation change
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            location.reload();
        }, 100);
    });

    // Handle resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Re-initialize canvas sizes if needed
        }, 250);
    });
}

// ============================================
// Keyboard Shortcuts
// ============================================

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Modifier key tracking
        if (e.code === 'Space') {
            e.preventDefault();
            state.isSpacePressed = true;
            eventCanvas.style.cursor = 'grab';
        }
        if (e.ctrlKey || e.metaKey) state.isCtrlPressed = true;
        if (e.altKey) state.isAltPressed = true;

        // Undo: Ctrl/Cmd + Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }

        // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z') || (e.shiftKey && e.key === 'Z'))) {
            e.preventDefault();
            redo();
        }

        // Save: Ctrl/Cmd + S
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            document.getElementById('saveBtn').click();
        }

        // Clear: Delete or Backspace
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (!e.target.matches('input, textarea')) {
                e.preventDefault();
                document.getElementById('clearBtn').click();
            }
        }

        // Zoom: + / - / 0
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                state.scale = Math.min(state.scale * 1.2, 10);
                applyTransform();
            }
            if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                state.scale = Math.max(state.scale / 1.2, 0.1);
                applyTransform();
            }
            if (e.key === '0') {
                e.preventDefault();
                state.scale = 1;
                state.translateX = 0;
                state.translateY = 0;
                applyTransform();
            }
        }

        // Toggle draw/eraser: X
        if (e.key === 'x' || e.key === 'X') {
            if (!e.target.matches('input, textarea')) {
                e.preventDefault();
                state.isEraserActive = !state.isEraserActive;
                state.isErasing = state.isEraserActive;
                updateToolButtonStates();
                updateBrushSizeVisibility();
                updateBrushSizeSlider();
            }
        }

        // Layer shortcuts: 1-5
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            const num = parseInt(e.key);
            if (num >= 1 && num <= 5 && num <= layers.length) {
                const layer = layers[num - 1];
                if (layer) {
                    state.activeLayer = layer.id;
                    window.renderLayerButtons();
                    updateActiveLayerIndicator();
                    flashLayer(layer.id);
                }
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            state.isSpacePressed = false;
            eventCanvas.style.cursor = '';
        }
        if (!e.ctrlKey && !e.metaKey) state.isCtrlPressed = false;
        if (!e.altKey) state.isAltPressed = false;
    });
}
