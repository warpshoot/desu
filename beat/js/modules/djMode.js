export class DJMode {
    constructor(sequencer) {
        this.seq = sequencer;
        this.djOverlay = null;
        this.djXYPad = null;
        this.djRibbon = null;
        this.djRibbonCursor = null;
        this.djOrigin = null;
        this.djCurrent = null;
        this.djLine = null;
        this.isOpen = false;

        // XY pad state
        this.xyState = {
            touching: false,
            x: 0.5, y: 0.5,
            startX: 0.5, startY: 0.5,
            targetX: 0.5, targetY: 0.5
        };

        // Ripple effect
        this.rippleCanvas = null;
        this.rippleCtx = null;
        this.ripples = [];

        // Active FX
        this.activeFX = new Set();
    }

    init() {
        this.djOverlay = document.getElementById('dj-overlay');
        this.djXYPad = document.getElementById('dj-xy-pad');
        this.djRibbon = document.getElementById('dj-ribbon');
        this.djRibbonCursor = document.getElementById('dj-ribbon-cursor');
        this.djOrigin = document.getElementById('dj-origin');
        this.djCurrent = document.getElementById('dj-current');
        this.djLine = document.getElementById('dj-line');

        // Ripple canvas
        this.rippleCanvas = document.getElementById('dj-ripple-canvas');
        if (this.rippleCanvas) {
            this.rippleCtx = this.rippleCanvas.getContext('2d');
            this.resizeRippleCanvas();
            window.addEventListener('resize', () => {
                this.resizeRippleCanvas();
                // Auto-close on small screens (portrait/mobile) to match CSS
                if (window.innerWidth <= 600 && this.isOpen) {
                    this.close();
                }
            });
        }

        const dancer = this.seq.dancer;
        if (!this.djOverlay || !dancer) return;

        // Start render loop
        this.renderLoop = this.renderLoop.bind(this);
        requestAnimationFrame(this.renderLoop);

        // Dancer click: simple toggle
        dancer.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.seq.audioEngine.playing) {
                this.toggle();
            }
        });

        // Setup FX buttons (hold to activate)
        this.setupFXButtons();

        // Setup Ribbon
        this.setupRibbon();

        // Setup XY pad interactions
        this.setupXYPad();
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.isOpen = true;
        this.djOverlay.classList.remove('hidden');
        this.resizeRippleCanvas();

        const dancer = this.seq.dancer;
        if (dancer) {
            dancer.classList.add('dj-keep');
        }
    }

    close() {
        this.isOpen = false;
        this.djOverlay.classList.add('hidden');

        // Release all FX
        this.releaseAllFX();

        // Reset filter
        this.seq.audioEngine.resetDJFilter();

        const dancer = this.seq.dancer;
        if (dancer) {
            dancer.classList.remove('standby');
            dancer.classList.remove('dj-keep');
        }
    }

    // ========================
    // FX Buttons
    // ========================

    setupFXButtons() {
        const buttons = document.querySelectorAll('.dj-fx-btn');
        buttons.forEach(btn => {
            const fx = btn.dataset.fx;

            const activate = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.activateFX(fx);
                btn.classList.add('active');
            };

            const deactivate = (e) => {
                e.preventDefault();
                this.deactivateFX(fx);
                btn.classList.remove('active');
            };

            // Mouse
            btn.addEventListener('mousedown', activate);
            btn.addEventListener('mouseup', deactivate);
            btn.addEventListener('mouseleave', deactivate);

            // Touch
            btn.addEventListener('touchstart', activate, { passive: false });
            btn.addEventListener('touchend', deactivate);
            btn.addEventListener('touchcancel', deactivate);
        });
    }

    activateFX(fx) {
        if (this.activeFX.has(fx)) return;
        this.activeFX.add(fx);

        const engine = this.seq.audioEngine;
        switch (fx) {
            case 'loop':
                engine.enableLoop();
                break;
            case 'slow':
                engine.enableSlow();
                break;
            case 'stutter':
                engine.enableStutter();
                break;
            case 'crush':
                engine.enableCrush();
                break;
        }
    }

    deactivateFX(fx) {
        if (!this.activeFX.has(fx)) return;
        this.activeFX.delete(fx);

        const engine = this.seq.audioEngine;
        switch (fx) {
            case 'loop':
                engine.disableLoop();
                break;
            case 'slow':
                engine.disableSlow();
                break;
            case 'stutter':
                engine.disableStutter();
                break;
            case 'crush':
                engine.disableCrush();
                break;
        }
    }

    releaseAllFX() {
        const buttons = document.querySelectorAll('.dj-fx-btn');
        buttons.forEach(btn => btn.classList.remove('active'));

        for (const fx of this.activeFX) {
            this.deactivateFX(fx);
        }
        this.activeFX.clear();
    }

    // ========================
    // Ribbon Controller
    // ========================

    setupRibbon() {
        if (!this.djRibbon) return;

        const handleInput = (clientX) => {
            const rect = this.djRibbon.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

            // Map 0..1 to -2..+2 (5 steps)
            // 0.0-0.2: -2
            // 0.2-0.4: -1
            // 0.4-0.6: 0
            // 0.6-0.8: +1
            // 0.8-1.0: +2
            // Continuous: -2 to +2
            const shift = (x * 4) - 2;

            this.seq.audioEngine.setOctaveShift(shift);

            // Update cursor
            if (this.djRibbonCursor) {
                this.djRibbonCursor.style.left = `${x * 80}%`;
            }
        };

        let activeTouchId = null;

        const onStart = (e) => {
            e.preventDefault();
            if (activeTouchId !== null) return;

            if (e.changedTouches) {
                const touch = e.changedTouches[0];
                activeTouchId = touch.identifier;
                handleInput(touch.clientX);
            } else {
                handleInput(e.clientX);
            }
        };

        const onMove = (e) => {
            e.preventDefault();
            if (e.changedTouches) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === activeTouchId) {
                        handleInput(e.changedTouches[i].clientX);
                        break;
                    }
                }
            } else if (e.buttons === 1) {
                handleInput(e.clientX);
            }
        };

        const onEnd = (e) => {
            e.preventDefault();
            let shouldEnd = false;

            if (e.changedTouches) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === activeTouchId) {
                        shouldEnd = true;
                        break;
                    }
                }
            } else {
                shouldEnd = true;
            }

            if (shouldEnd) {
                activeTouchId = null;
                this.seq.audioEngine.setOctaveShift(0);
                if (this.djRibbonCursor) {
                    this.djRibbonCursor.style.left = '40%';
                }
            }
        };

        this.djRibbon.addEventListener('mousedown', onStart);
        this.djRibbon.addEventListener('mousemove', onMove);
        this.djRibbon.addEventListener('mouseup', onEnd);
        this.djRibbon.addEventListener('mouseleave', onEnd);

        this.djRibbon.addEventListener('touchstart', onStart, { passive: false });
        this.djRibbon.addEventListener('touchmove', onMove, { passive: false });
        this.djRibbon.addEventListener('touchend', onEnd);
        this.djRibbon.addEventListener('touchcancel', onEnd);
    }

    // ========================
    // XY Pad
    // ========================

    setupXYPad() {
        if (!this.djXYPad) return;

        let activeTouchId = null;

        const handleStart = (clientX, clientY) => {
            const rect = this.djXYPad.getBoundingClientRect();
            // Calculate normalized x/y
            const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

            this.xyState.touching = true;
            this.xyState.startX = x;
            this.xyState.startY = y;
            this.xyState.targetX = x;
            this.xyState.targetY = y;
            this.xyState.x = x;
            this.xyState.y = y;

            this.djOrigin.classList.remove('hidden');
            this.djCurrent.classList.remove('hidden');
            this.djLine.classList.remove('hidden');

            // Calculate initial audio effect
            const deltaX = x - this.xyState.startX;
            const deltaY = this.xyState.startY - y;
            this.updateAudio(deltaX, deltaY);
        };

        const handleMove = (clientX, clientY) => {
            if (!this.xyState.touching) return;
            const rect = this.djXYPad.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

            this.xyState.targetX = x;
            this.xyState.targetY = y;
        };

        const handleEnd = () => {
            this.xyState.touching = false;
            activeTouchId = null;

            this.djOrigin.classList.add('hidden');
            this.djCurrent.classList.add('hidden');
            this.djLine.classList.add('hidden');
            this.seq.audioEngine.resetDJFilter();
        };

        // Mouse Listeners
        this.djXYPad.addEventListener('mousedown', (e) => {
            handleStart(e.clientX, e.clientY);
        });
        this.djXYPad.addEventListener('mousemove', (e) => {
            // Only move if mouse button down
            if (e.buttons === 1) handleMove(e.clientX, e.clientY);
        });
        this.djXYPad.addEventListener('mouseup', handleEnd);
        this.djXYPad.addEventListener('mouseleave', handleEnd);

        // Touch Listeners (Multi-touch support)
        this.djXYPad.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (activeTouchId !== null) return; // Already active

            if (e.changedTouches.length > 0) {
                const t = e.changedTouches[0];
                activeTouchId = t.identifier;
                handleStart(t.clientX, t.clientY);
            }
        }, { passive: false });

        this.djXYPad.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (activeTouchId === null) return;

            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === activeTouchId) {
                    const t = e.changedTouches[i];
                    handleMove(t.clientX, t.clientY);
                    break;
                }
            }
        }, { passive: false });

        const onTouchEnd = (e) => {
            if (activeTouchId === null) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === activeTouchId) {
                    handleEnd();
                    break;
                }
            }
        };
        this.djXYPad.addEventListener('touchend', onTouchEnd);
        this.djXYPad.addEventListener('touchcancel', onTouchEnd);
    }

    // ========================
    // Render Loop
    // ========================

    renderLoop() {
        if (this.isOpen) {
            const smoothing = 0.5;
            this.xyState.x += (this.xyState.targetX - this.xyState.x) * smoothing;
            this.xyState.y += (this.xyState.targetY - this.xyState.y) * smoothing;

            if (this.xyState.touching) {
                const deltaX = this.xyState.x - this.xyState.startX;
                const deltaY = this.xyState.startY - this.xyState.y;
                this.updateAudio(deltaX, deltaY);
                this.updateVisuals();
            }

            this.renderRipples();
        }
        requestAnimationFrame(this.renderLoop);
    }

    updateVisuals() {
        const { startX, startY, x, y } = this.xyState;
        const rect = this.djXYPad.getBoundingClientRect();

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

    /** Check if standby mode is active (used by onStep for beat pulse) */
    get isStandby() {
        return false;
    }

    // --- Ripple Effect ---

    resizeRippleCanvas() {
        if (!this.rippleCanvas || !this.djXYPad) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = this.djXYPad.getBoundingClientRect();
        this.rippleCanvas.width = rect.width * dpr;
        this.rippleCanvas.height = rect.height * dpr;
        if (this.rippleCtx) {
            this.rippleCtx.scale(dpr, dpr);
        }
    }

    addRipple(intensity = 1.0) {
        if (!this.isOpen || !this.djXYPad) return;
        const rect = this.djXYPad.getBoundingClientRect();
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
        if (!this.rippleCtx || !this.djXYPad) return;
        const rect = this.djXYPad.getBoundingClientRect();

        if (this.ripples.length === 0) {
            this.rippleCtx.clearRect(0, 0, rect.width, rect.height);
            return;
        }

        const ctx = this.rippleCtx;
        ctx.clearRect(0, 0, rect.width, rect.height);

        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];

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
