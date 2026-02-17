import { KNOB_PARAMS } from './constants.js';

export class Knob {
    constructor(canvas, param, initialValue, onChange) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.param = param;
        this.config = KNOB_PARAMS[param];
        this.value = initialValue !== undefined ? initialValue : this.config.default;
        this.onChange = onChange;

        this.isDragging = false;
        this.startY = 0;
        this.startValue = 0;
        this.lastClickTime = 0;

        this.setupEvents();
        this.draw();
    }

    setupEvents() {
        // Store bound event handlers so we can remove them later
        this.boundMouseDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const now = Date.now();
            if (now - this.lastClickTime < 300) {
                this.resetToDefault();
                this.lastClickTime = 0;
                return;
            }
            this.lastClickTime = now;
            this.onDragStart(e.clientY);
        };
        this.boundMouseMove = (e) => this.onDragMove(e.clientY);
        this.boundMouseUp = () => this.onDragEnd();
        this.boundTouchStart = (e) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                const now = Date.now();
                if (now - this.lastClickTime < 300) {
                    this.resetToDefault();
                    this.lastClickTime = 0;
                    return;
                }
                this.lastClickTime = now;
                this.onDragStart(e.touches[0].clientY);
            }
        };
        this.boundTouchMove = (e) => {
            if (this.isDragging && e.touches.length === 1) {
                e.preventDefault();
                this.onDragMove(e.touches[0].clientY);
            }
        };
        this.boundTouchEnd = () => this.onDragEnd();

        // Add event listeners
        this.canvas.addEventListener('mousedown', this.boundMouseDown);
        window.addEventListener('mousemove', this.boundMouseMove);
        window.addEventListener('mouseup', this.boundMouseUp);
        this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
        window.addEventListener('touchmove', this.boundTouchMove, { passive: false });
        window.addEventListener('touchend', this.boundTouchEnd);
    }

    destroy() {
        // Remove all event listeners
        this.canvas.removeEventListener('mousedown', this.boundMouseDown);
        window.removeEventListener('mousemove', this.boundMouseMove);
        window.removeEventListener('mouseup', this.boundMouseUp);
        this.canvas.removeEventListener('touchstart', this.boundTouchStart);
        window.removeEventListener('touchmove', this.boundTouchMove);
        window.removeEventListener('touchend', this.boundTouchEnd);
    }

    onDragStart(y) {
        this.isDragging = true;
        this.startY = y;
        this.startValue = this.value;
    }

    onDragMove(y) {
        if (!this.isDragging) return;

        const delta = this.startY - y;
        const pixelRange = this.config.sensitivity || 200;
        const sensitivity = 1 / pixelRange;

        // Convert start value to normalized 0-1 space
        let startNormalized;
        if (this.config.scale === 'log') {
            const logMin = Math.log(this.config.min);
            const logMax = Math.log(this.config.max);
            startNormalized = (Math.log(this.startValue) - logMin) / (logMax - logMin);
        } else {
            startNormalized = (this.startValue - this.config.min) / (this.config.max - this.config.min);
        }

        // Apply delta in normalized space
        let normalized = startNormalized + (delta * sensitivity);
        normalized = Math.max(0, Math.min(1, normalized));

        // Convert back to actual value
        let newValue;
        if (this.config.scale === 'log') {
            const logMin = Math.log(this.config.min);
            const logMax = Math.log(this.config.max);
            newValue = Math.exp(logMin + normalized * (logMax - logMin));
        } else {
            newValue = this.config.min + normalized * (this.config.max - this.config.min);
        }

        // Clamp
        newValue = Math.max(this.config.min, Math.min(this.config.max, newValue));

        if (newValue !== this.value) {
            this.value = newValue;
            this.draw();
            if (this.onChange) {
                this.onChange(this.value);
            }
        }
    }

    onDragEnd() {
        this.isDragging = false;
    }

    resetToDefault() {
        this.value = this.config.default;
        this.draw();
        if (this.onChange) {
            this.onChange(this.value);
        }
    }

    setValue(value) {
        this.value = value;
        this.draw();
    }

    draw() {
        const size = this.canvas.width;
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size / 2 - 10;

        // Clear
        this.ctx.clearRect(0, 0, size, size);

        // Normalize value for display
        let normalized;
        if (this.config.scale === 'log') {
            const logMin = Math.log(this.config.min);
            const logMax = Math.log(this.config.max);
            const logValue = Math.log(this.value);
            normalized = (logValue - logMin) / (logMax - logMin);
        } else {
            normalized = (this.value - this.config.min) / (this.config.max - this.config.min);
        }

        // Draw outer circle
        this.ctx.strokeStyle = '#e1bee7'; // Pastel Purple (Background)
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.stroke();

        // Draw value arc
        const startAngle = Math.PI * 0.75;
        const endAngle = startAngle + (Math.PI * 1.5 * normalized);
        this.ctx.strokeStyle = '#8e24aa'; // Strong Purple (Active)
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        this.ctx.stroke();

        // Draw indicator line
        const angle = startAngle + (Math.PI * 1.5 * normalized);
        const x2 = centerX + Math.cos(angle) * (radius - 5);
        const y2 = centerY + Math.sin(angle) * (radius - 5);
        this.ctx.strokeStyle = '#8e24aa';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, centerY);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();

        // Draw center dot
        this.ctx.fillStyle = '#8e24aa';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        this.ctx.fill();
    }
}
