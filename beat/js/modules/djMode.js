export class DJMode {
    constructor(sequencer) {
        this.seq = sequencer;
        this.djOverlay = null;
        this.djOrigin = null;
        this.djCurrent = null;
        this.djLine = null;
        this.djState = null;

        // Ripple effect
        this.rippleCanvas = null;
        this.rippleCtx = null;
        this.ripples = [];
    }

    init() {
        this.djOverlay = document.getElementById('dj-overlay');
        this.djOrigin = document.getElementById('dj-origin');
        this.djCurrent = document.getElementById('dj-current');
        this.djLine = document.getElementById('dj-line');

        // Ripple canvas
        this.rippleCanvas = document.getElementById('dj-ripple-canvas');
        if (this.rippleCanvas) {
            this.rippleCtx = this.rippleCanvas.getContext('2d');
            this.resizeRippleCanvas();
            window.addEventListener('resize', () => this.resizeRippleCanvas());
        }

        const dancer = this.seq.dancer;
        if (!this.djOverlay || !dancer) return;

        this.djState = {
            mode: 0,
            touching: false,
            x: 0.5, y: 0.5,
            startX: 0.5, startY: 0.5,
            targetX: 0.5, targetY: 0.5
        };

        this.renderLoop = this.renderLoop.bind(this);
        requestAnimationFrame(this.renderLoop);

        dancer.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.seq.audioEngine.playing) {
                this.cycleMode();
            }
        });

        const onStart = (e) => {
            this.djState.touching = true;
            const pos = this.getPosition(e);
            this.djState.startX = pos.x;
            this.djState.startY = pos.y;
            this.djState.targetX = pos.x;
            this.djState.targetY = pos.y;
            this.djState.x = pos.x;
            this.djState.y = pos.y;
            this.djOrigin.classList.remove('hidden');
            this.djCurrent.classList.remove('hidden');
            this.djLine.classList.remove('hidden');
            this.updateAudio(0, 0);
        };

        const onMove = (e) => {
            if (!this.djState.touching) return;
            e.preventDefault();
            const pos = this.getPosition(e);
            this.djState.targetX = pos.x;
            this.djState.targetY = pos.y;
        };

        const onEnd = () => {
            this.djState.touching = false;
            this.djOrigin.classList.add('hidden');
            this.djCurrent.classList.add('hidden');
            this.djLine.classList.add('hidden');
            this.seq.audioEngine.resetDJFilter();
            if (this.djState.mode === 1) {
                this.close(true);
            }
        };

        this.djOverlay.addEventListener('mousedown', onStart);
        this.djOverlay.addEventListener('mousemove', onMove);
        this.djOverlay.addEventListener('mouseup', onEnd);
        this.djOverlay.addEventListener('mouseleave', onEnd);

        this.djOverlay.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                onStart(e);
            }
        }, { passive: false });

        this.djOverlay.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                onMove(e);
            }
        }, { passive: false });

        this.djOverlay.addEventListener('touchend', onEnd);
    }

    renderLoop() {
        if (this.djState.mode > 0) {
            const smoothing = 0.5;
            this.djState.x += (this.djState.targetX - this.djState.x) * smoothing;
            this.djState.y += (this.djState.targetY - this.djState.y) * smoothing;

            if (this.djState.touching) {
                const deltaX = this.djState.x - this.djState.startX;
                const deltaY = this.djState.startY - this.djState.y;
                this.updateAudio(deltaX, deltaY);
                this.updateVisuals();
            }

            this.renderRipples();
        }
        requestAnimationFrame(this.renderLoop);
    }

    getPosition(e) {
        const rect = this.djOverlay.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

        return { x, y };
    }

    updateVisuals() {
        const { startX, startY, x, y } = this.djState;
        const rect = this.djOverlay.getBoundingClientRect();

        if (this.djOrigin) {
            this.djOrigin.style.transform = `translate3d(${startX * rect.width}px, ${startY * rect.height}px, 0) translate(-50%, -50%)`;
        }

        if (this.djCurrent) {
            this.djCurrent.style.transform = `translate3d(${x * rect.width}px, ${y * rect.height}px, 0) translate(-50%, -50%)`;
        }

        if (this.djLine) {
            const p1 = { x: startX * rect.width, y: startY * rect.height };
            const p2 = { x: x * rect.width, y: y * rect.height };

            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

            this.djLine.style.width = `${dist}px`;
            this.djLine.style.transform = `translate3d(${p1.x}px, ${p1.y}px, 0) translateY(-50%) rotate(${angle}rad)`;
        }
    }

    updateAudio(deltaX, deltaY) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        let lpfCutoff = 20000;
        let hpfCutoff = 20;

        if (deltaX > 0) {
            const factor = Math.pow(0.001, Math.min(absX * 2, 1));
            lpfCutoff = 20000 * factor;
            lpfCutoff = Math.max(200, lpfCutoff);
        } else if (deltaX < 0) {
            const factor = Math.pow(300, Math.min(absX * 2, 1));
            hpfCutoff = 20 * factor;
            hpfCutoff = Math.min(6000, hpfCutoff);
        }

        let resonance = 1.0;
        let delayWet = 0;

        if (deltaY > 0) {
            resonance = 1.0 + (absY * 28);
            resonance = Math.min(15, resonance);
            delayWet = Math.min(0.6, absY * 2);
        }

        this.seq.audioEngine.setDJFilter(lpfCutoff, hpfCutoff, resonance, delayWet);
    }

    cycleMode() {
        const dancer = this.seq.dancer;
        const nextMode = (this.djState.mode + 1) % 3;
        this.djState.mode = nextMode;

        dancer.classList.remove('standby');
        dancer.classList.remove('dj-keep');

        if (nextMode === 1) {
            this.djOverlay.classList.remove('hidden');
            this.resizeRippleCanvas();
            dancer.classList.add('standby');
        } else if (nextMode === 2) {
            this.djOverlay.classList.remove('hidden');
            this.resizeRippleCanvas();
            dancer.classList.add('dj-keep');
        } else {
            this.close(true);
        }
    }

    close(force = false) {
        if (this.djState.mode === 2 && !force) return;

        this.djState.mode = 0;
        this.djOverlay.classList.add('hidden');
        const dancer = this.seq.dancer;
        if (dancer) {
            dancer.classList.remove('standby');
            dancer.classList.remove('dj-keep');
        }
        this.seq.audioEngine.resetDJFilter();
    }

    /** Check if standby mode is active (used by onStep for beat pulse) */
    get isStandby() {
        return this.djState && this.djState.standby;
    }

    // --- Ripple Effect ---

    resizeRippleCanvas() {
        if (!this.rippleCanvas) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = this.djOverlay.getBoundingClientRect();
        this.rippleCanvas.width = rect.width * dpr;
        this.rippleCanvas.height = rect.height * dpr;
        if (this.rippleCtx) {
            this.rippleCtx.scale(dpr, dpr);
        }
    }

    addRipple(intensity = 1.0) {
        if (!this.djState || this.djState.mode === 0) return;
        const rect = this.djOverlay.getBoundingClientRect();
        this.ripples.push({
            x: rect.width / 2,
            y: rect.height / 2,
            radius: 10,
            maxRadius: Math.max(rect.width, rect.height) * 0.5 * intensity,
            lineWidth: 2 + intensity * 3,
            opacity: 0.6 * intensity,
        });
    }

    renderRipples() {
        if (!this.rippleCtx || this.ripples.length === 0) {
            if (this.rippleCtx) {
                const rect = this.djOverlay.getBoundingClientRect();
                this.rippleCtx.clearRect(0, 0, rect.width, rect.height);
            }
            return;
        }

        const rect = this.djOverlay.getBoundingClientRect();
        const ctx = this.rippleCtx;
        ctx.clearRect(0, 0, rect.width, rect.height);

        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];

            // Expand
            const speed = r.maxRadius * 0.04;
            r.radius += speed;
            r.opacity *= 0.96;
            r.lineWidth *= 0.98;

            if (r.opacity < 0.01 || r.radius > r.maxRadius) {
                this.ripples.splice(i, 1);
                continue;
            }

            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${r.opacity})`;
            ctx.lineWidth = r.lineWidth;
            ctx.stroke();
        }
    }
}
