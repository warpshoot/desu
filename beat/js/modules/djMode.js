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

        // Automation Recording
        this.isRecordingAuto = false;
        this.hasStartedAny = false;
        this.hasStartedXY = false;
        this.hasStartedFX = {
            loop: false,
            slow: false,
            stutter: false,
            crush: false
        };
        this.hasStartedPitch = false;
        this.lastStep = -1;

        // Ribbon state
        this.pitchShift = 0;
        this.ribbonTouching = false;
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

        // Setup Auto Rec Button (Simple Toggle)
        const autoRecBtn = document.getElementById('dj-auto-rec');
        if (autoRecBtn) {
            autoRecBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.isRecordingAuto = !this.isRecordingAuto;
                // Reset granular recording flags when toggling AUTO
                this.hasStartedAny = false;
                this.hasStartedXY = false;
                this.hasStartedFX = { loop: false, slow: false, stutter: false, crush: false };
                this.hasStartedPitch = false;
                this.hasStartedPitch = false;

                this.updateAutoButtonState();

                // Disable 1 BAR button during AUTO session
                const loopBtn = document.querySelector('.dj-fx-btn[data-fx="loop"]');
                if (loopBtn) {
                    if (this.isRecordingAuto) {
                        loopBtn.classList.add('disabled');
                        // Ensure loop is disabled if it was active
                        this.deactivateFX('loop');
                        loopBtn.classList.remove('active');
                    } else {
                        loopBtn.classList.remove('disabled');
                    }
                }
            });
        }

        // Setup CLR Button (Menu)
        const clrBtn = document.getElementById('dj-clr-btn');
        if (clrBtn) {
            clrBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showAutoMenu(clrBtn);
            });
        }

        // Setup Auto Menu Items
        const clearPatBtn = document.getElementById('auto-clear-pattern');
        const clearAllBtn = document.getElementById('auto-clear-all');
        if (clearPatBtn) {
            clearPatBtn.addEventListener('click', () => {
                this.clearPatternAutomation(this.seq.state.currentPattern);
                document.getElementById('auto-menu').classList.add('hidden');
            });
        }
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearAllAutomation();
                document.getElementById('auto-menu').classList.add('hidden');
            });
        }
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
        this.updateAutoButtonState();
    }

    close() {
        this.isOpen = false;
        this.djOverlay.classList.add('hidden');

        // Release all FX (only actual FX buttons)
        this.releaseAllFX();

        // Stops recording automation when closing the panel
        this.isRecordingAuto = false;
        const autoRecBtn = document.getElementById('dj-auto-rec');
        if (autoRecBtn) autoRecBtn.classList.remove('active');

        // Reset filter
        this.seq.audioEngine.resetDJFilter();

        // Also ensure automated button states are cleared from UI
        document.querySelectorAll('.dj-fx-btn').forEach(btn => {
            btn.classList.remove('automated');
        });

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
                if (!this.isRecordingAuto) engine.enableLoop();
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
        // Only target buttons with data-fx (actual effects)
        const buttons = document.querySelectorAll('.dj-fx-btn[data-fx]');
        buttons.forEach(btn => btn.classList.remove('active'));

        for (const fx of this.activeFX) {
            this.deactivateFX(fx);
        }
        this.activeFX.clear();
    }

    // ========================
    // Automation Logic
    // ========================

    showAutoMenu(btn) {
        this.autoMenu = document.getElementById('auto-menu');
        if (!this.autoMenu) return;

        this.seq.hideAllMenus();
        this.seq._suppressClick = true;

        const rect = btn.getBoundingClientRect();
        this.autoMenu.style.left = `${rect.left}px`;
        this.autoMenu.style.bottom = (window.innerHeight - rect.top + 5) + 'px';
        this.autoMenu.style.top = 'auto';
        this.autoMenu.classList.remove('hidden');
    }

    clearPatternAutomation(patIndex, part = 'all', shouldSave = true) {
        const pat = this.seq.state.patterns[patIndex];
        if (pat && pat.automation) {
            if (part === 'all' || part === 'xy') {
                pat.automation.x.fill(null);
                pat.automation.y.fill(null);
            }
            if (part === 'all' || part === 'pitch') {
                if (pat.automation.pitch) pat.automation.pitch.fill(null);
            }
            if (part === 'all' || part === 'fx') {
                if (typeof part === 'string' && part !== 'all' && part !== 'fx') {
                    // Clear specific FX channel
                    if (pat.automation.fx[part]) pat.automation.fx[part].fill(null);
                } else {
                    // Clear all FX channels
                    Object.keys(pat.automation.fx).forEach(k => {
                        pat.automation.fx[k].fill(null);
                    });
                }
            }
            if (shouldSave) {
                import('./storage.js').then(m => m.saveState(this.seq.state));
            }
            this.updateAutoButtonState();
        }
    }

    clearAllAutomation() {
        this.seq.state.patterns.forEach(pat => {
            if (pat.automation) {
                pat.automation.x.fill(null);
                pat.automation.y.fill(null);
                if (pat.automation.pitch) pat.automation.pitch.fill(null);
                if (pat.automation.fx && typeof pat.automation.fx === 'object') {
                    Object.keys(pat.automation.fx).forEach(k => pat.automation.fx[k].fill(null));
                }
            }
        });
        import('./storage.js').then(m => m.saveState(this.seq.state));
        this.updateAutoButtonState();
    }

    onStep(step) {
        if (!this.seq.audioEngine.playing) return;

        const pat = this.seq.pattern;
        if (!pat.automation || !this.isOpen) return;

        // Loop Boundary: Reset recording pass-flags so we can hear the result in the next loop
        if (step <= this.lastStep) {
            this.hasStartedXY = false;
            if (typeof this.hasStartedFX === 'object') {
                Object.keys(this.hasStartedFX).forEach(k => this.hasStartedFX[k] = false);
            } else {
                this.hasStartedFX = false;
            }
            this.hasStartedPitch = false;
        }


        // 1. Handle Recording Logic (Granular)
        if (this.isRecordingAuto) {
            const hasInput = this.xyState.touching || this.activeFX.size > 0 || this.ribbonTouching;

            if (hasInput && !this.hasStartedAny) {
                // First interaction: Clear EVERYTHING in this pattern for a clean overwrite
                this.clearPatternAutomation(this.seq.state.currentPattern, 'all', false);
                this.hasStartedAny = true;
                this.hasStartedXY = true;
                Object.keys(this.hasStartedFX).forEach(k => this.hasStartedFX[k] = true);
                this.hasStartedPitch = true;
            }

            if (this.hasStartedAny) {
                // XY Pad Recording
                if (this.xyState.touching) {
                    this.hasStartedXY = true;
                    pat.automation.x[step] = this.xyState.x - this.xyState.startX;
                    pat.automation.y[step] = this.xyState.startY - this.xyState.y;
                } else if (this.hasStartedXY) {
                    pat.automation.x[step] = null;
                    pat.automation.y[step] = null;
                }

                // FX Recording (Granular) - Skip loop
                const fxTypes = ['slow', 'stutter', 'crush'];
                fxTypes.forEach(fx => {
                    if (this.activeFX.has(fx)) {
                        this.hasStartedFX[fx] = true;
                        pat.automation.fx[fx][step] = true;
                    } else if (this.hasStartedFX[fx]) {
                        pat.automation.fx[fx][step] = null;
                    }
                });

                // Pitch Recording
                if (this.ribbonTouching) {
                    this.hasStartedPitch = true;
                    pat.automation.pitch[step] = this.pitchShift;
                } else if (this.hasStartedPitch) {
                    pat.automation.pitch[step] = null;
                }
            }
        }

        // 2. Playback Logic
        // XY Playback if not currently recording/touching XY
        if ((!this.isRecordingAuto || !this.hasStartedXY) && !this.xyState.touching) {
            const ax = pat.automation.x[step];
            const ay = pat.automation.y[step];
            if (ax !== null && ay !== null) {
                this.updateAudio(ax, ay);
                // Assume start point is 0.5 (center) for visual representation if not touching
                this.updateVisuals(0.5 + ax, 0.5 - ay, 0.5, 0.5);
                this.djOrigin.classList.remove('hidden');
                this.djCurrent.classList.remove('hidden');
                this.djLine.classList.remove('hidden');

                if (step % 2 === 0) this.addRipple(0.3);
            } else {
                this.seq.audioEngine.resetDJFilter();
                this.djOrigin.classList.add('hidden');
                this.djCurrent.classList.add('hidden');
                this.djLine.classList.add('hidden');
            }
        }

        // FX Playback (Granular) - Skip loop to maintain timeline stability
        const fxPlaybackTypes = ['slow', 'stutter', 'crush'];
        fxPlaybackTypes.forEach(fx => {
            const engine = this.seq.audioEngine;
            const isManual = this.activeFX.has(fx);
            const isRecordingThis = (typeof this.hasStartedFX === 'object') ? this.hasStartedFX[fx] : this.hasStartedFX;

            // Apply automated FX only if not currently recording or manual-holding it
            if (!isManual && (!this.isRecordingAuto || !isRecordingThis)) {
                const isAutomated = pat.automation.fx[fx] && pat.automation.fx[fx][step];
                if (isAutomated) {
                    if (fx === 'slow') engine.enableSlow();
                    if (fx === 'stutter') engine.enableStutter();
                    if (fx === 'crush') engine.enableCrush();
                } else {
                    if (fx === 'slow') engine.disableSlow();
                    if (fx === 'stutter') engine.disableStutter();
                    if (fx === 'crush') engine.disableCrush();
                }
            }
        });

        // Update UI buttons to show active status (either manual or automated)
        const buttons = document.querySelectorAll('.dj-fx-btn[data-fx]');
        buttons.forEach(btn => {
            const fx = btn.dataset.fx;
            const isManual = this.activeFX.has(fx);
            const isAutomated = !isManual && pat.automation.fx[fx] && pat.automation.fx[fx][step];

            btn.classList.toggle('active', isManual);
            btn.classList.toggle('automated', !!isAutomated);
        });

        // Pitch Playback if not currently recording/touching Ribbon
        if ((!this.isRecordingAuto || !this.hasStartedPitch) && !this.ribbonTouching) {
            const apitch = pat.automation.pitch ? pat.automation.pitch[step] : null;
            if (apitch !== null) {
                this.seq.audioEngine.setOctaveShift(apitch);
                if (this.djRibbonCursor) {
                    // Map -2..+2 back to 0..80% (matching setupRibbon logic)
                    const x = (apitch + 2) / 4;
                    this.djRibbonCursor.style.left = `${x * 80}%`;
                }
            } else {
                this.seq.audioEngine.setOctaveShift(0);
                if (this.djRibbonCursor && !this.ribbonTouching) {
                    this.djRibbonCursor.style.left = '40%';
                }
            }
        }

        this.lastStep = step;

        this.updateAutoButtonState();
    }

    updateAutoButtonState() {
        const autoBtn = document.getElementById('dj-auto-rec');
        if (autoBtn) {
            if (this.isRecordingAuto) {
                autoBtn.classList.add('active');
                autoBtn.classList.remove('playing');
            } else {
                autoBtn.classList.remove('active');
                if (this.checkAutomationData()) {
                    autoBtn.classList.add('playing');
                } else {
                    autoBtn.classList.remove('playing');
                }
            }
        }
    }

    checkAutomationData() {
        // Use the current pattern being played
        const pat = this.seq.pattern;
        if (!pat || !pat.automation) return false;

        const hasX = pat.automation.x.some(v => v !== null);
        const hasY = pat.automation.y.some(v => v !== null);
        const hasPitch = pat.automation.pitch && pat.automation.pitch.some(v => v !== null);
        let hasFX = false;
        if (pat.automation.fx) {
            hasFX = Object.keys(pat.automation.fx).some(k => pat.automation.fx[k].some(v => v !== null));
        }

        return hasX || hasY || hasPitch || hasFX;
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
            const shift = (x * 4) - 2;
            this.pitchShift = shift;

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
            this.ribbonTouching = true;

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
                this.ribbonTouching = false;
                this.pitchShift = 0;
                this.seq.audioEngine.setOctaveShift(0);
                if (this.djRibbonCursor) {
                    this.djRibbonCursor.style.left = '40%';
                }
                // Save after interaction
                import('./storage.js').then(m => m.saveState(this.seq.state));
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

            // Save after interaction
            import('./storage.js').then(m => m.saveState(this.seq.state));
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

    updateVisuals(x = this.xyState.x, y = this.xyState.y, startX = this.xyState.startX, startY = this.xyState.startY) {
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
