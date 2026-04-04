import { state } from './state.js';
import { initScene, render, updateWireframe } from './scene.js';
import { initControls, updateControls } from './controls.js';
import { initUI, showContextMenu, hideContextMenu } from './ui.js';
import { selectFace, deselectAll } from './selection.js';
import { startExtrude, updateExtrude, endExtrude } from './extrude.js';
import { createBox } from './primitives.js';
import { pushHistory } from './history.js';

let scene, camera, renderer, controls;
let touchStartX = 0, touchStartY = 0;
let touchTimer = null;
let lastTouchTime = 0;

function init() {
    ({ scene, camera, renderer } = initScene());
    controls = initControls(camera, renderer.domElement);
    initUI();

    // Spawn initial object
    const box = createBox();
    state.mesh = box;
    scene.add(box);
    updateWireframe(box);
    pushHistory(box);

    setupInteractions();
    animate();
}

function setupInteractions() {
    const canvas = renderer.domElement;

    // MOUSE FALLBACK
    canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    // TOUCH
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
}

function onPointerDown(e) {
    if (e.button !== 0) return;
    handlePointerDown(e.clientX, e.clientY);
}

function onPointerMove(e) {
    handlePointerMove(e.clientX, e.clientY);
}

function onPointerUp(e) {
    handlePointerUp();
}

function onTouchStart(e) {
    // 3-FINGER TAP: DESELECT ALL
    if (e.touches.length === 3) {
        deselectAll(state.mesh);
        return;
    }
    
    // 1-FINGER ONLY
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        handlePointerDown(touch.clientX, touch.clientY);
    }
}

function onTouchMove(e) {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        handlePointerMove(touch.clientX, touch.clientY);
        if (state.isExtruding) e.preventDefault(); // Stop scroll
    }
}

function onTouchEnd(e) {
    handlePointerUp();
}

function handlePointerDown(x, y) {
    hideContextMenu();
    touchStartX = x;
    touchStartY = y;
    
    // Remember previous selection
    const previousIndex = state.selection.faceIndex;

    // LONG PRESS TIMER
    clearTimeout(touchTimer);
    touchTimer = setTimeout(() => {
        if (!state.isExtruding && Math.abs(touchStartX - x) < 5 && Math.abs(touchStartY - y) < 5) {
            showContextMenu(x, y);
        }
    }, 500);

    // TAP TO SELECT
    const hitIndex = selectFace(x, y, camera, state.mesh);
    updateWireframe(state.mesh);

    // START EXTRUDE ONLY IF ALREADY SELECTED
    if (hitIndex !== -1 && hitIndex === previousIndex) {
        startExtrude(state.mesh, hitIndex);
        state.extrudeStartY = y;
        controls.enabled = false;
    } else if (hitIndex === -1) {
        controls.enabled = true;
    } else {
        // Just selected a new face, keep orbit enabled
        controls.enabled = true;
    }
}

function handlePointerMove(x, y) {
    if (state.isExtruding) {
        const deltaY = (state.extrudeStartY - y) * 0.05; 
        updateExtrude(state.mesh, deltaY);
        updateWireframe(state.mesh);
    } else {
        if (Math.abs(touchStartX - x) > 5 || Math.abs(touchStartY - y) > 5) {
            clearTimeout(touchTimer);
        }
    }
}

function handlePointerUp() {
    clearTimeout(touchTimer);
    if (state.isExtruding) {
        endExtrude(state.mesh);
        deselectAll(state.mesh);
        updateWireframe(state.mesh);
        pushHistory(state.mesh);
        controls.enabled = true;
    }
}

function animate() {
    requestAnimationFrame(animate);
    updateControls();
    render();
}

init();
