import {
    state,
    lassoCanvas,
    lassoCtx,
    getActiveLayerCtx,
    getActiveLayerCanvas
} from '../state.js';
import { getCanvasPoint, getBounds, isPointInPolygon } from '../utils.js';

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
// 塗りつぶし（スキャンライン法）
// ============================================

/**
 * 境界ピクセルをボックス膨張させて隙間を閉じるマスクを生成する。
 * セパラブル処理（横→縦）で O(w×h) の高速実装。
 * @returns {Uint8Array} 1=境界(通行不可), 0=通行可能
 */
function dilateBox(boundary, w, h, radius) {
    const temp = new Uint8Array(w * h);

    // 横方向パス（プレフィックスサム）
    for (let y = 0; y < h; y++) {
        const prefix = new Int32Array(w + 1);
        for (let x = 0; x < w; x++) {
            prefix[x + 1] = prefix[x] + boundary[y * w + x];
        }
        for (let x = 0; x < w; x++) {
            const l = Math.max(0, x - radius);
            const r = Math.min(w, x + radius + 1);
            if (prefix[r] - prefix[l] > 0) temp[y * w + x] = 1;
        }
    }

    // 縦方向パス（プレフィックスサム）
    const result = new Uint8Array(w * h);
    for (let x = 0; x < w; x++) {
        const prefix = new Int32Array(h + 1);
        for (let y = 0; y < h; y++) {
            prefix[y + 1] = prefix[y] + temp[y * w + x];
        }
        for (let y = 0; y < h; y++) {
            const t = Math.max(0, y - radius);
            const b = Math.min(h, y + radius + 1);
            if (prefix[b] - prefix[t] > 0) result[y * w + x] = 1;
        }
    }

    return result;
}

/**
 * スキャンライン塗りつぶし共通処理。
 * closedBoundary が null のときは matchFn のみで判定（高速パス）。
 * closedBoundary があるときは visited 配列を使って隙間越え塗りを行い、
 * 実際に色を変えるのは matchFn が真の元ピクセルのみ。
 */
function runScanline(w, h, startX, startY, matchFn, setFn, closedBoundary) {
    const useGap = closedBoundary !== null;
    const visited = useGap ? new Uint8Array(w * h) : null;

    const passable = useGap
        ? (x, y) => x >= 0 && x < w && y >= 0 && y < h && !closedBoundary[y * w + x] && !visited[y * w + x]
        : (x, y) => x >= 0 && x < w && y >= 0 && y < h && matchFn((y * w + x) * 4);

    // 開始点チェック
    if (!passable(startX, startY)) return null;

    const stack = [[startX, startY]];
    let minX = startX, minY = startY, maxX = startX, maxY = startY;

    while (stack.length > 0) {
        let [x, y] = stack.pop();
        if (!passable(x, y)) continue;

        // 左端を探す
        while (x > 0 && passable(x - 1, y)) x--;

        let spanAbove = false, spanBelow = false;

        while (x < w && passable(x, y)) {
            if (visited) visited[y * w + x] = 1;

            // 実ピクセルが対象に一致する場合のみ塗る
            const i = (y * w + x) * 4;
            if (!useGap || matchFn(i)) {
                setFn(i);
                // 範囲更新
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }

            if (y > 0) {
                if (passable(x, y - 1)) {
                    if (!spanAbove) { stack.push([x, y - 1]); spanAbove = true; }
                } else {
                    spanAbove = false;
                }
            }

            if (y < h - 1) {
                if (passable(x, y + 1)) {
                    if (!spanBelow) { stack.push([x, y + 1]); spanBelow = true; }
                } else {
                    spanBelow = false;
                }
            }

            x++;
        }
    }

    return { minX, minY, maxX, maxY };
}

export function floodFill(startX, startY, fillColor, colorTolerance = 0, gapClose = 0) {
    const { canvas, ctx } = getActiveContextAndCanvas();
    if (!canvas || !ctx) return;

    const w = canvas.width, h = canvas.height;

    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const idx = (startY * w + startX) * 4;
    const targetR = data[idx], targetG = data[idx + 1], targetB = data[idx + 2], targetA = data[idx + 3];

    // 許容範囲なしで既に同色なら何もしない
    if (colorTolerance === 0 &&
        targetR === fillColor[0] && targetG === fillColor[1] &&
        targetB === fillColor[2] && targetA === fillColor[3]) return;

    // 色マッチ関数（許容範囲対応）
    const tol2 = colorTolerance * colorTolerance * 4; // 4チャンネル分スケール
    const matchTarget = colorTolerance === 0
        ? (i) => data[i] === targetR && data[i + 1] === targetG && data[i + 2] === targetB && data[i + 3] === targetA
        : (i) => {
            const dr = data[i] - targetR, dg = data[i + 1] - targetG;
            const db = data[i + 2] - targetB, da = data[i + 3] - targetA;
            return (dr * dr + dg * dg + db * db + da * da) <= tol2;
        };

    const setPixel = (i) => {
        data[i] = fillColor[0]; data[i + 1] = fillColor[1];
        data[i + 2] = fillColor[2]; data[i + 3] = fillColor[3];
    };

    // 隙間閉じ用のクローズド境界を生成
    let closedBoundary = null;
    if (gapClose > 0) {
        const radius = Math.ceil(gapClose / 2);
        const boundary = new Uint8Array(w * h);
        for (let j = 0; j < w * h; j++) {
            if (!matchTarget(j * 4)) boundary[j] = 1;
        }
        closedBoundary = dilateBox(boundary, w, h, radius);
    }

    const bounds = runScanline(w, h, startX, startY, matchTarget, setPixel, closedBoundary);

    if (bounds) {
        // 書き戻し範囲を限定することで、無関係な領域のピクセル劣化を防ぐ
        const bw = bounds.maxX - bounds.minX + 1;
        const bh = bounds.maxY - bounds.minY + 1;
        ctx.putImageData(imgData, 0, 0, bounds.minX, bounds.minY, bw, bh);
    }
}

// 透明で塗りつぶし
export function floodFillTransparent(startX, startY, gapClose = 0) {
    const { canvas, ctx } = getActiveContextAndCanvas();
    if (!canvas || !ctx) return;

    const w = canvas.width, h = canvas.height;

    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const idx = (startY * w + startX) * 4;
    const targetR = data[idx], targetG = data[idx + 1], targetB = data[idx + 2], targetA = data[idx + 3];

    if (targetA === 0) return;

    const matchTarget = (i) => data[i] === targetR && data[i + 1] === targetG && data[i + 2] === targetB && data[i + 3] === targetA;
    const setPixel = (i) => { data[i + 3] = 0; };

    let closedBoundary = null;
    if (gapClose > 0) {
        const radius = Math.ceil(gapClose / 2);
        const boundary = new Uint8Array(w * h);
        for (let j = 0; j < w * h; j++) {
            if (!matchTarget(j * 4)) boundary[j] = 1;
        }
        closedBoundary = dilateBox(boundary, w, h, radius);
    }

    const bounds = runScanline(w, h, startX, startY, matchTarget, setPixel, closedBoundary);

    if (bounds) {
        const bw = bounds.maxX - bounds.minX + 1;
        const bh = bounds.maxY - bounds.minY + 1;
        ctx.putImageData(imgData, 0, 0, bounds.minX, bounds.minY, bw, bh);
    }
}

// 投げ縄で透明塗りつぶし（消しゴム用）
export function fillPolygonTransparent(points) {
    if (points.length < 3) return;

    const { canvas, ctx } = getActiveContextAndCanvas();
    if (!canvas || !ctx) return;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000'; // Color doesn't matter for destination-out
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// Fill polygon with color (alpha compositing)
export function fillPolygonNoAA(points, r, g, b, alpha) {
    if (points.length < 3) return;

    const { canvas, ctx } = getActiveContextAndCanvas();
    if (!canvas || !ctx) return;

    const bounds = getBounds(points, canvas.width, canvas.height);
    if (bounds.width <= 0 || bounds.height <= 0) return;

    // Create a temporary offscreen canvas for the shape
    // This allows us to use native blending and avoid putImageData bit-rot on background pixels
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = bounds.width;
    tempCanvas.height = bounds.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Generate the mask/shape on temporary canvas
    const imgData = tempCtx.createImageData(bounds.width, bounds.height);
    const data = imgData.data;

    for (let py = 0; py < bounds.height; py++) {
        for (let px = 0; px < bounds.width; px++) {
            const canvasX = bounds.minX + px;
            const canvasY = bounds.minY + py;

            if (isPointInPolygon(canvasX, canvasY, points)) {
                const i = (py * bounds.width + px) * 4;
                data[i] = r;
                data[i + 1] = g;
                data[i + 2] = b;
                data[i + 3] = alpha * 255;
            }
        }
    }

    tempCtx.putImageData(imgData, 0, 0);

    // Draw the temporary canvas to the main context
    // This uses native hardware-accelerated blending
    ctx.drawImage(tempCanvas, bounds.minX, bounds.minY);
}

// Sketch flood fill (semi-transparent grey with multiply blend)
export function floodFillSketch(startX, startY, gapClose = 0) {
    const { canvas, ctx } = getActiveContextAndCanvas();
    if (!canvas || !ctx) {
        return;
    }

    const w = canvas.width, h = canvas.height;
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const idx = (startY * w + startX) * 4;
    const targetR = data[idx];
    const targetG = data[idx + 1];
    const targetB = data[idx + 2];
    const targetA = data[idx + 3];

    const matchTarget = (i) => data[i] === targetR && data[i + 1] === targetG && data[i + 2] === targetB && data[i + 3] === targetA;

    // 隙間閉じ用クローズド境界
    let closedBoundary = null;
    if (gapClose > 0) {
        const radius = Math.ceil(gapClose / 2);
        const boundary = new Uint8Array(w * h);
        for (let j = 0; j < w * h; j++) {
            if (!matchTarget(j * 4)) boundary[j] = 1;
        }
        closedBoundary = dilateBox(boundary, w, h, radius);
    }

    const mask = new Uint8Array(w * h);
    const setMask = (i) => { mask[i / 4] = 255; };
    const bounds = runScanline(w, h, startX, startY, matchTarget, setMask, closedBoundary);

    if (!bounds) return;

    const bw = bounds.maxX - bounds.minX + 1;
    const bh = bounds.maxY - bounds.minY + 1;

    // Create a temporary canvas for the final result
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = bw;
    resultCanvas.height = bh;
    const resultCtx = resultCanvas.getContext('2d');

    // 1. Fill result with solid semi-transparent grey
    resultCtx.fillStyle = '#808080';
    resultCtx.globalAlpha = 0.5;
    resultCtx.fillRect(0, 0, bw, bh);

    // 2. Apply the mask using destination-in
    const tempMaskCanvas = document.createElement('canvas');
    tempMaskCanvas.width = bw;
    tempMaskCanvas.height = bh;
    const tempMaskCtx = tempMaskCanvas.getContext('2d');
    const maskImgData = tempMaskCtx.createImageData(bw, bh);
    const mData = maskImgData.data;

    for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
            const gy = bounds.minY + y;
            const gx = bounds.minX + x;
            if (mask[gy * w + gx] === 255) {
                const midx = (y * bw + x) * 4;
                mData[midx + 3] = 255;
            }
        }
    }
    tempMaskCtx.putImageData(maskImgData, 0, 0);

    resultCtx.globalAlpha = 1.0;
    resultCtx.globalCompositeOperation = 'destination-in';
    resultCtx.drawImage(tempMaskCanvas, 0, 0);

    // 3. Composite to active layer using multiply
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(resultCanvas, bounds.minX, bounds.minY);
    ctx.restore();
}

export function fillPolygon(points) {
    if (points.length < 3) return;

    // Use black for fill tool, semi-transparent grey with multiply for sketch tool
    if (state.currentTool === 'sketch') {
        // Semi-transparent grey fill with multiply blend for sketch mode
        const ctx = getActiveLayerCtx();
        if (!ctx) return;
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#808080';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    } else {
        // Black fill for fill tool
        fillPolygonNoAA(points, 0, 0, 0, 1.0);
    }
}

// ============================================
// 投げ縄ツール制御
// ============================================

export function startLasso(x, y) {
    state.isLassoing = true;
    state.lassoPoints = [{ x, y }];
    lassoCanvas.style.display = 'block';
    lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
}

export function updateLasso(x, y) {
    if (!state.isLassoing) return;

    state.lassoPoints.push({ x, y });

    // 青い線で軌跡を描画
    lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
    lassoCtx.strokeStyle = '#0066ff';
    lassoCtx.lineWidth = 2;
    lassoCtx.beginPath();
    lassoCtx.moveTo(state.lassoPoints[0].x, state.lassoPoints[0].y);
    for (let i = 1; i < state.lassoPoints.length; i++) {
        lassoCtx.lineTo(state.lassoPoints[i].x, state.lassoPoints[i].y);
    }
    // 始点に戻る線（プレビュー）
    lassoCtx.lineTo(state.lassoPoints[0].x, state.lassoPoints[0].y);
    lassoCtx.stroke();
}

export function finishLasso() {
    if (!state.isLassoing || state.lassoPoints.length < 3) {
        state.isLassoing = false;
        state.lassoPoints = [];
        lassoCanvas.style.display = 'none';
        return null;
    }

    // 画面座標からキャンバス座標に変換
    const canvasPoints = state.lassoPoints.map(p => getCanvasPoint(p.x, p.y));

    // 状態リセット
    state.isLassoing = false;
    state.lassoPoints = [];
    lassoCanvas.style.display = 'none';
    lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);

    return canvasPoints;
}
