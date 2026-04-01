import { state, getActiveLayerCtx } from '../state.js';
import { getBounds, isPointInPolygon } from '../utils.js';
import { _makeMatchFn } from './fill.js';

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
function getTonePattern(ctx, preset) {
    const dpr = window.devicePixelRatio || 1;
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
function createPatternCanvas(preset, dpr = 1) {
    let size = 64;
    const spacing = Math.round(preset.spacing * dpr);

    if (preset.type === 'coarse' || preset.type === 'fine') {
        // For a 45 degree rotated dot grid, we can use a square tile
        // with dots at (0,0) and (S/2, S/2).
        // This ensures seamless tiling and perfect 45 degree angle.
        // We adjust the tile size S to be even and roughly match spacing * sqrt(2)
        let s = Math.round(spacing * 1.4142);
        if (s % 2 !== 0) s++; // Ensure even
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
        // Draw diagonal lines with correct 45-degree alignment for binary pixels
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const diff = (x - y + size) % size;
                if (diff < lw) {
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    } else if (preset.type === 'grid') {
        const lw = Math.max(1, Math.round(preset.width * dpr));
        ctx.fillRect(0, 0, size, lw);
        ctx.fillRect(0, 0, lw, size);
    } else if (preset.type === 'organic') {
        const dotSize = preset.dotSize * dpr;
        const randomness = preset.randomness || 0.3;
        
        // Coordinate-based hash for seamless tiling
        const hash = (x, y) => {
            let h = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
            return h - Math.floor(h);
        };

        const step = spacing;
        for (let y = 0; y < size; y += step) {
            for (let x = 0; x < size; x += step) {
                // Use fixed grid coordinates as seed for the hash
                const gx = x;
                const gy = y;
                
                const r1 = hash(gx, gy);
                const r2 = hash(gx + 123.456, gy + 789.012);
                const r3 = hash(gx - 456.789, gy - 234.567);

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

                    // Tiling neighbors
                    const neighbors = [];
                    if (cx < curSize) neighbors.push({ x: cx + size, y: cy });
                    if (cx > size - curSize) neighbors.push({ x: cx - size, y: cy });
                    if (cy < curSize) neighbors.push({ x: cx, y: cy + size });
                    if (cy > size - curSize) neighbors.push({ x: cx, y: cy - size });
                    
                    // Corners
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
        // Default dots (coarse, fine)
        const dotSize = Math.max(1, Math.round(preset.dotSize * dpr));
        const half = size / 2;

        const drawDot = (cx, cy) => {
            if (dotSize <= 1.5) {
                ctx.fillRect(Math.round(cx), Math.round(cy), 1, 1);
            } else {
                ctx.beginPath();
                ctx.arc(cx, cy, dotSize / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        };

        drawDot(0, 0);
        drawDot(size, 0);
        drawDot(0, size);
        drawDot(size, size);
        drawDot(half, half);
    }

    return canvas;
}

/**
 * Generates a preview canvas for the UI
 */
export function createTonePreview(preset, width = 48, height = 48) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Fill white (or transparent? UI has white background)
    // Actually presets draw black on transparent.
    // We should probably fill white first for visibility in menu?
    // The menu item has white background, so transparent is fine.

    // Draw pattern directly clipped to w/h
    ctx.fillStyle = '#000000';
    drawPatternOnCanvas(ctx, width, height, preset);

    return canvas;
}

/**
 * Draws pattern logic onto the context
 */
function drawPatternOnCanvas(ctx, width, height, preset) {
    if (preset.type === 'diagonal') {
        const spacing = preset.spacing;
        const lineWidth = Math.ceil(preset.width);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Diagonal x - y
                const diff = x - y;
                const dist = ((diff % spacing) + spacing) % spacing;
                const minDist = Math.min(dist, spacing - dist);
                if (minDist < lineWidth) {
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    } else if (preset.type === 'grid') {
        const spacing = preset.spacing;
        const lineWidth = Math.ceil(preset.width);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const xDist = x % spacing;
                const yDist = y % spacing;
                if (xDist < lineWidth || yDist < lineWidth) {
                    ctx.fillRect(x, y, 1, 1);
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

        ctx.fillStyle = '#000000';

        // Similar logic to tone app but applying to tile
        // To make organic seamless is hard. Let's make it large enough and clamp?
        // Or just accept it's "organic" and boundaries might show if pattern repeats?
        // For organic sanding, maybe we don't use pattern transform but draw directly?
        // But for fill tool, pattern is best. 
        // Let's rely on high randomness covering boundaries or large tile.

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
                    const sizeVariation = 1 + (seededRandom() - 0.5) * randomness;
                    const currentDotSize = dotSize * sizeVariation;
                    ctx.beginPath();
                    ctx.arc(x, y, currentDotSize / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    } else if (preset.type === 'coarse' || preset.type === 'fine') {
        const spacing = preset.spacing;
        const dotSize = preset.dotSize;
        const angle = Math.PI / 4;
        const cos45 = Math.cos(angle);
        const sin45 = Math.sin(angle);

        // Expanded drawing area to ensure rotation covers entire tile
        const diagonal = Math.sqrt(width * width + height * height);
        // Ensure coverage
        const extent = diagonal;

        for (let gy = -extent; gy < extent; gy += spacing) {
            for (let gx = -extent; gx < extent; gx += spacing) {
                const x = gx * cos45 - gy * sin45;
                const y = gx * sin45 + gy * cos45;
                const cx = x + width / 2;
                const cy = y + height / 2;

                ctx.beginPath();
                ctx.arc(cx, cy, dotSize / 2, 0, Math.PI * 2);
                ctx.fill();

                // Simple rotation logic:
                // grid point (gx, gy). Rotated -> (rx, ry).
                // We want seamless tiling. 
                // The issue with rotated grid is finding a tile size that repeats perfectly.
                // spacing = S. Rotated by 45deg. 
                // Period in X/Y becomes S / cos(45) = S * sqrt(2).
                // If S=10, Period=14.14... -> irrational, never repeats pixel perfect?
                // Actually, if we stick to integer math for drawing pixels (like Diag pattern), it repeats.
                // But circles are anti-aliased or sub-pixel.

                // Tone app uses a large canvas and fills it.
                // Here we want to fill arbitrary shapes.
                // ctx.createPattern is best but requires seamless tile.
                // If we can't easily make seamless rotated dots, we might need to draw them procedurally
                // over the target area (in drawTonePattern function) instead of using a pattern object.
                // Is drawing thousands of dots slow?
                // Tone app does it for 1000x1000 image. It takes ~150ms?
                // A Lasso fill is small usually, but could be large.
                // Drawing direct to canvas is safer for seamlessness (since we just use global loop).

                // Let's implement DIRECT drawing instead of createPattern for dots/organic.
                // It ensures global alignment (screen tone effect) if we base it on global coordinates?
                // Or user wants "texture" to move with layer?
                // Usually screen tones are fixed to the page (getting applied), but if we move the layer later,
                // the pattern moves with it. So drawing pixels into the layer is correct.
                // Global alignment is 'nice to have' but when filling separate islands, 
                // if they align, it looks like one sheet.
                // Default fillPoly logic aligns pattern to 0,0 of the canvas if using createPattern?
                // Yes, createPattern aligns to origin.
            }
        }
    }
}

// ============================================
// Tone Filling Logic
// ============================================

export function fillTone(points) {
    if (points.length < 3) return;

    const ctx = getActiveLayerCtx();
    if (!ctx) return;

    const preset = getCurrentTonePreset();
    if (!preset) return;

    const dpr = window.devicePixelRatio || 1;

    const minX = Math.floor(Math.min(...points.map(p => p.x)));
    const minY = Math.floor(Math.min(...points.map(p => p.y)));
    const maxX = Math.ceil(Math.max(...points.map(p => p.x)));
    const maxY = Math.ceil(Math.max(...points.map(p => p.y)));
    const width = maxX - minX;
    const height = maxY - minY;

    if (width <= 0 || height <= 0) return;

    // 物理ピクセルサイズでオフスクリーンキャンバスを作成 (DPR対応)
    const pWidth = Math.ceil(width * dpr);
    const pHeight = Math.ceil(height * dpr);
    const offscreen = document.createElement('canvas');
    offscreen.width = pWidth;
    offscreen.height = pHeight;
    const offCtx = offscreen.getContext('2d');

    // 物理ピクセル座標でクリッピングパス設定
    offCtx.beginPath();
    offCtx.moveTo((points[0].x - minX) * dpr, (points[0].y - minY) * dpr);
    for (let i = 1; i < points.length; i++) {
        offCtx.lineTo((points[i].x - minX) * dpr, (points[i].y - minY) * dpr);
    }
    offCtx.closePath();
    offCtx.clip();

    // 物理ピクセル座標にトランスレートしてパターン描画
    offCtx.translate(-minX * dpr, -minY * dpr);
    offCtx.fillStyle = '#000000';

    drawToneInRegion(offCtx, minX * dpr, minY * dpr, maxX * dpr, maxY * dpr, preset);

    binarizeCanvas(offCtx, pWidth, pHeight);

    // CSS座標でメインキャンバスに合成 (ctx は既に dpr スケール済み)
    ctx.drawImage(offscreen, minX, minY, width, height);
}

// ============================================
// Flood Fill for Tone
// ============================================

export function floodFillTone(startX, startY, tolerance = 'normal') {
    const ctx = getActiveLayerCtx();
    if (!ctx) {
        return;
    }

    const canvas = ctx.canvas;
    const w = canvas.width;
    const h = canvas.height;

    // CSS座標を物理ピクセル座標に変換
    const dpr = window.devicePixelRatio || 1;
    startX = Math.round(startX * dpr);
    startY = Math.round(startY * dpr);

    if (startX < 0 || startX >= w || startY < 0 || startY >= h) {
        return;
    }

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const idx = (startY * w + startX) * 4;
    const targetA = data[idx + 3];

    const matchTarget = _makeMatchFn(data, targetA, tolerance);

    const mask = new Uint8Array(w * h);
    let minX = startX, minY = startY, maxX = startX, maxY = startY;

    const stack = [[startX, startY]];
    let iterations = 0;
    const maxIterations = w * h;

    while (stack.length > 0 && iterations < maxIterations) {
        iterations++;
        let [x, y] = stack.pop();
        let i = (y * w + x) * 4;

        while (x >= 0 && matchTarget(i) && mask[y * w + x] === 0) {
            x--;
            i -= 4;
        }
        x++;
        i += 4;

        let spanAbove = false;
        let spanBelow = false;

        while (x < w && matchTarget(i) && mask[y * w + x] === 0) {
            mask[y * w + x] = 1;

            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;

            if (y > 0) {
                const aboveIndex = i - w * 4;
                if (matchTarget(aboveIndex) && mask[(y - 1) * w + x] === 0) {
                    if (!spanAbove) {
                        stack.push([x, y - 1]);
                        spanAbove = true;
                    }
                } else {
                    spanAbove = false;
                }
            }

            if (y < h - 1) {
                const belowIndex = i + w * 4;
                if (matchTarget(belowIndex) && mask[(y + 1) * w + x] === 0) {
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


    if (minX > maxX) {
        return;
    }

    const regionW = maxX - minX + 1;
    const regionH = maxY - minY + 1;

    // Create a temporary canvas for the final result
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = regionW;
    resultCanvas.height = regionH;
    const resultCtx = resultCanvas.getContext('2d');

    // 1. Draw the tone pattern to the result canvas
    resultCtx.fillStyle = '#000000';
    resultCtx.save();
    resultCtx.translate(-minX, -minY);
    const preset = getCurrentTonePreset();
    drawToneInRegion(resultCtx, minX, minY, maxX, maxY, preset);
    resultCtx.restore();

    // 2. Create the mask canvas
    const tempMaskCanvas = document.createElement('canvas');
    tempMaskCanvas.width = regionW;
    tempMaskCanvas.height = regionH;
    const tempMaskCtx = tempMaskCanvas.getContext('2d');
    const maskImgData = tempMaskCtx.createImageData(regionW, regionH);
    const mData = maskImgData.data;

    for (let y = 0; y < regionH; y++) {
        for (let x = 0; x < regionW; x++) {
            const gy = minY + y;
            const gx = minX + x;
            if (mask[gy * w + gx] === 1) {
                const midx = (y * regionW + x) * 4;
                mData[midx] = 0;
                mData[midx + 1] = 0;
                mData[midx + 2] = 0;
                mData[midx + 3] = 255;
            }
        }
    }
    tempMaskCtx.putImageData(maskImgData, 0, 0);

    // 3. Mask the pattern using destination-in
    resultCtx.globalCompositeOperation = 'destination-in';
    resultCtx.drawImage(tempMaskCanvas, 0, 0);

    // 4. Binarize to remove antialiasing
    binarizeCanvas(resultCtx, regionW, regionH);

    // 5. Finally draw to active layer
    ctx.drawImage(resultCanvas, minX / dpr, minY / dpr, regionW / dpr, regionH / dpr);
}

// Helper to binarize canvas (convert antialiased grays to pure black/white)
function binarizeCanvas(ctx, width, height) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const threshold = 1; // Any non-zero alpha becomes black

    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];

        if (alpha >= threshold) {
            // Opaque enough -> make fully black
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 255;
        } else {
            // Too transparent -> make fully transparent
            data[i + 3] = 0;
        }
    }

    ctx.putImageData(imgData, 0, 0);
}

// Helper function to draw tone in a region
function drawToneInRegion(ctx, minX, minY, maxX, maxY, preset) {
    const pattern = getTonePattern(ctx, preset);
    if (!pattern) return;

    ctx.save();
    // Use fillRect for the entire bounding box.
    // The context should already be clipped by the caller if needed.
    ctx.fillStyle = pattern;

    // Pattern alignment: Default tiling starts at 0,0 of the canvas.
    // Since we want the pattern to stay fixed relative to the image (page),
    // and ctx might have a transform (e.g. for lasso offscreen), 
    // we just use fillRect with the target bounds.
    // CanvasPattern stays aligned to the origin of the coordinate space.
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    ctx.restore();
}
