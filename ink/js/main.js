import { initDOM, layers } from './modules/state.js';
import { initCanvas, resizeViewport } from './modules/canvas.js';
import { initUI, updateLayerThumbnail } from './modules/ui.js';
import { saveInitialState } from './modules/history.js';
import { loadLocalState, hasSavedState, hasBackupState, exportProject, importProject, forceSave, isStorageDirty, getCanvasSizePref, getSavedStatePaperSize, getSavedStateThumbnail, getSavedStateTimestamp } from './modules/storage.js';
import { getLang, setLang, t, applyTextToDOM } from './modules/i18n.js';
import { showResumeModal, showSimpleConfirm, showToast } from './modules/ui/modals.js';

window.onerror = function (msg, url, line, col, error) {
    // Emergency attempt to save if a crash occurs
    try {
        if (isStorageDirty()) forceSave();
    } catch (e) {}
    
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:Inter,sans-serif';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:12px;padding:24px;max-width:360px;width:calc(100% - 48px);box-shadow:0 8px 40px rgba(0,0,0,0.4)';
    const title = document.createElement('p');
    title.style.cssText = 'font-size:13px;font-weight:bold;color:#c0392b;margin:0 0 8px';
    title.textContent = 'Critical Error';
    const detail = document.createElement('p');
    detail.style.cssText = 'font-size:12px;color:#555;line-height:1.6;margin:0 0 8px;white-space:pre-wrap';
    detail.textContent = `${msg}\n${line}:${col}`;
    const hint = document.createElement('p');
    hint.style.cssText = 'font-size:11px;color:#999;margin:0 0 16px';
    hint.textContent = 'Please export your project or refresh the page.';
    const btn = document.createElement('button');
    btn.style.cssText = 'width:100%;padding:10px;background:#111;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:bold;cursor:pointer';
    btn.textContent = 'OK';
    btn.addEventListener('click', () => overlay.remove());
    box.append(title, detail, hint, btn);
    overlay.appendChild(box);
    if (document.body) document.body.appendChild(overlay);
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
                    if (await showSimpleConfirm(msg, { okLabel: '読み込む', cancelLabel: 'キャンセル' })) {
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
                    if (await showSimpleConfirm(msg, { okLabel: '読み込む', cancelLabel: 'キャンセル' })) {
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

        window.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.name.endsWith('.desu') || file.name.endsWith('.json')) {
                    if (await showSimpleConfirm(t('confirm.import'), { okLabel: '読み込む', cancelLabel: 'キャンセル' })) {
                        const success = await importProject(file);
                        if (success) {
                            showToast(t('alert.importSuccess'), 'success');
                        } else {
                            showToast(t('alert.importFail'), 'error');
                        }
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
