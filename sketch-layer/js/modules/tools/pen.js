
import {
    state,
    roughCtx,
    fillCtx,
    lineCtx
} from '../state.js';
import { saveState } from '../history.js';

export function startPenDrawing(x, y) {
    state.isPenDrawing = true;
    state.lastPenPoint = { x, y };
    // console.log('startPenDrawing:', x, y);
}

export function drawPenLine(x, y) {
    if (!state.isPenDrawing || !state.lastPenPoint) return;

    const brushSizeEl = document.getElementById('brushSize');
    const brushSize = brushSizeEl ? parseFloat(brushSizeEl.value) : 3;

    // アクティブレイヤーにctxを選択
    const ctx = state.activeLayer === 'rough' ? roughCtx : (state.activeLayer === 'fill' ? fillCtx : lineCtx);

    // console.log('drawPenLine: from', state.lastPenPoint, 'to', { x, y }, 'brushSize=', brushSize, 'isErasing=', state.isErasing, 'activeLayer=', state.activeLayer);

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (state.isErasing) {
        // 消しゴムモード: destination-outで透明にする
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';  // 色は何でもいい、alphaが重要
        ctx.globalAlpha = 1.0;
    } else {
        // 通常のペンモード
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#000000';
        ctx.globalAlpha = 1.0;
    }

    ctx.beginPath();
    ctx.moveTo(state.lastPenPoint.x, state.lastPenPoint.y);
    ctx.lineTo(x, y);
    ctx.stroke();

    // globalCompositeOperationを元に戻す
    ctx.globalCompositeOperation = 'source-over';

    state.lastPenPoint = { x, y };
}

export async function endPenDrawing() {
    // console.log('endPenDrawing called - isPenDrawing:', state.isPenDrawing);
    if (state.isPenDrawing) {
        state.isPenDrawing = false;
        state.lastPenPoint = null;
        // console.log('endPenDrawing - calling saveState()');
        await saveState();
        // console.log('endPenDrawing - saveState() completed');
    }
}
