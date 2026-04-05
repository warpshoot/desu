import { state } from './state.js';
import * as primitives from './primitives.js';
import { undo, redo, pushHistory } from './history.js';
import { exportGLB } from './export.js';
import { applyColorToFace, initPalette, addToPalette } from './color.js';
import { scene, updateWireframe } from './scene.js';

export function initUI(callbacks) {
    // ADD BUTTON & MENU
    const btnAdd = document.getElementById('btn-add');
    const addMenu = document.getElementById('add-menu');
    btnAdd.onclick = () => addMenu.classList.toggle('hidden');

    addMenu.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => {
            const type = btn.dataset.type;
            let newMesh;
            if (type === 'box') newMesh = primitives.createBox();
            if (type === 'sphere') newMesh = primitives.createIcosphere(1);
            if (type === 'cylinder') newMesh = primitives.createCylinder(8);
            
            if (newMesh) {
                if (state.mesh) scene.remove(state.mesh);
                state.mesh = newMesh;
                scene.add(newMesh);
                updateWireframe(newMesh);
                pushHistory(newMesh);
            }
            addMenu.classList.add('hidden');
        };
    });

    // COLOR PICKER
    const colorPreview = document.getElementById('current-color');
    const picker = document.getElementById('color-picker');
    colorPreview.onclick = () => picker.click();
    picker.oninput = (e) => {
        const color = e.target.value;
        state.currentColor = color;
        colorPreview.style.backgroundColor = color;
        if (state.selection.faceIndex !== -1) {
            applyColorToFace(state.mesh, state.selection.faceIndex, color);
            pushHistory(state.mesh);
            addToPalette(color);
        }
    };

    // UNDO / REDO
    document.getElementById('btn-undo').onclick = () => undo(state.mesh);
    document.getElementById('btn-redo').onclick = () => redo(state.mesh);
    
    // EXPORT
    document.getElementById('btn-export').onclick = () => exportGLB(state.mesh);

    // CONTEXT MENU
    const ctxMenu = document.getElementById('context-menu');
    document.getElementById('ctx-extrude').onclick = () => {
        // This is just a hint, extrusion happens via drag
        ctxMenu.classList.add('hidden');
    };
    document.getElementById('ctx-color').onclick = () => {
        if (state.selection.faceIndex !== -1) {
            applyColorToFace(state.mesh, state.selection.faceIndex, state.currentColor);
            pushHistory(state.mesh);
            addToPalette(state.currentColor);
        }
        ctxMenu.classList.add('hidden');
    };

    initPalette();

    // TOOLBAR OUTSIDE CLICKS
    window.onclick = (e) => {
        if (!btnAdd.contains(e.target) && !addMenu.contains(e.target)) {
            addMenu.classList.add('hidden');
        }
    };
}

export function showContextMenu(x, y) {
    const ctxMenu = document.getElementById('context-menu');
    ctxMenu.style.left = x + 'px';
    ctxMenu.style.top = y + 'px';
    ctxMenu.classList.remove('hidden');
}

export function hideContextMenu() {
    document.getElementById('context-menu').classList.add('hidden');
}
