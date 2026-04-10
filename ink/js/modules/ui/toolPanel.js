import {
    state,
    getActiveLayer,
    getActiveLayerCtx,
    getLayer,
    CANVAS_DPR
} from '../state.js';
import { 
    saveState, 
    commitRedoClear, 
    saveLayerChangeState 
} from '../history.js';
import {
    dilateBox
} from '../tools/fill.js';
import { previewStraightLine } from '../tools/pen.js';
import { drawStippleLine } from '../tools/stipple.js';
import { hideAllMenus, handleOutsideClick } from './menuManager.js';
import { updateLayerThumbnail } from './layerPanel.js';
import { hasFloatingSelection, commitFloating } from '../tools/selection.js';
import { updateToneMenuVisibility } from './toneMenu.js';

// Slot icons (moved from ui.js)
const SUB_TOOL_ICONS = {
    pen:     { pen: 'icons/pen.png', stipple: 'icons/stipple.svg' },
    fill:    { fill: 'icons/bet.png', tone: 'icons/tone.png' },
    eraser:  { pen: 'icons/er2.svg', lasso: 'icons/er1.png', clear: null }
};

let _editingBrushIdx = 0;
let _editingFillSlotIdx = 0;
let _editingEraserSlotIdx = 0;
let _brushPreviewEl = null;
let _brushPreviewTimeout;

// Binary slider math
const SLIDER_MAX = 1000;
const BRUSH_SIZE_MIN = 1;
const BRUSH_SIZE_MAX = 500;
const SLIDER_EXPONENT = 3.0;

export function setupToolPanel() {
    const modeButtons = document.querySelectorAll('.mode-btn');

    modeButtons.forEach(btn => {
        btn.addEventListener('pointerup', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleModeTap(btn.dataset.mode);
        });
    });

    // Undo / Redo
    const undoBtn = document.getElementById('btn-undo');
    if(undoBtn) {
        undoBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            hideAllMenus();
            const { undo } = await import('../history.js');
            await undo();
            if (window.renderLayerButtons) window.renderLayerButtons();
        });
    }
    const redoBtn = document.getElementById('btn-redo');
    if(redoBtn) {
        redoBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            hideAllMenus();
            const { redo } = await import('../history.js');
            await redo();
            if (window.renderLayerButtons) window.renderLayerButtons();
        });
    }

    updateToolButtonStates();
    updateToneMenuVisibility();
}

export async function handleModeTap(mode) {
    const toneMenu = document.getElementById('tone-menu');
    const wasOnTone = state.mode === 'fill' && state.subTool === 'tone';
    const wasToneMenuVisible = toneMenu && !toneMenu.classList.contains('hidden');

    hideAllMenus();

    if (mode === 'fill' && state.mode === 'fill' && wasOnTone && wasToneMenuVisible) {
        return;
    }

    if (state.mode === 'select' && mode !== 'select') {
        if (hasFloatingSelection()) {
            await saveState();
            commitFloating();
        }
    }

    if (state.mode === mode) {
        if (mode === 'pen') {
            state.activeBrushIndex = (state.activeBrushIndex + 1) % state.brushes.length;
            state.subTool = state.brushes[state.activeBrushIndex].subTool;
        } else if (mode === 'fill') {
            state.activeFillSlotIndex = (state.activeFillSlotIndex + 1) % state.fillSlots.length;
            state.subTool = state.fillSlots[state.activeFillSlotIndex].subTool;
        } else if (mode === 'eraser') {
            state.activeEraserSlotIndex = (state.activeEraserSlotIndex + 1) % state.eraserSlots.length;
            state.subTool = state.eraserSlots[state.activeEraserSlotIndex].subTool;
        } else if (mode === 'select') {
            state.subTool = state.subTool === 'rect' ? 'lasso' : 'rect';
        }
    } else {
        state.mode = mode;
        if (mode === 'pen') {
            state.subTool = state.brushes[state.activeBrushIndex].subTool;
        } else if (mode === 'fill') {
            state.subTool = state.fillSlots[state.activeFillSlotIndex].subTool;
        } else if (mode === 'eraser') {
            state.subTool = state.eraserSlots[state.activeEraserSlotIndex].subTool;
        } else if (mode === 'select') {
            state.subTool = 'rect';
        }
    }

    updateModeButtonIcon(mode, state.subTool);
    updateToolButtonStates();
    updateToneMenuVisibility();
    updateBrushSizeVisibility();
    updateBrushSizeSlider();
    renderBrushPalette();
    
    // External call to modifier bar update
    if (window.updateModifierBar) window.updateModifierBar();
}

export function updateModeButtonIcon(mode, sub) {
    const btn = document.getElementById(`mode-${mode}`);
    if (!btn) return;
    btn.querySelectorAll('.mode-icon').forEach(img => {
        img.style.display = img.dataset.sub === sub ? '' : 'none';
    });
}

export function updateToolButtonStates() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        const isActive = state.mode === btn.dataset.mode;
        btn.classList.toggle('active', isActive);
    });

    const fillBtn = document.getElementById('mode-fill');
    if (fillBtn) {
        fillBtn.classList.toggle('tone-active', state.mode === 'fill' && state.subTool === 'tone');
    }

    const brushPalette = document.getElementById('brush-palette');
    const brushSettingsPanel = document.getElementById('brush-settings-panel');

    if (brushPalette) {
        brushPalette.classList.toggle('disabled', state.mode === 'select');
    }

    if (state.mode !== 'pen' && brushSettingsPanel) {
        brushSettingsPanel.classList.add('hidden');
    }

    updateBrushSizeVisibility();
    if (window.updateSelectToolbar) window.updateSelectToolbar();
}

export function updateBrushSizeVisibility() {
    const container = document.getElementById('size-slider-container');
    if (!container) return;
    const needsSize = state.mode === 'pen' || (state.mode === 'eraser' && state.subTool === 'pen');
    container.classList.toggle('disabled', !needsSize);
}

export function updateBrushSizeSlider() {
    const slider = document.getElementById('brushSize');
    const display = document.getElementById('sizeDisplay');
    if (!slider || !display) return;

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

export function sliderToBrushSize(sliderVal) {
    const t = sliderVal / SLIDER_MAX;
    return Math.round(BRUSH_SIZE_MIN + Math.pow(t, SLIDER_EXPONENT) * (BRUSH_SIZE_MAX - BRUSH_SIZE_MIN));
}

export function brushSizeToSlider(size) {
    const t = (size - BRUSH_SIZE_MIN) / (BRUSH_SIZE_MAX - BRUSH_SIZE_MIN);
    return Math.round(Math.pow(Math.max(0, t), 1 / SLIDER_EXPONENT) * SLIDER_MAX);
}

export function setupColorPickers() {
    const brushSizeSlider = document.getElementById('brushSize');
    const sizeDisplay = document.getElementById('sizeDisplay');
    if (!brushSizeSlider) return;

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

        flashBrushSizePreview();

        if (state.mode === 'pen' && (state.subTool === 'pen' || state.subTool === 'stipple')) {
            const activeIdx = state.activeBrushIndex;
            const activeSlotDot = document.querySelector(`.brush-slot[data-idx="${activeIdx}"] .brush-dot-preview`);
            if (activeSlotDot) {
                const slotDotSize = Math.max(1, size || 1);
                activeSlotDot.style.width = `${slotDotSize}px`;
                activeSlotDot.style.height = `${slotDotSize}px`;
                if (state.subTool === 'pen') {
                    activeSlotDot.style.opacity = state.activeBrush.opacity;
                }
            }
        }
    });

    brushSizeSlider.addEventListener('pointerdown', (e) => e.stopPropagation());
    brushSizeSlider.addEventListener('pointermove', (e) => e.stopPropagation());
}

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

    const sliderContainer = document.getElementById('size-slider-container');
    if (sliderContainer) {
        const rect = sliderContainer.getBoundingClientRect();
        _brushPreviewEl.style.left = `${rect.right + 12}px`;
        _brushPreviewEl.style.top = `${rect.top + rect.height / 2 - displaySize / 2}px`;
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

export function renderBrushPalette() {
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

    state.brushes.forEach((brush, idx) => {
        const slot = document.createElement('div');
        slot.className = 'brush-slot' + (idx === state.activeBrushIndex ? ' active' : '');
        slot.dataset.idx = idx;
        slot.dataset.category = 'pen';
        const swatch = document.createElement('div');
        swatch.className = 'brush-swatch';
        const dot = document.createElement('div');
        dot.className = 'brush-dot-preview';
        const displaySize = Math.max(1, brush.size || 1);
        dot.style.width = `${displaySize}px`;
        dot.style.height = `${displaySize}px`;
        dot.style.backgroundColor = '#000';
        dot.style.borderRadius = '50%';
        dot.style.opacity = brush.subTool === 'stipple' ? 1 : brush.opacity;
        swatch.appendChild(dot);
        const badge = _makeSlotIcon(SUB_TOOL_ICONS.pen[brush.subTool] || SUB_TOOL_ICONS.pen.pen);
        badge.className = 'slot-subtool-icon pen-slot-badge';
        slot.appendChild(badge);
        slot.appendChild(swatch);
        palette.appendChild(slot);
    });
}

function _makeSlotIcon(src) {
    if (!src) {
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
    const img = document.createElement('img');
    img.src = src;
    img.className = 'slot-subtool-icon';
    if (src.endsWith('.svg')) img.style.filter = 'brightness(0)';
    return img;
}

export function setupBrushPalette() {
    renderBrushPalette();
    const palette = document.getElementById('brush-palette');
    if (!palette) return;

    palette.addEventListener('pointerup', (e) => {
        const slot = e.target.closest('.brush-slot');
        if (!slot) return;
        const idx = parseInt(slot.dataset.idx);
        const category = slot.dataset.category || 'pen';

        if (category === 'fill') {
            if (state.activeFillSlotIndex === idx) {
                const panel = document.getElementById('fill-settings-panel');
                if (panel && !panel.classList.contains('hidden') && _editingFillSlotIdx === idx) {
                    hideAllMenus();
                } else {
                    openFillSettings(idx);
                }
            } else {
                hideAllMenus();
                state.activeFillSlotIndex = idx;
                state.subTool = state.fillSlots[idx].subTool;
                updateModeButtonIcon('fill', state.subTool);
                updateToolButtonStates();
                updateToneMenuVisibility();
                renderBrushPalette();
            }
        } else if (category === 'eraser') {
            if (state.activeEraserSlotIndex === idx) {
                const panel = document.getElementById('eraser-settings-panel');
                if (panel && !panel.classList.contains('hidden') && _editingEraserSlotIdx === idx) {
                    hideAllMenus();
                } else {
                    openEraserSettings(idx);
                }
            } else {
                hideAllMenus();
                state.activeEraserSlotIndex = idx;
                state.subTool = state.eraserSlots[idx].subTool;
                updateModeButtonIcon('eraser', state.subTool);
                updateToolButtonStates();
                updateBrushSizeSlider();
                renderBrushPalette();
            }
        } else {
            if (state.activeBrushIndex === idx) {
                const panel = document.getElementById('brush-settings-panel');
                if (panel && !panel.classList.contains('hidden') && _editingBrushIdx === idx) {
                    hideAllMenus();
                } else {
                    openBrushSettings(idx);
                }
            } else {
                hideAllMenus();
                state.activeBrushIndex = idx;
                state.subTool = state.brushes[idx].subTool || 'pen';
                updateModeButtonIcon('pen', state.subTool);
                updateToolButtonStates();
                updateBrushSizeSlider();
                renderBrushPalette();
            }
        }
    });
    palette.addEventListener('pointerdown', (e) => e.stopPropagation());
}

export function setupBrushSettingsPanel() {
    const panel = document.getElementById('brush-settings-panel');
    if (!panel) return;
    const closeBtn = document.getElementById('brush-settings-close');
    const controls = [
        'bs-subtool', 'bs-density', 'bs-pressure-density', 'bs-opacity',
        'bs-pressure-size', 'bs-binary', 'bs-pressure-curve', 'bs-stabilizer',
        'bs-stabilizer-dist', 'bs-stab-string', 'bs-stab-guide'
    ].map(id => document.getElementById(id));

    const sync = () => {
        const brush = state.brushes[_editingBrushIdx];
        brush.subTool = document.getElementById('bs-subtool').value;
        brush.stippleDensity = parseInt(document.getElementById('bs-density').value);
        brush.pressureDensity = document.getElementById('bs-pressure-density').checked;
        brush.opacity = parseInt(document.getElementById('bs-opacity').value) / 100;
        brush.pressureSize = document.getElementById('bs-pressure-size').checked;
        brush.binary = !document.getElementById('bs-binary').checked;
        brush.pressureCurve = parseFloat(document.getElementById('bs-pressure-curve').value);
        brush.stabilizerEnabled = document.getElementById('bs-stabilizer').checked;
        brush.stabilizerDistance = parseInt(document.getElementById('bs-stabilizer-dist').value);
        brush.stabStringVisible = document.getElementById('bs-stab-string').checked;
        brush.stabShowGuide = document.getElementById('bs-stab-guide').checked;

        document.getElementById('bs-density-val').textContent = brush.stippleDensity;
        document.getElementById('bs-opacity-val').textContent = Math.round(brush.opacity * 100);
        document.getElementById('bs-pressure-curve-val').textContent = brush.pressureCurve.toFixed(1);
        document.getElementById('bs-stabilizer-dist-val').textContent = brush.stabilizerDistance;

        if (_editingBrushIdx === state.activeBrushIndex && state.mode === 'pen') {
            state.subTool = brush.subTool;
            updateModeButtonIcon('pen', brush.subTool);
            updateToolButtonStates();
            updateBrushSizeSlider();
        }
        renderBrushPalette();
        openBrushSettings(_editingBrushIdx); // Refresh UI visibility
    };

    controls.forEach(el => el && el.addEventListener('input', sync));
    panel.addEventListener('pointermove', (e) => e.stopPropagation());
    
    const pinBtn = document.getElementById('brush-settings-pin');
    if (pinBtn) {
        pinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isBrushSettingsPinned = !state.isBrushSettingsPinned;
            pinBtn.classList.toggle('active', state.isBrushSettingsPinned);
        });
    }

    closeBtn.addEventListener('click', () => {
        panel.classList.add('hidden');
        updateToneMenuVisibility();
    });
}

export function openBrushSettings(idx) {
    _editingBrushIdx = idx;
    const brush = state.brushes[idx];
    const panel = document.getElementById('brush-settings-panel');
    if (!panel) return;

    const isStipple = brush.subTool === 'stipple';
    document.getElementById('brush-settings-name').textContent = `ブラシ ${idx + 1} 設定`;
    document.getElementById('bs-subtool').value = brush.subTool || 'pen';
    document.getElementById('bs-density').value = brush.stippleDensity ?? 5;
    document.getElementById('bs-density-val').textContent = brush.stippleDensity ?? 5;
    document.getElementById('bs-pressure-density').checked = brush.pressureDensity ?? true;
    document.getElementById('bs-opacity').value = Math.round(brush.opacity * 100);
    document.getElementById('bs-opacity-val').textContent = Math.round(brush.opacity * 100);
    document.getElementById('bs-pressure-size').checked = brush.pressureSize;
    document.getElementById('bs-binary').checked = !brush.binary;
    document.getElementById('bs-pressure-curve').value = brush.pressureCurve ?? 1.0;
    document.getElementById('bs-pressure-curve-val').textContent = (brush.pressureCurve ?? 1.0).toFixed(1);
    document.getElementById('bs-stabilizer').checked = brush.stabilizerEnabled ?? false;
    document.getElementById('bs-stabilizer-dist').value = brush.stabilizerDistance ?? 20;
    document.getElementById('bs-stabilizer-dist-val').textContent = brush.stabilizerDistance ?? 20;

    const toggle = (id, show) => {
        const el = document.getElementById(id);
        if (el) el.style.display = show ? '' : 'none';
    };

    toggle('bs-density-row', isStipple);
    toggle('bs-pressure-density-row', isStipple);
    toggle('bs-opacity-row', !isStipple);
    toggle('bs-pen-pressure-row', !isStipple);
    toggle('bs-binary-row', !isStipple);
    toggle('bs-stabilizer-row', !isStipple);
    toggle('bs-stabilizer-dist-row', !isStipple && brush.stabilizerEnabled);
    toggle('bs-stab-viz-row', !isStipple && brush.stabilizerEnabled);

    const pinBtn = document.getElementById('brush-settings-pin');
    if (pinBtn) {
        pinBtn.classList.toggle('active', state.isBrushSettingsPinned);
    }

    panel.classList.remove('hidden');
    const activeSlot = document.querySelector(`.brush-slot[data-idx="${idx}"]`);
    if (activeSlot) {
        const rect = activeSlot.getBoundingClientRect();
        panel.style.left = `64px`;
        panel.style.top = `${Math.max(12, Math.min(window.innerHeight - 412, rect.top - 60))}px`;
    }
    updateToneMenuVisibility();
}

// Stubs for other panels - to be implemented fully if needed
export function setupFillSettingsPanel() {
    const panel = document.getElementById('fill-settings-panel');
    if (!panel) return;

    const subToolSel     = document.getElementById('fs-subtool');
    const opSlider       = document.getElementById('fs-opacity');
    const opVal          = document.getElementById('fs-opacity-val');
    const bucketCheck    = document.getElementById('fs-bucket');
    const toleranceSel   = document.getElementById('fs-tolerance');
    const gapCloseSlider = document.getElementById('fs-gap-close');
    const gapCloseVal    = document.getElementById('fs-gap-close-val');
    const aaCheck        = document.getElementById('fs-aa');
    const stabCheck      = document.getElementById('fs-stabilizer');
    const stabDistSlider = document.getElementById('fs-stabilizer-dist');
    const stabDistVal    = document.getElementById('fs-stabilizer-dist-val');
    const closeBtn       = document.getElementById('fill-settings-close');

    const sync = () => {
        const slot = state.fillSlots[_editingFillSlotIdx];
        slot.subTool            = subToolSel.value;
        slot.opacity            = opSlider.value / 100;
        slot.bucketEnabled      = bucketCheck.checked;
        slot.bucketTolerance    = toleranceSel.value;
        slot.bucketGapClose     = parseInt(gapCloseSlider.value);
        slot.antiAlias          = aaCheck.checked;
        slot.stabilizerEnabled  = stabCheck.checked;
        slot.stabilizerDistance = parseInt(stabDistSlider.value);
        
        opVal.textContent       = Math.round(slot.opacity * 100);
        gapCloseVal.textContent = slot.bucketGapClose;
        stabDistVal.textContent = slot.stabilizerDistance;

        const isTone = slot.subTool === 'tone';
        const bucketOn = bucketCheck.checked && !isTone;
        
        const toggle = (id, show) => {
            const el = document.getElementById(id);
            if (el) el.style.display = show ? '' : 'none';
        };

        toggle('fs-bucket-row', !isTone);
        toggle('fs-tolerance-row', bucketOn);
        toggle('fs-gap-close-row', bucketOn);
        toggle('fs-aa-row', !isTone);
        toggle('fs-opacity-row', !isTone);

        const stabOn = !isTone && slot.stabilizerEnabled;
        toggle('fs-stabilizer-row', !isTone);
        toggle('fs-stabilizer-dist-row', stabOn);

        if (_editingFillSlotIdx === state.activeFillSlotIndex && state.mode === 'fill') {
            state.subTool = slot.subTool;
            updateModeButtonIcon('fill', slot.subTool);
            updateToolButtonStates();
            updateToneMenuVisibility();
        }
        renderBrushPalette();
        updateToneMenuVisibility();
    };

    [subToolSel, opSlider, bucketCheck, toleranceSel, aaCheck, stabCheck, stabDistSlider].forEach(el => {
        if (el) el.addEventListener('input', sync);
    });

    if (gapCloseSlider) {
        gapCloseSlider.addEventListener('input', () => {
            sync();
            _triggerGapClosePreview(parseInt(gapCloseSlider.value));
        });
        gapCloseSlider.addEventListener('change', () => _hideGapClosePreview());
    }

    panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    panel.addEventListener('pointermove', (e) => e.stopPropagation());

    const pinBtn = document.getElementById('fill-settings-pin');
    if (pinBtn) {
        pinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isFillSettingsPinned = !state.isFillSettingsPinned;
            pinBtn.classList.toggle('active', state.isFillSettingsPinned);
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            panel.classList.add('hidden');
            _hideGapClosePreview();
            updateToneMenuVisibility();
        });
    }
}

export function openFillSettings(idx) {
    _editingFillSlotIdx = idx;
    const slot = state.fillSlots[idx];
    const panel = document.getElementById('fill-settings-panel');
    if (!panel) return;

    document.getElementById('fill-settings-name').textContent = `投げ縄 ${idx + 1} 設定`;
    document.getElementById('fs-subtool').value = slot.subTool || 'fill';
    document.getElementById('fs-opacity').value = (slot.opacity ?? 1.0) * 100;
    document.getElementById('fs-opacity-val').textContent = Math.round((slot.opacity ?? 1.0) * 100);
    document.getElementById('fs-bucket').checked = slot.bucketEnabled !== false;
    document.getElementById('fs-tolerance').value = slot.bucketTolerance || 'normal';
    document.getElementById('fs-gap-close').value = slot.bucketGapClose ?? 0;
    document.getElementById('fs-gap-close-val').textContent = slot.bucketGapClose ?? 0;
    document.getElementById('fs-aa').checked = slot.antiAlias ?? false;
    document.getElementById('fs-stabilizer').checked = slot.stabilizerEnabled ?? false;
    document.getElementById('fs-stabilizer-dist').value = slot.stabilizerDistance ?? 20;
    document.getElementById('fs-stabilizer-dist-val').textContent = slot.stabilizerDistance ?? 20;

    const isTone = slot.subTool === 'tone';
    const bucketOn = slot.bucketEnabled !== false;
    
    document.getElementById('fs-bucket-row').style.display = isTone ? 'none' : '';
    document.getElementById('fs-tolerance-row').style.display = (bucketOn && !isTone) ? '' : 'none';
    document.getElementById('fs-gap-close-row').style.display = (bucketOn && !isTone) ? '' : 'none';
    document.getElementById('fs-aa-row').style.display = !isTone ? '' : 'none';
    document.getElementById('fs-opacity-row').style.display = isTone ? 'none' : '';

    const stabOn = !isTone && (slot.stabilizerEnabled ?? false);
    document.getElementById('fs-stabilizer-row').style.display = !isTone ? '' : 'none';
    document.getElementById('fs-stabilizer-dist-row').style.display = stabOn ? '' : 'none';

    const pinBtn = document.getElementById('fill-settings-pin');
    if (pinBtn) {
        pinBtn.classList.toggle('active', state.isFillSettingsPinned);
    }

    panel.classList.remove('hidden');
    const activeSlot = document.querySelector(`.brush-slot[data-idx="${idx}"][data-category="fill"]`);
    if (activeSlot) {
        const rect = activeSlot.getBoundingClientRect();
        panel.style.left = `64px`;
        panel.style.top = `${Math.max(12, Math.min(window.innerHeight - 312, rect.top - 60))}px`;
    }
    updateToneMenuVisibility();
}

export function setupEraserSettingsPanel() {
    const panel = document.getElementById('eraser-settings-panel');
    if (!panel) return;

    const subToolSel     = document.getElementById('es-subtool');
    const bucketCheck    = document.getElementById('es-bucket');
    const toleranceSel   = document.getElementById('es-tolerance');
    const gapCloseSlider = document.getElementById('es-gap-close');
    const gapCloseVal    = document.getElementById('es-gap-close-val');
    const aaCheck        = document.getElementById('es-aa');
    const stabCheck      = document.getElementById('es-stabilizer');
    const stabDistSlider = document.getElementById('es-stabilizer-dist');
    const stabDistVal    = document.getElementById('es-stabilizer-dist-val');
    const stabStringCheck = document.getElementById('es-stab-string');
    const stabGuideCheck  = document.getElementById('es-stab-guide');
    const psizeCheck      = document.getElementById('es-pressure-size');
    const curveSlider     = document.getElementById('es-pressure-curve');
    const curveVal        = document.getElementById('es-pressure-curve-val');
    const closeBtn        = document.getElementById('eraser-settings-close');

    const sync = () => {
        const slot = state.eraserSlots[_editingEraserSlotIdx];
        slot.subTool            = subToolSel.value;
        slot.bucketEnabled      = bucketCheck.checked;
        slot.bucketTolerance    = toleranceSel.value;
        slot.bucketGapClose     = parseInt(gapCloseSlider.value);
        slot.antiAlias          = aaCheck.checked;
        slot.stabilizerEnabled  = stabCheck.checked;
        slot.stabilizerDistance = parseInt(stabDistSlider.value);
        slot.stabStringVisible  = stabStringCheck.checked;
        slot.stabShowGuide      = stabGuideCheck.checked;
        slot.pressureSize       = psizeCheck.checked;
        slot.pressureCurve      = parseFloat(curveSlider.value);

        gapCloseVal.textContent = slot.bucketGapClose;
        stabDistVal.textContent = slot.stabilizerDistance;
        curveVal.textContent = slot.pressureCurve.toFixed(1);

        const isLasso = slot.subTool === 'lasso';
        const isPen   = slot.subTool === 'pen';

        const toggle = (id, show) => {
            const el = document.getElementById(id);
            if (el) el.style.display = show ? '' : 'none';
        };

        const bucketOn = isLasso && bucketCheck.checked;
        toggle('es-bucket-row', isLasso);
        toggle('es-tolerance-row', bucketOn);
        toggle('es-gap-close-row', bucketOn);
        toggle('es-aa-row', isLasso);

        const showStab = isPen || isLasso;
        const stabOn   = showStab && slot.stabilizerEnabled;
        toggle('es-stabilizer-row', showStab);
        toggle('es-stabilizer-dist-row', stabOn);
        toggle('es-stab-viz-row', isPen && stabOn);

        const penPressureSettings = document.getElementById('es-pen-pressure-settings');
        if (penPressureSettings) {
            penPressureSettings.style.display = isPen ? '' : 'none';
            const pcurveRow = document.getElementById('es-pressure-curve-row');
            if (pcurveRow) {
                pcurveRow.style.opacity = slot.pressureSize ? '1' : '0.5';
                pcurveRow.style.pointerEvents = slot.pressureSize ? 'auto' : 'none';
            }
        }

        if (_editingEraserSlotIdx === state.activeEraserSlotIndex && state.mode === 'eraser') {
            state.subTool = slot.subTool;
            updateModeButtonIcon('eraser', slot.subTool);
            updateToolButtonStates();
            updateBrushSizeVisibility();
        }
        renderBrushPalette();
        updateToneMenuVisibility();
    };

    [subToolSel, bucketCheck, toleranceSel, aaCheck, stabCheck, stabDistSlider, stabStringCheck, stabGuideCheck, psizeCheck, curveSlider]
        .forEach(el => el && el.addEventListener('input', sync));

    if (gapCloseSlider) {
        gapCloseSlider.addEventListener('input', () => {
            sync();
            _triggerGapClosePreview(parseInt(gapCloseSlider.value));
        });
        gapCloseSlider.addEventListener('change', () => _hideGapClosePreview());
    }

    panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    panel.addEventListener('pointermove', (e) => e.stopPropagation());

    const pinBtn = document.getElementById('eraser-settings-pin');
    if (pinBtn) {
        pinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isEraserSettingsPinned = !state.isEraserSettingsPinned;
            pinBtn.classList.toggle('active', state.isEraserSettingsPinned);
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            panel.classList.add('hidden');
            _hideGapClosePreview();
            updateToneMenuVisibility();
        });
    }
}

export function openEraserSettings(idx) {
    _editingEraserSlotIdx = idx;
    const slot = state.eraserSlots[idx];
    const panel = document.getElementById('eraser-settings-panel');
    if (!panel) return;

    document.getElementById('eraser-settings-name').textContent = `消しゴム ${idx + 1} 設定`;
    document.getElementById('es-subtool').value = slot.subTool || 'pen';
    document.getElementById('es-bucket').checked = slot.bucketEnabled !== false;
    document.getElementById('es-tolerance').value = slot.bucketTolerance || 'normal';
    document.getElementById('es-gap-close').value = slot.bucketGapClose ?? 0;
    document.getElementById('es-gap-close-val').textContent = slot.bucketGapClose ?? 0;
    document.getElementById('es-aa').checked = slot.antiAlias ?? false;
    document.getElementById('es-stabilizer').checked = slot.stabilizerEnabled ?? false;
    document.getElementById('es-stabilizer-dist').value = slot.stabilizerDistance ?? 20;
    document.getElementById('es-stabilizer-dist-val').textContent = slot.stabilizerDistance ?? 20;
    document.getElementById('es-stab-string').checked = slot.stabStringVisible ?? true;
    document.getElementById('es-stab-guide').checked = slot.stabShowGuide ?? true;
    document.getElementById('es-pressure-size').checked = slot.pressureSize ?? true;
    document.getElementById('es-pressure-curve').value = slot.pressureCurve ?? 1.0;
    document.getElementById('es-pressure-curve-val').textContent = (slot.pressureCurve ?? 1.0).toFixed(1);

    const isLasso = slot.subTool === 'lasso';
    const isPen   = slot.subTool === 'pen';
    
    document.getElementById('es-bucket-row').style.display = isLasso ? '' : 'none';
    const bucketOn = isLasso && slot.bucketEnabled !== false;
    document.getElementById('es-tolerance-row').style.display = bucketOn ? '' : 'none';
    document.getElementById('es-gap-close-row').style.display = bucketOn ? '' : 'none';
    document.getElementById('es-aa-row').style.display = isLasso ? '' : 'none';

    const showStab = isPen || isLasso;
    const stabOn   = showStab && (slot.stabilizerEnabled ?? false);
    document.getElementById('es-stabilizer-row').style.display = showStab ? '' : 'none';
    document.getElementById('es-stabilizer-dist-row').style.display = stabOn ? '' : 'none';
    document.getElementById('es-stab-viz-row').style.display = (isPen && stabOn) ? '' : 'none';

    const penPressureSettings = document.getElementById('es-pen-pressure-settings');
    if (penPressureSettings) {
        penPressureSettings.style.display = isPen ? '' : 'none';
        const pcurveRow = document.getElementById('es-pressure-curve-row');
        if (pcurveRow) {
            pcurveRow.style.opacity = (slot.pressureSize ?? true) ? '1' : '0.5';
            pcurveRow.style.pointerEvents = (slot.pressureSize ?? true) ? 'auto' : 'none';
        }
    }

    const pinBtn = document.getElementById('eraser-settings-pin');
    if (pinBtn) {
        pinBtn.classList.toggle('active', state.isEraserSettingsPinned);
    }

    panel.classList.remove('hidden');
    const activeSlot = document.querySelector(`.brush-slot[data-idx="${idx}"][data-category="eraser"]`);
    if (activeSlot) {
        const rect = activeSlot.getBoundingClientRect();
        panel.style.left = `64px`;
        panel.style.top = `${Math.max(12, Math.min(window.innerHeight - 350, rect.top - 60))}px`;
    }
    updateToneMenuVisibility();
}

export async function executeClearLayer() {
    const { saveState } = await import('../history.js');
    await saveState();
    const layer = getActiveLayer();
    if (layer) {
        const { pushSelectionClip, popSelectionClip } = await import('../tools/selection.js');
        const clipped = pushSelectionClip(layer.ctx);
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        if (clipped) popSelectionClip(layer.ctx);
        updateLayerThumbnail(layer);
    }
}

export async function clearAll() {
    const { saveState } = await import('../history.js');
    await saveState();
    const { layers } = await import('../state.js');
    const { pushSelectionClip, popSelectionClip } = await import('../tools/selection.js');

    for (const layer of layers) {
        const clipped = pushSelectionClip(layer.ctx);
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        if (clipped) popSelectionClip(layer.ctx);
        updateLayerThumbnail(layer);
    }
    await saveState();
}

let _gapPreviewTimer = null;

function _showGapClosePreview(gapClose) {
    if (gapClose <= 0) {
        _hideGapClosePreview();
        return;
    }
    const layer = getActiveLayer();
    if (!layer) return;

    const { canvas, ctx } = layer;
    const dpr = CANVAS_DPR;
    const w = canvas.width;
    const h = canvas.height;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const boundary = new Uint8Array(w * h);
    for (let j = 0; j < w * h; j++) {
        if (data[j * 4 + 3] >= 128) boundary[j] = 1;
    }

    const gapRadius = Math.ceil(gapClose / 2 * dpr);
    if (gapRadius <= 0) return;

    const dilated = dilateBox(boundary, w, h, gapRadius);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tctx = tempCanvas.getContext('2d');
    const haloData = tctx.createImageData(w, h);
    const hd = haloData.data;
    for (let j = 0; j < w * h; j++) {
        if (dilated[j] && !boundary[j]) {
            hd[j * 4]     = 0;
            hd[j * 4 + 1] = 120;
            hd[j * 4 + 2] = 255;
            hd[j * 4 + 3] = 90;
        }
    }
    tctx.putImageData(haloData, 0, 0);

    // Using state instead of require for ESM compatibility
    const { lassoCanvas, lassoCtx } = state; 
    const pw = w / dpr;
    const ph = h / dpr;
    if (lassoCtx) {
        lassoCtx.clearRect(0, 0, lassoCanvas.width / dpr, lassoCanvas.height / dpr);
        lassoCtx.drawImage(tempCanvas, state.translateX, state.translateY, pw * state.scale, ph * state.scale);
        lassoCanvas.style.display = 'block';
    }
}

function _hideGapClosePreview() {
    clearTimeout(_gapPreviewTimer);
    _gapPreviewTimer = null;
    const { lassoCanvas, lassoCtx } = state;
    const dpr = CANVAS_DPR;
    if (lassoCtx) lassoCtx.clearRect(0, 0, lassoCanvas.width / dpr, lassoCanvas.height / dpr);
}

function _triggerGapClosePreview(gapClose) {
    clearTimeout(_gapPreviewTimer);
    if (gapClose <= 0) {
        _hideGapClosePreview();
        return;
    }
    _gapPreviewTimer = setTimeout(() => _showGapClosePreview(gapClose), 80);
}
