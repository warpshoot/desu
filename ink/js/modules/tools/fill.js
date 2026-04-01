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
// tolerance: 'strict' | 'normal' | 'loose'
//   strict: 完全一致のみ
//   normal: 完全不透明(255)のみ壁 (デフォルト)
//   loose:  alpha >= 192 が壁
// ============================================

export function _makeMatchFn(data, targetA, tolerance) {
    if (tolerance === 'strict') {
        // 完全一致
        return (i) => data[i + 3] === targetA;
    }
    if (tolerance === 'normal') {
        // 普通: アンチエイリアスの中間色まで塗り込む（Alpha 128 以上を壁とする）
        return targetA < 128
            ? (i) => data[i + 3] < 128
            : (i) => data[i + 3] >= 128;
    }
    // loose: より太い線などを対象に深く塗り込む（Alpha 240 以上を壁とする）
    return targetA < 240
        ? (i) => data[i + 3] < 240
        : (i) => data[i + 3] >= 240;
}

export function floodFill(startX, startY, fillColor, tolerance = 'normal') {
    const { canvas, ctx } = getActiveContextAndCanvas();
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    startX = Math.round(startX * dpr);
    startY = Math.round(startY * dpr);

    const w = canvas.width, h = canvas.height;

    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const idx = (startY * w + startX) * 4;
    const targetA = data[idx + 3];

    // 既に塗り色と同じなら何もしない
    if (data[idx] === fillColor[0] && data[idx + 1] === fillColor[1] &&
        data[idx + 2] === fillColor[2] && data[idx + 3] === fillColor[3]) return;

    const matchTarget = _makeMatchFn(data, targetA, tolerance);
    const setPixel = (i) => {
        data[i] = fillColor[0];
        data[i + 1] = fillColor[1];
        data[i + 2] = fillColor[2];
        data[i + 3] = fillColor[3];
    };

    const visited = new Uint8Array(w * h);
    const stack = [[startX, startY]];

    while (stack.length > 0) {
        let [x, y] = stack.pop();
        let i = (y * w + x) * 4;

        while (x >= 0 && matchTarget(i) && !visited[y * w + x]) {
            x--;
            i -= 4;
        }
        x++;
        i += 4;

        let spanAbove = false, spanBelow = false;

        while (x < w && matchTarget(i) && !visited[y * w + x]) {
            visited[y * w + x] = 1;
            setPixel(i);

            if (y > 0) {
                const above = i - w * 4;
                if (matchTarget(above) && !visited[(y - 1) * w + x]) {
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
                if (matchTarget(below) && !visited[(y + 1) * w + x]) {
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

// 透明で塗りつぶし (トレランス付き)
export function floodFillTransparent(startX, startY, tolerance = 'normal') {
    const { canvas, ctx } = getActiveContextAndCanvas();
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    startX = Math.round(startX * dpr);
    startY = Math.round(startY * dpr);

    const w = canvas.width, h = canvas.height;

    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const idx = (startY * w + startX) * 4;
    const targetA = data[idx + 3];

    if (targetA === 0) return;

    const matchTarget = _makeMatchFn(data, targetA, tolerance);
    const setPixel = (i) => {
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
    };

    const visited = new Uint8Array(w * h);
    const stack = [[startX, startY]];

    while (stack.length > 0) {
        let [x, y] = stack.pop();
        let i = (y * w + x) * 4;

        while (x >= 0 && matchTarget(i) && !visited[y * w + x]) {
            x--;
            i -= 4;
        }
        x++;
        i += 4;

        let spanAbove = false, spanBelow = false;

        while (x < w && matchTarget(i) && !visited[y * w + x]) {
            visited[y * w + x] = 1;
            setPixel(i);

            if (y > 0) {
                const above = i - w * 4;
                if (matchTarget(above) && !visited[(y - 1) * w + x]) {
                    if (!spanAbove) { stack.push([x, y - 1]); spanAbove = true; }
                } else { spanAbove = false; }
            }

            if (y < h - 1) {
                const below = i + w * 4;
                if (matchTarget(below) && !visited[(y + 1) * w + x]) {
                    if (!spanBelow) { stack.push([x, y + 1]); spanBelow = true; }
                } else { spanBelow = false; }
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

    // getImageData/putImageData は物理ピクセル座標で動作するため dpr でスケーリング
    const dpr = window.devicePixelRatio || 1;
    const physicalPoints = points.map(p => ({ x: p.x * dpr, y: p.y * dpr }));
    const bounds = getBounds(physicalPoints, canvas.width, canvas.height);

    if (bounds.width <= 0 || bounds.height <= 0) return;

    const imgData = ctx.getImageData(bounds.minX, bounds.minY, bounds.width, bounds.height);
    const data = imgData.data;

    for (let py = 0; py < bounds.height; py++) {
        for (let px = 0; px < bounds.width; px++) {
            const canvasX = bounds.minX + px;
            const canvasY = bounds.minY + py;

            if (isPointInPolygon(canvasX, canvasY, physicalPoints)) {
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

    // getImageData/putImageData は物理ピクセル座標で動作するため dpr でスケーリング
    const dpr = window.devicePixelRatio || 1;
    const physicalPoints = points.map(p => ({ x: p.x * dpr, y: p.y * dpr }));
    const bounds = getBounds(physicalPoints, canvas.width, canvas.height);

    if (bounds.width <= 0 || bounds.height <= 0) return;

    const imgData = ctx.getImageData(bounds.minX, bounds.minY, bounds.width, bounds.height);
    const data = imgData.data;

    for (let py = 0; py < bounds.height; py++) {
        for (let px = 0; px < bounds.width; px++) {
            const canvasX = bounds.minX + px;
            const canvasY = bounds.minY + py;

            if (isPointInPolygon(canvasX, canvasY, physicalPoints)) {
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

// Fill polygon with color (Anti-Aliased using native canvas fill)
export function fillPolygonWithAA(points, r, g, b, alpha) {
    if (points.length < 3) return;

    const { canvas, ctx } = getActiveContextAndCanvas();
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    
    ctx.save();
    ctx.scale(1 / dpr, 1 / dpr); // scale down because ctx draws in canvas pixel coordinates, whereas points are in unscaled canvas coordinates wait no, points are in canvas space (unscaled css pixels).
    ctx.scale(dpr, dpr); 
    // Wait, the active layer context already has scale(dpr, dpr) applied in createLayer().
    // So unscaled CSS pixel 'points' are perfectly fine to draw directly to ctx!

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// Fill polygon transparent (Anti-Aliased using native canvas fill)
export function fillPolygonTransparentWithAA(points) {
    if (points.length < 3) return;

    const { canvas, ctx } = getActiveContextAndCanvas();
    if (!canvas || !ctx) return;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// ============================================
// 投げ縄ツール制御
// ============================================

// 手ぶれ補正: 投げ縄描画中のアンカー位置
let _lassoAnchorX = 0;
let _lassoAnchorY = 0;

/**
 * 現在の投げ縄スロットから手ぶれ補正設定を取得
 */
function _getLassoStab() {
    const slot = state.mode === 'eraser' ? state.activeEraserSlot : state.activeFillSlot;
    return {
        enabled:  slot.stabilizerEnabled  ?? false,
        distance: slot.stabilizerDistance ?? 20,
    };
}

/**
 * 手ぶれ補正の「糸」をlassoCanvas上に描画 (投げ縄パス描画後に重ね描き)
 * cursorX/Y, anchorX/Y はスクリーン座標 (lassoCanvas = スクリーンサイズ)
 */
function _drawLassoStabString(cursorX, cursorY, anchorX, anchorY) {
    lassoCtx.save();
    lassoCtx.lineWidth = 3;
    lassoCtx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    lassoCtx.beginPath();
    lassoCtx.moveTo(cursorX, cursorY);
    lassoCtx.lineTo(anchorX, anchorY);
    lassoCtx.stroke();

    lassoCtx.lineWidth = 1.5;
    lassoCtx.strokeStyle = 'rgba(60, 130, 255, 0.85)';
    lassoCtx.beginPath();
    lassoCtx.moveTo(cursorX, cursorY);
    lassoCtx.lineTo(anchorX, anchorY);
    lassoCtx.stroke();

    // アンカー円
    lassoCtx.beginPath();
    lassoCtx.arc(anchorX, anchorY, 4, 0, Math.PI * 2);
    lassoCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    lassoCtx.fill();
    lassoCtx.lineWidth = 1.5;
    lassoCtx.strokeStyle = 'rgba(60, 130, 255, 0.9)';
    lassoCtx.stroke();

    // カーソル小円
    lassoCtx.beginPath();
    lassoCtx.arc(cursorX, cursorY, 2.5, 0, Math.PI * 2);
    lassoCtx.fillStyle = 'rgba(60, 130, 255, 0.7)';
    lassoCtx.fill();

    lassoCtx.restore();
}

export function startLasso(x, y) {
    state.isLassoing = true;
    state.lassoPoints = [{ x, y }];
    _lassoAnchorX = x;
    _lassoAnchorY = y;
    lassoCanvas.style.display = 'block';
    lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
}

export function updateLasso(rawX, rawY) {
    if (!state.isLassoing) return;

    const stab = _getLassoStab();
    let x = rawX, y = rawY;

    if (stab.enabled) {
        // 糸引きスタビライザー: アンカーが stabilizerDistance を超えたときのみ移動
        const dx = rawX - _lassoAnchorX;
        const dy = rawY - _lassoAnchorY;
        const d = Math.hypot(dx, dy);
        if (d <= stab.distance) {
            // ブラシは動かない — 糸だけ再描画
            lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
            // 既存パスを再描画
            lassoCtx.strokeStyle = '#0066ff';
            lassoCtx.lineWidth = 2;
            lassoCtx.beginPath();
            lassoCtx.moveTo(state.lassoPoints[0].x, state.lassoPoints[0].y);
            for (let i = 1; i < state.lassoPoints.length; i++) {
                lassoCtx.lineTo(state.lassoPoints[i].x, state.lassoPoints[i].y);
            }
            lassoCtx.lineTo(state.lassoPoints[0].x, state.lassoPoints[0].y);
            lassoCtx.stroke();
            _drawLassoStabString(rawX, rawY, _lassoAnchorX, _lassoAnchorY);
            return;
        }
        const ratio = (d - stab.distance) / d;
        _lassoAnchorX += dx * ratio;
        _lassoAnchorY += dy * ratio;
        x = _lassoAnchorX;
        y = _lassoAnchorY;
    }

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

    if (stab.enabled) {
        _drawLassoStabString(rawX, rawY, _lassoAnchorX, _lassoAnchorY);
    }
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
