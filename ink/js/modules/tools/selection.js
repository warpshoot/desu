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
    getActiveLayerCanvas
} from '../state.js';
import { getCanvasPoint, isPointInPolygon } from '../utils.js';

// ============================================
// DOM refs — select-overlay canvas
// ============================================

let _overlayCanvas = null;
let _overlayCtx    = null;

export function initSelectionOverlay() {
    _overlayCanvas = document.getElementById('select-overlay');
    if (_overlayCanvas) {
        _overlayCtx = _overlayCanvas.getContext('2d');
    }
}

export function resizeSelectionOverlay() {
    if (!_overlayCanvas) return;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    _overlayCanvas.width  = vw * dpr;
    _overlayCanvas.height = vh * dpr;
    _overlayCanvas.style.width  = vw + 'px';
    _overlayCanvas.style.height = vh + 'px';
    if (_overlayCtx) {
        _overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
        _overlayCtx.scale(dpr, dpr);
    }
    // If selection is active, redraw overlay immediately
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

function _drawOverlay() {
    if (!_overlayCtx || !_overlayCanvas) return;
    const ctx = _overlayCtx;
    ctx.clearRect(0, 0, _overlayCanvas.width, _overlayCanvas.height);

    const mask = state.selectionMask;
    if (!mask) return;

    // --- Draw floating selection preview (if moving) ---
    if (state.floatingSelection) {
        const fs = state.floatingSelection;
        const tl = _toScreen(fs.srcX + fs.offsetX, fs.srcY + fs.offsetY);
        const br = _toScreen(fs.srcX + fs.offsetX + fs.w, fs.srcY + fs.offsetY + fs.h);
        const sw = br.x - tl.x;
        const sh = br.y - tl.y;
        if (sw > 0 && sh > 0) {
            // Draw the floating imageData scaled to screen
            const tmp = document.createElement('canvas');
            tmp.width  = fs.imageData.width;
            tmp.height = fs.imageData.height;
            tmp.getContext('2d').putImageData(fs.imageData, 0, 0);
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(tmp, tl.x, tl.y, sw, sh);
            ctx.restore();

            // Update mask to float position for ants
            _drawAnts(ctx, {
                type: 'rect',
                rect: {
                    x: fs.srcX + fs.offsetX,
                    y: fs.srcY + fs.offsetY,
                    w: fs.w,
                    h: fs.h
                }
            });
            return;
        }
    }

    // --- Draw marching ants for selection ---
    _drawAnts(ctx, mask);
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
}

export function finishRectSelect() {
    if (!state.selectionMask) return;
    const { w, h } = state.selectionMask.rect;
    if (w < 3 || h < 3) {
        clearSelection();
        return;
    }
    _rectStart = null;
    _invalidateMaskCache();
    _startMarch();
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

    _invalidateMaskCache();
    _startMarch();
}

// ============================================
// Clear Selection
// ============================================

export function clearSelection() {
    _stopMarch();
    state.selectionMask = null;
    state.floatingSelection = null;
    _maskBitmap = null;
    _rectStart = null;
    _lassoPoints = [];
    if (_overlayCtx && _overlayCanvas) {
        _overlayCtx.clearRect(0, 0, _overlayCanvas.width, _overlayCanvas.height);
    }
}

// ============================================
// Selection Clip — Post-process
// ============================================
// 描画完了後に選択範囲外のピクセルを元に戻す方式。
// drawingツール側を変更せずにクリッピングを実現。

let _maskBitmap = null;  // 選択マスク (GPU側、再利用)
let _preDrawBitmap = null; // 描画前スナップショット

function _invalidateMaskCache() {
    _maskBitmap = null;
}

async function _buildMaskBitmap(physW, physH) {
    const mc  = document.createElement('canvas');
    mc.width  = physW;
    mc.height = physH;
    const mctx = mc.getContext('2d');
    const dpr  = window.devicePixelRatio || 1;

    mctx.fillStyle = '#fff';

    const mask = state.selectionMask;
    if (mask.type === 'rect') {
        const { x, y, w, h } = mask.rect;
        mctx.fillRect(x * dpr, y * dpr, w * dpr, h * dpr);
    } else if (mask.type === 'lasso' && mask.points) {
        const pts = mask.points;
        mctx.beginPath();
        mctx.moveTo(pts[0].x * dpr, pts[0].y * dpr);
        for (let i = 1; i < pts.length; i++) {
            mctx.lineTo(pts[i].x * dpr, pts[i].y * dpr);
        }
        mctx.closePath();
        mctx.fill();
    }

    _maskBitmap = await createImageBitmap(mc);
}

/**
 * 描画開始前に呼ぶ。アクティブレイヤーのスナップショットを保存。
 */
export async function capturePreDraw() {
    if (!state.selectionMask) return;
    const layer = getActiveLayer();
    if (!layer) return;
    _preDrawBitmap = await createImageBitmap(layer.canvas);
}

/**
 * 描画完了後に呼ぶ。選択範囲外のピクセルを元に戻す。
 */
export async function applySelectionClip() {
    if (!state.selectionMask || !_preDrawBitmap) return;

    const layer = getActiveLayer();
    if (!layer) return;

    const { canvas, ctx } = layer;
    const dpr  = window.devicePixelRatio || 1;
    const pw   = canvas.width;
    const ph   = canvas.height;
    const cssW = pw / dpr;
    const cssH = ph / dpr;

    // Build mask if needed
    if (!_maskBitmap) {
        await _buildMaskBitmap(pw, ph);
    }

    // 1. 現在の描画結果を temp canvas に取り込む
    const tmp  = document.createElement('canvas');
    tmp.width  = pw;
    tmp.height = ph;
    const tctx = tmp.getContext('2d');
    tctx.drawImage(canvas, 0, 0);

    // 2. temp を選択マスクで切り抜く (destination-in)
    tctx.save();
    tctx.globalCompositeOperation = 'destination-in';
    tctx.drawImage(_maskBitmap, 0, 0);
    tctx.restore();

    // 3. レイヤーを描画前スナップショットに戻す
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, pw, ph);
    ctx.drawImage(_preDrawBitmap, 0, 0);

    // 4. マスク済みの描画結果を上に合成
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();

    _preDrawBitmap = null;
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
    const dpr  = window.devicePixelRatio || 1;
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

    const imgData = ctx.getImageData(physX, physY, physW, physH);

    // If lasso: zero out pixels outside the lasso polygon within the bounding box
    if (mask.type === 'lasso' && mask.points) {
        const data = imgData.data;
        for (let py = 0; py < physH; py++) {
            for (let px = 0; px < physW; px++) {
                const cx = x0 + px / dpr;
                const cy = y0 + py / dpr;
                if (!isPointInPolygon(cx, cy, mask.points)) {
                    const i = (py * physW + px) * 4;
                    data[i + 3] = 0; // transparent
                }
            }
        }
    }

    state.floatingSelection = {
        imageData: imgData,
        srcX: x0,
        srcY: y0,
        w: w0,
        h: h0,
        offsetX: 0,
        offsetY: 0
    };

    // Erase source pixels if cutting
    if (cut) {
        _eraseSelection(layer);
    }
}

function _eraseSelection(layer) {
    const { ctx } = layer;
    const mask = state.selectionMask;
    const dpr  = window.devicePixelRatio || 1;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';

    if (mask.type === 'rect') {
        const { x, y, w, h } = mask.rect;
        ctx.fillRect(x * dpr, y * dpr, w * dpr, h * dpr);
    } else if (mask.type === 'lasso' && mask.points) {
        ctx.beginPath();
        ctx.moveTo(mask.points[0].x * dpr, mask.points[0].y * dpr);
        for (let i = 1; i < mask.points.length; i++) {
            ctx.lineTo(mask.points[i].x * dpr, mask.points[i].y * dpr);
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
}

/**
 * 浮島をアクティブレイヤーに確定コミット
 */
export function commitFloating() {
    if (!state.floatingSelection) return;

    const layer = getActiveLayer();
    if (!layer) return;

    const { ctx } = layer;
    const fs  = state.floatingSelection;
    const dpr = window.devicePixelRatio || 1;

    // ImageData を temp canvas に書き出し、layer ctx に drawImage で貼る
    const tmp  = document.createElement('canvas');
    tmp.width  = fs.imageData.width;
    tmp.height = fs.imageData.height;
    tmp.getContext('2d').putImageData(fs.imageData, 0, 0);

    const destX = fs.srcX + fs.offsetX;
    const destY = fs.srcY + fs.offsetY;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, Math.round(destX * dpr), Math.round(destY * dpr));
    ctx.restore();

    state.floatingSelection = null;

    // 選択マスクを移動先に追従
    if (state.selectionMask) {
        if (state.selectionMask.type === 'rect') {
            state.selectionMask.rect.x += fs.offsetX;
            state.selectionMask.rect.y += fs.offsetY;
        } else if (state.selectionMask.type === 'lasso' && state.selectionMask.points) {
            state.selectionMask.points = state.selectionMask.points.map(p => ({
                x: p.x + fs.offsetX,
                y: p.y + fs.offsetY
            }));
        }
        _invalidateMaskCache();
    }

    _drawOverlay();
}

// ============================================
// Copy / Paste (app-internal clipboard)
// ============================================

export function copySelection() {
    if (!state.selectionMask) return;

    if (state.floatingSelection) {
        // Floating selection means pixels are currently in the float buffer
        // Clone it so the clipboard owns a clean copy
        const src = state.floatingSelection.imageData;
        const cloned = new ImageData(
            new Uint8ClampedArray(src.data),
            src.width,
            src.height
        );
        const dpr = window.devicePixelRatio || 1;
        state._selectionClipboard = {
            imageData: cloned,
            w: src.width / dpr,
            h: src.height / dpr
        };
        return;
    }

    const layer = getActiveLayer();
    if (!layer) return;

    const { canvas, ctx } = layer;
    const dpr  = window.devicePixelRatio || 1;
    const mask = state.selectionMask;

    let x0, y0, w0, h0;
    if (mask.type === 'rect') {
        ({ x: x0, y: y0, w: w0, h: h0 } = mask.rect);
    } else {
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

    const imgData = ctx.getImageData(physX, physY, physW, physH);

    // Mask lasso shape
    if (mask.type === 'lasso' && mask.points) {
        const data = imgData.data;
        for (let py = 0; py < physH; py++) {
            for (let px = 0; px < physW; px++) {
                const cx = x0 + px / dpr;
                const cy = y0 + py / dpr;
                if (!isPointInPolygon(cx, cy, mask.points)) {
                    data[(py * physW + px) * 4 + 3] = 0;
                }
            }
        }
    }

    state._selectionClipboard = {
        imageData: imgData,
        w: w0,
        h: h0
    };
}

export function pasteFromClipboard() {
    if (!state._selectionClipboard) return;
    const cb = state._selectionClipboard;

    // Cancel any current floating selection
    if (state.floatingSelection) {
        commitFloating();
    }

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
    _invalidateMaskCache();

    // Clone ImageData
    const dpr  = window.devicePixelRatio || 1;
    const physW = Math.round(cb.w * dpr);
    const physH = Math.round(cb.h * dpr);
    const cloned = new ImageData(
        new Uint8ClampedArray(cb.imageData.data),
        cb.imageData.width,
        cb.imageData.height
    );

    state.floatingSelection = {
        imageData: cloned,
        srcX: pasteX,
        srcY: pasteY,
        w: cb.w,
        h: cb.h,
        offsetX: 0,
        offsetY: 0
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
}
