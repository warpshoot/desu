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
    startStippleDrawing, drawStippleLine, endStippleDrawing
} from './tools/stipple.js';
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
    setupBrushPalette();
    setupBrushSettingsPanel();
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
            hideAllMenus();
            try {
                const success = await exportProject();

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


    layerButtons.addEventListener('pointerup', (e) => {
        const btn = e.target.closest('.layer-btn');
        if (!btn) return;

        hideAllMenus();

        const layerId = parseInt(btn.dataset.layerId);
        flashLayer(layerId);

        if (layerId !== state.activeLayer) {
            // 別レイヤーをタップ → 切り替えのみ
            state.activeLayer = layerId;
            renderLayerButtons();
            updateActiveLayerIndicator();
        } else {
            // アクティブなレイヤーを再タップ → メニュー展開
            showLayerMenu(btn);
        }
    });

    layerButtons.addEventListener('pointerleave', () => {});
    layerButtons.addEventListener('pointercancel', () => {});

    // Expose render function for external updates
    window.renderLayerButtons = renderLayerButtons;
}

// ============================================
// Tool Panel (Draw + Eraser)
// ============================================

function setupToolPanel() {
    const drawButtons = document.querySelectorAll('.draw-btn');
    const eraserButtons = document.querySelectorAll('.eraser-btn');

    drawButtons.forEach(btn => {
        btn.addEventListener('pointerup', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const mode = btn.dataset.mode;
            const isToneButton = (mode === 'tone');
            const isAlreadyActive = !state.isEraserActive && state.currentTool === mode;
            
            const menu = document.getElementById('tone-menu');
            const wasMenuVisible = menu && !menu.classList.contains('hidden');

            // 一旦すべてのメニューを閉じる
            hideAllMenus();

            // トーンツールの再タップ時かつ、メニューが表示されていた場合は
            // そのまま閉じた状態（hideAllMenusの結果）を維持して終了
            if (isToneButton && isAlreadyActive && wasMenuVisible) {
                return;
            }

            // それ以外（新規切り替え、または閉じていたメニューを開く）
            state.isEraserActive = false;
            state.isErasing = false;
            state.currentTool = mode;
            
            updateToolButtonStates();
            updateToneMenuVisibility(); 
            updateBrushSizeVisibility();
            updateBrushSizeSlider();
        });
    });

    eraserButtons.forEach(btn => {
        btn.addEventListener('pointerup', (e) => {
            e.preventDefault();
            hideAllMenus();
            state.isEraserActive = true;
            state.isErasing = true;
            state.currentEraser = btn.dataset.mode;
            updateToolButtonStates();
            updateToneMenuVisibility();
            updateBrushSizeVisibility();
            updateBrushSizeSlider();
        });
    });

    // Undo / Redo
    const undoBtn = document.getElementById('btn-undo');
    if(undoBtn) {
        undoBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            hideAllMenus();
            await undo();
            if (window.renderLayerButtons) window.renderLayerButtons();
        });
    }
    const redoBtn = document.getElementById('btn-redo');
    if(redoBtn) {
        redoBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            hideAllMenus();
            await redo();
            if (window.renderLayerButtons) window.renderLayerButtons();
        });
    }

    // Initial state
    updateToolButtonStates();
    updateToneMenuVisibility();
}

function updateDrawToolIcon() { /* 廃止: 独立ボタンになったため不要 */ }
function updateEraserToolIcon() { /* 廃止: 独立ボタンになったため不要 */ }

function updateToolButtonStates() {
    document.querySelectorAll('.draw-btn').forEach(btn => {
        if (!state.isEraserActive && state.currentTool === btn.dataset.mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.eraser-btn').forEach(btn => {
        if (state.isEraserActive && state.currentEraser === btn.dataset.mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // ブラシパレット (ペン先) は「ペン」モードの時だけ有効
    const brushPalette = document.getElementById('brush-palette');
    const brushSettingsPanel = document.getElementById('brush-settings-panel');
    const isPenMode = !state.isEraserActive && state.currentTool === 'pen';

    if (brushPalette) {
        if (isPenMode) {
            brushPalette.classList.remove('disabled');
        } else {
            brushPalette.classList.add('disabled');
        }
    }

    // ペン以外を選んだらブラシ設定パネルを閉じる
    if (!isPenMode && brushSettingsPanel) {
        brushSettingsPanel.classList.add('hidden');
    }

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
    // レイヤーは右端にあるのでメニューはボタンの左側に出す
    menu.style.right = (window.innerWidth - rect.left + 10) + 'px';
    menu.style.left = 'auto';
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
    // 汎用メニュー閉じ
    document.querySelectorAll('.tool-menu').forEach(menu => {
        menu.classList.add('hidden');
    });

    // ブラシ設定パネルも閉じる
    const brushSettingsPanel = document.getElementById('brush-settings-panel');
    if (brushSettingsPanel) {
        brushSettingsPanel.classList.add('hidden');
    }

    // トーンメニュー（固定されていない場合）も閉じる
    const toneMenu = document.getElementById('tone-menu');
    if (toneMenu && !state.isToneMenuPinned) {
        toneMenu.classList.add('hidden');
    }

    // ファイルメニューなども閉じられていることを確実に
    const fileMenu = document.getElementById('file-menu');
    if (fileMenu) fileMenu.classList.add('hidden');

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
    const isPenMode = (state.currentTool === 'pen' || state.currentTool === 'stipple') && !state.isEraserActive;
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
        slider.value = state.activeBrush.size;
        display.textContent = state.activeBrush.size;
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

    // Prevent iOS Safari pinch-to-zoom (gesturestart/change/end are Safari-proprietary)
    document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });
}

async function handlePointerDown(e) {
    if (state.isSaveMode) return;
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
                startPenDrawing(canvasPoint.x, canvasPoint.y, e.pressure);
            }
        } else {
            if ((state.currentTool === 'fill' || state.currentTool === 'sketch' || state.currentTool === 'tone') && state.activePointers.size === 1) {
                startLasso(e.clientX, e.clientY);
            } else if (state.currentTool === 'pen' || state.currentTool === 'stipple') {
                state.drawingPending = true;
                await saveState();
                if (!state.drawingPending) {
                    state.undoStack.pop(); // Revert save if aborted
                    return;
                }
                state.drawingPending = false;
                if (state.currentTool === 'stipple') {
                    startStippleDrawing(canvasPoint.x, canvasPoint.y, e.pressure);
                } else {
                    startPenDrawing(canvasPoint.x, canvasPoint.y, e.pressure);
                }
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
            const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
            for (const ev of events) {
                const pt = getCanvasPoint(ev.clientX, ev.clientY);
                if (state.currentTool === 'stipple') {
                    drawStippleLine(pt.x, pt.y, ev.pressure);
                } else {
                    drawPenLine(pt.x, pt.y, ev.pressure);
                }
            }
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

        let undoCalled = false;
        if (duration < 400 && !state.didInteract && !state.strokeMade && !state.wasPanning && !state.wasPinching) {
            // Note: maxFingers tracks maximum fingers seen during this touch session
            if (state.maxFingers === 2) {
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

        if (duration < 300 && !state.didInteract && !state.strokeMade && !state.wasPanning && !state.wasPinching && state.maxFingers === 1) {
            const canvasPoint = getCanvasPoint(e.clientX, e.clientY);

            // Fill tool tap
            if (state.currentTool === 'fill' && !state.isEraserActive) {
                await saveState();
                floodFill(Math.floor(canvasPoint.x), Math.floor(canvasPoint.y), hexToRgba(state.color));
                updateLayerThumbnail(getActiveLayer());
            } else if (state.currentTool === 'tone' && !state.isEraserActive) {
                // Tone fill tap
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


                if (wasClick && duration < 300 && !state.wasPanning && !state.wasPinching) {
                    // Click detected - trigger flood fill
                    const canvasPoint = getCanvasPoint(e.clientX, e.clientY);

                    if (state.currentTool === 'fill' && !state.isEraserActive) {
                        await saveState();
                        floodFill(Math.floor(canvasPoint.x), Math.floor(canvasPoint.y), [0, 0, 0, 255]);
                        updateLayerThumbnail(getActiveLayer());
                    } else if (state.currentTool === 'tone' && !state.isEraserActive) {
                        await saveState();
                        floodFillTone(Math.floor(canvasPoint.x), Math.floor(canvasPoint.y));
                        updateLayerThumbnail(getActiveLayer());
                    } else if (state.currentTool === 'sketch' && !state.isEraserActive) {
                        await saveState();
                        floodFillSketch(Math.floor(canvasPoint.x), Math.floor(canvasPoint.y));
                        updateLayerThumbnail(getActiveLayer());
                    } else if (state.isEraserActive && state.currentEraser === 'lasso') {
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
                if (state.currentTool === 'stipple') {
                    endStippleDrawing();
                } else {
                    await endPenDrawing();
                }
                updateLayerThumbnail(getActiveLayer());
            }
            state.drawingPointerId = null;
        }
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
// Brush Size Preview (module-level so zoom handlers can trigger it)
// ============================================

let _brushPreviewEl = null;
let _brushPreviewTimeout;

function flashBrushSizePreview() {
    if (!_brushPreviewEl) {
        _brushPreviewEl = document.createElement('div');
        _brushPreviewEl.id = 'brush-size-preview';
        _brushPreviewEl.style.position = 'fixed';
        _brushPreviewEl.style.top = '50%';
        _brushPreviewEl.style.left = '50%';
        _brushPreviewEl.style.transform = 'translate(-50%, -50%)';
        _brushPreviewEl.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
        _brushPreviewEl.style.border = '1px solid rgba(0, 0, 0, 0.5)';
        _brushPreviewEl.style.borderRadius = '50%';
        _brushPreviewEl.style.pointerEvents = 'none';
        _brushPreviewEl.style.zIndex = '9999';
        _brushPreviewEl.style.display = 'none';
        _brushPreviewEl.style.transition = 'opacity 0.15s';
        document.body.appendChild(_brushPreviewEl);
    }

    const size = state.isEraserActive ? state.eraserSize : state.activeBrush.size;
    const displaySize = size * state.scale;
    _brushPreviewEl.style.width = `${displaySize}px`;
    _brushPreviewEl.style.height = `${displaySize}px`;
    _brushPreviewEl.style.display = 'block';
    _brushPreviewEl.style.opacity = '1';

    clearTimeout(_brushPreviewTimeout);
    _brushPreviewTimeout = setTimeout(() => {
        _brushPreviewEl.style.opacity = '0';
        setTimeout(() => {
            if (_brushPreviewEl && _brushPreviewEl.style.opacity === '0') _brushPreviewEl.style.display = 'none';
        }, 200);
    }, 800);
}

// ============================================
// Color Pickers
// Helper Functions (UI Updates)
// ============================================

function setupPenModeBtn() {
    const btn = document.getElementById('penModeBtn');
    if (!btn) return;
    
    // Set initial state from state.js
    updatePenModeIcon(btn);

    btn.addEventListener('click', () => {
        state.pressureEnabled = !state.pressureEnabled;
        updatePenModeIcon(btn);
    });
}

function updatePenModeIcon(btn) {
    if (!btn) btn = document.getElementById('penModeBtn');
    if (!btn) return;
    
    btn.classList.toggle('active', state.pressureEnabled);
    
    const smoothIcon = btn.querySelector('.mode-smooth');
    const binaryIcon = btn.querySelector('.mode-binary');
    if (smoothIcon) smoothIcon.style.display = state.pressureEnabled ? 'block' : 'none';
    if (binaryIcon) binaryIcon.style.display = state.pressureEnabled ? 'none' : 'block';
}

// ============================================

function setupColorPickers() {
    // bgColorBtn and inkColorBtn removed for monochrome ultimate painter
    const brushSizeSlider = document.getElementById('brushSize');
    const sizeDisplay = document.getElementById('sizeDisplay');

    brushSizeSlider.addEventListener('input', (e) => {
        const size = parseInt(e.target.value);
        sizeDisplay.textContent = size;

        if (state.isEraserActive) {
            state.eraserSize = size;
        } else {
            state.activeBrush.size = size;
        }

        // 画面倍率を反映したサイズでプレビュー表示
        flashBrushSizePreview();

        // パレット側のドットもリアルタイム更新
        const activeIdx = state.activeBrushIndex;
        const activeSlotDot = document.querySelector(`.brush-slot[data-idx="${activeIdx}"] .brush-dot-preview`);
        if (activeSlotDot) {
            const slotDotSize = Math.max(2, Math.min(24, size * 0.8));
            activeSlotDot.style.width = `${slotDotSize}px`;
            activeSlotDot.style.height = `${slotDotSize}px`;
            // 不透明度も反映
            activeSlotDot.style.opacity = state.activeBrush.opacity;
        }
    });

    // Prevent events from bubbling to canvas
    brushSizeSlider.addEventListener('pointerdown', (e) => e.stopPropagation());
    brushSizeSlider.addEventListener('pointermove', (e) => e.stopPropagation());
}

// =============================================
// Brush Palette
// =============================================

const BRUSH_TYPE_ICONS = ['✒️', '🖋️', '🖌️', '✏️', '💧'];

function renderBrushPalette() {
    const palette = document.getElementById('brush-palette');
    if (!palette) return;
    palette.innerHTML = '';

    state.brushes.forEach((brush, idx) => {
        const slot = document.createElement('div');
        slot.className = 'brush-slot' + (idx === state.activeBrushIndex ? ' active' : '');
        slot.dataset.idx = idx;

        // ドット表示用のコンテナ
        const swatch = document.createElement('div');
        swatch.className = 'brush-swatch';
        
        // 実際の太さを反映した黒い丸
        const dot = document.createElement('div');
        dot.className = 'brush-dot-preview';
        // 表示上の最大サイズに収まるようにスケーリング (スロットが40px想定)
        const displaySize = Math.max(2, Math.min(24, brush.size * 0.8));
        dot.style.width = `${displaySize}px`;
        dot.style.height = `${displaySize}px`;
        dot.style.backgroundColor = '#000';
        dot.style.borderRadius = '50%';
        dot.style.opacity = brush.opacity; // 不透明度を反映
        
        swatch.appendChild(dot);

        // Name label
        const label = document.createElement('div');
        label.className = 'brush-label';
        label.textContent = brush.name;

        slot.appendChild(swatch);
        slot.appendChild(label);
        palette.appendChild(slot);
    });
}

function setupBrushPalette() {
    renderBrushPalette();
    syncBrushSliders();

    const palette = document.getElementById('brush-palette');
    if (!palette) return;

    palette.addEventListener('pointerup', (e) => {
        const slot = e.target.closest('.brush-slot');
        if (!slot) return;
        const idx = parseInt(slot.dataset.idx);

        // ブラシ切り替え
        if (state.activeBrushIndex === idx) {
            // すでに選択中のブラシをもう一度タップしたらトグル
            const panel = document.getElementById('brush-settings-panel');
            const isVisible = panel && !panel.classList.contains('hidden');
            if (isVisible && _editingBrushIdx === idx) {
                hideAllMenus();
            } else {
                openBrushSettings(idx);
            }
        } else {
            // 他のブラシ（ペン先）を選んだら、前のパネルは閉じておく
            hideAllMenus();
            state.activeBrushIndex = idx;
            renderBrushPalette();
            syncBrushSliders();
        }
    });

    // 余計なイベント伝播を防止
    palette.addEventListener('pointerdown', (e) => e.stopPropagation());
}

function syncBrushSliders() {
    const brush = state.activeBrush;
    const slider = document.getElementById('brushSize');
    const display = document.getElementById('sizeDisplay');
    if (slider) { slider.value = brush.size; }
    if (display) { display.textContent = brush.size; }
}

// =============================================
// Brush Settings Panel
// =============================================

let _editingBrushIdx = 0;

function openBrushSettings(idx) {
    _editingBrushIdx = idx;
    const brush = state.brushes[idx];
    const panel = document.getElementById('brush-settings-panel');
    if (!panel) return;

    document.getElementById('brush-settings-name').textContent = `ブラシ ${idx + 1} 設定`;
    document.getElementById('bs-name').value       = brush.name;
    document.getElementById('bs-opacity').value    = Math.round(brush.opacity * 100);
    document.getElementById('bs-opacity-val').textContent = Math.round(brush.opacity * 100);
    document.getElementById('bs-pressure-size').checked    = brush.pressureSize;
    document.getElementById('bs-pressure-opacity').checked = brush.pressureOpacity;
    document.getElementById('bs-binary').checked           = brush.binary;

    panel.classList.remove('hidden');
    panel.style.display = ''; // インラインの残りカスを掃除
    
    // スロットボタンの位置を取得してパネルの位置を調整
    const activeSlot = document.querySelector(`.brush-slot[data-idx="${idx}"]`);
    if (activeSlot) {
        const rect = activeSlot.getBoundingClientRect();
        const toolbarWidth = 64; 
        panel.style.left = `${toolbarWidth}px`;
        
        const panelHeight = 400; 
        let topPos = rect.top - 60;
        const winHeight = window.innerHeight;
        
        if (topPos + panelHeight > winHeight - 12) {
            topPos = winHeight - panelHeight - 12;
        }
        if (topPos < 12) topPos = 12;
        
        panel.style.top = `${topPos}px`;
        panel.style.bottom = 'auto';
    }
}

function setupBrushSettingsPanel() {
    const panel = document.getElementById('brush-settings-panel');
    if (!panel) return;


    const closeBtn    = document.getElementById('brush-settings-close');
    const nameInput   = document.getElementById('bs-name');
    const opSlider    = document.getElementById('bs-opacity');
    const opVal       = document.getElementById('bs-opacity-val');
    const psizeCheck  = document.getElementById('bs-pressure-size');
    const popCheck    = document.getElementById('bs-pressure-opacity');
    const binaryCheck = document.getElementById('bs-binary');
    const sync = () => {
        const b = state.brushes[_editingBrushIdx];
        b.name           = nameInput.value;
        b.opacity        = parseInt(opSlider.value) / 100;
        b.pressureSize   = psizeCheck.checked;
        b.pressureOpacity= popCheck.checked;
        b.binary         = binaryCheck.checked;
        b.color          = '#000000';
        opVal.textContent = Math.round(b.opacity * 100);
        
        // 詳細パネルの不透明度スライダーからも、直接ドットを更新させる
        const activeSlotDot = document.querySelector(`.brush-slot[data-idx="${_editingBrushIdx}"] .brush-dot-preview`);
        if (activeSlotDot) {
            activeSlotDot.style.opacity = b.opacity;
        }

        renderBrushPalette();
        if (_editingBrushIdx === state.activeBrushIndex) syncBrushSliders();
    };

    [nameInput, psizeCheck, popCheck, binaryCheck]
        .forEach(el => el.addEventListener('input', sync));
    opSlider.addEventListener('input', sync);

    // Stop panel events from reaching canvas
    panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    panel.addEventListener('pointermove', (e) => e.stopPropagation());

    closeBtn.addEventListener('click', () => panel.classList.add('hidden'));
}

// ============================================
// Clear Buttons
// ============================================

async function clearAll() {
    await saveState();

    // Clear all layers
    for (const layer of layers) {
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        updateLayerThumbnail(layer);
    }

    await saveState();
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

}

function updateToneMenuVisibility() {
    const menu = document.getElementById('tone-menu');
    if (!menu) return;

    if (state.currentTool === 'tone' && !state.isEraserActive) {
        menu.classList.remove('hidden');
        
        // ボタンの真横に表示
        const toneBtn = document.getElementById('tool-tone');
        if (toneBtn) {
            const rect = toneBtn.getBoundingClientRect();
            const toolbarWidth = 64;
            menu.style.left = `${toolbarWidth}px`;
            menu.style.top = `${rect.top}px`;
            menu.style.bottom = 'auto';
        }
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
            else if (state.selectedAspect === '4:5') targetRatio = 4 / 5;
            else if (state.selectedAspect === '16:9') targetRatio = 16 / 9;
            else if (state.selectedAspect === '9:16') targetRatio = 9 / 16;
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
                clearAll();
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

        // Toggle pressure mode: P
        if (e.key === 'p' || e.key === 'P') {
            if (!e.target.matches('input, textarea')) {
                e.preventDefault();
                state.pressureEnabled = !state.pressureEnabled;
                if (typeof updatePenModeIcon === 'function') updatePenModeIcon();
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

        // Brush slot shortcuts: 1-5 (no modifier)
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.target.matches('input, textarea, select')) {
            const num = parseInt(e.key);
            if (num >= 1 && num <= 5) {
                e.preventDefault();
                state.activeBrushIndex = num - 1;
                renderBrushPalette();
                syncBrushSliders();
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
