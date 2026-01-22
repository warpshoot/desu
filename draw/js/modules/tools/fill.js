
import {
    state,
    roughCanvas, roughCtx,
    fillCanvas, fillCtx,
    lineCanvas, lineCtx,
    lassoCanvas, lassoCtx
} from '../state.js';
import { getCanvasPoint, getBounds, isPointInPolygon } from '../utils.js';

// ============================================
// 塗りつぶし（スキャンライン法）
// ============================================

export function floodFill(startX, startY, fillColor) {
    // アクティブレイヤーに応じたcanvasとctxを選択
    // Note: fill layer uses a different context logic in some cases, but for bucket fill:
    const canvas = state.activeLayer === 'rough' ? roughCanvas : (state.activeLayer === 'fill' ? fillCanvas : lineCanvas);
    const ctx = state.activeLayer === 'rough' ? roughCtx : (state.activeLayer === 'fill' ? fillCtx : lineCtx);

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

// 透明で塗りつぶし（ペン入れレイヤー用）
export function floodFillTransparent(startX, startY) {
    // Only applies to line or fill layer technically, but original code used lineCanvas hardcoded for some reason?
    // Checking logic: "ペン入れレイヤー用" comment suggests it was for line layer clean up.
    // If active layer is fill, we should probably target fill canvas.
    const canvas = state.activeLayer === 'fill' ? fillCanvas : lineCanvas;
    const ctx = state.activeLayer === 'fill' ? fillCtx : lineCtx;

    const w = canvas.width, h = canvas.height;

    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const idx = (startY * w + startX) * 4;
    const targetR = data[idx], targetG = data[idx + 1], targetB = data[idx + 2], targetA = data[idx + 3];

    // 既に透明の場合は何もしない
    if (targetA === 0) return;

    const matchTarget = (i) => data[i] === targetR && data[i + 1] === targetG && data[i + 2] === targetB && data[i + 3] === targetA;
    const setPixel = (i) => {
        data[i + 3] = 0;  // alpha = 0 (透明)
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
    if (points.length < 3) {
        // console.log('fillPolygonTransparent: Not enough points');
        return;
    }

    // アクティブレイヤーを選択（ベタかペン入れ）
    const ctx = state.activeLayer === 'fill' ? fillCtx : lineCtx;
    const canvas = state.activeLayer === 'fill' ? fillCanvas : lineCanvas;

    // console.log('fillPolygonTransparent: points=', points.length, 'layer=', state.activeLayer);

    const bounds = getBounds(points, canvas.width, canvas.height);
    // console.log('fillPolygonTransparent: bounds=', bounds);

    if (bounds.width <= 0 || bounds.height <= 0) {
        // console.log('fillPolygonTransparent: Invalid bounds, skipping');
        return;
    }

    const imgData = ctx.getImageData(bounds.minX, bounds.minY, bounds.width, bounds.height);
    const data = imgData.data;
    let pixelsErased = 0;

    for (let py = 0; py < bounds.height; py++) {
        for (let px = 0; px < bounds.width; px++) {
            const canvasX = bounds.minX + px;
            const canvasY = bounds.minY + py;

            if (isPointInPolygon(canvasX, canvasY, points)) {
                const i = (py * bounds.width + px) * 4;
                // Set alpha to 0 (transparent)
                data[i + 3] = 0;
                pixelsErased++;
            }
        }
    }

    // console.log('fillPolygonTransparent: Erased', pixelsErased, 'pixels');
    ctx.putImageData(imgData, bounds.minX, bounds.minY);
    // console.log('fillPolygonTransparent: putImageData complete');
}

// Fill polygon with transparency, no anti-aliasing (pixel-by-pixel)
export function fillPolygonNoAA(points, r, g, b, alpha) {
    if (points.length < 3) {
        // console.log('fillPolygonNoAA: Not enough points');
        return;
    }

    // アクティブレイヤーに応じたctxを選択
    const ctx = state.activeLayer === 'rough' ? roughCtx : (state.activeLayer === 'fill' ? fillCtx : lineCtx);
    const canvas = state.activeLayer === 'rough' ? roughCanvas : (state.activeLayer === 'fill' ? fillCanvas : lineCanvas);

    // console.log('fillPolygonNoAA: activeLayer=', state.activeLayer, 'points=', points.length, 'color=', r, g, b, alpha);

    const bounds = getBounds(points, canvas.width, canvas.height);
    // console.log('fillPolygonNoAA: bounds=', bounds);

    if (bounds.width <= 0 || bounds.height <= 0) {
        // console.log('fillPolygonNoAA: Invalid bounds, skipping');
        return;
    }

    const imgData = ctx.getImageData(bounds.minX, bounds.minY, bounds.width, bounds.height);
    const data = imgData.data;
    let pixelsFilled = 0;

    for (let py = 0; py < bounds.height; py++) {
        for (let px = 0; px < bounds.width; px++) {
            const canvasX = bounds.minX + px;
            const canvasY = bounds.minY + py;

            if (isPointInPolygon(canvasX, canvasY, points)) {
                const i = (py * bounds.width + px) * 4;

                // Alpha blend: new = old * (1 - alpha) + new * alpha
                data[i] = data[i] * (1 - alpha) + r * alpha;
                data[i + 1] = data[i + 1] * (1 - alpha) + g * alpha;
                data[i + 2] = data[i + 2] * (1 - alpha) + b * alpha;
                data[i + 3] = 255;  // Alpha channel = opaque
                pixelsFilled++;
            }
        }
    }

    // console.log('fillPolygonNoAA: Filled', pixelsFilled, 'pixels');
    ctx.putImageData(imgData, bounds.minX, bounds.minY);
    // console.log('fillPolygonNoAA: putImageData complete');
}

export function fillPolygon(points) {
    if (points.length < 3) return;

    // ベタレイヤーの場合は100%黒固定
    if (state.activeLayer === 'fill') {
        fillPolygonNoAA(points, 0, 0, 0, 1.0);
        return;
    }

    // roughレイヤーの場合（グレー固定）
    if (state.activeLayer === 'rough') {
        const ctx = roughCtx;
        ctx.fillStyle = '#808080';  // グレー固定
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.fill();
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
    // console.log('startLasso at:', x, y, 'currentTool:', state.currentTool);
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
