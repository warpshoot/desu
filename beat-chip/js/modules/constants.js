// Track configuration for Chiptune Mode
export const TRACKS = [
    {
        name: 'Kick',
        color: '#ff66aa', // Pop Pink
        type: 'pulse-kick',
        baseFreq: 'C2',
        defaultParams: { tune: 0, cutoff: 4000, resonance: 1, drive: 20, decay: 0.1, vol: 0.9 } // Tighter Kick
    },
    {
        name: 'Snare',
        color: '#33ccff', // Pop Cyan
        type: 'chip-noise',
        baseFreq: 'C4',
        defaultParams: { tune: 0, cutoff: 6000, resonance: 2, drive: 10, decay: 0.08, vol: 0.75 } // Snappier Snare
    },
    {
        name: 'Hi-hat',
        color: '#ffcc00', // Pop Yellow
        type: 'chip-noise',
        baseFreq: 'C6',
        defaultParams: { tune: 12, cutoff: 14000, resonance: 1, drive: 0, decay: 0.03, vol: 0.5 } // Crisp Hat
    },
    {
        name: 'Bass',
        color: '#cc66ff', // Pop Purple
        type: 'pulse',
        baseFreq: 'C2',
        defaultParams: { tune: 0, cutoff: 3000, resonance: 1, drive: 10, decay: 0.2, vol: 1.0 } // Clearer Bass
    },
    {
        name: 'Lead',
        color: '#ff9966', // Pop Orange
        type: 'pulse',
        baseFreq: 'C4',
        defaultParams: { tune: 0, cutoff: 8000, resonance: 1, drive: 5, decay: 0.15, vol: 0.7 } // Defined Lead
    }
];

// Grid dimensions
export const ROWS = 5;
export const COLS = 16;

// Pattern bank
export const MAX_PATTERNS = 8;
export const PATTERN_NAMES = ['1', '2', '3', '4', '5', '6', '7', '8'];
export const CHAIN_LENGTH = 8;

// Default values
export const DEFAULT_BPM = 120;
export const MIN_BPM = 60;
export const MAX_BPM = 180;

// Cell parameter ranges
export const PITCH_RANGE = { min: -36, max: 36, default: 0 };
export const DURATION_RANGE = { min: 0.1, max: 1.0, default: 0.5 };
export const ROLL_SUBDIVISIONS = [1, 2, 4, 8]; // Available roll speeds
export const DEFAULT_ROLL_SUBDIVISION = 4;

// Knob parameter ranges
export const KNOB_PARAMS = {
    tune: { min: -24, max: 24, default: 0, scale: 'linear', sensitivity: 150 },
    cutoff: { min: 100, max: 16000, default: 4000, scale: 'log', sensitivity: 250 },
    resonance: { min: 0.5, max: 15, default: 1, scale: 'log', sensitivity: 200 },
    drive: { min: 0, max: 100, default: 0, scale: 'linear', sensitivity: 200 },
    decay: { min: 0.01, max: 2.0, default: 0.3, scale: 'log', sensitivity: 250 },
    vol: { min: 0, max: 2.0, default: 0.7, scale: 'linear', sensitivity: 150 }
};

// Storage key
export const STORAGE_KEY = 'beat-chip-state';
export const OLD_STORAGE_KEY = 'sequencer-state';

// Visual feedback ranges
export const BRIGHTNESS_RANGE = { min: 0.5, max: 1.5 };
export const SCALE_RANGE = { min: 0.6, max: 1.4 };

// Touch gesture thresholds
export const LONG_PRESS_DURATION = 500;
export const DRAG_THRESHOLD = 8;
export const TAP_THRESHOLD = 350; // Max time between taps for multi-tap detection

// Swing settings
export const SWING_LEVELS = {
    'OFF': 0,
    'LIGHT': 0.16, // 58% swing
    'HEAVY': 0.34  // 67% swing
};
export const DEFAULT_SWING_LEVEL = 'OFF';

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
    0: {
        '1': { tune: 0, cutoff: 4000, resonance: 1, drive: 20, decay: 0.1, vol: 0.9 }, // Tight Default
        '2': { tune: -12, cutoff: 1000, resonance: 1, drive: 40, decay: 0.25, vol: 1.0 }, // Deep/Heavy
        '3': { tune: 12, cutoff: 8000, resonance: 4, drive: 60, decay: 0.05, vol: 0.8 }, // Zap/Laser
        '4': { tune: 5, cutoff: 6000, resonance: 2, drive: 10, decay: 0.4, vol: 0.9 } // Boomy/Loose
    },
    1: {
        '1': { tune: 0, cutoff: 6000, resonance: 2, drive: 10, decay: 0.08, vol: 0.75 }, // Snappy Default
        '2': { tune: -6, cutoff: 3000, resonance: 5, drive: 30, decay: 0.2, vol: 0.8 }, // Lo-Fi Crunch
        '3': { tune: 12, cutoff: 12000, resonance: 8, drive: 50, decay: 0.04, vol: 0.7 }, // Glitch Click
        '4': { tune: 0, cutoff: 5000, resonance: 1, drive: 0, decay: 0.3, vol: 0.6 } // Soft/White Noise
    },
    2: {
        '1': { tune: 12, cutoff: 14000, resonance: 1, drive: 0, decay: 0.03, vol: 0.5 }, // Crisp Default
        '2': { tune: 0, cutoff: 8000, resonance: 4, drive: 20, decay: 0.1, vol: 0.6 }, // Metal/Ring
        '3': { tune: 24, cutoff: 16000, resonance: 8, drive: 40, decay: 0.02, vol: 0.4 }, // High Zap
        '4': { tune: -12, cutoff: 2000, resonance: 1, drive: 60, decay: 0.2, vol: 0.7 } // Industrial Crush
    },
    3: {
        '1': { tune: 0, cutoff: 3000, resonance: 1, drive: 10, decay: 0.2, vol: 1.0 }, // Clear Bass
        '2': { tune: -12, cutoff: 1000, resonance: 1, drive: 30, decay: 0.5, vol: 1.2 }, // Sub Bass (Long)
        '3': { tune: 0, cutoff: 6000, resonance: 8, drive: 60, decay: 0.15, vol: 0.9 }, // Acid/Resonant
        '4': { tune: 7, cutoff: 4000, resonance: 2, drive: 0, decay: 0.05, vol: 1.0 } // Pluck/Short
    },
    4: {
        '1': { tune: 0, cutoff: 8000, resonance: 1, drive: 5, decay: 0.15, vol: 0.7 }, // Defined Lead
        '2': { tune: 12, cutoff: 12000, resonance: 2, drive: 20, decay: 0.05, vol: 0.6 }, // Fast Arp/Pluck
        '3': { tune: -12, cutoff: 2000, resonance: 1, drive: 40, decay: 0.6, vol: 0.8 }, // Sustained Pad-ish
        '4': { tune: 7, cutoff: 6000, resonance: 6, drive: 80, decay: 0.2, vol: 0.7 } // Distorted interval
    }
};
