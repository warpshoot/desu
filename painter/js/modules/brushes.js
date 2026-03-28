/**
 * brushes.js — ブラシプリセット管理 & 統一描画エンジン
 *
 * モノクロ専用: 色は黒固定、濃淡は不透明度のみで表現。
 * 全スロットが同一の描画ロジックを使用。
 * 挙動はブラシ設定 (pressureSize, pressureOpacity, binary, etc.) で制御。
 */

// インク色: 黒固定 (モノクロツール)
const INK_COLOR = '#000000';

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
            subTool: 'pen',
            size: 3,
            opacity: 1.0,
            pressureSize: true,
            pressureOpacity: false, // 未使用: スタンプ重畳で正しく動作しないため無効
            pressureDensity: false,
            binary: false,
            stippleDensity: 5,
            pressureCurve: 1.0,
            stabilizerEnabled: false,
            stabilizerDistance: 20,
        },
        {
            id: 1,
            name: '2',
            subTool: 'pen',
            size: 6,
            opacity: 0.9,
            pressureSize: true,
            pressureOpacity: true,
            pressureDensity: false,
            binary: false,
            stippleDensity: 5,
            pressureCurve: 1.0,
            stabilizerEnabled: false,
            stabilizerDistance: 20,
        },
        {
            id: 3,
            name: '3',
            subTool: 'stipple',
            size: 4,
            opacity: 0.3,
            pressureSize: false,
            pressureOpacity: false, // 未使用: スタンプ重畳で正しく動作しないため無効
            pressureDensity: true,
            binary: false,
            stippleDensity: 5,
            pressureCurve: 1.0,
            stabilizerEnabled: false,
            stabilizerDistance: 20,
        }
    ];
}

/**
 * 筆圧カーブを適用
 */
export function applyPressureCurve(pressure, gamma) {
    if (gamma === 1.0 || gamma == null) return pressure;
    return Math.pow(Math.max(0, Math.min(1, pressure)), gamma);
}

// =============================================
// デフォルト塗りつぶし（投げ縄）スロット定義
// =============================================
export function makeDefaultFillSlots() {
    return [
        { id: 0, name: '1', subTool: 'fill', opacity: 1.0, bucketEnabled: true, bucketTolerance: 'normal', tonePresetId: 'coarse1' },
        { id: 1, name: '2', subTool: 'tone', opacity: 1.0, bucketEnabled: true, bucketTolerance: 'normal', tonePresetId: 'coarse1' },
        { id: 2, name: '3', subTool: 'fill', opacity: 0.5, bucketEnabled: true, bucketTolerance: 'normal', tonePresetId: 'coarse1' },
    ];
}

// =============================================
// デフォルト消しゴムスロット定義
// =============================================
export function makeDefaultEraserSlots() {
    return [
        { id: 0, name: '1', subTool: 'pen' },
        { id: 1, name: '2', subTool: 'lasso', bucketEnabled: true, bucketTolerance: 'normal' },
        { id: 2, name: '3', subTool: 'clear' },
    ];
}

// =============================================
// 2値ブラシスタンプキャッシュ
// =============================================
function getPixelBrush(size) {
    const key = `${size}`;
    if (brushCache.has(key)) return brushCache.get(key);

    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');

    const img = ctx.createImageData(size, size);
    const d = img.data;
    const cx = size / 2, cy = size / 2, rsq = (size / 2) ** 2;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if ((x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2 <= rsq) {
                const i = (y * size + x) * 4;
                d[i] = 0; d[i+1] = 0; d[i+2] = 0; d[i+3] = 255;
            }
        }
    }
    ctx.putImageData(img, 0, 0);
    brushCache.set(key, c);
    return c;
}

// =============================================
// 統一描画エンジン
// =============================================

export function drawBrushSegment(ctx, points, fromIdx, isStart, brush, isErasing) {
    if (points.length === 0) return 0;

    if (isErasing) {
        return _drawErase(ctx, points, fromIdx, isStart, brush);
    }

    if (brush.binary) {
        return _drawBinary(ctx, points, fromIdx, isStart, brush);
    }

    return _drawStroke(ctx, points, fromIdx, isStart, brush);
}

// =============================================
// 統一ストローク描画
// =============================================
function _drawStroke(ctx, pts, fromIdx, isStart, b) {
    const gamma = b.pressureCurve ?? 1.0;
    const getW = (p) => b.pressureSize
        ? Math.max(0.5, b.size * (0.3 + 1.2 * applyPressureCurve(p, gamma)))
        : b.size;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = INK_COLOR;

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

// =============================================
// 2値ピクセルモード
// =============================================
function _drawBinary(ctx, pts, fromIdx, isStart, b) {
    const gamma = b.pressureCurve ?? 1.0;
    const getW = (p) => b.pressureSize
        ? Math.max(0.5, b.size * (0.3 + 1.2 * applyPressureCurve(p, gamma)))
        : b.size;

    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;

    const startI = isStart ? 0 : Math.max(1, fromIdx);
    for (let i = startI; i < pts.length; i++) {
        const p1 = pts[Math.max(0, i - 1)];
        const p2 = pts[i];

        if (i === 0) {
            // 始点のみ: 1ドット描画
            const stampW = Math.max(1, Math.round(getW(p1.pressure)));
            const stamp = getPixelBrush(stampW);
            ctx.drawImage(stamp, Math.floor(p1.x - stampW / 2), Math.floor(p1.y - stampW / 2));
            continue;
        }

        // Bresenham ライン: 最小限のドット数で直線を描画
        let x0 = Math.floor(p1.x), y0 = Math.floor(p1.y);
        const x1 = Math.floor(p2.x), y1 = Math.floor(p2.y);
        const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        const totalDist = dx + dy || 1;
        let traveled = 0;

        while (true) {
            const t = traveled / totalDist;
            const cp = p1.pressure + (p2.pressure - p1.pressure) * t;
            const stampW = Math.max(1, Math.round(getW(cp)));
            const stamp = getPixelBrush(stampW);
            ctx.drawImage(stamp, x0 - Math.floor(stampW / 2), y0 - Math.floor(stampW / 2));

            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; traveled++; }
            if (e2 < dx) { err += dx; y0 += sy; traveled++; }
        }
    }
    ctx.imageSmoothingEnabled = true;
    return pts.length - 1;
}

// =============================================
// 消しゴム
// =============================================
function _drawErase(ctx, pts, fromIdx, isStart, b) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';

    const gamma = b.pressureCurve ?? 1.0;
    const getW = (p) => b.pressureSize
        ? Math.max(1, b.size * (0.3 + 1.2 * applyPressureCurve(p, gamma)))
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

    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = (w1 + w2) / 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

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

