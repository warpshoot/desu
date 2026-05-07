import { state } from '../state.js';
import {
    TONE_PRESETS,
    setTonePreset,
    currentTonePresetId,
    createTonePreview
} from '../tools/tonePresets.js';
let _activeTab = 'A';
let _menuVisible = false;

export function setupToneMenu() {
    const menu = document.getElementById('tone-menu');
    const itemsContainer = document.getElementById('tone-items');
    if (!menu || !itemsContainer) return;

    // Tab bar (insert before items if not yet created)
    let tabBar = menu.querySelector('.tone-tabs');
    if (!tabBar) {
        tabBar = document.createElement('div');
        tabBar.className = 'tone-tabs';
        menu.insertBefore(tabBar, itemsContainer);
    }
    tabBar.innerHTML = '';
    ['A', 'B', 'C'].forEach(tab => {
        const btn = document.createElement('button');
        btn.className = 'tone-tab' + (tab === _activeTab ? ' active' : '');
        btn.textContent = tab;
        btn.dataset.tab = tab;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            _switchTab(tab, tabBar, itemsContainer);
        });
        tabBar.appendChild(btn);
    });

    // Build all items upfront; hide non-active tabs
    itemsContainer.innerHTML = '';
    TONE_PRESETS.forEach(preset => {
        const item = document.createElement('div');
        item.className = 'tone-item';
        item.dataset.id = preset.id;
        item.dataset.category = preset.category;
        item.title = preset.name || preset.id;
        item.style.display = preset.category === _activeTab ? '' : 'none';

        const preview = createTonePreview(preset, 40, 40);
        item.appendChild(preview);

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            setTonePreset(preset.id);

            const fillSlot = state.fillSlots[state.activeFillSlotIndex];
            if (fillSlot) {
                fillSlot.tonePresetId = preset.id;
            }

            menu.querySelectorAll('.tone-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');

            if (!state.isToneMenuPinned) {
                menu.classList.add('hidden');
            }
        });

        itemsContainer.appendChild(item);
    });

    const pinBtn = document.getElementById('tone-menu-pin');
    if (pinBtn) {
        pinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isToneMenuPinned = !state.isToneMenuPinned;
            pinBtn.classList.toggle('active', state.isToneMenuPinned);
        });
        pinBtn.classList.toggle('active', state.isToneMenuPinned);
    }

    const closeBtn = document.getElementById('tone-menu-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.add('hidden');
        });
    }
}

function _switchTab(tab, tabBar, itemsContainer) {
    _activeTab = tab;
    tabBar.querySelectorAll('.tone-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    itemsContainer.querySelectorAll('.tone-item').forEach(el => {
        el.style.display = el.dataset.category === tab ? '' : 'none';
    });
}

export function updateToneMenuVisibility() {
    const menu = document.getElementById('tone-menu');
    if (!menu) return;

    const fillSettings = document.getElementById('fill-settings-panel');
    const isEditingTone = fillSettings && !fillSettings.classList.contains('hidden') &&
                          document.getElementById('fs-subtool')?.value === 'tone';

    const shouldShow = (state.mode === 'fill' && state.subTool === 'tone') ||
                       isEditingTone ||
                       state.isToneMenuPinned;

    if (shouldShow) {
        const fillSlot = state.fillSlots[state.activeFillSlotIndex];
        if (fillSlot && fillSlot.tonePresetId) {
            setTonePreset(fillSlot.tonePresetId);
        }

        const activePresetId = fillSlot?.tonePresetId || currentTonePresetId;

        // Auto-switch to the tab containing the active preset, but only on first open
        if (!_menuVisible) {
            const activePreset = TONE_PRESETS.find(p => p.id === activePresetId);
            if (activePreset && activePreset.category !== _activeTab) {
                const tabBar = menu.querySelector('.tone-tabs');
                const itemsContainer = document.getElementById('tone-items');
                if (tabBar && itemsContainer) {
                    _switchTab(activePreset.category, tabBar, itemsContainer);
                }
            }
        }

        menu.querySelectorAll('.tone-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === activePresetId);
        });

        _menuVisible = true;
        menu.classList.remove('hidden');

        const isActiveFill = state.mode === 'fill' && state.subTool === 'tone';
        menu.classList.toggle('tone-inactive', !isActiveFill);

        const fillBtn = document.getElementById('mode-fill');
        if (fillBtn) {
            const rect = fillBtn.getBoundingClientRect();
            menu.style.left = `64px`;
            menu.style.top = `${rect.top}px`;
            menu.style.bottom = 'auto';
        }
    } else {
        _menuVisible = false;
        menu.classList.add('hidden');
    }
}
