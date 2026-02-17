import { Knob } from './knob.js';
import { KNOB_PARAMS, TRACK_PRESETS, TRACKS } from './constants.js';

export class TonePanel {
    constructor(element, audioEngine, onParamsChange, onPresetSelect, getActivePreset, onResetPreset) {
        this.element = element;
        this.audioEngine = audioEngine;
        this.onParamsChange = onParamsChange;
        this.onPresetSelect = onPresetSelect;
        this.getActivePreset = getActivePreset;
        this.onResetPreset = onResetPreset;
        this.currentTrack = null;
        this.knobs = {};

        this.setupEvents();
        this.setupPresetSelector();
    }

    setupPresetSelector() {
        this.presetSelect = this.element.querySelector('#tone-preset-select');
        if (this.presetSelect) {
            this.presetSelect.addEventListener('change', (e) => {
                const presetName = e.target.value;
                if (this.currentTrack !== null) {
                    this.applyPreset(presetName);
                }
            });
        }
    }

    applyPreset(name) {
        if (this.currentTrack === null) return;

        // Notify parent to load preset params (returns params object)
        if (this.onPresetSelect) {
            const params = this.onPresetSelect(this.currentTrack, name);
            if (params) {
                this.loadParams(params);
            }
        }

        // Blur selector
        if (this.presetSelect) this.presetSelect.blur();
    }

    loadParams(params) {
        Object.keys(params).forEach(param => {
            if (this.knobs[param]) {
                const val = params[param];
                if (val !== undefined) {
                    this.knobs[param].setValue(val);
                }
            }
        });
    }

    setupEvents() {
        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isOpen() &&
                !this.element.contains(e.target) &&
                !e.target.classList.contains('track-icon') &&
                !e.target.classList.contains('knob-label')) {
                this.close();
            }
        });

        // Reset button
        const resetBtn = this.element.querySelector('#tone-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                const msg = this.presetSelect && this.presetSelect.value
                    ? 'Reset preset to factory default?'
                    : 'Reset sound settings for this track?';

                if (confirm(msg)) {
                    this.resetParams();
                }
            });
        }
    }

    resetParams() {
        if (this.currentTrack === null) return;

        if (this.onResetPreset) {
            const params = this.onResetPreset(this.currentTrack);
            if (params) {
                this.loadParams(params);
            }
        }
    }

    open(track, params) {
        this.currentTrack = track;
        this.element.classList.remove('hidden');

        // Destroy existing knobs
        Object.values(this.knobs).forEach(knob => {
            knob.destroy();
        });
        this.knobs = {};

        // Create new knobs
        const knobElements = this.element.querySelectorAll('.knob');
        knobElements.forEach(canvas => {
            const param = canvas.dataset.param;
            if (!canvas.width || !canvas.height) {
                canvas.width = 80;
                canvas.height = 80;
            }
            const knob = new Knob(canvas, param, params[param], (value) => {
                this.onKnobChange(param, value);
            });
            this.knobs[param] = knob;
        });

        // Mark track icon as active
        document.querySelectorAll('.track-icon').forEach(icon => {
            if (icon) icon.classList.remove('active');
        });

        if (track === undefined || track === null) return;

        const activeItem = document.querySelector(`.track-item[data-track="${track}"]`);
        if (activeItem) {
            const activeIcon = activeItem.querySelector('.track-icon');
            if (activeIcon) activeIcon.classList.add('active');
        }

        this.updatePresetSelector(track);
    }

    updatePresetSelector(track) {
        if (!this.presetSelect) return;

        this.presetSelect.innerHTML = '<option value="">Custom</option>';

        const presets = TRACK_PRESETS[track];
        if (presets) {
            Object.keys(presets).forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                this.presetSelect.appendChild(option);
            });
            this.presetSelect.disabled = false;
        } else {
            this.presetSelect.disabled = true;
        }

        // Set current value based on stored active preset
        if (this.getActivePreset) {
            const active = this.getActivePreset(track);
            this.presetSelect.value = active || "";
        }
    }

    close() {
        this.element.classList.add('hidden');
        this.currentTrack = null;

        document.querySelectorAll('.track-icon').forEach(icon => {
            icon.classList.remove('active');
        });
    }

    isOpen() {
        return !this.element.classList.contains('hidden');
    }

    toggle(track, params) {
        if (this.isOpen() && this.currentTrack === track) {
            this.close();
        } else {
            this.open(track, params);
        }
    }

    onKnobChange(param, value) {
        if (this.currentTrack === null) return;

        // Update audio engine
        const params = {};
        params[param] = value;
        this.audioEngine.updateTrackParams(this.currentTrack, params);

        // Notify parent
        if (this.onParamsChange) {
            this.onParamsChange(this.currentTrack, param, value);
        }
    }
}
