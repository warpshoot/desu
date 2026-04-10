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
import { resetHistory } from '../history.js';
import { applyTransform, resizePaper } from '../canvas.js';
import { hideAllMenus, handleOutsideClick } from './menuManager.js';
import { updateLayerThumbnail, renderLayerButtons } from './layerPanel.js';
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
    const fileInput = document.getElementById('fileInput');
    const exportConfigBtn = document.getElementById('exportConfigBtn');
    const importConfigBtn = document.getElementById('importConfigBtn');
    const configInput = document.getElementById('configInput');
    const resetConfigBtn = document.getElementById('resetConfigBtn');

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
            if (confirm('新規プロジェクトを作成しますか？\n（現在の作業内容は破棄されます）')) {
                resizePaper(2000, 2000);
                state.scale = 1.0;
                state.translateX = 0;
                state.translateY = 0;
                applyTransform();

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
                if (confirm('プロジェクトを読み込みますか？\n（現在の作業内容は上書きされます）')) {
                    importProject(file).then(async (success) => {
                        if (success) {
                            renderLayerButtons();
                            for (const layer of layers) {
                                updateLayerThumbnail(layer);
                            }
                            await resetHistory();
                        } else {
                            alert('読み込みに失敗しました');
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

    // Config Import/Export
    if (exportConfigBtn) {
        exportConfigBtn.addEventListener('click', async () => {
            hideAllMenus();
            await exportConfig();
        });
    }

    if (importConfigBtn && configInput) {
        importConfigBtn.addEventListener('click', () => {
            hideAllMenus();
            configInput.click();
        });

        configInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                importConfig(file).then((success) => {
                    if (!success) alert('設定の読み込みに失敗しました');
                    configInput.value = '';
                });
            }
        });
    }

    if (resetConfigBtn) {
        resetConfigBtn.addEventListener('click', () => {
            hideAllMenus();
            if (confirm('すべてのツール設定を初期状態にリセットしますか？')) {
                resetSettings();
                updateModeButtonIcon(state.mode, state.subTool);
                updateToolButtonStates();
                updateToneMenuVisibility();
                updateBrushSizeVisibility();
                updateBrushSizeSlider();
                renderBrushPalette();
            }
        });
    }
}
