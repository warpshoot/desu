import { ROWS, COLS } from './modules/constants.js';
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
            }
        );
        this.controls.setBPM(this.state.bpm);

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
        trackIcons.forEach((icon, track) => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.tonePanel.toggle(track, this.state.trackParams[track]);
            });
        });
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
                    time
                );
            }
        }
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    new Sequencer();
});
