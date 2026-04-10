import {
    state,
    layers,
    getLayer,
    getActiveLayer,
    createLayer,
    deleteLayer,
    moveLayer,
    mergeLayerDown,
    MAX_LAYERS,
    CANVAS_DPR
} from '../state.js';
import { saveLayerChangeState } from '../history.js';
import { applyTransform } from '../canvas.js';
import { hideAllMenus, handleOutsideClick } from './menuManager.js';

/**
 * Layer Panel Setup
 */
export function setupLayerPanel() {
    const layerButtons = document.getElementById('layer-buttons');
    const addBtn = document.getElementById('addLayerBtn');

    if (!layerButtons || !addBtn) return;

    // Initial render
    renderLayerButtons();

    // Add layer button
    addBtn.addEventListener('click', async () => {
        const layer = createLayer();
        if (layer) {
            applyTransform();
            await saveLayerChangeState();
            updateAllThumbnails();
            renderLayerButtons();
            updateActiveLayerIndicator();
        }
    });

    let pressTimer = null;
    let longPressed = false;

    layerButtons.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest('.layer-btn');
        if (!btn) return;

        longPressed = false;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
            longPressed = true;
            showLayerMenu(btn);
        }, 500); // 500ms for long press
    });

    layerButtons.addEventListener('pointermove', (e) => {
        // If moved significantly, cancel long press
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    });

    layerButtons.addEventListener('pointerup', (e) => {
        const btn = e.target.closest('.layer-btn');
        if (!btn) {
            clearTimeout(pressTimer);
            return;
        }

        if (longPressed) {
            // Already handled by long press
            longPressed = false;
            clearTimeout(pressTimer);
            return;
        }

        clearTimeout(pressTimer);
        hideAllMenus();

        const layerId = parseInt(btn.dataset.layerId);
        flashLayer(layerId);

        if (layerId !== state.activeLayer) {
            // Switch layer
            state.activeLayer = layerId;
            renderLayerButtons();
            updateActiveLayerIndicator();
        } else {
            // Tap on active layer -> show menu
            showLayerMenu(btn);
        }
    });

    layerButtons.addEventListener('pointercancel', () => clearTimeout(pressTimer));

    // Expose render function for external updates (legacy support)
    window.renderLayerButtons = renderLayerButtons;
}

/**
 * Re-render all layer buttons in the panel
 */
export function renderLayerButtons() {
    const layerButtons = document.getElementById('layer-buttons');
    const addBtn = document.getElementById('addLayerBtn');
    if (!layerButtons) return;

    layerButtons.innerHTML = '';

    for (const layer of layers) {
        const btn = document.createElement('div');
        btn.className = 'layer-btn' + (layer.id === state.activeLayer ? ' active' : '');
        btn.dataset.layerId = layer.id;

        if (!layer.visible) {
            btn.classList.add('hidden-layer');
        }

        btn.style.opacity = layer.opacity;

        // Set thumbnail
        if (layer.thumbnail) {
            btn.style.backgroundImage = `url(${layer.thumbnail})`;
            btn.style.backgroundSize = 'contain';
            btn.style.backgroundRepeat = 'no-repeat';
            btn.style.backgroundPosition = 'center';
        } else {
            // Generate initial thumbnail if missing
            updateLayerThumbnail(layer);
        }

        layerButtons.appendChild(btn);
    }

    // Show/hide add button based on max layers
    if (addBtn) {
        addBtn.style.display = layers.length >= MAX_LAYERS ? 'none' : 'flex';
    }
}

/**
 * Show popover menu for a specific layer
 */
export function showLayerMenu(anchorBtn) {
    hideAllMenus();

    const menu = document.getElementById('layer-menu');
    const layerId = parseInt(anchorBtn.dataset.layerId);
    const layer = getLayer(layerId);
    if (!menu || !layer) return;

    // Update slider value
    const slider = document.getElementById('layerOpacitySlider');
    if (slider) slider.value = layer.opacity * 100;

    // Update visibility toggle
    const visToggle = menu.querySelector('.layer-visible-toggle');
    if (visToggle) {
        visToggle.classList.toggle('hidden-state', !layer.visible);
    }

    // Store target layer
    menu.dataset.targetLayerId = layerId;

    const rect = anchorBtn.getBoundingClientRect();
    // レイヤーは右端にあるのでメニューはボタンの左側に出す
    menu.style.right = (window.innerWidth - rect.left + 10) + 'px';
    menu.style.left = 'auto';
    menu.style.top = rect.top + 'px';
    menu.classList.remove('hidden');

    // Setup menu actions
    setupLayerMenuActions(menu, layerId);

    setTimeout(() => {
        document.addEventListener('pointerdown', handleOutsideClick);
    }, 10);
}

function setupLayerMenuActions(menu, layerId) {
    const slider = document.getElementById('layerOpacitySlider');
    const visToggle = menu.querySelector('.layer-visible-toggle');
    const deleteBtn = menu.querySelector('.layer-delete');
    const mergeBtn = menu.querySelector('.layer-merge-btn');

    if (slider) {
        const newSlider = slider.cloneNode(true);
        slider.parentNode.replaceChild(newSlider, slider);
        newSlider.addEventListener('input', (e) => {
            const layer = getLayer(layerId);
            if (layer) {
                layer.opacity = e.target.value / 100;
                layer.canvas.style.opacity = layer.opacity;
                const btn = document.querySelector(`.layer-btn[data-layer-id="${layerId}"]`);
                if (btn) btn.style.opacity = layer.opacity;
            }
        });
        newSlider.addEventListener('change', () => {
            saveLayerChangeState();
        });
    }

    if (visToggle) {
        const newVisToggle = visToggle.cloneNode(true);
        visToggle.parentNode.replaceChild(newVisToggle, visToggle);
        newVisToggle.addEventListener('click', () => {
            const layer = getLayer(layerId);
            if (layer) {
                layer.visible = !layer.visible;
                layer.canvas.style.display = layer.visible ? 'block' : 'none';
                newVisToggle.classList.toggle('hidden-state', !layer.visible);
                const btn = document.querySelector(`.layer-btn[data-layer-id="${layerId}"]`);
                if (btn) btn.classList.toggle('hidden-layer', !layer.visible);
                saveLayerChangeState();
            }
        });
    }

    // Move buttons
    const moveButtons = menu.querySelectorAll('.layer-move-btn');
    moveButtons.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            const direction = newBtn.dataset.dir;
            if (moveLayer(layerId, direction)) {
                renderLayerButtons();
                hideAllMenus();
                flashLayer(layerId);
            }
        });
    });

    if (mergeBtn) {
        const newMergeBtn = mergeBtn.cloneNode(true);
        mergeBtn.parentNode.replaceChild(newMergeBtn, mergeBtn);
        newMergeBtn.addEventListener('click', async () => {
            const index = layers.findIndex(l => l.id === layerId);
            if (index <= 0) return;
            if (mergeLayerDown(layerId)) {
                await saveLayerChangeState();
                renderLayerButtons();
                updateActiveLayerIndicator();
                hideAllMenus();
            }
        });
        const isBottom = layers.findIndex(l => l.id === layerId) <= 0;
        newMergeBtn.classList.toggle('disabled', isBottom);
    }

    if (deleteBtn) {
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        newDeleteBtn.addEventListener('click', async () => {
            if (layers.length <= 1) return;
            if (deleteLayer(layerId)) {
                await saveLayerChangeState();
                renderLayerButtons();
                updateActiveLayerIndicator();
                hideAllMenus();
            }
        });
        newDeleteBtn.classList.toggle('disabled', layers.length <= 1);
    }
}

/**
 * Flash effect for the active layer
 */
export function updateActiveLayerIndicator() {
    const layer = getActiveLayer();
    if (layer) {
        flashLayer(layer.id);
    }
}

/**
 * Update the thumbnail for a specific layer
 */
export function updateLayerThumbnail(layer) {
    if (!layer) return;

    if (!state.thumbCanvas) {
        state.thumbCanvas = document.createElement('canvas');
        state.thumbCanvas.width = 48;
        state.thumbCanvas.height = 32;
        state.thumbCtx = state.thumbCanvas.getContext('2d');
    }

    const ctx = state.thumbCtx;
    const sWidth = layer.canvas.width;
    const sHeight = layer.canvas.height;
    const dWidth = 48;
    const dHeight = 32;

    const scale = Math.min(dWidth / sWidth, dHeight / sHeight);
    const drawW = sWidth * scale;
    const drawH = sHeight * scale;
    const offsetX = (dWidth - drawW) / 2;
    const offsetY = (dHeight - drawH) / 2;

    ctx.clearRect(0, 0, dWidth, dHeight);
    ctx.drawImage(layer.canvas, 0, 0, sWidth, sHeight, offsetX, offsetY, drawW, drawH);

    state.thumbCanvas.toBlob((blob) => {
        if (!blob) return;
        if (layer.thumbnail && layer.thumbnail.startsWith('blob:')) {
            URL.revokeObjectURL(layer.thumbnail);
        }
        layer.thumbnail = URL.createObjectURL(blob);
        
        const btn = document.querySelector(`.layer-btn[data-layer-id="${layer.id}"]`);
        if (btn) {
            btn.style.backgroundImage = `url(${layer.thumbnail})`;
            btn.style.backgroundSize = 'contain';
            btn.style.backgroundRepeat = 'no-repeat';
            btn.style.backgroundPosition = 'center';
        }
    });
}

/**
 * Update thumbnails for all layers
 */
export function updateAllThumbnails() {
    for (const layer of layers) {
        updateLayerThumbnail(layer);
    }
}

/**
 * Visual feedback overlay for layer operations
 */
export function flashLayer(layerId) {
    const layer = getLayer(layerId);
    if (!layer) return;

    let flashCanvas = document.getElementById('flash-overlay');
    const layerContainer = document.getElementById('layer-container');

    if (!flashCanvas) {
        flashCanvas = document.createElement('canvas');
        flashCanvas.id = 'flash-overlay';
        flashCanvas.style.position = 'absolute';
        flashCanvas.style.top = '0';
        flashCanvas.style.left = '0';
        flashCanvas.style.pointerEvents = 'none';
        flashCanvas.style.zIndex = '50';
        flashCanvas.style.transition = 'opacity 0.2s';
        flashCanvas.style.transformOrigin = '0 0';

        if (layerContainer) {
            layerContainer.appendChild(flashCanvas);
        } else {
            document.body.appendChild(flashCanvas);
        }
    }

    flashCanvas.style.transform = layer.canvas.style.transform;
    flashCanvas.width = layer.canvas.width;
    flashCanvas.height = layer.canvas.height;
    const dpr = CANVAS_DPR;
    flashCanvas.style.width = (layer.canvas.width / dpr) + 'px';
    flashCanvas.style.height = (layer.canvas.height / dpr) + 'px';

    const ctx = flashCanvas.getContext('2d');
    ctx.clearRect(0, 0, flashCanvas.width, flashCanvas.height);
    ctx.globalAlpha = 1.0;
    ctx.drawImage(layer.canvas, 0, 0);

    flashCanvas.style.filter = 'drop-shadow(0 0 6px #00aaff) brightness(1.2)';
    flashCanvas.style.opacity = '1';

    setTimeout(() => {
        flashCanvas.style.opacity = '0';
        setTimeout(() => {
            ctx.clearRect(0, 0, flashCanvas.width, flashCanvas.height);
        }, 200);
    }, 200);
}
