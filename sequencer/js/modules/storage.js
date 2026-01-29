import { STORAGE_KEY, DEFAULT_BPM, KNOB_PARAMS, DEFAULT_ROLL_SUBDIVISION, DEFAULT_SWING_ENABLED, DEFAULT_OCTAVE, COLS } from './constants.js';

let saveTimeout = null;

// Debounced save function
export function saveState(state) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error('Failed to save state:', e);
        }
    }, 500);
}

// Load state from localStorage
export function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const state = JSON.parse(saved);

            // Migration: Expand grid from 16 to 32 steps if needed
            if (state.grid && state.grid[0] && state.grid[0].length < COLS) {
                for (let track = 0; track < 4; track++) {
                    const currentLength = state.grid[track].length;
                    for (let step = currentLength; step < COLS; step++) {
                        state.grid[track][step] = {
                            active: false,
                            pitch: 0,
                            duration: 0.5,
                            rollMode: false,
                            rollSubdivision: DEFAULT_ROLL_SUBDIVISION
                        };
                    }
                }
            }

            // Migration: Add missing fields
            if (!state.swingEnabled) {
                state.swingEnabled = DEFAULT_SWING_ENABLED;
            }
            if (!state.trackOctaves) {
                state.trackOctaves = [0, 0, 0, DEFAULT_OCTAVE];
            }

            // Migration: Add rollMode to existing cells if missing
            if (state.grid) {
                for (let track = 0; track < 4; track++) {
                    for (let step = 0; step < COLS; step++) {
                        if (state.grid[track][step].rollMode === undefined) {
                            state.grid[track][step].rollMode = false;
                            state.grid[track][step].rollSubdivision = DEFAULT_ROLL_SUBDIVISION;
                        }
                    }
                }
            }

            return state;
        }
    } catch (e) {
        console.error('Failed to load state:', e);
    }
    return createDefaultState();
}

// Create default state
export function createDefaultState() {
    const grid = [];
    for (let track = 0; track < 4; track++) {
        grid[track] = [];
        for (let step = 0; step < COLS; step++) {
            grid[track][step] = {
                active: false,
                pitch: 0,
                duration: 0.5,
                rollMode: false,
                rollSubdivision: DEFAULT_ROLL_SUBDIVISION
            };
        }
    }

    const trackParams = [];
    for (let i = 0; i < 4; i++) {
        trackParams[i] = {
            cutoff: KNOB_PARAMS.cutoff.default,
            resonance: KNOB_PARAMS.resonance.default,
            modulation: KNOB_PARAMS.modulation.default,
            release: KNOB_PARAMS.release.default
        };
    }

    const trackOctaves = [0, 0, 0, DEFAULT_OCTAVE]; // Last track (Synth) can shift octaves

    return {
        grid,
        bpm: DEFAULT_BPM,
        trackParams,
        swingEnabled: DEFAULT_SWING_ENABLED,
        trackOctaves
    };
}
