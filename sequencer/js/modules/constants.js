// Track configuration
export const TRACKS = [
    {
        name: 'Kick',
        color: '#ff4444',
        type: 'membrane',
        baseFreq: 'C1'
    },
    {
        name: 'Snare',
        color: '#44aaff',
        type: 'noise',
        baseFreq: null
    },
    {
        name: 'Hi-hat',
        color: '#44ff88',
        type: 'metal',
        baseFreq: null
    },
    {
        name: 'Synth',
        color: '#ffcc44',
        type: 'fm',
        baseFreq: 'C4'
    }
];

// Grid dimensions
export const ROWS = 4;
export const COLS = 16;

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
    cutoff: { min: 100, max: 8000, default: 2000, scale: 'log' },
    resonance: { min: 0.5, max: 15, default: 1, scale: 'linear' },
    modulation: { min: 0, max: 100, default: 50, scale: 'linear' },
    release: { min: 0.01, max: 2.0, default: 0.5, scale: 'linear' }
};

// Storage key
export const STORAGE_KEY = 'nanoloop-sequencer-state';

// Visual feedback ranges
export const BRIGHTNESS_RANGE = { min: 0.5, max: 1.5 };
export const SCALE_RANGE = { min: 0.7, max: 1.0 };

// Touch gesture thresholds
export const LONG_PRESS_DURATION = 500;
export const DRAG_THRESHOLD = 5;
export const TAP_THRESHOLD = 300; // Max time between taps for multi-tap detection
