import { state } from '../state.js';
import { saveState } from '../history.js';
import { 
    copySelection, 
    liftSelection, 
    pasteFromClipboard, 
    deleteSelectionContent, 
    clearSelection,
    hasSelection
} from '../tools/selection.js';

let _toolbar = null;

export function setupSelectionUI() {
    _toolbar = document.getElementById('select-toolbar');
    if (!_toolbar) return;

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

    // Special: Move button is mostly a hint, but we can make it toggle a state if needed.
    // In this app, drag is always possible if selection exists and mouse is over it.
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
        return;
    }

    _toolbar.classList.remove('hidden');

    const mask = state.selectionMask;
    let x0, y0, w0, h0;

    if (mask.type === 'rect') {
        ({ x: x0, y: y0, w: w0, h: h0 } = mask.rect);
    } else {
        // Lasso AABB
        const xs = mask.points.map(p => p.x);
        const ys = mask.points.map(p => p.y);
        x0 = Math.min(...xs);
        y0 = Math.min(...ys);
        w0 = Math.max(...xs) - x0;
        h0 = Math.max(...ys) - y0;
    }

    // Add floating offset if moving
    if (state.floatingSelection) {
        x0 += state.floatingSelection.offsetX;
        y0 += state.floatingSelection.offsetY;
    }

    // Convert canvas coords (x0, y0) to screen logical pixels
    const screenX = x0 * state.scale + state.translateX;
    const screenY = y0 * state.scale + state.translateY;
    const screenW = w0 * state.scale;
    const screenH = h0 * state.scale;

    // Position toolbar above or below the selection
    const padding = 20; // Increased padding
    let top = screenY - 60; // default above (increased from 50)
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
