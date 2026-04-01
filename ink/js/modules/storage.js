import { state, layers, createLayer, deleteLayer } from './state.js';
import { resizePaper } from './canvas.js';

const STORAGE_KEY = 'desu-draw-state';
let saveTimeout = null;

// Debounced save
export function saveLocalState() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            const data = {
                timestamp: Date.now(),
                paperW: state.paperW,
                paperH: state.paperH,
                layers: [],
                // Also save current tools for persistence
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

            for (const layer of layers) {
                data.layers.push({
                    id: layer.id,
                    opacity: layer.opacity,
                    visible: layer.visible,
                    image: layer.canvas.toDataURL()
                });
            }

            const json = JSON.stringify(data);
            localStorage.setItem(STORAGE_KEY, json);
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.warn('[Storage] Quota exceeded, cannot save state.');
            } else {
                console.error('[Storage] Save failed:', e);
            }
        }
    }, 2000); // 2 second debounce
}

// Load state
export function loadLocalState() {
    return new Promise(async (resolve) => {
        try {
            const json = localStorage.getItem(STORAGE_KEY);
            if (!json) {
                resolve(false);
                return;
            }

            const data = JSON.parse(json);
            if (!data.layers || !Array.isArray(data.layers)) {
                resolve(false);
                return;
            }

            console.log('[Storage] Loading state from', new Date(data.timestamp));

            // Restore settings if present
            if (data.settings) {
                _restoreSettings(data.settings);
            }

            // Adjust layer count
            while (layers.length < data.layers.length) {
                createLayer();
            }
            while (layers.length > data.layers.length) {
                deleteLayer(layers[layers.length - 1].id);
            }

            const dpr = window.devicePixelRatio || 1;

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

            // Resize paper to match the saved project aspect/size
            resizePaper(pw, ph);

            // Restore content
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
                        document.dispatchEvent(new CustomEvent('desu:state-loaded'));
                        resolve(true);
                    }
                };
                img.src = saved.image;
            });

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

                const dpr = window.devicePixelRatio || 1;

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

// --- Internal Helpers ---

function _restoreSettings(s) {
    if (s.brushes) state.brushes = s.brushes;
    if (s.fillSlots) state.fillSlots = s.fillSlots;
    if (s.eraserSlots) state.eraserSlots = s.eraserSlots;
    if (s.activeBrushIndex != null) state.activeBrushIndex = s.activeBrushIndex;
    if (s.activeFillSlotIndex != null) state.activeFillSlotIndex = s.activeFillSlotIndex;
    if (s.activeEraserSlotIndex != null) state.activeEraserSlotIndex = s.activeEraserSlotIndex;
    if (s.mode) state.mode = s.mode;
    if (s.subTool) state.subTool = s.subTool;
    if (s.penSize) state.penSize = s.penSize;
    if (s.eraserSize) state.eraserSize = s.eraserSize;
    if (s.stippleSize) state.stippleSize = s.stippleSize;
    if (s.inkColor) state.inkColor = s.inkColor;
    if (s.canvasColor) state.canvasColor = s.canvasColor;
}

export async function exportToolConfig(type, configData) {
    try {
        const json = JSON.stringify({ type, data: configData });
        const filename = `desu_ink_${type}_config_${Date.now()}.json`;
        await _shareOrDownload(json, filename, 'application/json');
        return true;
    } catch (e) {
        console.error('Failed to export tool config:', e);
        return false;
    }
}

export function importToolConfig(file, expectedType) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const config = JSON.parse(e.target.result);
                if (config.type !== expectedType) {
                    alert(`互換性のない設定ファイルです。(期待: ${expectedType}, 実際: ${config.type||'不明'})`);
                    resolve(null);
                    return;
                }
                resolve(config.data);
            } catch (err) {
                console.error('Tool config import failed:', err);
                resolve(null);
            }
        };
        reader.readAsText(file);
    });
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
