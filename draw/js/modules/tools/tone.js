import { state, getActiveLayerCtx } from '../state.js';
import { getBounds, isPointInPolygon } from '../utils.js';

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
function createPatternCanvas(preset) {
    // Determine tile size based on pattern type and spacing
    // For seamless tiling, size should be a multiple of spacing or calculated based on geometry
    let size = 64; // Default base size

    if (preset.type === 'coarse' || preset.type === 'fine') {
        // Dot patterns at 45 degree need specific sizing for seamless tiling
        // The dot grid is rotated 45 deg.
        // Grid spacing along axis = spacing
        // Diagonal distance = spacing * sqrt(2)
        // We need a tile size that matches the repetition
        // Actually, easiest way is to draw a large enough area or calculate LCM
        // For simple dots, let's use a large enough fixed tile or generate on fly.
        // Generating a small seamless tile for rotated grid is tricky.
        // Let's use a reasonably sized canvas that covers common LCMs or just enough.
        size = 120; // Multiple of 2, 3, 4, 5, 8, 10, 12...
    } else if (preset.type === 'diagonal') {
        size = preset.spacing * 4; // Ensure it's a multiple of spacing
    } else if (preset.type === 'grid') {
        size = preset.spacing * 4;
    } else if (preset.type === 'organic') {
        size = 256; // Larger tile for randomness
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Fill transparent
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#000000'; // Tone is always black

    drawPatternOnCanvas(ctx, size, size, preset);

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

    const minX = Math.floor(Math.min(...points.map(p => p.x)));
    const minY = Math.floor(Math.min(...points.map(p => p.y)));
    const maxX = Math.ceil(Math.max(...points.map(p => p.x)));
    const maxY = Math.ceil(Math.max(...points.map(p => p.y)));
    const width = maxX - minX;
    const height = maxY - minY;

    if (width <= 0 || height <= 0) return;

    // Offscreen canvas with clipping
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d');

    // Set up clipping path
    offCtx.beginPath();
    offCtx.moveTo(points[0].x - minX, points[0].y - minY);
    for (let i = 1; i < points.length; i++) {
        offCtx.lineTo(points[i].x - minX, points[i].y - minY);
    }
    offCtx.closePath();
    offCtx.clip();

    // Translate for global alignment
    offCtx.translate(-minX, -minY);
    offCtx.fillStyle = '#000000';

    // Draw tone pattern
    drawToneInRegion(offCtx, minX, minY, maxX, maxY, preset);

    // Binarize to remove antialiasing
    binarizeCanvas(offCtx, width, height);

    // Composite to main canvas
    ctx.drawImage(offscreen, minX, minY);
}

// ============================================
// Flood Fill for Tone
// ============================================

export function floodFillTone(startX, startY) {
    console.log('[DEBUG] floodFillTone called with', startX, startY);
    const ctx = getActiveLayerCtx();
    if (!ctx) {
        console.log('[DEBUG] No context, returning');
        return;
    }

    const canvas = ctx.canvas;
    const w = canvas.width;
    const h = canvas.height;

    console.log('[DEBUG] Canvas size:', w, h);

    if (startX < 0 || startX >= w || startY < 0 || startY >= h) {
        console.log('[DEBUG] Start point out of bounds, returning');
        return;
    }

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const idx = (startY * w + startX) * 4;
    const targetR = data[idx];
    const targetG = data[idx + 1];
    const targetB = data[idx + 2];
    const targetA = data[idx + 3];

    console.log('[DEBUG] Target color:', targetR, targetG, targetB, targetA);

    const matchTarget = (i) => data[i] === targetR && data[i + 1] === targetG && data[i + 2] === targetB && data[i + 3] === targetA;

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

    console.log('[DEBUG] Flood fill complete, iterations:', iterations);
    console.log('[DEBUG] Region bounds:', minX, minY, maxX, maxY);

    if (minX > maxX) {
        console.log('[DEBUG] Invalid region, returning');
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
    ctx.drawImage(resultCanvas, minX, minY);
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
    const spacing = preset.spacing;

    if (preset.type === 'coarse' || preset.type === 'fine') {
        const dotSize = Math.round(preset.dotSize);
        const angle = Math.PI / 4;
        const cos45 = Math.cos(angle);
        const sin45 = Math.sin(angle);

        const corners = [
            { x: minX, y: minY },
            { x: maxX, y: minY },
            { x: maxX, y: maxY },
            { x: minX, y: maxY }
        ];

        let minGx = Infinity, maxGx = -Infinity;
        let minGy = Infinity, maxGy = -Infinity;

        corners.forEach(p => {
            const gx = p.x * cos45 + p.y * sin45;
            const gy = -p.x * sin45 + p.y * cos45;
            minGx = Math.min(minGx, gx);
            maxGx = Math.max(maxGx, gx);
            minGy = Math.min(minGy, gy);
            maxGy = Math.max(maxGy, gy);
        });

        const padding = spacing * 2;
        minGx -= padding;
        maxGx += padding;
        minGy -= padding;
        maxGy += padding;

        const startGx = Math.floor(minGx / spacing) * spacing;
        const startGy = Math.floor(minGy / spacing) * spacing;

        for (let gy = startGy; gy < maxGy; gy += spacing) {
            for (let gx = startGx; gx < maxGx; gx += spacing) {
                const x = gx * cos45 - gy * sin45;
                const y = gx * sin45 + gy * cos45;

                // Draw square dots pixel-by-pixel to avoid antialiasing
                const centerX = Math.round(x);
                const centerY = Math.round(y);
                const halfSize = Math.floor(dotSize / 2);

                for (let dy = -halfSize; dy <= halfSize; dy++) {
                    for (let dx = -halfSize; dx <= halfSize; dx++) {
                        const px = centerX + dx;
                        const py = centerY + dy;
                        if (px >= minX && px < maxX && py >= minY && py < maxY) {
                            ctx.fillRect(px, py, 1, 1);
                        }
                    }
                }
            }
        }
    } else if (preset.type === 'organic') {
        const spacing = preset.spacing;
        const dotSize = preset.dotSize;
        const randomness = preset.randomness || 0.3;
        const angle = Math.PI / 4;
        const cos45 = Math.cos(angle);
        const sin45 = Math.sin(angle);

        const corners = [
            { x: minX, y: minY }, { x: maxX, y: minY },
            { x: maxX, y: maxY }, { x: minX, y: maxY }
        ];

        let minGx = Infinity, maxGx = -Infinity;
        let minGy = Infinity, maxGy = -Infinity;

        corners.forEach(p => {
            const gx = p.x * cos45 + p.y * sin45;
            const gy = -p.x * sin45 + p.y * cos45;
            minGx = Math.min(minGx, gx);
            maxGx = Math.max(maxGx, gx);
            minGy = Math.min(minGy, gy);
            maxGy = Math.max(maxGy, gy);
        });

        const startGx = Math.floor((minGx - spacing) / spacing) * spacing;
        const startGy = Math.floor((minGy - spacing) / spacing) * spacing;
        const endGx = maxGx + spacing;
        const endGy = maxGy + spacing;

        const hash = (x, y) => {
            let h = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
            return h - Math.floor(h);
        };

        for (let gy = startGy; gy < endGy; gy += spacing) {
            for (let gx = startGx; gx < endGx; gx += spacing) {
                const r1 = hash(gx, gy);
                const r2 = hash(gx + 1000, gy + 1000);
                const r3 = hash(gx - 500, gy - 500);

                const offsetX = (r1 - 0.5) * spacing * randomness;
                const offsetY = (r2 - 0.5) * spacing * randomness;

                const x = (gx + offsetX) * cos45 - (gy + offsetY) * sin45;
                const y = (gx + offsetX) * sin45 + (gy + offsetY) * cos45;

                const sizeVar = 1 + (r3 - 0.5) * randomness;
                const currentDotSize = dotSize * sizeVar;

                ctx.beginPath();
                ctx.arc(x, y, currentDotSize / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } else if (preset.type === 'diagonal') {
        // Draw diagonal lines pixel-by-pixel to avoid antialiasing
        const spacing = preset.spacing;
        const lineWidth = Math.ceil(preset.width);

        for (let y = minY; y < maxY; y++) {
            for (let x = minX; x < maxX; x++) {
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
        const lw = preset.width;
        const startGridX = Math.floor(minX / spacing) * spacing;
        const startGridY = Math.floor(minY / spacing) * spacing;

        for (let x = startGridX; x < maxX; x += spacing) {
            ctx.fillRect(x, minY, lw, maxY - minY);
        }
        for (let y = startGridY; y < maxY; y += spacing) {
            ctx.fillRect(minX, y, maxX - minX, lw);
        }
    }
}
