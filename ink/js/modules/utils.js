import { state } from './state.js';

// Get coordinates relative to the canvas, accounting for zoom and pan
export function getCanvasPoint(clientX, clientY) {
    return {
        x: (clientX - state.translateX) / state.scale,
        y: (clientY - state.translateY) / state.scale
    };
}

// Point-in-polygon test (ray casting algorithm)
export function isPointInPolygon(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x, yi = points[i].y;
        const xj = points[j].x, yj = points[j].y;

        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// Calculate bounding box of a set of points
// Returns { minX, minY, width, height }
export function getBounds(points, canvasWidth, canvasHeight) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length; i++) {
        const { x, y } = points[i];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    minX = Math.max(0, Math.floor(minX) - 1);
    minY = Math.max(0, Math.floor(minY) - 1);
    maxX = Math.min(canvasWidth, Math.ceil(maxX) + 1);
    maxY = Math.min(canvasHeight, Math.ceil(maxY) + 1);

    return {
        minX,
        minY,
        width: maxX - minX,
        height: maxY - minY
    };
}
