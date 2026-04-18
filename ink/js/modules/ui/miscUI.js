import { state, eventCanvas } from '../state.js';
import { centerCanvas, applyTransform, updateBackgroundColor } from '../canvas.js';
import {
    exportConfig,
    importConfig,
    resetSettings,
    saveLocalState,
    getCanvasSizePref,
    setCanvasSizePref
} from '../storage.js';
import { t } from '../i18n.js';
import { doNewProject } from './fileMenu.js';
import { showHUD } from './hud.js';
import { hideAllMenus, handleOutsideClick } from './menuManager.js';
import { undo, redo, saveState } from '../history.js';
import { renderLayerButtons, updateAllThumbnails } from './layerPanel.js';
import { 
    handleModeTap, 
    updateModeButtonIcon, 
    updateToolButtonStates, 
    updateBrushSizeVisibility, 
    updateBrushSizeSlider, 
    renderBrushPalette 
} from './toolPanel.js';
import { updateToneMenuVisibility } from './toneMenu.js';
import {
    hasSelection,
    hasFloatingSelection,
    copySelection,
    deleteSelectionContent,
    clearSelection,
    commitFloating,
    pasteFromClipboard,
    liftSelection,
    resizeSelectionOverlay,
    cancelSelection,
    softUndoFloatTransform,
    softRedoFloatTransform
} from '../tools/selection.js';

const _MOD_DOUBLE_TAP_MS = 300;

export function setupZoomControls() {
    const resetBtn = document.getElementById('resetZoomBtn');
    if (resetBtn) resetBtn.addEventListener('click', () => centerCanvas());
}

export function setupModifierBar() {
    const shiftBtn = document.getElementById('mod-shift');
    if (!shiftBtn) return;

    const updateUI = () => {
        shiftBtn.classList.toggle('active', state._modShiftState !== 'idle');
        shiftBtn.classList.toggle('locked', state._modShiftState === 'locked');
    };

    const handleToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Simple toggle: idle <-> locked
        state._modShiftState = (state._modShiftState === 'idle') ? 'locked' : 'idle';
        updateUI();
    };

    // Use pointerdown for universal support without hold-hacks
    shiftBtn.addEventListener('pointerdown', handleToggle);

    // Initial sync
    window.updateModifierBar = updateUI;
}

const BG_COLORS = [
    { label: '白',          value: '#ffffff' },
    { label: 'オフホワイト', value: '#f8f7f2' },
    { label: 'クリーム',     value: '#f0ead6' },
    { label: '薄グレー',     value: '#e0e0d8' },
    { label: 'ベージュ',     value: '#d4c5a9' },
    { label: 'ダーク',       value: '#2c2c2c' },
];

export function setupSettingsPanel() {
    const btn = document.getElementById('settingsBtn');
    const panel = document.getElementById('settings-panel');
    const closeBtn = document.getElementById('settings-close');
    const swatchContainer = document.getElementById('bg-color-swatches');
    
    const exportConfigBtn = document.getElementById('exportConfigBtn');
    const importConfigBtn = document.getElementById('importConfigBtn');
    const configInput = document.getElementById('configInput');
    const resetConfigBtn = document.getElementById('resetConfigBtn');
    const aboutBtn = document.getElementById('aboutBtn');

    if (!btn || !panel) return;

    const renderSwatches = () => {
        if (!swatchContainer) return;
        swatchContainer.innerHTML = '';
        BG_COLORS.forEach(({ label, value }) => {
            const sw = document.createElement('div');
            sw.className = 'bg-color-swatch' + (state.canvasColor === value ? ' active' : '');
            sw.style.backgroundColor = value;
            sw.title = label;
            sw.addEventListener('click', () => {
                updateBackgroundColor(value);
                saveLocalState();
                renderSwatches();
            });
            swatchContainer.appendChild(sw);
        });
    };

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = panel.classList.contains('hidden');
        hideAllMenus();
        if (isHidden) {
            renderSwatches();
            const rect = btn.getBoundingClientRect();
            panel.style.right = (window.innerWidth - rect.right) + 'px';
            panel.style.top = rect.bottom + 10 + 'px';
            panel.classList.remove('hidden');

            // Wire up outside-click
            setTimeout(() => {
                document.addEventListener('pointerdown', handleOutsideClick);
            }, 10);
        }
    });

    if (closeBtn) closeBtn.addEventListener('click', () => panel.classList.add('hidden'));

    // Canvas Size Preference
    const canvasSizeSelect = document.getElementById('canvas-size-select');
    if (canvasSizeSelect) {
        canvasSizeSelect.value = String(getCanvasSizePref());
        canvasSizeSelect.addEventListener('change', async () => {
            const newSize = Number(canvasSizeSelect.value);
            setCanvasSizePref(newSize);
            panel.classList.add('hidden');
            if (confirm(t('confirm.canvasSizeSwitch'))) {
                await doNewProject();
            }
        });
    }

    // Sync select value each time the panel opens
    btn.addEventListener('click', () => {
        if (canvasSizeSelect) canvasSizeSelect.value = String(getCanvasSizePref());
    });

    // Snapshot (Save)
    const saveBtn = document.getElementById('saveBtn');
    const saveMenu = document.getElementById('save-menu');
    if (saveBtn && saveMenu) {
        saveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = saveMenu.classList.contains('hidden');
            hideAllMenus();
            if (isHidden) {
                const rect = saveBtn.getBoundingClientRect();
                saveMenu.style.right = (window.innerWidth - rect.right) + 'px';
                saveMenu.style.top = rect.bottom + 10 + 'px';
                saveMenu.classList.remove('hidden');

                setTimeout(() => {
                    document.addEventListener('pointerdown', handleOutsideClick);
                }, 10);
            }
        });
    }

    // Config Export
    if (exportConfigBtn) {
        exportConfigBtn.addEventListener('click', async () => {
            await exportConfig();
        });
    }

    // Config Import
    if (importConfigBtn && configInput) {
        importConfigBtn.addEventListener('click', () => configInput.click());
        configInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                const success = await importConfig(file);
                if (success) {
                    // Sync UI
                    updateModeButtonIcon(state.mode, state.subTool);
                    updateToolButtonStates();
                    updateToneMenuVisibility();
                    updateBrushSizeVisibility();
                    updateBrushSizeSlider();
                    renderBrushPalette();
                } else {
                    alert(t('alert.importFail'));
                }
                configInput.value = '';
            }
        });
    }

    // Reset Config
    if (resetConfigBtn) {
        resetConfigBtn.addEventListener('click', () => {
            if (confirm(t('confirm.reset'))) {
                resetSettings();
                updateModeButtonIcon(state.mode, state.subTool);
                updateToolButtonStates();
                updateToneMenuVisibility();
                updateBrushSizeVisibility();
                updateBrushSizeSlider();
                renderBrushPalette();
                renderSwatches();
            }
        });
    }

    // About
    if (aboutBtn) {
        aboutBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const modal = document.getElementById('credit-modal');
            if (modal) {
                hideAllMenus();
                modal.classList.remove('hidden');
            }
        });
    }

    // Modal Close logic
    const modal = document.getElementById('credit-modal');
    if (modal) {
        modal.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
        const content = document.getElementById('credit-content');
        if (content) {
            content.addEventListener('click', (e) => e.stopPropagation());
        }
    }

    panel.addEventListener('pointerdown', e => e.stopPropagation());
    panel.addEventListener('pointermove', e => e.stopPropagation());
}

function toggleActiveStabilizer() {
    let slot = null;
    let checkboxId = '';

    if (state.mode === 'pen') {
        slot = state.activeBrush;
        checkboxId = 'bs-stabilizer';
    } else if (state.mode === 'fill') {
        slot = state.activeFillSlot;
        checkboxId = 'fs-stabilizer';
    } else if (state.mode === 'eraser') {
        slot = state.activeEraserSlot;
        checkboxId = 'es-stabilizer';
    }

    if (slot && typeof slot.stabilizerEnabled !== 'undefined') {
        slot.stabilizerEnabled = !slot.stabilizerEnabled;
        
        // Sync UI checkbox if it exists
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
            checkbox.checked = slot.stabilizerEnabled;
            // Dispatch input event to trigger local sync logic (show/hide distance slider etc.)
            checkbox.dispatchEvent(new Event('input', { bubbles: true }));
        }

        showHUD(slot.stabilizerEnabled ? t('hud.stab.on') : t('hud.stab.off'));
    }
}

export function setupKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            state.isSpacePressed = true;
            eventCanvas.style.cursor = 'grab';
        }
        if (e.key === 'Shift') state.isShiftPressed = true;

        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault();
            if (!softUndoFloatTransform()) {
                await undo();
                cancelSelection();
                renderLayerButtons();
                updateAllThumbnails();
            }
            showHUD(t('hud.undo'));
        }

        if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && (e.key === 'z' || e.key === 'Z')) || (e.key === 'y' || e.key === 'Y'))) {
            e.preventDefault();
            if (!softRedoFloatTransform()) {
                await redo();
                cancelSelection();
                renderLayerButtons();
                updateAllThumbnails();
            }
            showHUD(t('hud.redo'));
        }

        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
            if (!e.target.matches('input, textarea') && state.mode === 'select' && hasSelection()) {
                e.preventDefault();
                copySelection();
                showHUD(t('hud.copy'));
            }
        }

        if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
            if (!e.target.matches('input, textarea') && state.mode === 'select' && hasSelection()) {
                e.preventDefault();
                copySelection();
                await saveState();
                if (hasFloatingSelection()) state.floatingSelection = null;
                else deleteSelectionContent();
                clearSelection();
                showHUD(t('hud.cut'));
                updateAllThumbnails();
            }
        }

        if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
            if (!e.target.matches('input, textarea') && state._selectionClipboard) {
                e.preventDefault();
                if (state.mode !== 'select') handleModeTap('select');
                if (hasFloatingSelection()) {
                    await saveState();
                    commitFloating();
                }
                await saveState();
                pasteFromClipboard();
                showHUD(t('hud.paste'));
            }
        }

        if (e.key === 'x' || e.key === 'X') {
            if (!e.target.matches('input, textarea')) {
                e.preventDefault();
                state.mode = state.mode === 'eraser' ? 'pen' : 'eraser';
                if (state.mode === 'pen') state.subTool = state.brushes[state.activeBrushIndex]?.subTool ?? 'pen';
                else state.subTool = state.eraserSlots[state.activeEraserSlotIndex]?.subTool ?? 'pen';
                updateModeButtonIcon(state.mode, state.subTool);
                updateToolButtonStates();
                updateToneMenuVisibility();
                updateBrushSizeVisibility();
                updateBrushSizeSlider();
                renderBrushPalette();
                showHUD(state.mode === 'pen' ? t('hud.mode.pen') : t('hud.mode.eraser'));
            }
        }

        // Selection Shortcuts
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (!e.target.matches('input, textarea') && hasSelection()) {
                e.preventDefault();
                await saveState();
                if (hasFloatingSelection()) state.floatingSelection = null;
                else deleteSelectionContent();
                updateAllThumbnails();
                showHUD(t('hud.delete'));
            }
        }

        if (e.key === 'Alt') state.isAltPressed = true;

        if (e.key === 'Escape') {
            if (hasSelection()) {
                e.preventDefault();
                if (hasFloatingSelection()) {
                    await saveState();
                    commitFloating();
                }
                clearSelection();
                showHUD(t('hud.deselect'));
            }
        }

        if (e.key === 's' || e.key === 'S') {
            if (!e.target.matches('input, textarea')) {
                e.preventDefault();
                toggleActiveStabilizer();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            state.isSpacePressed = false;
            eventCanvas.style.cursor = '';
        }
        if (e.key === 'Shift') state.isShiftPressed = false;
        if (e.key === 'Alt') state.isAltPressed = false;
    });
}
