import {
    state,
    layers,
    lassoCanvas,
    lassoCtx,
    selectionCanvas,
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
    moveLayer,
    mergeLayerDown,
    MAX_LAYERS
} from './state.js';
import {
    startPenDrawing, drawPenLine, endPenDrawing
} from './tools/pen.js';
import {
    startLasso, updateLasso, finishLasso,
    fillPolygon, fillPolygonTransparent, floodFill, floodFillTransparent, floodFillSketch
} from './tools/fill.js';
import { saveState, undo, redo, restoreLayer, resetHistory } from './history.js';
import {
    showSelectionUI, hideSelectionUI, confirmSelection, redoSelection,
    saveSelectedRegion, saveAllCanvas, copyToClipboard, saveRegion
} from './save.js';
import { applyTransform, updateBackgroundColor, hexToRgba } from './canvas.js';
import { getCanvasPoint } from './utils.js';
import {
    TONE_PRESETS,
    fillTone,
    setTonePreset,
    currentTonePresetId,
    createTonePreview,
    floodFillTone
} from './tools/tone.js';
import { exportProject, importProject } from './storage.js';
import { onStrokeStart, onStrokeEnd } from './ai.js';


// ============================================
// Debug Display
// ============================================

// Set to true to show debug overlay (top-left corner)
const DEBUG_MODE = false;

let lastUndoCheck = null;
let undoCallCount = 0;
const suppressedWarnings = {
    layerAdd: false,
    layerDelete: false
};

function showConfirmModal(message, warningKey, onConfirm) {
    if (suppressedWarnings[warningKey]) {
        onConfirm();
        return;
    }

    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-message');
    const checkEl = document.getElementById('confirm-suppress-check');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    const okBtn = document.getElementById('confirm-ok-btn');

    if (!modal || !msgEl || !checkEl || !cancelBtn || !okBtn) {
        console.error('Confirm modal elements missing');
        // Fallback if elements invalid
        if (window.confirm(message)) {
            onConfirm();
        }
        return;
    }

    msgEl.textContent = message;
    checkEl.checked = false;

    // Remove old listeners (cloning is easiest way to clear generic listeners without named reference)
    // But we can just use `onclick` for simplicity or named references if we prefer.
    // Cloning buttons is safer to avoid stacking listeners if we don't track them.
    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    const newOk = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);

    const cleanup = () => {
        modal.classList.add('hidden');
    };

    newCancel.addEventListener('click', () => {
        cleanup();
    });

    newOk.addEventListener('click', () => {
        if (checkEl.checked) {
            suppressedWarnings[warningKey] = true;
        }
        cleanup();
        onConfirm();
    });

    modal.classList.remove('hidden');
}

function updateDebugDisplay() {
    if (!DEBUG_MODE) return;

    const debugDiv = document.getElementById('debug-display');
    if (!debugDiv) return;

    debugDiv.style.display = 'block';

    let html = `
undoStack: ${state.undoStack.length}<br>
redoStack: ${state.redoStack.length}<br>
strokeMade: ${state.strokeMade}<br>
didInteract: ${state.didInteract}<br>
maxFingers: ${state.maxFingers}<br>
isPenDrawing: ${state.isPenDrawing}<br>
isLassoing: ${state.isLassoing}<br>
wasPinch: ${state.wasPinching}<br>
wasPan: ${state.wasPanning}<br>
undoCalls: ${undoCallCount}
    `.trim();

    if (lastUndoCheck) {
        html += `<br><br>Last tap:<br>dur:${lastUndoCheck.duration}<br>maxF:${lastUndoCheck.maxFingers}<br>stroke:${lastUndoCheck.strokeMade}<br>inter:${lastUndoCheck.didInteract}<br>wasPinch:${lastUndoCheck.wasPinching}<br>wasPan:${lastUndoCheck.wasPanning}<br>undo:${lastUndoCheck.undoCalled ? 'YES' : 'NO'}`;
    }

    debugDiv.innerHTML = html;
}

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
    setupClearButtons();
    setupZoomControls();
    setupSaveUI();
    setupFileUI();
    setupToneMenu();
    setupCreditModal();
    setupOrientationHandler();
    setupKeyboardShortcuts();
    updateDebugDisplay();
}

// ============================================
// File UI
// ============================================

function setupFileUI() {
    const fileBtn = document.getElementById('fileBtn');
    const menu = document.getElementById('file-menu');
    const newBtn = document.getElementById('newProjectBtn');
    const exportBtn = document.getElementById('exportProjectBtn');
    const importBtn = document.getElementById('importProjectBtn');
    const fileInput = document.getElementById('fileInput');

    console.log('[DEBUG] setupFileUI', { fileBtn, menu, newBtn, exportBtn, importBtn, fileInput });

    if (!fileBtn || !menu) return;

    // Toggle menu
    fileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = menu.classList.contains('hidden');
        hideAllMenus(); // Close other menus

        if (isHidden) {
            const rect = fileBtn.getBoundingClientRect();
            menu.style.right = (window.innerWidth - rect.right) + 'px';
            menu.style.top = rect.bottom + 10 + 'px';
            menu.classList.remove('hidden');

            // Close on outside click
            setTimeout(() => {
                document.addEventListener('pointerdown', handleOutsideClick);
            }, 10);
        }
    });

    // NEW click
    if (newBtn) {
        newBtn.addEventListener('click', async () => {
            hideAllMenus();
            if (confirm('新規プロジェクトを作成しますか？\n（現在の作業内容は破棄されます）')) {
                // Reset Logic
                // 1. Delete all layers except one
                while (layers.length > 1) {
                    deleteLayer(layers[layers.length - 1].id);
                }
                // 2. Clear the last remaining layer
                if (layers.length > 0) {
                    // Clear content
                    clearLayer(layers[0].id);

                    // Reset properties
                    layers[0].opacity = 1.0;
                    layers[0].visible = true;
                    layers[0].canvas.style.opacity = '1.0';
                    layers[0].canvas.style.display = 'block';
                }

                // 3. Reset history
                await resetHistory();

                // 4. Update UI
                if (window.renderLayerButtons) window.renderLayerButtons();
                // Update thumbnail for the cleared layer
                if (layers[0]) updateLayerThumbnail(layers[0]);


            }
        });
    }

    // Import click
    importBtn.addEventListener('click', () => {
        fileInput.click();
        hideAllMenus();
    });

    // Export click
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            console.log('[DEBUG] exportBtn clicked');
            hideAllMenus();
            try {
                const success = await exportProject();
                console.log('[DEBUG] exportProject result:', success);

            } catch (e) {
                console.error('[DEBUG] exportProject error:', e);
            }
        });
    }

    // File input change (Import)
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                if (confirm('プロジェクトを読み込みますか？\n（現在の作業内容は上書きされます）')) {
                    importProject(file).then(async (success) => {
                        if (success) {
                            // UI Refresh Logic
                            // 1. Render layer buttons (list)
                            if (window.renderLayerButtons) window.renderLayerButtons();

                            // 2. Update thumbnails for all loaded layers
                            for (const layer of layers) {
                                updateLayerThumbnail(layer);
                            }

                            // 3. Reset History
                            await resetHistory();


                        } else {
                            alert('読み込みに失敗しました');
                        }
                        // Reset input
                        fileInput.value = '';
                    });
                } else {
                    fileInput.value = '';
                }
            }
        });
    }
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
            // Removed text content for thumbnail
            // btn.textContent = layer.id;

            if (!layer.visible) {
                btn.classList.add('hidden-layer');
            }

            btn.style.opacity = layer.opacity;

            // Set thumbnail
            if (layer.thumbnail) {
                btn.style.backgroundImage = `url(${layer.thumbnail})`;
                btn.style.backgroundSize = 'contain';
                btn.style.backgroundRepeat = 'no-repeat';
                btn.style.backgroundPosition = 'center';
            } else {
                // Generate initial thumbnail if missing (e.g. new layer)
                updateLayerThumbnail(layer);
                if (layer.thumbnail) {
                    btn.style.backgroundImage = `url(${layer.thumbnail})`;
                    btn.style.backgroundSize = 'contain';
                    btn.style.backgroundRepeat = 'no-repeat';
                    btn.style.backgroundPosition = 'center';
                }
            }

            layerButtons.appendChild(btn);
        }

        // Show/hide add button based on max layers
        addBtn.style.display = layers.length >= MAX_LAYERS ? 'none' : 'flex';
    }

    // Initial render
    renderLayerButtons();

    // Add layer button
    addBtn.addEventListener('click', async () => {
        showConfirmModal(
            "この操作によりアンドゥ履歴が失われます。\n続けますか？",
            'layerAdd',
            async () => {
                const layer = createLayer();
                if (layer) {
                    // Apply current zoom/pan to the new layer immediately
                    applyTransform();

                    await resetHistory();
                    updateAllThumbnails();
                    renderLayerButtons();
                    updateActiveLayerIndicator();
                }
            }
        );
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
    const drawModes = ['pen', 'fill', 'tone', 'sketch'];
    // Eraser modes for state (mapping from menu items handled separately or matched here)
    const eraserToggleModes = ['lasso', 'pen'];

    // Tool button click/long-press
    let longPressTimer = null;
    let longPressTriggered = false;

    function setupToolButton(btn, menuId, isEraser, toggleModes) {
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

            // Quick tap: activate or toggle
            hideAllMenus(); // Always close any open menus when clicking a tool button

            if (isEraser) {
                if (state.isEraserActive) {
                    // Toggle
                    const currentIndex = toggleModes.indexOf(state.currentEraser);
                    if (currentIndex !== -1) {
                        const nextMode = toggleModes[(currentIndex + 1) % toggleModes.length];
                        state.currentEraser = nextMode;
                        updateEraserToolIcon();
                    }
                } else {
                    // Activate
                    state.isEraserActive = true;
                    state.isErasing = true;
                }
            } else {
                if (!state.isEraserActive) {
                    // Toggle (only if draw tool is already active)
                    const currentIndex = toggleModes.indexOf(state.currentTool);
                    if (currentIndex !== -1) {
                        const nextMode = toggleModes[(currentIndex + 1) % toggleModes.length];
                        state.currentTool = nextMode;
                        updateDrawToolIcon();

                        // Explicitly update Tone menu visibility when toggling via button
                        updateToneMenuVisibility();
                    }
                } else {
                    // Activate
                    state.isEraserActive = false;
                    state.isErasing = false;

                    // Explicitly update Tone menu visibility when switching from eraser
                    updateToneMenuVisibility();
                }
            }
            updateToolButtonStates();
            updateBrushSizeVisibility(); // Important: Update visibility after toggle
            updateBrushSizeSlider();
        });

        btn.addEventListener('pointerleave', () => clearTimeout(longPressTimer));
        btn.addEventListener('pointercancel', () => clearTimeout(longPressTimer));
    }

    setupToolButton(drawBtn, 'draw-tool-menu', false, drawModes);
    // eraserToggleModes only includes lasso and pen, excluding 'layer_clear'
    setupToolButton(eraserBtn, 'eraser-tool-menu', true, eraserToggleModes);

    // Setup draw tool menu - selection behavior
    const drawMenu = document.getElementById('draw-tool-menu');
    drawMenu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const mode = item.dataset.mode;

            // Set tool directly, no cycling when clicking in menu
            state.currentTool = mode;
            state.isEraserActive = false;
            state.isErasing = false;

            updateDrawToolIcon();
            updateToolButtonStates();
            hideAllMenus();
        });
    });

    // Setup eraser tool menu
    const eraserMenu = document.getElementById('eraser-tool-menu');
    // Menu item modes for eraser include 'layer_clear', 'eraser_lasso', 'eraser_pen'
    const eraserMenuModes = ['eraser_lasso', 'eraser_pen'];

    eraserMenu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', async () => {
            const mode = item.dataset.mode;

            if (mode === 'layer_clear') {
                // Instant layer clear - no toggle
                await saveState();
                clearLayer(state.activeLayer);
                updateLayerThumbnail(getActiveLayer());
                flashLayer(state.activeLayer);
            } else if (eraserMenuModes.includes(mode)) {
                // Set eraser type directly, no cycling when clicking in menu
                const eraserType = mode === 'eraser_lasso' ? 'lasso' : 'pen';
                state.currentEraser = eraserType;
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

    // Update tone menu visibility initially
    updateToneMenuVisibility();
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
        case 'tone': selector = '.tool-tone'; break;
        default: selector = '.tool-pen'; break;
    }

    console.log('[DEBUG] updateDrawToolIcon:', state.currentTool, selector);

    const activeIcon = btn.querySelector(selector);
    if (activeIcon) {
        console.log('[DEBUG] Active Icon Src:', activeIcon.src);
        activeIcon.style.display = 'block';
        activeIcon.classList.add('active');
    }

    updateToneMenuVisibility();
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
    const mergeBtn = menu.querySelector('.layer-merge-btn');

    // Remove old listeners
    const newSlider = slider.cloneNode(true);
    slider.parentNode.replaceChild(newSlider, slider);

    const newVisToggle = visToggle.cloneNode(true);
    visToggle.parentNode.replaceChild(newVisToggle, visToggle);

    const newDeleteBtn = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);

    const newMergeBtn = mergeBtn.cloneNode(true);
    mergeBtn.parentNode.replaceChild(newMergeBtn, mergeBtn);

    // Move buttons
    const moveButtons = menu.querySelectorAll('.layer-move-btn');
    moveButtons.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', () => {
            const direction = newBtn.dataset.dir;
            if (moveLayer(layerId, direction)) {
                window.renderLayerButtons(); // Re-render list
                // Keep menu open but update position or close? 
                // Closing is safer as positions change
                hideAllMenus();
                // Flash the moved layer
                flashLayer(layerId);
            }
        });
    });

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

    // Merge button
    newMergeBtn.addEventListener('click', async () => {
        const index = layers.findIndex(l => l.id === layerId);
        if (index <= 0) return;

        showConfirmModal(
            "この操作によりアンドゥ履歴が失われます。\n下のレイヤーに統合しますか？",
            'layerMerge',
            async () => {
                if (mergeLayerDown(layerId)) {
                    await resetHistory();
                    window.renderLayerButtons();
                    updateActiveLayerIndicator();
                    hideAllMenus();
                }
            }
        );
    });

    // Disable merge if bottom layer
    const isBottom = layers.findIndex(l => l.id === layerId) <= 0;
    newMergeBtn.classList.toggle('disabled', isBottom);

    // Delete button
    newDeleteBtn.addEventListener('click', async () => {
        if (layers.length <= 1) return; // Can't delete last layer

        showConfirmModal(
            "この操作によりアンドゥ履歴が失われます。\n続けますか？",
            'layerDelete',
            async () => {
                if (deleteLayer(layerId)) {
                    await resetHistory();
                    window.renderLayerButtons();
                    updateActiveLayerIndicator();
                    hideAllMenus();
                }
            }
        );
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

    // Show slider always, but disable for lasso-based tools (fill, tone, eraser-lasso)
    // Show slider always, but disable for lasso-based tools (fill, tone, eraser-lasso, sketch)
    // Only Pen tool needs slider.
    const isPenMode = (state.currentTool === 'pen') && !state.isEraserActive;
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

// ============================================
// Thumbnail Helper
// ============================================

export function updateLayerThumbnail(layer) {
    if (!layer) return;

    // Create offscreen canvas for thumbnail generation if not exists
    if (!state.thumbCanvas) {
        state.thumbCanvas = document.createElement('canvas');
        state.thumbCanvas.width = 48;
        state.thumbCanvas.height = 32;
        state.thumbCtx = state.thumbCanvas.getContext('2d');
    }

    const ctx = state.thumbCtx;
    ctx.clearRect(0, 0, 48, 32);

    // Draw layer content scaled down
    // We need to keep aspect ratio or fill? 48x32 is 3:2. Screen is 9:16 approx.
    // Let's fit "contain" style.
    const sWidth = layer.canvas.width;
    const sHeight = layer.canvas.height;
    const dWidth = 48;
    const dHeight = 32;

    // Simple scale to fit height or width?
    // Let's just draw the whole canvas into the thumbnail rect directly (stretch)
    // or maintain aspect ratio?
    // Stretcing might look weird but "contain" in button background handles display.
    // But if we generate a distorted image, "contain" will show distorted image.
    // Better generate a proper thumbnail.
    // Actually, let's just draw full canvas to small canvas.
    // If the aspect ratios differ, it will stretch.
    // Layer buttons are 48x32. Window is variable.
    // Let's rely on the button's background-size: contain.
    // The generated image should be representative.
    // Drawing the whole canvas into 48x32 will stretch it.
    // If we use it as background-image with 'contain', it will un-stretch it IF the element has same aspect ratio.
    // The button is 48x32 fixed.
    // So we should generate an image that represents the whole canvas.
    // If we stretch it here, and then show it in 48x32 button, it will fill the button.
    // If the canvas is tall (mobile), and button is wide, the image is squashed vertically.
    // If we use background-size: contain, we want the source image to have correct aspect ratio?
    // No, 'contain' scales the image to fit.
    // If we create a 48x32 image that is a squashed version of the canvas...
    // displaying it 'contain' inside a 48x32 button will show the squashed image filling the button.
    // We want to show the layer content with correct aspect ratio.
    // So we should capture the canvas as is (or scaled maintaining aspect ratio).
    // Actually, `toDataURL` returns the full image if we don't draw to a temp canvas.
    // But full image is too big (~MBs). We MUST scale down.
    // So:
    // 1. Calculate aspect ratio.
    // 2. Draw scaled image to temp canvas (centering it?)
    // OR just draw distinct pixels?
    // Let's just draw the full canvas into 48x32 and let it stretch.
    // Wait, if it stretches, it looks bad.
    // We should preserve aspect ratio in the thumbnail canvas.
    // Canvas: W x H. Thumb: 48 x 32.
    // Scale = min(48/W, 32/H).
    // Draw at center.

    const scale = Math.min(dWidth / sWidth, dHeight / sHeight);
    const drawW = sWidth * scale;
    const drawH = sHeight * scale;
    const offsetX = (dWidth - drawW) / 2;
    const offsetY = (dHeight - drawH) / 2;

    ctx.drawImage(layer.canvas, 0, 0, sWidth, sHeight, offsetX, offsetY, drawW, drawH);

    layer.thumbnail = state.thumbCanvas.toDataURL();

    // Immediately update DOM
    const btn = document.querySelector(`.layer-btn[data-layer-id="${layer.id}"]`);
    if (btn) {
        btn.style.backgroundImage = `url(${layer.thumbnail})`;
        btn.style.backgroundSize = 'contain';
        btn.style.backgroundRepeat = 'no-repeat';
        btn.style.backgroundPosition = 'center';
    }
}

function flashLayer(layerId) {
    const layer = getLayer(layerId);
    if (!layer) return;

    // Create or get flash overlay
    let flashCanvas = document.getElementById('flash-overlay');
    if (!flashCanvas) {
        flashCanvas = document.createElement('canvas');
        flashCanvas.id = 'flash-overlay';
        flashCanvas.style.position = 'absolute';
        flashCanvas.style.top = '0';
        flashCanvas.style.left = '0';
        flashCanvas.style.pointerEvents = 'none';
        flashCanvas.style.zIndex = '50'; // Above layers
        flashCanvas.style.transition = 'opacity 0.2s';
        flashCanvas.style.transformOrigin = '0 0'; // Match layer transform origin

        // Append to layer container to ensure correct stacking context if needed,
        // or just to body/layer-container. MUST be sibling to layers to share transform context?
        // No, layers are children of body (via initCanvas appending them? No, state.js says...)
        // Let's check state.js for where layers are attached.
        const layerContainer = document.getElementById('layer-container');
        if (layerContainer) {
            layerContainer.appendChild(flashCanvas);
        } else {
            document.body.appendChild(flashCanvas);
        }
    }

    // Match transform immediately (though applied via class usually or style)
    // We need to ensure it has the current transform state.
    // Since we appended it to layer-container, and layer-container... wait.
    // layers are appended to layerContainer?
    // checking UI.js initLayer... actually 'createLayer' in state.js handles appending.

    // In canvas.js we saw:
    // for (const layer of layers) { layer.canvas.style.transform = transform; }
    // So layers are transformed INDIVIDUALLY.
    // So flashCanvas MUST be transformed individually too.

    flashCanvas.style.transform = layer.canvas.style.transform;
    flashCanvas.width = layer.canvas.width;
    flashCanvas.height = layer.canvas.height;

    const ctx = flashCanvas.getContext('2d');
    ctx.clearRect(0, 0, flashCanvas.width, flashCanvas.height);

    // Draw layer content at 100% opacity
    ctx.globalAlpha = 1.0;
    ctx.drawImage(layer.canvas, 0, 0);

    // Apply Flash Style
    // We want the FLASH to be visible.
    // If we just show the content, it looks like the layer turned opaque.
    // We want to apply the glow.
    flashCanvas.style.filter = 'drop-shadow(0 0 6px #00aaff) brightness(1.2)';
    flashCanvas.style.opacity = '1';

    // Remove after delay
    setTimeout(() => {
        flashCanvas.style.opacity = '0';
        setTimeout(() => {
            // Optional: clear canvas to save memory/rendering?
            ctx.clearRect(0, 0, flashCanvas.width, flashCanvas.height);
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

    // Wheel for zoom
    eventCanvas.addEventListener('wheel', handleWheel, { passive: false });
}

async function handlePointerDown(e) {
    if (state.isSaveMode) return;

    // Notify AI module: stroke starting
    onStrokeStart();

    // Prevent default to avoid native touch actions
    e.preventDefault();

    try {
        eventCanvas.setPointerCapture(e.pointerId);
    } catch (err) {
        // Ignore if capture fails
    }

    // Track active pointers with detailed state
    state.activePointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        totalMove: 0
    });

    // Detect pencil
    if (e.pointerType === 'pen') {
        state.pencilDetected = true;
    }

    // Reset interaction flags if this is the first pointer
    if (state.activePointers.size === 1) {
        state.touchStartTime = Date.now();
        state.touchStartPos = { x: e.clientX, y: e.clientY };
        state.maxFingers = 1;
        state.isPinching = false;
        state.wasPanning = false;
        state.wasPinching = false;
        state.didInteract = false;
        state.totalDragDistance = 0;
    }
    state.maxFingers = Math.max(state.maxFingers, state.activePointers.size);

    // Zoom with Ctrl + Space + Click
    if (state.isSpacePressed && state.isCtrlPressed && state.activePointers.size === 1) {
        handleZoomClick(e);
        return;
    }

    // 2 Fingers = Pinch/Pan preparation
    if (state.activePointers.size === 2) {
        state.isPinching = false; // Will trigger on move
        const pts = Array.from(state.activePointers.values());
        state.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        state.lastPinchCenter = {
            x: (pts[0].x + pts[1].x) / 2,
            y: (pts[0].y + pts[1].y) / 2
        };
        state.initialPinchDist = state.lastPinchDist;
        state.initialPinchCenter = { ...state.lastPinchCenter };

        // Interrupt drawing if 2nd finger touches
        if (state.isPenDrawing || state.isLassoing || state.isErasing || state.drawingPending) {
            // Check if 2nd finger came very quickly after 1st (likely a 2-finger tap intent)
            const timeSinceFirstFinger = Date.now() - state.touchStartTime;
            const isTwoFingerTapIntent = timeSinceFirstFinger < 150;

            cancelCurrentOperation();

            // Only mark as interaction if NOT a quick 2-finger tap
            // Quick 2-finger tap = user likely wants undo, not drawing interruption
            if (!isTwoFingerTapIntent) {
                state.didInteract = true;
            }
        }
        return;
    }

    // Pan with space
    if (state.activePointers.size === 1 && state.isSpacePressed) {
        state.isPanning = true;
        state.panStartX = e.clientX;
        state.panStartY = e.clientY;
        state.panStartTranslateX = state.translateX;
        state.panStartTranslateY = state.translateY;
        eventCanvas.style.cursor = 'grabbing';
        return;
    }

    // 1 Finger = Drawing (if not space pressed)
    const canDraw = e.pointerType === 'pen' || e.pointerType === 'mouse' || (e.pointerType === 'touch' && !state.pencilDetected);

    if (state.activePointers.size === 1 && canDraw) {
        state.drawingPointerId = e.pointerId;
        state.strokeMade = false;

        const canvasPoint = getCanvasPoint(e.clientX, e.clientY);

        if (state.isEraserActive) {
            if (state.currentEraser === 'lasso' && state.activePointers.size === 1) {
                startLasso(e.clientX, e.clientY);
            } else if (state.currentEraser === 'pen') {
                state.drawingPending = true;
                await saveState();
                if (!state.drawingPending) {
                    state.undoStack.pop(); // Revert save if aborted
                    return;
                }
                state.drawingPending = false;
                state.isErasing = true;
                startPenDrawing(canvasPoint.x, canvasPoint.y);
            }
        } else {
            if ((state.currentTool === 'fill' || state.currentTool === 'sketch' || state.currentTool === 'tone') && state.activePointers.size === 1) {
                startLasso(e.clientX, e.clientY);
            } else if (state.currentTool === 'pen') {
                state.drawingPending = true;
                console.log('[DEBUG] Before saveState, undoStack.length:', state.undoStack.length);
                await saveState();
                console.log('[DEBUG] After saveState, undoStack.length:', state.undoStack.length);
                if (!state.drawingPending) {
                    state.undoStack.pop(); // Revert save if aborted
                    console.log('[DEBUG] Drawing aborted, popped from undoStack');
                    return;
                }
                state.drawingPending = false;
                startPenDrawing(canvasPoint.x, canvasPoint.y);
            }
        }
        state.strokeMade = true;
    }
    updateDebugDisplay();
}

function handleZoomClick(e) {
    const zoomFactor = state.isAltPressed ? 0.8 : 1.25;
    const newScale = Math.max(0.1, Math.min(10, state.scale * zoomFactor));
    const clickX = e.clientX;
    const clickY = e.clientY;
    const canvasX = (clickX - state.translateX) / state.scale;
    const canvasY = (clickY - state.translateY) / state.scale;
    state.scale = newScale;
    state.translateX = clickX - canvasX * state.scale;
    state.translateY = clickY - canvasY * state.scale;
    applyTransform();
    state.didInteract = true;
}

function cancelCurrentOperation() {
    if (state.isLassoing) {
        finishLasso(); // Just finish, don't fill
        // Note: Don't call restoreLayer() here - lasso doesn't call saveState()
        // on start, so there's nothing to restore. Calling restoreLayer() would
        // restore to the state BEFORE the last completed operation.
    }
    if (state.isPenDrawing || state.isErasing) {
        const layer = getActiveLayer();
        if (layer) restoreLayer(layer.id);
        // Remove the saveState() entry that was added when drawing started
        // Otherwise undo() would restore to the same state (no visible change)
        state.undoStack.pop();
        state.isPenDrawing = false;
        state.lastPenPoint = null;
    }
    state.drawingPointerId = null;
    state.isErasing = false;
    state.isLassoing = false;
    state.strokeMade = false;
    state.didInteract = false;
    state.drawingPending = false;
}

async function handlePointerMove(e) {
    if (state.isSaveMode) return;
    if (!state.activePointers.has(e.pointerId)) return;

    e.preventDefault();

    const pointer = state.activePointers.get(e.pointerId);
    const dx = e.clientX - pointer.x;
    const dy = e.clientY - pointer.y;
    const moveDist = Math.hypot(dx, dy);

    pointer.totalMove = (pointer.totalMove || 0) + moveDist;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    state.activePointers.set(e.pointerId, pointer);

    // 2 Fingers = Pinch / Pan
    if (state.activePointers.size === 2) {
        const pts = Array.from(state.activePointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const center = {
            x: (pts[0].x + pts[1].x) / 2,
            y: (pts[0].y + pts[1].y) / 2
        };

        // Threshold check
        const distDelta = Math.abs(dist - state.initialPinchDist);
        const centerDelta = Math.hypot(center.x - state.initialPinchCenter.x, center.y - state.initialPinchCenter.y);

        if (distDelta > 20 || centerDelta > 20) {
            state.isPinching = true;
            state.wasPinching = true;
            state.didInteract = true;
        }

        if (state.isPinching) {
            const zoomFactor = dist / state.lastPinchDist;
            const oldScale = state.scale;
            state.scale = Math.min(Math.max(state.scale * zoomFactor, 0.1), 10);

            // Zoom anchored
            state.translateX = center.x - (center.x - state.translateX) * (state.scale / oldScale);
            state.translateY = center.y - (center.y - state.translateY) * (state.scale / oldScale);

            // Pan during pinch
            state.translateX += center.x - state.lastPinchCenter.x;
            state.translateY += center.y - state.lastPinchCenter.y;

            applyTransform();
        }

        state.lastPinchDist = dist;
        state.lastPinchCenter = center;
        return;
    }

    // Pan
    if (state.isPanning && state.activePointers.size === 1) {
        state.translateX = state.panStartTranslateX + (e.clientX - state.panStartX);
        state.translateY = state.panStartTranslateY + (e.clientY - state.panStartY);
        applyTransform();
        state.wasPanning = true;
        state.didInteract = true;
        return;
    }

    // Interaction threshold
    if (pointer.totalMove > 20) {
        state.didInteract = true;
    }

    // Drawing
    if (e.pointerId === state.drawingPointerId) {
        // Skip drawing if we just finished a pinch/pan or moved too little
        if (state.wasPinching || state.wasPanning) return;

        const canvasPoint = getCanvasPoint(e.clientX, e.clientY);

        if (state.isLassoing) {
            updateLasso(e.clientX, e.clientY);
        } else if (state.isPenDrawing) {
            drawPenLine(canvasPoint.x, canvasPoint.y);
        }
    }
}

async function handlePointerUp(e) {
    if (state.isSaveMode) return;
    e.preventDefault();

    // Skip if this pointer was already processed (can happen when both
    // pointerleave and pointerup fire for the same finger)
    if (!state.activePointers.has(e.pointerId)) {
        return;
    }

    if (state.isPanning) {
        state.isPanning = false;
        eventCanvas.style.cursor = '';
    }

    const pointer = state.activePointers.get(e.pointerId);
    if (pointer && pointer.totalMove > 20) {
        state.didInteract = true;
    }

    state.activePointers.delete(e.pointerId);

    try {
        eventCanvas.releasePointerCapture(e.pointerId);
    } catch (err) { }

    // Reset pinch checks
    if (state.activePointers.size < 2) {
        state.isPinching = false;
    }

    // If all fingers up
    if (state.activePointers.size === 0) {
        const duration = Date.now() - state.touchStartTime;

        // Check for gestures (Undo/Redo)
        // Trigger if: short tap, no significant movement/interaction
        console.log('[DEBUG] Undo check:', { duration, didInteract: state.didInteract, strokeMade: state.strokeMade, maxFingers: state.maxFingers, wasPanning: state.wasPanning, wasPinching: state.wasPinching, undoStackLength: state.undoStack.length });

        let undoCalled = false;
        if (duration < 400 && !state.didInteract && !state.strokeMade && !state.wasPanning && !state.wasPinching) {
            // Note: maxFingers tracks maximum fingers seen during this touch session
            if (state.maxFingers === 2) {
                console.log('[DEBUG] Calling undo()');
                undoCallCount++;
                await undo();
                updateAllThumbnails();
                undoCalled = true;
            } else if (state.maxFingers === 3) {
                await redo();
                updateAllThumbnails();
            }
        }

        // Record last undo check for debugging
        lastUndoCheck = {
            duration: duration,
            maxFingers: state.maxFingers,
            strokeMade: state.strokeMade,
            didInteract: state.didInteract,
            wasPinching: state.wasPinching,
            wasPanning: state.wasPanning,
            undoCalled: undoCalled
        };
        updateDebugDisplay();

        // Handle Flood Fill Tap/Click
        console.log('[DEBUG] Fill check:', {
            duration,
            didInteract: state.didInteract,
            strokeMade: state.strokeMade,
            wasPanning: state.wasPanning,
            wasPinching: state.wasPinching,
            maxFingers: state.maxFingers,
            currentTool: state.currentTool,
            isEraserActive: state.isEraserActive
        });

        if (duration < 300 && !state.didInteract && !state.strokeMade && !state.wasPanning && !state.wasPinching && state.maxFingers === 1) {
            const canvasPoint = getCanvasPoint(e.clientX, e.clientY);

            // Fill tool tap
            if (state.currentTool === 'fill' && !state.isEraserActive) {
                console.log('[DEBUG] Triggering fill at', canvasPoint);
                await saveState();
                floodFill(Math.floor(canvasPoint.x), Math.floor(canvasPoint.y), hexToRgba(state.color));
                updateLayerThumbnail(getActiveLayer());
            } else if (state.currentTool === 'tone' && !state.isEraserActive) {
                // Tone fill tap
                console.log('[DEBUG] Triggering tone fill at', canvasPoint);
                await saveState();
                floodFillTone(Math.floor(canvasPoint.x), Math.floor(canvasPoint.y));
                updateLayerThumbnail(getActiveLayer());
            } else if (state.isEraserActive && state.currentEraser === 'lasso') {
                // Eraser does not have tap fill (could add flood erase?)
            }
        }

        // Finish Drawing Actions
        if (e.pointerId === state.drawingPointerId) {
            if (state.isLassoing) {
                const points = finishLasso();

                // Check if this was a click (minimal movement) rather than a drag
                const wasClick = pointer && pointer.totalMove < 5;

                console.log('[DEBUG] Lasso finished:', {
                    pointsLength: points ? points.length : 0,
                    wasClick,
                    totalMove: pointer ? pointer.totalMove : 'N/A'
                });

                if (wasClick && duration < 300 && !state.wasPanning && !state.wasPinching) {
                    // Click detected - trigger flood fill
                    const canvasPoint = getCanvasPoint(e.clientX, e.clientY);

                    if (state.currentTool === 'fill' && !state.isEraserActive) {
                        console.log('[DEBUG] Click triggering fill at', canvasPoint);
                        await saveState();
                        floodFill(Math.floor(canvasPoint.x), Math.floor(canvasPoint.y), [0, 0, 0, 255]);
                        updateLayerThumbnail(getActiveLayer());
                    } else if (state.currentTool === 'tone' && !state.isEraserActive) {
                        console.log('[DEBUG] Click triggering tone fill at', canvasPoint);
                        await saveState();
                        floodFillTone(Math.floor(canvasPoint.x), Math.floor(canvasPoint.y));
                        updateLayerThumbnail(getActiveLayer());
                    } else if (state.currentTool === 'sketch' && !state.isEraserActive) {
                        console.log('[DEBUG] Click triggering sketch fill at', canvasPoint);
                        await saveState();
                        floodFillSketch(Math.floor(canvasPoint.x), Math.floor(canvasPoint.y));
                        updateLayerThumbnail(getActiveLayer());
                    } else if (state.isEraserActive && state.currentEraser === 'lasso') {
                        console.log('[DEBUG] Click triggering eraser fill at', canvasPoint);
                        await saveState();
                        floodFillTransparent(Math.floor(canvasPoint.x), Math.floor(canvasPoint.y));
                        updateLayerThumbnail(getActiveLayer());
                    }
                } else if (points && points.length >= 3 && !state.wasPanning && !state.wasPinching) {
                    // Drag detected - normal polygon fill
                    await saveState();
                    if (state.isEraserActive) {
                        fillPolygonTransparent(points);
                    } else if (state.currentTool === 'tone') {
                        fillTone(points);
                    } else {
                        fillPolygon(points);
                    }
                    updateLayerThumbnail(getActiveLayer());
                }
            } else if (state.isPenDrawing) {
                await endPenDrawing();
                updateLayerThumbnail(getActiveLayer());
            }
            state.drawingPointerId = null;
        }

        // Notify AI module: stroke ended
        onStrokeEnd();

        // Clean up
        state.isErasing = false;
        state.isPenDrawing = false;
        state.isLassoing = false;
        state.strokeMade = false;
        // Note: Don't reset maxFingers here - it would break undo gesture
        // if user taps 2 fingers immediately after pen drawing.
        // maxFingers is already reset in handlePointerDown when first finger touches.
        updateDebugDisplay();
    }
}

function handlePointerCancel(e) {
    state.activePointers.delete(e.pointerId);
    try {
        eventCanvas.releasePointerCapture(e.pointerId);
    } catch (err) { }

    cancelCurrentOperation();

    if (state.activePointers.size === 0) {
        state.isPanning = false;
        state.isPinching = false;
        eventCanvas.style.cursor = '';
    }
}

// Separate Touch Handlers are no longer needed as Pointer Events handle everything
// handleTouchStart, handleTouchMove, handleTouchEnd were removed.

function handleWheel(e) {
    e.preventDefault();

    const zoomSpeed = 0.001;
    const delta = -e.deltaY * zoomSpeed;
    const newScale = Math.min(Math.max(state.scale * (1 + delta), 0.1), 10);

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

    // Prevent events from bubbling to canvas (fixes slider drag issue)
    brushSizeSlider.addEventListener('pointerdown', (e) => e.stopPropagation());
    brushSizeSlider.addEventListener('pointermove', (e) => e.stopPropagation());
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
            updateLayerThumbnail(layer);
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
// Tone Menu
// ============================================

function setupToneMenu() {
    const menu = document.getElementById('tone-menu');
    const itemsContainer = document.getElementById('tone-items');
    if (!menu || !itemsContainer) return;

    itemsContainer.innerHTML = ''; // Clear items only

    TONE_PRESETS.forEach(preset => {
        const item = document.createElement('div');
        item.className = 'tone-item';
        if (preset.id === currentTonePresetId) {
            item.classList.add('active');
        }
        // item.textContent = preset.name; // Removed text
        item.dataset.id = preset.id;
        item.title = `${preset.name} (${preset.type})`;

        // Create preview
        const preview = createTonePreview(preset, 40, 40); // Slightly smaller than container
        item.appendChild(preview);

        item.addEventListener('click', (e) => {
            // Prevent event propagation so we don't trigger outside click logic immediately if it exists
            e.stopPropagation();

            setTonePreset(preset.id);

            // Update active state
            menu.querySelectorAll('.tone-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');

            // Only close if NOT pinned
            if (!state.isToneMenuPinned) {
                menu.classList.add('hidden');
            }
        });

        itemsContainer.appendChild(item);
    });

    // Setup pin behavior
    const pinBtn = document.getElementById('tone-menu-pin');
    if (pinBtn) {
        pinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isToneMenuPinned = !state.isToneMenuPinned;
            pinBtn.classList.toggle('active', state.isToneMenuPinned);
        });
        // Initial state
        pinBtn.classList.toggle('active', state.isToneMenuPinned);
    }

    // Setup outside click listener to close menu (ONLY if not pinned)
    const handleOutsideClickTone = (e) => {
        if (!state.isToneMenuPinned && !menu.classList.contains('hidden') && !menu.contains(e.target)) {
            // Check if we clicked the tool button - if so, let its own click handler handle it
            const toolBtn = document.getElementById('drawToolBtn');
            if (toolBtn && toolBtn.contains(e.target)) return;

            menu.classList.add('hidden');
        }
    };

    document.addEventListener('pointerdown', handleOutsideClickTone);
}

function updateToneMenuVisibility() {
    const menu = document.getElementById('tone-menu');
    if (!menu) return;

    if (state.currentTool === 'tone' && !state.isEraserActive) {
        menu.classList.remove('hidden');
    } else {
        menu.classList.add('hidden');
    }
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
        setTimeout(async () => {
            // Save all layer contents as ImageBitmaps
            const layerBitmaps = await Promise.all(
                layers.map(layer => createImageBitmap(layer.canvas))
            );

            // Resize all canvases
            const w = window.innerWidth;
            const h = window.innerHeight;

            lassoCanvas.width = w;
            lassoCanvas.height = h;

            selectionCanvas.width = w;
            selectionCanvas.height = h;

            // Restore each layer
            for (let i = 0; i < layers.length; i++) {
                const layer = layers[i];
                layer.canvas.width = w;
                layer.canvas.height = h;
                layer.ctx.drawImage(layerBitmaps[i], 0, 0);
                layerBitmaps[i].close();
            }

            // Reapply transform (zoom/pan)
            applyTransform();
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
    document.addEventListener('keydown', async (e) => {
        // Modifier key tracking
        if (e.code === 'Space') {
            e.preventDefault();
            state.isSpacePressed = true;
            eventCanvas.style.cursor = 'grab';
        }
        if (e.ctrlKey || e.metaKey) state.isCtrlPressed = true;
        if (e.altKey) state.isAltPressed = true;



        // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
        // Undo: Ctrl/Cmd + Z
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault();
            undoCallCount++;
            await undo();
            updateAllThumbnails();
        }

        // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
        if ((e.ctrlKey || e.metaKey) && (
            (e.shiftKey && (e.key === 'z' || e.key === 'Z')) ||
            (e.key === 'y' || e.key === 'Y')
        )) {
            e.preventDefault();
            await redo();
            updateAllThumbnails();
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

export function updateAllThumbnails() {
    layers.forEach(layer => {
        updateLayerThumbnail(layer);
    });
}
