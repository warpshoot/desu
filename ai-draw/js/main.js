import { render } from './renderer.js';

const canvas = document.getElementById('canvas');
const jsonInput = document.getElementById('jsonInput');
const status = document.getElementById('status');
const renderBtn = document.getElementById('renderBtn');
const loadFileBtn = document.getElementById('loadFileBtn');
const exportPngBtn = document.getElementById('exportPngBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const fileInput = document.getElementById('fileInput');
const dropHint = document.getElementById('drop-hint');

let lastData = null;

// --- Render ---

function doRender() {
    const text = jsonInput.value.trim();
    if (!text) {
        setStatus('No JSON input', 'error');
        return;
    }

    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        setStatus(`JSON parse error: ${e.message}`, 'error');
        return;
    }

    try {
        const result = render(canvas, data);
        lastData = data;
        exportPngBtn.disabled = false;
        exportJsonBtn.disabled = false;
        setStatus(`Rendered: ${result.width}x${result.height}, ${result.layers} layer(s), ${result.commands} command(s)`, 'success');
    } catch (e) {
        setStatus(`Render error: ${e.message}`, 'error');
    }
}

renderBtn.addEventListener('click', doRender);

// Ctrl+Enter to render
jsonInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        doRender();
    }
    // Tab key inserts 2 spaces
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = jsonInput.selectionStart;
        const end = jsonInput.selectionEnd;
        jsonInput.value = jsonInput.value.substring(0, start) + '  ' + jsonInput.value.substring(end);
        jsonInput.selectionStart = jsonInput.selectionEnd = start + 2;
    }
});

// --- File Load ---

loadFileBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) loadFile(e.target.files[0]);
    fileInput.value = '';
});

function loadFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        jsonInput.value = e.target.result;
        setStatus(`Loaded: ${file.name}`, 'success');
        doRender();
    };
    reader.onerror = () => setStatus('File read error', 'error');
    reader.readAsText(file);
}

// --- Drag & Drop ---

let dragCounter = 0;

window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dropHint.classList.add('visible');
});

window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
        dragCounter = 0;
        dropHint.classList.remove('visible');
    }
});

window.addEventListener('dragover', (e) => e.preventDefault());

window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dropHint.classList.remove('visible');
    if (e.dataTransfer.files.length > 0) {
        loadFile(e.dataTransfer.files[0]);
    }
});

// --- Export PNG ---

exportPngBtn.addEventListener('click', () => {
    canvas.toBlob((blob) => {
        if (!blob) { setStatus('PNG export failed', 'error'); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-draw_${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setStatus('PNG exported', 'success');
    }, 'image/png');
});

// --- Export JSON ---

exportJsonBtn.addEventListener('click', () => {
    const text = jsonInput.value.trim();
    if (!text) return;
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-draw_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('JSON exported', 'success');
});

// --- Status ---

function setStatus(msg, type) {
    status.textContent = msg;
    status.className = type || '';
}

// --- Init with sample ---

jsonInput.value = JSON.stringify({
    canvas: { width: 400, height: 300, background: "#ffffff" },
    layers: [{
        commands: [
            { type: "circle", cx: 200, cy: 150, r: 80, fill: "#4a90d9", stroke: "#2563eb", strokeWidth: 3 },
            { type: "circle", cx: 175, cy: 130, r: 8, fill: "#ffffff" },
            { type: "circle", cx: 225, cy: 130, r: 8, fill: "#ffffff" },
            { type: "path", d: "M 170 170 Q 200 200 230 170", stroke: "#ffffff", strokeWidth: 3 }
        ]
    }]
}, null, 2);

doRender();
