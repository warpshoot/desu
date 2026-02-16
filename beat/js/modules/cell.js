import { PITCH_RANGE, DURATION_RANGE, SCALE_RANGE, LONG_PRESS_DURATION, DRAG_THRESHOLD, TAP_THRESHOLD, ROLL_SUBDIVISIONS, SCALES } from './constants.js';

// Per-track weak velocity (track index 0-4: Kick, Snare, Hi-hat, Bass, Lead)
// Tuned per instrument type: membrane needs bigger drop, noise stays audible, metal is delicate
const WEAK_VELOCITY = [0.42, 0.65, 0.55, 0.5, 0.58];

export class Cell {
    constructor(element, track, step, data, onChange, onLongPress, onPaintChange, getGlobalIsPainting, baseFreq, noteIndicator, getIsTwoFingerTouch, getScale) {
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
        this.getScale = getScale;
        this.getIsTwoFingerTouch = getIsTwoFingerTouch || (() => false);

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
            // Allow two-finger panning - don't handle touch at all
            if (e.touches.length >= 2) {
                return;
            }

            if (e.touches.length === 1 && !this.getIsTwoFingerTouch()) {
                // Only prevent default for single-finger touches
                // This allows two-finger scrolling
                e.preventDefault();
                this.onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            // Cancel drag if two-finger touch detected
            if (e.touches.length >= 2 || this.getIsTwoFingerTouch()) {
                if (this.isDragging) {
                    this.onPointerUp();
                }
                return;
            }

            if (this.isDragging && e.touches.length === 1) {
                e.preventDefault();
                this.onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });

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
        this.isPaintDrag = false;


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

            // Determine gesture
            const isHorizontal = absDeltaX > absDeltaY;
            this.dragDirection = isHorizontal ? 'horizontal' : 'vertical';

            if (!this.data.active) {
                // Empty Cell Logic
                if (isHorizontal) {
                    // Horizontal Drag -> Continuous Paint
                    this.isPaintDrag = true; // Flag to prevent duration adjustment
                    // Trigger global paint mode with track ID
                    if (this.onPaintChange) this.onPaintChange(true, this.track);
                    this.paintActivate();
                    // We don't adjust duration on initial paint drag, just activate
                } else {
                    // Vertical Drag -> One-shot Activate & Pitch Adjust
                    // Activate immediately but DO NOT trigger global continuous paint
                    this.data.active = true;
                    this.element.classList.add('active'); // Add active class to show color
                    // Reset to default/current duration
                    this.data.pitch = 0; // Reset pitch to center
                    this.startValue = 0; // Start adjusting from 0
                    this.triggerPulse();
                    this.updateVisuals();
                    if (this.onChange) this.onChange(this.track, this.step, this.data, false);
                }
            } else {
                // Active Cell Logic (Existing)
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
                // Use effective pitch for display
                const effectivePitch = this.getEffectivePitch ? this.getEffectivePitch() : newValue;
                const totalPitch = Math.round(effectivePitch);
                let noteName;
                try {
                    // Hi-hat and Snare can show freq or note
                    noteName = Tone.Frequency(this.baseFreq).transpose(totalPitch).toNote();
                } catch (e) {
                    noteName = Math.round(effectivePitch);
                }
                this.noteIndicator.textContent = noteName;
                this.noteIndicator.style.left = `${x}px`;
                this.noteIndicator.style.top = `${y}px`;
                this.noteIndicator.classList.remove('hidden');
            }
        }
        // Handle horizontal drag (Duration)
        else if (this.dragDirection === 'horizontal') {
            // Only adjust duration if we are NOT in paint drag mode
            if (this.isPaintDrag) return;

            const range = DURATION_RANGE.max - DURATION_RANGE.min;
            const sensitivity = range / 200;
            let newValue = this.startValue + (deltaX * sensitivity);
            newValue = Math.max(DURATION_RANGE.min, Math.min(DURATION_RANGE.max, newValue));
            this.data.duration = newValue;
        }

        this.updateVisuals();
        if (this.onChange) {
            this.onChange(this.track, this.step, this.data, false);
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
            } else if (this.hasMoved && !this.isPaintDrag) {
                // Drag finished (adjustment complete) -> Trigger Sound
                if (this.onChange) {
                    this.onChange(this.track, this.step, this.data, true);
                }
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
        if (!this.data.active) {
            this.data.active = true;
            this.data.velocity = 1.0;
            this.element.classList.add('active');
            this.element.classList.remove('weak');
            this.updateVisuals();
        } else if (this.data.velocity === 1.0) {
            this.data.velocity = WEAK_VELOCITY[this.track] ?? 0.5;
            this.element.classList.add('weak');
            this.updateVisuals();
        } else {
            this.deactivate();
        }
        if (this.onChange) {
            this.onChange(this.track, this.step, this.data, this.data.active);
        }
    }

    deactivate() {
        if (!this.data.active) return;
        this.data.active = false;
        this.data.velocity = 1.0;
        this.data.rollMode = false;
        this.data.pitch = PITCH_RANGE.default;
        this.data.duration = DURATION_RANGE.default;
        this.element.classList.remove('active', 'roll', 'playhead', 'weak');
        this.updateVisuals();
        if (this.onChange) {
            this.onChange(this.track, this.step, this.data, false);
        }
    }

    paintActivate() {
        if (!this.data.active) {
            this.data.active = true;
            this.data.velocity = 1.0;
            this.element.classList.add('active');
            this.element.classList.remove('weak');
            this.updateVisuals();
            if (this.onChange) {
                this.onChange(this.track, this.step, this.data, true);
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
            this.onChange(this.track, this.step, this.data, false);
        }
    }

    resetToDefault() {
        this.deactivate();
        if (this.onChange) {
            this.onChange(this.track, this.step, this.data, false);
        }
    }

    updateVisuals() {
        if (!this.data.active) {
            this.element.style.filter = '';
            this.element.style.transform = '';
            this.element.dataset.rollSubdivision = '';
            this.element.classList.remove('octave-low', 'weak');
            this.pitchIndicator.style.display = 'none';
            return;
        }

        // Velocity: weak class for low velocity
        if (this.data.velocity === 0.5) {
            this.element.classList.add('weak');
        } else {
            this.element.classList.remove('weak');
        }

        const effectivePitch = this.getEffectivePitch ? this.getEffectivePitch() : this.data.pitch;
        this.element.style.filter = '';

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

        // Pitch indicator (uses effective pitch to match actual playback)
        if (this.data.active) {
            const range = PITCH_RANGE.max - PITCH_RANGE.min;
            const normalized = (effectivePitch - PITCH_RANGE.min) / range;
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

    getEffectivePitch() {
        if (this.getScale) {
            const scaleName = this.getScale();
            return this.snapToScale(this.data.pitch, scaleName);
        }
        return this.data.pitch;
    }

    snapToScale(pitch, scaleName) {
        if (!SCALES[scaleName] || scaleName === 'Chromatic') return pitch;

        const scale = SCALES[scaleName];
        const roundedPitch = Math.round(pitch);

        // Find closest scale note
        let minDiff = Infinity;
        let closestPitch = roundedPitch;

        // Search range around the rounded pitch to find nearest valid note
        for (let i = -36; i <= 36; i++) {
            const checkPitch = roundedPitch + i;
            if (checkPitch < PITCH_RANGE.min || checkPitch > PITCH_RANGE.max) continue;

            // Normalized note in 0-11
            const note = ((checkPitch % 12) + 12) % 12;

            if (scale.includes(note)) {
                const diff = Math.abs(pitch - checkPitch);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestPitch = checkPitch;
                }
            }
        }

        return closestPitch;
    }
}
