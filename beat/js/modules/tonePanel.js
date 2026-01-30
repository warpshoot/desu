import { Knob } from './knob.js';
import { KNOB_PARAMS } from './constants.js';

export class TonePanel {
    constructor(element, audioEngine, onParamsChange) {
        this.element = element;
        this.audioEngine = audioEngine;
        this.onParamsChange = onParamsChange;
        this.currentTrack = null;
        this.knobs = {};

        this.setupEvents();
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
        if (!this.currentTrack === null) return;

        Object.keys(this.knobs).forEach(param => {
            const defaultValue = KNOB_PARAMS[param].default;

            // Update Knob UI
            this.knobs[param].setValue(defaultValue);

            // Trigger change logic
            this.onKnobChange(param, defaultValue);
        });
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
            icon.classList.remove('active');
        });
        const activeItem = document.querySelector(`.track-item[data-track="${track}"]`);
        if (activeItem) {
            const activeIcon = activeItem.querySelector('.track-icon');
            if (activeIcon) activeIcon.classList.add('active');
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
