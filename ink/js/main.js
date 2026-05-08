import { initDOM, layers } from './modules/state.js';
import { initCanvas, resizeViewport } from './modules/canvas.js';
import { initUI, updateLayerThumbnail } from './modules/ui.js';
import { saveInitialState } from './modules/history.js';
import { loadLocalState, hasSavedState, hasBackupState, exportProject, importProject, forceSave, isStorageDirty, getCanvasSizePref, getSavedStatePaperSize, getSavedStateThumbnail, getSavedStateTimestamp } from './modules/storage.js';
import { getLang, setLang, t, applyTextToDOM } from './modules/i18n.js';
import { showResumeModal } from './modules/ui/modals.js';

window.onerror = function (msg, url, line, col, error) {
    // Emergency attempt to save if a crash occurs
    try {
        if (isStorageDirty()) forceSave();
    } catch (e) {}
    
    alert(`[Critical Error] The application encountered an unexpected issue.\n\nMessage: ${msg}\nLocation: ${line}:${col}\n\nPlease try to export your project or refresh the page.`);
    return false;
};

// Entry Point
document.addEventListener('DOMContentLoaded', async () => {
    try {
        applyTextToDOM(); // Initialize Language from localStorage
        initDOM();
        await initCanvas();
        
        // Startup Prompt: Load session or start fresh?
        let loaded = false;
        if (hasSavedState()) {
            const [thumb, ts] = await Promise.all([getSavedStateThumbnail(), Promise.resolve(getSavedStateTimestamp())]);
            if (await showResumeModal({ thumbnailUrl: thumb, timestamp: ts })) {
                const savedSize = getSavedStatePaperSize();
                const pref = getCanvasSizePref();
                if (savedSize && (savedSize.w !== pref || savedSize.h !== pref)) {
                    const msg = t('confirm.canvasSizeMismatch')
                        .replace('{0}', savedSize.w).replace('{1}', savedSize.h)
                        .replace('{2}', pref).replace('{3}', pref);
                    if (confirm(msg)) {
                        loaded = await loadLocalState();
                    }
                } else {
                    loaded = await loadLocalState();
                }
            }
        } else if (hasBackupState()) {
            // Main state lost but backup exists
            const [thumb, ts] = await Promise.all([getSavedStateThumbnail(true), Promise.resolve(getSavedStateTimestamp(true))]);
            if (await showResumeModal({
                title: '作業データを復旧できます',
                badge: '異常終了',
                thumbnailUrl: thumb,
                timestamp: ts,
                okLabel: '復旧する',
                cancelLabel: '破棄して新規作成'
            })) {
                const savedSize = getSavedStatePaperSize(true);
                const pref = getCanvasSizePref();
                if (savedSize && (savedSize.w !== pref || savedSize.h !== pref)) {
                    const msg = t('confirm.canvasSizeMismatch')
                        .replace('{0}', savedSize.w).replace('{1}', savedSize.h)
                        .replace('{2}', pref).replace('{3}', pref);
                    if (confirm(msg)) {
                        loaded = await loadLocalState(true);
                    }
                } else {
                    loaded = await loadLocalState(true);
                }
            }
        }

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
        console.error('Initialization failed:', e);
    }
});

// Guard against accidental loss
window.addEventListener('beforeunload', (e) => {
    // If there is dirty data in the storage buffer, warn the user
    if (isStorageDirty()) {
        forceSave(); // Best effort background save attempt
        e.preventDefault();
        e.returnValue = t('confirm.unload');
        return e.returnValue;
    }
});
