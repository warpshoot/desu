import { SCALES } from './constants.js';

export class Controls {
    constructor(audioEngine, onBPMChange, onSwingChange, onClear, onPlay, onStop, onRepeatToggle, onScaleChange, onScaleApplyAll, onInit) {
        this.audioEngine = audioEngine;
        this.onBPMChange = onBPMChange;
        this.onSwingChange = onSwingChange;
        this.onClear = onClear;
        this.onPlay = onPlay;
        this.onStop = onStop;
        this.onRepeatToggle = onRepeatToggle;
        this.onScaleChange = onScaleChange;
        this.onScaleApplyAll = onScaleApplyAll;
        this.onInit = onInit;
        this.isPlaying = false;
        this.swingLevel = 'OFF';
        this.repeatEnabled = true;
        this.isRecordingArmed = false;

        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.clearBtn = document.getElementById('clear-btn');
        this.swingBtn = document.getElementById('swing-btn');
        this.recBtn = document.getElementById('rec-btn');
        this.repeatBtn = document.getElementById('repeat-btn');

        this.bpmDragValue = document.getElementById('bpm-drag-value');
        this.bpmDecBtn = document.getElementById('bpm-dec');
        this.bpmIncBtn = document.getElementById('bpm-inc');
        this.volumeSlider = document.getElementById('volume-slider');

        this.init();
    }

    init() {
        this.setupEvents();
        this.setupBPMDrag();
        this.setupScaleCtrl();
    }



    setupScaleCtrl() {
        // Create UI elements dynamically
        const controlsEl = document.getElementById('controls');
        if (!controlsEl) return;

        const container = document.createElement('div');
        container.id = 'scale-ctrl';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.margin = '0 10px';

        const label = document.createElement('div');
        label.className = 'ctrl-label';
        label.textContent = 'SCALE';
        label.style.fontSize = '10px';
        label.style.marginBottom = '2px';
        label.style.color = '#aaa';

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '4px';

        this.scaleSelect = document.createElement('select');
        this.scaleSelect.style.background = '#333';
        this.scaleSelect.style.color = '#fff';
        this.scaleSelect.style.border = '1px solid #555';
        this.scaleSelect.style.borderRadius = '4px';
        this.scaleSelect.style.padding = '2px 4px';
        this.scaleSelect.style.fontSize = '11px';
        this.scaleSelect.style.width = '95px';
        this.scaleSelect.style.outline = 'none';

        // Populate options
        Object.keys(SCALES).forEach(scaleName => {
            const option = document.createElement('option');
            option.value = scaleName;
            option.textContent = scaleName;
            this.scaleSelect.appendChild(option);
        });

        this.scaleSelect.addEventListener('change', (e) => {
            if (this.onScaleChange) {
                this.onScaleChange(e.target.value);
            }
        });

        // Apply All Button
        const applyAllBtn = document.createElement('button');
        applyAllBtn.textContent = 'ALL';
        applyAllBtn.title = 'Apply scale to all patterns';
        applyAllBtn.style.setProperty('background', '#fff', 'important');
        applyAllBtn.style.setProperty('color', '#000', 'important');
        applyAllBtn.style.setProperty('border', '1px solid #666', 'important');
        applyAllBtn.style.setProperty('border-radius', '4px', 'important');
        applyAllBtn.style.setProperty('padding', '2px 6px', 'important');
        applyAllBtn.style.setProperty('font-size', '10px', 'important');
        applyAllBtn.style.setProperty('cursor', 'pointer', 'important');

        applyAllBtn.addEventListener('click', () => {
            if (this.onScaleApplyAll) {
                this.onScaleApplyAll(this.scaleSelect.value);

                // Visual feedback
                const originalText = applyAllBtn.textContent;
                const originalColor = applyAllBtn.style.color;
                const originalBg = applyAllBtn.style.background;

                applyAllBtn.textContent = 'OK';
                applyAllBtn.style.setProperty('background', '#ff69b4', 'important');
                applyAllBtn.style.setProperty('color', '#fff', 'important');

                setTimeout(() => {
                    applyAllBtn.textContent = originalText;
                    applyAllBtn.style.setProperty('background', '#fff', 'important');
                    applyAllBtn.style.setProperty('color', '#000', 'important');
                }, 1000);
            }
        });

        row.appendChild(this.scaleSelect);
        row.appendChild(applyAllBtn);

        container.appendChild(label);
        container.appendChild(row);

        // Insert before volume control or at specific position
        const volCtrl = document.getElementById('volume-ctrl');
        if (volCtrl) {
            controlsEl.insertBefore(container, volCtrl);
        } else {
            controlsEl.appendChild(container);
        }
    }





    setScale(scaleName) {
        const name = scaleName || 'Chromatic';
        if (this.scaleSelect && SCALES[name]) {
            this.scaleSelect.value = name;
        }
    }
    setupEvents() {
        // Play/Pause button
        if (this.playPauseBtn) {
            this.playIcon = this.playPauseBtn.querySelector('.play-icon');
            this.pauseIcon = this.playPauseBtn.querySelector('.pause-icon');

            this.playPauseBtn.addEventListener('click', async () => {
                if (!this.audioEngine.initialized) {
                    await this.audioEngine.init();
                    if (this.onInit) this.onInit();
                }
                await this.togglePlay();
            });
        }

        // Stop button
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => {
                this.stop();
            });
        }

        // Record button
        if (this.recBtn) {
            this.recBtn.addEventListener('click', () => {
                this.toggleRecordArm();
            });
        }

        // Repeat button
        if (this.repeatBtn) {
            this.repeatBtn.addEventListener('click', () => {
                this.toggleRepeat();
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
                if (this.onClear) {
                    this.onClear();
                }
            });
        }

        // Shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;

            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePlay();
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

    async togglePlay() {
        if (this.isPlaying) {
            await this.pause();
        } else {
            await this.play();
        }
    }

    async play() {
        this.audioEngine.play();
        this.isPlaying = true;
        if (this.playIcon) this.playIcon.classList.add('hidden');
        if (this.pauseIcon) this.pauseIcon.classList.remove('hidden');
        if (this.playPauseBtn) this.playPauseBtn.classList.add('active');
        document.body.classList.add('playing'); // Enable dark mode

        // Start recording if armed
        if (this.isRecordingArmed) {
            await this.audioEngine.startRecording();
            if (this.recBtn) {
                this.recBtn.classList.remove('armed');
                this.recBtn.classList.add('recording');
            }
        }

        if (this.onPlay) this.onPlay();
    }

    async pause() {
        this.audioEngine.pause();
        this.isPlaying = false;
        if (this.playIcon) this.playIcon.classList.remove('hidden');
        if (this.pauseIcon) this.pauseIcon.classList.add('hidden');
        if (this.playPauseBtn) this.playPauseBtn.classList.remove('active');

        // Stop recording on pause
        if (this.audioEngine.isRecording) {
            await this.audioEngine.stopRecording();
            this.isRecordingArmed = false;
            if (this.recBtn) {
                this.recBtn.classList.remove('recording');
                this.recBtn.classList.remove('armed');
            }
        }
        document.body.classList.remove('playing'); // Disable dark mode
        if (this.onPause) this.onPause();
    }

    async stop() {
        this.audioEngine.stop();
        this.isPlaying = false;
        if (this.playIcon) this.playIcon.classList.remove('hidden');
        if (this.pauseIcon) this.pauseIcon.classList.add('hidden');
        if (this.playPauseBtn) this.playPauseBtn.classList.remove('active');
        document.body.classList.remove('playing');

        // Stop recording if active
        if (this.audioEngine.isRecording) {
            await this.audioEngine.stopRecording();
            this.isRecordingArmed = false;
            if (this.recBtn) {
                this.recBtn.classList.remove('recording');
                this.recBtn.classList.remove('armed');
            }
        }

        if (this.onStop) this.onStop();
    }

    resetUI() {
        this.isPlaying = false;
        if (this.playIcon) this.playIcon.classList.remove('hidden');
        if (this.pauseIcon) this.pauseIcon.classList.add('hidden');
        if (this.playPauseBtn) this.playPauseBtn.classList.remove('active');
        document.body.classList.remove('playing');
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
        const levels = ['OFF', 'LIGHT', 'HEAVY'];
        let idx = levels.indexOf(this.swingLevel);
        idx = (idx + 1) % levels.length;
        this.setSwing(levels[idx]);
        if (this.onSwingChange) {
            this.onSwingChange(this.swingLevel);
        }
    }

    setSwing(level) {
        this.swingLevel = level || 'OFF';
        this.audioEngine.setSwingLevel(this.swingLevel);

        if (this.swingBtn) {
            this.swingBtn.classList.toggle('active', this.swingLevel !== 'OFF');
            this.swingBtn.classList.toggle('heavy', this.swingLevel === 'HEAVY');

            if (this.swingLevel === 'HEAVY') {
                this.swingBtn.textContent = 'SWG!';
            } else {
                this.swingBtn.textContent = 'SWG';
            }
        }
    }

    toggleRepeat() {
        this.repeatEnabled = !this.repeatEnabled;
        if (this.repeatBtn) {
            this.repeatBtn.classList.toggle('active', this.repeatEnabled);
        }
        if (this.onRepeatToggle) {
            this.onRepeatToggle(this.repeatEnabled);
        }
    }

    setRepeat(enabled) {
        this.repeatEnabled = enabled;
        if (this.repeatBtn) {
            this.repeatBtn.classList.toggle('active', enabled);
        }
    }

    toggleRecordArm() {
        // Can't arm while playing
        if (this.isPlaying) return;

        this.isRecordingArmed = !this.isRecordingArmed;
        if (this.recBtn) {
            if (this.isRecordingArmed) {
                this.recBtn.classList.add('armed');
            } else {
                this.recBtn.classList.remove('armed');
            }
        }
    }
}
