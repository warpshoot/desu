import {
    state,
    layers,
    lassoCanvas,
    lassoCtx,
    selectionCanvas,
    eventCanvas,
    canvasBg,
    layerContainer,
    strokeCanvas,
    strokeCtx,
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
    fillPolygonNoAA, fillPolygonTransparent, floodFill, floodFillTransparent,
} from './tools/fill.js';
import { saveState, undo, redo, restoreLayer, resetHistory, saveLayerChangeState } from './history.js';
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
import { exportProject, importProject, exportConfig, importConfig } from './storage.js';

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
    setupFillSettingsPanel();
    setupEraserSettingsPanel();
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
    const exportConfigBtn = document.getElementById('exportConfigBtn');
    const importConfigBtn = document.getElementById('importConfigBtn');
    const configInput = document.getElementById('configInput');


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

    // Config Export click
    if (exportConfigBtn) {
        exportConfigBtn.addEventListener('click', async () => {
            hideAllMenus();
            await exportConfig();
        });
    }

    // Config Import click
    if (importConfigBtn) {
        importConfigBtn.addEventListener('click', () => {
            hideAllMenus();
            configInput.click();
        });
    }

    // Config input change (Import)
    if (configInput) {
        configInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                importConfig(file).then((success) => {
                    if (!success) alert('設定の読み込みに失敗しました');
                    configInput.value = '';
                });
            }
        });
    }
}

document.addEventListener('desu:state-loaded', () => {
    updateModeButtonIcon(state.mode, state.subTool);
    updateToolButtonStates();
    updateBrushSizeVisibility();
    updateBrushSizeSlider();
    renderBrushPalette();
    syncBrushSliders();

    // アクティブな設定パネルが開いている場合、その表示内容を最新の状態にリフレッシュする
    const brushPanel = document.getElementById('brush-settings-panel');
    if (brushPanel && !brushPanel.classList.contains('hidden')) {
        openBrushSettings(_editingBrushIdx);
    }
    const eraserPanel = document.getElementById('eraser-settings-panel');
    if (eraserPanel && !eraserPanel.classList.contains('hidden')) {
        openEraserSettings(_editingEraserSlotIdx);
    }
    const tonePanel = document.getElementById('tone-settings-panel');
    if (tonePanel && !tonePanel.classList.contains('hidden')) {
        openToneSettings(_editingToneIdx);
    }
    const fillPanel = document.getElementById('fill-settings-panel');
    if (fillPanel && !fillPanel.classList.contains('hidden')) {
        openFillSettings(_editingFillSlotIdx);
    }
});

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
        const layer = createLayer();
        if (layer) {
            applyTransform();
            await saveLayerChangeState();
            updateAllThumbnails();
            renderLayerButtons();
            updateActiveLayerIndicator();
        }
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
// Tool Panel — 3-Mode Architecture
// ============================================

// スロットアイコン (flyout から流用)
const SUB_TOOL_ICONS = {
    pen:     { pen: 'icons/pen.png', stipple: 'icons/stipple.svg' },
    fill:    { fill: 'icons/bet.png', tone: 'icons/tone.png' },
    eraser:  { pen: 'icons/er2.svg', lasso: 'icons/er1.png', clear: null }
};

function setupToolPanel() {
    const modeButtons = document.querySelectorAll('.mode-btn');

    modeButtons.forEach(btn => {
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        btn.addEventListener('pointerup', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleModeTap(btn.dataset.mode);
        });

        btn.addEventListener('pointercancel', () => {});
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

// --- Tap: switch to this mode (keep previous sub-tool) ---
function handleModeTap(mode) {
    const toneMenu = document.getElementById('tone-menu');
    const wasOnTone = state.mode === 'fill' && state.subTool === 'tone';
    const wasToneMenuVisible = toneMenu && !toneMenu.classList.contains('hidden');

    hideAllMenus();

    // If tapping the same mode with tone menu visible → just close tone menu
    if (mode === 'fill' && state.mode === 'fill' && wasOnTone && wasToneMenuVisible) {
        return;
    }

    state.mode = mode;
    if (mode === 'pen') {
        const slot = state.brushes[state.activeBrushIndex];
        state.subTool = slot ? slot.subTool : 'pen';
    } else if (mode === 'fill') {
        const slot = state.fillSlots[state.activeFillSlotIndex];
        state.subTool = slot ? slot.subTool : 'fill';
    } else if (mode === 'eraser') {
        const slot = state.eraserSlots[state.activeEraserSlotIndex];
        state.subTool = slot ? slot.subTool : 'pen';
    }

    updateModeButtonIcon(mode, state.subTool);
    updateToolButtonStates();
    updateToneMenuVisibility();
    updateBrushSizeVisibility();
    updateBrushSizeSlider();
    renderBrushPalette();
}

// --- Update the mode button to show the selected sub-tool icon ---
function updateModeButtonIcon(mode, sub) {
    const btn = document.getElementById(`mode-${mode}`);
    if (!btn) return;
    btn.querySelectorAll('.mode-icon').forEach(img => {
        img.style.display = img.dataset.sub === sub ? '' : 'none';
    });
}

// --- Update active states on all mode buttons ---
function updateToolButtonStates() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        const isActive = state.mode === btn.dataset.mode;
        btn.classList.toggle('active', isActive);
    });

    // Tone indicator on fill button
    const fillBtn = document.getElementById('mode-fill');
    if (fillBtn) {
        fillBtn.classList.toggle('tone-active', state.mode === 'fill' && state.subTool === 'tone');
    }

    // ブラシパレットは全モードで有効
    const brushPalette = document.getElementById('brush-palette');
    const brushSettingsPanel = document.getElementById('brush-settings-panel');

    if (brushPalette) {
        brushPalette.classList.remove('disabled');
    }

    // ペンモード以外ではブラシ設定パネルを閉じる
    if (state.mode !== 'pen' && brushSettingsPanel) {
        brushSettingsPanel.classList.add('hidden');
    }

    updateBrushSizeVisibility();
}

// ============================================
// Tool Menus (Long Press Popovers)
// ============================================

// showToolMenu is no longer used — replaced by flyout system

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
            "下のレイヤーに統合しますか？",
            'layerMerge',
            async () => {
                if (mergeLayerDown(layerId)) {
                    await saveLayerChangeState();
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
        if (layers.length <= 1) return;
        if (deleteLayer(layerId)) {
            await saveLayerChangeState();
            window.renderLayerButtons();
            updateActiveLayerIndicator();
            hideAllMenus();
        }
    });

    // Disable delete if only one layer
    newDeleteBtn.classList.toggle('disabled', layers.length <= 1);
}

function hideAllMenus() {
    // 汎用メニュー閉じ
    document.querySelectorAll('.tool-menu').forEach(menu => {
        menu.classList.add('hidden');
    });

    // 設定パネルも閉じる
    const brushSettingsPanel = document.getElementById('brush-settings-panel');
    if (brushSettingsPanel) {
        brushSettingsPanel.classList.add('hidden');
    }
    const fillSettingsPanel = document.getElementById('fill-settings-panel');
    if (fillSettingsPanel) {
        fillSettingsPanel.classList.add('hidden');
    }
    const eraserSettingsPanel = document.getElementById('eraser-settings-panel');
    if (eraserSettingsPanel) {
        eraserSettingsPanel.classList.add('hidden');
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
    if (!e.target.closest('.tool-menu') && !e.target.closest('.layer-btn') && !e.target.closest('.tool-btn') && !e.target.closest('.mode-btn')) {
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

// =============================================
// 非線形ブラシサイズスライダー変換
// スライダー値 0-1000 → ブラシサイズ 1-500
// 指数カーブで 1-20 がスライダーの大半を占める
// =============================================
const SLIDER_MAX = 1000;
const BRUSH_SIZE_MIN = 1;
const BRUSH_SIZE_MAX = 500;
const SLIDER_EXPONENT = 3.0; // 大きいほど小サイズ側に偏る

function sliderToBrushSize(sliderVal) {
    const t = sliderVal / SLIDER_MAX; // 0..1
    return Math.round(BRUSH_SIZE_MIN + Math.pow(t, SLIDER_EXPONENT) * (BRUSH_SIZE_MAX - BRUSH_SIZE_MIN));
}

function brushSizeToSlider(size) {
    const t = (size - BRUSH_SIZE_MIN) / (BRUSH_SIZE_MAX - BRUSH_SIZE_MIN);
    return Math.round(Math.pow(Math.max(0, t), 1 / SLIDER_EXPONENT) * SLIDER_MAX);
}

function updateBrushSizeVisibility() {
    const container = document.getElementById('size-slider-container');

    // ペン系 (pen/stipple) と消しゴム・ペン時のみスライダー有効
    const needsSize = state.mode === 'pen' || (state.mode === 'eraser' && state.subTool === 'pen');
    container.classList.toggle('disabled', !needsSize);
}

function updateBrushSizeSlider() {
    const slider = document.getElementById('brushSize');
    const display = document.getElementById('sizeDisplay');

    let size;
    if (state.mode === 'eraser') {
        size = state.eraserSize;
    } else if (state.mode === 'pen' && state.subTool === 'stipple') {
        size = state.stippleSize;
    } else {
        size = state.activeBrush.size;
    }
    slider.value = brushSizeToSlider(size);
    display.textContent = size;
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

    // toDataURL を避け、canvas を直接 blob URL に変換（非同期だが高速）
    const btn = document.querySelector(`.layer-btn[data-layer-id="${layer.id}"]`);
    if (btn) {
        state.thumbCanvas.toBlob((blob) => {
            if (!blob) return;
            // 以前の blob URL を解放
            if (layer._thumbBlobUrl) {
                URL.revokeObjectURL(layer._thumbBlobUrl);
            }
            layer._thumbBlobUrl = URL.createObjectURL(blob);
            btn.style.backgroundImage = `url(${layer._thumbBlobUrl})`;
            btn.style.backgroundSize = 'contain';
            btn.style.backgroundRepeat = 'no-repeat';
            btn.style.backgroundPosition = 'center';
        });
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
    const dpr = window.devicePixelRatio || 1;
    flashCanvas.style.width = (layer.canvas.width / dpr) + 'px';
    flashCanvas.style.height = (layer.canvas.height / dpr) + 'px';

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
        if (state.isPenDrawing || state.isLassoing) {
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

    // パームリジェクション改善:
    // ペンが検出されている間は指での描画をブロックするが、
    // ペンが離れて500ms経過後はリセットする (指でのジェスチャー操作を阻害しない)
    if (e.pointerType === 'pen') {
        state.pencilDetected = true;
        if (state._pencilResetTimer) {
            clearTimeout(state._pencilResetTimer);
            state._pencilResetTimer = null;
        }
    }

    // 1 Finger = Drawing (if not space pressed)
    const canDraw = e.pointerType === 'pen' || e.pointerType === 'mouse' || (e.pointerType === 'touch' && !state.pencilDetected);

    if (state.activePointers.size === 1 && canDraw) {
        state.drawingPointerId = e.pointerId;
        state.strokeMade = false;

        const canvasPoint = getCanvasPoint(e.clientX, e.clientY);

        // --- Mode-based dispatch ---
        // saveState を await してから描画開始 (レースコンディション防止)
        // createImageBitmap は高速 (<5ms) なので体感遅延は最小限
        if (state.mode === 'pen') {
            await saveState();
            if (state.subTool === 'stipple') {
                startStippleDrawing(canvasPoint.x, canvasPoint.y, e.pressure);
            } else {
                startPenDrawing(canvasPoint.x, canvasPoint.y, e.pressure);
            }
        } else if (state.mode === 'fill') {
            startLasso(e.clientX, e.clientY);
        } else if (state.mode === 'eraser') {
            if (state.subTool === 'clear') {
                // clear は pointerDown でレイヤークリア実行
                await executeClearLayer();
            } else if (state.subTool === 'lasso') {
                startLasso(e.clientX, e.clientY);
            } else {
                await saveState();
                startPenDrawing(canvasPoint.x, canvasPoint.y, e.pressure);
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
    if (state.isPenDrawing) {
        const layer = getActiveLayer();
        if (layer) restoreLayer(layer.id);
        // ストロークキャンバスのプレビューをクリア
        if (strokeCanvas && strokeCtx) {
            strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
            strokeCanvas.style.opacity = 1;
        }
        // Remove the saveState() entry that was added when drawing started
        // Otherwise undo() would restore to the same state (no visible change)
        state.undoStack.pop();
        state.isPenDrawing = false;
        state.lastPenPoint = null;
    }
    state.drawingPointerId = null;
    state.isLassoing = false;
    state.strokeMade = false;
    state.didInteract = false;
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
                if (state.mode === 'pen' && state.subTool === 'stipple') {
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

    // パームリジェクション: ペンが離れた後500msでリセット
    // これにより指でのジェスチャー操作が再び可能になる
    if (e.pointerType === 'pen' && state.pencilDetected) {
        state._pencilResetTimer = setTimeout(() => {
            state.pencilDetected = false;
            state._pencilResetTimer = null;
        }, 500);
    }

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

        // Finish Drawing Actions
        if (e.pointerId === state.drawingPointerId) {
            if (state.isLassoing) {
                const points = finishLasso();
                const wasClick = pointer && pointer.totalMove < 5;

                if (wasClick && duration < 300 && !state.wasPanning && !state.wasPinching) {
                    // Tap detected → bucket fill (バケツ)
                    const fillSlot = state.mode === 'fill' ? state.fillSlots[state.activeFillSlotIndex] : null;
                    const eraserSlot = state.mode === 'eraser' ? state.eraserSlots[state.activeEraserSlotIndex] : null;
                    const bucketEnabled = fillSlot ? (fillSlot.bucketEnabled !== false)
                        : eraserSlot ? (eraserSlot.bucketEnabled !== false) : true;

                    if (bucketEnabled) {
                        const canvasPoint = getCanvasPoint(e.clientX, e.clientY);
                        const fx = Math.floor(canvasPoint.x);
                        const fy = Math.floor(canvasPoint.y);

                        await saveState();
                        if (state.mode === 'fill') {
                            const tolerance = fillSlot.bucketTolerance || 'normal';
                            if (state.subTool === 'tone') {
                                floodFillTone(fx, fy, tolerance);
                            } else {
                                // 統一バケツ: 黒 + スロットの不透明度
                                const slotOpacity = fillSlot.opacity ?? 1.0;
                                floodFill(fx, fy, [0, 0, 0, Math.round(slotOpacity * 255)], tolerance);
                            }
                        } else if (state.mode === 'eraser' && state.subTool === 'lasso') {
                            const tolerance = eraserSlot.bucketTolerance || 'normal';
                            floodFillTransparent(fx, fy, tolerance);
                        }
                        updateLayerThumbnail(getActiveLayer());
                    }
                } else if (points && points.length >= 3 && !state.wasPanning && !state.wasPinching) {
                    // Drag detected → polygon fill (投げ縄)
                    await saveState();
                    if (state.mode === 'eraser') {
                        fillPolygonTransparent(points);
                    } else if (state.subTool === 'tone') {
                        fillTone(points);
                    } else {
                        // 統一ポリゴン塗り: 黒 + スロットの不透明度
                        const fillSlot = state.fillSlots[state.activeFillSlotIndex];
                        const slotOpacity = fillSlot.opacity ?? 1.0;
                        fillPolygonNoAA(points, 0, 0, 0, slotOpacity);
                    }
                    updateLayerThumbnail(getActiveLayer());
                }
            } else if (state.isPenDrawing) {
                if (state.mode === 'pen' && state.subTool === 'stipple') {
                    endStippleDrawing();
                } else {
                    await endPenDrawing();
                }
                updateLayerThumbnail(getActiveLayer());
            }
            state.drawingPointerId = null;
        }
        // Clean up
        state.isPenDrawing = false;
        state.isLassoing = false;
        state.strokeMade = false;
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
        _brushPreviewEl.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
        _brushPreviewEl.style.border = '1px solid rgba(0, 0, 0, 0.5)';
        _brushPreviewEl.style.borderRadius = '50%';
        _brushPreviewEl.style.pointerEvents = 'none';
        _brushPreviewEl.style.zIndex = '9999';
        _brushPreviewEl.style.display = 'none';
        _brushPreviewEl.style.transition = 'opacity 0.15s';
        document.body.appendChild(_brushPreviewEl);
    }

    const size = state.mode === 'eraser' ? state.eraserSize
        : (state.mode === 'pen' && state.subTool === 'stipple') ? state.stippleSize
        : state.activeBrush.size;
    const displaySize = Math.max(4, size * state.scale);
    _brushPreviewEl.style.width = `${displaySize}px`;
    _brushPreviewEl.style.height = `${displaySize}px`;

    // サイズスライダーのすぐ右に表示
    const sliderContainer = document.getElementById('size-slider-container');
    if (sliderContainer) {
        const rect = sliderContainer.getBoundingClientRect();
        const x = rect.right + 12;
        const y = rect.top + rect.height / 2;
        _brushPreviewEl.style.left = `${x}px`;
        _brushPreviewEl.style.top = `${y - displaySize / 2}px`;
        _brushPreviewEl.style.transform = '';
    } else {
        _brushPreviewEl.style.top = '50%';
        _brushPreviewEl.style.left = '50%';
        _brushPreviewEl.style.transform = 'translate(-50%, -50%)';
    }

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
        const size = sliderToBrushSize(parseInt(e.target.value));
        sizeDisplay.textContent = size;

        if (state.mode === 'eraser') {
            state.eraserSize = size;
        } else if (state.mode === 'pen' && state.subTool === 'stipple') {
            state.stippleSize = size;
        } else {
            state.activeBrush.size = size;
        }

        // 画面倍率を反映したサイズでプレビュー表示
        flashBrushSizePreview();

        // パレット側のドットもリアルタイム更新 (ペンモードのpen/stipple時)
        if (state.mode === 'pen' && (state.subTool === 'pen' || state.subTool === 'stipple')) {
            const activeIdx = state.activeBrushIndex;
            const activeSlotDot = document.querySelector(`.brush-slot[data-idx="${activeIdx}"] .brush-dot-preview`);
            if (activeSlotDot) {
                const slotDotSize = Math.max(2, Math.min(34, Math.round(size * 0.34)));
                activeSlotDot.style.width = `${slotDotSize}px`;
                activeSlotDot.style.height = `${slotDotSize}px`;
                // ペン時のみ不透明度を反映 (点描は常に不透明)
                if (state.subTool === 'pen') {
                    activeSlotDot.style.opacity = state.activeBrush.opacity;
                }
            }
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

function _makeClearIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('class', 'slot-subtool-icon');
    svg.innerHTML = '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12"/><path d="M9 7V4h6v3"/>';
    return svg;
}

function _makeSlotIcon(src) {
    if (!src) return _makeClearIcon();
    const img = document.createElement('img');
    img.src = src;
    img.className = 'slot-subtool-icon';
    if (src.endsWith('.svg')) img.style.filter = 'brightness(0)';
    return img;
}

function renderBrushPalette() {
    const palette = document.getElementById('brush-palette');
    if (!palette) return;
    palette.innerHTML = '';

    if (state.mode === 'fill') {
        state.fillSlots.forEach((slot, idx) => {
            const el = document.createElement('div');
            el.className = 'brush-slot' + (idx === state.activeFillSlotIndex ? ' active' : '');
            el.dataset.idx = idx;
            el.dataset.category = 'fill';

            const swatch = document.createElement('div');
            swatch.className = 'brush-swatch';
            swatch.style.opacity = slot.opacity ?? 1.0;
            swatch.appendChild(_makeSlotIcon(SUB_TOOL_ICONS.fill[slot.subTool] || SUB_TOOL_ICONS.fill.fill));

            el.appendChild(swatch);
            palette.appendChild(el);
        });
        return;
    }

    if (state.mode === 'eraser') {
        state.eraserSlots.forEach((slot, idx) => {
            const el = document.createElement('div');
            el.className = 'brush-slot' + (idx === state.activeEraserSlotIndex ? ' active' : '');
            el.dataset.idx = idx;
            el.dataset.category = 'eraser';

            const swatch = document.createElement('div');
            swatch.className = 'brush-swatch';
            swatch.appendChild(_makeSlotIcon(SUB_TOOL_ICONS.eraser[slot.subTool]));

            el.appendChild(swatch);
            palette.appendChild(el);
        });
        return;
    }

    // ペンカテゴリスロット
    state.brushes.forEach((brush, idx) => {
        const slot = document.createElement('div');
        slot.className = 'brush-slot' + (idx === state.activeBrushIndex ? ' active' : '');
        slot.dataset.idx = idx;
        slot.dataset.category = 'pen';

        const swatch = document.createElement('div');
        swatch.className = 'brush-swatch';

        const dot = document.createElement('div');
        dot.className = 'brush-dot-preview';
        const displaySize = Math.max(2, Math.min(34, Math.round(brush.size * 0.34)));
        dot.style.width = `${displaySize}px`;
        dot.style.height = `${displaySize}px`;
        dot.style.backgroundColor = '#000';
        dot.style.borderRadius = '50%';
        dot.style.opacity = brush.subTool === 'stipple' ? 1 : brush.opacity;
        swatch.appendChild(dot);

        // サブツールアイコンをバッジとして右上に配置
        const badge = _makeSlotIcon(SUB_TOOL_ICONS.pen[brush.subTool] || SUB_TOOL_ICONS.pen.pen);
        badge.className = 'slot-subtool-icon pen-slot-badge';
        slot.appendChild(badge);

        slot.appendChild(swatch);
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
        const category = slot.dataset.category || 'pen';

        if (category === 'fill') {
            if (state.activeFillSlotIndex === idx) {
                // 同じスロットを再タップ → 設定パネル開閉
                const panel = document.getElementById('fill-settings-panel');
                const isVisible = panel && !panel.classList.contains('hidden');
                if (isVisible && _editingFillSlotIdx === idx) {
                    hideAllMenus();
                } else {
                    openFillSettings(idx);
                }
                return;
            }
            hideAllMenus();
            state.activeFillSlotIndex = idx;
            const fillSlot = state.fillSlots[idx];
            state.subTool = fillSlot.subTool;
            updateModeButtonIcon('fill', fillSlot.subTool);
            updateToolButtonStates();
            updateToneMenuVisibility();
            updateBrushSizeVisibility();
            renderBrushPalette();

        } else if (category === 'eraser') {
            if (state.activeEraserSlotIndex === idx) {
                // 同じスロットを再タップ → 設定パネル開閉
                const panel = document.getElementById('eraser-settings-panel');
                const isVisible = panel && !panel.classList.contains('hidden');
                if (isVisible && _editingEraserSlotIdx === idx) {
                    hideAllMenus();
                } else {
                    openEraserSettings(idx);
                }
                return;
            }
            hideAllMenus();
            state.activeEraserSlotIndex = idx;
            const eraserSlot = state.eraserSlots[idx];
            state.subTool = eraserSlot.subTool;
            // clear サブツールは即座にレイヤークリア実行
            if (eraserSlot.subTool === 'clear') {
                executeClearLayer();
            }
            updateModeButtonIcon('eraser', eraserSlot.subTool);
            updateToolButtonStates();
            updateBrushSizeVisibility();
            updateBrushSizeSlider();
            renderBrushPalette();

        } else {
            // ペンカテゴリスロット
            if (state.activeBrushIndex === idx) {
                const panel = document.getElementById('brush-settings-panel');
                const isVisible = panel && !panel.classList.contains('hidden');
                if (isVisible && _editingBrushIdx === idx) {
                    hideAllMenus();
                } else {
                    openBrushSettings(idx);
                }
            } else {
                hideAllMenus();
                state.activeBrushIndex = idx;
                const brush = state.brushes[idx];
                state.subTool = brush.subTool || 'pen';
                updateModeButtonIcon('pen', state.subTool);
                updateToolButtonStates();
                updateBrushSizeVisibility();
                updateBrushSizeSlider();
                renderBrushPalette();
                syncBrushSliders();
            }
        }
    });

    // 余計なイベント伝播を防止
    palette.addEventListener('pointerdown', (e) => e.stopPropagation());
}

function syncBrushSliders() {
    if (state.mode === 'fill') return;   // 塗りスロットにブラシサイズはない
    if (state.mode === 'eraser') return; // 消しゴムサイズはスライダーとは別管理
    updateBrushSizeSlider();
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

    const isStipple = (brush.subTool === 'stipple');
    document.getElementById('brush-settings-name').textContent = `ブラシ ${idx + 1} 設定`;
    document.getElementById('bs-subtool').value    = brush.subTool || 'pen';
    document.getElementById('bs-density').value    = brush.stippleDensity ?? 5;
    document.getElementById('bs-density-val').textContent = brush.stippleDensity ?? 5;
    document.getElementById('bs-pressure-density').checked    = brush.pressureDensity ?? true;
    document.getElementById('bs-opacity').value    = Math.round(brush.opacity * 100);
    document.getElementById('bs-opacity-val').textContent = Math.round(brush.opacity * 100);
    document.getElementById('bs-pressure-size').checked    = brush.pressureSize;
    // pressureOpacity removed: スタンプ重畳で正しく動作しないため廃止
    document.getElementById('bs-binary').checked           = brush.binary;
    document.getElementById('bs-pressure-curve').value     = brush.pressureCurve ?? 1.0;
    document.getElementById('bs-pressure-curve-val').textContent = (brush.pressureCurve ?? 1.0).toFixed(1);
    document.getElementById('bs-stabilizer').checked = brush.stabilizerEnabled ?? false;
    document.getElementById('bs-stabilizer-dist').value = brush.stabilizerDistance ?? 20;
    document.getElementById('bs-stabilizer-dist-val').textContent = brush.stabilizerDistance ?? 20;
    // サブツールにあわせて行の表示/非表示を切り替え (邪魔なものは消す)
    const densityRow      = document.getElementById('bs-density-row');
    const pdensityRow     = document.getElementById('bs-pressure-density-row');
    const opacityRow      = document.getElementById('bs-opacity-row');
    const penPressureRow  = document.getElementById('bs-pen-pressure-row');
    const binaryRow       = document.getElementById('bs-binary-row');
    const pcurveRow       = document.getElementById('bs-pressure-curve-row');
    const stabRow         = document.getElementById('bs-stabilizer-row');
    const stabDistRow     = document.getElementById('bs-stabilizer-dist-row');
    const stabVizRow      = document.getElementById('bs-stab-viz-row');

    // 点描系の表示制御
    if (densityRow) densityRow.style.display = isStipple ? '' : 'none';
    if (pdensityRow) pdensityRow.style.display = isStipple ? '' : 'none';

    // ペン系の表示制御
    const showPenSettings = !isStipple;
    opacityRow.style.display = (showPenSettings && !brush.binary) ? '' : 'none';
    penPressureRow.style.display = showPenSettings ? '' : 'none';
    binaryRow.style.display = showPenSettings ? '' : 'none';
    pcurveRow.style.display = showPenSettings ? '' : 'none';

    // 手ぶれ補正の表示制御
    const stabOn = brush.stabilizerEnabled ?? false;
    stabRow.style.display = showPenSettings ? '' : 'none';
    stabDistRow.style.display = (showPenSettings && stabOn) ? '' : 'none';
    stabVizRow.style.display = (showPenSettings && stabOn) ? '' : 'none';

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

    const closeBtn         = document.getElementById('brush-settings-close');
    const subToolSelect    = document.getElementById('bs-subtool');
    const densitySlider    = document.getElementById('bs-density');
    const densityVal       = document.getElementById('bs-density-val');
    const pdensityCheck    = document.getElementById('bs-pressure-density');
    const opSlider         = document.getElementById('bs-opacity');
    const opVal            = document.getElementById('bs-opacity-val');
    const psizeCheck       = document.getElementById('bs-pressure-size');
    const binaryCheck      = document.getElementById('bs-binary');
    const curveSlider      = document.getElementById('bs-pressure-curve');
    const curveVal         = document.getElementById('bs-pressure-curve-val');
    const stabCheck        = document.getElementById('bs-stabilizer');
    const stabDistSlider   = document.getElementById('bs-stabilizer-dist');
    const stabDistVal      = document.getElementById('bs-stabilizer-dist-val');
    const stabStringCheck  = document.getElementById('bs-stab-string');
    const stabGuideCheck   = document.getElementById('bs-stab-guide');

    const sync = () => {
        const b = state.brushes[_editingBrushIdx];
        const isStipple = subToolSelect.value === 'stipple';
        b.subTool         = subToolSelect.value;
        b.stippleDensity  = parseInt(densitySlider.value);
        b.pressureDensity = pdensityCheck.checked;
        b.opacity         = parseInt(opSlider.value) / 100;
        b.pressureSize    = psizeCheck.checked;
        b.pressureOpacity = false; // 機能廃止
        b.binary          = binaryCheck.checked;
        b.pressureCurve        = parseFloat(curveSlider.value);
        b.stabilizerEnabled    = stabCheck.checked;
        b.stabilizerDistance   = parseInt(stabDistSlider.value);
        b.stabStringVisible    = stabStringCheck.checked;
        b.stabShowGuide        = stabGuideCheck.checked;
        // color removed: monochrome only (INK_COLOR = #000000)
        densityVal.textContent   = b.stippleDensity;
        opVal.textContent        = Math.round(b.opacity * 100);
        curveVal.textContent     = b.pressureCurve.toFixed(1);
        // 表示/非表示の同期
        const densityRow      = document.getElementById('bs-density-row');
        const pdensityRow     = document.getElementById('bs-pressure-density-row');
        const opacityRow      = document.getElementById('bs-opacity-row');
        const penPressureRow  = document.getElementById('bs-pen-pressure-row');
        const binaryRow       = document.getElementById('bs-binary-row');
        const pcurveRow       = document.getElementById('bs-pressure-curve-row');
        const stabRow         = document.getElementById('bs-stabilizer-row');
        const stabDistRow     = document.getElementById('bs-stabilizer-dist-row');
        const stabVizRow      = document.getElementById('bs-stab-viz-row');

        if (densityRow) densityRow.style.display = isStipple ? '' : 'none';
        if (pdensityRow) pdensityRow.style.display = isStipple ? '' : 'none';

        const showPenSettings = !isStipple;
        opacityRow.style.display = (showPenSettings && !b.binary) ? '' : 'none';
        penPressureRow.style.display = showPenSettings ? '' : 'none';
        binaryRow.style.display = showPenSettings ? '' : 'none';
        pcurveRow.style.display = showPenSettings ? '' : 'none';

        const stabOn = b.stabilizerEnabled;
        stabRow.style.display = showPenSettings ? '' : 'none';
        stabDistRow.style.display = (showPenSettings && stabOn) ? '' : 'none';
        stabVizRow.style.display = (showPenSettings && stabOn) ? '' : 'none';
        if (_editingBrushIdx === state.activeBrushIndex && state.mode === 'pen') {
            state.subTool = b.subTool;
            updateModeButtonIcon('pen', b.subTool);
            updateToolButtonStates();
            updateBrushSizeVisibility();
            updateBrushSizeSlider();
        }

        // 不透明度変更時にパレットのドットも即時更新 (ペンのみ)
        if (!isStipple) {
            const activeSlotDot = document.querySelector(`.brush-slot[data-idx="${_editingBrushIdx}"] .brush-dot-preview`);
            if (activeSlotDot) {
                activeSlotDot.style.opacity = b.opacity;
            }
        }

        renderBrushPalette();
        if (_editingBrushIdx === state.activeBrushIndex) syncBrushSliders();
    };

    [subToolSelect, psizeCheck, binaryCheck, pdensityCheck, stabCheck, stabStringCheck, stabGuideCheck]
        .forEach(el => el.addEventListener('input', sync));
    opSlider.addEventListener('input', sync);
    densitySlider.addEventListener('input', sync);
    curveSlider.addEventListener('input', sync);
    stabDistSlider.addEventListener('input', sync);

    // Stop panel events from reaching canvas
    panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    panel.addEventListener('pointermove', (e) => e.stopPropagation());

    closeBtn.addEventListener('click', () => panel.classList.add('hidden'));
}

// =============================================
// Fill Settings Panel (投げ縄設定パネル)
// =============================================

let _editingFillSlotIdx = 0;

function openFillSettings(idx) {
    _editingFillSlotIdx = idx;
    const slot = state.fillSlots[idx];
    const panel = document.getElementById('fill-settings-panel');
    if (!panel) return;

    document.getElementById('fill-settings-name').textContent = `投げ縄 ${idx + 1} 設定`;
    document.getElementById('fs-subtool').value = slot.subTool || 'fill';
    document.getElementById('fs-opacity').value = Math.round((slot.opacity ?? 1.0) * 100);
    document.getElementById('fs-opacity-val').textContent = Math.round((slot.opacity ?? 1.0) * 100);
    document.getElementById('fs-bucket').checked = slot.bucketEnabled !== false;
    document.getElementById('fs-tolerance').value = slot.bucketTolerance || 'normal';
    document.getElementById('fs-is-binary').checked = slot.binary !== false;

    // バケツ有効時のみ許容値表示
    const bucketOn = slot.bucketEnabled !== false;
    document.getElementById('fs-tolerance-row').style.display = bucketOn ? '' : 'none';

    // トーン時: 不透明度は非表示 (トーンは2値パターン)
    const isTone = slot.subTool === 'tone';
    document.getElementById('fs-opacity-row').style.display = isTone ? 'none' : '';

    panel.classList.remove('hidden');
    panel.style.display = '';

    // スロットボタンの位置を取得してパネルの位置を調整
    const activeSlot = document.querySelector(`.brush-slot[data-idx="${idx}"][data-category="fill"]`);
    if (activeSlot) {
        const rect = activeSlot.getBoundingClientRect();
        const toolbarWidth = 64;
        panel.style.left = `${toolbarWidth}px`;

        const panelHeight = 250;
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

function setupFillSettingsPanel() {
    const panel = document.getElementById('fill-settings-panel');
    if (!panel) return;

    const closeBtn     = document.getElementById('fill-settings-close');
    const subToolSel   = document.getElementById('fs-subtool');
    const opSlider     = document.getElementById('fs-opacity');
    const opVal        = document.getElementById('fs-opacity-val');
    const bucketCheck  = document.getElementById('fs-bucket');
    const toleranceSel = document.getElementById('fs-tolerance');
    const binaryCheck   = document.getElementById('fs-is-binary');

    const sync = () => {
        const slot = state.fillSlots[_editingFillSlotIdx];
        slot.subTool        = subToolSel.value;
        slot.opacity        = parseInt(opSlider.value) / 100;
        slot.bucketEnabled  = bucketCheck.checked;
        slot.bucketTolerance = toleranceSel.value;
        slot.binary        = binaryCheck.checked;
        opVal.textContent   = Math.round(slot.opacity * 100);

        const isTone = slot.subTool === 'tone';
        document.getElementById('fs-opacity-row').style.display = isTone ? 'none' : '';
        document.getElementById('fs-tolerance-row').style.display = bucketCheck.checked ? '' : 'none';

        // アクティブスロットならモード反映
        if (_editingFillSlotIdx === state.activeFillSlotIndex && state.mode === 'fill') {
            state.subTool = slot.subTool;
            updateModeButtonIcon('fill', slot.subTool);
            updateToolButtonStates();
            updateToneMenuVisibility();
        }

        renderBrushPalette();
    };

    subToolSel.addEventListener('input', sync);
    opSlider.addEventListener('input', sync);
    bucketCheck.addEventListener('input', sync);
    toleranceSel.addEventListener('input', sync);
    binaryCheck.addEventListener('input', sync);

    panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    panel.addEventListener('pointermove', (e) => e.stopPropagation());

    closeBtn.addEventListener('click', () => panel.classList.add('hidden'));
}

// =============================================
// Eraser Settings Panel (消しゴム設定パネル)
// =============================================

let _editingEraserSlotIdx = 0;

function openEraserSettings(idx) {
    _editingEraserSlotIdx = idx;
    const slot = state.eraserSlots[idx];
    const panel = document.getElementById('eraser-settings-panel');
    if (!panel) return;

    document.getElementById('eraser-settings-name').textContent = `消しゴム ${idx + 1} 設定`;
    document.getElementById('es-subtool').value = slot.subTool || 'pen';
    document.getElementById('es-bucket').checked = slot.bucketEnabled !== false;
    document.getElementById('es-tolerance').value = slot.bucketTolerance || 'normal';
    document.getElementById('es-is-binary').checked = slot.binary !== false;

    // lasso のみバケツ設定を表示
    // 投げ縄のみバケツ設定を表示。2値化設定は常に表示
    const isLasso = slot.subTool === 'lasso';
    document.getElementById('es-bucket-row').style.display = isLasso ? '' : 'none';
    const bucketOn = isLasso && slot.bucketEnabled !== false;
    document.getElementById('es-tolerance-row').style.display = bucketOn ? '' : 'none';
    document.getElementById('es-is-binary-row').style.display = ''; // 常に表示

    panel.classList.remove('hidden');
    panel.style.display = '';

    const activeSlot = document.querySelector(`.brush-slot[data-idx="${idx}"][data-category="eraser"]`);
    if (activeSlot) {
        const rect = activeSlot.getBoundingClientRect();
        const toolbarWidth = 64;
        panel.style.left = `${toolbarWidth}px`;

        const panelHeight = 200;
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

function setupEraserSettingsPanel() {
    const panel = document.getElementById('eraser-settings-panel');
    if (!panel) return;

    const closeBtn     = document.getElementById('eraser-settings-close');
    const subToolSel   = document.getElementById('es-subtool');
    const bucketCheck  = document.getElementById('es-bucket');
    const toleranceSel = document.getElementById('es-tolerance');
    const binaryCheck  = document.getElementById('es-is-binary');

    const sync = () => {
        const slot = state.eraserSlots[_editingEraserSlotIdx];
        slot.subTool         = subToolSel.value;
        slot.bucketEnabled   = bucketCheck.checked;
        slot.bucketTolerance = toleranceSel.value;
        slot.binary          = binaryCheck.checked;

        const isLasso = slot.subTool === 'lasso';
        document.getElementById('es-bucket-row').style.display = isLasso ? '' : 'none';
        document.getElementById('es-tolerance-row').style.display = (isLasso && bucketCheck.checked) ? '' : 'none';
        document.getElementById('es-is-binary-row').style.display = ''; // 常に表示

        // アクティブスロットならモード反映
        if (_editingEraserSlotIdx === state.activeEraserSlotIndex && state.mode === 'eraser') {
            state.subTool = slot.subTool;
            updateModeButtonIcon('eraser', slot.subTool);
            updateToolButtonStates();
            updateBrushSizeVisibility();
        }

        renderBrushPalette();
    };

    subToolSel.addEventListener('input', sync);
    bucketCheck.addEventListener('input', sync);
    toleranceSel.addEventListener('input', sync);
    binaryCheck.addEventListener('input', sync);

    panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    panel.addEventListener('pointermove', (e) => e.stopPropagation());

    closeBtn.addEventListener('click', () => panel.classList.add('hidden'));
}

// =============================================
// Execute Clear Layer (消しゴム: 全消し)
// =============================================

async function executeClearLayer() {
    await saveState();
    const layer = getActiveLayer();
    if (layer) {
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        updateLayerThumbnail(layer);
    }
    await saveState();
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
        item.dataset.id = preset.id;
        item.title = `${preset.name} (${preset.type})`;

        const preview = createTonePreview(preset, 40, 40);
        item.appendChild(preview);

        item.addEventListener('click', (e) => {
            e.stopPropagation();

            // グローバルプリセット更新 (描画関数で参照)
            setTonePreset(preset.id);

            // アクティブ塗りスロットにも保存 (スロット独立保持)
            const fillSlot = state.fillSlots[state.activeFillSlotIndex];
            if (fillSlot) {
                fillSlot.tonePresetId = preset.id;
            }

            // Update active state
            menu.querySelectorAll('.tone-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');

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

    if (state.mode === 'fill' && state.subTool === 'tone') {
        // スロットごとのトーンプリセットをグローバルに反映
        const fillSlot = state.fillSlots[state.activeFillSlotIndex];
        if (fillSlot && fillSlot.tonePresetId) {
            setTonePreset(fillSlot.tonePresetId);
        }
        // メニューのアクティブ表示を更新
        const activePresetId = fillSlot?.tonePresetId || currentTonePresetId;
        menu.querySelectorAll('.tone-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === activePresetId);
        });

        menu.classList.remove('hidden');

        // 塗りモードボタンの真横に表示
        const fillBtn = document.getElementById('mode-fill');
        if (fillBtn) {
            const rect = fillBtn.getBoundingClientRect();
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
    const modalContent = document.getElementById('credit-content');

    if (!creditBtn || !creditModal) return;

    creditBtn.addEventListener('click', () => {
        creditModal.classList.toggle('visible');
    });

    // Close on any click outside modal content (except links inside modal)
    document.addEventListener('click', (e) => {
        if (!creditModal.classList.contains('visible')) return;

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
        }
    });
}

// ============================================
// Orientation Handler
// ============================================

function setupOrientationHandler() {
    async function resizeAllCanvases() {
        // Save all layer contents as ImageBitmaps
        const layerBitmaps = await Promise.all(
            layers.map(layer => createImageBitmap(layer.canvas))
        );

        const w = window.innerWidth;
        const h = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;

        // Background div
        canvasBg.style.width = w + 'px';
        canvasBg.style.height = h + 'px';

        // Lasso canvas
        lassoCanvas.width = w * dpr;
        lassoCanvas.height = h * dpr;
        lassoCanvas.style.width = w + 'px';
        lassoCanvas.style.height = h + 'px';
        const lCtx = lassoCanvas.getContext('2d');
        lCtx.setTransform(1, 0, 0, 1, 0, 0);
        lCtx.scale(dpr, dpr);

        // Selection canvas
        selectionCanvas.width = w * dpr;
        selectionCanvas.height = h * dpr;
        selectionCanvas.style.width = w + 'px';
        selectionCanvas.style.height = h + 'px';

        // Stroke canvas
        strokeCanvas.width = w * dpr;
        strokeCanvas.height = h * dpr;
        strokeCanvas.style.width = w + 'px';
        strokeCanvas.style.height = h + 'px';
        strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
        strokeCtx.scale(dpr, dpr);

        // Event canvas (no DPR, CSS pixel sized)
        eventCanvas.width = w;
        eventCanvas.height = h;

        // Restore each layer
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            layer.canvas.width = w * dpr;
            layer.canvas.height = h * dpr;
            layer.canvas.style.width = w + 'px';
            layer.canvas.style.height = h + 'px';
            layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
            layer.ctx.scale(dpr, dpr);
            layer.ctx.imageSmoothingEnabled = false;
            layer.ctx.drawImage(layerBitmaps[i], 0, 0, w, h);
            layer.ctx.imageSmoothingEnabled = true;
            layerBitmaps[i].close();
        }

        applyTransform();
    }

    // Handle orientation change
    window.addEventListener('orientationchange', () => {
        setTimeout(resizeAllCanvases, 100);
    });

    // Handle resize (e.g., browser chrome appearing/disappearing on iOS)
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeAllCanvases, 250);
    });

    // Handle returning from another app (visibility restored)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            applyTransform();
        }
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
                if (state.mode === 'eraser') {
                    // Return to pen mode — use active pen slot's sub-tool
                    state.mode = 'pen';
                    state.subTool = state.brushes[state.activeBrushIndex]?.subTool ?? 'pen';
                } else {
                    // Switch to eraser — use active eraser slot's sub-tool
                    state.mode = 'eraser';
                    state.subTool = state.eraserSlots[state.activeEraserSlotIndex]?.subTool ?? 'pen';
                }
                updateModeButtonIcon(state.mode, state.subTool);
                updateToolButtonStates();
                updateToneMenuVisibility();
                updateBrushSizeVisibility();
                updateBrushSizeSlider();
                renderBrushPalette();
            }
        }

        // Brush slot shortcuts: 1-N (no modifier)
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.target.matches('input, textarea, select')) {
            const num = parseInt(e.key);
            if (num >= 1) {
                if (state.mode === 'fill' && num <= state.fillSlots.length) {
                    e.preventDefault();
                    state.activeFillSlotIndex = num - 1;
                    const fillSlot = state.fillSlots[num - 1];
                    state.subTool = fillSlot.subTool;
                    updateModeButtonIcon('fill', fillSlot.subTool);
                    updateToolButtonStates();
                    updateToneMenuVisibility();
                    renderBrushPalette();
                } else if (state.mode === 'eraser' && num <= state.eraserSlots.length) {
                    e.preventDefault();
                    state.activeEraserSlotIndex = num - 1;
                    const eraserSlot = state.eraserSlots[num - 1];
                    state.subTool = eraserSlot.subTool;
                    if (eraserSlot.subTool === 'clear') {
                        executeClearLayer();
                    }
                    updateModeButtonIcon('eraser', eraserSlot.subTool);
                    updateToolButtonStates();
                    updateBrushSizeVisibility();
                    updateBrushSizeSlider();
                    renderBrushPalette();
                } else if (state.mode === 'pen' && num <= state.brushes.length) {
                    e.preventDefault();
                    state.activeBrushIndex = num - 1;
                    const brush = state.brushes[num - 1];
                    state.subTool = brush.subTool || 'pen';
                    updateModeButtonIcon('pen', state.subTool);
                    updateToolButtonStates();
                    updateBrushSizeVisibility();
                    updateBrushSizeSlider();
                    renderBrushPalette();
                    syncBrushSliders();
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
