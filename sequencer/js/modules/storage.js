import { STORAGE_KEY, DEFAULT_BPM, KNOB_PARAMS, DEFAULT_ROLL_SUBDIVISION } from './constants.js';

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
            return JSON.parse(saved);
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
        for (let step = 0; step < 16; step++) {
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

    return {
        grid,
        bpm: DEFAULT_BPM,
        trackParams
    };
}
