import { PITCH_RANGE, DURATION_RANGE, BRIGHTNESS_RANGE, SCALE_RANGE, LONG_PRESS_DURATION, DRAG_THRESHOLD, TAP_THRESHOLD, ROLL_SUBDIVISIONS } from './constants.js';

export class Cell {
    constructor(element, track, step, data, onChange) {
        this.element = element;
        this.track = track;
        this.step = step;
        this.data = data;
        this.onChange = onChange;

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

        // Multi-tap state
        this.tapCount = 0;
        this.lastTapTime = 0;
        this.tapTimer = null;

        this.setupEvents();
        this.updateVisuals();
    }

    setupEvents() {
        // Mouse events
        this.element.addEventListener('mousedown', (e) => {
            this.onPointerDown(e.clientX, e.clientY);
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
            e.preventDefault();
            if (e.touches.length === 1) {
                this.onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
            }
        });

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
            this.toggleRollMode();
            this.isDragging = false;
        }, LONG_PRESS_DURATION);
    }

    onPointerMove(x, y) {
        if (!this.isDragging || this.isLongPress) return;

        const deltaX = x - this.startX;
        const deltaY = y - this.startY;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);

        // Determine drag direction on first significant movement
        if (!this.dragDirection && (absDeltaX > DRAG_THRESHOLD || absDeltaY > DRAG_THRESHOLD)) {
            this.dragDirection = absDeltaX > absDeltaY ? 'horizontal' : 'vertical';
            this.hasMoved = true;
            clearTimeout(this.longPressTimer);

            // Set start value based on direction and mode
            if (this.data.rollMode && this.dragDirection === 'vertical') {
                this.startValue = ROLL_SUBDIVISIONS.indexOf(this.data.rollSubdivision);
            } else if (this.dragDirection === 'vertical') {
                this.startValue = this.data.pitch;
            } else {
                this.startValue = this.data.duration;
            }
        }

        if (!this.dragDirection || !this.data.active) return;

        // Handle vertical drag
        if (this.dragDirection === 'vertical') {
            if (this.data.rollMode) {
                // Roll mode: adjust subdivision
                const steps = ROLL_SUBDIVISIONS.length;
                const sensitivity = steps / 150; // 150px for full range
                let index = Math.round(this.startValue - (deltaY * sensitivity));
                index = Math.max(0, Math.min(steps - 1, index));
                this.data.rollSubdivision = ROLL_SUBDIVISIONS[index];
            } else {
                // Normal mode: adjust pitch
                const range = PITCH_RANGE.max - PITCH_RANGE.min;
                const sensitivity = range / 200;
                let newValue = this.startValue - (deltaY * sensitivity);
                newValue = Math.max(PITCH_RANGE.min, Math.min(PITCH_RANGE.max, newValue));
                this.data.pitch = newValue;
            }
        }
        // Handle horizontal drag (duration in both modes)
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
        clearTimeout(this.longPressTimer);

        // Handle tap (no movement and no long press)
        if (!this.hasMoved && !this.isLongPress) {
            this.handleTap();
        }

        this.isDragging = false;
        this.isLongPress = false;
        this.hasMoved = false;
        this.dragDirection = null;
    }

    handleTap() {
        const now = Date.now();
        const timeSinceLastTap = now - this.lastTapTime;

        if (timeSinceLastTap < TAP_THRESHOLD) {
            this.tapCount++;
        } else {
            this.tapCount = 1;
        }

        this.lastTapTime = now;

        // Clear existing timer
        clearTimeout(this.tapTimer);

        // Triple tap: reset to default
        if (this.tapCount === 3) {
            this.resetToDefault();
            this.tapCount = 0;
        }
        // Single tap: toggle active
        else {
            this.tapTimer = setTimeout(() => {
                if (this.tapCount === 1) {
                    this.toggle();
                }
                this.tapCount = 0;
            }, TAP_THRESHOLD);
        }
    }

    toggle() {
        this.data.active = !this.data.active;
        if (this.data.active) {
            this.element.classList.add('active');
        } else {
            this.element.classList.remove('active');
            this.element.classList.remove('roll');
        }
        this.updateVisuals();
        if (this.onChange) {
            this.onChange();
        }
    }

    toggleRollMode() {
        if (!this.data.active) return;

        this.data.rollMode = !this.data.rollMode;
        if (this.data.rollMode) {
            this.element.classList.add('roll');
        } else {
            this.element.classList.remove('roll');
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
        this.data.rollMode = false;
        this.element.classList.remove('roll');
        this.updateVisuals();
        if (this.onChange) {
            this.onChange();
        }
    }

    updateVisuals() {
        if (!this.data.active) {
            this.element.style.filter = '';
            this.element.style.transform = '';
            this.element.dataset.rollSubdivision = '';
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
