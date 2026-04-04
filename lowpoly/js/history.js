import * as THREE from 'three';
import { state } from './state.js';
import { updateWireframe } from './scene.js';

export function pushHistory(mesh) {
    if (!mesh) return;

    const pos = mesh.geometry.attributes.position.array.slice();
    const col = mesh.geometry.attributes.color.array.slice();

    // Remove any redo steps
    if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
    }

    state.history.push({ pos, col });
    if (state.history.length > state.maxHistory) {
        state.history.shift();
    } else {
        state.historyIndex++;
    }
}

export function undo(mesh) {
    if (state.historyIndex <= 0) return;

    state.historyIndex--;
    applyHistory(mesh, state.history[state.historyIndex]);
}

export function redo(mesh) {
    if (state.historyIndex >= state.history.length - 1) return;

    state.historyIndex++;
    applyHistory(mesh, state.history[state.historyIndex]);
}

function applyHistory(mesh, entry) {
    if (!mesh || !entry) return;

    const geometry = mesh.geometry;
    
    // Replace attributes
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(entry.pos), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(entry.col), 3));
    
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.computeVertexNormals();

    updateWireframe(mesh);

    // Reset selection because indices might have changed
    state.selection.faceIndex = -1;
}
