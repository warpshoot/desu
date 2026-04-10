import { state, CANVAS_DPR } from '../state.js';

// ============================================
// Tone Presets Configuration
// ============================================
export const TONE_PRESETS = [
    // Fine dots - Light tone (4 variations)
    { id: 'coarse1', name: 'B1', type: 'fine', spacing: 9, dotSize: 1 },
    { id: 'coarse2', name: 'B2', type: 'fine', spacing: 6, dotSize: 1 },
    { id: 'coarse3', name: 'B3', type: 'fine', spacing: 4, dotSize: 1 },
    { id: 'coarse4', name: 'B4', type: 'fine', spacing: 2, dotSize: 1 },
    // Fine dots - Medium tone (4 variations)
    { id: 'fine1', name: 'C1', type: 'fine', spacing: 20, dotSize: 2 },
    { id: 'fine2', name: 'C2', type: 'fine', spacing: 15, dotSize: 2 },
    { id: 'fine3', name: 'C3', type: 'fine', spacing: 10, dotSize: 2 },
    { id: 'fine4', name: 'C4', type: 'fine', spacing: 5, dotSize: 2 },
    // Diagonal lines (3 variations)
    { id: 'diag1', name: 'D1', type: 'diagonal', spacing: 12, angle: 45, width: 1 },
    { id: 'diag2', name: 'D2', type: 'diagonal', spacing: 8, angle: 45, width: 1 },
    { id: 'diag3', name: 'D3', type: 'diagonal', spacing: 4, angle: 45, width: 1 },
    // Grid patterns (3 variations)
    { id: 'grid1', name: 'E1', type: 'grid', spacing: 12, width: 1 },
    { id: 'grid2', name: 'E2', type: 'grid', spacing: 8, width: 1 },
    { id: 'grid3', name: 'E3', type: 'grid', spacing: 6, width: 1 },
    // Organic dots (2 variations)
    { id: 'organic1', name: 'F1', type: 'organic', spacing: 10, dotSize: 2, randomness: 0.3 },
    { id: 'organic2', name: 'F2', type: 'organic', spacing: 7, dotSize: 2, randomness: 0.3 }
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
// Pattern Generation
// ============================================

/**
 * Generates a tileable canvas for the given preset
 */
export function createPatternCanvas(preset, dpr = 1) {
    let size = 64;
    const spacing = Math.round(preset.spacing * dpr);

    if (preset.type === 'coarse' || preset.type === 'fine') {
        let s = Math.round(spacing * 1.4142);
        if (s % 2 !== 0) s++;
        size = s;
    } else if (preset.type === 'diagonal' || preset.type === 'grid') {
        size = spacing;
    } else if (preset.type === 'organic') {
        size = 512;
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#000000';

    if (preset.type === 'diagonal') {
        const lw = Math.max(1, Math.round(preset.width * dpr));
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const diff = (x - y + size) % size;
                if (diff < lw) ctx.fillRect(x, y, 1, 1);
            }
        }
    } else if (preset.type === 'grid') {
        const lw = Math.max(1, Math.round(preset.width * dpr));
        ctx.fillRect(0, 0, size, lw);
        ctx.fillRect(0, 0, lw, size);
    } else if (preset.type === 'organic') {
        const dotSize = preset.dotSize * dpr;
        const randomness = preset.randomness || 0.3;
        const hash = (x, y) => {
            let h = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
            return h - Math.floor(h);
        };
        const step = spacing;
        for (let y = 0; y < size; y += step) {
            for (let x = 0; x < size; x += step) {
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
                    if (cx < curSize) neighbors.push({ x: cx + size, y: cy });
                    if (cx > size - curSize) neighbors.push({ x: cx - size, y: cy });
                    if (cy < curSize) neighbors.push({ x: cx, y: cy + size });
                    if (cy > size - curSize) neighbors.push({ x: cx, y: cy - size });
                    if (cx < curSize && cy < curSize) neighbors.push({ x: cx + size, y: cy + size });
                    if (cx > size - curSize && cy < curSize) neighbors.push({ x: cx - size, y: cy + size });
                    if (cx < curSize && cy > size - curSize) neighbors.push({ x: cx + size, y: cy - size });
                    if (cx > size - curSize && cy > size - curSize) neighbors.push({ x: cx - size, y: cy - size });
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
        const dotSize = Math.max(1, Math.round(preset.dotSize * dpr));
        const half = size / 2;
        const drawDot = (cx, cy) => {
            if (dotSize <= 1.5) ctx.fillRect(Math.round(cx), Math.round(cy), 1, 1);
            else {
                ctx.beginPath();
                ctx.arc(cx, cy, dotSize / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        };
        drawDot(0, 0); drawDot(size, 0); drawDot(0, size); drawDot(size, size); drawDot(half, half);
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
    } else if (preset.type === 'grid') {
        const spacing = preset.spacing;
        const lineWidth = Math.ceil(preset.width);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (x % spacing < lineWidth || y % spacing < lineWidth) ctx.fillRect(x, y, 1, 1);
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
