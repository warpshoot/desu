import { state } from './state.js';

// Get coordinates relative to the canvas, accounting for zoom and pan
export function getCanvasPoint(clientX, clientY) {
    return {
        x: Math.round((clientX - state.translateX) / state.scale),
        y: Math.round((clientY - state.translateY) / state.scale)
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
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.max(0, Math.floor(Math.min(...xs)) - 1);
    const minY = Math.max(0, Math.floor(Math.min(...ys)) - 1);
    const maxX = Math.min(canvasWidth, Math.ceil(Math.max(...xs)) + 1);
    const maxY = Math.min(canvasHeight, Math.ceil(Math.max(...ys)) + 1);

    return {
        minX,
        minY,
        width: maxX - minX,
        height: maxY - minY
    };
}

// Debug logging helper
export function addToDebugLog(message, isError = false) {
    const debugLog = document.getElementById('debug-log');
    if (!debugLog) return;

    const div = document.createElement('div');
    if (isError) {
        div.style.color = '#f00';
    }
    div.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    debugLog.appendChild(div);
    debugLog.scrollTop = debugLog.scrollHeight;
}
