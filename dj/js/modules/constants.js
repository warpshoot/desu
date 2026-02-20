// Track configuration for DJ decks (4 tracks per deck)
export const TRACKS = [
    {
        name: 'Kick',
        short: 'K',
        color: '#ff4444',
        type: 'membrane',
        baseFreq: 'C1',
        defaultParams: { tune: -12, cutoff: 1000, resonance: 1, drive: 10, decay: 0.4, vol: 0.9 }
    },
    {
        name: 'Snare',
        short: 'S',
        color: '#44aaff',
        type: 'noise',
        baseFreq: 'C4',
        defaultParams: { tune: 0, cutoff: 8000, resonance: 1, drive: 0, decay: 0.2, vol: 0.7 }
    },
    {
        name: 'Hi-hat',
        short: 'H',
        color: '#44ff88',
        type: 'metal',
        baseFreq: 800,
        defaultParams: { tune: 0, cutoff: 10000, resonance: 1, drive: 0, decay: 0.1, vol: 0.6 }
    },
    {
        name: 'Bass',
        short: 'B',
        color: '#bb66ff',
        type: 'fm',
        baseFreq: 'C2',
        defaultParams: { tune: -12, cutoff: 4000, resonance: 1, drive: 15, decay: 0.3, vol: 1.1 }
    }
];

// Grid dimensions
export const ROWS = 4;
export const COLS = 16;

// Pattern bank
export const MAX_PATTERNS = 8;

// BPM
export const DEFAULT_BPM = 120;
export const MIN_BPM = 60;
export const MAX_BPM = 200;

// Scales
export const SCALES = {
    'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    'Minor': [0, 2, 3, 5, 7, 8, 10],
    'Penta Min': [0, 3, 5, 7, 10],
    'Blues': [0, 3, 5, 6, 7, 10]
};

// Storage keys
export const STORAGE_KEY_A = 'dj-deck-a';
export const STORAGE_KEY_B = 'dj-deck-b';

// Preset patterns for quick loading
export const PRESET_PATTERNS = {
    'Four on Floor': {
        grid: [
            // Kick: every beat
            [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
            // Snare: 2 and 4
            [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            // Hat: every 8th
            [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
            // Bass: root on 1
            [1,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0]
        ]
    },
    'Breakbeat': {
        grid: [
            [1,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,0,0],
            [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
            [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
            [1,0,0,1, 0,0,0,0, 1,0,0,0, 0,1,0,0]
        ]
    },
    'Minimal': {
        grid: [
            [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
            [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]
        ]
    },
    'Techno': {
        grid: [
            [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
            [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0],
            [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,1,1,0],
            [1,0,0,1, 0,0,1,0, 0,0,0,1, 0,0,1,0]
        ]
    },
    'Hip Hop': {
        grid: [
            [1,0,0,0, 0,0,0,0, 1,0,1,0, 0,0,0,0],
            [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
            [1,0,0,1, 0,0,0,0, 0,1,0,0, 0,0,1,0]
        ]
    },
    'House': {
        grid: [
            [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
            [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
            [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0]
        ]
    },
    'Drum & Bass': {
        grid: [
            [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
            [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0],
            [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
            [1,0,0,0, 0,0,0,1, 0,1,0,0, 0,0,1,0]
        ]
    },
    'Empty': {
        grid: [
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]
        ]
    }
};
