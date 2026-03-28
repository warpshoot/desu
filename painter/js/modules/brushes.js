/**
 * brushes.js — ブラシプリセット管理 & 統一描画エンジン
 *
 * 全スロットが同一の描画ロジックを使用。
 * 挙動はブラシ設定 (pressureSize, pressureOpacity, binary, etc.) で制御。
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
            subTool: 'pen',
            size: 3,
            opacity: 1.0,
            pressureSize: true,
            pressureOpacity: false,
            pressureDensity: false,
            binary: false,
            stippleDensity: 5,
            pressureCurve: 1.0,
            color: '#000000',
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
            color: '#000000',
        },
        {
            id: 3,
            name: '3',
            subTool: 'stipple',
            size: 4,
            opacity: 0.3,
            pressureSize: false,
            pressureOpacity: false,
            pressureDensity: true,
            binary: false,
            stippleDensity: 5,
            pressureCurve: 1.0,
            color: '#444444',
        }
    ];
}

/**
 * 筆圧カーブを適用
 * gamma < 1: 柔らかい (弱い力でも反応)
 * gamma = 1: 線形 (そのまま)
 * gamma > 1: 硬い (強く押さないと反応しない)
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
        { id: 0, name: '1', subTool: 'fill',   opacity: 1.0, color: '#000000', bucketEnabled: true },
        { id: 1, name: '2', subTool: 'tone',   opacity: 1.0, color: '#000000', bucketEnabled: true },
        { id: 2, name: '3', subTool: 'fill',   opacity: 0.5, color: '#808080', bucketEnabled: true },
    ];
}

// =============================================
// デフォルト消しゴムスロット定義
// =============================================
export function makeDefaultEraserSlots() {
    return [
        { id: 0, name: '1', subTool: 'pen' },
        { id: 1, name: '2', subTool: 'lasso' },
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
// 統一描画エンジン
// =============================================

/**
 * 1ストローク分のポイント列からキャンバスに描く
 * 全ブラシスロットが同じロジックを使用。
 * 挙動は brush の設定フラグで制御:
 *   - pressureSize:    筆圧→線幅
 *   - pressureOpacity: 筆圧→不透明度
 *   - binary:          2値ピクセルモード
 *   - pressureCurve:   筆圧カーブ (gamma)
 */
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
    const getA = (p) => b.pressureOpacity
        ? (0.1 + 0.9 * applyPressureCurve(p, gamma))
        : 1.0;

    ctx.globalCompositeOperation = 'source-over';

    if (isStart) {
        const p = pts[0];
        const w = getW(p.pressure);
        ctx.fillStyle = b.pressureOpacity
            ? _applyAlpha(b.color, getA(p.pressure))
            : b.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, w / 2, 0, Math.PI * 2); ctx.fill();
        return 0;
    }

    const startI = Math.max(1, fromIdx);
    for (let i = startI; i < pts.length; i++) {
        const p1 = pts[i-1], p2 = pts[i];
        const w1 = getW(p1.pressure), w2 = getW(p2.pressure);

        if (b.pressureOpacity) {
            // 筆圧→不透明度: 各点ごとに色を変えながらスタンプ
            _stampSegmentWithAlpha(ctx, p1, p2, w1, w2, getA(p1.pressure), getA(p2.pressure), b.color);
        } else {
            // 不透明度固定: lineTo ベースの高速描画
            ctx.fillStyle = b.color;
            _stampSegment(ctx, p1, p2, w1, w2);
        }
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
            const cp = p1.pressure + (p2.pressure - p1.pressure) * t;
            const stampW = Math.max(1, Math.round(getW(cp)));
            const stamp = getPixelBrush(stampW, b.color);
            ctx.drawImage(stamp, Math.floor(cx - stampW / 2), Math.floor(cy - stampW / 2));
        }
    }
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

/**
 * 不透明度固定のセグメント描画 (lineTo + 補間スタンプ)
 */
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

/**
 * 筆圧→不透明度対応のセグメント描画
 * lineToは色が固定なので使えない。全て円スタンプで描画。
 */
function _stampSegmentWithAlpha(ctx, p1, p2, w1, w2, a1, a2, color) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);

    const spacing = Math.max(1.0, Math.min(w1, w2) * 0.15);
    const steps = Math.max(1, Math.ceil(dist / spacing));

    for (let j = 0; j <= steps; j++) {
        const t = j / steps;
        const cx = p1.x + dx * t, cy = p1.y + dy * t;
        const cw = w1 + (w2 - w1) * t;
        const ca = a1 + (a2 - a1) * t;
        ctx.fillStyle = _applyAlpha(color, ca);
        if (cw > 0) {
            ctx.beginPath(); ctx.arc(cx, cy, cw / 2, 0, Math.PI * 2); ctx.fill();
        }
    }
}

function _applyAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha.toFixed(4)})`;
}
