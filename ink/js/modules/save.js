import {
    state,
    layers,
    canvasBg,
    CANVAS_DPR
} from './state.js';
import { t } from './i18n.js';

// Share or download a blob file (iOS Safari compatible)
async function shareOrDownload(blob, fileName) {
    // iPad/iPhone or Android mobile check
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // PCの場合は navigator.share が使えても無視して直接保存する (ユーザー要望)
    if (isMobile && navigator.canShare) {
        const file = new File([blob], fileName, { type: blob.type });
        try {
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file] });
                return;
            }
        } catch (e) {
            if (e.name === 'AbortError') return;
        }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exitSaveMode() {
    try {
        state.isSaveMode = false;

        const ids = [
            'save-overlay', 'save-ui', 'selection-canvas', 'generating',
            'toolbar-left', 'toolbar-right', 'resetZoomBtn',
            'confirmSelectionBtn', 'copyClipboardBtn', 'redoSelectionBtn',
            'event-canvas'
        ];

        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;

            if (id === 'save-overlay' || id === 'save-ui' || id === 'selection-canvas' || id === 'generating' ||
                id === 'confirmSelectionBtn' || id === 'copyClipboardBtn' || id === 'redoSelectionBtn') {
                el.style.display = 'none';
            } else if (id === 'toolbar-left' || id === 'toolbar-right') {
                el.style.display = 'flex';
            } else if (id === 'resetZoomBtn') {
                el.style.display = '';
            }

            // Restore pointer events for main canvas interaction
            if (id === 'event-canvas') {
                el.style.pointerEvents = 'auto';
            }

            if (id === 'save-ui') {
                el.classList.remove('hidden-during-selection');
                el.classList.remove('in-confirmation-mode');
            }
        });

        const selCanvas = document.getElementById('selection-canvas');
        if (selCanvas) {
            const selCtx = selCanvas.getContext('2d');
            selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
        }

        state.selectionStart = null;
        state.selectionEnd = null;
        state.confirmedSelection = null;

        document.dispatchEvent(new CustomEvent('saveModeExited'));
    } catch (e) {
        console.error('Error in exitSaveMode:', e);
    }
}

export { exitSaveMode };

/**
 * Merge all visible layers into a single canvas.
 * outputScale is applied to logical (x,y,w,h) coordinates.
 * Goes directly from physical layer canvas to output size in one pass,
 * avoiding double-resampling that distorts tone patterns.
 */
function mergeLayersToCanvas(x, y, w, h, transparent, outputScale = 1) {
    const dpr = CANVAS_DPR;
    const outW = Math.round(w * outputScale);
    const outH = Math.round(h * outputScale);

    const mergedCanvas = document.createElement('canvas');
    mergedCanvas.width = outW;
    mergedCanvas.height = outH;
    const mergedCtx = mergedCanvas.getContext('2d');
    mergedCtx.imageSmoothingEnabled = false;

    if (!transparent) {
        mergedCtx.fillStyle = state.canvasColor;
        mergedCtx.fillRect(0, 0, outW, outH);
    }

    for (const layer of layers) {
        if (layer.visible) {
            mergedCtx.save();
            mergedCtx.globalAlpha = layer.opacity;
            const sX = Math.round(x * dpr);
            const sY = Math.round(y * dpr);
            const sW = Math.round(w * dpr);
            const sH = Math.round(h * dpr);
            mergedCtx.drawImage(layer.canvas, sX, sY, sW, sH, 0, 0, outW, outH);
            mergedCtx.restore();
        }
    }

    return mergedCanvas;
}

export async function saveRegion(x, y, w, h, transparent) {
    const outputScale = state.selectedScale;

    const flash = document.getElementById('flash');
    if (flash) {
        flash.style.opacity = '0.7';
        setTimeout(() => { flash.style.opacity = '0'; }, 100);
    }

    try {
        const outW = Math.round(w * outputScale);
        const outH = Math.round(h * outputScale);

        const mergedCanvas = mergeLayersToCanvas(x, y, w, h, transparent, outputScale);

        if (transparent) {
            const mergedCtx = mergedCanvas.getContext('2d');
            const imgData = mergedCtx.getImageData(0, 0, outW, outH);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) {
                    data[i + 3] = 0;
                }
            }
            mergedCtx.putImageData(imgData, 0, 0);
        }

        const blob = await new Promise(resolve => mergedCanvas.toBlob(resolve, 'image/png'));
        const fileName = 'desu_draw_' + Date.now() + '.png';
        await shareOrDownload(blob, fileName);
        exitSaveMode();
    } catch (err) {
        console.error('保存エラー:', err);
        alert(t('alert.saveFail') + '\n' + err.message);
        exitSaveMode();
    }
}

export async function copyToClipboard(x, y, w, h, transparent) {
    const outputScale = state.selectedScale;

    const flash = document.getElementById('flash');
    if (flash) {
        flash.style.opacity = '0.7';
        setTimeout(() => { flash.style.opacity = '0'; }, 100);
    }

    let mergedCanvas = null;

    try {
        const outW = Math.round(w * outputScale);
        const outH = Math.round(h * outputScale);

        mergedCanvas = mergeLayersToCanvas(x, y, w, h, transparent, outputScale);

        if (transparent) {
            const mergedCtx = mergedCanvas.getContext('2d');
            const imgData = mergedCtx.getImageData(0, 0, outW, outH);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) {
                    data[i + 3] = 0;
                }
            }
            mergedCtx.putImageData(imgData, 0, 0);
        }

        await navigator.clipboard.write([
            new ClipboardItem({
                'image/png': new Promise((resolve, reject) => {
                    mergedCanvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Blob generation failed'));
                    }, 'image/png');
                })
            })
        ]);

        const copyBtn = document.getElementById('copyClipboardBtn');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = t('save.copied');
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 1500);

    } catch (err) {
        console.error('クリップボードコピーエラー:', err);
        alert(t('alert.clipFail'));

        if (mergedCanvas) {
            try {
                const blob = await new Promise(resolve => mergedCanvas.toBlob(resolve, 'image/png'));
                const fileName = 'desu_draw_' + Date.now() + '.png';
                await shareOrDownload(blob, fileName);
            } catch (downloadErr) {
                console.error('ダウンロードエラー:', downloadErr);
                alert(t('alert.downloadFail') + '\n' + downloadErr.message);
            }
        } else {
            alert(t('alert.genFail'));
        }
    }
}

// ============================================
// Selection UI (used by ui.js)
// ============================================

export function showSelectionUI() {
    const selCanvas = document.getElementById('selection-canvas');
    const eventCanvas = document.getElementById('event-canvas');
    const saveOverlay = document.getElementById('save-overlay');
    if (selCanvas) {
        selCanvas.style.display = 'block';
        selCanvas.style.pointerEvents = 'auto';
    }
    // Disable event canvas and save-overlay so selection canvas receives events
    if (eventCanvas) {
        eventCanvas.style.pointerEvents = 'none';
    }
    if (saveOverlay) {
        saveOverlay.style.pointerEvents = 'none';
    }
}

export function hideSelectionUI() {
    const selCanvas = document.getElementById('selection-canvas');
    const eventCanvas = document.getElementById('event-canvas');
    const saveOverlay = document.getElementById('save-overlay');
    if (selCanvas) {
        selCanvas.style.display = 'none';
        selCanvas.style.pointerEvents = 'none';
        const ctx = selCanvas.getContext('2d');
        ctx.clearRect(0, 0, selCanvas.width, selCanvas.height);
    }
    // Re-enable event canvas and save-overlay
    if (eventCanvas) {
        eventCanvas.style.pointerEvents = 'auto';
    }
    if (saveOverlay) {
        saveOverlay.style.pointerEvents = 'auto';
    }
}

export function confirmSelection() {
    // Placeholder - selection confirmation logic
    if (state.selectionStart && state.selectionEnd) {
        state.confirmedSelection = {
            x: Math.min(state.selectionStart.x, state.selectionEnd.x),
            y: Math.min(state.selectionStart.y, state.selectionEnd.y),
            w: Math.abs(state.selectionEnd.x - state.selectionStart.x),
            h: Math.abs(state.selectionEnd.y - state.selectionStart.y)
        };
    }
}

export function redoSelection() {
    state.selectionStart = null;
    state.selectionEnd = null;
    state.confirmedSelection = null;

    const selCanvas = document.getElementById('selection-canvas');
    if (selCanvas) {
        const ctx = selCanvas.getContext('2d');
        ctx.clearRect(0, 0, selCanvas.width, selCanvas.height);
    }
}


/**
 * Export layered PSD using ag-psd
 */
export async function exportPSD() {
    if (layers.length === 0) return;
    if (typeof agPsd === 'undefined') {
        alert(t('alert.psdLibFail'));
        return;
    }

    const flash = document.getElementById('flash');
    if (flash) {
        flash.style.opacity = '0.7';
        setTimeout(() => { flash.style.opacity = '0'; }, 100);
    }

    try {
        const w = layers[0].canvas.width;
        const h = layers[0].canvas.height;
        const logW = Math.round(w / CANVAS_DPR);
        const logH = Math.round(h / CANVAS_DPR);

        // PSD オブジェクト作成
        // 1. 各レイヤーを ag-psd 形式に変換
        // layers 配列は [一番下, ..., 一番上] なので そのまま children へ。
        // ただし、一番下に背景色レイヤーを差し込む
        const children = [];
        
        // 背景オプション取得 (save-uiにcheckboxがあれば反映する)
        const transparent = document.getElementById('transparentBg')?.checked || false;
        if (!transparent) {
            const bgCanvas = document.createElement('canvas');
            bgCanvas.width = w;
            bgCanvas.height = h;
            const bgCtx = bgCanvas.getContext('2d');
            bgCtx.fillStyle = state.canvasColor;
            bgCtx.fillRect(0, 0, w, h);
            children.push({
                name: 'Background',
                canvas: bgCanvas,
                opacity: 1,
                visible: true
            });
        }

        for (const layer of layers) {
            children.push({
                name: `Layer ${layer.id}`,
                canvas: layer.canvas,
                opacity: layer.opacity,
                visible: layer.visible
            });
        }

        // 2. コンポジット（統合画像）の作成 (これがないとサムネイルやプレビューが出ない)
        // Use logical dimensions with CANVAS_DPR as scale to get a 1:1 copy of layer canvases
        const compositeCanvas = mergeLayersToCanvas(0, 0, logW, logH, transparent, CANVAS_DPR);

        const psd = {
            width: w,
            height: h,
            children: children,
            canvas: compositeCanvas
        };

        // 3. エンコード & 保存
        const options = { generateThumbnail: true };
        const buffer = agPsd.writePsd(psd, options);
        const blob = new Blob([buffer], { type: 'application/x-photoshop' });
        const fileName = 'desu_ink_project_' + Date.now() + '.psd';

        await shareOrDownload(blob, fileName);
        exitSaveMode();
    } catch (err) {
        console.error('PSD出力エラー:', err);
        alert(t('alert.psdFail') + '\n' + err.message);
        exitSaveMode();
    }
}
