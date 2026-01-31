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
export function loadLocalState() {
    return new Promise((resolve) => {
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

            // Adjust layer count
            // 1. Ensure enough layers
            while (layers.length < data.layers.length) {
                createLayer();
            }
            // 2. Remove excess layers (if safe)
            // Note: deleteLayer logic prevents deleting the last one, loop carefully
            while (layers.length > data.layers.length) {
                // Delete the last layer
                deleteLayer(layers[layers.length - 1].id);
            }

            // Restore content
            let loadedCount = 0;
            data.layers.forEach((saved, index) => {
                if (index >= layers.length) return;
                const layer = layers[index];

                // Restore properties
                layer.opacity = saved.opacity ?? 1.0;
                layer.visible = saved.visible ?? true;

                // Update DOM style
                // (state.js doesn't auto-update style on property change, usually handled by UI)
                layer.canvas.style.opacity = layer.opacity;
                layer.canvas.style.display = layer.visible ? 'block' : 'none';

                // Note: Sliders in UI won't update automatically unless we trigger UI update
                // But that's acceptable for now.

                // Load image
                const img = new Image();
                img.onload = () => {
                    layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
                    layer.ctx.drawImage(img, 0, 0);
                    loadedCount++;
                    if (loadedCount === data.layers.length) {
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
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'desu_drawing_' + Date.now() + '.desu';
        a.click();

        URL.revokeObjectURL(url);
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
                        layer.ctx.drawImage(img, 0, 0);
                        loadedCount++;
                        if (loadedCount === data.layers.length) {
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
