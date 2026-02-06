import { STORAGE_KEY, DEFAULT_BPM, KNOB_PARAMS, DEFAULT_ROLL_SUBDIVISION, DEFAULT_SWING_ENABLED, DEFAULT_OCTAVE, ROWS, DEFAULT_SCALE, TRACKS, MAX_PATTERNS, COLS, CHAIN_LENGTH } from './constants.js';

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

// Create a single default pattern data object
export function createDefaultPattern() {
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
        const defaults = TRACKS[i].defaultParams || {};
        trackParams[i] = {
            tune: defaults.tune !== undefined ? defaults.tune : KNOB_PARAMS.tune.default,
            cutoff: defaults.cutoff !== undefined ? defaults.cutoff : KNOB_PARAMS.cutoff.default,
            resonance: defaults.resonance !== undefined ? defaults.resonance : KNOB_PARAMS.resonance.default,
            drive: defaults.drive !== undefined ? defaults.drive : KNOB_PARAMS.drive.default,
            decay: defaults.decay !== undefined ? defaults.decay : KNOB_PARAMS.decay.default,
            vol: defaults.vol !== undefined ? defaults.vol : KNOB_PARAMS.vol.default
        };
    }

    const trackOctaves = new Array(ROWS).fill(DEFAULT_OCTAVE);
    const mutedTracks = new Array(ROWS).fill(false);
    const soloedTracks = new Array(ROWS).fill(false);

    return {
        grid,
        bpm: DEFAULT_BPM,
        trackParams,
        swingEnabled: DEFAULT_SWING_ENABLED,
        trackOctaves,
        mutedTracks,
        soloedTracks,
        scale: DEFAULT_SCALE
    };
}

// Migrate a single pattern's grid to current COLS count
function migratePatternGrid(pattern) {
    if (!pattern.grid) {
        pattern.grid = createDefaultPattern().grid;
        return;
    }

    // Add tracks if needed
    if (pattern.grid.length < ROWS) {
        for (let track = pattern.grid.length; track < ROWS; track++) {
            pattern.grid[track] = [];
            for (let step = 0; step < COLS; step++) {
                pattern.grid[track][step] = {
                    active: false, pitch: 0, duration: 0.5,
                    rollMode: false, rollSubdivision: DEFAULT_ROLL_SUBDIVISION
                };
            }
        }
    }

    // Adjust step count per track (truncate or extend)
    for (let track = 0; track < pattern.grid.length; track++) {
        if (pattern.grid[track].length > COLS) {
            // Truncate to COLS
            pattern.grid[track] = pattern.grid[track].slice(0, COLS);
        } else if (pattern.grid[track].length < COLS) {
            for (let step = pattern.grid[track].length; step < COLS; step++) {
                pattern.grid[track][step] = {
                    active: false, pitch: 0, duration: 0.5,
                    rollMode: false, rollSubdivision: DEFAULT_ROLL_SUBDIVISION
                };
            }
        }
    }
}

// Migrate pattern-level fields
function migratePatternFields(pattern) {
    if (pattern.swingEnabled === undefined) pattern.swingEnabled = DEFAULT_SWING_ENABLED;

    // Remove legacy loop range fields
    delete pattern.loopEnabled;
    delete pattern.loopStart;
    delete pattern.loopEnd;

    if (!pattern.trackOctaves || pattern.trackOctaves.length < ROWS) {
        if (!pattern.trackOctaves) pattern.trackOctaves = [];
        for (let i = pattern.trackOctaves.length; i < ROWS; i++) {
            pattern.trackOctaves[i] = DEFAULT_OCTAVE;
        }
    }
    if (!pattern.trackParams || pattern.trackParams.length < ROWS) {
        if (!pattern.trackParams) pattern.trackParams = [];
        for (let i = pattern.trackParams.length; i < ROWS; i++) {
            const defaults = TRACKS[i].defaultParams || {};
            pattern.trackParams[i] = {
                tune: defaults.tune !== undefined ? defaults.tune : KNOB_PARAMS.tune.default,
                cutoff: defaults.cutoff !== undefined ? defaults.cutoff : KNOB_PARAMS.cutoff.default,
                resonance: defaults.resonance !== undefined ? defaults.resonance : KNOB_PARAMS.resonance.default,
                drive: defaults.drive !== undefined ? defaults.drive : KNOB_PARAMS.drive.default,
                decay: defaults.decay !== undefined ? defaults.decay : KNOB_PARAMS.decay.default,
                vol: defaults.vol !== undefined ? defaults.vol : KNOB_PARAMS.vol.default
            };
        }
    }
    // Migration: rename modulation->drive, release->decay in existing trackParams
    if (pattern.trackParams) {
        pattern.trackParams.forEach(params => {
            if (params.vol === undefined) params.vol = KNOB_PARAMS.vol.default;
            if (params.tune === undefined) params.tune = KNOB_PARAMS.tune.default;
            if (params.drive === undefined) {
                params.drive = KNOB_PARAMS.drive.default;
                delete params.modulation;
            }
            if (params.decay === undefined) {
                params.decay = params.release !== undefined ? params.release : KNOB_PARAMS.decay.default;
                delete params.release;
            }
        });
    }
    if (!pattern.mutedTracks) pattern.mutedTracks = new Array(ROWS).fill(false);
    if (!pattern.soloedTracks) pattern.soloedTracks = new Array(ROWS).fill(false);
    if (!pattern.scale) pattern.scale = DEFAULT_SCALE;
    if (pattern.bpm === undefined) pattern.bpm = DEFAULT_BPM;
}

// Load state from localStorage
export function loadState() {
    try {
        let saved = localStorage.getItem(STORAGE_KEY);

        // Migration from old name
        if (!saved) {
            const oldData = localStorage.getItem('sequencer-state');
            if (oldData) saved = oldData;
        }

        if (saved) {
            const state = JSON.parse(saved);

            // === Migration: old single-pattern state to pattern bank ===
            if (!state.patterns) {
                // Old format: state IS a single pattern
                // Convert to new format
                const oldPattern = {
                    grid: state.grid,
                    bpm: state.bpm || DEFAULT_BPM,
                    trackParams: state.trackParams,
                    swingEnabled: state.swingEnabled,
                    trackOctaves: state.trackOctaves,
                    mutedTracks: state.mutedTracks,
                    soloedTracks: state.soloedTracks,
                    scale: state.scale
                };

                migratePatternGrid(oldPattern);
                migratePatternFields(oldPattern);

                const patterns = [oldPattern];
                for (let i = 1; i < MAX_PATTERNS; i++) {
                    patterns.push(createDefaultPattern());
                }

                return {
                    currentPattern: 0,
                    nextPattern: null,
                    masterVolume: state.masterVolume !== undefined ? state.masterVolume : -12,
                    patterns,
                    chain: new Array(CHAIN_LENGTH).fill(null)
                };
            }

            // === Already new format: migrate each pattern ===
            if (state.currentPattern === undefined) state.currentPattern = 0;
            if (state.nextPattern === undefined) state.nextPattern = null;
            if (state.masterVolume === undefined) state.masterVolume = -12;

            // Ensure we have MAX_PATTERNS patterns
            if (!state.patterns) state.patterns = [];
            while (state.patterns.length < MAX_PATTERNS) {
                state.patterns.push(createDefaultPattern());
            }

            // Migrate each pattern
            for (let i = 0; i < state.patterns.length; i++) {
                migratePatternGrid(state.patterns[i]);
                migratePatternFields(state.patterns[i]);
            }

            // Migrate: add chain if missing
            if (!state.chain) {
                state.chain = new Array(CHAIN_LENGTH).fill(null);
            }

            return state;
        }
    } catch (e) {
        console.error('Failed to load state:', e);
    }
    return createDefaultState();
}

// Create default state (pattern bank format)
export function createDefaultState() {
    const patterns = [];
    for (let i = 0; i < MAX_PATTERNS; i++) {
        patterns.push(createDefaultPattern());
    }

    return {
        currentPattern: 0,
        nextPattern: null,
        masterVolume: -12,
        patterns,
        chain: new Array(CHAIN_LENGTH).fill(null)
    };
}

// Get current pattern from state (convenience)
export function getCurrentPattern(state) {
    return state.patterns[state.currentPattern];
}

// Export state as JSON file
export function exportProject(state) {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
    a.download = `beat_project_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Import state from JSON file
export function importProject(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const state = JSON.parse(e.target.result);
                // Basic validation - accept both old and new formats
                if (!state.patterns && !state.grid) {
                    throw new Error('Invalid project file');
                }

                // Save to storage immediately (loadState will handle migration)
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

                // Re-load through migration path
                const migratedState = loadState();
                resolve(migratedState);
            } catch (err) {
                console.error('Import failed:', err);
                reject(err);
            }
        };
        reader.readAsText(file);
    });
}
