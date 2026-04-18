/**
 * shapes.js - Geometric Shape Drawing Engine
 * Standard raster-based shape drawing with brush-aware stroking and filling.
 */

import { state, CANVAS_DPR } from '../state.js';

/**
 * Draw a shape preview or finalized shape to a context
 * @param {CanvasRenderingContext2D} ctx - Target context
 * @param {string} type - 'line'|'rect'|'circle'|'poly'|'star'
 * @param {number} x0, y0 - Start point (canvas coordinates)
 * @param {number} x1, y1 - End point (canvas coordinates)
 * @param {Object} options - { isFill, isStroke, size, sides, ratio, antiAlias }
 * @param {boolean} isPerfect - Whether to constrain aspect ratio (Shift/Line mod)
 */
export function drawShape(ctx, type, x0, y0, x1, y1, options, isPerfect = false) {
    const { isFill, isStroke, size, sides = 5, ratio = 0.5, antiAlias = true, rotation = 0, fromCenter = false } = options;

    ctx.save();
    ctx.imageSmoothingEnabled = antiAlias;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';

    // fromCenter: start point becomes the center, expand bounding box symmetrically
    if (fromCenter && type !== 'line') {
        const dx = x1 - x0;
        const dy = y1 - y0;
        x1 = x0 + dx;
        y1 = y0 + dy;
        x0 = x0 - dx;
        y0 = y0 - dy;
    }

    // Calculate bounding box and perfect constraints
    let dx = x1 - x0;
    let dy = y1 - y0;

    if (isPerfect) {
        if (type === 'line') {
            // Snap to 45 degree increments
            const angle = Math.atan2(dy, dx);
            const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
            const dist = Math.hypot(dx, dy);
            dx = Math.cos(snappedAngle) * dist;
            dy = Math.sin(snappedAngle) * dist;
            x1 = x0 + dx;
            y1 = y0 + dy;
        } else {
            // Square / Perfect Circle
            const side = Math.max(Math.abs(dx), Math.abs(dy));
            dx = Math.sign(dx) * side;
            dy = Math.sign(dy) * side;
            x1 = x0 + dx;
            y1 = y0 + dy;
        }
    }

    // Apply rotation transform around shape center (not for line)
    if (rotation !== 0 && type !== 'line') {
        const cx = x0 + dx / 2;
        const cy = y0 + dy / 2;
        const rotRad = rotation * Math.PI / 180;
        ctx.translate(cx, cy);
        ctx.rotate(rotRad);
        ctx.translate(-cx, -cy);
    }

    ctx.beginPath();

    switch (type) {
        case 'line':
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            break;

        case 'rect': {
            const rx = dx < 0 ? x1 : x0;
            const ry = dy < 0 ? y1 : y0;
            ctx.rect(rx, ry, Math.abs(dx), Math.abs(dy));
            break;
        }

        case 'circle': {
            const centerX = x0 + dx / 2;
            const centerY = y0 + dy / 2;
            const radiusX = Math.abs(dx / 2);
            const radiusY = Math.abs(dy / 2);
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
            break;
        }

        case 'poly': {
            const centerX = x0 + dx / 2;
            const centerY = y0 + dy / 2;
            const radius = Math.hypot(dx, dy) / 2;
            _drawRegularPolygon(ctx, centerX, centerY, radius, sides, 0);
            break;
        }

        case 'star': {
            const centerX = x0 + dx / 2;
            const centerY = y0 + dy / 2;
            const outerRadius = Math.hypot(dx, dy) / 2;
            const innerRadius = outerRadius * ratio;
            _drawStar(ctx, centerX, centerY, outerRadius, innerRadius, sides, 0);
            break;
        }
    }

    if (isFill) ctx.fill();
    if (isStroke) ctx.stroke();

    ctx.restore();
}

/**
 * Helper: Regular Polygon path
 */
function _drawRegularPolygon(ctx, cx, cy, radius, sides, rotation) {
    if (sides < 3) return;
    for (let i = 0; i < sides; i++) {
        const angle = rotation + (i * 2 * Math.PI) / sides - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
}

/**
 * Helper: Star path
 */
function _drawStar(ctx, cx, cy, outerRadius, innerRadius, points, rotation) {
    if (points < 2) return;
    for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = rotation + (i * Math.PI) / points - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
}
