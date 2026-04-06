/**
 * brushes.js — ブラシプリセット管理 & 統一描画エンジン
 *
 * モノクロ専用: 色は黒固定、濃淡は不透明度のみで表現。
 * 全スロットが同一の描画ロジックを使用。
 * 挙動はブラシ設定 (pressureSize, binary, etc.) で制御。
 */

// インク色: 黒固定 (モノクロツール)
const INK_COLOR = '#000000';

// ブラシキャッシュ（binary用）— LRU的に上限管理
const brushCache = new Map();
const BRUSH_CACHE_MAX = 50;

// =============================================
// デフォルトブラシ定義
// =============================================
export function makeDefaultBrushes() {
    return [
        {
            subTool: 'pen',
            size: 2,
            opacity: 1.0,
            pressureSize: true,
            pressureDensity: false,
            binary: false,
            stippleDensity: 5,
            pressureCurve: 1.2,
            stabilizerEnabled: true,
            stabilizerDistance: 5,
            stabStringVisible: true,
            stabShowGuide: true,
        },
        {
            subTool: 'pen',
            size: 8,
            opacity: 0.2,
            pressureSize: false,
            pressureDensity: false,
            binary: true,
            stippleDensity: 5,
            pressureCurve: 1.0,
            stabilizerEnabled: false,
            stabilizerDistance: 20,
            stabStringVisible: true,
            stabShowGuide: true,
        },
        {
            subTool: 'stipple',
            size: 4,
            opacity: 0.3,
            pressureSize: false,
            pressureDensity: false,
            binary: false,
            stippleDensity: 10,
            pressureCurve: 1.0,
            stabilizerEnabled: false,
            stabilizerDistance: 20,
            stabStringVisible: true,
            stabShowGuide: true,
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
        { subTool: 'fill', opacity: 1.0, bucketEnabled: true, bucketTolerance: 'normal', bucketGapClose: 0, tonePresetId: 'coarse1', stabilizerEnabled: true, stabilizerDistance: 5, antiAlias: true },
        { subTool: 'tone', opacity: 1.0, bucketEnabled: true, bucketTolerance: 'normal', bucketGapClose: 0, tonePresetId: 'coarse2', stabilizerEnabled: false, stabilizerDistance: 20, antiAlias: false },
        { subTool: 'fill', opacity: 0.1, bucketEnabled: true, bucketTolerance: 'normal', bucketGapClose: 0, tonePresetId: 'coarse1', stabilizerEnabled: false, stabilizerDistance: 5, antiAlias: false },
    ];
}



// =============================================
// デフォルト消しゴムスロット定義
// =============================================
export function makeDefaultEraserSlots() {
    return [
        { subTool: 'pen', stabilizerEnabled: false, stabilizerDistance: 20, stabStringVisible: true, stabShowGuide: true, pressureSize: true, pressureCurve: 1.0 },
        { subTool: 'lasso', bucketEnabled: true, bucketTolerance: 'normal', bucketGapClose: 0, stabilizerEnabled: false, stabilizerDistance: 20, antiAlias: false },
        { subTool: 'clear', antiAlias: false },
    ];
}




// =============================================
// 2値ブラシスタンプキャッシュ
// =============================================
function getPixelBrush(size) {
    if (brushCache.has(size)) {
        // LRU: 再挿入でMapの末尾に移動
        const c = brushCache.get(size);
        brushCache.delete(size);
        brushCache.set(size, c);
        return c;
    }

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

    // キャッシュ上限を超えたら最古のエントリを削除
    if (brushCache.size >= BRUSH_CACHE_MAX) {
        const oldest = brushCache.keys().next().value;
        brushCache.delete(oldest);
    }
    brushCache.set(size, c);
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
    ctx.strokeStyle = INK_COLOR;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isStart) {
        const p = pts[0];
        const w = getW(p.pressure);
        ctx.beginPath(); ctx.arc(p.x, p.y, w / 2, 0, Math.PI * 2); ctx.fill();
        return 0;
    }

    const startI = Math.max(1, fromIdx);

    // Pass 1: ストローク骨格 — セグメントごとに lineWidth を変えるため個別発行
    // (iOS では arc fill に比べ stroke は安価なため問題なし)
    for (let i = startI; i < pts.length; i++) {
        const p1 = pts[i-1], p2 = pts[i];
        const w1 = getW(p1.pressure), w2 = getW(p2.pressure);
        ctx.lineWidth = (w1 + w2) / 2;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }

    // Pass 2: 可変幅 arc を全セグメント分まとめて 1 回の fill() で描画
    // (iOS Core Graphics では fill() 1回ごとに flush が走るため致命的に遅い — バッチ化で解決)
    ctx.beginPath();
    let hasArcs = false;
    for (let i = startI; i < pts.length; i++) {
        const p1 = pts[i-1], p2 = pts[i];
        const w1 = getW(p1.pressure), w2 = getW(p2.pressure);
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        if (Math.abs(w1 - w2) > 1 || dist > 5) {
            hasArcs = true;
            const spacing = Math.max(2.0, Math.min(w1, w2) * 0.3);
            const steps = Math.max(1, Math.ceil(dist / spacing));
            for (let j = 0; j <= steps; j++) {
                const t = j / steps;
                const cx = p1.x + dx * t, cy = p1.y + dy * t;
                const cw = w1 + (w2 - w1) * t;
                if (cw > 0) ctx.arc(cx, cy, cw / 2, 0, Math.PI * 2);
            }
        }
    }
    if (hasArcs) ctx.fill(); // 全 arc を 1 回の GPU flush で完了

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
    ctx.strokeStyle = '#000000';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const gamma = b.pressureCurve ?? 1.0;
    const getW = (p) => b.pressureSize
        ? Math.max(1, b.size * (0.3 + 1.2 * applyPressureCurve(p, gamma)))
        : b.size;

    if (isStart) {
        const p = pts[0];
        const w = getW(p.pressure);
        ctx.beginPath(); ctx.arc(p.x, p.y, w / 2, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        return 0;
    }

    const startI = Math.max(1, fromIdx);

    // Pass 1: ストローク骨格
    for (let i = startI; i < pts.length; i++) {
        const p1 = pts[i-1], p2 = pts[i];
        const w1 = getW(p1.pressure), w2 = getW(p2.pressure);
        ctx.lineWidth = (w1 + w2) / 2;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }

    // Pass 2: 可変幅 arc をバッチ fill
    ctx.beginPath();
    let hasArcs = false;
    for (let i = startI; i < pts.length; i++) {
        const p1 = pts[i-1], p2 = pts[i];
        const w1 = getW(p1.pressure), w2 = getW(p2.pressure);
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        if (Math.abs(w1 - w2) > 1 || dist > 5) {
            hasArcs = true;
            const spacing = Math.max(2.0, Math.min(w1, w2) * 0.3);
            const steps = Math.max(1, Math.ceil(dist / spacing));
            for (let j = 0; j <= steps; j++) {
                const t = j / steps;
                const cx = p1.x + dx * t, cy = p1.y + dy * t;
                const cw = w1 + (w2 - w1) * t;
                if (cw > 0) ctx.arc(cx, cy, cw / 2, 0, Math.PI * 2);
            }
        }
    }
    if (hasArcs) ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    return pts.length - 1;
}

// _stampSegment は _drawStroke / _drawErase にインライン化したため削除済み

