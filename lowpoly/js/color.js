import * as THREE from 'three';
import { state } from './state.js';

export function applyColorToFace(mesh, faceIndex, hexColor) {
    if (!mesh || faceIndex === -1) return;

    const geometry = mesh.geometry;
    const colorAttr = geometry.attributes.color;
    const color = new THREE.Color(hexColor);

    // Update the face color
    for (let i = 0; i < 3; i++) {
        const idx = faceIndex * 3 + i;
        colorAttr.setXYZ(idx, color.r, color.g, color.b);
    }
    
    // Also update current highlight backup so it doesn't revert to old color
    state.selection.originalColors = [
        color.r, color.g, color.b,
        color.r, color.g, color.b,
        color.r, color.g, color.b
    ];

    colorAttr.needsUpdate = true;
}

export function initPalette() {
    const paletteEl = document.getElementById('palette');
    const saved = localStorage.getItem('lowpoly_palette');
    if (saved) {
        state.palette = JSON.parse(saved);
    }
    renderPalette(paletteEl);
}

// Optional callback for when a palette color is picked
let onPaletteSelect = null;
export function setOnPaletteSelect(cb) { onPaletteSelect = cb; }

function renderPalette(container) {
    container.innerHTML = '';
    state.palette.forEach(color => {
        const div = document.createElement('div');
        div.className = 'palette-color';
        div.style.backgroundColor = color;
        div.addEventListener('click', () => {
            state.currentColor = color;
            document.getElementById('current-color').style.backgroundColor = color;
            if (onPaletteSelect) onPaletteSelect(color);
        });
        container.appendChild(div);
    });
}

export function addToPalette(color) {
    if (!state.palette.includes(color)) {
        state.palette.unshift(color);
        if (state.palette.length > 24) state.palette.pop();
        localStorage.setItem('lowpoly_palette', JSON.stringify(state.palette));
        renderPalette(document.getElementById('palette'));
    }
}
