import {
    state,
    getActiveLayer,
    getActiveLayerCtx,
    getActiveLayerCanvas,
    CANVAS_DPR
} from '../state.js';
import { getBounds, isPointInPolygon } from '../utils.js';
import { markLayerDirty } from '../history.js';
import { getCurrentTonePreset, getTonePattern } from './tonePresets.js';

/**
 * Get active layer's canvas and context
 */
function getActiveContextAndCanvas() {
    return {
        canvas: getActiveLayerCanvas(),
        ctx: getActiveLayerCtx()
    };
}

// ============================================
// Flood Fill (Pixel-based)
// ============================================

/**
 * トレランス判定関数の作成
 */
function _makeMatchFn(data, targetA, tolerance) {
    if (tolerance === 'strict') return (i) => data[i + 3] === targetA;
    if (tolerance === 'normal') {
        return targetA < 128 ? (i) => data[i + 3] < 128 : (i) => data[i + 3] >= 128;
    }
    return targetA < 240 ? (i) => data[i + 3] < 240 : (i) => data[i + 3] >= 240;
}

/**
 * 境界ピクセルを膨張して隙間を閉じる
 */
export function dilateBox(boundary, w, h, radius) {
    const temp = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
        const prefix = new Int32Array(w + 1);
        for (let x = 0; x < w; x++) prefix[x + 1] = prefix[x] + boundary[y * w + x];
        for (let x = 0; x < w; x++) {
            if (prefix[Math.min(w, x + radius + 1)] - prefix[Math.max(0, x - radius)] > 0) temp[y * w + x] = 1;
        }
    }
    const result = new Uint8Array(w * h);
    for (let x = 0; x < w; x++) {
        const prefix = new Int32Array(h + 1);
        for (let y = 0; y < h; y++) prefix[y + 1] = prefix[y] + temp[y * w + x];
        for (let y = 0; y < h; y++) {
            if (prefix[Math.min(h, y + radius + 1)] - prefix[Math.max(0, y - radius)] > 0) result[y * w + x] = 1;
        }
    }
    return result;
}

/**
 * フラッドフィル共通コア (scanline + gap-close)
 */
function _floodFill(data, w, h, startX, startY, targetA, tolerance, gapClose, setPixel) {
    const matchTarget = _makeMatchFn(data, targetA, tolerance);
    const visited = new Uint8Array(w * h);
    let closedBoundary = null;
    let gapRadius = 0;
    if (gapClose > 0) {
        gapRadius = Math.ceil(gapClose / 2 * CANVAS_DPR);
        const boundary = new Uint8Array(w * h);
        for (let j = 0; j < w * h; j++) if (!matchTarget(j * 4)) boundary[j] = 1;
        closedBoundary = dilateBox(boundary, w, h, gapRadius);
    }

    const isPassable = closedBoundary
        ? (x, y) => !closedBoundary[y * w + x] && !visited[y * w + x]
        : (x, y) => matchTarget((y * w + x) * 4) && !visited[y * w + x];

    if (!isPassable(startX, startY)) return;

    const stack = [[startX, startY]];
    while (stack.length > 0) {
        let [x, y] = stack.pop();
        if (!isPassable(x, y)) continue;
        while (x > 0 && isPassable(x - 1, y)) x--;
        let spanAbove = false, spanBelow = false;
        while (x < w && isPassable(x, y)) {
            visited[y * w + x] = 1;
            setPixel((y * w + x) * 4);
            if (y > 0 && isPassable(x, y - 1)) {
                if (!spanAbove) { stack.push([x, y - 1]); spanAbove = true; }
            } else spanAbove = false;
            if (y < h - 1 && isPassable(x, y + 1)) {
                if (!spanBelow) { stack.push([x, y + 1]); spanBelow = true; }
            } else spanBelow = false;
            x++;
        }
    }

    if (closedBoundary) {
        const expandedVisited = dilateBox(visited, w, h, gapRadius);
        for (let j = 0; j < w * h; j++) if (expandedVisited[j] && matchTarget(j * 4)) setPixel(j * 4);
    }
}

/**
 * カラー塗りつぶし (バケツ)
 */
export function bucketFillColor(startX, startY, fillColor, tolerance = 'normal', gapClose = 0) {
    const { canvas, ctx } = getActiveContextAndCanvas();
    if (!canvas || !ctx) return;

    const dpr = CANVAS_DPR;
    startX = Math.round(startX * dpr);
    startY = Math.round(startY * dpr);
    const w = canvas.width, h = canvas.height;
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const idx = (startY * w + startX) * 4;
    if (data[idx] === fillColor[0] && data[idx + 1] === fillColor[1] &&
        data[idx + 2] === fillColor[2] && data[idx + 3] === fillColor[3]) return;

    _floodFill(data, w, h, startX, startY, data[idx + 3], tolerance, gapClose,
        (i) => { data[i] = fillColor[0]; data[i+1] = fillColor[1]; data[i+2] = fillColor[2]; data[i+3] = fillColor[3]; });
    _applyImageData(ctx, imgData);
}

/**
 * 透明塗りつぶし (バケツ)
 */
export function bucketFillTransparent(startX, startY, tolerance = 'normal', gapClose = 0) {
    const { canvas, ctx } = getActiveContextAndCanvas();
    if (!canvas || !ctx) return;

    const dpr = CANVAS_DPR;
    startX = Math.round(startX * dpr);
    startY = Math.round(startY * dpr);
    const w = canvas.width, h = canvas.height;
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const targetA = data[(startY * w + startX) * 4 + 3];
    if (targetA === 0) return;

    _floodFill(data, w, h, startX, startY, targetA, tolerance, gapClose,
        (i) => { data[i] = 0; data[i+1] = 0; data[i+2] = 0; data[i+3] = 0; });
    _applyImageData(ctx, imgData);
}

/**
 * トーン塗りつぶし (バケツ)
 */
export function bucketFillTone(startX, startY, tolerance = 'normal') {
    const { canvas, ctx } = getActiveContextAndCanvas();
    if (!canvas || !ctx) return;

    const dpr = CANVAS_DPR;
    startX = Math.round(startX * dpr);
    startY = Math.round(startY * dpr);
    const w = canvas.width, h = canvas.height;
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const matchTarget = _makeMatchFn(data, data[(startY * w + startX) * 4 + 3], tolerance);

    const mask = new Uint8Array(w * h);
    let minX = startX, minY = startY, maxX = startX, maxY = startY;
    const stack = [[startX, startY]];

    while (stack.length > 0) {
        let [x, y] = stack.pop();
        let i = (y * w + x) * 4;
        while (x >= 0 && matchTarget(i) && mask[y * w + x] === 0) { x--; i -= 4; }
        x++; i += 4;
        let spanAbove = false, spanBelow = false;
        while (x < w && matchTarget(i) && mask[y * w + x] === 0) {
            mask[y * w + x] = 1;
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            if (y > 0) {
                if (matchTarget(i - w * 4) && mask[(y - 1) * w + x] === 0) {
                    if (!spanAbove) { stack.push([x, y - 1]); spanAbove = true; }
                } else spanAbove = false;
            }
            if (y < h - 1) {
                if (matchTarget(i + w * 4) && mask[(y + 1) * w + x] === 0) {
                    if (!spanBelow) { stack.push([x, y + 1]); spanBelow = true; }
                } else spanBelow = false;
            }
            x++; i += 4;
        }
    }

    if (minX > maxX) return;

    const regionW = maxX - minX + 1, regionH = maxY - minY + 1;
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = regionW; resultCanvas.height = regionH;
    const resultCtx = resultCanvas.getContext('2d');

    resultCtx.fillStyle = '#000000';
    resultCtx.save();
    resultCtx.translate(-minX, -minY);
    _drawToneInRegion(resultCtx, minX, minY, maxX, maxY, getCurrentTonePreset());
    resultCtx.restore();

    resultCtx.globalCompositeOperation = 'destination-in';
    const tempMask = document.createElement('canvas');
    tempMask.width = regionW; tempMask.height = regionH;
    const tempMaskCtx = tempMask.getContext('2d');
    const maskData = tempMaskCtx.createImageData(regionW, regionH);
    for (let y = 0; y < regionH; y++) {
        for (let x = 0; x < regionW; x++) {
            if (mask[(minY + y) * w + (minX + x)] === 1) {
                const midx = (y * regionW + x) * 4;
                maskData.data[midx + 3] = 255;
            }
        }
    }
    tempMaskCtx.putImageData(maskData, 0, 0);
    resultCtx.drawImage(tempMask, 0, 0);

    binarizeCanvas(resultCtx, regionW, regionH);
    ctx.drawImage(resultCanvas, minX / dpr, minY / dpr, regionW / dpr, regionH / dpr);
    markLayerDirty(getActiveLayer().id);
}

// ============================================
// Lasso Fill (Polygon-based)
// ============================================

/**
 * カラー塗りつぶし (なげなわ) - No AA
 */
export function lassoFillColorNoAA(points, r, g, b, alpha) {
    if (points.length < 3) return;
    const { canvas, ctx } = getActiveContextAndCanvas();
    if (!canvas || !ctx) return;

    const dpr = CANVAS_DPR;
    const physicalPoints = points.map(p => ({ x: p.x * dpr, y: p.y * dpr }));
    const bounds = getBounds(physicalPoints, canvas.width, canvas.height);
    if (bounds.width <= 0 || bounds.height <= 0) return;

    const imgData = ctx.getImageData(bounds.minX, bounds.minY, bounds.width, bounds.height);
    const data = imgData.data;

    for (let py = 0; py < bounds.height; py++) {
        for (let px = 0; px < bounds.width; px++) {
            if (isPointInPolygon(bounds.minX + px, bounds.minY + py, physicalPoints)) {
                const i = (py * bounds.width + px) * 4;
                const dr = data[i], dg = data[i+1], db = data[i+2], da = data[i+3]/255.0;
                const sa = alpha;
                const outA = sa + da * (1.0 - sa);
                if (outA > 0) {
                    data[i] = (r * sa + dr * da * (1.0 - sa)) / outA;
                    data[i+1] = (g * sa + dg * da * (1.0 - sa)) / outA;
                    data[i+2] = (b * sa + db * da * (1.0 - sa)) / outA;
                    data[i+3] = outA * 255.0;
                } else data[i+3] = 0;
            }
        }
    }
    _applyImageData(ctx, imgData, bounds.minX, bounds.minY);
}

/**
 * カラー塗りつぶし (なげなわ) - With AA
 */
export function lassoFillColorWithAA(points, r, g, b, alpha) {
    if (points.length < 3) return;
    const ctx = getActiveLayerCtx();
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    markLayerDirty(getActiveLayer().id);
}

/**
 * 透明塗りつぶし (なげなわ)
 */
export function lassoFillTransparent(points, antiAlias = false) {
    if (points.length < 3) return;
    const { canvas, ctx } = getActiveContextAndCanvas();
    if (!canvas || !ctx) return;

    if (antiAlias) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    } else {
        const dpr = CANVAS_DPR;
        const physicalPoints = points.map(p => ({ x: p.x * dpr, y: p.y * dpr }));
        const bounds = getBounds(physicalPoints, canvas.width, canvas.height);
        if (bounds.width <= 0 || bounds.height <= 0) return;
        const imgData = ctx.getImageData(bounds.minX, bounds.minY, bounds.width, bounds.height);
        for (let py = 0; py < bounds.height; py++) {
            for (let px = 0; px < bounds.width; px++) {
                if (isPointInPolygon(bounds.minX + px, bounds.minY + py, physicalPoints)) {
                    imgData.data[(py * bounds.width + px) * 4 + 3] = 0;
                }
            }
        }
        _applyImageData(ctx, imgData, bounds.minX, bounds.minY);
    }
    markLayerDirty(getActiveLayer().id);
}

/**
 * トーン塗りつぶし (なげなわ)
 */
export function lassoFillTone(points) {
    if (points.length < 3) return;
    const ctx = getActiveLayerCtx();
    if (!ctx) return;
    const preset = getCurrentTonePreset();
    const dpr = CANVAS_DPR;
    const minX = Math.floor(Math.min(...points.map(p => p.x)));
    const minY = Math.floor(Math.min(...points.map(p => p.y)));
    const maxX = Math.ceil(Math.max(...points.map(p => p.x)));
    const maxY = Math.ceil(Math.max(...points.map(p => p.y)));
    const w = maxX - minX, h = maxY - minY;
    if (w <= 0 || h <= 0) return;

    const off = document.createElement('canvas');
    off.width = Math.ceil(w * dpr); off.height = Math.ceil(h * dpr);
    const offCtx = off.getContext('2d');
    offCtx.beginPath();
    offCtx.moveTo((points[0].x - minX) * dpr, (points[0].y - minY) * dpr);
    for (let i = 1; i < points.length; i++) offCtx.lineTo((points[i].x - minX) * dpr, (points[i].y - minY) * dpr);
    offCtx.closePath();
    offCtx.clip();
    offCtx.translate(-minX * dpr, -minY * dpr);
    offCtx.fillStyle = '#000000';
    _drawToneInRegion(offCtx, minX * dpr, minY * dpr, maxX * dpr, maxY * dpr, preset);
    binarizeCanvas(offCtx, off.width, off.height);
    ctx.drawImage(off, minX, minY, w, h);
    markLayerDirty(getActiveLayer().id);
}

// ============================================
// Unified Dispatchers
// ============================================

/**
 * なげなわ塗り実行
 */
export async function executeLassoFill(points, slot) {
    if (slot.subTool === 'tone') {
        lassoFillTone(points);
    } else if (state.mode === 'eraser') {
        lassoFillTransparent(points, slot.antiAlias);
    } else {
        if (slot.antiAlias) lassoFillColorWithAA(points, 0, 0, 0, slot.opacity ?? 1);
        else lassoFillColorNoAA(points, 0, 0, 0, slot.opacity ?? 1);
    }
}

/**
 * バケツ塗り実行
 */
export async function executeBucketFill(x, y, slot) {
    const tolerance = slot.bucketTolerance || 'normal';
    if (slot.subTool === 'tone') {
        bucketFillTone(x, y, tolerance);
    } else if (state.mode === 'eraser') {
        bucketFillTransparent(x, y, tolerance, slot.bucketGapClose ?? 0);
    } else {
        bucketFillColor(x, y, [0, 0, 0, Math.round((slot.opacity ?? 1) * 255)], tolerance, slot.bucketGapClose ?? 0);
    }
}

// ============================================
// Utilities
// ============================================

function _applyImageData(ctx, imgData, x = 0, y = 0) {
    const dpr = CANVAS_DPR;
    const temp = document.createElement('canvas');
    temp.width = imgData.width; temp.height = imgData.height;
    temp.getContext('2d').putImageData(imgData, 0, 0);
    ctx.clearRect(x / dpr, y / dpr, imgData.width / dpr, imgData.height / dpr);
    ctx.drawImage(temp, x / dpr, y / dpr, imgData.width / dpr, imgData.height / dpr);
    markLayerDirty(getActiveLayer().id);
}

function _drawToneInRegion(ctx, minX, minY, maxX, maxY, preset) {
    const pattern = getTonePattern(ctx, preset);
    if (!pattern) return;
    ctx.save();
    ctx.fillStyle = pattern;
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    ctx.restore();
}

function binarizeCanvas(ctx, width, height) {
    const imgData = ctx.getImageData(0, 0, width, height);
    for (let i = 0; i < imgData.data.length; i += 4) {
        if (imgData.data[i + 3] >= 1) {
            imgData.data[i] = 0; imgData.data[i + 1] = 0; imgData.data[i + 2] = 0; imgData.data[i + 3] = 255;
        } else imgData.data[i + 3] = 0;
    }
    ctx.putImageData(imgData, 0, 0);
}
