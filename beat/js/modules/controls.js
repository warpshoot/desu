export class Controls {
    constructor(audioEngine, onBPMChange, onSwingChange, onClear, onPlay, onStop, onLoopToggle) {
        this.audioEngine = audioEngine;
        this.onBPMChange = onBPMChange;
        this.onSwingChange = onSwingChange;
        this.onClear = onClear;
        this.onPlay = onPlay;
        this.onStop = onStop;
        this.onLoopToggle = onLoopToggle;
        this.isPlaying = false;
        this.swingEnabled = false;

        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.clearBtn = document.getElementById('clear-btn');
        this.loopBtn = document.getElementById('loop-btn');
        this.swingBtn = document.getElementById('swing-btn');

        this.bpmDragValue = document.getElementById('bpm-drag-value');
        this.bpmDecBtn = document.getElementById('bpm-dec');
        this.bpmIncBtn = document.getElementById('bpm-inc');
        this.volumeSlider = document.getElementById('volume-slider');

        this.init();
    }

    init() {
        this.setupEvents();
        this.setupBPMDrag();
    }

    setupEvents() {
        // Play/Pause button
        if (this.playPauseBtn) {
            this.playIcon = this.playPauseBtn.querySelector('.play-icon');
            this.pauseIcon = this.playPauseBtn.querySelector('.pause-icon');

            this.playPauseBtn.addEventListener('click', async () => {
                if (!this.audioEngine.initialized) {
                    await this.audioEngine.init();
                    // Re-apply current state to the fresh audio engine
                    this.audioEngine.setBPM(parseInt(this.bpmDragValue.textContent));
                    this.audioEngine.setMasterVolume(parseFloat(this.volumeSlider.value));
                }
                this.togglePlay();
            });
        }

        // Stop button
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => {
                this.stop();
            });
        }

        // BPM Buttons
        if (this.bpmDecBtn) {
            this.bpmDecBtn.addEventListener('click', () => {
                const currentBpm = parseInt(this.bpmDragValue.textContent);
                this.setBPM(currentBpm - 1);
            });
        }
        if (this.bpmIncBtn) {
            this.bpmIncBtn.addEventListener('click', () => {
                const currentBpm = parseInt(this.bpmDragValue.textContent);
                this.setBPM(currentBpm + 1);
            });
        }

        // Volume slider
        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', (e) => {
                const vol = parseFloat(e.target.value);
                this.audioEngine.setMasterVolume(vol);
                if (this.onVolumeChange) {
                    this.onVolumeChange(vol);
                }
            });
        }

        // Swing button
        if (this.swingBtn) {
            this.swingBtn.addEventListener('click', () => {
                this.toggleSwing();
            });
        }

        // Clear button
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => {
                if (window.confirm('全ての設定とグリッドをリセットしますか？')) {
                    if (this.onClear) {
                        this.onClear();
                    }
                }
            });
        }

        // Loop toggle
        if (this.loopBtn) {
            this.loopBtn.addEventListener('click', () => {
                if (this.onLoopToggle) this.onLoopToggle();
            });
        }

        // Shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;

            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePlay();
            } else if (e.code === 'KeyL') {
                if (this.onLoopToggle) this.onLoopToggle();
            }
        });
    }

    setupBPMDrag() {
        if (!this.bpmDragValue) return;

        let startY = 0;
        let startX = 0;
        let startBpm = 0;

        const onMove = (e) => {
            // Only handle single-finger touches for BPM adjustment
            if (e.touches && e.touches.length !== 1) return;

            if (e.touches && e.touches.length === 1) {
                e.preventDefault();
            }

            const currentY = e.touches ? e.touches[0].clientY : e.clientY;
            const currentX = e.touches ? e.touches[0].clientX : e.clientX;

            // Calculate movement from both axes
            const dx = currentX - startX;
            const dy = startY - currentY; // Up is positive

            // Sensitivity: 1 bpm per 4 pixels
            const sensitivity = 0.25;
            const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;

            let newBpm = Math.round(startBpm + delta * sensitivity);
            this.setBPM(newBpm);
        };

        const onEnd = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onEnd);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);

            if (this.onBPMChange) {
                this.onBPMChange(parseInt(this.bpmDragValue.textContent));
            }
        };

        this.bpmDragValue.addEventListener('mousedown', (e) => {
            startY = e.clientY;
            startX = e.clientX;
            startBpm = parseInt(this.bpmDragValue.textContent);
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onEnd);
        });

        this.bpmDragValue.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                startY = e.touches[0].clientY;
                startX = e.touches[0].clientX;
                startBpm = parseInt(this.bpmDragValue.textContent);
                window.addEventListener('touchmove', onMove, { passive: false });
                window.addEventListener('touchend', onEnd);
            }
        }, { passive: false });
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        this.audioEngine.play();
        this.isPlaying = true;
        if (this.playIcon) this.playIcon.classList.add('hidden');
        if (this.pauseIcon) this.pauseIcon.classList.remove('hidden');
        if (this.playPauseBtn) this.playPauseBtn.classList.add('active');
        if (this.onPlay) this.onPlay();
    }

    pause() {
        this.audioEngine.pause();
        this.isPlaying = false;
        if (this.playIcon) this.playIcon.classList.remove('hidden');
        if (this.pauseIcon) this.pauseIcon.classList.add('hidden');
        if (this.playPauseBtn) this.playPauseBtn.classList.remove('active');
        // No onStop call here as it's just pause
    }

    stop() {
        this.audioEngine.stop();
        this.isPlaying = false;
        if (this.playIcon) this.playIcon.classList.remove('hidden');
        if (this.pauseIcon) this.pauseIcon.classList.add('hidden');
        if (this.playPauseBtn) this.playPauseBtn.classList.remove('active');
        if (this.onStop) this.onStop();
    }

    setBPM(bpm) {
        bpm = Math.max(60, Math.min(180, bpm));
        this.bpmDragValue.textContent = bpm;
        this.audioEngine.setBPM(bpm);
        // We don't call onBPMChange (storage save) here to avoid too many writes during drag
    }

    setVolume(db) {
        if (this.volumeSlider) {
            this.volumeSlider.value = db;
            this.audioEngine.setMasterVolume(db);
        }
    }

    toggleSwing() {
        this.swingEnabled = !this.swingEnabled;
        this.audioEngine.setSwing(this.swingEnabled);
        if (this.swingEnabled) {
            this.swingBtn.classList.add('active');
        } else {
            this.swingBtn.classList.remove('active');
        }
        if (this.onSwingChange) {
            this.onSwingChange(this.swingEnabled);
        }
    }

    setSwing(enabled) {
        this.swingEnabled = enabled;
        this.audioEngine.setSwing(enabled);
        if (enabled) {
            this.swingBtn.classList.add('active');
        } else {
            this.swingBtn.classList.remove('active');
        }
    }
}
