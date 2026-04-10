import { state, eventCanvas } from '../state.js';
import { centerCanvas, applyTransform, updateBackgroundColor } from '../canvas.js';
import { saveLocalState } from '../storage.js';
import { hideAllMenus } from './menuManager.js';
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
    liftSelection 
} from '../tools/selection.js';

const _MOD_DOUBLE_TAP_MS = 300;

export function setupZoomControls() {
    const resetBtn = document.getElementById('resetZoomBtn');
    if (resetBtn) resetBtn.addEventListener('click', () => centerCanvas());
}

export function setupModifierBar() {
    const shiftBtn = document.getElementById('mod-shift');
    if (!shiftBtn) return;

    let _lastTapTime = 0;

    const updateUI = () => {
        shiftBtn.classList.toggle('active', state._modShiftState !== 'idle');
        shiftBtn.classList.toggle('locked', state._modShiftState === 'locked');
    };

    const handleDown = (e) => {
        // We use touch events for the button to avoid locking the Pointer session in Safari
        if (e.type === 'touchstart') e.preventDefault();
        e.stopPropagation();
        
        const now = Date.now();
        if (state._modShiftState === 'locked') {
            state._modShiftState = 'idle';
        } else if (now - _lastTapTime < _MOD_DOUBLE_TAP_MS) {
            state._modShiftState = 'locked';
        } else {
            state._modShiftState = 'held';
        }
        _lastTapTime = now;
        updateUI();
    };

    const handleUp = (e) => {
        if (state._modShiftState === 'held') {
            state._modShiftState = 'idle';
            updateUI();
        }
    };

    const handleCancel = (e) => {
        if (state._modShiftState === 'held') {
            // Keep shift active if a pen session is ongoing, to survive palm rejection
            if (state.isPenDrawing || state.isPenSession) {
                state._modShiftPendingCancel = true;
            } else {
                state._modShiftState = 'idle';
                updateUI();
            }
        }
    };

    shiftBtn.addEventListener('touchstart', handleDown, { passive: false });
    shiftBtn.addEventListener('touchend', handleUp);
    shiftBtn.addEventListener('touchcancel', handleCancel);

    // Also keep pointer listeners as fallback for mouse/desktop, but skip preventDefault
    shiftBtn.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return; // Handled by touchstart
        handleDown(e);
    });
    shiftBtn.addEventListener('pointerup', (e) => {
        if (e.pointerType === 'touch') return;
        handleUp(e);
    });
    shiftBtn.addEventListener('pointercancel', (e) => {
        if (e.pointerType === 'touch') return;
        handleCancel(e);
    });

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
    if (!btn || !panel || !swatchContainer) return;

    const renderSwatches = () => {
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
        }
    });

    closeBtn.addEventListener('click', () => panel.classList.add('hidden'));
    panel.addEventListener('pointerdown', e => e.stopPropagation());
    panel.addEventListener('pointermove', e => e.stopPropagation());
}

export function setupCreditModal() {
    const creditBtn = document.getElementById('credit-btn');
    const creditModal = document.getElementById('credit-modal');
    if (!creditBtn || !creditModal) return;

    creditBtn.addEventListener('click', () => creditModal.classList.toggle('visible'));
    document.addEventListener('click', (e) => {
        if (!creditModal.classList.contains('visible')) return;
        if (creditModal.contains(e.target) && (e.target.tagName === 'A' || e.target.closest('a'))) return;
        if (e.target !== creditBtn && !creditBtn.contains(e.target)) creditModal.classList.remove('visible');
    });
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
            await undo();
            renderLayerButtons();
            updateAllThumbnails();
        }

        if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && (e.key === 'z' || e.key === 'Z')) || (e.key === 'y' || e.key === 'Y'))) {
            e.preventDefault();
            await redo();
            renderLayerButtons();
            updateAllThumbnails();
        }

        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
            if (!e.target.matches('input, textarea') && state.mode === 'select' && hasSelection()) {
                e.preventDefault();
                copySelection();
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
            }
        }

        if (e.key === 'Escape') {
            if (hasSelection()) {
                e.preventDefault();
                if (hasFloatingSelection()) {
                    await saveState();
                    commitFloating();
                }
                clearSelection();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            state.isSpacePressed = false;
            eventCanvas.style.cursor = '';
        }
        if (e.key === 'Shift') state.isShiftPressed = false;
    });
}
