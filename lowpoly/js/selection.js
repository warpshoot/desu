import * as THREE from 'three';
import { state } from './state.js';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

export function selectFace(clientX, clientY, camera, mesh) {
    if (!mesh) return null;

    const container = document.getElementById('viewport-container');
    const rect = container.getBoundingClientRect();
    
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(mesh);

    if (intersects.length > 0) {
        const faceIndex = intersects[0].faceIndex;
        if (state.selection.faceIndex === faceIndex) {
            // Already selected -> toggle off? 
            // deselected will be handled by UI or 3-finger tap
            return faceIndex;
        }

        deselectAll(mesh);
        
        state.selection.faceIndex = faceIndex;
        highlightFace(mesh, faceIndex);
        return faceIndex;
    }

    deselectAll(mesh);
    return -1;
}

export function deselectAll(mesh) {
    if (state.selection.faceIndex !== -1 && mesh) {
        restoreFaceColor(mesh, state.selection.faceIndex);
        state.selection.faceIndex = -1;
    }
}

function highlightFace(mesh, faceIndex) {
    const geometry = mesh.geometry;
    const colorAttr = geometry.attributes.color;
    
    // Backup original colors
    const colors = [];
    for (let i = 0; i < 3; i++) {
        const idx = faceIndex * 3 + i;
        colors.push(colorAttr.getX(idx), colorAttr.getY(idx), colorAttr.getZ(idx));
    }
    state.selection.originalColors = colors;

    // Apply highlight color (#f5a623 / orange)
    const highlight = new THREE.Color('#f5a623');
    for (let i = 0; i < 3; i++) {
        const idx = faceIndex * 3 + i;
        colorAttr.setXYZ(idx, highlight.r, highlight.g, highlight.b);
    }
    colorAttr.needsUpdate = true;
}

function restoreFaceColor(mesh, faceIndex) {
    if (!state.selection.originalColors) return;
    const geometry = mesh.geometry;
    const colorAttr = geometry.attributes.color;
    
    for (let i = 0; i < 3; i++) {
        const idx = faceIndex * 3 + i;
        colorAttr.setXYZ(idx, 
            state.selection.originalColors[i*3], 
            state.selection.originalColors[i*3+1], 
            state.selection.originalColors[i*3+2]
        );
    }
    colorAttr.needsUpdate = true;
}
