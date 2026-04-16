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
    const clones = [];

    // 1. Synchronously clone everything so drawing can start immediately after this function returns (or even during)
    for (const layer of layers) {
        const clone = document.createElement('canvas');
        clone.width = layer.canvas.width;
        clone.height = layer.canvas.height;
        const ctx = clone.getContext('2d');
        ctx.drawImage(layer.canvas, 0, 0);
        clones.push({ id: layer.id, canvas: clone });
    }

    // 2. Asynchronously convert clones to bitmaps to populate the history stack
    for (const item of clones) {
        const bitmap = await createImageBitmap(item.canvas);
        snapshot.set(item.id, bitmap);
    }

    state.undoStack.push(snapshot);
    saveLocalState();

    // Limit history size
    if (state.undoStack.length > state.MAX_HISTORY) {
        const old = state.undoStack.shift();
        for (const bitmap of old.values()) {
            bitmap.close();
        }
    }

    // Clear redo stack
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
    if (state.undoStack.length === 0) {
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
        } else {
            // Layer was added after this snapshot was taken — clear it so undo
            // correctly reflects the state where this layer didn't have content yet.
            layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
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
