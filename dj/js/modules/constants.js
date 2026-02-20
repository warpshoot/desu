// BEAT track configuration
export const BEAT_TRACKS = [
    { name: 'Kick', short: 'K', color: '#ff4444', type: 'membrane', baseFreq: 'C1',
      defaultParams: { tune: -12, cutoff: 1000, resonance: 1, drive: 10, decay: 0.4, vol: 0.9 } },
    { name: 'Snare', short: 'S', color: '#44aaff', type: 'noise', baseFreq: 'C4',
      defaultParams: { tune: 0, cutoff: 8000, resonance: 1, drive: 0, decay: 0.2, vol: 0.7 } },
    { name: 'Hi-hat', short: 'H', color: '#44ff88', type: 'metal', baseFreq: 800,
      defaultParams: { tune: 0, cutoff: 10000, resonance: 1, drive: 0, decay: 0.1, vol: 0.6 } },
    { name: 'Bass', short: 'B', color: '#bb66ff', type: 'fm', baseFreq: 'C2',
      defaultParams: { tune: -12, cutoff: 4000, resonance: 1, drive: 15, decay: 0.3, vol: 1.1 } },
    { name: 'Lead', short: 'L', color: '#ffff44', type: 'fm', baseFreq: 'C4',
      defaultParams: { tune: 0, cutoff: 4000, resonance: 1, drive: 0, decay: 0.3, vol: 0.7 } }
];

// BEEP track configuration
export const BEEP_TRACKS = [
    { name: 'Kick', short: 'K', color: '#ff66aa', type: 'pulse-kick', baseFreq: 'C2',
      defaultParams: { tune: 0, cutoff: 4000, resonance: 1, drive: 20, decay: 0.1, vol: 0.9 } },
    { name: 'Snare', short: 'S', color: '#33ccff', type: 'chip-noise', baseFreq: 'C4',
      defaultParams: { tune: 0, cutoff: 6000, resonance: 2, drive: 10, decay: 0.08, vol: 0.75 } },
    { name: 'Hi-hat', short: 'H', color: '#ffcc00', type: 'chip-noise', baseFreq: 'C6',
      defaultParams: { tune: 12, cutoff: 14000, resonance: 1, drive: 0, decay: 0.03, vol: 0.5 } },
    { name: 'Bass', short: 'B', color: '#cc66ff', type: 'pulse', baseFreq: 'C2',
      defaultParams: { tune: 0, cutoff: 3000, resonance: 1, drive: 10, decay: 0.2, vol: 1.0 } },
    { name: 'Lead', short: 'L', color: '#ff9966', type: 'pulse', baseFreq: 'C4',
      defaultParams: { tune: 0, cutoff: 8000, resonance: 1, drive: 5, decay: 0.15, vol: 0.7 } }
];

// Grid dimensions (both BEAT and BEEP share these)
export const ROWS = 5;
export const COLS = 16;
export const MAX_PATTERNS = 8;
export const CHAIN_LENGTH = 8;

// BPM
export const DEFAULT_BPM = 120;
export const MIN_BPM = 60;
export const MAX_BPM = 200;

// Defaults
export const DEFAULT_ROLL_SUBDIVISION = 4;
export const DEFAULT_SWING_LEVEL = 'OFF';
export const DEFAULT_OCTAVE = 0;
export const DEFAULT_SCALE = 'Chromatic';

// Swing
export const SWING_LEVELS = { 'OFF': 0, 'LIGHT': 0.16, 'HEAVY': 0.34 };
