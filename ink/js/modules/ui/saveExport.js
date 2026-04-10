import {
    state
} from '../state.js';
import { getCanvasPoint } from '../utils.js';
import {
    showSelectionUI,
    hideSelectionUI,
    copyToClipboard,
    saveRegion,
    redoSelection
} from '../save.js';
import { hideAllMenus } from './menuManager.js';

export function setupSaveUI() {
    // Menus & Entry Buttons
    const fullCanvasBtn = document.getElementById('snapshotFullBtn');
    const cropRangeBtn = document.getElementById('snapshotCropBtn');
    
    // Main UI
    const saveOverlay = document.getElementById('save-overlay');
    const saveUI = document.getElementById('save-ui');
    
    // UI Elements
    const closeBtn = document.getElementById('save-close');
    const confirmBtn = document.getElementById('confirmSelectionBtn');
    const copyBtn = document.getElementById('copyClipboardBtn');
    const transparentBgCheckbox = document.getElementById('transparentBg');
    const selCanvas = document.getElementById('selection-canvas');
    const selCtx = selCanvas?.getContext('2d');

    if (!saveUI) return;

    // --- Entry Points ---

    // Full Canvas path
    if (fullCanvasBtn) {
        fullCanvasBtn.addEventListener('click', () => {
            hideAllMenus();
            state.isSaveMode = true;
            state.selectionStart = null;
            state.selectionEnd = null;
            
            // Set selection to full canvas
            state.confirmedSelection = {
                x: 0, y: 0,
                w: state.paperW, h: state.paperH
            };

            saveOverlay.style.display = 'block';
            saveUI.style.display = 'block';
            if (copyBtn) copyBtn.style.display = 'none'; // Copy not needed for full? (or could be enabled)
            
            updateSelectionSizeDisplay();
            showSelectionUI();
        });
    }

    // Crop Range path
    if (cropRangeBtn) {
        cropRangeBtn.addEventListener('click', () => {
            hideAllMenus();
            state.isSaveMode = true;
            state.selectionStart = null;
            state.selectionEnd = null;
            state.confirmedSelection = null;

            saveOverlay.style.display = 'block';
            saveUI.style.display = 'none'; // Hide settings until selection is made
            
            showSelectionUI();
        });
    }

    const closeSaveMode = () => {
        state.isSaveMode = false;
        saveOverlay.style.display = 'none';
        saveUI.style.display = 'none';
        hideSelectionUI();
    };

    if (closeBtn) closeBtn.addEventListener('click', closeSaveMode);
    if (saveOverlay) saveOverlay.addEventListener('click', closeSaveMode);

    // --- Action Buttons ---

    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            if (state.confirmedSelection) {
                const { x, y, w, h } = state.confirmedSelection;
                await saveRegion(x, y, w, h, transparentBgCheckbox.checked);
            }
        });
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            if (state.confirmedSelection) {
                const { x, y, w, h } = state.confirmedSelection;
                await copyToClipboard(x, y, w, h, transparentBgCheckbox.checked);
            }
        });
    }

    // --- Selection Logic ---

    if (selCanvas && selCtx) {
        let isSelecting = false;

        selCanvas.addEventListener('pointerdown', (e) => {
            if (!state.isSaveMode) return;
            isSelecting = true;
            
            // Completely hide UI while dragging
            saveUI.classList.add('hidden-during-selection');
            
            state.selectionStart = { x: e.clientX, y: e.clientY };
            state.selectionEnd = null;
            state.confirmedSelection = null;
            selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
        });

        selCanvas.addEventListener('pointermove', (e) => {
            if (!isSelecting || !state.isSaveMode) return;
            
            state.selectionEnd = { x: e.clientX, y: e.clientY };
            drawSelectionRect(selCtx, state.selectionStart, state.selectionEnd, selCanvas);
            updateSelectionSizeDisplay();
        });

        selCanvas.addEventListener('pointerup', (e) => {
            if (!isSelecting || !state.isSaveMode) return;
            isSelecting = false;
            
            saveUI.classList.remove('hidden-during-selection');

            if (state.selectionStart && state.selectionEnd) {
                const sx = Math.min(state.selectionStart.x, state.selectionEnd.x);
                const sy = Math.min(state.selectionStart.y, state.selectionEnd.y);
                const sw = Math.abs(state.selectionEnd.x - state.selectionStart.x);
                const sh = Math.abs(state.selectionEnd.y - state.selectionStart.y);

                const p1 = getCanvasPoint(sx, sy);
                const p2 = getCanvasPoint(sx + sw, sy + sh);

                state.confirmedSelection = {
                    x: p1.x, y: p1.y,
                    w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y)
                };

                if (sw > 5 && sh > 5) {
                    // Selection made, show the settings panel
                    saveUI.style.display = 'block';
                    if (confirmBtn) confirmBtn.style.display = 'inline-block';
                    if (copyBtn) copyBtn.style.display = 'inline-block';
                    updateSelectionSizeDisplay();
                }
            }
        });
    }

    // --- Scale Selection ---
    document.querySelectorAll('[data-scale]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-scale]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedScale = parseInt(btn.dataset.scale);
            if (state.confirmedSelection) updateSelectionSizeDisplay();
        });
    });
}

function updateSelectionSizeDisplay() {
    const sizeDiv = document.getElementById('selection-size');
    if (!sizeDiv) return;
    let w = 0, h = 0;
    const scale = state.selectedScale || 1;

    if (state.selectionStart && state.selectionEnd) {
        w = Math.round(Math.abs(state.selectionEnd.x - state.selectionStart.x) / state.scale);
        h = Math.round(Math.abs(state.selectionEnd.y - state.selectionStart.y) / state.scale);
    } else if (state.confirmedSelection) {
        w = state.confirmedSelection.w;
        h = state.confirmedSelection.h;
    }

    if (w > 0 && h > 0) {
        sizeDiv.textContent = `SIZE: ${Math.round(w * scale)} x ${Math.round(h * scale)} px`;
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // Mask
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(x, y, w, h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
}
