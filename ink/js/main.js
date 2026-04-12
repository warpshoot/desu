import { initDOM, layers } from './modules/state.js';
import { initCanvas, resizeViewport } from './modules/canvas.js';
import { initUI, updateLayerThumbnail } from './modules/ui.js';
import { saveInitialState } from './modules/history.js';
import { loadLocalState, exportProject, importProject } from './modules/storage.js';
import { getLang, setLang, t, applyTextToDOM } from './modules/i18n.js';

window.onerror = function (msg, url, line, col, error) {
    alert(`Error: ${msg}\nLine: ${line}:${col}\nURL: ${url}`);
    return false;
};

// Entry Point
document.addEventListener('DOMContentLoaded', async () => {
    try {
        applyTextToDOM(); // Initialize Language from localStorage
        initDOM();
        await initCanvas();
        await loadLocalState(); // Validated: if fails, just continues
        await saveInitialState();
        initUI();

        // Setup lang select listener
        const langSelect = document.getElementById('lang-select');
        if (langSelect) {
            langSelect.value = getLang();
            langSelect.addEventListener('change', (e) => {
                setLang(e.target.value);
            });
        }



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
                    if (confirm(t('confirm.import'))) {
                        importProject(file).then(success => {
                            if (success) {
                                alert(t('alert.importSuccess'));
                            } else {
                                alert(t('alert.importFail'));
                            }
                        });
                    }
                }
            }
        });

        // Window Resize Handler — only resizes viewport overlays, never drawing layers
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                resizeViewport();
            }, 100);
        });

    } catch (e) {
        console.error('Initialization error:', e);
        alert('Initialization error: ' + e.message);
    }
});
