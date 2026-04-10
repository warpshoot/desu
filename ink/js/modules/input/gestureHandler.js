import { state } from '../state.js';
import { applyTransform } from '../canvas.js';
import { undo, redo } from '../history.js';
import { renderLayerButtons, updateAllThumbnails } from '../ui/layerPanel.js';
import { resizeSelectionOverlay } from '../tools/selection.js';

let _lastGestureTime = 0;
const _GESTURE_COOLDOWN_MS = 500;

export function handleWheel(e, eventCanvas) {
    e.preventDefault();

    const zoomSpeed = 0.001;
    const delta = -e.deltaY * zoomSpeed;
    const newScale = Math.min(Math.max(state.scale * (1 + delta), 0.1), 10);

    const rect = eventCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleFactor = newScale / state.scale;
    state.translateX = mouseX - (mouseX - state.translateX) * scaleFactor;
    state.translateY = mouseY - (mouseY - state.translateY) * scaleFactor;
    state.scale = newScale;

    applyTransform();
    resizeSelectionOverlay();
}

export function handlePinchPan(e) {
    const hasPenInPointers = Array.from(state.activePointers.values()).some(p => p.type === 'pen');
    const isPenInvolved = hasPenInPointers || state.isPenDrawing || state.isPenSession;

    if (state.activePointers.size === 2 && !isPenInvolved) {
        const pts = Array.from(state.activePointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const center = {
            x: (pts[0].x + pts[1].x) / 2,
            y: (pts[0].y + pts[1].y) / 2
        };

        const distDelta = Math.abs(dist - state.initialPinchDist);
        const centerDelta = Math.hypot(center.x - state.initialPinchCenter.x, center.y - state.initialPinchCenter.y);

        if (distDelta > 20 || centerDelta > 20) {
            state.isPinching = true;
            state.wasPinching = true;
            state.didInteract = true;
        }

        if (state.isPinching) {
            const zoomFactor = dist / state.lastPinchDist;
            const oldScale = state.scale;
            state.scale = Math.min(Math.max(state.scale * zoomFactor, 0.1), 10);

            state.translateX = center.x - (center.x - state.translateX) * (state.scale / oldScale);
            state.translateY = center.y - (center.y - state.translateY) * (state.scale / oldScale);

            state.translateX += center.x - state.lastPinchCenter.x;
            state.translateY += center.y - state.lastPinchCenter.y;

            applyTransform();
            resizeSelectionOverlay();
        }

        state.lastPinchDist = dist;
        state.lastPinchCenter = center;
        return true; // Handled
    }

    if (state.isPanning && state.activePointers.size === 1) {
        state.translateX = state.panStartTranslateX + (e.clientX - state.panStartX);
        state.translateY = state.panStartTranslateY + (e.clientY - state.panStartY);
        applyTransform();
        resizeSelectionOverlay();
        state.wasPanning = true;
        state.didInteract = true;
        return true; // Handled
    }

    return false; // Not handled
}

export async function handleGestureTaps() {
    const now = Date.now();
    const duration = now - state.touchStartTime;
    const isTap = duration < 400 && !state.didInteract && !state.strokeMade && !state.wasPanning && !state.wasPinching;
    
    if (isTap && !state.isPenSession && (now - _lastGestureTime > _GESTURE_COOLDOWN_MS)) {
        if (state.maxFingers === 2) {
            _lastGestureTime = now;
            await undo();
            renderLayerButtons();
            updateAllThumbnails();
            return true;
        } else if (state.maxFingers === 3) {
            _lastGestureTime = now;
            await redo();
            renderLayerButtons();
            updateAllThumbnails();
            return true;
        }
    }
    return false;
}
