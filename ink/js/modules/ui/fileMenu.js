import {
    state,
    layers,
    deleteLayer,
    clearLayer
} from '../state.js';
import {
    exportProject,
    importProject,
    exportConfig,
    importConfig,
    resetSettings
} from '../storage.js';
import { t } from '../i18n.js';
import { resetHistory } from '../history.js';
import { applyTransform, resizePaper } from '../canvas.js';
import { hideAllMenus, handleOutsideClick } from './menuManager.js';
import { updateLayerThumbnail, renderLayerButtons } from './layerPanel.js';
import { exportPSD } from '../save.js';
import {
    updateModeButtonIcon,
    updateToolButtonStates,
    updateBrushSizeVisibility,
    updateBrushSizeSlider,
    renderBrushPalette
} from './toolPanel.js';
import { updateToneMenuVisibility } from './toneMenu.js';

export function setupFileUI() {
    const fileBtn = document.getElementById('fileBtn');
    const menu = document.getElementById('file-menu');
    const newBtn = document.getElementById('newProjectBtn');
    const exportBtn = document.getElementById('exportProjectBtn');
    const importBtn = document.getElementById('importProjectBtn');
    const exportPSDBtn = document.getElementById('exportPSDBtn');
    const fileInput = document.getElementById('fileInput');

    if (!fileBtn || !menu) return;

    // Toggle menu
    fileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = menu.classList.contains('hidden');
        hideAllMenus();

        if (isHidden) {
            const rect = fileBtn.getBoundingClientRect();
            menu.style.right = (window.innerWidth - rect.right) + 'px';
            menu.style.top = rect.bottom + 10 + 'px';
            menu.classList.remove('hidden');

            setTimeout(() => {
                document.addEventListener('pointerdown', handleOutsideClick);
            }, 10);
        }
    });

    // NEW click
    if (newBtn) {
        newBtn.addEventListener('click', async () => {
            hideAllMenus();
            if (confirm(t('confirm.new'))) {
                resizePaper(2000, 2000);
                centerCanvas();

                while (layers.length > 1) {
                    deleteLayer(layers[layers.length - 1].id);
                }
                if (layers.length > 0) {
                    clearLayer(layers[0].id);
                    layers[0].opacity = 1.0;
                    layers[0].visible = true;
                    layers[0].canvas.style.opacity = '1.0';
                    layers[0].canvas.style.display = 'block';
                }

                await resetHistory();
                renderLayerButtons();
                if (layers[0]) updateLayerThumbnail(layers[0]);
            }
        });
    }

    // Import click
    if (importBtn && fileInput) {
        importBtn.addEventListener('click', () => {
            fileInput.click();
            hideAllMenus();
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                if (confirm(t('confirm.import'))) {
                    importProject(file).then(async (success) => {
                        if (success) {
                            renderLayerButtons();
                            for (const layer of layers) {
                                updateLayerThumbnail(layer);
                            }
                            await resetHistory();
                        } else {
                            alert(t('alert.importFail'));
                        }
                        fileInput.value = '';
                    });
                } else {
                    fileInput.value = '';
                }
            }
        });
    }

    // Export click
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            hideAllMenus();
            try {
                await exportProject();
            } catch (e) {
                console.error('[DEBUG] exportProject error:', e);
            }
        });
    }

    const fileCloseBtn = document.getElementById('file-close');

    if (exportPSDBtn) {
        exportPSDBtn.addEventListener('click', () => {
            hideAllMenus();
            exportPSD();
        });
    }

    if (fileCloseBtn) {
        fileCloseBtn.addEventListener('click', () => {
            menu.classList.add('hidden');
        });
    }
}
