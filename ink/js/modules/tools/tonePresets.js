import { state, CANVAS_DPR } from '../state.js';

// ============================================
// Tone Presets Configuration
// ============================================
export const TONE_PRESETS = [
    // Tab A: Dots
    { id: 'coarse1',  name: 'B1', type: 'fine',     spacing: 9,  dotSize: 1,  category: 'A' },
    { id: 'coarse2',  name: 'B2', type: 'fine',     spacing: 6,  dotSize: 1,  category: 'A' },
    { id: 'coarse3',  name: 'B3', type: 'fine',     spacing: 4,  dotSize: 1,  category: 'A' },
    { id: 'coarse4',  name: 'B4', type: 'fine',     spacing: 2,  dotSize: 1,  category: 'A' },
    { id: 'fine1',    name: 'C1', type: 'fine',     spacing: 20, dotSize: 2,  category: 'A' },
    { id: 'fine2',    name: 'C2', type: 'fine',     spacing: 15, dotSize: 2,  category: 'A' },
    { id: 'fine3',    name: 'C3', type: 'fine',     spacing: 10, dotSize: 2,  category: 'A' },
    { id: 'fine4',    name: 'C4', type: 'fine',     spacing: 5,  dotSize: 2,  category: 'A' },
    { id: 'organic1', name: 'F1', type: 'organic',  spacing: 10, dotSize: 2, randomness: 0.3, category: 'A' },
    { id: 'organic2', name: 'F2', type: 'organic',  spacing: 7,  dotSize: 2, randomness: 0.3, category: 'A' },

    // Tab B: Lines
    { id: 'diag1',  name: 'D1', type: 'diagonal',   spacing: 12, width: 1, category: 'B' },
    { id: 'diag2',  name: 'D2', type: 'diagonal',   spacing: 8,  width: 1, category: 'B' },
    { id: 'diag3',  name: 'D3', type: 'diagonal',   spacing: 4,  width: 1, category: 'B' },
    { id: 'horiz1', name: 'H1', type: 'horizontal', spacing: 12, width: 1, category: 'B' },
    { id: 'horiz2', name: 'H2', type: 'horizontal', spacing: 8,  width: 1, category: 'B' },
    { id: 'horiz3', name: 'H3', type: 'horizontal', spacing: 4,  width: 1, category: 'B' },
    { id: 'cross1', name: 'X1', type: 'crosshatch', spacing: 12, width: 1, category: 'B' },
    { id: 'cross2', name: 'X2', type: 'crosshatch', spacing: 8,  width: 1, category: 'B' },

    // Tab C: Grid
    { id: 'grid1',    name: 'E1', type: 'grid',      spacing: 12, width: 1,  category: 'C' },
    { id: 'grid2',    name: 'E2', type: 'grid',      spacing: 8,  width: 1,  category: 'C' },
    { id: 'grid3',    name: 'E3', type: 'grid',      spacing: 6,  width: 1,  category: 'C' },
    { id: 'honey1',   name: 'W1', type: 'honeycomb', hexSize: 10, width: 1,  category: 'C' },
    { id: 'honey2',   name: 'W2', type: 'honeycomb', hexSize: 6,  width: 1,  category: 'C' },
    { id: 'brick1',   name: 'K1', type: 'brick',     spacing: 12, width: 1,  category: 'C' },
    { id: 'brick2',   name: 'K2', type: 'brick',     spacing: 8,  width: 1,  category: 'C' },
    { id: 'checker1', name: 'CK', type: 'checker',   spacing: 8,              category: 'C' },
];

// Current selected preset ID (default to first one)
export let currentTonePresetId = 'coarse1';

// Cache for CanvasPatterns
const patternCache = new Map();

/**
 * Gets or creates a pattern for the given preset
 */
export function getTonePattern(ctx, preset) {
    const dpr = CANVAS_DPR;
    const cacheKey = `${preset.id}_${dpr}`;
    if (patternCache.has(cacheKey)) {
        return patternCache.get(cacheKey);
    }

    const canvas = createPatternCanvas(preset, dpr);
    const pattern = ctx.createPattern(canvas, 'repeat');
    patternCache.set(cacheKey, pattern);
    return pattern;
}

export function setTonePreset(presetId) {
    if (TONE_PRESETS.find(p => p.id === presetId)) {
        currentTonePresetId = presetId;
    }
}

export function getCurrentTonePreset() {
    return TONE_PRESETS.find(p => p.id === currentTonePresetId) || TONE_PRESETS[0];
}

// ============================================
// Pattern Generation (tileable CanvasPattern)
// ============================================

export function createPatternCanvas(preset, dpr = 1) {
    let tileW = 64, tileH = 64;
    const spacing = preset.spacing ? Math.max(2, Math.round(preset.spacing * dpr)) : 0;

    if (preset.type === 'coarse' || preset.type === 'fine') {
        let s = Math.round(spacing * 1.4142);
        if (s % 2 !== 0) s++;
        tileW = tileH = Math.max(2, s);
    } else if (preset.type === 'diagonal' || preset.type === 'grid' ||
               preset.type === 'horizontal' || preset.type === 'crosshatch' ||
               preset.type === 'brick') {
        tileW = tileH = spacing;
    } else if (preset.type === 'checker') {
        tileW = tileH = spacing * 2;
    } else if (preset.type === 'organic') {
        tileW = tileH = 512;
    } else if (preset.type === 'honeycomb') {
        const s = Math.max(2, Math.round((preset.hexSize || 8) * dpr));
        tileW = Math.max(2, Math.round(3 * s));
        tileH = Math.max(2, Math.round(s * Math.sqrt(3)));
    }

    const canvas = document.createElement('canvas');
    canvas.width = tileW;
    canvas.height = tileH;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, tileW, tileH);
    ctx.fillStyle = '#000000';

    if (preset.type === 'diagonal') {
        const lw = Math.max(1, Math.round(preset.width * dpr));
        for (let y = 0; y < tileH; y++) {
            for (let x = 0; x < tileW; x++) {
                const diff = (x - y + tileW) % tileW;
                if (diff < lw) ctx.fillRect(x, y, 1, 1);
            }
        }
    } else if (preset.type === 'horizontal') {
        const lw = Math.max(1, Math.round(preset.width * dpr));
        ctx.fillRect(0, 0, tileW, lw);
    } else if (preset.type === 'crosshatch') {
        // 45° + 135° diagonal lines — both directions tile correctly in a square tile
        const lw = Math.max(1, Math.round(preset.width * dpr));
        for (let y = 0; y < tileH; y++) {
            for (let x = 0; x < tileW; x++) {
                const d1 = (x - y + tileW) % tileW;
                const d2 = (x + y) % tileW;
                if (d1 < lw || d2 < lw) ctx.fillRect(x, y, 1, 1);
            }
        }
    } else if (preset.type === 'grid') {
        const lw = Math.max(1, Math.round(preset.width * dpr));
        ctx.fillRect(0, 0, tileW, lw);
        ctx.fillRect(0, 0, lw, tileH);
    } else if (preset.type === 'brick') {
        // Tile: tileW × tileH (square, side = spacing)
        // Two rows per tile: top row bricks aligned at x=0, bottom row offset by half
        const lw = Math.max(1, Math.round(preset.width * dpr));
        const bh = Math.max(1, Math.floor(tileH / 2)); // half-tile = one brick row height
        ctx.fillRect(0, 0, tileW, lw);                          // top horizontal
        ctx.fillRect(0, bh, tileW, lw);                         // mid horizontal
        ctx.fillRect(0, 0, lw, bh);                             // top-row left vertical
        ctx.fillRect(Math.floor(tileW / 2), bh, lw, tileH - bh); // bottom-row center vertical
    } else if (preset.type === 'checker') {
        const hw = Math.floor(tileW / 2);
        const hh = Math.floor(tileH / 2);
        ctx.fillRect(0, 0, hw, hh);
        ctx.fillRect(hw, hh, tileW - hw, tileH - hh);
    } else if (preset.type === 'honeycomb') {
        // Flat-top hex grid. Minimal tile: width=3s, height=s*sqrt(3).
        // Cols 0..2 with alternating row offsets tile perfectly in both axes.
        const s = Math.max(2, Math.round((preset.hexSize || 8) * dpr));
        const hexH = s * Math.sqrt(3);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1, Math.round((preset.width || 1) * dpr));
        const drawHex = (cx, cy) => {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const px = cx + s * Math.cos(angle);
                const py = cy + s * Math.sin(angle);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
        };
        for (let col = 0; col <= 2; col++) {
            const cx = col * 1.5 * s;
            const isOdd = col % 2 === 1;
            for (let row = -1; row <= 2; row++) {
                const cy = row * hexH + (isOdd ? hexH / 2 : 0);
                drawHex(cx, cy);
            }
        }
    } else if (preset.type === 'organic') {
        const dotSize = preset.dotSize * dpr;
        const randomness = preset.randomness || 0.3;
        const hash = (x, y) => {
            let h = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
            return h - Math.floor(h);
        };
        const step = spacing;
        for (let y = 0; y < tileH; y += step) {
            for (let x = 0; x < tileW; x += step) {
                const r1 = hash(x, y);
                const r2 = hash(x + 123.456, y + 789.012);
                const r3 = hash(x - 456.789, y - 234.567);
                const offsetX = (r1 - 0.5) * step * randomness;
                const offsetY = (r2 - 0.5) * step * randomness;
                const px = x + offsetX;
                const py = y + offsetY;
                const sVar = 1 + (r3 - 0.5) * randomness;
                const curSize = dotSize * sVar;
                const drawWraparound = (cx, cy) => {
                    ctx.beginPath();
                    ctx.arc(cx, cy, curSize / 2, 0, Math.PI * 2);
                    ctx.fill();
                    const neighbors = [];
                    if (cx < curSize) neighbors.push({ x: cx + tileW, y: cy });
                    if (cx > tileW - curSize) neighbors.push({ x: cx - tileW, y: cy });
                    if (cy < curSize) neighbors.push({ x: cx, y: cy + tileH });
                    if (cy > tileH - curSize) neighbors.push({ x: cx, y: cy - tileH });
                    if (cx < curSize && cy < curSize) neighbors.push({ x: cx + tileW, y: cy + tileH });
                    if (cx > tileW - curSize && cy < curSize) neighbors.push({ x: cx - tileW, y: cy + tileH });
                    if (cx < curSize && cy > tileH - curSize) neighbors.push({ x: cx + tileW, y: cy - tileH });
                    if (cx > tileW - curSize && cy > tileH - curSize) neighbors.push({ x: cx - tileW, y: cy - tileH });
                    neighbors.forEach(n => {
                        ctx.beginPath();
                        ctx.arc(n.x, n.y, curSize / 2, 0, Math.PI * 2);
                        ctx.fill();
                    });
                };
                drawWraparound(px, py);
            }
        }
    } else {
        // fine / coarse dots (45° offset grid)
        const dotSize = Math.max(1, Math.round(preset.dotSize * dpr));
        const half = tileW / 2;
        const drawDot = (cx, cy) => {
            if (dotSize <= 1.5) ctx.fillRect(Math.round(cx), Math.round(cy), 1, 1);
            else {
                ctx.beginPath();
                ctx.arc(cx, cy, dotSize / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        };
        drawDot(0, 0); drawDot(tileW, 0); drawDot(0, tileH); drawDot(tileW, tileH); drawDot(half, half);
    }
    return canvas;
}

/**
 * UI用プレビュー
 */
export function createTonePreview(preset, width = 48, height = 48) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    drawPatternOnCanvas(ctx, width, height, preset);
    return canvas;
}

function drawPatternOnCanvas(ctx, width, height, preset) {
    if (preset.type === 'diagonal') {
        const spacing = preset.spacing;
        const lineWidth = Math.ceil(preset.width);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const diff = x - y;
                const dist = ((diff % spacing) + spacing) % spacing;
                const minDist = Math.min(dist, spacing - dist);
                if (minDist < lineWidth) ctx.fillRect(x, y, 1, 1);
            }
        }
    } else if (preset.type === 'horizontal') {
        const spacing = preset.spacing;
        const lw = Math.max(1, Math.ceil(preset.width));
        for (let y = 0; y < height; y += spacing) {
            ctx.fillRect(0, y, width, lw);
        }
    } else if (preset.type === 'crosshatch') {
        const spacing = preset.spacing;
        const lw = Math.max(1, Math.ceil(preset.width));
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const d1 = ((x - y) % spacing + spacing) % spacing;
                const d2 = (x + y) % spacing;
                if (d1 < lw || d2 < lw) ctx.fillRect(x, y, 1, 1);
            }
        }
    } else if (preset.type === 'grid') {
        const spacing = preset.spacing;
        const lineWidth = Math.ceil(preset.width);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (x % spacing < lineWidth || y % spacing < lineWidth) ctx.fillRect(x, y, 1, 1);
            }
        }
    } else if (preset.type === 'honeycomb') {
        const s = preset.hexSize;
        const hexH = s * Math.sqrt(3);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        const drawHex = (cx, cy) => {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const px = cx + s * Math.cos(angle);
                const py = cy + s * Math.sin(angle);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
        };
        for (let col = -1; col * 1.5 * s < width + s; col++) {
            const cx = col * 1.5 * s;
            const isOdd = ((col % 2) + 2) % 2 === 1;
            for (let row = -1; row * hexH < height + hexH; row++) {
                drawHex(cx, row * hexH + (isOdd ? hexH / 2 : 0));
            }
        }
    } else if (preset.type === 'brick') {
        const spacing = preset.spacing;
        const bh = Math.max(2, Math.floor(spacing / 2));
        const lw = Math.max(1, Math.ceil(preset.width));
        for (let row = 0; row * bh <= height; row++) {
            const y = row * bh;
            ctx.fillRect(0, y, width, lw);
            const xOff = (row % 2 === 0) ? 0 : Math.floor(spacing / 2);
            for (let x = xOff; x <= width; x += spacing) {
                ctx.fillRect(x, y, lw, bh);
            }
        }
    } else if (preset.type === 'checker') {
        const spacing = preset.spacing;
        for (let y = 0; y < height; y += spacing) {
            for (let x = 0; x < width; x += spacing) {
                if ((Math.floor(x / spacing) + Math.floor(y / spacing)) % 2 === 0) {
                    ctx.fillRect(x, y, spacing, spacing);
                }
            }
        }
    } else if (preset.type === 'organic') {
        const spacing = preset.spacing;
        const dotSize = preset.dotSize;
        const randomness = preset.randomness;
        let seed = 12345;
        const seededRandom = () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
        const angle = Math.PI / 4;
        const cos45 = Math.cos(angle);
        const sin45 = Math.sin(angle);
        const diagonal = Math.sqrt(width * width + height * height);
        const startPos = -diagonal / 2;
        const endPos = diagonal / 2;
        for (let gy = startPos; gy < endPos; gy += spacing) {
            for (let gx = startPos; gx < endPos; gx += spacing) {
                const offsetX = (seededRandom() - 0.5) * spacing * randomness;
                const offsetY = (seededRandom() - 0.5) * spacing * randomness;
                const x = (gx + offsetX) * cos45 - (gy + offsetY) * sin45 + width / 2;
                const y = (gx + offsetX) * sin45 + (gy + offsetY) * cos45 + height / 2;
                if (x >= -dotSize && x < width + dotSize && y >= -dotSize && y < height + dotSize) {
                    const sv = 1 + (seededRandom() - 0.5) * randomness;
                    ctx.beginPath();
                    ctx.arc(x, y, (dotSize * sv) / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    } else {
        // fine / coarse dots
        const spacing = preset.spacing;
        const dotSize = preset.dotSize;
        const cos45 = Math.cos(Math.PI / 4);
        const sin45 = Math.sin(Math.PI / 4);
        const diagonal = Math.sqrt(width * width + height * height);
        for (let gy = -diagonal; gy < diagonal; gy += spacing) {
            for (let gx = -diagonal; gx < diagonal; gx += spacing) {
                const x = gx * cos45 - gy * sin45 + width / 2;
                const y = gx * sin45 + gy * cos45 + height / 2;
                ctx.beginPath();
                ctx.arc(x, y, dotSize / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}
