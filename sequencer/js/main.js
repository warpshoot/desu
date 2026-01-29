import { ROWS, COLS, OCTAVE_RANGE, TAP_THRESHOLD } from './modules/constants.js';
import { AudioEngine } from './modules/audioEngine.js';
import { Cell } from './modules/cell.js';
import { Controls } from './modules/controls.js';
import { TonePanel } from './modules/tonePanel.js';
import { loadState, saveState } from './modules/storage.js';

class Sequencer {
    constructor() {
        this.state = loadState();
        this.audioEngine = new AudioEngine();
        this.cells = [];

        this.init();
    }

    init() {
        // Create grid
        this.createGrid();

        // Initialize controls
        this.controls = new Controls(
            this.audioEngine,
            (bpm) => {
                this.state.bpm = bpm;
                saveState(this.state);
            },
            (swingEnabled) => {
                this.state.swingEnabled = swingEnabled;
                saveState(this.state);
            }
        );
        this.controls.setBPM(this.state.bpm);
        this.controls.setSwing(this.state.swingEnabled || false);

        // Initialize tone panel
        this.tonePanel = new TonePanel(
            document.getElementById('tone-panel'),
            this.audioEngine,
            (track, param, value) => {
                this.state.trackParams[track][param] = value;
                saveState(this.state);
            }
        );

        // Setup track icons
        this.setupTrackIcons();

        // Setup audio engine callback
        this.audioEngine.setStepCallback((step, time) => {
            this.onStep(step, time);
        });
    }

    createGrid() {
        const gridContainer = document.getElementById('grid-container');

        for (let track = 0; track < ROWS; track++) {
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
                    }
                );

                this.cells[track][step] = cell;
                gridContainer.appendChild(cellElement);
            }
        }
    }

    setupTrackIcons() {
        const trackIcons = document.querySelectorAll('.track-icon');

        // Track double-tap state
        const tapState = [];
        for (let i = 0; i < 4; i++) {
            tapState[i] = { count: 0, lastTapTime: 0, timer: null };
        }

        trackIcons.forEach((icon, track) => {
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

                // Double tap on Synth track (track 3): cycle octave
                if (state.count === 2 && track === 3) {
                    this.cycleOctave(track);
                    state.count = 0;
                }
                // Single tap: open tone panel
                else {
                    state.timer = setTimeout(() => {
                        if (state.count === 1) {
                            this.tonePanel.toggle(track, this.state.trackParams[track]);
                        }
                        state.count = 0;
                    }, TAP_THRESHOLD);
                }
            });
        });
    }

    cycleOctave(track) {
        const currentOctave = this.state.trackOctaves[track];
        const currentIndex = OCTAVE_RANGE.indexOf(currentOctave);
        const nextIndex = (currentIndex + 1) % OCTAVE_RANGE.length;
        this.state.trackOctaves[track] = OCTAVE_RANGE[nextIndex];

        // Visual feedback: update icon briefly
        const icon = document.querySelector(`.track-icon[data-track="${track}"]`);
        icon.style.opacity = '0.5';
        setTimeout(() => {
            icon.style.opacity = '1';
        }, 100);

        saveState(this.state);
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
                setTimeout(() => {
                    cell.triggerPulse();
                }, 0);

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
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    new Sequencer();
});
