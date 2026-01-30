import { Knob } from './knob.js';
import { KNOB_PARAMS, TRACK_PRESETS, TRACKS } from './constants.js';

export class TonePanel {
    constructor(element, audioEngine, onParamsChange) {
        this.element = element;
        this.audioEngine = audioEngine;
        this.onParamsChange = onParamsChange;
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
                if (presetName && this.currentTrack !== null) {
                    this.applyPreset(presetName);
                }
            });
        }
    }

    applyPreset(name) {
        if (this.currentTrack === null) return;
        const presets = TRACK_PRESETS[this.currentTrack];
        if (!presets || !presets[name]) return;

        const presetParams = presets[name];

        Object.keys(presetParams).forEach(param => {
            // Update Knob UI if it exists
            if (this.knobs[param]) {
                this.knobs[param].setValue(presetParams[param]);
            }
            // Trigger change
            this.onKnobChange(param, presetParams[param]);
        });

        // Blur selector to prevent keyboard interference
        if (this.presetSelect) this.presetSelect.blur();
    }

    setupEvents() {
        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isOpen() &&
                !this.element.contains(e.target) &&
                !e.target.classList.contains('track-icon') &&
                !e.target.classList.contains('knob-label')) { // Also ignore label clicks just in case
                this.close();
            }
        });

        // Reset button
        const resetBtn = this.element.querySelector('#tone-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Reset sound settings for this track?')) {
                    this.resetParams();
                }
            });
        }
    }

    resetParams() {
        if (this.currentTrack === null) return;

        const defaults = TRACKS[this.currentTrack].defaultParams || {};

        Object.keys(this.knobs).forEach(param => {
            let defaultValue = defaults[param];
            if (defaultValue === undefined) {
                defaultValue = KNOB_PARAMS[param].default;
            }

            // Update Knob UI
            this.knobs[param].setValue(defaultValue);

            // Trigger change logic
            this.onKnobChange(param, defaultValue);
        });

        // Also reset preset selector to default state
        if (this.presetSelect) {
            this.presetSelect.value = "";
        }
    }

    open(track, params) {
        this.currentTrack = track;
        this.element.classList.remove('hidden');

        // Clear existing knobs
        Object.values(this.knobs).forEach(knob => {
            // Remove event listeners by replacing canvas
            const oldCanvas = knob.canvas;
            const newCanvas = oldCanvas.cloneNode(true);
            oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);
        });
        this.knobs = {};

        // Create new knobs with current params
        const knobElements = this.element.querySelectorAll('.knob');
        knobElements.forEach(canvas => {
            const param = canvas.dataset.param;
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
        if (activeItem) {
            const activeIcon = activeItem.querySelector('.track-icon');
            if (activeIcon) activeIcon.classList.add('active');
        }

        this.updatePresetSelector(track);
    }

    updatePresetSelector(track) {
        if (!this.presetSelect) return;

        this.presetSelect.innerHTML = '<option value="">Select Preset...</option>';

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
    }

    close() {
        this.element.classList.add('hidden');
        this.currentTrack = null;

        // Remove active state from all track icons
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

        // Update audio engine immediately
        const params = {};
        params[param] = value;
        this.audioEngine.updateTrackParams(this.currentTrack, params);

        // Notify parent to save state
        if (this.onParamsChange) {
            this.onParamsChange(this.currentTrack, param, value);
        }
    }
}
