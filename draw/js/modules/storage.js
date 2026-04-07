import { layers, createLayer, deleteLayer } from './state.js';

const STORAGE_KEY = 'desu-draw-state';
let saveTimeout = null;

// Debounced save
export function saveLocalState() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            const data = {
                timestamp: Date.now(),
                layers: []
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
            // console.log('[Storage] Saved', json.length);
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.warn('[Storage] Quota exceeded, cannot save state.');
                // Optional: Notify user once?
            } else {
                console.error('[Storage] Save failed:', e);
            }
        }
    }, 2000); // 2 second debounce
}

// Load state
export async function loadLocalState() {
    try {
        const json = localStorage.getItem(STORAGE_KEY);
        if (!json) return false;

        const data = JSON.parse(json);
        if (!data.layers || !Array.isArray(data.layers)) return false;

        console.log('[Storage] Loading state from', new Date(data.timestamp));

        // Adjust layer count
        while (layers.length < data.layers.length) {
            createLayer();
        }
        while (layers.length > data.layers.length) {
            deleteLayer(layers[layers.length - 1].id);
        }

        // Restore content
        const loadPromises = data.layers.map(async (saved, index) => {
            if (index >= layers.length) return;
            const layer = layers[index];

            layer.opacity = saved.opacity ?? 1.0;
            layer.visible = saved.visible ?? true;
            layer.canvas.style.opacity = layer.opacity;
            layer.canvas.style.display = layer.visible ? 'block' : 'none';

            if (!saved.image || saved.image === 'null') {
                layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
                return;
            }

            return new Promise((res) => {
                const img = new Image();
                img.onload = () => {
                    layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
                    layer.ctx.drawImage(img, 0, 0);
                    res();
                };
                img.onerror = () => {
                    console.warn(`[Storage] Failed to load image for layer ${index}`);
                    res();
                };
                img.src = saved.image;
            });
        });

        await Promise.all(loadPromises);
        return true;
    } catch (e) {
        console.error('[Storage] Load failed:', e);
        return false;
    }
}

// Export Project to File (.desu)
export async function exportProject() {
    try {
        const data = {
            version: 1,
            timestamp: Date.now(),
            layers: []
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
        const filename = 'desu_drawing_' + Date.now() + '.json';

        // Use Web Share API on iOS Safari (Blob download doesn't save to Files app)
        if (navigator.canShare) {
            const file = new File([json], filename, { type: 'application/json' });
            try {
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file] });
                    return true;
                }
            } catch (e) {
                if (e.name === 'AbortError') return true;
            }
        }

        // Fallback: traditional download
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return true;
    } catch (e) {
        console.error('Failed to export project:', e);
        return false;
    }
}

// Import Project from File
export async function importProject(file) {
    try {
        const json = await file.text();
        const data = JSON.parse(json);

        if (!data.layers || !Array.isArray(data.layers)) {
            throw new Error('Invalid project file');
        }

        // Restore layers
        // 1. Clear existing layers (leaving one)
        while (layers.length > 1) {
            deleteLayer(layers[layers.length - 1].id);
        }

        // 2. Add needed layers
        while (layers.length < data.layers.length) {
            createLayer();
        }

        // 3. Restore content
        const loadPromises = data.layers.map(async (saved, index) => {
            if (index >= layers.length) return;
            const layer = layers[index];

            layer.opacity = saved.opacity ?? 1.0;
            layer.visible = saved.visible ?? true;
            layer.canvas.style.opacity = layer.opacity;
            layer.canvas.style.display = layer.visible ? 'block' : 'none';

            if (!saved.image || saved.image === 'null') {
                layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
                return;
            }

            return new Promise((res) => {
                const img = new Image();
                img.onload = () => {
                    layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
                    layer.ctx.drawImage(img, 0, 0);
                    res();
                };
                img.onerror = () => {
                    console.warn(`[Storage] Failed to load image during import for layer ${index}`);
                    res();
                };
                img.src = saved.image;
            });
        });

        await Promise.all(loadPromises);
        return true;
    } catch (err) {
        console.error('Import failed:', err);
        return false;
    }
}
