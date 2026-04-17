import {
    state,
    getActiveLayerCtx,
    getActiveLayer,
    eventCanvas,
    strokeCanvas,
    strokeCtx
} from '../state.js';

const UI_MONITOR_SELECTORS = '#toolbar-left, #toolbar-right, #modifier-bar, #layer-panel, #select-toolbar, #resetZoomBtn, .tool-menu:not(.hidden), .flyout-menu:not(.hidden), #fill-settings-panel:not(.hidden), #eraser-settings-panel:not(.hidden), #brush-settings-panel:not(.hidden)';
import { getCanvasPoint } from '../utils.js';
import {
    saveState,
    commitRedoClear,
    restoreLayer,
    syncLayerFingerprint
} from '../history.js';
import { applyTransform, zoomAtPoint } from '../canvas.js';
import {
    addPendingPoints,
    setStraightLineEnd,
    setStrokeStartPoint,
    setLastStraightEnd,
    cancelAndFlushDrawPoints,
    clearStraightLineGuide,
    getLastStraightEnd,
    getStrokeBounds,
    resetStrokeBounds
} from '../core/renderLoop.js';
import { handlePinchPan, handleGestureTaps } from './gestureHandler.js';
import { executeClearLayer } from '../ui/toolPanel.js';
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
    finishLassoSelect,
    pushSelectionClip,
    popSelectionClip
} from '../tools/selection.js';
import { setSelectionToolbarInteractive } from '../ui/selectionUI.js';
import { hideAllMenus, isAnyMenuOpen, hideUnpinnedMenus } from '../ui/menuManager.js';

let _thumbRafId = null;

export function setupPointerEvents(canvas) {
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerCancel);
    canvas.addEventListener('pointerleave', handlePointerUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

async function handlePointerDown(e) {
    const isPen = e.pointerType === 'pen';
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (e.cancelable) e.preventDefault();

    if (!isIOS && !isPen) {
        try {
            const eventCanvas = document.getElementById('event-canvas');
            if (eventCanvas) eventCanvas.setPointerCapture(e.pointerId);
        } catch (err) { }
    }

    if (isAnyMenuOpen()) {
        hideAllMenus();
        return;
    }

    if (e.target !== document.getElementById('event-canvas') && !isPen) return;
    
    // If we already handled this pointer elsewhere, return.
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
        state._gestureActionFired = false;
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

        // If we are starting a multi-touch session, cancel any active drawing.
        // didInteract は意図的にセットしない:
        // 1本目の着地で startPenDrawing が走っていても、それは 2本指ジェスチャーの
        // 前置きに過ぎない。ここで didInteract=true にすると handleGestureTaps の
        // タップ判定が潰れ、2本指アンドゥ/3本指リドゥが効かなくなる。
        // 実際に移動・ピンチ・パンがあれば後続の handlePointerMove で didInteract が立つ。
        if (state.isPenDrawing || state.isLassoing) {
            cancelCurrentOperation();
        }
        
        // Prevent drawing with the second pointer
        if (!isPen) return;
    }

    if (state.activePointers.size === 1 && state.isSpacePressed && (e.ctrlKey || e.metaKey)) {
        const factor = (e.altKey || state.isAltPressed) ? 0.9 : 1.1;
        zoomAtPoint(factor, e.clientX, e.clientY);
        return;
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
        document.body.classList.add('is-drawing-active');

        // Optimize: Lazy cache UI rects to avoid DOM query on every stroke
        if (!state._uiCollisionRects) {
            state._uiCollisionRects = Array.from(document.querySelectorAll(UI_MONITOR_SELECTORS))
                .map(el => { return { el, rect: el.getBoundingClientRect(), isFaded: false }; });
        }
        const canvasPoint = getCanvasPoint(e.clientX, e.clientY);

        if (state.mode === 'select') {
            if (hasFloatingSelection()) {
                if (isInSelection(canvasPoint.x, canvasPoint.y)) {
                    state.isMovingSelection = true;
                    state._selMoveStartX = e.clientX;
                    state._selMoveStartY = e.clientY;
                    setSelectionToolbarInteractive(false);
                } else {
                    commitFloating();
                    await saveState();
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
                commitFloating();
                await saveState();
                if (window.updateAllThumbnails) window.updateAllThumbnails();
            }
                state.isMovingSelection = false;
                if (state.subTool === 'rect') startRectSelect(e.clientX, e.clientY);
                else startLassoSelect(e.clientX, e.clientY);
            }
        } else if (state.mode === 'pen') {
            resetStrokeBounds();
            if (state.subTool === 'stipple') {
                startStippleDrawing(canvasPoint.x, canvasPoint.y, e.pressure);
            } else {
                startPenDrawing(canvasPoint.x, canvasPoint.y, e.pressure);
            }
            setStrokeStartPoint({ x: canvasPoint.x, y: canvasPoint.y });
            setLastStraightEnd(null);
        } else if (state.mode === 'fill') {
            resetStrokeBounds();
            startLasso(e.clientX, e.clientY);
        } else if (state.mode === 'eraser') {
            if (state.subTool === 'clear') {
                executeClearLayer();
                return;
            } else if (state.subTool === 'lasso') {
                resetStrokeBounds();
                startLasso(e.clientX, e.clientY);
            } else {
                resetStrokeBounds();
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
        // UI Collision Detection Throttling:
        // Check only if the pointer has moved significantly (e.g., > 10px) or if we don't have a last check position
        const distSinceLastUIAuto = state._lastUICheckX !== undefined 
            ? Math.hypot(e.clientX - state._lastUICheckX, e.clientY - state._lastUICheckY)
            : 999;

        if (state._uiCollisionRects && distSinceLastUIAuto > 15) {
            state._lastUICheckX = e.clientX;
            state._lastUICheckY = e.clientY;
            const prox = 40;
            for (let item of state._uiCollisionRects) {
                const r = item.rect;
                if (e.clientX >= r.left - prox && e.clientX <= r.right + prox &&
                    e.clientY >= r.top - prox && e.clientY <= r.bottom + prox) {
                    if (!item.isFaded) {
                        item.el.classList.add('ui-faded');
                        item.isFaded = true;
                    }
                } else if (item.isFaded) {
                    item.el.classList.remove('ui-faded');
                    item.isFaded = false;
                }
            }
        }

        let hasPenInPointers = false;
        for (const p of state.activePointers.values()) {
            if (p.type === 'pen') {
                hasPenInPointers = true;
                break;
            }
        }
        const isPenInvolved = hasPenInPointers || state.isPenDrawing || state.isPenSession;
        if (!isPenInvolved && (state.wasPinching || state.wasPanning)) return;

        if (e.pointerType === 'pen' || e.pointerType === 'touch') {
            const last = state._lastStablePoint;
            if (last && state._jumpFilterCount < 3) {
                const dist = Math.hypot(e.clientX - last.x, e.clientY - last.y);
                const timeStarted = state.touchStartTime || Date.now();
                const timeElapsed = Date.now() - timeStarted;
                
                // システムの遅延（ラグ）がある場合、最初の移動距離が大きくなるのは自然。
                // 経過時間が長い場合は閾値を大幅に引き上げる。
                // 描画開始直後（ジャンプフィルタの試行回数が少ない時）は特にラグの影響を受けやすい。
                const lagFactor = timeElapsed > 80 ? 4 : (timeElapsed > 30 ? 2 : 1);
                // ペン入力（高精細）はジャンプが起きにくいため、しれきい値を大幅に上げて「ハネ」の誤検出を防ぐ
                const threshold = (e.pointerType === 'pen' ? (window.innerWidth * 0.15) : (window.innerWidth * 0.04)) * lagFactor;
                
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
                const events = (e.getCoalescedEvents && e.pointerType !== 'touch') ? e.getCoalescedEvents() : [e];
                const predicted = (e.getPredictedEvents && e.pointerType !== 'touch') ? e.getPredictedEvents() : [];
                
                const isStipple = state.mode === 'pen' && state.subTool === 'stipple';
                
                const pts = events.map(ev => {
                    const p = getCanvasPoint(ev.clientX, ev.clientY);
                    return { x: p.x, y: p.y, pressure: ev.pressure, isStipple };
                });
                
                const predPts = predicted.map(ev => {
                    const p = getCanvasPoint(ev.clientX, ev.clientY);
                    return { x: p.x, y: p.y, pressure: ev.pressure, isStipple, isPredicted: true };
                });
                
                addPendingPoints(pts, predPts);
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
    if (pointer) {
        // マルチタッチ時は低い閾値でもパン/ズームと判定してアンドゥ誤発火を防ぐ
        const moveThreshold = state.maxFingers >= 2 ? 4 : 20;
        if (pointer.totalMove > moveThreshold) state.didInteract = true;
    }
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

            // endPenDrawing/endStippleDrawing を先に呼ぶ。
            // これにより strokeCanvas → layer への合成と markLayerDirty が完了し、
            // 直後の saveState が「ストロークあり＝dirty」として正しく後ストローク
            // スナップショットを保存できる。
            // 旧順序（saveState→endPen）では saveState 時点で layer がまだ空だったため
            // early return → undo 時に saveState が再度走り「2ステップ消費」になっていた。
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

            const bounds = getStrokeBounds();
            // Don't await saveState here to keep the pointerup event lightning fast
            saveState({ keepRedo: true, rect: bounds });
            resetStrokeBounds();

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
    if (state._uiCollisionRects) {
        // Keep the rects cached, but reset the fade state for the next stroke
        for (let item of state._uiCollisionRects) {
            if (item.isFaded) {
                item.el.classList.remove('ui-faded');
                item.isFaded = false;
            }
        }
    }
    state._lastUICheckX = undefined;
    state._lastUICheckY = undefined;
    document.body.classList.remove('is-drawing-active');
    state.isPenDrawing = false;
    state.isLassoing = false;
    state.strokeMade = false;
}

function handlePointerCancel(e) {
    if (state.activePointers.has(e.pointerId)) state.activePointers.delete(e.pointerId);
    try { eventCanvas.releasePointerCapture(e.pointerId); } catch (err) { }
    if (e.pointerId === state.drawingPointerId) cancelCurrentOperation();
    // iOS はマルチタッチ開始時に1本目の pointercancel を発火させる。
    // 他のポインタがまだ残っていれば、これはパン/ジェスチャーの開始なので
    // アンドゥが誤発火しないように didInteract をセット。
    if (state.activePointers.size > 0 && state.maxFingers >= 2) {
        state.didInteract = true;
    }
    if (state.activePointers.size === 0) {
        state.isPanning = false;
        state.isPinching = false;
        eventCanvas.style.cursor = '';
    }
}

function cancelCurrentOperation() {
    if (state._uiCollisionRects) {
        // Keep the rects cached, but reset the fade state
        for (let item of state._uiCollisionRects) {
            if (item.isFaded) {
                item.el.classList.remove('ui-faded');
                item.isFaded = false;
            }
        }
    }
    state._lastUICheckX = undefined;
    state._lastUICheckY = undefined;
    document.body.classList.remove('is-drawing-active');
    cancelAndFlushDrawPoints();
    if (state.isLassoing) finishLasso();
    if (state.isPenDrawing) {
        const layer = getActiveLayer();
        if (layer) {
            restoreLayer(layer.id);
            // ピクセルを復元した後、dirty フラグも同期させる。
            // これをしないと次の saveState が「差分あり」と誤判定し
            // 直前と同一内容のスナップショットを余分に積んでしまう。
            syncLayerFingerprint(layer.id);
        }
        if (strokeCanvas && strokeCtx) {
            strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
        }
        // undoStack.pop() は削除: ストローク開始時に saveState を呼ばなくなったため
        // pop するエントリが存在せず、正規エントリを誤削除していた
        state.isPenDrawing = false;
    }
    state.drawingPointerId = null;
    state.isLassoing = false;
    state.strokeMade = false;
}

/**
 * Invalidate the UI collision cache. Call this when menus or panels are moved/toggled.
 */
export function invalidateUICollisionCache() {
    state._uiCollisionRects = null;
}
