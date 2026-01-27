import {
    state,
    layers,
    getLayer,
    getActiveLayer
} from './state.js';

// ============================================
// Global History System (Unified)
// ============================================
// Each undo/redo entry stores a snapshot of ALL layers at that moment
// Entry format: Map<layerId, ImageBitmap>

/**
 * Save current state of all visible layers to undo stack
 */
export async function saveState() {
    const snapshot = new Map();

    for (const layer of layers) {
        const bitmap = await createImageBitmap(layer.canvas);
        snapshot.set(layer.id, bitmap);
    }

    state.undoStack.push(snapshot);

    // Limit history size
    if (state.undoStack.length > state.MAX_HISTORY) {
        const old = state.undoStack.shift();
        // Clean up old bitmaps
        for (const bitmap of old.values()) {
            bitmap.close();
        }
    }

    // Clear redo stack on new action
    for (const entry of state.redoStack) {
        for (const bitmap of entry.values()) {
            bitmap.close();
        }
    }
    state.redoStack = [];
}

/**
 * Save state for initialization (no redo clear)
 */
export async function saveInitialState() {
    const snapshot = new Map();

    for (const layer of layers) {
        const bitmap = await createImageBitmap(layer.canvas);
        snapshot.set(layer.id, bitmap);
    }

    state.undoStack.push(snapshot);
}

/**
 * Undo last action
 */
export function undo() {
    if (state.undoStack.length <= 1) return; // Keep at least initial state

    const current = state.undoStack.pop();
    state.redoStack.push(current);

    const prev = state.undoStack[state.undoStack.length - 1];
    restoreSnapshot(prev);
}

/**
 * Redo last undone action
 */
export function redo() {
    if (state.redoStack.length === 0) return;

    const next = state.redoStack.pop();
    state.undoStack.push(next);

    restoreSnapshot(next);
}

/**
 * Restore canvas contents from a snapshot
 */
function restoreSnapshot(snapshot) {
    for (const layer of layers) {
        const bitmap = snapshot.get(layer.id);
        if (bitmap) {
            layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
            layer.ctx.drawImage(bitmap, 0, 0);
        }
    }
}

/**
 * Restore active layer to its last saved state (for canceling in-progress strokes)
 */
export function restoreLayer(layerId) {
    if (state.undoStack.length === 0) return;

    const lastSnapshot = state.undoStack[state.undoStack.length - 1];
    const bitmap = lastSnapshot.get(layerId);
    const layer = getLayer(layerId);

    if (bitmap && layer) {
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        layer.ctx.drawImage(bitmap, 0, 0);
    }
}

/**
 * Clear history when layers change (add/delete)
 * This prevents issues with mismatched layer IDs
 */
export async function resetHistory() {
    // Clear all existing history
    for (const entry of state.undoStack) {
        for (const bitmap of entry.values()) {
            bitmap.close();
        }
    }
    for (const entry of state.redoStack) {
        for (const bitmap of entry.values()) {
            bitmap.close();
        }
    }
    state.undoStack = [];
    state.redoStack = [];

    // Save fresh initial state
    await saveInitialState();
}
