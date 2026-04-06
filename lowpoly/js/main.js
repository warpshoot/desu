import { state } from './state.js';
import { initScene, render, updateWireframe } from './scene.js';
import { initControls, updateControls } from './controls.js';
import { initUI } from './ui.js';
import { selectFace, deselectAll } from './selection.js';
import { startExtrude, updateExtrude, endExtrude, cancelExtrude } from './extrude.js';
import { applyColorToFace, addToPalette } from './color.js';
import { createBox } from './primitives.js';
import { pushHistory } from './history.js';

let scene, camera, renderer, controls;
let touchStartX = 0, touchStartY = 0;
let isDragging = false;

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

    // MOUSE
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
    handlePointerUp(e.clientX, e.clientY);
}

function onTouchStart(e) {
    // Multi-finger: cancel any ongoing extrude
    if (e.touches.length >= 2) {
        if (state.isExtruding) {
            cancelExtrude();
            updateWireframe(state.mesh);
            controls.enabled = true;
        }
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
        if (state.isExtruding) e.preventDefault();
    }
}

function onTouchEnd(e) {
    handlePointerUp(touchStartX, touchStartY);
}

function handlePointerDown(x, y) {
    touchStartX = x;
    touchStartY = y;
    isDragging = false;

    if (state.tool === 'select') {
        // Select: just pick face on down
        selectFace(x, y, camera, state.mesh);
        updateWireframe(state.mesh);

    } else if (state.tool === 'extrude') {
        // Extrude: select face and begin extrude immediately
        const hitIndex = selectFace(x, y, camera, state.mesh);
        if (hitIndex >= 0) {
            startExtrude(state.mesh, hitIndex);
            state.extrudeStartY = y;
            controls.enabled = false;
        }

    } else if (state.tool === 'paint') {
        // Paint: select face and paint immediately
        const hitIndex = selectFace(x, y, camera, state.mesh);
        if (hitIndex >= 0) {
            applyColorToFace(state.mesh, hitIndex, state.currentColor);
            addToPalette(state.currentColor);
            deselectAll(state.mesh);
            updateWireframe(state.mesh);
            pushHistory(state.mesh);
        }
    }
}

function handlePointerMove(x, y) {
    const dx = Math.abs(x - touchStartX);
    const dy = Math.abs(y - touchStartY);
    if (dx > 5 || dy > 5) isDragging = true;

    if (state.isExtruding) {
        const deltaY = (state.extrudeStartY - y) * 0.05;
        updateExtrude(state.mesh, deltaY);
        updateWireframe(state.mesh);
    }
}

function handlePointerUp(x, y) {
    if (state.isExtruding) {
        // If the user didn't actually drag, cancel instead of committing 0-height extrude
        if (!isDragging) {
            cancelExtrude();
            // Undo the geometry changes by restoring last history
            const lastEntry = state.history[state.historyIndex];
            if (lastEntry) {
                const geometry = state.mesh.geometry;
                geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lastEntry.pos), 3));
                geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(lastEntry.col), 3));
                geometry.computeVertexNormals();
                geometry.computeBoundingSphere();
            }
        } else {
            endExtrude(state.mesh);
            pushHistory(state.mesh);
        }
        deselectAll(state.mesh);
        updateWireframe(state.mesh);
        controls.enabled = true;
    }
    isDragging = false;
}

function animate() {
    requestAnimationFrame(animate);
    updateControls();
    render();
}

// Need THREE for BufferAttribute in handlePointerUp
import * as THREE from 'three';

init();
