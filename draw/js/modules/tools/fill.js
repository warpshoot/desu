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

export function floodFill(startX, startY, fillColor) {
    const { canvas, ctx } = getActiveContextAndCanvas();
    if (!canvas || !ctx) return;

    const w = canvas.width, h = canvas.height;

    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const idx = (startY * w + startX) * 4;
    const targetR = data[idx], targetG = data[idx + 1], targetB = data[idx + 2], targetA = data[idx + 3];

    if (targetR === fillColor[0] && targetG === fillColor[1] && targetB === fillColor[2] && targetA === fillColor[3]) return;

    const matchTarget = (i) => data[i] === targetR && data[i + 1] === targetG && data[i + 2] === targetB && data[i + 3] === targetA;
    const setPixel = (i) => {
        data[i] = fillColor[0];
        data[i + 1] = fillColor[1];
        data[i + 2] = fillColor[2];
        data[i + 3] = fillColor[3];
    };

    const stack = [[startX, startY]];

    while (stack.length > 0) {
        let [x, y] = stack.pop();
        let i = (y * w + x) * 4;

        while (x >= 0 && matchTarget(i)) {
            x--;
            i -= 4;
        }
        x++;
        i += 4;

        let spanAbove = false, spanBelow = false;

        while (x < w && matchTarget(i)) {
            setPixel(i);

            if (y > 0) {
                const above = i - w * 4;
                if (matchTarget(above)) {
                    if (!spanAbove) {
                        stack.push([x, y - 1]);
                        spanAbove = true;
                    }
                } else {
                    spanAbove = false;
                }
            }

            if (y < h - 1) {
                const below = i + w * 4;
                if (matchTarget(below)) {
                    if (!spanBelow) {
                        stack.push([x, y + 1]);
                        spanBelow = true;
                    }
                } else {
                    spanBelow = false;
                }
            }

            x++;
            i += 4;
        }
    }

    ctx.putImageData(imgData, 0, 0);
}

// 透明で塗りつぶし
export function floodFillTransparent(startX, startY) {
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
    const setPixel = (i) => {
        data[i + 3] = 0;
    };

    const stack = [[startX, startY]];

    while (stack.length > 0) {
        let [x, y] = stack.pop();
        let i = (y * w + x) * 4;

        while (x >= 0 && matchTarget(i)) {
            x--;
            i -= 4;
        }
        x++;
        i += 4;

        let spanAbove = false, spanBelow = false;

        while (x < w && matchTarget(i)) {
            setPixel(i);

            if (y > 0) {
                const above = i - w * 4;
                if (matchTarget(above)) {
                    if (!spanAbove) {
                        stack.push([x, y - 1]);
                        spanAbove = true;
                    }
                } else {
                    spanAbove = false;
                }
            }

            if (y < h - 1) {
                const below = i + w * 4;
                if (matchTarget(below)) {
                    if (!spanBelow) {
                        stack.push([x, y + 1]);
                        spanBelow = true;
                    }
                } else {
                    spanBelow = false;
                }
            }

            x++;
            i += 4;
        }
    }

    ctx.putImageData(imgData, 0, 0);
}

// 投げ縄で透明塗りつぶし（消しゴム用）
export function fillPolygonTransparent(points) {
    if (points.length < 3) return;

    const { canvas, ctx } = getActiveContextAndCanvas();
    if (!canvas || !ctx) return;

    const bounds = getBounds(points, canvas.width, canvas.height);

    if (bounds.width <= 0 || bounds.height <= 0) return;

    const imgData = ctx.getImageData(bounds.minX, bounds.minY, bounds.width, bounds.height);
    const data = imgData.data;

    for (let py = 0; py < bounds.height; py++) {
        for (let px = 0; px < bounds.width; px++) {
            const canvasX = bounds.minX + px;
            const canvasY = bounds.minY + py;

            if (isPointInPolygon(canvasX, canvasY, points)) {
                const i = (py * bounds.width + px) * 4;
                data[i + 3] = 0;
            }
        }
    }

    ctx.putImageData(imgData, bounds.minX, bounds.minY);
}

// Fill polygon with color (alpha compositing)
export function fillPolygonNoAA(points, r, g, b, alpha) {
    if (points.length < 3) return;

    const { canvas, ctx } = getActiveContextAndCanvas();
    if (!canvas || !ctx) return;

    const bounds = getBounds(points, canvas.width, canvas.height);

    if (bounds.width <= 0 || bounds.height <= 0) return;

    const imgData = ctx.getImageData(bounds.minX, bounds.minY, bounds.width, bounds.height);
    const data = imgData.data;

    for (let py = 0; py < bounds.height; py++) {
        for (let px = 0; px < bounds.width; px++) {
            const canvasX = bounds.minX + px;
            const canvasY = bounds.minY + py;

            if (isPointInPolygon(canvasX, canvasY, points)) {
                const i = (py * bounds.width + px) * 4;

                const dr = data[i];
                const dg = data[i + 1];
                const db = data[i + 2];
                const da = data[i + 3] / 255.0;

                const sr = r;
                const sg = g;
                const sb = b;
                const sa = alpha;

                const outA = sa + da * (1.0 - sa);

                if (outA > 0) {
                    const outR = (sr * sa + dr * da * (1.0 - sa)) / outA;
                    const outG = (sg * sa + dg * da * (1.0 - sa)) / outA;
                    const outB = (sb * sa + db * da * (1.0 - sa)) / outA;

                    data[i] = outR;
                    data[i + 1] = outG;
                    data[i + 2] = outB;
                    data[i + 3] = outA * 255.0;
                } else {
                    data[i + 3] = 0;
                }
            }
        }
    }

    ctx.putImageData(imgData, bounds.minX, bounds.minY);
}

// Sketch flood fill (semi-transparent grey with multiply blend)
export function floodFillSketch(startX, startY) {
    console.log('[DEBUG] floodFillSketch called with', startX, startY);
    const { canvas, ctx } = getActiveContextAndCanvas();
    if (!canvas || !ctx) {
        console.log('[DEBUG] No context, returning');
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

    const mask = new Uint8Array(w * h);
    const stack = [[startX, startY]];
    let iterations = 0;
    while (stack.length > 0 && iterations < w * h) {
        iterations++;
        let [x, y] = stack.pop();
        let i = (y * w + x) * 4;

        while (x >= 0 && matchTarget(i) && mask[y * w + x] === 0) {
            x--;
            i -= 4;
        }
        x++;
        i += 4;

        let spanAbove = false, spanBelow = false;
        while (x < w && matchTarget(i) && mask[y * w + x] === 0) {
            mask[y * w + x] = 255;
            if (y > 0) {
                const aboveIdx = ((y - 1) * w + x) * 4;
                if (!spanAbove && matchTarget(aboveIdx) && mask[(y - 1) * w + x] === 0) {
                    stack.push([x, y - 1]);
                    spanAbove = true;
                } else if (spanAbove && (!matchTarget(aboveIdx) || mask[(y - 1) * w + x] !== 0)) {
                    spanAbove = false;
                }
            }
            if (y < h - 1) {
                const belowIdx = ((y + 1) * w + x) * 4;
                if (!spanBelow && matchTarget(belowIdx) && mask[(y + 1) * w + x] === 0) {
                    stack.push([x, y + 1]);
                    spanBelow = true;
                } else if (spanBelow && (!matchTarget(belowIdx) || mask[(y + 1) * w + x] !== 0)) {
                    spanBelow = false;
                }
            }
            x++;
            i += 4;
        }
    }

    console.log('[DEBUG] Flood fill complete, creating result');

    // Create a temporary canvas for the final result
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = w;
    resultCanvas.height = h;
    const resultCtx = resultCanvas.getContext('2d');

    // 1. Fill result with solid semi-transparent grey
    resultCtx.fillStyle = '#808080';
    resultCtx.globalAlpha = 0.5;
    resultCtx.fillRect(0, 0, w, h);

    // 2. Apply the mask using destination-in
    const tempMaskCanvas = document.createElement('canvas');
    tempMaskCanvas.width = w;
    tempMaskCanvas.height = h;
    const tempMaskCtx = tempMaskCanvas.getContext('2d');
    const maskImgData = tempMaskCtx.createImageData(w, h);
    const mData = maskImgData.data;

    for (let i = 0; i < mask.length; i++) {
        if (mask[i] === 255) {
            const idx = i * 4;
            mData[idx] = 0;
            mData[idx + 1] = 0;
            mData[idx + 2] = 0;
            mData[idx + 3] = 255;
        }
    }
    tempMaskCtx.putImageData(maskImgData, 0, 0);

    resultCtx.globalAlpha = 1.0;
    resultCtx.globalCompositeOperation = 'destination-in';
    resultCtx.drawImage(tempMaskCanvas, 0, 0);

    // 3. Composite to active layer using multiply
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(resultCanvas, 0, 0);
    ctx.restore();

    console.log('[DEBUG] floodFillSketch complete');
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
