
import { initDOM } from './modules/state.js';
import { initCanvas } from './modules/canvas.js';
import { initUI } from './modules/ui.js';
import { saveAllStates } from './modules/history.js';

window.onerror = function (msg, url, line, col, error) {
    alert(`Error: ${msg}\nLine: ${line}:${col}\nURL: ${url}`);
    return false;
};

// Entry Point
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('App starting...');
        initDOM();
        await initCanvas();
        await saveAllStates(); // Initialize history
        initUI();
        console.log('App initialized.');
    } catch (e) {
        console.error('Initialization error:', e);
        alert('Initialization error: ' + e.message);
    }
});
