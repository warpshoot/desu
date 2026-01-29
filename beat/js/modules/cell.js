import { PITCH_RANGE, DURATION_RANGE, BRIGHTNESS_RANGE, SCALE_RANGE, LONG_PRESS_DURATION, DRAG_THRESHOLD, TAP_THRESHOLD, ROLL_SUBDIVISIONS } from './constants.js';

export class Cell {
    constructor(element, track, step, data, onChange, onLongPress, onPaintChange, getGlobalIsPainting, baseFreq, noteIndicator) {
        this.element = element;
        this.track = track;
        this.step = step;
        this.data = data;
        this.onChange = onChange;
        this.onLongPress = onLongPress;
        this.onPaintChange = onPaintChange;
        this.getGlobalIsPainting = getGlobalIsPainting;
        this.baseFreq = baseFreq;
        this.noteIndicator = noteIndicator;

        // Visual pitch indicator
        this.pitchIndicator = document.createElement('div');
        this.pitchIndicator.className = 'pitch-indicator';
        this.element.appendChild(this.pitchIndicator);

        // Drag state
        this.isDragging = false;
        this.dragDirection = null; // 'vertical' or 'horizontal'
        this.startX = 0;
        this.startY = 0;
        this.startValue = 0;
        this.hasMoved = false;

        // Long press state
        this.longPressTimer = null;
        this.isLongPress = false;

        this.setupEvents();
        this.updateVisuals();
    }

    setupEvents() {
        // Mouse events
        this.element.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click only
                this.onPointerDown(e.clientX, e.clientY);
            }
        });

        this.element.addEventListener('mouseenter', () => {
            if (this.getGlobalIsPainting && this.getGlobalIsPainting()) {
                this.paintActivate();
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.onPointerMove(e.clientX, e.clientY);
            }
        });

        window.addEventListener('mouseup', () => {
            this.onPointerUp();
        });

        // Touch events
        this.element.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (this.isDragging && e.touches.length === 1) {
                this.onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        });

        window.addEventListener('touchend', () => {
            this.onPointerUp();
        });
    }

    onPointerDown(x, y) {
        this.startX = x;
        this.startY = y;
        this.hasMoved = false;
        this.dragDirection = null;
        this.isDragging = true;

        // Start long press timer
        this.longPressTimer = setTimeout(() => {
            this.isLongPress = true;
            this.isDragging = false;
            if (this.onLongPress) {
                const rect = this.element.getBoundingClientRect();
                this.onLongPress(this, rect.left + rect.width / 2, rect.top);
            }
        }, LONG_PRESS_DURATION);
    }

    onPointerMove(x, y) {
        if (!this.isDragging || this.isLongPress) return;

        const deltaX = x - this.startX;
        const deltaY = y - this.startY;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);

        // Determine drag direction or paint mode on first significant movement
        if (!this.hasMoved && (absDeltaX > DRAG_THRESHOLD || absDeltaY > DRAG_THRESHOLD)) {
            this.hasMoved = true;
            clearTimeout(this.longPressTimer);

            if (!this.data.active) {
                // OFF cell: Start painting
                if (this.onPaintChange) this.onPaintChange(true);
                this.paintActivate();
            } else {
                // ON cell: Enter adjust mode
                this.dragDirection = absDeltaX > absDeltaY ? 'horizontal' : 'vertical';
                if (this.dragDirection === 'vertical') {
                    this.startValue = this.data.pitch;
                } else {
                    this.startValue = this.data.duration;
                }
            }
        }

        // If in painting mode or not active, no further processing here
        if (!this.data.active || !this.hasMoved) return;

        // Prevent adjustment if global painting is active (safety)
        if (!this.dragDirection && this.getGlobalIsPainting && this.getGlobalIsPainting()) return;

        // Handle vertical drag (Pitch)
        if (this.dragDirection === 'vertical') {
            const range = PITCH_RANGE.max - PITCH_RANGE.min;
            const sensitivity = range / 200;
            let newValue = this.startValue - (deltaY * sensitivity);
            newValue = Math.max(PITCH_RANGE.min, Math.min(PITCH_RANGE.max, newValue));
            this.data.pitch = newValue;

            // Update note feedback
            if (this.noteIndicator && this.data.active) {
                const totalPitch = Math.round(this.data.pitch);
                let noteName;
                try {
                    // Hi-hat and Snare can show freq or note
                    noteName = Tone.Frequency(this.baseFreq).transpose(totalPitch).toNote();
                } catch (e) {
                    noteName = Math.round(this.data.pitch);
                }
                this.noteIndicator.textContent = noteName;
                this.noteIndicator.style.left = `${x}px`;
                this.noteIndicator.style.top = `${y}px`;
                this.noteIndicator.classList.remove('hidden');
            }
        }
        // Handle horizontal drag (Duration)
        else if (this.dragDirection === 'horizontal') {
            const range = DURATION_RANGE.max - DURATION_RANGE.min;
            const sensitivity = range / 200;
            let newValue = this.startValue + (deltaX * sensitivity);
            newValue = Math.max(DURATION_RANGE.min, Math.min(DURATION_RANGE.max, newValue));
            this.data.duration = newValue;
        }

        this.updateVisuals();
        if (this.onChange) {
            this.onChange();
        }
    }

    onPointerUp() {
        if (!this.isDragging && !this.isLongPress) {
            clearTimeout(this.longPressTimer);
            return;
        }

        if (this.isDragging) {
            clearTimeout(this.longPressTimer);
            // Handle tap (no movement and no long press)
            if (!this.hasMoved && !this.isLongPress) {
                this.handleTap();
            }
        }

        this.isDragging = false;
        this.isLongPress = false;
        this.hasMoved = false;
        this.dragDirection = null;

        // Hide note indicator
        if (this.noteIndicator) {
            this.noteIndicator.classList.add('hidden');
        }

        // Reset painting state
        if (this.onPaintChange) {
            this.onPaintChange(false);
        }
    }

    handleTap() {
        // Immediate toggle, no double-tap delay
        this.toggle();
    }

    toggle() {
        if (this.data.active) {
            this.deactivate();
        } else {
            this.data.active = true;
            this.element.classList.add('active');
            this.updateVisuals();
        }
        if (this.onChange) {
            this.onChange();
        }
    }

    deactivate() {
        this.data.active = false;
        this.data.rollMode = false;
        this.data.pitch = PITCH_RANGE.default;
        this.data.duration = DURATION_RANGE.default;
        this.element.classList.remove('active', 'roll', 'playhead');
        this.updateVisuals();
    }

    paintActivate() {
        if (!this.data.active) {
            this.data.active = true;
            this.element.classList.add('active');
            this.updateVisuals();
            if (this.onChange) {
                this.onChange();
            }
        }
    }


    setRollSubdivision(sub) {
        if (!this.data.active) {
            this.toggle();
        }

        if (sub === 1) {
            this.data.rollMode = false;
            this.element.classList.remove('roll');
        } else {
            this.data.rollMode = true;
            this.data.rollSubdivision = sub;
            this.element.classList.add('roll');
        }

        this.updateVisuals();
        if (this.onChange) {
            this.onChange();
        }
    }

    resetToDefault() {
        this.deactivate();
        if (this.onChange) {
            this.onChange();
        }
    }

    updateVisuals() {
        if (!this.data.active) {
            this.element.style.filter = '';
            this.element.style.transform = '';
            this.element.dataset.rollSubdivision = '';
            this.element.classList.remove('octave-low');
            this.pitchIndicator.style.display = 'none'; // ADDED HERE
            return;
        }

        // Brightness based on pitch
        const pitchNormalized = (this.data.pitch - PITCH_RANGE.min) / (PITCH_RANGE.max - PITCH_RANGE.min);
        const brightness = BRIGHTNESS_RANGE.min + pitchNormalized * (BRIGHTNESS_RANGE.max - BRIGHTNESS_RANGE.min);
        this.element.style.filter = `brightness(${brightness})`;

        // Scale based on duration
        const durationNormalized = (this.data.duration - DURATION_RANGE.min) / (DURATION_RANGE.max - DURATION_RANGE.min);
        const scale = SCALE_RANGE.min + durationNormalized * (SCALE_RANGE.max - SCALE_RANGE.min);
        this.element.style.transform = `scale(${scale})`;

        // Store roll subdivision for CSS
        if (this.data.rollMode) {
            this.element.dataset.rollSubdivision = this.data.rollSubdivision;
        } else {
            this.element.dataset.rollSubdivision = '';
        }

        // Octave indicator

        // Pitch indicator
        if (this.data.active) {
            const range = PITCH_RANGE.max - PITCH_RANGE.min;
            const normalized = (this.data.pitch - PITCH_RANGE.min) / range;
            // 0% at bottom, 100% at top. top 0 is top.
            // When pitch is max (24), top should be 0. When pitch is min (0), top should be 100%.
            const topPercent = (1 - normalized) * 90; // Use 90% to avoid sticking to bottom
            this.pitchIndicator.style.top = `${5 + topPercent}%`;
            this.pitchIndicator.style.display = 'block';
        } else {
            this.pitchIndicator.style.display = 'none';
        }
    }

    setPlayhead(isPlayhead) {
        if (isPlayhead) {
            this.element.classList.add('playhead');
        } else {
            this.element.classList.remove('playhead');
        }
    }

    triggerPulse() {
        this.element.classList.remove('playing');
        void this.element.offsetWidth; // Force reflow
        this.element.classList.add('playing');
    }
}
