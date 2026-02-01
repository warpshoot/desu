import { ROWS, COLS, OCTAVE_RANGE, TAP_THRESHOLD, PITCH_RANGE, DURATION_RANGE, DEFAULT_ROLL_SUBDIVISION, TRACKS, KNOB_PARAMS, DEFAULT_BPM, DEFAULT_SCALE, DEFAULT_SWING_ENABLED, DEFAULT_OCTAVE } from './modules/constants.js';
import { AudioEngine } from './modules/audioEngine.js';
import { Cell } from './modules/cell.js';
import { Controls } from './modules/controls.js';
import { TonePanel } from './modules/tonePanel.js';
import { loadState, saveState, createDefaultState, exportProject, importProject } from './modules/storage.js';

class Sequencer {
    constructor() {
        this.state = loadState();

        this.audioEngine = new AudioEngine();
        this.cells = [];
        this.isPainting = false;
        this.paintingTrack = null;
        this.isTwoFingerTouch = false; // Track two-finger touches globally

        // Dance animation
        this.danceFrame = 0;
        this.dancer = null;

        this.init();
    }

    init() {
        this.createGrid();

        this.controls = new Controls(
            this.audioEngine,
            (bpm) => {
                this.state.bpm = bpm;
                saveState(this.state);
            },
            (swingEnabled) => {
                this.state.swingEnabled = swingEnabled;
                saveState(this.state);
            },
            () => {
                this.clearGrid();
            },
            () => {
                // onPlay
                if (this.dancer) {
                    this.dancer.classList.add('playing');
                }
            },
            () => {
                this.clearPlayheads();
            },
            () => { // onLoopToggle
                this.state.loopEnabled = !this.state.loopEnabled;
                this.audioEngine.setLoopRange(this.state.loopStart, this.state.loopEnd, this.state.loopEnabled);
                this.controls.setLoop(this.state.loopEnabled);
                this.updateTimelineVisuals();
                saveState(this.state);
            },
            (scaleName) => { // onScaleChange
                this.state.scale = scaleName;
                saveState(this.state);
            },
            (scaleName) => { // onScaleChange
                this.state.scale = scaleName;
                saveState(this.state);
            }
        );
        this.controls.onVolumeChange = (vol) => {
            this.state.masterVolume = vol;
            saveState(this.state);
        };

        this.controls.setBPM(this.state.bpm);
        this.controls.setSwing(this.state.swingEnabled || false);
        this.controls.setVolume(this.state.masterVolume || -12);
        this.controls.setScale(this.state.scale || 'Chromatic');
        this.controls.setScale(this.state.scale || 'Chromatic');

        const tonePanelEl = document.getElementById('tone-panel');
        if (tonePanelEl) {
            this.tonePanel = new TonePanel(
                tonePanelEl,
                this.audioEngine,
                (track, param, value) => {
                    this.state.trackParams[track][param] = value;
                    saveState(this.state);
                }
            );
        }

        this.audioEngine.setLoopRange(this.state.loopStart, this.state.loopEnd, this.state.loopEnabled);

        this.initTimeline();

        this.initRollMenu();

        this.setupTrackIcons();
        this.setupTrackControls();

        // Setup controls callbacks
        this.controls.setLoop = (enabled) => {
            const loopBtn = document.getElementById('loop-btn');
            if (loopBtn) {
                loopBtn.classList.toggle('active', enabled);
            }
        };

        this.controls.setLoop(this.state.loopEnabled);

        this.audioEngine.setStepCallback((step, time) => {
            this.onStep(step, time);
        });

        this.audioEngine.setStopCallback(() => {
            if (this.controls) {
                this.controls.resetUI();
            }
            // Reset dance animation
            this.resetDanceAnimation();
        });

        // Initialize dance animation
        this.dancer = document.getElementById('visualizer-display');
        if (this.dancer) {
            this.danceFrame = 0;
        }

        // Global two-finger detection for pan scrolling
        window.addEventListener('touchstart', (e) => {
            if (e.touches.length >= 2) {
                this.isTwoFingerTouch = true;
                // Cancel any ongoing painting
                this.isPainting = false;
            }
        }, { passive: true });

        window.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                this.isTwoFingerTouch = false;
            }
            if (e.touches.length === 0) {
                this.isPainting = false;
            }
        }, { passive: true });

        // Global mouseup/touchend to stop painting
        window.addEventListener('mouseup', () => {
            this.isPainting = false;
        });

        // Touch painting support
        window.addEventListener('touchmove', (e) => {
            // Allow two-finger panning by not preventing default
            if (e.touches.length >= 2) {
                this.isTwoFingerTouch = true;
                this.isPainting = false;
                return; // Let browser handle two-finger scroll
            }

            if (this.isPainting && e.touches.length === 1) {
                e.preventDefault();
                const touch = e.touches[0];
                const element = document.elementFromPoint(touch.clientX, touch.clientY);
                if (element && element.classList.contains('cell')) {
                    const track = parseInt(element.dataset.track);
                    const step = parseInt(element.dataset.step);

                    // Track locking check
                    if (!isNaN(track) && !isNaN(step)) {
                        if (this.paintingTrack === null || this.paintingTrack === track) {
                            this.cells[track][step].paintActivate();
                        }
                    }
                }
            }
        }, { passive: false });

        this.initCreditModal();
        this.setupFileUI();
    }

    setupFileUI() {
        const fileBtn = document.getElementById('file-btn');
        const fileMenu = document.getElementById('file-menu');
        const newBtn = document.getElementById('new-btn');
        const saveBtn = document.getElementById('save-btn');
        const loadBtn = document.getElementById('load-btn');
        const fileInput = document.getElementById('file-input');

        if (!fileBtn || !fileMenu) return;

        // Toggle menu
        fileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = fileBtn.getBoundingClientRect();
            // Position menu above the button (since it's at the bottom)
            fileMenu.style.position = 'fixed';
            fileMenu.style.bottom = (window.innerHeight - rect.top + 5) + 'px'; // Above button
            fileMenu.style.left = (rect.left - 20) + 'px';
            fileMenu.style.top = 'auto'; // Clear top

            fileMenu.classList.toggle('hidden');
        });

        // Close menu on outside click
        document.addEventListener('click', (e) => {
            if (!fileMenu.contains(e.target) && !fileBtn.contains(e.target)) {
                fileMenu.classList.add('hidden');
            }
        });

        // NEW Project
        newBtn.addEventListener('click', () => {
            if (confirm('Create new project? Current progress will be lost.')) {
                this.clearGrid();
                fileMenu.classList.add('hidden');
            }
        });

        // SAVE Project
        saveBtn.addEventListener('click', () => {
            exportProject(this.state);
            fileMenu.classList.add('hidden');
        });

        // LOAD Project
        loadBtn.addEventListener('click', () => {
            fileInput.click();
            fileMenu.classList.add('hidden');
        });

        // File Input Change
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                try {
                    const newState = await importProject(file);
                    this.state = newState;

                    // Stop audio engine before full reset
                    this.audioEngine.stop();

                    // Re-apply state to all components
                    this.restoreState();

                    // Reset input
                    fileInput.value = '';
                } catch (err) {
                    alert('Failed to load project.');
                }
            }
        });
    }

    restoreState() {
        // 1. Controls
        this.controls.setBPM(this.state.bpm);
        this.controls.setSwing(this.state.swingEnabled);
        this.controls.setVolume(this.state.masterVolume);
        this.controls.setScale(this.state.scale);
        this.controls.setLoop(this.state.loopEnabled);

        // 2. Audio Engine Global Params
        this.audioEngine.setBPM(this.state.bpm);
        this.audioEngine.setMasterVolume(this.state.masterVolume);

        // 3. Audio Engine Track Params
        for (let i = 0; i < ROWS; i++) {
            // Params
            const params = this.state.trackParams[i];
            this.audioEngine.updateTrackParams(i, params);

            // Mute/Solo
            this.audioEngine.setTrackMute(i, this.state.mutedTracks ? this.state.mutedTracks[i] : false);
            this.audioEngine.setTrackSolo(i, this.state.soloedTracks ? this.state.soloedTracks[i] : false);
        }

        this.audioEngine.setLoopRange(this.state.loopStart, this.state.loopEnd, this.state.loopEnabled);

        // 4. Update UI Grid
        const gridContainer = document.getElementById('grid-container');
        if (gridContainer) gridContainer.innerHTML = '';
        this.createGrid();

        // 5. Update Timeline
        this.updateTimelineVisuals();

        // 6. Update Track Controls UI (Mute/Solo buttons)
        this.setupTrackControls();
    }

    initCreditModal() {
        const creditBtn = document.getElementById('credit-btn');
        const creditModal = document.getElementById('credit-modal');
        const creditContent = document.getElementById('credit-content');

        if (creditBtn && creditModal) {
            creditBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                creditModal.classList.add('visible');
            });

            creditModal.addEventListener('click', () => {
                creditModal.classList.remove('visible');
            });

            if (creditContent) {
                creditContent.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
        }
    }

    initRollMenu() {
        this.rollMenuElement = document.getElementById('roll-menu');
        this.currentRollCell = null;

        // Click outside to close
        document.addEventListener('mousedown', (e) => {
            if (!this.rollMenuElement.contains(e.target)) {
                this.rollMenuElement.classList.add('hidden');
            }
        });

        // Option selection
        this.rollMenuElement.querySelectorAll('.roll-option').forEach(option => {
            option.addEventListener('click', () => {
                if (this.currentRollCell) {
                    const sub = parseInt(option.dataset.roll);
                    this.currentRollCell.setRollSubdivision(sub);
                    this.rollMenuElement.classList.add('hidden');
                }
            });
        });
    }

    initTimeline() {
        this.timelineContainer = document.getElementById('timeline-container');
        this.startHandle = document.getElementById('loop-start-handle');
        this.endHandle = document.getElementById('loop-end-handle');
        this.timelineBeats = [];

        // Create guides
        for (let beat = 0; beat < 8; beat++) {
            const beatElement = document.createElement('div');
            beatElement.className = 'timeline-beat';
            beatElement.dataset.beat = beat;
            this.timelineContainer.appendChild(beatElement);
            this.timelineBeats.push(beatElement);
        }

        const setupHandleDrag = (handle, isStart) => {
            const onMove = (e) => {
                // Only handle single-finger touches for loop handles
                if (e.touches && e.touches.length !== 1) return;

                if (e.touches && e.touches.length === 1) {
                    e.preventDefault();
                }

                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;

                // Use a Y coordinate consistent with the timeline blocks
                const timelineRect = this.timelineContainer.getBoundingClientRect();
                const targetY = timelineRect.top + timelineRect.height / 2;

                const element = document.elementFromPoint(clientX, targetY);
                if (element && element.classList.contains('timeline-beat')) {
                    const newBeat = parseInt(element.dataset.beat);

                    if (isStart) {
                        const stepStart = newBeat * 4;
                        if (stepStart <= this.state.loopEnd) {
                            this.state.loopStart = stepStart;
                        }
                    } else {
                        const stepEnd = (newBeat * 4) + 3;
                        if (stepEnd >= this.state.loopStart) {
                            this.state.loopEnd = stepEnd;
                        }
                    }

                    this.audioEngine.setLoopRange(this.state.loopStart, this.state.loopEnd, this.state.loopEnabled);
                    this.updateTimelineVisuals();
                    saveState(this.state);
                }
            };

            const onEnd = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onEnd);
                window.removeEventListener('touchmove', onMove);
                window.removeEventListener('touchend', onEnd);
            };

            handle.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent text selection
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onEnd);
            });

            handle.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    e.preventDefault();
                    window.addEventListener('touchmove', onMove, { passive: false });
                    window.addEventListener('touchend', onEnd);
                }
            }, { passive: false });
        };

        setupHandleDrag(this.startHandle, true);
        setupHandleDrag(this.endHandle, false);

        // Wait for next frame to ensure layout is ready
        requestAnimationFrame(() => {
            this.updateTimelineVisuals();
        });
    }

    updateTimelineVisuals() {
        if (!this.cells.length || !this.cells[0].length) return;

        const gridContainer = document.getElementById('grid-container');
        const gridWrapper = document.getElementById('grid-wrapper');
        if (!gridContainer || !gridWrapper) return;

        const wrapperRect = gridWrapper.getBoundingClientRect();

        // Find start position
        const startCellEl = this.cells[0][this.state.loopStart].element;
        const startRect = startCellEl.getBoundingClientRect();
        const startX = startRect.left - wrapperRect.left;
        this.startHandle.style.left = `${startX - 34}px`; // Shifted left by ~1 cell (24px) from -10px

        // Find end position
        const endCellEl = this.cells[0][this.state.loopEnd].element;
        const endRect = endCellEl.getBoundingClientRect();
        const endX = endRect.right - wrapperRect.left;
        this.endHandle.style.left = `${endX - 10}px`; // Shifted right by another 12px (total 24px) from -34px

        // Update guides
        this.timelineBeats.forEach((beatElement, index) => {
            const stepStart = index * 4;
            const stepEnd = stepStart + 3;
            const inRange = stepStart >= this.state.loopStart && stepEnd <= this.state.loopEnd;

            beatElement.classList.toggle('in-range', inRange && this.state.loopEnabled);
        });
    }

    showRollMenu(cell, x, y) {
        this.currentRollCell = cell;

        // Mark current sub
        const currentSub = cell.data.rollMode ? cell.data.rollSubdivision : 1;
        this.rollMenuElement.querySelectorAll('.roll-option').forEach(opt => {
            opt.classList.toggle('active', parseInt(opt.dataset.roll) === currentSub);
        });

        this.rollMenuElement.classList.remove('hidden');

        // Position menu above cell
        const menuRect = this.rollMenuElement.getBoundingClientRect();
        this.rollMenuElement.style.left = `${x - menuRect.width / 2}px`;
        this.rollMenuElement.style.top = `${y - menuRect.height - 10}px`;
    }

    createGrid() {
        const gridContainer = document.getElementById('grid-container');

        for (let track = 0; track < ROWS; track++) {
            const trackConfig = TRACKS[track];
            this.cells[track] = [];
            for (let step = 0; step < COLS; step++) {
                const cellElement = document.createElement('div');
                cellElement.className = 'cell';
                cellElement.dataset.track = track;
                cellElement.dataset.step = step;

                const cellData = this.state.grid[track][step];
                if (cellData.active) {
                    cellElement.classList.add('active');
                }
                if (cellData.rollMode) {
                    cellElement.classList.add('roll');
                }

                const cell = new Cell(
                    cellElement,
                    track,
                    step,
                    cellData,
                    async (t, s, d, shouldPlay) => {
                        saveState(this.state);
                        if (shouldPlay) {
                            if (!this.audioEngine.initialized) {
                                await this.audioEngine.init();
                                this.audioEngine.setBPM(this.state.bpm);
                                this.audioEngine.setMasterVolume(this.state.masterVolume);
                            }
                            const cellInstance = this.cells[t][s];
                            this.audioEngine.triggerNote(
                                t,
                                cellInstance.getEffectivePitch(),
                                d.duration,
                                Tone.now() + 0.05,
                                d.rollMode,
                                d.rollSubdivision,
                                this.state.trackOctaves[t]
                            );
                        }
                    },
                    (c, x, y) => {
                        this.showRollMenu(c, x, y);
                    },
                    (isStart, trackId) => {
                        if (isStart) {
                            this.isPainting = true;
                            this.paintingTrack = trackId;
                        } else {
                            this.isPainting = false;
                            this.paintingTrack = null;
                        }
                    },
                    () => this.isPainting,
                    trackConfig.baseFreq,
                    document.getElementById('note-indicator'),
                    () => this.isTwoFingerTouch,
                    () => this.state.scale || 'Chromatic'
                );

                this.cells[track][step] = cell;
                gridContainer.appendChild(cellElement);
            }
        }
    }

    setupTrackIcons() {
        this.trackIcons = document.querySelectorAll('.track-icon');

        // Track double-tap state
        const tapState = [];
        for (let i = 0; i < TRACKS.length; i++) {
            tapState[i] = { count: 0, lastTapTime: 0, timer: null };
        }

        this.trackIcons.forEach((icon, track) => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation();

                const now = Date.now();
                const state = tapState[track];
                const timeSinceLastTap = now - state.lastTapTime;

                if (timeSinceLastTap < TAP_THRESHOLD) {
                    state.count++;
                } else {
                    state.count = 1;
                }

                state.lastTapTime = now;
                clearTimeout(state.timer);

                // Single tap: open tone panel
                state.timer = setTimeout(() => {
                    if (state.count === 1) {
                        this.tonePanel.toggle(track, this.state.trackParams[track]);
                    }
                    state.count = 0;
                }, TAP_THRESHOLD);
            });
        });
    }


    clearGrid() {
        // Stop playback first to reset UI
        if (this.controls) {
            this.controls.stop();
        }

        // 1. Reset Pattern
        this.state.grid = createDefaultState().grid;

        // 2. Reset Mute/Solo
        this.state.mutedTracks = new Array(ROWS).fill(false);
        this.state.soloedTracks = new Array(ROWS).fill(false);

        // Update UI buttons
        document.querySelectorAll('.mute-btn, .solo-btn').forEach(btn => btn.classList.remove('active'));

        // Update AudioEngine states
        for (let i = 0; i < ROWS; i++) {
            this.audioEngine.setTrackMute(i, false);
            this.audioEngine.setTrackSolo(i, false);
        }

        // 3. Reset Sound Parameters
        this.state.trackParams = [];
        for (let i = 0; i < ROWS; i++) {
            const params = {
                cutoff: KNOB_PARAMS.cutoff.default,
                resonance: KNOB_PARAMS.resonance.default,
                modulation: KNOB_PARAMS.modulation.default,
                release: KNOB_PARAMS.release.default,
                vol: KNOB_PARAMS.vol.default
            };
            this.state.trackParams.push(params);
            // Apply to Audio Engine
            this.audioEngine.updateTrackParams(i, params);
        }

        // 4. Reset BPM, Scale, Swing, Volume, Octaves
        this.state.bpm = DEFAULT_BPM;
        this.controls.setBPM(DEFAULT_BPM);

        this.state.scale = DEFAULT_SCALE;
        this.controls.setScale(DEFAULT_SCALE);

        this.state.swingEnabled = DEFAULT_SWING_ENABLED;
        this.controls.setSwing(DEFAULT_SWING_ENABLED);

        this.state.masterVolume = -12;
        this.controls.setVolume(-12);

        this.state.loopEnabled = true;
        this.state.loopStart = 0;
        this.state.loopEnd = COLS - 1;
        this.controls.setLoop(true);
        this.audioEngine.setLoopRange(0, COLS - 1, true);
        this.updateTimelineVisuals();

        this.state.trackOctaves = new Array(ROWS).fill(DEFAULT_OCTAVE);

        // 5. Rebuild Grid UI
        const gridContainer = document.getElementById('grid-container');
        if (gridContainer) gridContainer.innerHTML = ''; // Clear existing
        this.createGrid();

        saveState(this.state);

        // Close tone panel if open
        if (this.tonePanel && this.tonePanel.isOpen()) {
            this.tonePanel.close();
        }
    }

    clearPlayheads() {
        for (let track = 0; track < ROWS; track++) {
            for (let step = 0; step < COLS; step++) {
                this.cells[track][step].setPlayhead(false);
            }
        }
    }

    triggerTrackPulse(trackIndex) {
        const icon = this.trackIcons[trackIndex];
        if (icon) {
            icon.classList.remove('playing');
            void icon.offsetWidth; // Force reflow
            icon.classList.add('playing');
        }
    }

    onStep(step, time) {
        // Update playhead visuals
        for (let track = 0; track < ROWS; track++) {
            for (let s = 0; s < COLS; s++) {
                this.cells[track][s].setPlayhead(s === step);
            }

            // Trigger notes for active cells
            const cell = this.cells[track][step];
            if (cell.data.active) {
                // Visual feedback
                cell.triggerPulse();

                // Track Icon Pulse Logic (Sync with AudioEngine logic)
                const isAnySolo = this.state.soloedTracks && this.state.soloedTracks.some(s => s);
                const isSoloed = this.state.soloedTracks && this.state.soloedTracks[track];
                const isMuted = this.state.mutedTracks && this.state.mutedTracks[track];

                let shouldPulse = true;
                if (isAnySolo) {
                    shouldPulse = isSoloed;
                } else {
                    shouldPulse = !isMuted;
                }

                if (shouldPulse) {
                    this.triggerTrackPulse(track);
                }

                // Trigger audio
                this.audioEngine.triggerNote(
                    track,
                    cell.getEffectivePitch(),
                    cell.data.duration,
                    time,
                    cell.data.rollMode,
                    cell.data.rollSubdivision,
                    this.state.trackOctaves[track]
                );
            }
        }

        // Update dance animation every 2 steps (8th note)
        if (step % 2 === 0) {
            this.updateDanceFrame();
        }
    }

    setupTrackControls() {
        // Sync initial state
        const controls = document.querySelectorAll('.track-ctrls');

        controls.forEach((ctrl, i) => {
            const muteBtn = ctrl.querySelector('.mute-btn');
            const soloBtn = ctrl.querySelector('.solo-btn');

            // Remove old listeners to prevent duplicates (though we init once)
            const newMuteBtn = muteBtn.cloneNode(true);
            const newSoloBtn = soloBtn.cloneNode(true);
            muteBtn.parentNode.replaceChild(newMuteBtn, muteBtn);
            soloBtn.parentNode.replaceChild(newSoloBtn, soloBtn);

            if (newMuteBtn && newSoloBtn) {
                // Initial state
                if (this.state.mutedTracks && this.state.mutedTracks[i]) {
                    newMuteBtn.classList.add('active');
                    this.audioEngine.setTrackMute(i, true);
                }
                if (this.state.soloedTracks && this.state.soloedTracks[i]) {
                    newSoloBtn.classList.add('active');
                    this.audioEngine.setTrackSolo(i, true);
                }

                // Listeners
                newMuteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    newMuteBtn.classList.toggle('active');
                    void newMuteBtn.offsetWidth; // Force Reflow
                    const isMuted = newMuteBtn.classList.contains('active');

                    if (!this.state.mutedTracks) this.state.mutedTracks = [];
                    this.state.mutedTracks[i] = isMuted;
                    this.audioEngine.setTrackMute(i, isMuted);

                    // Mutually exclusive: If Muting, turn off Solo
                    if (isMuted && newSoloBtn.classList.contains('active')) {
                        newSoloBtn.classList.remove('active');
                        void newSoloBtn.offsetWidth; // Force Reflow
                        if (!this.state.soloedTracks) this.state.soloedTracks = [];
                        this.state.soloedTracks[i] = false;
                        this.audioEngine.setTrackSolo(i, false);
                    }

                    saveState(this.state);
                });

                newSoloBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    newSoloBtn.classList.toggle('active');
                    const isSoloed = newSoloBtn.classList.contains('active');

                    if (!this.state.soloedTracks) this.state.soloedTracks = [];
                    this.state.soloedTracks[i] = isSoloed;
                    this.audioEngine.setTrackSolo(i, isSoloed);

                    // Mutually exclusive: If Soloing, turn off Mute
                    if (isSoloed && newMuteBtn.classList.contains('active')) {
                        newMuteBtn.classList.remove('active');
                        if (!this.state.mutedTracks) this.state.mutedTracks = [];
                        this.state.mutedTracks[i] = false;
                        this.audioEngine.setTrackMute(i, false);
                    }

                    saveState(this.state);
                });
            }
        });
    }

    updateDanceFrame() {
        if (!this.dancer) return;

        // Update frame (8 frames total)
        this.danceFrame = (this.danceFrame + 1) % 8;

        // Update background position (each frame is 48px wide)
        const frameWidth = 48;
        this.dancer.style.backgroundPosition = `${-this.danceFrame * frameWidth}px 0px`;
    }

    resetDanceAnimation() {
        if (!this.dancer) return;

        // Reset to first frame
        this.danceFrame = 0;
        this.dancer.style.backgroundPosition = '0px 0px';

        // Remove playing class to hide animation
        this.dancer.classList.remove('playing');
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    new Sequencer();
});
