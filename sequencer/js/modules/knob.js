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

        this.setupEvents();
        this.draw();
    }

    setupEvents() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.onDragStart(e.clientY));
        window.addEventListener('mousemove', (e) => this.onDragMove(e.clientY));
        window.addEventListener('mouseup', () => this.onDragEnd());

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                this.onDragStart(e.touches[0].clientY);
            }
        });
        window.addEventListener('touchmove', (e) => {
            if (this.isDragging && e.touches.length === 1) {
                this.onDragMove(e.touches[0].clientY);
            }
        });
        window.addEventListener('touchend', () => this.onDragEnd());
    }

    onDragStart(y) {
        this.isDragging = true;
        this.startY = y;
        this.startValue = this.value;
    }

    onDragMove(y) {
        if (!this.isDragging) return;

        const delta = this.startY - y;
        const range = this.config.max - this.config.min;
        const sensitivity = range / 200; // 200px for full range

        let newValue = this.startValue + (delta * sensitivity);

        // Apply scale
        if (this.config.scale === 'log') {
            // For logarithmic parameters like cutoff
            const normalized = (newValue - this.config.min) / range;
            const logMin = Math.log(this.config.min);
            const logMax = Math.log(this.config.max);
            const logValue = logMin + normalized * (logMax - logMin);
            newValue = Math.exp(logValue);
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
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.stroke();

        // Draw value arc
        const startAngle = Math.PI * 0.75;
        const endAngle = startAngle + (Math.PI * 1.5 * normalized);
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        this.ctx.stroke();

        // Draw indicator line
        const angle = startAngle + (Math.PI * 1.5 * normalized);
        const x2 = centerX + Math.cos(angle) * (radius - 5);
        const y2 = centerY + Math.sin(angle) * (radius - 5);
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, centerY);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();

        // Draw center dot
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        this.ctx.fill();
    }
}
