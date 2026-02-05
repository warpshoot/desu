// Track configuration
export const TRACKS = [
    {
        name: 'Kick',
        color: '#ff4444',
        type: 'membrane',
        baseFreq: 'C1',
        defaultParams: { tune: -12, cutoff: 1000, resonance: 1, modulation: 80, release: 0.8, vol: 1.0 } // Thick & Strong
    },
    {
        name: 'Snare',
        color: '#44aaff',
        type: 'noise',
        baseFreq: 'C4',
        defaultParams: { tune: 0, cutoff: 8000, resonance: 1, modulation: 50, release: 0.2, vol: 0.7 } // Standard
    },
    {
        name: 'Hi-hat',
        color: '#44ff88',
        type: 'metal',
        baseFreq: 800,
        defaultParams: { tune: 0, cutoff: 10000, resonance: 1, modulation: 50, release: 0.05, vol: 0.6 } // Closed
    },
    {
        name: 'Bass',
        color: '#bb66ff',
        type: 'fm',
        baseFreq: 'C2',
        defaultParams: { tune: -12, cutoff: 4000, resonance: 1, modulation: 60, release: 0.6, vol: 1.6 } // Thick
    },
    {
        name: 'Lead',
        color: '#ffff44',
        type: 'fm',
        baseFreq: 'C4',
        defaultParams: { tune: 0, cutoff: 4000, resonance: 1, modulation: 50, release: 0.5, vol: 0.7 } // Soft
    }
];

// Grid dimensions
export const ROWS = 5;
export const COLS = 32;

// Default values
export const DEFAULT_BPM = 120;
export const MIN_BPM = 60;
export const MAX_BPM = 180;

// Cell parameter ranges
export const PITCH_RANGE = { min: -12, max: 12, default: 0 };
export const DURATION_RANGE = { min: 0.1, max: 1.0, default: 0.5 };
export const ROLL_SUBDIVISIONS = [1, 2, 4, 8]; // Available roll speeds
export const DEFAULT_ROLL_SUBDIVISION = 4;

// Knob parameter ranges
export const KNOB_PARAMS = {
    tune: { min: -24, max: 24, default: 0, scale: 'linear' }, // New TUNE parameter
    cutoff: { min: 100, max: 16000, default: 4000, scale: 'log' },
    resonance: { min: 0.5, max: 15, default: 1, scale: 'linear' },
    modulation: { min: 0, max: 100, default: 50, scale: 'linear' },
    release: { min: 0.01, max: 2.0, default: 0.5, scale: 'linear' },
    vol: { min: 0, max: 2.0, default: 0.7, scale: 'linear' }
};

// Storage key
export const STORAGE_KEY = 'beat-state';
export const OLD_STORAGE_KEY = 'sequencer-state';

// Visual feedback ranges
export const BRIGHTNESS_RANGE = { min: 0.5, max: 1.5 };
export const SCALE_RANGE = { min: 0.7, max: 1.0 };

// Touch gesture thresholds
export const LONG_PRESS_DURATION = 500;
export const DRAG_THRESHOLD = 8;
export const TAP_THRESHOLD = 350; // Max time between taps for multi-tap detection

// Swing settings
export const SWING_AMOUNT = 0.15; // Delay even steps by 15% of step duration
export const DEFAULT_SWING_ENABLED = false;

// Octave settings
export const OCTAVE_RANGE = [-2, -1, 0, 1, 2]; // Available octave shifts
export const DEFAULT_OCTAVE = 0;

// Scale definitions (intervals relative to root C)
export const SCALES = {
    'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    'Major': [0, 2, 4, 5, 7, 9, 11],
    'Minor': [0, 2, 3, 5, 7, 8, 10],
    'Dorian': [0, 2, 3, 5, 7, 9, 10], // Techno/House
    'Phrygian': [0, 1, 3, 5, 7, 8, 10], // Dark Techno
    'Penta Maj': [0, 2, 4, 7, 9], // Pentatonic Major
    'Penta Min': [0, 3, 5, 7, 10], // Pentatonic Minor
    'Blues': [0, 3, 5, 6, 7, 10], // Hip-Hop/Funk
    'Harm Min': [0, 2, 3, 5, 7, 8, 11], // Harmonic Minor - Dark/Dramatic
    'Ryukyu': [0, 4, 5, 7, 11] // 琉球音階 (C E F G B)
};

export const DEFAULT_SCALE = 'Chromatic';

export const TRACK_PRESETS = {
    0: { // Kick (Membrane)
        '1': { tune: -12, cutoff: 1000, resonance: 1, modulation: 80, release: 0.8, vol: 1.0 }, // Thick & Strong
        '2': { tune: -18, cutoff: 800, resonance: 0.5, modulation: 30, release: 1.2, vol: 1.2 }, // Sub/Deep (raised cutoff & tune)
        '3': { tune: 0, cutoff: 3000, resonance: 8, modulation: 90, release: 0.2, vol: 0.8 }, // Punchy/Clicky
        '4': { tune: -5, cutoff: 800, resonance: 0.5, modulation: 10, release: 0.4, vol: 0.7 } // Soft/Jazz
    },
    1: { // Snare (Noise)
        '1': { tune: 0, cutoff: 8000, resonance: 1, modulation: 50, release: 0.2, vol: 0.7 }, // Standard
        '2': { tune: 12, cutoff: 12000, resonance: 10, modulation: 80, release: 0.1, vol: 0.6 }, // Tight
        '3': { tune: -12, cutoff: 4000, resonance: 2, modulation: 10, release: 0.5, vol: 0.9 }, // Lo-Fi (raised cutoff & vol)
        '4': { tune: 0, cutoff: 4000, resonance: 4, modulation: 90, release: 0.3, vol: 0.7 } // Clap-ish
    },
    2: { // Hi-hat (Metal)
        '1': { tune: 0, cutoff: 10000, resonance: 1, modulation: 50, release: 0.05, vol: 0.6 }, // Closed
        '2': { tune: 0, cutoff: 8000, resonance: 2, modulation: 40, release: 0.4, vol: 0.6 }, // Open
        '3': { tune: 24, cutoff: 14000, resonance: 5, modulation: 0, release: 0.05, vol: 0.5 }, // Chip
        '4': { tune: -6, cutoff: 6000, resonance: 1, modulation: 80, release: 0.15, vol: 0.7 } // Shaker (raised tune, cutoff & vol)
    },
    3: { // Bass (FM - Triangle)
        '1': { tune: -12, cutoff: 4000, resonance: 1, modulation: 60, release: 0.6, vol: 1.6 }, // Thick (raised cutoff & vol)
        '2': { tune: -12, cutoff: 1200, resonance: 0.5, modulation: 0, release: 1.0, vol: 2.0 }, // Sub (raised cutoff & vol)
        '3': { tune: 0, cutoff: 2000, resonance: 10, modulation: 80, release: 0.3, vol: 1.4 }, // Acid
        '4': { tune: 12, cutoff: 4000, resonance: 2, modulation: 60, release: 0.2, vol: 1.2 } // Pluck
    },
    4: { // Lead (FM)
        '1': { tune: 0, cutoff: 4000, resonance: 1, modulation: 50, release: 0.5, vol: 0.7 }, // Soft
        '2': { tune: 24, cutoff: 8000, resonance: 4, modulation: 20, release: 1.2, vol: 0.7 }, // Chime
        '3': { tune: -12, cutoff: 2000, resonance: 5, modulation: 90, release: 0.4, vol: 0.8 }, // Retro
        '4': { tune: 12, cutoff: 12000, resonance: 2, modulation: 100, release: 0.1, vol: 0.6 } // Chip/Square
    }
};
