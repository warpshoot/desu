/**
 * selection.js — 選択ツール
 *
 * 機能:
 *  - 矩形/ラッソ選択
 *  - 選択範囲内のみ描画制限 (post-process clipping)
 *  - 選択範囲の移動 (浮島方式)
 *  - アプリ内コピー/ペースト
 *  - マーチングアリ (軽量: 100ms setInterval + lineDashOffset)
 */

import {
    state,
    lassoCtx,
    lassoCanvas,
    getActiveLayer,
    getActiveLayerCtx,
    getActiveLayerCanvas,
    CANVAS_DPR
} from '../state.js';
import { getCanvasPoint, isPointInPolygon } from '../utils.js';
import { updateSelectionToolbar } from '../ui/selectionUI.js';
import { markLayerDirty } from '../history.js';

// ============================================
// DOM refs — select-overlay canvas
// ============================================

let _overlayCanvas = null;
let _overlayCtx    = null;

// Cached temp canvas for floating selections
let _fsTempCanvas = null;
let _fsTempCtx    = null;

function _getFsTempCanvas(w, h) {
    if (!_fsTempCanvas) {
        _fsTempCanvas = document.createElement('canvas');
        _fsTempCtx = _fsTempCanvas.getContext('2d');
    }
    if (_fsTempCanvas.width !== w || _fsTempCanvas.height !== h) {
        _fsTempCanvas.width = w;
        _fsTempCanvas.height = h;
    }
    return { canvas: _fsTempCanvas, ctx: _fsTempCtx };
}

export function initSelectionOverlay() {
    _overlayCanvas = document.getElementById('select-overlay');
    if (_overlayCanvas) {
        _overlayCtx = _overlayCanvas.getContext('2d');
        resizeSelectionOverlay();
    }
}

export function resizeSelectionOverlay() {
    if (!_overlayCanvas) return;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    const dpr = CANVAS_DPR;
    _overlayCanvas.width  = vw * dpr;
    _overlayCanvas.height = vh * dpr;
    _overlayCanvas.style.width  = vw + 'px';
    _overlayCanvas.style.height = vh + 'px';
    if (_overlayCtx) {
        _overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
        _overlayCtx.scale(dpr, dpr);
    }
    // If selection is active, redraw overlay immediately
    _marchOffset = 0;
    if (state.selectionMask) _drawOverlay();
}

// ============================================
// Marching ants animation
// ============================================

let _marchOffset = 0;
let _marchTimer  = null;

function _startMarch() {
    if (_marchTimer) return;
    _marchTimer = setInterval(() => {
        _marchOffset = (_marchOffset + 1) % 16;
        _drawOverlay();
    }, 80);
}

function _stopMarch() {
    if (_marchTimer) {
        clearInterval(_marchTimer);
        _marchTimer = null;
    }
}

// canvas座標 → スクリーン座標変換
function _toScreen(canvasX, canvasY) {
    return {
        x: canvasX * state.scale + state.translateX,
        y: canvasY * state.scale + state.translateY
    };
}

// ============================================
// Transform Handles
// ============================================

function _getTransformHandles(fs) {
    const cx = (fs.srcX + fs.offsetX + fs.w / 2) * state.scale + state.translateX;
    const cy = (fs.srcY + fs.offsetY + fs.h / 2) * state.scale + state.translateY;
    const hw = fs.w * state.scale * (fs.scaleX || 1) / 2;
    const hh = fs.h * state.scale * (fs.scaleY || 1) / 2;
    const r = fs.rotation || 0;
    const cos = Math.cos(r), sin = Math.sin(r);
    const rot = (lx, ly) => ({ x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos });
    const tc = rot(0, -hh);
    return {
        tl: rot(-hw, -hh), tc, tr: rot(hw, -hh),
        ml: rot(-hw, 0),          mr: rot(hw, 0),
        bl: rot(-hw,  hh), bc: rot(0, hh), br: rot(hw, hh),
        rot: { x: tc.x + sin * 30, y: tc.y - cos * 30 }
    };
}

function _maskToFakeFloat() {
    const mask = state.selectionMask;
    if (!mask) return null;
    let x0, y0, w0, h0;
    if (mask.type === 'rect') {
        ({ x: x0, y: y0, w: w0, h: h0 } = mask.rect);
    } else if (mask.type === 'lasso' && mask.points && mask.points.length >= 3) {
        const xs = mask.points.map(p => p.x);
        const ys = mask.points.map(p => p.y);
        x0 = Math.min(...xs); y0 = Math.min(...ys);
        w0 = Math.max(...xs) - x0; h0 = Math.max(...ys) - y0;
    } else return null;
    if (w0 <= 0 || h0 <= 0) return null;
    return { srcX: x0, srcY: y0, w: w0, h: h0, offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0 };
}

export function hitTestTransformHandle(screenX, screenY, isTouch = false) {
    const fs = state.floatingSelection || _maskToFakeFloat();
    if (!fs) return null;
    const handles = _getTransformHandles(fs);
    const HIT = isTouch ? 28 : 12;
    for (const [name, pos] of Object.entries(handles)) {
        if (Math.hypot(screenX - pos.x, screenY - pos.y) <= HIT) return name;
    }
    return null;
}

export function refreshSelectionOverlay() {
    _drawOverlay();
    updateSelectionToolbar();
}

export function isInFloatingSelection(canvasX, canvasY) {
    const fs = state.floatingSelection;
    if (!fs) return false;
    const cx = fs.srcX + fs.offsetX + fs.w / 2;
    const cy = fs.srcY + fs.offsetY + fs.h / 2;
    const r = -(fs.rotation || 0);
    const cos = Math.cos(r), sin = Math.sin(r);
    const dx = canvasX - cx, dy = canvasY - cy;
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    return Math.abs(lx) <= (fs.w / 2) * Math.abs(fs.scaleX || 1) &&
           Math.abs(ly) <= (fs.h / 2) * Math.abs(fs.scaleY || 1);
}

export function updateSelectionTransform(screenX, screenY) {
    const fs = state.floatingSelection;
    if (!fs || !state._transformStartState) return;
    const s = state._transformStartState;
    const handle = state._transformHandle;
    const cx = (s.srcX + s.offsetX + s.w / 2) * state.scale + state.translateX;
    const cy = (s.srcY + s.offsetY + s.h / 2) * state.scale + state.translateY;

    if (handle === 'rot') {
        const a0 = Math.atan2(state._transformStartPointer.y - cy, state._transformStartPointer.x - cx);
        const a1 = Math.atan2(screenY - cy, screenX - cx);
        let newRot = s.rotation + (a1 - a0);
        const isShiftActive = state.isShiftPressed || (state._modShiftState && state._modShiftState !== 'idle');
        if (isShiftActive) {
            const SNAP = Math.PI / 12; // 15° increments
            newRot = Math.round(newRot / SNAP) * SNAP;
        }
        fs.rotation = newRot;
        _drawOverlay();
        return;
    }

    // Undo rotation to get local (pre-rotation) coords
    const r = s.rotation;
    const cos = Math.cos(-r), sin = Math.sin(-r);
    const dx = screenX - cx, dy = screenY - cy;
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    const baseHW = s.w * state.scale / 2;
    const baseHH = s.h * state.scale / 2;

    let newSX = s.scaleX, newSY = s.scaleY;

    if (handle === 'mr' || handle === 'tr' || handle === 'br')  newSX =  lx / baseHW;
    else if (handle === 'ml' || handle === 'tl' || handle === 'bl') newSX = -lx / baseHW;

    if (handle === 'bc' || handle === 'bl' || handle === 'br')  newSY =  ly / baseHH;
    else if (handle === 'tc' || handle === 'tl' || handle === 'tr') newSY = -ly / baseHH;

    // Corner handles: proportional scale, no flip
    if (handle === 'tl' || handle === 'tr' || handle === 'bl' || handle === 'br') {
        const avg = (Math.abs(newSX) + Math.abs(newSY)) / 2;
        fs.scaleX = Math.max(0.05, avg);
        fs.scaleY = Math.max(0.05, avg);
    } else {
        // Edge handles: clamp each axis independently, no flip
        fs.scaleX = Math.max(0.05, newSX);
        fs.scaleY = Math.max(0.05, newSY);
    }
    _drawOverlay();
}

// ============================================
// Float Transform History (soft undo/redo)
// ============================================

function _snapshotFloat(fs) {
    return { offsetX: fs.offsetX, offsetY: fs.offsetY, scaleX: fs.scaleX || 1, scaleY: fs.scaleY || 1, rotation: fs.rotation || 0 };
}

export function pushFloatSnapshot() {
    if (!state.floatingSelection) return;
    state._floatHistory.push(_snapshotFloat(state.floatingSelection));
    state._floatRedoHistory = [];
}

export function softUndoFloatTransform() {
    if (!state.floatingSelection || state._floatHistory.length === 0) return false;
    const prev = state._floatHistory.pop();
    state._floatRedoHistory.push(_snapshotFloat(state.floatingSelection));
    Object.assign(state.floatingSelection, prev);
    _drawOverlay();
    updateSelectionToolbar();
    return true;
}

export function softRedoFloatTransform() {
    if (!state.floatingSelection || state._floatRedoHistory.length === 0) return false;
    const next = state._floatRedoHistory.pop();
    state._floatHistory.push(_snapshotFloat(state.floatingSelection));
    Object.assign(state.floatingSelection, next);
    _drawOverlay();
    updateSelectionToolbar();
    return true;
}

function _clearFloatHistory() {
    state._floatHistory = [];
    state._floatRedoHistory = [];
}

function _drawHandle(ctx, x, y, isRotation) {
    ctx.save();
    ctx.setLineDash([]);
    ctx.beginPath();
    if (isRotation) {
        ctx.arc(x, y, 6, 0, Math.PI * 2);
    } else {
        ctx.rect(x - 5, y - 5, 10, 10);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
}

function _drawTransformUI(ctx, fs) {
    const h = _getTransformHandles(fs);

    // Bounding box: white glow then dashed black
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(h.tl.x, h.tl.y);
    ctx.lineTo(h.tr.x, h.tr.y);
    ctx.lineTo(h.br.x, h.br.y);
    ctx.lineTo(h.bl.x, h.bl.y);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.lineDashOffset = -_marchOffset;
    ctx.stroke();
    ctx.restore();

    // Rotation stem
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(h.tc.x, h.tc.y);
    ctx.lineTo(h.rot.x, h.rot.y);
    ctx.strokeStyle = 'rgba(80,130,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 2]);
    ctx.stroke();
    ctx.restore();

    for (const name of ['tl', 'tc', 'tr', 'ml', 'mr', 'bl', 'bc', 'br']) {
        _drawHandle(ctx, h[name].x, h[name].y, false);
    }
    _drawHandle(ctx, h.rot.x, h.rot.y, true);
}

function _drawOverlay() {
    if (!_overlayCtx || !_overlayCanvas) return;
    const ctx = _overlayCtx;
    ctx.clearRect(0, 0, _overlayCanvas.width, _overlayCanvas.height);

    const mask = state.selectionMask;
    if (!mask) return;

    // --- Draw floating selection preview with transform ---
    if (state.floatingSelection) {
        const fs = state.floatingSelection;
        const cx = (fs.srcX + fs.offsetX + fs.w / 2) * state.scale + state.translateX;
        const cy = (fs.srcY + fs.offsetY + fs.h / 2) * state.scale + state.translateY;
        const sw = fs.w * state.scale;
        const sh = fs.h * state.scale;
        const source = fs.canvas || fs.imageData;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(fs.rotation || 0);
        ctx.scale(fs.scaleX || 1, fs.scaleY || 1);
        ctx.imageSmoothingEnabled = true;
        if (source instanceof ImageData) {
            const tmp = _getFsTempCanvas(source.width, source.height);
            tmp.ctx.putImageData(source, 0, 0);
            ctx.drawImage(tmp.canvas, -sw / 2, -sh / 2, sw, sh);
        } else {
            ctx.drawImage(source, -sw / 2, -sh / 2, sw, sh);
        }
        ctx.restore();
        _drawTransformUI(ctx, fs);
        return;
    }

    // --- Draw marching ants + transform handles for plain selection ---
    _drawAnts(ctx, mask);
    const fakeFloat = _maskToFakeFloat();
    if (fakeFloat) _drawTransformUI(ctx, fakeFloat);
}

function _drawAnts(ctx, mask) {
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -_marchOffset;
    ctx.lineWidth = 1.5;

    if (mask.type === 'rect') {
        const { x, y, w, h } = mask.rect;
        const tl = _toScreen(x, y);
        const br = _toScreen(x + w, y + h);
        const sw = br.x - tl.x;
        const sh = br.y - tl.y;

        // White shadow for contrast
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.strokeRect(tl.x, tl.y, sw, sh);

        // Black dashed line
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(tl.x, tl.y, sw, sh);

    } else if (mask.type === 'lasso' && mask.points && mask.points.length >= 3) {
        const pts = mask.points.map(p => _toScreen(p.x, p.y));

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();

        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();

        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    ctx.restore();
}

// ============================================
// Selection State Helpers
// ============================================

export function hasSelection() {
    return !!state.selectionMask;
}

export function hasFloatingSelection() {
    return !!state.floatingSelection;
}

/**
 * キャンバス座標 (x, y) が現在の選択範囲内かどうか
 */
export function isInSelection(canvasX, canvasY) {
    const mask = state.selectionMask;
    if (!mask) return false;

    // Apply offset if testing against a floating selection
    let checkX = canvasX;
    let checkY = canvasY;
    if (state.floatingSelection) {
        checkX -= state.floatingSelection.offsetX;
        checkY -= state.floatingSelection.offsetY;
    }

    if (mask.type === 'rect') {
        const { x, y, w, h } = mask.rect;
        return checkX >= x && checkX <= x + w && checkY >= y && checkY <= y + h;
    } else if (mask.type === 'lasso' && mask.points) {
        return isPointInPolygon(checkX, checkY, mask.points);
    }
    return false;
}

// ============================================
// Rect Selection
// ============================================

let _rectStart = null;

export function startRectSelect(screenX, screenY) {
    clearSelection();
    _rectStart = { screenX, screenY };
    const cp = getCanvasPoint(screenX, screenY);
    state.selectionMask = {
        type: 'rect',
        rect: { x: cp.x, y: cp.y, w: 0, h: 0 }
    };
}

export function updateRectSelect(screenX, screenY) {
    if (!_rectStart || !state.selectionMask) return;
    const p1 = getCanvasPoint(_rectStart.screenX, _rectStart.screenY);
    const p2 = getCanvasPoint(screenX, screenY);
    state.selectionMask.rect = {
        x: Math.min(p1.x, p2.x),
        y: Math.min(p1.y, p2.y),
        w: Math.abs(p2.x - p1.x),
        h: Math.abs(p2.y - p1.y)
    };
    _drawOverlay();
    updateSelectionToolbar();
}

export function finishRectSelect() {
    if (!state.selectionMask) return;
    const { w, h } = state.selectionMask.rect;
    if (w < 3 || h < 3) {
        clearSelection();
        return;
    }
    _rectStart = null;
    _startMarch();
    updateSelectionToolbar();
}

// ============================================
// Lasso Selection
// ============================================

let _lassoPoints = []; // screen coords during drawing

export function startLassoSelect(screenX, screenY) {
    clearSelection();
    _lassoPoints = [{ x: screenX, y: screenY }];
    if (_overlayCtx) {
        _overlayCtx.clearRect(0, 0, _overlayCanvas.width, _overlayCanvas.height);
    }
    // Show lasso canvas for drawing preview
    if (lassoCanvas) lassoCanvas.style.display = 'block';
    if (lassoCtx) lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
}

export function updateLassoSelect(screenX, screenY) {
    _lassoPoints.push({ x: screenX, y: screenY });
    if (!lassoCtx) return;
    lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
    lassoCtx.save();
    lassoCtx.strokeStyle = '#0066ff';
    lassoCtx.lineWidth = 2;
    lassoCtx.setLineDash([5, 3]);
    lassoCtx.beginPath();
    lassoCtx.moveTo(_lassoPoints[0].x, _lassoPoints[0].y);
    for (let i = 1; i < _lassoPoints.length; i++) {
        lassoCtx.lineTo(_lassoPoints[i].x, _lassoPoints[i].y);
    }
    lassoCtx.lineTo(_lassoPoints[0].x, _lassoPoints[0].y);
    lassoCtx.stroke();
    lassoCtx.restore();
}

export function finishLassoSelect() {
    if (lassoCanvas) lassoCanvas.style.display = 'none';
    if (lassoCtx) lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);

    if (_lassoPoints.length < 3) {
        _lassoPoints = [];
        clearSelection();
        return;
    }

    // Convert screen → canvas coords
    const canvasPoints = _lassoPoints.map(p => getCanvasPoint(p.x, p.y));
    _lassoPoints = [];

    state.selectionMask = {
        type: 'lasso',
        points: canvasPoints
    };

    _startMarch();
    updateSelectionToolbar();
}

// ============================================
// Clear Selection
// ============================================

export function clearSelection() {
    if (state.floatingSelection) {
        commitFloating();
    }
    _stopMarch();
    state.selectionMask = null;
    state.floatingSelection = null;
    state.isTransformingSelection = false;
    state._transformHandle = null;
    state.isMovingSelection = false;
    _clearFloatHistory();
    _rectStart = null;
    _lassoPoints = [];
    if (_overlayCtx && _overlayCanvas) {
        _overlayCtx.clearRect(0, 0, _overlayCanvas.width, _overlayCanvas.height);
    }
    updateSelectionToolbar();
}

/**
 * 選択範囲を「コミットせず」に破棄する (Undo/Redo用)
 */
export function cancelSelection() {
    _stopMarch();
    state.selectionMask = null;
    state.floatingSelection = null;
    state.isTransformingSelection = false;
    state._transformHandle = null;
    state.isMovingSelection = false;
    _clearFloatHistory();
    _rectStart = null;
    _lassoPoints = [];
    if (_overlayCtx && _overlayCanvas) {
        _overlayCtx.clearRect(0, 0, _overlayCanvas.width, _overlayCanvas.height);
    }
    updateSelectionToolbar();
}

// ============================================
// Selection Clip — Post-process
// ============================================
// 描画完了後に選択範囲外のピクセルを元に戻す方式。
// drawingツール側を変更せずにクリッピングを実現。


/**
 * アクティブレイヤーのコンテキストに現在の選択範囲でクリッピングを適用
 * 描画操作の直前に呼ぶ。必ず popSelectionClip(ctx) とペアで使う。
 */
export function pushSelectionClip(ctx) {
    if (!state.selectionMask) return false;

    const mask = state.selectionMask;
    const dpr  = CANVAS_DPR;

    ctx.save();
    ctx.beginPath();

    if (mask.type === 'rect') {
        const { x, y, w, h } = mask.rect;
        ctx.rect(x, y, w, h);
    } else if (mask.type === 'lasso' && mask.points) {
        const pts = mask.points;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
    }

    ctx.clip();
    return true;
}

/**
 * クリップ設定を解除
 */
export function popSelectionClip(ctx) {
    // 選択範囲がない場合でも ctx.save() しているわけではないので、
    // push側で返したフラグを元に呼ぶか、または単に restore を慎重に行う
    // ここでは push が成功している（saveされている）前提で呼ぶ設計にする
    ctx.restore();
}

// ============================================
// Move (Floating Selection)
// ============================================

/**
 * 選択範囲内のピクセルを「浮島」として切り取る。
 * cut=true のとき元位置のピクセルを消去 (移動)
 * cut=false のとき元位置を保持 (コピー)
 */
export function liftSelection(cut = true) {
    if (!state.selectionMask) return;

    const layer = getActiveLayer();
    if (!layer) return;

    const { canvas, ctx } = layer;
    const dpr  = CANVAS_DPR;
    const pw   = canvas.width;
    const ph   = canvas.height;

    // --- Bounding box of selection ---
    let x0, y0, w0, h0;
    const mask = state.selectionMask;
    if (mask.type === 'rect') {
        ({ x: x0, y: y0, w: w0, h: h0 } = mask.rect);
    } else {
        // Compute AABB from lasso points
        const xs = mask.points.map(p => p.x);
        const ys = mask.points.map(p => p.y);
        x0 = Math.max(0,  Math.floor(Math.min(...xs)));
        y0 = Math.max(0,  Math.floor(Math.min(...ys)));
        const x1 = Math.min(canvas.width  / dpr, Math.ceil(Math.max(...xs)));
        const y1 = Math.min(canvas.height / dpr, Math.ceil(Math.max(...ys)));
        w0 = x1 - x0;
        h0 = y1 - y0;
    }

    if (w0 <= 0 || h0 <= 0) return;

    // Clamp to canvas bounds
    x0 = Math.max(0, x0);
    y0 = Math.max(0, y0);
    w0 = Math.min(w0, canvas.width  / dpr - x0);
    h0 = Math.min(h0, canvas.height / dpr - y0);

    // Extract pixel data from the bounding box
    const physX = Math.round(x0 * dpr);
    const physY = Math.round(y0 * dpr);
    const physW = Math.round(w0 * dpr);
    const physH = Math.round(h0 * dpr);

    // --- GPU-based Clipping & Capture ---
    const { canvas: fsCanvas, ctx: fsCtx } = _getFsTempCanvas(physW, physH);
    fsCtx.clearRect(0, 0, physW, physH);
    
    fsCtx.save();
    if (mask.type === 'lasso' && mask.points) {
        // Draw the lasso shape as a clipping mask on the offscreen canvas
        fsCtx.beginPath();
        fsCtx.moveTo((mask.points[0].x - x0) * dpr, (mask.points[0].y - y0) * dpr);
        for (let i = 1; i < mask.points.length; i++) {
            fsCtx.lineTo((mask.points[i].x - x0) * dpr, (mask.points[i].y - y0) * dpr);
        }
        fsCtx.closePath();
        fsCtx.clip();
    }
    
    // Copy pixels from the main canvas directly via GPU
    fsCtx.drawImage(canvas, physX, physY, physW, physH, 0, 0, physW, physH);
    fsCtx.restore();

    // Create a NEW persistent canvas for this floating selection
    const persistentCanvas = document.createElement('canvas');
    persistentCanvas.width = physW;
    persistentCanvas.height = physH;
    persistentCanvas.getContext('2d').drawImage(fsCanvas, 0, 0);

    state.floatingSelection = {
        canvas: persistentCanvas,
        srcX: x0,
        srcY: y0,
        w: w0,
        h: h0,
        offsetX: 0,
        offsetY: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0
    };

    // Erase source pixels if cutting
    if (cut) {
        _eraseSelection(layer);
        markLayerDirty(layer.id);
    }
    updateSelectionToolbar();
}

function _eraseSelection(layer) {
    const { ctx } = layer;
    const mask = state.selectionMask;
    const dpr  = CANVAS_DPR;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';

    if (mask.type === 'rect') {
        const { x, y, w, h } = mask.rect;
        ctx.fillRect(x, y, w, h);
    } else if (mask.type === 'lasso' && mask.points) {
        ctx.beginPath();
        ctx.moveTo(mask.points[0].x, mask.points[0].y);
        for (let i = 1; i < mask.points.length; i++) {
            ctx.lineTo(mask.points[i].x, mask.points[i].y);
        }
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}

export function dragFloating(dx, dy) {
    if (!state.floatingSelection) return;
    state.floatingSelection.offsetX += dx;
    state.floatingSelection.offsetY += dy;
    _drawOverlay();
    updateSelectionToolbar();
}

/**
 * 浮島をアクティブレイヤーに確定コミット（変形あり）
 */
export function commitFloating() {
    if (!state.floatingSelection) return;

    const layer = getActiveLayer();
    if (!layer) return;

    const { ctx } = layer;
    const fs  = state.floatingSelection;
    const dpr = CANVAS_DPR;
    const source = fs.canvas || fs.imageData;
    const cx = fs.srcX + fs.offsetX + fs.w / 2;
    const cy = fs.srcY + fs.offsetY + fs.h / 2;
    const rotation = fs.rotation || 0;
    const scaleX   = fs.scaleX   || 1;
    const scaleY   = fs.scaleY   || 1;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.scale(scaleX, scaleY);
    if (source instanceof ImageData) {
        const tmp = document.createElement('canvas');
        tmp.width  = source.width;
        tmp.height = source.height;
        tmp.getContext('2d').putImageData(source, 0, 0);
        ctx.drawImage(tmp, -fs.w / 2, -fs.h / 2, fs.w, fs.h);
    } else {
        ctx.drawImage(source, -fs.w / 2, -fs.h / 2, fs.w, fs.h);
    }
    ctx.restore();

    markLayerDirty(layer.id);
    state.floatingSelection = null;
    _clearFloatHistory();

    // 選択マスクを更新
    if (state.selectionMask) {
        const transformed = rotation !== 0 || scaleX !== 1 || scaleY !== 1;
        if (transformed) {
            // 変形あり: 変換後の AABB に置き換え
            const hw = fs.w * Math.abs(scaleX) / 2;
            const hh = fs.h * Math.abs(scaleY) / 2;
            const ac = Math.abs(Math.cos(rotation));
            const as = Math.abs(Math.sin(rotation));
            const aabbHW = hw * ac + hh * as;
            const aabbHH = hw * as + hh * ac;
            state.selectionMask = {
                type: 'rect',
                rect: { x: cx - aabbHW, y: cy - aabbHH, w: aabbHW * 2, h: aabbHH * 2 }
            };
        } else {
            // 移動のみ: マスクを追従
            if (state.selectionMask.type === 'rect') {
                state.selectionMask.rect.x += fs.offsetX;
                state.selectionMask.rect.y += fs.offsetY;
            } else if (state.selectionMask.type === 'lasso' && state.selectionMask.points) {
                state.selectionMask.points = state.selectionMask.points.map(p => ({
                    x: p.x + fs.offsetX,
                    y: p.y + fs.offsetY
                }));
            }
        }
    }

    _drawOverlay();
}

// ============================================
// Copy / Paste (app-internal clipboard)
// ============================================

export function copySelection() {
    if (!state.selectionMask) return;

    if (state.floatingSelection) {
        const fs = state.floatingSelection;
        const src = fs.canvas || fs.imageData;
        const dpr = CANVAS_DPR;
        if (src instanceof HTMLCanvasElement) {
            const clone = document.createElement('canvas');
            clone.width  = src.width;
            clone.height = src.height;
            clone.getContext('2d').drawImage(src, 0, 0);
            state._selectionClipboard = { canvas: clone, w: fs.w, h: fs.h };
        } else if (src instanceof ImageData) {
            const cloned = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
            state._selectionClipboard = { imageData: cloned, w: src.width / dpr, h: src.height / dpr };
        }
        return;
    }

    const layer = getActiveLayer();
    if (!layer) return;

    const { canvas, ctx } = layer;
    const dpr  = CANVAS_DPR;
    const mask = state.selectionMask;

    let x0, y0, w0, h0;
    if (mask.type === 'rect') {
        ({ x: x0, y: y0, w: w0, h: h0 } = mask.rect);
    } else {
        if (!mask.points || mask.points.length < 3) return;
        const xs = mask.points.map(p => p.x);
        const ys = mask.points.map(p => p.y);
        x0 = Math.max(0,  Math.floor(Math.min(...xs)));
        y0 = Math.max(0,  Math.floor(Math.min(...ys)));
        const x1 = Math.min(canvas.width  / dpr, Math.ceil(Math.max(...xs)));
        const y1 = Math.min(canvas.height / dpr, Math.ceil(Math.max(...ys)));
        w0 = x1 - x0;
        h0 = y1 - y0;
    }

    if (w0 <= 0 || h0 <= 0) return;

    const physX = Math.round(x0 * dpr);
    const physY = Math.round(y0 * dpr);
    const physW = Math.round(w0 * dpr);
    const physH = Math.round(h0 * dpr);

    // GPU-based clipboard capture (Canvas instead of ImageData)
    const clipCanvas = document.createElement('canvas');
    clipCanvas.width = physW;
    clipCanvas.height = physH;
    const clipCtx = clipCanvas.getContext('2d');
    
    clipCtx.save();
    if (mask.type === 'lasso' && mask.points) {
        clipCtx.beginPath();
        clipCtx.moveTo((mask.points[0].x - x0) * dpr, (mask.points[0].y - y0) * dpr);
        for (let i = 1; i < mask.points.length; i++) {
            clipCtx.lineTo((mask.points[i].x - x0) * dpr, (mask.points[i].y - y0) * dpr);
        }
        clipCtx.closePath();
        clipCtx.clip();
    }
    const sourceCanvas = getActiveLayerCanvas();
    clipCtx.drawImage(sourceCanvas, Math.round(x0 * dpr), Math.round(y0 * dpr), physW, physH, 0, 0, physW, physH);
    clipCtx.restore();

    state._selectionClipboard = {
        canvas: clipCanvas,
        w: w0,
        h: h0
    };
}

export function pasteFromClipboard() {
    if (!state._selectionClipboard) return;
    const cb = state._selectionClipboard;
    if (!cb.w || !cb.h || cb.w <= 0 || cb.h <= 0) return;

    // Cancel any current floating selection
    if (state.floatingSelection) {
        commitFloating();
    }
    state.isTransformingSelection = false;
    state._transformHandle = null;
    _clearFloatHistory();

    // Place paste at center of current viewport
    const centerCanvasX = Math.round(-state.translateX / state.scale + window.innerWidth  / (2 * state.scale));
    const centerCanvasY = Math.round(-state.translateY / state.scale + window.innerHeight / (2 * state.scale));

    const pasteX = centerCanvasX - Math.round(cb.w / 2);
    const pasteY = centerCanvasY - Math.round(cb.h / 2);

    // Create new selection mask at paste position
    state.selectionMask = {
        type: 'rect',
        rect: { x: pasteX, y: pasteY, w: cb.w, h: cb.h }
    };

    // Clone Clipboard Source
    let persistentCanvas;
    if (cb.canvas) {
        persistentCanvas = document.createElement('canvas');
        persistentCanvas.width = cb.canvas.width;
        persistentCanvas.height = cb.canvas.height;
        persistentCanvas.getContext('2d').drawImage(cb.canvas, 0, 0);
    }

    state.floatingSelection = {
        canvas: persistentCanvas,
        imageData: cb.imageData,
        srcX: pasteX,
        srcY: pasteY,
        w: cb.w,
        h: cb.h,
        offsetX: 0,
        offsetY: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0
    };

    _startMarch();
    _drawOverlay();
}

/**
 * 選択範囲内のPixelを消去 (Deleteキー)
 */
export function deleteSelectionContent() {
    if (!state.selectionMask) return;
    const layer = getActiveLayer();
    if (!layer) return;
    _eraseSelection(layer);
    markLayerDirty(layer.id);
}
