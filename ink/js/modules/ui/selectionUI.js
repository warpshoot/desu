import { state } from '../state.js';
import { saveState } from '../history.js';
import {
    copySelection,
    liftSelection,
    pasteFromClipboard,
    deleteSelectionContent,
    clearSelection,
    hasSelection,
    getHandleScreenPositions,
    setOverlayRedrawCallback
} from '../tools/selection.js';

// ============================================
// Handle hit-area divs (z-index 9999, above all UI panels)
// ============================================

const _HANDLE_NAMES = ['tl', 'tc', 'tr', 'ml', 'mr', 'bl', 'bc', 'br', 'rot'];
const _handleDivs = {};

function _getHandleCursor(handle, rotation) {
    if (handle === 'rot') return 'crosshair';
    const BASE = { ml: 0, mr: 0, tc: 90, bc: 90, tl: 135, br: 135, tr: 45, bl: 45 };
    const deg = ((BASE[handle] + (rotation * 180 / Math.PI)) % 180 + 180) % 180;
    if (deg < 22.5 || deg >= 157.5) return 'ew-resize';
    if (deg < 67.5)  return 'nesw-resize';
    if (deg < 112.5) return 'ns-resize';
    return 'nwse-resize';
}

function _setupHandleDivs() {
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:9999;';
    document.body.appendChild(container);

    for (const name of _HANDLE_NAMES) {
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;width:56px;height:56px;transform:translate(-50%,-50%);pointer-events:none;display:none;';
        container.appendChild(div);
        _handleDivs[name] = div;

        div.addEventListener('pointerdown', async (e) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            if (window._startHandleTransform) await window._startHandleTransform(e, name);
        });
    }
}

function _updateHandleDivPositions() {
    const positions = getHandleScreenPositions();
    const rotation = state.floatingSelection ? (state.floatingSelection.rotation || 0) : 0;
    for (const name of _HANDLE_NAMES) {
        const div = _handleDivs[name];
        if (!div) continue;
        if (!positions || !hasSelection()) {
            div.style.display = 'none';
            div.style.pointerEvents = 'none';
        } else {
            const pos = positions[name];
            div.style.left = pos.x + 'px';
            div.style.top = pos.y + 'px';
            div.style.display = 'block';
            div.style.pointerEvents = 'auto';
            div.style.cursor = _getHandleCursor(name, rotation);
        }
    }
}

// ============================================

let _toolbar = null;

export function setupSelectionUI() {
    _toolbar = document.getElementById('select-toolbar');
    if (!_toolbar) return;

    _setupHandleDivs();
    setOverlayRedrawCallback(_updateHandleDivPositions);

    // Bind buttons
    document.getElementById('sel-copy-btn')?.addEventListener('click', () => {
        copySelection();
        // Visual feedback (flash)
        const flash = document.getElementById('flash');
        if (flash) {
            flash.style.display = 'block';
            setTimeout(() => flash.style.display = 'none', 100);
        }
    });

    document.getElementById('sel-cut-btn')?.addEventListener('click', async () => {
        await saveState();
        liftSelection(true);
        updateSelectionToolbar();
    });

    document.getElementById('sel-paste-btn')?.addEventListener('click', async () => {
        await saveState();
        pasteFromClipboard();
        updateSelectionToolbar();
    });

    document.getElementById('sel-delete-btn')?.addEventListener('click', async () => {
        await saveState();
        deleteSelectionContent();
    });

    document.getElementById('sel-clear-btn')?.addEventListener('click', () => {
        clearSelection();
        updateSelectionToolbar();
    });

    window.updateSelectToolbar = updateSelectionToolbar;
}

/**
 * Update toolbar visibility and position based on selectionMask bounding box
 */
export function updateSelectionToolbar() {
    if (!_toolbar) return;

    if (!hasSelection()) {
        _toolbar.classList.add('hidden');
        _toolbar.style.opacity = '';
        _toolbar.style.pointerEvents = '';
        _updateHandleDivPositions();
        return;
    }

    _toolbar.classList.remove('hidden');

    const mask = state.selectionMask;
    let screenX, screenY, screenW, screenH;

    if (state.floatingSelection) {
        // Use AABB of the transformed float in screen coords
        const fs = state.floatingSelection;
        const cx = (fs.srcX + fs.offsetX + fs.w / 2) * state.scale + state.translateX;
        const cy = (fs.srcY + fs.offsetY + fs.h / 2) * state.scale + state.translateY;
        const hw = fs.w * state.scale * (fs.scaleX || 1) / 2;
        const hh = fs.h * state.scale * (fs.scaleY || 1) / 2;
        const r  = fs.rotation || 0;
        const ac = Math.abs(Math.cos(r)), as = Math.abs(Math.sin(r));
        const aabbHW = hw * ac + hh * as;
        const aabbHH = hw * as + hh * ac;
        screenX = cx - aabbHW;
        screenY = cy - aabbHH;
        screenW = aabbHW * 2;
        screenH = aabbHH * 2;
    } else {
        let x0, y0, w0, h0;
        if (mask.type === 'rect') {
            ({ x: x0, y: y0, w: w0, h: h0 } = mask.rect);
        } else {
            if (!mask.points || mask.points.length < 3) { _toolbar.classList.add('hidden'); return; }
            const xs = mask.points.map(p => p.x);
            const ys = mask.points.map(p => p.y);
            x0 = Math.min(...xs);
            y0 = Math.min(...ys);
            w0 = Math.max(...xs) - x0;
            h0 = Math.max(...ys) - y0;
        }
        screenX = x0 * state.scale + state.translateX;
        screenY = y0 * state.scale + state.translateY;
        screenW = w0 * state.scale;
        screenH = h0 * state.scale;
    }

    // Position toolbar above or below the selection
    // Extra 30px clearance for the rotation handle stem
    const padding = 20;
    let top = screenY - 90;
    let left = screenX + (screenW / 2);

    // If too close to top, move below
    if (top < 70) {
        top = screenY + screenH + padding;
    }

    // Screen bounds safety
    const vw = window.innerWidth;
    const tw = _toolbar.offsetWidth || 200; // fallback if not in DOM yet
    left = Math.max(tw / 2 + 10, Math.min(vw - tw / 2 - 10, left));

    _toolbar.style.top = top + 'px';
    _toolbar.style.left = (left - tw / 2) + 'px';

    _updateHandleDivPositions();
}

/**
 * Toggle interactivity of the toolbar (to prevent interference during drag)
 */
export function setSelectionToolbarInteractive(interactive) {
    if (!_toolbar) return;
    if (interactive) {
        _toolbar.style.pointerEvents = 'auto';
        // Only set opacity: 1 if we're not hidden
        if (!_toolbar.classList.contains('hidden')) {
            _toolbar.style.opacity = '1';
        }
    } else {
        _toolbar.style.pointerEvents = 'none';
        _toolbar.style.opacity = '0.4'; // Dim a bit to show it's non-interactive
    }
}
