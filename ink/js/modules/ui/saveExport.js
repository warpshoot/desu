import {
    state,
    eventCanvas
} from '../state.js';
import { getCanvasPoint } from '../utils.js';
import {
    showSelectionUI,
    hideSelectionUI,
    saveAllCanvas,
    copyToClipboard,
    saveRegion,
    redoSelection
} from '../save.js';

export function setupSaveUI() {
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
    const selCtx = selCanvas?.getContext('2d');

    if (!saveBtn || !saveUI) return;

    saveBtn.addEventListener('click', () => {
        state.isSaveMode = true;
        state.selectionStart = null;
        state.selectionEnd = null;
        state.confirmedSelection = null;
        saveOverlay.style.display = 'block';
        saveUI.style.display = 'block';
        if (confirmBtn) confirmBtn.style.display = 'none';
        if (copyBtn) copyBtn.style.display = 'none';
        if (redoBtn) redoBtn.style.display = 'none';
        document.getElementById('selection-size').style.display = 'none';
        showSelectionUI();
    });

    const closeSaveMode = () => {
        state.isSaveMode = false;
        saveOverlay.style.display = 'none';
        saveUI.style.display = 'none';
        hideSelectionUI();
    };

    if (cancelBtn) cancelBtn.addEventListener('click', closeSaveMode);
    if (saveOverlay) saveOverlay.addEventListener('click', closeSaveMode);

    if (saveAllBtn) {
        saveAllBtn.addEventListener('click', () => {
            saveAllCanvas(transparentBgCheckbox.checked);
        });
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            if (state.confirmedSelection) {
                const { x, y, w, h } = state.confirmedSelection;
                await saveRegion(x, y, w, h);
            }
        });
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            if (state.confirmedSelection) {
                const { x, y, w, h } = state.confirmedSelection;
                await copyToClipboard(x, y, w, h);
            }
        });
    }

    if (redoBtn) {
        redoBtn.addEventListener('click', () => {
            redoSelection();
            confirmBtn.style.display = 'none';
            copyBtn.style.display = 'none';
            redoBtn.style.display = 'none';
            document.getElementById('selection-size').style.display = 'none';
        });
    }

    if (selCanvas && selCtx) {
        let isSelecting = false;

        selCanvas.addEventListener('pointerdown', (e) => {
            if (!state.isSaveMode) return;
            isSelecting = true;
            saveUI.classList.add('hidden-during-selection');
            state.selectionStart = { x: e.clientX, y: e.clientY };
            state.selectionEnd = null;
            state.confirmedSelection = null;
            selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
            confirmBtn.style.display = 'none';
            copyBtn.style.display = 'none';
            redoBtn.style.display = 'none';
        });

        selCanvas.addEventListener('pointermove', (e) => {
            if (!isSelecting || !state.isSaveMode) return;

            let endX = e.clientX;
            let endY = e.clientY;

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

                if (targetRatio) {
                    const absDx = Math.abs(dx);
                    const absDy = Math.abs(dy);
                    if (absDx / targetRatio > absDy) {
                        endX = startX + Math.sign(dx) * absDy * targetRatio;
                    } else {
                        endY = startY + Math.sign(dy) * absDx / targetRatio;
                    }
                }
            }

            state.selectionEnd = { x: endX, y: endY };
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
                    confirmBtn.style.display = 'inline-block';
                    copyBtn.style.display = 'inline-block';
                    redoBtn.style.display = 'inline-block';
                    updateSelectionSizeDisplay();
                }
            }
        });
    }

    document.querySelectorAll('[data-aspect]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-aspect]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedAspect = btn.dataset.aspect;
        });
    });

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
        sizeDiv.textContent = `サイズ: ${Math.round(w * scale)} x ${Math.round(h * scale)} px`;
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(x, y, w, h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
}
