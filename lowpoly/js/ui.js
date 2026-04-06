import { state } from './state.js';
import * as primitives from './primitives.js';
import { undo, redo, pushHistory } from './history.js';
import { exportGLB } from './export.js';
import { applyColorToFace, initPalette, addToPalette, setOnPaletteSelect } from './color.js';
import { scene, updateWireframe } from './scene.js';

export function initUI() {
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

    // MODE BUTTONS
    const modeButtons = document.querySelectorAll('.mode-btn');
    modeButtons.forEach(btn => {
        btn.onclick = () => {
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.tool = btn.dataset.mode;
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

    initPalette();

    // PALETTE COLOR -> APPLY TO SELECTED FACE
    setOnPaletteSelect((color) => {
        if (state.selection.faceIndex !== -1) {
            applyColorToFace(state.mesh, state.selection.faceIndex, color);
            pushHistory(state.mesh);
        }
    });

    // TOOLBAR OUTSIDE CLICKS
    window.onclick = (e) => {
        if (!btnAdd.contains(e.target) && !addMenu.contains(e.target)) {
            addMenu.classList.add('hidden');
        }
    };
}
