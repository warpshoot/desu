import { PITCH_RANGE, DURATION_RANGE, BRIGHTNESS_RANGE, SCALE_RANGE, LONG_PRESS_DURATION, DRAG_THRESHOLD } from './constants.js';

export class Cell {
    constructor(element, track, step, data, onChange) {
        this.element = element;
        this.track = track;
        this.step = step;
        this.data = data;
        this.onChange = onChange;

        this.isDragging = false;
        this.isLongPress = false;
        this.longPressTimer = null;
        this.startY = 0;
        this.startValue = 0;
        this.dragMode = null; // 'pitch' or 'duration'
        this.touchCount = 0;
        this.hasMoved = false;

        this.setupEvents();
        this.updateVisuals();
    }

    setupEvents() {
        // Mouse events
        this.element.addEventListener('mousedown', (e) => {
            if (!this.data.active) {
                // Just toggle on click if inactive
                this.toggle();
            } else {
                // Start drag for modulation
                this.dragMode = e.shiftKey ? 'duration' : 'pitch';
                this.startDrag(e.clientY);
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.onDrag(e.clientY);
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isDragging && !this.hasMoved) {
                // If we didn't move, toggle the cell
                this.toggle();
            }
            this.endDrag();
        });

        // Touch events
        this.element.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.touchCount = e.touches.length;

            if (!this.data.active) {
                this.toggle();
                return;
            }

            // Determine drag mode based on touch count
            this.dragMode = this.touchCount === 2 ? 'duration' : 'pitch';

            // Start long press timer
            this.longPressTimer = setTimeout(() => {
                this.isLongPress = true;
                this.resetToDefault();
            }, LONG_PRESS_DURATION);

            this.startDrag(e.touches[0].clientY);
        });

        window.addEventListener('touchmove', (e) => {
            if (this.isDragging && e.touches.length > 0) {
                clearTimeout(this.longPressTimer);
                this.isLongPress = false;
                this.onDrag(e.touches[0].clientY);
            }
        });

        window.addEventListener('touchend', () => {
            clearTimeout(this.longPressTimer);
            if (this.isDragging && !this.hasMoved && !this.isLongPress) {
                this.toggle();
            }
            this.endDrag();
        });
    }

    startDrag(y) {
        this.isDragging = true;
        this.startY = y;
        this.hasMoved = false;
        this.startValue = this.dragMode === 'pitch' ? this.data.pitch : this.data.duration;
    }

    onDrag(y) {
        if (!this.isDragging || !this.data.active) return;

        const deltaY = this.startY - y;
        if (Math.abs(deltaY) > DRAG_THRESHOLD) {
            this.hasMoved = true;
        }

        if (this.dragMode === 'pitch') {
            const range = PITCH_RANGE.max - PITCH_RANGE.min;
            const sensitivity = range / 200;
            let newValue = this.startValue + (deltaY * sensitivity);
            newValue = Math.max(PITCH_RANGE.min, Math.min(PITCH_RANGE.max, newValue));
            this.data.pitch = newValue;
        } else if (this.dragMode === 'duration') {
            const range = DURATION_RANGE.max - DURATION_RANGE.min;
            const sensitivity = range / 200;
            let newValue = this.startValue + (deltaY * sensitivity);
            newValue = Math.max(DURATION_RANGE.min, Math.min(DURATION_RANGE.max, newValue));
            this.data.duration = newValue;
        }

        this.updateVisuals();
        if (this.onChange) {
            this.onChange();
        }
    }

    endDrag() {
        this.isDragging = false;
        this.isLongPress = false;
        this.hasMoved = false;
    }

    toggle() {
        this.data.active = !this.data.active;
        if (this.data.active) {
            this.element.classList.add('active');
        } else {
            this.element.classList.remove('active');
        }
        this.updateVisuals();
        if (this.onChange) {
            this.onChange();
        }
    }

    resetToDefault() {
        if (!this.data.active) return;
        this.data.pitch = PITCH_RANGE.default;
        this.data.duration = DURATION_RANGE.default;
        this.updateVisuals();
        if (this.onChange) {
            this.onChange();
        }
    }

    updateVisuals() {
        if (!this.data.active) {
            this.element.style.filter = '';
            this.element.style.transform = '';
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
