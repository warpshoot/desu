import {
    state,
    getActiveLayerCtx,
    getActiveLayer,
    eventCanvas,
    strokeCanvas,
    strokeCtx
} from '../state.js';
import { getCanvasPoint } from '../utils.js';
import {
    saveState,
    commitRedoClear,
    restoreLayer
} from '../history.js';
import { applyTransform } from '../canvas.js';
import {
    addPendingPoints,
    setStraightLineEnd,
    setStrokeStartPoint,
    setLastStraightEnd,
    cancelAndFlushDrawPoints,
    clearStraightLineGuide,
    getLastStraightEnd
} from '../core/renderLoop.js';
import { handlePinchPan, handleGestureTaps } from './gestureHandler.js';
import { updateLayerThumbnail } from '../ui/layerPanel.js';
import { 
    startPenDrawing, 
    endPenDrawing, 
    drawPenLine, 
    previewStraightLine, 
    clearPenDirtyRect 
} from '../tools/pen.js';
import { 
    startStippleDrawing, 
    endStippleDrawing, 
    drawStippleLine, 
    getStippleDirtyRect, 
    clearStippleDirtyRect 
} from '../tools/stipple.js';
import {
    startLasso,
    updateLasso,
    finishLasso
} from '../tools/lasso.js';
import {
    executeLassoFill,
    executeBucketFill
} from '../tools/fill.js';
import {
    isInSelection,
    hasSelection,
    hasFloatingSelection,
    commitFloating,
    clearSelection,
    liftSelection,
    dragFloating,
    startRectSelect,
    updateRectSelect,
    finishRectSelect,
    startLassoSelect,
    updateLassoSelect,
    finishLassoSelect
} from '../tools/selection.js';
import { setSelectionToolbarInteractive } from '../ui/selectionUI.js';
import { hideUnpinnedMenus } from '../ui/menuManager.js';

let _thumbRafId = null;

export function setupPointerEvents(canvas) {
    // Attach pointerdown to window to catch events that Safari might drop/misdirect 
    // when a finger is holding a fixed UI element.
    window.addEventListener('pointerdown', (e) => {
        const isPen = e.pointerType === 'pen' || (e.pointerType === 'touch' && e.pressure > 0 && e.pressure < 1);
        
        // If it's a pen, we allow it even if the target is something else (like body) 
        // as long as it's not a UI button.
        const isTargetUI = e.target.closest('.mod-btn, .mode-btn, .brush-slot, #settings-panel');
        
        if (e.target === canvas || (isPen && !isTargetUI)) {
            handlePointerDown(e);
        }
    }, { capture: true, passive: false });
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerCancel);
    canvas.addEventListener('pointerleave', handlePointerUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

async function handlePointerDown(e) {
    const isPen = e.pointerType === 'pen' || (e.pointerType === 'touch' && e.pressure > 0 && e.pressure < 1);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // Prevent default to stop scrolling/zooming on the canvas area
    if (e.cancelable) e.preventDefault();

    if (!isIOS && !isPen) {
        const eventCanvas = document.getElementById('event-canvas');
        try {
            if (eventCanvas) eventCanvas.setPointerCapture(e.pointerId);
        } catch (err) { }
    }
    
    // If we already handled this pointer elsewhere, or if it's a non-pen touch on UI, return.
    if (state.activePointers.has(e.pointerId)) return;
    
    const eventCanvas = document.getElementById('event-canvas');
    if (!eventCanvas) return;

    hideUnpinnedMenus();

    state.activePointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        totalMove: 0,
        type: e.pointerType
    });

    if (state.activePointers.size === 1) {
        state.touchStartTime = Date.now();
        state.touchStartPos = { x: e.clientX, y: e.clientY };
        state.maxFingers = 1;
        state.isPinching = false;
        state.wasPanning = false;
        state.wasPinching = false;
        state.didInteract = false;
        state.totalDragDistance = 0;
        state.isPenSession = (e.pointerType === 'pen');
    } else if (e.pointerType === 'pen') {
        state.isPenSession = true;
    }
    state.maxFingers = Math.max(state.maxFingers, state.activePointers.size);

    if (state.activePointers.size === 2) {
        state.isPinching = false;
        const pts = Array.from(state.activePointers.values());
        state.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        state.lastPinchCenter = {
            x: (pts[0].x + pts[1].x) / 2,
            y: (pts[0].y + pts[1].y) / 2
        };
        state.initialPinchDist = state.lastPinchDist;
        state.initialPinchCenter = { ...state.lastPinchCenter };

        const isPenInvolved = isPen || state.isPenSession || state.isPenDrawing;
        if ((state.isPenDrawing || state.isLassoing) && e.pointerType !== 'pen') {
            const timeSinceFirstFinger = Date.now() - state.touchStartTime;
            const isTwoFingerTapIntent = timeSinceFirstFinger < 150;

            // If a pen is involved, we prioritize it and don't cancel drawing for secondary touches
            // BUT we still allow cancellation if it's a clear 2-finger tap intent for undo.
            if (!isPenInvolved || isTwoFingerTapIntent) {
                cancelCurrentOperation();
                if (!isTwoFingerTapIntent) state.didInteract = true;
            }
        }
        
        // If it's a finger touch on UI, we don't return early to avoid blocking the pen
        // but we ensure it doesn't trigger drawing logic.
        if (!isPen && e.target !== eventCanvas) return;
        if (!isPen && state.activePointers.size > 1 && !isPenInvolved) return;
    }

    if (state.activePointers.size === 1 && state.isSpacePressed) {
        state.isPanning = true;
        state.panStartX = e.clientX;
        state.panStartY = e.clientY;
        state.panStartTranslateX = state.translateX;
        state.panStartTranslateY = state.translateY;
        eventCanvas.style.cursor = 'grabbing';
        return;
    }

    if (isPen) {
        state.pencilDetected = true;
        state.isPenSession = true;
        if (state._pencilResetTimer) {
            clearTimeout(state._pencilResetTimer);
            state._pencilResetTimer = null;
        }
    }
    const canDraw = isPen || e.pointerType === 'mouse' || (e.pointerType === 'touch' && !state.pencilDetected);

    if (canDraw && (state.activePointers.size === 1 || isPen)) {
        state.drawingPointerId = e.pointerId;
        state.strokeMade = false;
        const canvasPoint = getCanvasPoint(e.clientX, e.clientY);

        if (state.mode === 'select') {
            if (hasFloatingSelection()) {
                if (isInSelection(canvasPoint.x, canvasPoint.y)) {
                    state.isMovingSelection = true;
                    state._selMoveStartX = e.clientX;
                    state._selMoveStartY = e.clientY;
                    setSelectionToolbarInteractive(false);
                } else {
                    await saveState();
                    commitFloating();
                    clearSelection();
                    if (window.updateAllThumbnails) window.updateAllThumbnails();
                    state.isMovingSelection = false;
                    if (state.subTool === 'rect') startRectSelect(e.clientX, e.clientY);
                    else startLassoSelect(e.clientX, e.clientY);
                }
            } else if (hasSelection() && isInSelection(canvasPoint.x, canvasPoint.y)) {
                state.isMovingSelection = true;
                state._selMoveStartX = e.clientX;
                state._selMoveStartY = e.clientY;
                setSelectionToolbarInteractive(false);
                await saveState();
                liftSelection(true);
            } else {
                if (hasFloatingSelection()) {
                    await saveState();
                    commitFloating();
                    if (window.updateAllThumbnails) window.updateAllThumbnails();
                }
                state.isMovingSelection = false;
                if (state.subTool === 'rect') startRectSelect(e.clientX, e.clientY);
                else startLassoSelect(e.clientX, e.clientY);
            }
        } else if (state.mode === 'pen') {
            if (state.subTool === 'stipple') {
                state._pendingSave = null;
                startStippleDrawing(canvasPoint.x, canvasPoint.y, e.pressure);
            } else {
                state._pendingSave = saveState({ keepRedo: true });
                startPenDrawing(canvasPoint.x, canvasPoint.y, e.pressure);
            }
            setStrokeStartPoint({ x: canvasPoint.x, y: canvasPoint.y });
            setLastStraightEnd(null);
        } else if (state.mode === 'fill') {
            startLasso(e.clientX, e.clientY);
        } else if (state.mode === 'eraser') {
            if (state.subTool === 'clear') {
                // Done via UI button mostly
            } else if (state.subTool === 'lasso') {
                startLasso(e.clientX, e.clientY);
            } else {
                state._pendingSave = saveState({ keepRedo: true });
                startPenDrawing(canvasPoint.x, canvasPoint.y, e.pressure);
                setStrokeStartPoint({ x: canvasPoint.x, y: canvasPoint.y });
                setLastStraightEnd(null);
            }
        }
        state._jumpFilterCount = 0;
        state._lastStablePoint = { x: e.clientX, y: e.clientY };
        state.strokeMade = true;
    }
}

function handlePointerMove(e) {
    if (state.isSaveMode) return;
    if (!state.activePointers.has(e.pointerId)) return;
    e.preventDefault();

    const pointer = state.activePointers.get(e.pointerId);
    const dx = e.clientX - pointer.x;
    const dy = e.clientY - pointer.y;
    pointer.totalMove += Math.hypot(dx, dy);
    pointer.x = e.clientX;
    pointer.y = e.clientY;

    if (handlePinchPan(e)) return;

    if (pointer.totalMove > 35) state.didInteract = true;

    if (e.pointerId === state.drawingPointerId) {
        const hasPenInPointers = Array.from(state.activePointers.values()).some(p => p.type === 'pen');
        const isPenInvolved = hasPenInPointers || state.isPenDrawing || state.isPenSession;
        if (!isPenInvolved && (state.wasPinching || state.wasPanning)) return;

        if (e.pointerType === 'pen' || e.pointerType === 'touch') {
            const last = state._lastStablePoint;
            if (last && state._jumpFilterCount < 3) {
                const dist = Math.hypot(e.clientX - last.x, e.clientY - last.y);
                const threshold = e.pointerType === 'pen' ? (window.innerWidth * 0.05) : (window.innerWidth * 0.03);
                if (dist > threshold) {
                    state._jumpFilterCount++;
                    return;
                }
            }
            state._lastStablePoint = { x: e.clientX, y: e.clientY };
            state._jumpFilterCount++;
        }

        const moveThreshold = e.pointerType === 'touch' ? 5 : 2;
        if (pointer.totalMove < moveThreshold && !state.isLassoing) return;

        const canvasPoint = getCanvasPoint(e.clientX, e.clientY);

        if (state.mode === 'select') {
            if (state.isMovingSelection && hasFloatingSelection()) {
                const dxS = (e.clientX - state._selMoveStartX) / state.scale;
                const dyS = (e.clientY - state._selMoveStartY) / state.scale;
                state._selMoveStartX = e.clientX;
                state._selMoveStartY = e.clientY;
                dragFloating(dxS, dyS);
                state.didInteract = true;
            } else if (!state.isMovingSelection) {
                if (state.subTool === 'rect') updateRectSelect(e.clientX, e.clientY);
                else updateLassoSelect(e.clientX, e.clientY);
            }
        } else if (state.isLassoing) {
            updateLasso(e.clientX, e.clientY);
        } else if (state.isPenDrawing) {
            const isShiftActive = state.isShiftPressed || (state._modShiftState && state._modShiftState !== 'idle');
            if (isShiftActive) {
                const pt = getCanvasPoint(e.clientX, e.clientY);
                setStraightLineEnd({ x: pt.x, y: pt.y, pressure: e.pressure });
            } else {
                const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
                const isStipple = state.mode === 'pen' && state.subTool === 'stipple';
                const pts = events.map(ev => {
                    const p = getCanvasPoint(ev.clientX, ev.clientY);
                    return { x: p.x, y: p.y, pressure: ev.pressure, isStipple };
                });
                addPendingPoints(pts);
            }
        }
    }
}

async function handlePointerUp(e) {
    if (state.isSaveMode) return;
    e.preventDefault();
    if (!state.activePointers.has(e.pointerId)) return;

    if (state.isPanning) {
        state.isPanning = false;
        eventCanvas.style.cursor = '';
    }

    const pointer = state.activePointers.get(e.pointerId);
    if (pointer && pointer.totalMove > 20) state.didInteract = true;
    state.activePointers.delete(e.pointerId);

    try { eventCanvas.releasePointerCapture(e.pointerId); } catch (err) { }

    if (e.pointerType === 'pen' && state.pencilDetected) {
        state._pencilResetTimer = setTimeout(() => {
            state.pencilDetected = false;
            state._pencilResetTimer = null;
        }, 500);
    }

    if (state.activePointers.size < 2) state.isPinching = false;

    if (state.activePointers.size === 0) {
        await handleGestureTaps();
        
        // Handle pending shift cancel from miscUI.js (palm rejection protection)
        if (state._modShiftPendingCancel) {
            state._modShiftPendingCancel = false;
            state._modShiftState = 'idle';
            if (window.updateModifierBar) window.updateModifierBar();
        }

        delete state._lastPenPoint;
        delete state.isPenSession;
    }

    if (e.pointerId === state.drawingPointerId) {
        if (state.mode === 'select') {
            if (state.isMovingSelection) {
                state.isMovingSelection = false;
                setSelectionToolbarInteractive(true);
                if (window.updateSelectToolbar) window.updateSelectToolbar();
            } else {
                if (state.subTool === 'rect') finishRectSelect();
                else finishLassoSelect();
                const wasClick = pointer && pointer.totalMove < 15;
                if (wasClick && !hasSelection()) clearSelection();
                if (window.updateSelectToolbar) window.updateSelectToolbar();
            }
        } else if (state.isLassoing) {
            const points = finishLasso();
            const wasClick = pointer && pointer.totalMove < 15;
            const duration = Date.now() - state.touchStartTime;

            // Common config lookup
            const slot = state.mode === 'fill' ? state.fillSlots[state.activeFillSlotIndex] : state.activeEraserSlot;

            if (wasClick && duration < 500 && !state.wasPanning && !state.wasPinching) {
                const bucketEnabled = slot ? (slot.bucketEnabled !== false) : true;
                if (bucketEnabled) {
                    const cp = getCanvasPoint(e.clientX, e.clientY);
                    await saveState();
                    const ctx = getActiveLayerCtx();
                    if (ctx) {
                        const { pushSelectionClip, popSelectionClip } = await import('../tools/selection.js');
                        const clipped = pushSelectionClip(ctx);
                        await executeBucketFill(cp.x, cp.y, slot);
                        if (clipped) popSelectionClip(ctx);
                    }
                    updateLayerThumbnail(getActiveLayer());
                    await saveState({ keepRedo: true });
                }
            } else if (points && points.length >= 3 && !state.wasPanning && !state.wasPinching) {
                await saveState();
                const ctx = getActiveLayerCtx();
                if (ctx) {
                    const { pushSelectionClip, popSelectionClip } = await import('../tools/selection.js');
                    const clipped = pushSelectionClip(ctx);
                    await executeLassoFill(points, slot);
                    if (clipped) popSelectionClip(ctx);
                }
                updateLayerThumbnail(getActiveLayer());
                await saveState({ keepRedo: true });
            }
        } else if (state.isPenDrawing) {
            const straightEnd = getLastStraightEnd();
            cancelAndFlushDrawPoints();
            commitRedoClear();
            await saveState({ keepRedo: true });
            state._pendingSave = null;

            if (state.mode === 'pen' && state.subTool === 'stipple') {
                if (straightEnd) drawStippleLine(straightEnd.x, straightEnd.y, straightEnd.pressure);
                endStippleDrawing();
                clearStippleDirtyRect();
            } else {
                if (straightEnd) {
                    if (state.mode === 'pen') previewStraightLine(straightEnd.x, straightEnd.y);
                    else drawPenLine(straightEnd.x, straightEnd.y, straightEnd.pressure);
                }
                endPenDrawing();
                clearPenDirtyRect();
            }

            if (_thumbRafId) cancelAnimationFrame(_thumbRafId);
            const _tl = getActiveLayer();
            _thumbRafId = requestAnimationFrame(() => {
                updateLayerThumbnail(_tl);
                _thumbRafId = null;
            });
            clearStraightLineGuide();
        }
        state.drawingPointerId = null;
    }
    state.isPenDrawing = false;
    state.isLassoing = false;
    state.strokeMade = false;
}

function handlePointerCancel(e) {
    if (state.activePointers.has(e.pointerId)) state.activePointers.delete(e.pointerId);
    try { eventCanvas.releasePointerCapture(e.pointerId); } catch (err) { }
    if (e.pointerId === state.drawingPointerId) cancelCurrentOperation();
    if (state.activePointers.size === 0) {
        state.isPanning = false;
        state.isPinching = false;
        eventCanvas.style.cursor = '';
    }
}

function cancelCurrentOperation() {
    cancelAndFlushDrawPoints();
    if (state.isLassoing) finishLasso();
    if (state.isPenDrawing) {
        const layer = getActiveLayer();
        if (layer) restoreLayer(layer.id);
        if (strokeCanvas && strokeCtx) {
            strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
        }
        state.undoStack.pop();
        state.isPenDrawing = false;
    }
    state.drawingPointerId = null;
    state.isLassoing = false;
    state.strokeMade = false;
}
