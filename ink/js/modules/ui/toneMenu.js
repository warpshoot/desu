import { state } from '../state.js';
import {
    TONE_PRESETS,
    setTonePreset,
    currentTonePresetId,
    createTonePreview
} from '../tools/tonePresets.js';
import { hideAllMenus } from './menuManager.js';

export function setupToneMenu() {
    const menu = document.getElementById('tone-menu');
    const itemsContainer = document.getElementById('tone-items');
    if (!menu || !itemsContainer) return;

    itemsContainer.innerHTML = '';

    TONE_PRESETS.forEach(preset => {
        const item = document.createElement('div');
        item.className = 'tone-item';
        item.dataset.id = preset.id;
        item.title = `${preset.name} (${preset.type})`;

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
}

export function updateToneMenuVisibility() {
    const menu = document.getElementById('tone-menu');
    if (!menu) return;

    if (state.mode === 'fill' && state.subTool === 'tone') {
        const fillSlot = state.fillSlots[state.activeFillSlotIndex];
        if (fillSlot && fillSlot.tonePresetId) {
            setTonePreset(fillSlot.tonePresetId);
        }
        
        const activePresetId = fillSlot?.tonePresetId || currentTonePresetId;
        menu.querySelectorAll('.tone-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === activePresetId);
        });

        menu.classList.remove('hidden');

        const fillBtn = document.getElementById('mode-fill');
        if (fillBtn) {
            const rect = fillBtn.getBoundingClientRect();
            menu.style.left = `64px`;
            menu.style.top = `${rect.top}px`;
            menu.style.bottom = 'auto';
        }
    } else {
        if (!state.isToneMenuPinned) {
            menu.classList.add('hidden');
        }
    }
}
