import {
    state,
    roughCanvas, roughCtx,
    fillCanvas, fillCtx,
    lineCanvas, lineCtx,
    line2Canvas, line2Ctx,
    line3Canvas, line3Ctx
} from './state.js';

// Save the state of a specific layer
export async function saveLayerState(targetLayer) {
    if (targetLayer === 'rough') {
        const bitmap = await createImageBitmap(roughCanvas);
        state.roughUndoStack.push(bitmap);
        // console.log('Saved rough layer state - stack size:', state.roughUndoStack.length);

        if (state.roughUndoStack.length > state.MAX_HISTORY) {
            state.roughUndoStack.shift().close();
        }

        state.roughRedoStack.forEach(b => b.close());
        state.roughRedoStack = [];
    } else if (targetLayer === 'fill') {
        const bitmap = await createImageBitmap(fillCanvas);
        state.fillUndoStack.push(bitmap);
        // console.log('Saved fill layer state - stack size:', state.fillUndoStack.length);

        if (state.fillUndoStack.length > state.MAX_HISTORY) {
            state.fillUndoStack.shift().close();
        }

        state.fillRedoStack.forEach(b => b.close());
        state.fillRedoStack = [];
    } else if (targetLayer === 'line') {
        const bitmap = await createImageBitmap(lineCanvas);
        state.lineUndoStack.push(bitmap);
        // console.log('Saved line layer state - stack size:', state.lineUndoStack.length);

        if (state.lineUndoStack.length > state.MAX_HISTORY) {
            state.lineUndoStack.shift().close();
        }

        state.lineRedoStack.forEach(b => b.close());
        state.lineRedoStack = [];
    } else if (targetLayer === 'line2') {
        const bitmap = await createImageBitmap(line2Canvas);
        state.line2UndoStack.push(bitmap);

        if (state.line2UndoStack.length > state.MAX_HISTORY) {
            state.line2UndoStack.shift().close();
        }

        state.line2RedoStack.forEach(b => b.close());
        state.line2RedoStack = [];
    } else if (targetLayer === 'line3') {
        const bitmap = await createImageBitmap(line3Canvas);
        state.line3UndoStack.push(bitmap);

        if (state.line3UndoStack.length > state.MAX_HISTORY) {
            state.line3UndoStack.shift().close();
        }

        state.line3RedoStack.forEach(b => b.close());
        state.line3RedoStack = [];
    }
}

// Save state of the currently active layer
export async function saveState() {
    await saveLayerState(state.activeLayer);
}

// Save states of all layers (used for Clear All)
export async function saveAllStates() {
    // console.log('Saving all layers state');
    await Promise.all([
        saveLayerState('rough'),
        saveLayerState('fill'),
        saveLayerState('line'),
        saveLayerState('line2'),
        saveLayerState('line3')
    ]);
}

// Undo operation
export function undo() {
    if (state.activeLayer === 'rough') {
        // console.log('Undo rough layer - stack size:', state.roughUndoStack.length);
        if (state.roughUndoStack.length <= 1) {
            // console.log('Cannot undo - at initial state');
            return;
        }

        const current = state.roughUndoStack.pop();
        state.roughRedoStack.push(current);

        const prev = state.roughUndoStack[state.roughUndoStack.length - 1];
        roughCtx.clearRect(0, 0, roughCanvas.width, roughCanvas.height);
        roughCtx.drawImage(prev, 0, 0);
        // console.log('Undo complete - new stack size:', state.roughUndoStack.length);
    } else if (state.activeLayer === 'fill') {
        // console.log('Undo fill layer - stack size:', state.fillUndoStack.length);
        if (state.fillUndoStack.length <= 1) {
            // console.log('Cannot undo - at initial state');
            return;
        }

        const current = state.fillUndoStack.pop();
        state.fillRedoStack.push(current);

        const prev = state.fillUndoStack[state.fillUndoStack.length - 1];
        fillCtx.clearRect(0, 0, fillCanvas.width, fillCanvas.height);
        fillCtx.drawImage(prev, 0, 0);
        // console.log('Undo complete - new stack size:', state.fillUndoStack.length);
    } else if (state.activeLayer === 'line') {
        // console.log('Undo line layer - stack size:', state.lineUndoStack.length);
        if (state.lineUndoStack.length <= 1) {
            // console.log('Cannot undo - at initial state');
            return;
        }

        const current = state.lineUndoStack.pop();
        state.lineRedoStack.push(current);

        const prev = state.lineUndoStack[state.lineUndoStack.length - 1];
        lineCtx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
        lineCtx.drawImage(prev, 0, 0);
        // console.log('Undo complete - new stack size:', state.lineUndoStack.length);
    } else if (state.activeLayer === 'line2') {
        if (state.line2UndoStack.length <= 1) return;

        const current = state.line2UndoStack.pop();
        state.line2RedoStack.push(current);

        const prev = state.line2UndoStack[state.line2UndoStack.length - 1];
        line2Ctx.clearRect(0, 0, line2Canvas.width, line2Canvas.height);
        line2Ctx.drawImage(prev, 0, 0);
    } else if (state.activeLayer === 'line3') {
        if (state.line3UndoStack.length <= 1) return;

        const current = state.line3UndoStack.pop();
        state.line3RedoStack.push(current);

        const prev = state.line3UndoStack[state.line3UndoStack.length - 1];
        line3Ctx.clearRect(0, 0, line3Canvas.width, line3Canvas.height);
        line3Ctx.drawImage(prev, 0, 0);
    }
}

// Redo operation
export function redo() {
    if (state.activeLayer === 'rough') {
        if (state.roughRedoStack.length === 0) return;

        const next = state.roughRedoStack.pop();
        state.roughUndoStack.push(next);

        roughCtx.clearRect(0, 0, roughCanvas.width, roughCanvas.height);
        roughCtx.drawImage(next, 0, 0);
    } else if (state.activeLayer === 'fill') {
        if (state.fillRedoStack.length === 0) return;

        const next = state.fillRedoStack.pop();
        state.fillUndoStack.push(next);

        fillCtx.clearRect(0, 0, fillCanvas.width, fillCanvas.height);
        fillCtx.drawImage(next, 0, 0);
    } else if (state.activeLayer === 'line') {
        if (state.lineRedoStack.length === 0) return;

        const next = state.lineRedoStack.pop();
        state.lineUndoStack.push(next);

        lineCtx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
        lineCtx.drawImage(next, 0, 0);
    } else if (state.activeLayer === 'line2') {
        if (state.line2RedoStack.length === 0) return;

        const next = state.line2RedoStack.pop();
        state.line2UndoStack.push(next);

        line2Ctx.clearRect(0, 0, line2Canvas.width, line2Canvas.height);
        line2Ctx.drawImage(next, 0, 0);
    } else if (state.activeLayer === 'line3') {
        if (state.line3RedoStack.length === 0) return;

        const next = state.line3RedoStack.pop();
        state.line3UndoStack.push(next);

        line3Ctx.clearRect(0, 0, line3Canvas.width, line3Canvas.height);
        line3Ctx.drawImage(next, 0, 0);
    }
}
