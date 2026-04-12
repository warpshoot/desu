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

            // UI Display logic
            saveOverlay.style.display = 'block';
            saveUI.style.display = 'block';
            saveUI.classList.remove('hidden'); // Ensure not hidden by class
            
            // Ensure actions are visible for full mode
            if (confirmBtn) confirmBtn.style.display = 'inline-block';
            if (copyBtn) copyBtn.style.display = 'inline-block';
            
            updateSelectionSizeDisplay();
            showSelectionUI();
            
            // For full mode, reset selection canvas to clear
            if (selCtx) selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
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
            saveUI.classList.add('hidden'); // Initially hidden while selecting
            saveUI.style.display = 'none'; 
            
            showSelectionUI();
            
            // Initial feedback: fill with semi-transparent black
            if (selCtx) {
                selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
                selCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                selCtx.fillRect(0, 0, selCanvas.width, selCanvas.height);
            }
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
            
            // Selection overlay is screen-size, so use directly for drawing
            // but store canvas points for the actual crop logic
            state.selectionStart = { x: e.clientX, y: e.clientY };
            state.selectionEnd = { x: e.clientX, y: e.clientY };
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
                const ex = Math.max(state.selectionStart.x, state.selectionEnd.x);
                const ey = Math.max(state.selectionStart.y, state.selectionEnd.y);

                const p1 = getCanvasPoint(sx, sy);
                const p2 = getCanvasPoint(ex, ey);

                state.confirmedSelection = {
                    x: p1.x,
                    y: p1.y,
                    w: p2.x - p1.x,
                    h: p2.y - p1.y
                };

                const sw = Math.abs(state.selectionEnd.x - state.selectionStart.x);
                const sh = Math.abs(state.selectionEnd.y - state.selectionStart.y);

                if (sw > 5 && sh > 5) {
                    // Selection made, show the settings panel
                    saveUI.classList.remove('hidden'); // Ensure hidden class is removed
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
        const p1 = getCanvasPoint(state.selectionStart.x, state.selectionStart.y);
        const p2 = getCanvasPoint(state.selectionEnd.x, state.selectionEnd.y);
        w = Math.round(Math.abs(p2.x - p1.x));
        h = Math.round(Math.abs(p2.y - p1.y));
    } else if (state.confirmedSelection) {
        w = state.confirmedSelection.w;
        h = state.confirmedSelection.h;
    }

    if (w > 0 && h > 0) {
        sizeDiv.textContent = `SIZE: ${Math.round(w * scale)} x ${Math.round(h * scale)} px`;
        sizeDiv.style.display = 'block';
    } else if (state.confirmedSelection) {
        const cw = state.confirmedSelection.w * scale;
        const ch = state.confirmedSelection.h * scale;
        sizeDiv.textContent = `SIZE: ${Math.round(cw)} x ${Math.round(ch)} px`;
        sizeDiv.style.display = 'block';
    } else {
        sizeDiv.style.display = 'none';
    }
}

function drawSelectionRect(ctx, start, end, canvas) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    ctx.clearRect(0, 0, vw, vh);
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // Mask
    ctx.fillRect(0, 0, vw, vh);
    ctx.clearRect(x, y, w, h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
}
