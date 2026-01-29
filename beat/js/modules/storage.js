import { STORAGE_KEY, DEFAULT_BPM, KNOB_PARAMS, DEFAULT_ROLL_SUBDIVISION, DEFAULT_SWING_ENABLED, DEFAULT_OCTAVE, COLS, ROWS } from './constants.js';

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
        let saved = localStorage.getItem(STORAGE_KEY);

        // Migration from old name
        if (!saved) {
            import('./constants.js').then(({ OLD_STORAGE_KEY }) => {
                const oldData = localStorage.getItem(OLD_STORAGE_KEY);
                if (oldData) {
                    localStorage.setItem(STORAGE_KEY, oldData);
                    // We'll keep the old one for safely for now
                }
            });
            // Re-fetch if needed or just continue (the next load will be perfect)
            // For now, let's just use the old one directly if beating is empty
            const oldData = localStorage.getItem('sequencer-state'); // Hardcode since async import above is tricky here
            if (oldData) saved = oldData;
        }

        if (saved) {
            const state = JSON.parse(saved);

            // Migration: Add tracks if needed (from 4 to ROWS)
            if (!state.grid || state.grid.length < ROWS) {
                const currentRows = state.grid ? state.grid.length : 0;
                for (let track = currentRows; track < ROWS; track++) {
                    state.grid[track] = [];
                    for (let step = 0; step < COLS; step++) {
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

            // Migration: Fix individual rows if they have wrong step count
            if (state.grid) {
                for (let track = 0; track < state.grid.length; track++) {
                    if (state.grid[track].length < COLS) {
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
            }

            // Migration: Add missing fields
            if (state.swingEnabled === undefined) {
                state.swingEnabled = DEFAULT_SWING_ENABLED;
            }
            if (state.loopEnabled === undefined) {
                state.loopEnabled = true;
                state.loopStart = 0;
                state.loopEnd = COLS - 1;
            }
            if (!state.trackOctaves || state.trackOctaves.length < ROWS) {
                const currentLen = state.trackOctaves ? state.trackOctaves.length : 0;
                if (!state.trackOctaves) state.trackOctaves = [];
                for (let i = currentLen; i < ROWS; i++) {
                    state.trackOctaves[i] = DEFAULT_OCTAVE;
                }
            }
            if (!state.trackParams || state.trackParams.length < ROWS) {
                const currentLen = state.trackParams ? state.trackParams.length : 0;
                if (!state.trackParams) state.trackParams = [];
                for (let i = currentLen; i < ROWS; i++) {
                    state.trackParams[i] = {
                        cutoff: KNOB_PARAMS.cutoff.default,
                        resonance: KNOB_PARAMS.resonance.default,
                        modulation: KNOB_PARAMS.modulation.default,
                        release: KNOB_PARAMS.release.default,
                        vol: KNOB_PARAMS.vol.default
                    };
                }
            }

            // Migration: Add vol if missing in existing trackParams
            if (state.trackParams) {
                state.trackParams.forEach(params => {
                    if (params.vol === undefined) {
                        params.vol = KNOB_PARAMS.vol.default;
                    }
                });
            }

            if (state.masterVolume === undefined) {
                state.masterVolume = -12;
            }

            if (!state.mutedTracks) state.mutedTracks = new Array(ROWS).fill(false);
            if (!state.soloedTracks) state.soloedTracks = new Array(ROWS).fill(false);

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
    for (let track = 0; track < ROWS; track++) {
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
    for (let i = 0; i < ROWS; i++) {
        trackParams[i] = {
            cutoff: KNOB_PARAMS.cutoff.default,
            resonance: KNOB_PARAMS.resonance.default,
            modulation: KNOB_PARAMS.modulation.default,
            release: KNOB_PARAMS.release.default,
            vol: KNOB_PARAMS.vol.default
        };
    }

    const trackOctaves = [];
    for (let i = 0; i < ROWS; i++) {
        trackOctaves[i] = DEFAULT_OCTAVE;
    }

    const mutedTracks = new Array(ROWS).fill(false);
    const soloedTracks = new Array(ROWS).fill(false);

    return {
        grid,
        bpm: DEFAULT_BPM,
        masterVolume: -12,
        trackParams,
        swingEnabled: DEFAULT_SWING_ENABLED,
        trackOctaves,
        loopStart: 0,
        loopEnd: COLS - 1,
        loopEnabled: true,
        mutedTracks,
        soloedTracks
    };
}
