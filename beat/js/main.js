import { ROWS, COLS, OCTAVE_RANGE, TAP_THRESHOLD, PITCH_RANGE, DURATION_RANGE, DEFAULT_ROLL_SUBDIVISION, TRACKS, KNOB_PARAMS } from './modules/constants.js';
import { AudioEngine } from './modules/audioEngine.js';
import { Cell } from './modules/cell.js';
import { Controls } from './modules/controls.js';
import { TonePanel } from './modules/tonePanel.js';
import { loadState, saveState, createDefaultState } from './modules/storage.js';

class Sequencer {
    constructor() {
        this.state = loadState();
        this.audioEngine = new AudioEngine();
        this.cells = [];
        this.isPainting = false;

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
            }
        );
        this.controls.onVolumeChange = (vol) => {
            this.state.masterVolume = vol;
            saveState(this.state);
        };

        this.controls.setBPM(this.state.bpm);
        this.controls.setSwing(this.state.swingEnabled || false);
        this.controls.setVolume(this.state.masterVolume || -12);

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

        // Global mouseup/touchend to stop painting
        window.addEventListener('mouseup', () => {
            this.isPainting = false;
        });
        window.addEventListener('touchend', () => {
            this.isPainting = false;
        });

        // Touch painting support
        window.addEventListener('touchmove', (e) => {
            if (this.isPainting && e.touches.length === 1) {
                const touch = e.touches[0];
                const element = document.elementFromPoint(touch.clientX, touch.clientY);
                if (element && element.classList.contains('cell')) {
                    const track = parseInt(element.dataset.track);
                    const step = parseInt(element.dataset.step);
                    if (!isNaN(track) && !isNaN(step)) {
                        this.cells[track][step].paintActivate();
                    }
                }
            }
        }, { passive: false });

        this.initNavigation();
    }

    initNavigation() {
        // Hamburger menu
        const hamburger = document.getElementById('hamburger');
        const navMenu = document.getElementById('navMenu');

        if (hamburger && navMenu) {
            hamburger.addEventListener('click', () => {
                hamburger.classList.toggle('active');
                navMenu.classList.toggle('active');
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
                    hamburger.classList.remove('active');
                    navMenu.classList.remove('active');
                }
            });
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
                e.preventDefault();
                window.addEventListener('touchmove', onMove, { passive: false });
                window.addEventListener('touchend', onEnd);
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
        this.startHandle.style.left = `${startX - 10}px`;

        // Find end position
        const endCellEl = this.cells[0][this.state.loopEnd].element;
        const endRect = endCellEl.getBoundingClientRect();
        const endX = endRect.right - wrapperRect.left;
        this.endHandle.style.left = `${endX - 10}px`;

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
                    () => {
                        saveState(this.state);
                    },
                    (c, x, y) => {
                        this.showRollMenu(c, x, y);
                    },
                    (isStart) => {
                        if (isStart) {
                            this.isPainting = true;
                        } else {
                            this.isPainting = false;
                        }
                    },
                    () => this.isPainting,
                    trackConfig.baseFreq,
                    document.getElementById('note-indicator')
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
        for (let track = 0; track < ROWS; track++) {
            for (let step = 0; step < COLS; step++) {
                this.cells[track][step].deactivate();
            }
        }

        // Reset BPM as well
        this.state.bpm = DEFAULT_BPM;
        this.controls.setBPM(DEFAULT_BPM);

        // Reset the state's grid to reflect the cleared cells
        this.state.grid = this.cells.map(row => row.map(cell => ({ ...cell.data })));
        saveState(this.state);
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
                    cell.data.pitch,
                    cell.data.duration,
                    time,
                    cell.data.rollMode,
                    cell.data.rollSubdivision,
                    this.state.trackOctaves[track]
                );
            }
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
                document.getElementById('clear-btn').addEventListener('click', () => {
                    if (confirm('Reset everything? (Patterns, Mute/Solo, Sounds)')) {
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

                        // 4. Force UI Refresh
                        this.renderGrid();
                        saveState(this.state);

                        // Close tone panel if open to reflect changes when reopened
                        if (this.tonePanel && this.tonePanel.isOpen()) {
                            this.tonePanel.close();
                        }
                    }
                });
                newMuteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    newMuteBtn.classList.toggle('active');
                    const isMuted = newMuteBtn.classList.contains('active');

                    if (!this.state.mutedTracks) this.state.mutedTracks = [];
                    this.state.mutedTracks[i] = isMuted;
                    this.audioEngine.setTrackMute(i, isMuted);

                    // Mutually exclusive: If Muting, turn off Solo
                    if (isMuted && newSoloBtn.classList.contains('active')) {
                        newSoloBtn.classList.remove('active');
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
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    new Sequencer();
});
