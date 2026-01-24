import {
    state,
    roughCanvas, roughCtx,
    fillCanvas, fillCtx,
    lineCanvas, lineCtx,
    line2Canvas, line2Ctx,
    line3Canvas, line3Ctx
} from './state.js';

const layerMap = {
    rough: { canvas: () => roughCanvas, ctx: () => roughCtx, undo: 'roughUndoStack', redo: 'roughRedoStack' },
    fill: { canvas: () => fillCanvas, ctx: () => fillCtx, undo: 'fillUndoStack', redo: 'fillRedoStack' },
    line: { canvas: () => lineCanvas, ctx: () => lineCtx, undo: 'lineUndoStack', redo: 'lineRedoStack' },
    line2: { canvas: () => line2Canvas, ctx: () => line2Ctx, undo: 'line2UndoStack', redo: 'line2RedoStack' },
    line3: { canvas: () => line3Canvas, ctx: () => line3Ctx, undo: 'line3UndoStack', redo: 'line3RedoStack' }
};

// Save the state of a specific layer (bitmap only, no global stack)
export async function saveLayerState(targetLayer) {
    const layer = layerMap[targetLayer];
    if (!layer) return;

    const bitmap = await createImageBitmap(layer.canvas());
    state[layer.undo].push(bitmap);

    if (state[layer.undo].length > state.MAX_HISTORY) {
        state[layer.undo].shift().close();
    }

    state[layer.redo].forEach(b => b.close());
    state[layer.redo] = [];
}

// Save state of the currently active layer + record in global history
export async function saveState() {
    await saveLayerState(state.activeLayer);
    state.globalUndoStack.push(state.activeLayer);
    if (state.globalUndoStack.length > state.MAX_HISTORY) {
        state.globalUndoStack.shift();
    }
    state.globalRedoStack = [];
}

// Save states of all layers (init: no global record; clear all: record as group)
export async function saveAllStates(isInit = false) {
    const layers = ['rough', 'fill', 'line', 'line2', 'line3'];
    await Promise.all(layers.map(l => saveLayerState(l)));
    if (!isInit) {
        state.globalUndoStack.push(layers);
        if (state.globalUndoStack.length > state.MAX_HISTORY) {
            state.globalUndoStack.shift();
        }
        state.globalRedoStack = [];
    }
}

// Internal: undo a single layer's bitmap stack
function undoLayer(targetLayer) {
    const layer = layerMap[targetLayer];
    if (!layer) return false;
    if (state[layer.undo].length <= 1) return false;

    const current = state[layer.undo].pop();
    state[layer.redo].push(current);

    const prev = state[layer.undo][state[layer.undo].length - 1];
    const ctx = layer.ctx();
    const canvas = layer.canvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(prev, 0, 0);
    return true;
}

// Internal: redo a single layer's bitmap stack
function redoLayer(targetLayer) {
    const layer = layerMap[targetLayer];
    if (!layer) return false;
    if (state[layer.redo].length === 0) return false;

    const next = state[layer.redo].pop();
    state[layer.undo].push(next);

    const ctx = layer.ctx();
    const canvas = layer.canvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(next, 0, 0);
    return true;
}

// Restore a layer to its last saved state (for canceling in-progress strokes)
export function restoreLayer(targetLayer) {
    const layer = layerMap[targetLayer];
    if (!layer) return;
    if (state[layer.undo].length === 0) return;

    const prev = state[layer.undo][state[layer.undo].length - 1];
    const ctx = layer.ctx();
    const canvas = layer.canvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(prev, 0, 0);
}

// Global undo
export function undo() {
    if (state.globalUndoStack.length === 0) return;

    const entry = state.globalUndoStack.pop();
    const layers = Array.isArray(entry) ? entry : [entry];

    let success = false;
    for (const l of layers) {
        if (undoLayer(l)) success = true;
    }

    if (success) {
        state.globalRedoStack.push(entry);
    } else {
        // Put it back if nothing was actually undone
        state.globalUndoStack.push(entry);
    }
}

// Global redo
export function redo() {
    if (state.globalRedoStack.length === 0) return;

    const entry = state.globalRedoStack.pop();
    const layers = Array.isArray(entry) ? entry : [entry];

    let success = false;
    for (const l of layers) {
        if (redoLayer(l)) success = true;
    }

    if (success) {
        state.globalUndoStack.push(entry);
    } else {
        state.globalRedoStack.push(entry);
    }
}
