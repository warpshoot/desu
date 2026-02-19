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
        label.style.color = '#666'; // Default, will be overridden by Unicorn CSS

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '4px';

        this.scaleSelect = document.createElement('select');
        this.scaleSelect.id = 'scale-select'; // ADDED ID
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
        applyAllBtn.className = 'control-btn-sm';
        applyAllBtn.style.width = 'auto';
        applyAllBtn.style.padding = '0 8px';
        applyAllBtn.style.marginLeft = '4px';
        applyAllBtn.style.height = '28px';

        applyAllBtn.addEventListener('click', () => {
            if (this.onScaleApplyAll) {
                this.onScaleApplyAll(this.scaleSelect.value);

                // Visual feedback
                const originalText = applyAllBtn.textContent;

                applyAllBtn.textContent = 'OK';
                applyAllBtn.classList.add('active');

                setTimeout(() => {
                    applyAllBtn.textContent = originalText;
                    applyAllBtn.classList.remove('active');
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
        let hasDragged = false;
        const DRAG_THRESHOLD = 5;

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

            if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
                hasDragged = true;
            }

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

            if (hasDragged) {
                if (this.onBPMChange) {
                    this.onBPMChange(parseInt(this.bpmDragValue.textContent));
                }
            } else {
                this.showBPMPicker();
            }
        };

        this.bpmDragValue.addEventListener('mousedown', (e) => {
            hasDragged = false;
            startY = e.clientY;
            startX = e.clientX;
            startBpm = parseInt(this.bpmDragValue.textContent);
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onEnd);
        });

        this.bpmDragValue.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                hasDragged = false;
                startY = e.touches[0].clientY;
                startX = e.touches[0].clientX;
                startBpm = parseInt(this.bpmDragValue.textContent);
                window.addEventListener('touchmove', onMove, { passive: false });
                window.addEventListener('touchend', onEnd);
            }
        }, { passive: false });
    }

    showBPMPicker() {
        if (!this.bpmDragValue) return;

        const MIN = 60, MAX = 180;
        const ITEM_HEIGHT = 36;
        const VISIBLE = 5;
        const PAD = Math.floor(VISIBLE / 2);
        let selectedBpm = parseInt(this.bpmDragValue.textContent);

        // Overlay (transparent, catches outside taps)
        const overlay = document.createElement('div');
        overlay.className = 'bpm-picker-overlay';

        // Picker positioned below (or above) the BPM display
        const picker = document.createElement('div');
        picker.className = 'bpm-picker';
        const rect = this.bpmDragValue.getBoundingClientRect();
        const pickerH = ITEM_HEIGHT * VISIBLE;
        let top = rect.bottom + 6;
        if (top + pickerH > window.innerHeight - 8) top = rect.top - pickerH - 6;
        picker.style.top = top + 'px';
        picker.style.left = (rect.left + rect.width / 2) + 'px';

        // Scrollable list
        const list = document.createElement('div');
        list.className = 'bpm-picker-list';

        for (let i = 0; i < PAD; i++) {
            const pad = document.createElement('div');
            pad.className = 'bpm-picker-item';
            list.appendChild(pad);
        }
        for (let bpm = MIN; bpm <= MAX; bpm++) {
            const item = document.createElement('div');
            item.className = 'bpm-picker-item';
            if (bpm === selectedBpm) item.classList.add('bpm-picker-item-selected');
            item.textContent = bpm;
            item.dataset.bpm = bpm;
            list.appendChild(item);
        }
        for (let i = 0; i < PAD; i++) {
            const pad = document.createElement('div');
            pad.className = 'bpm-picker-item';
            list.appendChild(pad);
        }

        // Center selection bar
        const highlight = document.createElement('div');
        highlight.className = 'bpm-picker-highlight';

        picker.appendChild(list);
        picker.appendChild(highlight);
        overlay.appendChild(picker);
        document.body.appendChild(overlay);

        // Set initial scroll position
        list.scrollTop = (selectedBpm - MIN) * ITEM_HEIGHT;

        let prevBpm = selectedBpm;
        let scrollTimer;

        const updateSelected = () => {
            const idx = Math.round(list.scrollTop / ITEM_HEIGHT);
            const newBpm = Math.max(MIN, Math.min(MAX, MIN + idx));
            if (newBpm !== prevBpm) {
                const oldEl = list.querySelector(`[data-bpm="${prevBpm}"]`);
                const newEl = list.querySelector(`[data-bpm="${newBpm}"]`);
                if (oldEl) oldEl.classList.remove('bpm-picker-item-selected');
                if (newEl) newEl.classList.add('bpm-picker-item-selected');
                prevBpm = newBpm;
                selectedBpm = newBpm;
                this.setBPM(newBpm);
            }
        };

        list.addEventListener('scroll', () => {
            updateSelected();
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                list.scrollTo({ top: (selectedBpm - MIN) * ITEM_HEIGHT, behavior: 'smooth' });
            }, 150);
        });

        list.addEventListener('click', (e) => {
            const item = e.target.closest('[data-bpm]');
            if (!item) return;
            const bpm = parseInt(item.dataset.bpm);
            selectedBpm = bpm;
            list.scrollTo({ top: (bpm - MIN) * ITEM_HEIGHT, behavior: 'smooth' });
            setTimeout(close, 200);
        });

        const close = () => {
            clearTimeout(scrollTimer);
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (this.onBPMChange) this.onBPMChange(selectedBpm);
        };

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
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

            // Update text for feedback
            if (this.swingLevel === 'OFF') {
                this.swingBtn.textContent = 'SWG';
            } else if (this.swingLevel === 'LIGHT') {
                this.swingBtn.textContent = 'SWG'; // or 'LGT'
            } else if (this.swingLevel === 'HEAVY') {
                this.swingBtn.textContent = 'SWG!';
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
