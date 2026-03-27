/**
 * brushes.js — ブラシプリセット管理 & 描画エンジン
 *
 * ブラシタイプ:
 *   pen      : 2値 or 筆圧→線幅。不透明。
 *   ink      : 筆圧 → 線幅 + 不透明度。インクっぽさ。
 *   paint    : 筆圧 → 不透明度。塗り絵ブラシ。固定幅。
 *   sketch   : 筆圧 → 不透明度。重ね塗りで色がつく。薄灰。
 *   watercolor: 筆圧 → 大きさ + ソフトグロー。
 */

// ブラシキャッシュ（binary用）
const brushCache = new Map();

// =============================================
// デフォルトブラシ定義
// =============================================
export function makeDefaultBrushes() {
    return [
        {
            id: 0,
            name: '1',
            type: 'pen',       // binary-capable pen
            subTool: 'pen',    // 使用サブツール: 'pen' | 'stipple'
            size: 3,
            opacity: 1.0,
            pressureSize: true,   // 筆圧→線幅
            pressureOpacity: false,
            binary: false,        // true=2値ピクセルスタンプ
            color: '#000000',
        },
        {
            id: 1,
            name: '2',
            type: 'ink',
            subTool: 'pen',
            size: 6,
            opacity: 0.9,
            pressureSize: true,
            pressureOpacity: true,
            binary: false,
            color: '#000000',
        },
        {
            id: 3,
            name: '3',
            type: 'sketch',
            subTool: 'stipple',
            size: 4,
            opacity: 0.3,
            pressureSize: false,
            pressureOpacity: true,
            binary: false,
            color: '#444444',
        }
    ];
}

// =============================================
// デフォルト塗りつぶし（投げ縄）スロット定義
// =============================================
export function makeDefaultFillSlots() {
    return [
        { id: 0, name: '1', subTool: 'fill' },
        { id: 1, name: '2', subTool: 'tone' },
        { id: 2, name: '3', subTool: 'sketch' },
    ];
}

// =============================================
// 2値ブラシスタンプキャッシュ
// =============================================
function getPixelBrush(size, hexColor) {
    const key = `${size}-${hexColor}`;
    if (brushCache.has(key)) return brushCache.get(key);

    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = hexColor;
    ctx.fillRect(0, 0, 1, 1);
    const cd = ctx.getImageData(0, 0, 1, 1).data;
    const [r, g, b, a] = [cd[0], cd[1], cd[2], cd[3]];
    ctx.clearRect(0, 0, size, size);

    const img = ctx.createImageData(size, size);
    const d = img.data;
    const cx = size / 2, cy = size / 2, rsq = (size / 2) ** 2;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if ((x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2 <= rsq) {
                const i = (y * size + x) * 4;
                d[i] = r; d[i+1] = g; d[i+2] = b; d[i+3] = a;
            }
        }
    }
    ctx.putImageData(img, 0, 0);
    brushCache.set(key, c);
    return c;
}

// =============================================
// ブラシ別 描画エンジン
// =============================================

/**
 * 1ストローク分のポイント列からキャンバスに描く
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x,y,pressure}[]} points  全ポイント列
 * @param {number} fromIdx           前回描いたindex
 * @param {boolean} isStart          最初の点かどうか
 * @param {object} brush             ブラシ設定オブジェクト
 * @param {boolean} isErasing
 * @returns {number}                 次回のfromIdx
 */
export function drawBrushSegment(ctx, points, fromIdx, isStart, brush, isErasing) {
    if (points.length === 0) return 0;

    // --- 消しゴムモード ---
    if (isErasing) {
        return _drawErase(ctx, points, fromIdx, isStart, brush);
    }

    switch (brush.type) {
        case 'ink':        return _drawInk(ctx, points, fromIdx, isStart, brush);
        case 'sketch':     return _drawSketch(ctx, points, fromIdx, isStart, brush);
        case 'pen':
        default:           return _drawPen(ctx, points, fromIdx, isStart, brush);
    }
}

// ======= PEN =======
function _drawPen(ctx, pts, fromIdx, isStart, b) {
    const baseSize = b.size;
    const getW = (p) => b.pressureSize
        ? Math.max(0.5, baseSize * (0.3 + 1.2 * p))
        : baseSize;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = b.color;

    if (b.binary) {
        // pixel-stamp mode
        const size = Math.max(1, Math.round(baseSize));
        const stamp = getPixelBrush(size, b.color);
        const half = size / 2;
        const startI = isStart ? 0 : Math.max(1, fromIdx);
        for (let i = startI; i < pts.length; i++) {
            const p1 = pts[Math.max(0, i - 1)];
            const p2 = pts[i];
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const steps = i === 0 ? 0 : Math.ceil(dist);
            for (let j = 0; j <= steps; j++) {
                const t = steps === 0 ? 0 : j / steps;
                const cx = p1.x + (p2.x - p1.x) * t;
                const cy = p1.y + (p2.y - p1.y) * t;
                ctx.drawImage(stamp, Math.floor(cx - half), Math.floor(cy - half));
            }
        }
        return pts.length - 1;
    }

    // smooth anti-aliased
    if (isStart) {
        const p = pts[0];
        const w = getW(p.pressure);
        ctx.beginPath(); ctx.arc(p.x, p.y, w / 2, 0, Math.PI * 2); ctx.fill();
        return 0;
    }
    const startI = Math.max(1, fromIdx);
    for (let i = startI; i < pts.length; i++) {
        const p1 = pts[i-1], p2 = pts[i];
        const w1 = getW(p1.pressure), w2 = getW(p2.pressure);
        _stampSegment(ctx, p1, p2, w1, w2);
    }
    return pts.length - 1;
}

// ======= INK (pressure → width + opacity) =======
function _drawInk(ctx, pts, fromIdx, isStart, b) {
    ctx.globalCompositeOperation = 'source-over';

    const getW = (p) => b.pressureSize
        ? Math.max(0.5, b.size * (0.25 + 1.3 * p))
        : b.size;

    if (isStart) {
        const p = pts[0];
        const w = getW(p.pressure);
        const alpha = b.pressureOpacity ? b.opacity * (0.1 + 0.9 * p.pressure) : b.opacity;
        ctx.fillStyle = _applyAlpha(b.color, alpha);
        ctx.beginPath(); ctx.arc(p.x, p.y, w / 2, 0, Math.PI * 2); ctx.fill();
        return 0;
    }
    const startI = Math.max(1, fromIdx);
    for (let i = startI; i < pts.length; i++) {
        const p1 = pts[i-1], p2 = pts[i];
        const w1 = getW(p1.pressure), w2 = getW(p2.pressure);
        const a1 = b.pressureOpacity ? b.opacity * (0.1 + 0.9 * p1.pressure) : b.opacity;
        const a2 = b.pressureOpacity ? b.opacity * (0.1 + 0.9 * p2.pressure) : b.opacity;
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        
        // 密度調整: 太さに応じて間隔を広げる
        const spacing = Math.max(1.0, Math.min(w1, w2) * 0.08);
        const steps = Math.max(1, Math.ceil(dist / spacing));
        
        for (let j = 0; j <= steps; j++) {
            const t = j / steps;
            const cx = p1.x + dx * t, cy = p1.y + dy * t;
            const cw = w1 + (w2 - w1) * t;
            const ca = a1 + (a2 - a1) * t;
            // 密度を考慮して不透明度を補正 (重なりが少ない分、少し強めに)
            const correctedAlpha = Math.min(1.0, ca * 1.5);
            ctx.fillStyle = _applyAlpha(b.color, correctedAlpha);
            ctx.beginPath(); ctx.arc(cx, cy, cw / 2, 0, Math.PI * 2); ctx.fill();
        }
    }
    return pts.length - 1;
}


// ======= SKETCH (pressure → opacity, builds up) =======
function _drawSketch(ctx, pts, fromIdx, isStart, b) {
    ctx.globalCompositeOperation = 'source-over';

    const w = b.size;
    const baseAlpha = b.opacity;

    const startI = isStart ? 0 : Math.max(1, fromIdx);
    for (let i = startI; i < pts.length; i++) {
        const p1 = pts[Math.max(0, i - 1)], p2 = pts[i];
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        
        // Sketch用密度調整: もともと薄いので少し細かめに
        const spacing = Math.max(1.5, w * 0.15); 
        const steps = i === startI && isStart ? 0 : Math.max(1, Math.round(dist / spacing));
        
        for (let j = 0; j <= steps; j++) {
            const t = steps === 0 ? 0 : j / steps;
            const cx = p1.x + (p2.x - p1.x) * t;
            const cy = p1.y + (p2.y - p1.y) * t;
            const pr = p1.pressure + (p2.pressure - p1.pressure) * t;
            const alpha = b.pressureOpacity ? baseAlpha * (0.2 + 0.8 * pr) : baseAlpha;
            ctx.fillStyle = _applyAlpha(b.color, alpha);
            ctx.beginPath(); ctx.arc(cx, cy, w / 2, 0, Math.PI * 2); ctx.fill();
        }
    }
    return pts.length - 1;
}


// ======= ERASER =======
function _drawErase(ctx, pts, fromIdx, isStart, b) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';

    const getW = (p) => b.pressureSize
        ? Math.max(1, b.size * (0.3 + 1.2 * p))
        : b.size;

    if (isStart) {
        const p = pts[0];
        const w = getW(p.pressure);
        ctx.beginPath(); ctx.arc(p.x, p.y, w / 2, 0, Math.PI * 2); ctx.fill();
        return 0;
    }
    const startI = Math.max(1, fromIdx);
    for (let i = startI; i < pts.length; i++) {
        const p1 = pts[i-1], p2 = pts[i];
        _stampSegment(ctx, p1, p2, getW(p1.pressure), getW(p2.pressure));
    }
    ctx.globalCompositeOperation = 'source-over';
    return pts.length - 1;
}

// =============================================
// 共通ヘルパー
// =============================================
function _stampSegment(ctx, p1, p2, w1, w2) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    
    // Stroke描画をベースにする
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = (w1 + w2) / 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // 太さの変動が大きい場合は隙間にスタンプを打って補間
    if (Math.abs(w1 - w2) > 1 || dist > 5) {
        const spacing = Math.max(2.0, Math.min(w1, w2) * 0.3);
        const steps = Math.max(1, Math.ceil(dist / spacing));
        for (let j = 0; j <= steps; j++) {
            const t = j / steps;
            const cx = p1.x + dx * t, cy = p1.y + dy * t;
            const cw = (w1 + (w2 - w1) * t);
            if (cw > 0) {
                ctx.beginPath(); ctx.arc(cx, cy, cw / 2, 0, Math.PI * 2); ctx.fill();
            }
        }
    }
}

function _applyAlpha(hex, alpha) {
    // hex: #RRGGBB → rgba(r,g,b,alpha)
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha.toFixed(4)})`;
}
