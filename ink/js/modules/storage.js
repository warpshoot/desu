import { state, layers, createLayer, deleteLayer, CANVAS_DPR } from './state.js';

// 1× 解像度のダウンスケールキャンバスを使い回す (メモリ確保抑制)
let _offscreenResizeCanvas = null;

function _getResizeCanvas(w, h) {
    if (!_offscreenResizeCanvas) {
        _offscreenResizeCanvas = document.createElement('canvas');
    }
    if (_offscreenResizeCanvas.width !== w || _offscreenResizeCanvas.height !== h) {
        _offscreenResizeCanvas.width = w;
        _offscreenResizeCanvas.height = h;
    }
    return _offscreenResizeCanvas;
}

function _layerToBlob(layer, callback) {
    const dpr = CANVAS_DPR;
    if (dpr <= 1) {
        layer.canvas.toBlob(callback, 'image/png');
        return;
    }
    const w = Math.floor(layer.canvas.width / dpr);
    const h = Math.floor(layer.canvas.height / dpr);
    const tmp = _getResizeCanvas(w, h);
    const tmpCtx = tmp.getContext('2d');
    tmpCtx.clearRect(0, 0, w, h);
    tmpCtx.imageSmoothingEnabled = true;
    tmpCtx.drawImage(layer.canvas, 0, 0, w, h);
    tmp.toBlob(callback, 'image/png');
}

import { resizePaper, centerCanvas } from './canvas.js';
import { makeDefaultBrushes, makeDefaultFillSlots, makeDefaultEraserSlots } from './brushes.js';

const STORAGE_KEY = 'desu-draw-state';
const DB_NAME = 'DesuInkDB';
const STORE_NAME = 'canvasData';
let saveTimeout = null;

// ストレージ上の指紋 (IndexedDB に最後に保存された状態)
const _lastStoredFingerprints = new Map();

// --- IndexedDB Helpers ---
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function storeBlob(id, blob) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(blob, id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    });
}

function getBlob(id) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const request = tx.objectStore(STORE_NAME).get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });
}

function clearOldBlobs(keepIds) {
    return openDB().then(db => {
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAllKeys();
            request.onsuccess = () => {
                const keys = request.result;
                keys.forEach(key => {
                    if (!keepIds.includes(key)) store.delete(key);
                });
                resolve();
            };
            request.onerror = () => resolve();
        });
    });
}

// Debounced save
export function saveLocalState() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {  // 5000ms: 頻繁な描画中の重複起動を抑制
        try {
            const metadata = {
                timestamp: Date.now(),
                paperW: state.paperW,
                paperH: state.paperH,
                layers: [],
                settings: {
                    brushes: state.brushes,
                    fillSlots: state.fillSlots,
                    eraserSlots: state.eraserSlots,
                    activeBrushIndex: state.activeBrushIndex,
                    activeFillSlotIndex: state.activeFillSlotIndex,
                    activeEraserSlotIndex: state.activeEraserSlotIndex,
                    mode: state.mode,
                    subTool: state.subTool,
                    penSize: state.penSize,
                    eraserSize: state.eraserSize,
                    stippleSize: state.stippleSize,
                    inkColor: state.inkColor,
                    canvasColor: state.canvasColor
                }
            };

            const layerIds = [];
            const blobPromises = [];

            // window.getLayerFingerprint が history.js 等から露出している前提
            const getFp = (id) => (window._layerFingerprints ? window._layerFingerprints.get(id) : 0);

            for (const layer of layers) {
                const currentFp = getFp(layer.id);
                const lastFp = _lastStoredFingerprints.get(layer.id);
                const storeId = `layer-${layer.id}`;
                layerIds.push(storeId);

                metadata.layers.push({
                    id: layer.id,
                    opacity: layer.opacity,
                    visible: layer.visible,
                    fp: currentFp // 指紋をメタデータにも載せて不整合を防ぐ
                });

                if (currentFp === lastFp && lastFp !== undefined) {
                    // 変更がないので IndexedDB への書き込みをスキップ
                    continue;
                }
                
                const p = new Promise(resolve => {
                    _layerToBlob(layer, blob => {
                        if (blob) {
                            storeBlob(storeId, blob).then(() => {
                                _lastStoredFingerprints.set(layer.id, currentFp);
                                resolve();
                            });
                        } else {
                            resolve();
                        }
                    });
                });
                blobPromises.push(p);
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(metadata));
            await Promise.all(blobPromises);
            // 現在の構成に含まれない古いレイヤーのデータを掃除
            await clearOldBlobs(layerIds);

        } catch (e) {
            console.error('[Storage] Save failed:', e);
        }
    }, 5000);
}

// Load state
export function loadLocalState() {
    return new Promise(async (resolve) => {
        try {
            const json = localStorage.getItem(STORAGE_KEY);
            if (!json) return resolve(false);

            const data = JSON.parse(json);
            if (!data.layers || !Array.isArray(data.layers)) return resolve(false);

            if (data.settings) _restoreSettings(data.settings);

            state.paperW = data.paperW || 2000;
            state.paperH = data.paperH || 2000;
            resizePaper(state.paperW, state.paperH);

            while (layers.length < data.layers.length) createLayer();
            while (layers.length > data.layers.length) deleteLayer(layers[layers.length - 1].id);

            const dpr = CANVAS_DPR;
            let loadedCount = 0;

            const checkFinish = () => {
                loadedCount++;
                if (loadedCount === data.layers.length) {
                    centerCanvas();
                    document.dispatchEvent(new CustomEvent('desu:state-loaded'));
                    resolve(true);
                }
            };

            for (let i = 0; i < data.layers.length; i++) {
                const saved = data.layers[i];
                const layer = layers[i];
                if (!layer) {
                    checkFinish();
                    continue;
                }

                layer.opacity = saved.opacity ?? 1.0;
                layer.visible = saved.visible ?? true;
                layer.canvas.style.opacity = layer.opacity;
                layer.canvas.style.display = layer.visible ? 'block' : 'none';

                // ロード時に指紋を同期
                if (saved.fp !== undefined) {
                    _lastStoredFingerprints.set(layer.id, saved.fp);
                }

                try {
                    const blob = await getBlob(`layer-${saved.id}`);
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const img = new Image();
                        img.onload = () => {
                            layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
                            layer.ctx.imageSmoothingEnabled = false;
                            layer.ctx.drawImage(img, 0, 0, layer.canvas.width / dpr, layer.canvas.height / dpr);
                            layer.ctx.imageSmoothingEnabled = true;
                            URL.revokeObjectURL(url);
                            checkFinish();
                        };
                        img.onerror = checkFinish;
                        img.src = url;
                    } else {
                        checkFinish();
                    }
                } catch (err) {
                    console.warn(`[Storage] Skip pixels for layer ${saved.id}`, err);
                    checkFinish();
                }
            }

        } catch (e) {
            console.error('[Storage] Load failed:', e);
            resolve(false);
        }
    });
}

// Export Project to File (.desu)
export async function exportProject() {
    try {
        const data = {
            version: 1,
            timestamp: Date.now(),
            paperW: state.paperW,
            paperH: state.paperH,
            layers: []
            // Project export currently intentionally omits settings as requested
        };

        for (const layer of layers) {
            data.layers.push({
                id: layer.id,
                opacity: layer.opacity,
                visible: layer.visible,
                image: layer.canvas.toDataURL()
            });
        }

        const json = JSON.stringify(data);
        const filename = 'desu_ink_project_' + Date.now() + '.json';
        await _shareOrDownload(json, filename, 'application/json');
        return true;
    } catch (e) {
        console.error('Failed to export project:', e);
        return false;
    }
}

// Import Project from File
export function importProject(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = e.target.result;
                const data = JSON.parse(json);

                if (!data.layers || !Array.isArray(data.layers)) {
                    throw new Error('Invalid project file');
                }

                // Project import might contain settings if exported from another version
                if (data.settings) {
                    _restoreSettings(data.settings);
                }

                while (layers.length > 1) {
                    deleteLayer(layers[layers.length - 1].id);
                }
                while (layers.length < data.layers.length) {
                    createLayer();
                }

                const dpr = CANVAS_DPR;

                // Determine paper size to prevent aspect ratio distortion
                let pw = data.paperW;
                let ph = data.paperH;

                if ((!pw || !ph) && data.layers.length > 0) {
                    const tempImg = new Image();
                    await new Promise(res => {
                        tempImg.onload = res;
                        tempImg.src = data.layers[0].image;
                    });
                    pw = tempImg.naturalWidth / dpr;
                    ph = tempImg.naturalHeight / dpr;
                } else if (!pw || !ph) {
                    pw = 2000;
                    ph = 2000;
                }

                // Resize paper to match the loaded project
                resizePaper(pw, ph);

                let loadedCount = 0;
                data.layers.forEach((saved, index) => {
                    if (index >= layers.length) return;
                    const layer = layers[index];

                    layer.opacity = saved.opacity ?? 1.0;
                    layer.visible = saved.visible ?? true;
                    layer.canvas.style.opacity = layer.opacity;
                    layer.canvas.style.display = layer.visible ? 'block' : 'none';

                    const img = new Image();
                    img.onload = () => {
                        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
                        layer.ctx.imageSmoothingEnabled = false;
                        layer.ctx.drawImage(img, 0, 0, layer.canvas.width / dpr, layer.canvas.height / dpr);
                        layer.ctx.imageSmoothingEnabled = true;
                        loadedCount++;
                        if (loadedCount === data.layers.length) {
                            centerCanvas();
                            document.dispatchEvent(new CustomEvent('desu:state-loaded'));
                            resolve(true);
                        }
                    };
                    img.src = saved.image;
                });

            } catch (err) {
                console.error('Import failed:', err);
                resolve(false);
            }
        };
        reader.readAsText(file);
    });
}

// --- Tool Config Export/Import ---

export async function exportConfig() {
    try {
        const config = {
            brushes: state.brushes,
            fillSlots: state.fillSlots,
            eraserSlots: state.eraserSlots
            // Omit active indices, sizes, modes, etc. for simplicity
        };
        const json = JSON.stringify(config);
        const filename = 'desu_ink_config_' + Date.now() + '.json';
        await _shareOrDownload(json, filename, 'application/json');
        return true;
    } catch (e) {
        console.error('Failed to export config:', e);
        return false;
    }
}


export function importConfig(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const config = JSON.parse(e.target.result);
                _restoreSettings(config);
                
                // 初期選択状態のリセット
                state.mode = 'pen';
                state.subTool = state.brushes[0]?.subTool ?? 'pen';
                state.activeBrushIndex = 0;
                state.activeFillSlotIndex = 0;
                state.activeEraserSlotIndex = 0;

                document.dispatchEvent(new CustomEvent('desu:state-loaded'));
                resolve(true);
            } catch (err) {
                console.error('Config import failed:', err);
                resolve(false);
            }
        };
        reader.readAsText(file);
    });
}


/**
 * すべての設定を初期値にリセットする
 */
export function resetSettings() {
    const config = {
        brushes: makeDefaultBrushes(),
        fillSlots: makeDefaultFillSlots(),
        eraserSlots: makeDefaultEraserSlots(),
        activeBrushIndex: 0,
        activeFillSlotIndex: 0,
        activeEraserSlotIndex: 0,
        mode: 'pen',
        subTool: 'pen',
        penSize: 2,
        eraserSize: 5,
        stippleSize: 31,
        inkColor: '#000000',
        canvasColor: '#ffffff'
    };
    _restoreSettings(config);
    saveLocalState();
    // Clear all pixels
    openDB().then(db => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
    });
    document.dispatchEvent(new CustomEvent('desu:state-loaded'));
}

// --- Internal Helpers ---

function _restoreSettings(s) {
    if (s.brushes) state.brushes = s.brushes;
    if (s.fillSlots) state.fillSlots = s.fillSlots;
    if (s.eraserSlots) state.eraserSlots = s.eraserSlots;
    if (s.activeBrushIndex != null) state.activeBrushIndex = s.activeBrushIndex;
    if (s.activeFillSlotIndex != null) state.activeFillSlotIndex = s.activeFillSlotIndex;
    if (s.activeEraserSlotIndex != null) state.activeEraserSlotIndex = s.activeEraserSlotIndex;
    if (s.mode) state.mode = s.mode;
    if (s.subTool) {
        // 'clear' subTool is destructive — never restore it across sessions
        state.subTool = (s.subTool === 'clear') ? 'pen' : s.subTool;
    }
    if (s.penSize) state.penSize = s.penSize;
    if (s.eraserSize) state.eraserSize = s.eraserSize;
    if (s.stippleSize) state.stippleSize = s.stippleSize;
    if (s.inkColor) state.inkColor = s.inkColor;
    if (s.canvasColor) state.canvasColor = s.canvasColor;
}


async function _shareOrDownload(content, filename, type) {
    if (navigator.canShare) {
        const file = new File([content], filename, { type });
        try {
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file] });
                return;
            }
        } catch (e) {
            if (e.name === 'AbortError') return;
        }
    }
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
