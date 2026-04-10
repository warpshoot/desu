import { state } from '../state.js';

export function hideAllMenus() {
    // 汎用メニュー閉じ
    document.querySelectorAll('.tool-menu').forEach(menu => {
        menu.classList.add('hidden');
    });

    // 設定パネルも閉じる
    ['brush-settings-panel', 'fill-settings-panel', 'eraser-settings-panel'].forEach(id => {
        const panel = document.getElementById(id);
        if (panel) panel.classList.add('hidden');
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

    document.removeEventListener('pointerdown', handleOutsideClick);
}

export function handleOutsideClick(e) {
    if (!e.target.closest('.tool-menu') && 
        !e.target.closest('.layer-btn') && 
        !e.target.closest('.tool-btn') && 
        !e.target.closest('.mode-btn')) {
        hideAllMenus();
    }
}
