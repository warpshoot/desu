import { initDOM } from './modules/state.js';
import { initCanvas } from './modules/canvas.js';
import { initUI } from './modules/ui.js';
import { saveInitialState } from './modules/history.js';
import { loadLocalState, exportProject, importProject } from './modules/storage.js';

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
        await loadLocalState(); // Validated: if fails, just continues
        await saveInitialState();
        initUI();

        // Drag & Drop Import
        window.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        window.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.name.endsWith('.desu') || file.name.endsWith('.json')) {
                    if (confirm('プロジェクトを読み込みますか？\n（現在の作業内容は上書きされます）')) {
                        importProject(file).then(success => {
                            if (success) {
                                alert('プロジェクトを読み込みました');
                            } else {
                                alert('読み込みに失敗しました');
                            }
                        });
                    }
                }
            }
        });

        console.log('App initialized.');
    } catch (e) {
        console.error('Initialization error:', e);
        alert('Initialization error: ' + e.message);
    }
});
