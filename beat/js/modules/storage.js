import { STORAGE_KEY, DEFAULT_BPM, KNOB_PARAMS, DEFAULT_ROLL_SUBDIVISION, DEFAULT_SWING_LEVEL, DEFAULT_OCTAVE, ROWS, DEFAULT_SCALE, TRACKS, MAX_PATTERNS, COLS, CHAIN_LENGTH } from './constants.js';

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
// Generate default track params
function createDefaultTrackParams() {
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
    return trackParams;
}

// Migrate track params (renames, defaults)
function migrateTrackParams(trackParams) {
    if (!trackParams) return createDefaultTrackParams();

    // Ensure length matches ROWS
    if (trackParams.length < ROWS) {
        for (let i = trackParams.length; i < ROWS; i++) {
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
    }

    trackParams.forEach(params => {
        if (params.vol === undefined) params.vol = KNOB_PARAMS.vol.default;
        if (params.tune === undefined) params.tune = KNOB_PARAMS.tune.default;
        if (params.drive === undefined) {
            params.drive = KNOB_PARAMS.drive.default;
            if (params.modulation !== undefined) delete params.modulation;
        }
        if (params.decay === undefined) {
            params.decay = params.release !== undefined ? params.release : KNOB_PARAMS.decay.default;
            if (params.release !== undefined) delete params.release;
        }
    });

    return trackParams;
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
                duration: 1.0,
                rollMode: false,
                rollSubdivision: DEFAULT_ROLL_SUBDIVISION,
                velocity: 1.0
            };
        }
    }

    const trackOctaves = new Array(ROWS).fill(DEFAULT_OCTAVE);
    const mutedTracks = new Array(ROWS).fill(false);
    const soloedTracks = new Array(ROWS).fill(false);

    return {
        grid,
        trackOctaves,
        mutedTracks,
        soloedTracks,
        scale: DEFAULT_SCALE,
        automation: {
            x: new Array(COLS).fill(null),
            y: new Array(COLS).fill(null),
            pitch: new Array(COLS).fill(null),
            fx: {
                loop: new Array(COLS).fill(null),
                slow: new Array(COLS).fill(null),
                stutter: new Array(COLS).fill(null),
                crush: new Array(COLS).fill(null)
            }
        }
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
                    active: false, pitch: 0, duration: 1.0,
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
                    active: false, pitch: 0, duration: 1.0,
                    rollMode: false, rollSubdivision: DEFAULT_ROLL_SUBDIVISION
                };
            }
        }
    }

    // Expand compact step formats (0 = default inactive, 1 = default active, partial object)
    for (let track = 0; track < pattern.grid.length; track++) {
        for (let step = 0; step < pattern.grid[track].length; step++) {
            const cell = pattern.grid[track][step];
            if (cell === 0 || cell === 1) {
                pattern.grid[track][step] = {
                    active: cell === 1, pitch: 0, duration: 1.0,
                    rollMode: false, rollSubdivision: DEFAULT_ROLL_SUBDIVISION
                };
            } else if (typeof cell === 'object' && cell !== null) {
                if (cell.active === undefined) cell.active = false;
                if (cell.pitch === undefined) cell.pitch = 0;
                if (cell.duration === undefined) cell.duration = 1.0;
                if (cell.rollMode === undefined) cell.rollMode = false;
                if (cell.rollSubdivision === undefined) cell.rollSubdivision = DEFAULT_ROLL_SUBDIVISION;
                if (cell.velocity === undefined) cell.velocity = 1.0;
            }
        }
    }
}

// Migrate pattern-level fields (Local settings)
function migratePatternFields(pattern) {
    // Cleanup legacy swingEnabled (moved to global)
    if (pattern.swingEnabled !== undefined) delete pattern.swingEnabled;

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

    if (!pattern.mutedTracks) pattern.mutedTracks = new Array(ROWS).fill(false);
    if (!pattern.soloedTracks) pattern.soloedTracks = new Array(ROWS).fill(false);
    if (!pattern.scale) pattern.scale = DEFAULT_SCALE;

    if (!pattern.automation) {
        pattern.automation = {
            x: new Array(COLS).fill(null),
            y: new Array(COLS).fill(null),
            pitch: new Array(COLS).fill(null),
            fx: {
                loop: new Array(COLS).fill(null),
                slow: new Array(COLS).fill(null),
                stutter: new Array(COLS).fill(null),
                crush: new Array(COLS).fill(null)
            }
        };
    } else {
        // Ensure core fields exist
        if (!pattern.automation.x) pattern.automation.x = new Array(COLS).fill(null);
        if (!pattern.automation.y) pattern.automation.y = new Array(COLS).fill(null);
        if (!pattern.automation.pitch) pattern.automation.pitch = new Array(COLS).fill(null);

        // Handle FX object/array migration
        if (!pattern.automation.fx || Array.isArray(pattern.automation.fx)) {
            const oldFx = Array.isArray(pattern.automation.fx) ? pattern.automation.fx : new Array(COLS).fill(null);
            pattern.automation.fx = {
                loop: oldFx.map(v => v === 'loop' ? true : null),
                slow: oldFx.map(v => v === 'slow' ? true : null),
                stutter: oldFx.map(v => (v === 'stutter' || v === 'gate') ? true : null),
                crush: oldFx.map(v => v === 'crush' ? true : null)
            };
        } else {
            // Ensure all specific FX channels exist
            const fxObj = pattern.automation.fx;
            if (!fxObj.loop) fxObj.loop = new Array(COLS).fill(null);
            if (!fxObj.slow) fxObj.slow = new Array(COLS).fill(null);
            if (!fxObj.stutter) fxObj.stutter = new Array(COLS).fill(null);
            if (!fxObj.crush) fxObj.crush = new Array(COLS).fill(null);
        }
    }
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

                // Create initial bank
                const patterns = [oldPattern];
                for (let i = 1; i < MAX_PATTERNS; i++) {
                    patterns.push(createDefaultPattern());
                }

                // Initial partial state
                const newState = {
                    currentPattern: 0,
                    nextPattern: null,
                    masterVolume: state.masterVolume !== undefined ? state.masterVolume : -12,
                    repeatEnabled: true,
                    chainMode: 'chain',
                    patterns,
                    chain: new Array(CHAIN_LENGTH).fill(null)
                };

                // Let the next block handle global migration
                // We just need to make sure loop keys are valid
                Object.assign(state, newState);
            }

            // === Already new format: ensure basic structure ===
            if (state.currentPattern === undefined) state.currentPattern = 0;
            if (state.nextPattern === undefined) state.nextPattern = null;
            if (state.masterVolume === undefined) state.masterVolume = -12;
            if (state.repeatEnabled === undefined) state.repeatEnabled = true;
            // Migrate chainEnabled → chainMode
            if (state.chainEnabled !== undefined) {
                state.chainMode = state.chainEnabled ? 'chain' : 'live';
                delete state.chainEnabled;
            }
            if (!state.chainMode) state.chainMode = 'chain';

            // Ensure we have MAX_PATTERNS patterns
            if (!state.patterns) state.patterns = [];
            while (state.patterns.length < MAX_PATTERNS) {
                state.patterns.push(createDefaultPattern());
            }

            // === Migration: Hoist BPM and TrackParams to global if missing ===
            if (state.bpm === undefined || state.trackParams === undefined) {
                // Determine source pattern used for migration
                const sourceIndex = state.currentPattern || 0;
                const sourcePattern = state.patterns[sourceIndex] || state.patterns[0];

                if (state.bpm === undefined) {
                    state.bpm = sourcePattern.bpm !== undefined ? sourcePattern.bpm : DEFAULT_BPM;
                }

                if (state.trackParams === undefined) {
                    state.trackParams = sourcePattern.trackParams
                        ? JSON.parse(JSON.stringify(sourcePattern.trackParams))
                        : createDefaultTrackParams();

                    // Run migration on hoisted params
                    state.trackParams = migrateTrackParams(state.trackParams);
                }
            }

            // Migrate swingEnabled (per-pattern) → swingLevel (global)
            if (state.swingLevel === undefined) {
                const hadSwing = state.patterns.some(p => p.swingEnabled);
                state.swingLevel = hadSwing ? 'LIGHT' : DEFAULT_SWING_LEVEL;
            }

            // Ensure chain exists
            if (!state.chain) {
                state.chain = new Array(CHAIN_LENGTH).fill(null);
            }

            // Ensure userPresets exist
            if (!state.userPresets) {
                state.userPresets = { 0: {}, 1: {}, 2: {}, 3: {}, 4: {} };
            }

            // Ensure trackActivePresets exist
            if (!state.trackActivePresets) {
                state.trackActivePresets = [null, null, null, null, null];
            }

            // Migrate each pattern (Grid + Local settings) and CLEANUP global props
            for (let i = 0; i < state.patterns.length; i++) {
                migratePatternGrid(state.patterns[i]);
                migratePatternFields(state.patterns[i]);

                // Cleanup: Remove global props from individual patterns
                delete state.patterns[i].bpm;
                delete state.patterns[i].trackParams;
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
        bpm: DEFAULT_BPM,
        masterVolume: -12,
        swingLevel: DEFAULT_SWING_LEVEL,
        trackParams: createDefaultTrackParams(),
        repeatEnabled: true,
        chainMode: 'chain',
        patterns,
        chain: new Array(CHAIN_LENGTH).fill(null),
        userPresets: { 0: {}, 1: {}, 2: {}, 3: {}, 4: {} },
        trackActivePresets: [null, null, null, null, null] // Index of active preset per track
    };
}

// Get current pattern from state (convenience)
export function getCurrentPattern(state) {
    return state.patterns[state.currentPattern];
}

// Compact state for minimal JSON export
function compactState(state) {
    const compact = {
        bpm: state.bpm,
        masterVolume: state.masterVolume,
        swingLevel: state.swingLevel || DEFAULT_SWING_LEVEL,
        currentPattern: state.currentPattern,
        trackParams: state.trackParams,
        patterns: state.patterns.map(pattern => {
            const p = {
                grid: pattern.grid.map(track =>
                    track.map(step => {
                        const velocity = step.velocity !== undefined ? step.velocity : 1.0;
                        const isDefault = step.pitch === 0 && step.duration === 1.0 &&
                            !step.rollMode && step.rollSubdivision === DEFAULT_ROLL_SUBDIVISION &&
                            velocity === 1.0;
                        if (!step.active && isDefault) return 0;
                        if (step.active && isDefault) return 1;
                        const s = { active: step.active };
                        if (step.pitch !== 0) s.pitch = step.pitch;
                        if (step.duration !== 1.0) s.duration = step.duration;
                        if (step.rollMode) s.rollMode = true;
                        if (step.rollSubdivision !== DEFAULT_ROLL_SUBDIVISION) s.rollSubdivision = step.rollSubdivision;
                        if (velocity !== 1.0) s.velocity = velocity;
                        return s;
                    })
                )
            };
            if (pattern.scale && pattern.scale !== DEFAULT_SCALE) p.scale = pattern.scale;
            if (pattern.trackOctaves && pattern.trackOctaves.some(v => v !== DEFAULT_OCTAVE)) p.trackOctaves = pattern.trackOctaves;
            if (pattern.mutedTracks && pattern.mutedTracks.some(v => v)) p.mutedTracks = pattern.mutedTracks;
            if (pattern.soloedTracks && pattern.soloedTracks.some(v => v)) p.soloedTracks = pattern.soloedTracks;

            if (pattern.automation) {
                const hasX = pattern.automation.x.some(v => v !== null);
                const hasY = pattern.automation.y.some(v => v !== null);
                const hasPitch = pattern.automation.pitch && pattern.automation.pitch.some(v => v !== null);

                const fxTracks = pattern.automation.fx || {};
                const activeFxTracks = Object.keys(fxTracks).filter(k => fxTracks[k].some(v => v !== null));
                const hasFx = activeFxTracks.length > 0;

                if (hasX || hasY || hasPitch || hasFx) {
                    p.automation = {};
                    if (hasX) p.automation.x = pattern.automation.x;
                    if (hasY) p.automation.y = pattern.automation.y;
                    if (hasPitch) p.automation.pitch = pattern.automation.pitch;
                    if (hasFx) {
                        p.automation.fx = {};
                        activeFxTracks.forEach(k => p.automation.fx[k] = fxTracks[k]);
                    }
                }
            }
            return p;
        })
    };
    if (state.nextPattern !== null && state.nextPattern !== undefined) compact.nextPattern = state.nextPattern;
    if (state.repeatEnabled === false) compact.repeatEnabled = false;
    if (state.chainMode && state.chainMode !== 'chain') compact.chainMode = state.chainMode;
    if (state.chain && state.chain.some(v => v !== null)) compact.chain = state.chain;
    return compact;
}

// Export state as JSON file
export async function exportProject(state) {
    const data = JSON.stringify(compactState(state));
    const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
    const filename = `beat_project_${timestamp}.json`;

    // Use Web Share API on iOS Safari (Blob download doesn't save to Files app)
    if (navigator.canShare) {
        const file = new File([data], filename, { type: 'application/json' });
        try {
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file] });
                return;
            }
        } catch (e) {
            if (e.name === 'AbortError') return; // User cancelled share
        }
    }

    // Fallback: traditional download
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
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
