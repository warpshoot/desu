import {
    state,
    layers,
    getLayer,
    getActiveLayer
} from './state.js';
import { saveLocalState } from './storage.js';

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
    // console.log('[DEBUG] saveState() called, undoStack.length now:', state.undoStack.length);
    saveLocalState();

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
 * Helper: Create a snapshot of current layers
 */
async function createSnapshot() {
    const snapshot = new Map();
    for (const layer of layers) {
        const bitmap = await createImageBitmap(layer.canvas);
        snapshot.set(layer.id, bitmap);
    }
    return snapshot;
}

/**
 * Undo last action
 */
export async function undo() {
    console.log('[DEBUG] undo() called, undoStack.length:', state.undoStack.length);
    if (state.undoStack.length === 0) {
        console.log('[DEBUG] undo() aborted, undoStack.length is 0');
        return;
    }

    // 1. Snapshot current state and push to redo stack
    const currentFn = await createSnapshot();
    state.redoStack.push(currentFn);

    // 2. Pop previous state
    const prev = state.undoStack.pop();

    // 3. Restore
    restoreSnapshot(prev);
    saveLocalState();
}

/**
 * Redo last undone action
 */
export async function redo() {
    if (state.redoStack.length === 0) return;

    // 1. Snapshot current state and push to undo stack
    const currentFn = await createSnapshot();
    state.undoStack.push(currentFn);

    // 2. Pop next state
    const next = state.redoStack.pop();

    // 3. Restore
    restoreSnapshot(next);
    saveLocalState();
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
