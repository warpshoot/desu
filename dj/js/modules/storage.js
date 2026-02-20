import { ROWS, COLS, MAX_PATTERNS, CHAIN_LENGTH, DEFAULT_BPM, DEFAULT_SWING_LEVEL, DEFAULT_OCTAVE, DEFAULT_SCALE, DEFAULT_ROLL_SUBDIVISION } from './constants.js';

/**
 * Load and migrate a BEAT or BEEP project file.
 * Returns a normalized state object.
 */
export function loadProjectFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const raw = JSON.parse(e.target.result);
                if (!raw.patterns && !raw.grid) throw new Error('Invalid project file');
                const state = migrateState(raw);
                resolve(state);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

/**
 * Detect project type from state.
 * Returns 'beat' or 'beep' based on filename hint or heuristic.
 */
export function detectProjectType(file) {
    const name = (file.name || '').toLowerCase();
    if (name.includes('beep')) return 'beep';
    if (name.includes('beat')) return 'beat';
    return 'beat'; // default
}

function createDefaultPattern() {
    const grid = [];
    for (let t = 0; t < ROWS; t++) {
        grid[t] = [];
        for (let s = 0; s < COLS; s++) {
            grid[t][s] = { active: false, pitch: 0, duration: 0.5, rollMode: false, rollSubdivision: DEFAULT_ROLL_SUBDIVISION, velocity: 1.0 };
        }
    }
    return {
        grid,
        trackOctaves: new Array(ROWS).fill(DEFAULT_OCTAVE),
        mutedTracks: new Array(ROWS).fill(false),
        soloedTracks: new Array(ROWS).fill(false),
        scale: DEFAULT_SCALE,
        automation: { x: new Array(COLS).fill(null), y: new Array(COLS).fill(null), pitch: new Array(COLS).fill(null),
            fx: { loop: new Array(COLS).fill(null), slow: new Array(COLS).fill(null), stutter: new Array(COLS).fill(null), crush: new Array(COLS).fill(null) } }
    };
}

function createDefaultTrackParams(tracks) {
    return tracks.map(t => {
        const d = t.defaultParams || {};
        return { tune: d.tune || 0, cutoff: d.cutoff || 4000, resonance: d.resonance || 1, drive: d.drive || 0, decay: d.decay || 0.3, vol: d.vol || 0.7 };
    });
}

function migrateState(raw) {
    const state = { ...raw };

    // Old single-pattern → pattern bank
    if (!state.patterns) {
        const oldPat = { grid: state.grid, trackOctaves: state.trackOctaves, mutedTracks: state.mutedTracks, soloedTracks: state.soloedTracks, scale: state.scale };
        state.patterns = [oldPat];
        for (let i = 1; i < MAX_PATTERNS; i++) state.patterns.push(createDefaultPattern());
    }

    if (state.currentPattern === undefined) state.currentPattern = 0;
    if (state.bpm === undefined) state.bpm = DEFAULT_BPM;
    if (state.masterVolume === undefined) state.masterVolume = -12;
    if (state.repeatEnabled === undefined) state.repeatEnabled = true;

    // Swing migration
    if (state.swingLevel === undefined) {
        state.swingLevel = state.patterns.some(p => p.swingEnabled) ? 'LIGHT' : DEFAULT_SWING_LEVEL;
    }

    // Chain
    if (!state.chain) state.chain = new Array(CHAIN_LENGTH).fill(null);
    if (state.chainEnabled !== undefined) {
        state.chainMode = state.chainEnabled ? 'chain' : 'live';
        delete state.chainEnabled;
    }
    if (!state.chainMode) state.chainMode = 'chain';

    // Track params: hoist from pattern if needed
    if (!state.trackParams) {
        const src = state.patterns[state.currentPattern] || state.patterns[0];
        state.trackParams = src.trackParams ? JSON.parse(JSON.stringify(src.trackParams)) : null;
    }

    // Ensure enough patterns
    while (state.patterns.length < MAX_PATTERNS) state.patterns.push(createDefaultPattern());

    // Migrate each pattern
    for (let i = 0; i < state.patterns.length; i++) {
        migratePattern(state.patterns[i]);
        delete state.patterns[i].bpm;
        delete state.patterns[i].trackParams;
    }

    // Migrate trackParams
    if (state.trackParams) {
        state.trackParams.forEach(p => {
            if (p.vol === undefined) p.vol = 0.7;
            if (p.tune === undefined) p.tune = 0;
            if (p.drive === undefined) p.drive = 0;
            if (p.decay === undefined) p.decay = p.release || 0.3;
            delete p.release;
            delete p.modulation;
        });
    }

    return state;
}

function migratePattern(pat) {
    if (!pat.grid) { pat.grid = createDefaultPattern().grid; }

    // Ensure ROWS tracks
    while (pat.grid.length < ROWS) {
        pat.grid.push(new Array(COLS).fill(0));
    }

    // Expand compact cells and ensure COLS steps
    for (let t = 0; t < pat.grid.length; t++) {
        if (pat.grid[t].length > COLS) pat.grid[t] = pat.grid[t].slice(0, COLS);
        while (pat.grid[t].length < COLS) {
            pat.grid[t].push({ active: false, pitch: 0, duration: 0.5, rollMode: false, rollSubdivision: DEFAULT_ROLL_SUBDIVISION, velocity: 1.0 });
        }
        for (let s = 0; s < pat.grid[t].length; s++) {
            const c = pat.grid[t][s];
            if (c === 0 || c === 1) {
                pat.grid[t][s] = { active: c === 1, pitch: 0, duration: 0.5, rollMode: false, rollSubdivision: DEFAULT_ROLL_SUBDIVISION, velocity: 1.0 };
            } else if (typeof c === 'object' && c !== null) {
                if (c.active === undefined) c.active = false;
                if (c.pitch === undefined) c.pitch = 0;
                if (c.duration === undefined) c.duration = 0.5;
                if (c.rollMode === undefined) c.rollMode = false;
                if (c.rollSubdivision === undefined) c.rollSubdivision = DEFAULT_ROLL_SUBDIVISION;
                if (c.velocity === undefined) c.velocity = 1.0;
            }
        }
    }

    if (!pat.trackOctaves || pat.trackOctaves.length < ROWS) {
        if (!pat.trackOctaves) pat.trackOctaves = [];
        while (pat.trackOctaves.length < ROWS) pat.trackOctaves.push(DEFAULT_OCTAVE);
    }
    if (!pat.mutedTracks) pat.mutedTracks = new Array(ROWS).fill(false);
    if (!pat.soloedTracks) pat.soloedTracks = new Array(ROWS).fill(false);
    if (!pat.scale) pat.scale = DEFAULT_SCALE;

    // Automation
    if (!pat.automation) {
        pat.automation = { x: new Array(COLS).fill(null), y: new Array(COLS).fill(null), pitch: new Array(COLS).fill(null),
            fx: { loop: new Array(COLS).fill(null), slow: new Array(COLS).fill(null), stutter: new Array(COLS).fill(null), crush: new Array(COLS).fill(null) } };
    } else {
        if (!pat.automation.x) pat.automation.x = new Array(COLS).fill(null);
        if (!pat.automation.y) pat.automation.y = new Array(COLS).fill(null);
        if (!pat.automation.pitch) pat.automation.pitch = new Array(COLS).fill(null);
        if (!pat.automation.fx || Array.isArray(pat.automation.fx)) {
            const old = Array.isArray(pat.automation.fx) ? pat.automation.fx : new Array(COLS).fill(null);
            pat.automation.fx = {
                loop: old.map(v => v === 'loop' ? true : null),
                slow: old.map(v => v === 'slow' ? true : null),
                stutter: old.map(v => (v === 'stutter' || v === 'gate') ? true : null),
                crush: old.map(v => v === 'crush' ? true : null)
            };
        }
    }

    delete pat.loopEnabled;
    delete pat.loopStart;
    delete pat.loopEnd;
    delete pat.swingEnabled;
}
