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
        baseFreq: 'C4'
    },
    {
        name: 'Hi-hat',
        color: '#44ff88',
        type: 'metal',
        baseFreq: 800
    },
    {
        name: 'Bass',
        color: '#bb66ff',
        type: 'fm',
        baseFreq: 'C2'
    },
    {
        name: 'Synth',
        color: '#ffff44',
        type: 'fm',
        baseFreq: 'C4'
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
    cutoff: { min: 100, max: 16000, default: 4000, scale: 'log' },
    resonance: { min: 0.5, max: 15, default: 1, scale: 'linear' },
    modulation: { min: 0, max: 100, default: 50, scale: 'linear' },
    release: { min: 0.01, max: 2.0, default: 0.5, scale: 'linear' },
    vol: { min: 0, max: 1.2, default: 0.7, scale: 'linear' }
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
