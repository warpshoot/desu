import { state } from '../state.js';
import { invalidateUICollisionCache } from '../input/pointerHandler.js';

export function hideAllMenus() {
    const selectors = '.tool-menu, .flyout-menu, #settings-panel, #brush-settings-panel, #fill-settings-panel, #eraser-settings-panel, #select-toolbar';
    document.querySelectorAll(selectors).forEach(menu => {
        menu.classList.add('hidden');
    });

    // トーンメニュー（固定されていない場合）も閉じる
    const toneMenu = document.getElementById('tone-menu');
    if (toneMenu && !state.isToneMenuPinned) {
        toneMenu.classList.add('hidden');
    }

    // ファイルメニュー / 設定パネルも閉じる
    const fileMenu = document.getElementById('file-menu');
    if (fileMenu) fileMenu.classList.add('hidden');
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel) settingsPanel.classList.add('hidden');

    invalidateUICollisionCache();
    document.removeEventListener('pointerdown', handleOutsideClick);
}

/**
 * Closes any settings panels or menus that are not currently pinned.
 */
export function hideUnpinnedMenus() {
    // Brush settings
    const brushPanel = document.getElementById('brush-settings-panel');
    if (brushPanel && !state.isBrushSettingsPinned) {
        brushPanel.classList.add('hidden');
    }

    // Fill settings
    const fillPanel = document.getElementById('fill-settings-panel');
    if (fillPanel && !state.isFillSettingsPinned) {
        fillPanel.classList.add('hidden');
    }

    // Eraser settings
    const eraserPanel = document.getElementById('eraser-settings-panel');
    if (eraserPanel && !state.isEraserSettingsPinned) {
        eraserPanel.classList.add('hidden');
    }

    // Tone menu
    const toneMenu = document.getElementById('tone-menu');
    if (toneMenu && !state.isToneMenuPinned) {
        toneMenu.classList.add('hidden');
    }
}

export function handleOutsideClick(e) {
    if (!e.target.closest('.tool-menu') && 
        !e.target.closest('.layer-btn') && 
        !e.target.closest('.tool-btn') && 
        !e.target.closest('.mode-btn') &&
        !e.target.closest('#settings-panel') && // 追加: click on panel itself
        !e.target.closest('.panel-header')) {
        hideAllMenus();
    }
}

export function isAnyMenuOpen() {
    // Only block drawing for top-level flyout/modal panels
    const selectors = '#file-menu:not(.hidden), #settings-panel:not(.hidden), #save-ui:not(.hidden), #save-menu:not(.hidden)';
    return document.querySelector(selectors) !== null;
}
