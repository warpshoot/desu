// ==================== Global State ====================
const state = {
    isPlaying: false,
    playbackPosition: 0,
    speed: 1.0,
    currentColor: 'red',
    currentTimbre: 'square',
    animationId: null,
    lastTime: 0,
    audioContext: null,
    lastPlaybackX: -10,
    canvasSnapshot: null,
    activeFlashes: [],
    playedGrids: new Set(),
    colorTimbres: {
        red: 'square',
        blue: 'triangle',
        green: 'sawtooth',
        yellow: 'sine'
    },
    playbackDirection: 1,
    djMode: {
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        filterEnabled: false,
        filterCutoff: 10000,
        resonance: 0.5
    },
    // Undo/Redo
    history: [],
    historyIndex: -1,
    maxHistory: 50,
    colorMuted: {
        red: false,
        blue: false,
        green: false,
        yellow: false
    },
    soloColor: null,
    // Audio Options
    options: {
        pingPong: false,
        humanize: true,
        loop: false,
        reverb: true,
        octaveDoubling: false,
        chordMode: false,
        previewSound: false
    },
    // Audio nodes
    reverbNode: null,
    lastDrawTime: 0,
    lastDrawY: 0
};

const GRID_SIZE = 30;

const COLOR_MAP = {
    red: '#e85a71',
    blue: '#4a90a4',
    green: '#5d9b84',
    yellow: '#d4a574'
};

// Musical Scales - Extended range (3 octaves)
const SCALES = {
    pentatonic: [
        130.81, 146.83, 164.81, 196.00, 220.00,
        261.63, 293.66, 329.63, 392.00, 440.00,
        523.25, 587.33, 659.25, 783.99, 880.00,
        1046.50, 1174.66, 1318.51, 1567.98, 1760.00
    ],
    major: [
        130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94,
        261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88,
        523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77,
        1046.50, 1174.66, 1318.51, 1396.91, 1567.98, 1760.00, 1975.53
    ],
    minor: [
        130.81, 146.83, 155.56, 174.61, 196.00, 207.65, 233.08,
        261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16,
        523.25, 587.33, 622.25, 698.46, 783.99, 830.61, 932.33,
        1046.50, 1174.66, 1244.51, 1396.91, 1567.98, 1661.22, 1864.66
    ],
    blues: [
        130.81, 155.56, 174.61, 185.00, 196.00, 233.08,
        261.63, 311.13, 349.23, 369.99, 392.00, 466.16,
        523.25, 622.25, 698.46, 739.99, 783.99, 932.33,
        1046.50, 1244.51, 1396.91, 1479.98, 1567.98, 1864.66
    ],
    wholetone: [
        130.81, 146.83, 164.81, 185.00, 207.65, 233.08,
        261.63, 293.66, 329.63, 369.99, 415.30, 466.16,
        523.25, 587.33, 659.25, 739.99, 830.61, 932.33,
        1046.50, 1174.66, 1318.51, 1479.98, 1661.22, 1864.66
    ],
    chromatic: [
        130.81, 138.59, 146.83, 155.56, 164.81, 174.61, 185.00, 196.00,
        207.65, 220.00, 233.08, 246.94,
        261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00,
        415.30, 440.00, 466.16, 493.88,
        523.25, 554.37, 587.33, 622.25, 659.25, 698.46, 739.99, 783.99,
        830.61, 880.00, 932.33, 987.77,
        1046.50, 1108.73, 1174.66, 1244.51, 1318.51, 1396.91, 1479.98, 1567.98,
        1661.22, 1760.00, 1864.66, 1975.53
    ]
};

let currentScale = SCALES.pentatonic;

// Canvas and context
let canvas, ctx, playbackLine;

// ==================== Audio Setup ====================
async function initAudio() {
    if (!state.audioContext) {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audioContext.state === 'suspended') {
        try {
            await state.audioContext.resume();
        } catch (error) {
            console.error('Failed to resume AudioContext:', error);
        }
    }
    if (state.audioContext.state !== 'running') {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Initialize Reverb if needed
    if (!state.reverbNode) {
        initReverb();
    }
}

function initReverb() {
    const ctx = state.audioContext;
    const convolver = ctx.createConvolver();

    // Create impulse response for simple reverb
    const duration = 2.0;
    const decay = 2.0;
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = i; // reverse index not needed for simple exponential decay noise
        const val = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
        left[i] = val;
        right[i] = val;
    }

    convolver.buffer = impulse;
    state.reverbNode = convolver;

    // Reverb gain (mix) - we can connect this to destination
    state.reverbGain = ctx.createGain();
    state.reverbGain.gain.value = 0.3; // 30% wet

    convolver.connect(state.reverbGain);
    state.reverbGain.connect(ctx.destination);
}

function getHarmonics(frequency, scale) {
    // Determine harmonics based on current scale proximity
    // Simple approach: +3rd (approx * 1.25) and +5th (approx * 1.5)
    // For a cleaner sound, we should verify against valid scale notes, 
    // but for this synth toy, simple ratios work well enough for effect.
    // Major 3rd: 1.2599, Minor 3rd: 1.1892, 5th: 1.4983

    // Let's pick somewhat consonant intervals
    let interval3rd = 1.26; // Major 3rd-ish
    if (scale === SCALES.minor || scale === SCALES.blues) {
        interval3rd = 1.19; // Minor 3rd-ish
    }

    return [frequency * interval3rd, frequency * 1.5];
}

function yToFrequency(y, canvasHeight) {
    const index = Math.floor((1 - y / canvasHeight) * currentScale.length);
    return currentScale[Math.max(0, Math.min(currentScale.length - 1, index))];
}

async function playNote(frequency, timbre, duration = 0.25) {
    const audioCtx = state.audioContext;
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }

    if (audioCtx.state !== 'running') return;

    // Base note
    playSound(frequency, timbre, duration, 1.0);

    // Octave Doubling
    if (state.options.octaveDoubling) {
        playSound(frequency * 2, timbre, duration, 0.5); // Lower volume for octave
    }

    // Chord Mode
    if (state.options.chordMode) {
        const harmonics = getHarmonics(frequency, currentScale);
        harmonics.forEach(freq => {
            playSound(freq, timbre, duration, 0.4); // Lower volume for harmony
        });
    }
}

function playSound(frequency, timbre, duration, volumeScale = 1.0) {
    const audioCtx = state.audioContext;
    const now = audioCtx.currentTime;

    // Global volume
    let volume = 0.2 * volumeScale;

    // Oscillator & Gain setup
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    // Custom Timbre support (Simple waveforms + simple expansions)
    if (['square', 'triangle', 'sawtooth', 'sine'].includes(timbre)) {
        oscillator.type = timbre;
    } else {
        // Fallback or more complex synthesis for piano, bell, etc.
        // For now, map custom names to basic waveforms to ensure sound
        switch (timbre) {
            case 'piano': oscillator.type = 'triangle'; break;
            case 'bell': oscillator.type = 'sine'; volume *= 1.5; break;
            case 'bass': oscillator.type = 'square'; frequency *= 0.5; break;
            case 'strings': oscillator.type = 'sawtooth'; break;
            default: oscillator.type = 'sine';
        }
    }

    oscillator.frequency.setValueAtTime(frequency, now);

    // Envelope
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.02);
    gainNode.gain.linearRampToValueAtTime(volume * 0.6, now + 0.08);
    gainNode.gain.setValueAtTime(volume * 0.6, now + duration - 0.05);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);

    // Audio Graph Connection
    let outputNode = gainNode;

    // Filter Logic (DJ Mode)
    if (state.djMode.filterEnabled) {
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(state.djMode.filterCutoff, now);
        filter.Q.setValueAtTime(state.djMode.resonance, now);

        oscillator.connect(filter);
        filter.connect(gainNode);
    } else {
        oscillator.connect(gainNode);
    }

    // Reverb & Destination Connection
    if (state.options.reverb && state.reverbNode && state.reverbGain) {
        // Connect to both Dry (Destination) and Wet (Reverb)
        outputNode.connect(audioCtx.destination);
        outputNode.connect(state.reverbNode);
    } else {
        outputNode.connect(audioCtx.destination);
    }

    oscillator.start(now);
    oscillator.stop(now + duration);
}

async function playNoteOld(frequency, timbre, duration = 0.25) {
    return; // Function removed
    /*
        const audioCtx = state.audioContext;
        if (!audioCtx) return;
    
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }
    
        if (audioCtx.state !== 'running') return;
    
        const now = audioCtx.currentTime;
    
        // Basic waveforms
        if (['square', 'triangle', 'sawtooth', 'sine'].includes(timbre)) {
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
    
            oscillator.type = timbre;
            oscillator.frequency.setValueAtTime(frequency, now);
    
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.2, now + 0.02);
            gainNode.gain.linearRampToValueAtTime(0.12, now + 0.08);
            gainNode.gain.setValueAtTime(0.12, now + duration - 0.15);
            gainNode.gain.linearRampToValueAtTime(0, now + duration);
    
            if (state.djMode.filterEnabled) {
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(state.djMode.filterCutoff, now);
                filter.Q.setValueAtTime(state.djMode.resonance, now);
    
                oscillator.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(audioCtx.destination);
            } else {
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
            }
    
            oscillator.start(now);
            oscillator.stop(now + duration);
        }
        // Piano
        else if (timbre === 'piano') {
            const harmonics = [1, 2, 3, 4];
            const gains = [0.3, 0.15, 0.1, 0.05];
    
            harmonics.forEach((harmonic, index) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
    
                osc.type = 'sine';
                osc.frequency.setValueAtTime(frequency * harmonic, now);
    
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(gains[index], now + 0.005);
                gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
                if (state.djMode.filterEnabled) {
                    const filter = audioCtx.createBiquadFilter();
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(state.djMode.filterCutoff, now);
                    filter.Q.setValueAtTime(state.djMode.resonance, now);
    
                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(audioCtx.destination);
                } else {
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                }
    
                osc.start(now);
                osc.stop(now + duration);
            });
        }
        // Bell
        else if (timbre === 'bell') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
    
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency, now);
    
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration * 2);
    
            if (state.djMode.filterEnabled) {
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(state.djMode.filterCutoff, now);
                filter.Q.setValueAtTime(state.djMode.resonance, now);
    
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(audioCtx.destination);
            } else {
                osc.connect(gain);
                gain.connect(audioCtx.destination);
            }
    
            osc.start(now);
            osc.stop(now + duration * 2);
        }
        // Bass
        else if (timbre === 'bass') {
            const osc = audioCtx.createOscillator();
            const filter = audioCtx.createBiquadFilter();
            const djFilter = state.djMode.filterEnabled ? audioCtx.createBiquadFilter() : null;
            const gain = audioCtx.createGain();
    
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(frequency, now);
    
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, now);
            filter.Q.setValueAtTime(5, now);
    
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.25, now + 0.01);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
            gain.gain.linearRampToValueAtTime(0, now + duration);
    
            osc.connect(filter);
            if (djFilter) {
                djFilter.type = 'lowpass';
                djFilter.frequency.setValueAtTime(state.djMode.filterCutoff, now);
                djFilter.Q.setValueAtTime(state.djMode.resonance, now);
    
                filter.connect(djFilter);
                djFilter.connect(gain);
            } else {
                filter.connect(gain);
            }
            gain.connect(audioCtx.destination);
    
            osc.start(now);
            osc.stop(now + duration);
        }
        // Strings
        else if (timbre === 'strings') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
    
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(frequency, now);
    
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
            gain.gain.setValueAtTime(0.15, now + duration - 0.1);
            gain.gain.linearRampToValueAtTime(0, now + duration);
    
            if (state.djMode.filterEnabled) {
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(state.djMode.filterCutoff, now);
                filter.Q.setValueAtTime(state.djMode.resonance, now);
    
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(audioCtx.destination);
            } else {
                osc.connect(gain);
                gain.connect(audioCtx.destination);
            }
    
            osc.start(now);
            osc.stop(now + duration);
        }
    */
}

// ==================== Initialization ====================
function init() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    playbackLine = document.getElementById('playbackLine');

    drawGrid();
    saveHistory(); // Save initial state
    setupControls();
    setupDrawing();
    setupCredit();
    setupKeyboard();
    updateUndoRedoButtons();
}

function drawGrid() {
    const w = canvas.width;
    const h = canvas.height;

    // Fill with white background first (needed for color inversion)
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;

    // Vertical lines (16 divisions)
    for (let i = 1; i < 16; i++) {
        const x = (w / 16) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }

    // Horizontal lines (12 divisions)
    for (let i = 1; i < 12; i++) {
        const y = (h / 12) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
}

// ==================== History (Undo/Redo) ====================
function saveHistory() {
    // Remove any future history if we're not at the end
    if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
    }

    // Save current canvas state
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    state.history.push(imageData);

    // Limit history size
    if (state.history.length > state.maxHistory) {
        state.history.shift();
    } else {
        state.historyIndex++;
    }

    updateUndoRedoButtons();
}

function undo() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        const imageData = state.history[state.historyIndex];
        ctx.putImageData(imageData, 0, 0);
        updateUndoRedoButtons();

        // Update snapshot if playing
        if (state.isPlaying && state.canvasSnapshot) {
            state.canvasSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
    }
}

function redo() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        const imageData = state.history[state.historyIndex];
        ctx.putImageData(imageData, 0, 0);
        updateUndoRedoButtons();

        // Update snapshot if playing
        if (state.isPlaying && state.canvasSnapshot) {
            state.canvasSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
    }
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');

    if (undoBtn) undoBtn.disabled = state.historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = state.historyIndex >= state.history.length - 1;
}

// ==================== Controls ====================
function setupControls() {
    // Play/Stop toggle
    document.getElementById('playBtn').addEventListener('click', togglePlayStop);

    // Options modal
    const optionsBtn = document.getElementById('optionsBtn');
    const optionsModal = document.getElementById('options-modal');
    const optionsClose = document.getElementById('optionsClose');

    optionsBtn.addEventListener('click', () => {
        optionsModal.classList.add('visible');
    });

    optionsClose.addEventListener('click', () => {
        optionsModal.classList.remove('visible');
    });

    optionsModal.addEventListener('click', (e) => {
        if (e.target === optionsModal) {
            optionsModal.classList.remove('visible');
        }
    });

    // Options checkboxes
    const optionMappings = [
        { id: 'opt-pingPong', key: 'pingPong' },
        { id: 'opt-humanize', key: 'humanize' },
        { id: 'opt-loop', key: 'loop' },
        { id: 'opt-reverb', key: 'reverb' },
        { id: 'opt-octave', key: 'octaveDoubling' },
        { id: 'opt-chord', key: 'chordMode' },
        { id: 'opt-preview', key: 'previewSound' }
    ];

    optionMappings.forEach(({ id, key }) => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                state.options[key] = e.target.checked;
            });
        }
    });

    // Speed slider
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    speedSlider.addEventListener('input', (e) => {
        state.speed = parseFloat(e.target.value);
        speedValue.textContent = state.speed.toFixed(1);
    });

    // Scale selector
    const scaleSelect = document.getElementById('scaleSelect');
    scaleSelect.addEventListener('change', (e) => {
        currentScale = SCALES[e.target.value];
    });

    // Undo/Redo/Clear
    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('redoBtn').addEventListener('click', redo);
    document.getElementById('clearAllBtn').addEventListener('click', clearAll);

    // Color palette
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentColor = btn.dataset.color;
            state.currentTimbre = state.colorTimbres[btn.dataset.color];
        });
    });

    // Timbre selectors
    document.querySelectorAll('.timbre-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const color = select.dataset.timbreFor;
            state.colorTimbres[color] = e.target.value;
            if (state.currentColor === color) {
                state.currentTimbre = e.target.value;
            }
        });
    });

    // Color clear buttons
    document.querySelectorAll('[data-clear-color]').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.clearColor;
            clearColor(color);
        });
    });

    // Mute buttons
    document.querySelectorAll('.mute-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.muteColor;
            toggleMute(color);
        });
    });

    // Solo buttons
    document.querySelectorAll('.solo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.soloColor;
            toggleSolo(color);
        });
    });
}

function setupCredit() {
    const creditBtn = document.getElementById('credit-btn');
    const creditModal = document.getElementById('credit-modal');

    creditBtn.addEventListener('click', () => {
        creditModal.classList.add('visible');
    });

    creditModal.addEventListener('click', (e) => {
        if (e.target === creditModal) {
            creditModal.classList.remove('visible');
        }
    });
}

function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
        // Undo: Ctrl+Z
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undo();
        }
        // Redo: Ctrl+Y or Ctrl+Shift+Z
        if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
            e.preventDefault();
            redo();
        }
        // Space: Play/Stop
        if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
            e.preventDefault();
            togglePlayStop();
        }
    });
}

// ==================== Mute/Solo ====================
function toggleMute(color) {
    state.colorMuted[color] = !state.colorMuted[color];
    updateMuteSoloUI();
}

function toggleSolo(color) {
    if (state.soloColor === color) {
        state.soloColor = null;
    } else {
        state.soloColor = color;
    }
    updateMuteSoloUI();
}

function updateMuteSoloUI() {
    // Update mute buttons
    document.querySelectorAll('.mute-btn').forEach(btn => {
        const color = btn.dataset.muteColor;
        btn.classList.toggle('active', state.colorMuted[color]);
    });

    // Update solo buttons
    document.querySelectorAll('.solo-btn').forEach(btn => {
        const color = btn.dataset.soloColor;
        btn.classList.toggle('active', state.soloColor === color);
    });

    // Update color button opacity
    document.querySelectorAll('.color-btn').forEach(btn => {
        const color = btn.dataset.color;
        const isMuted = isColorMuted(color);
        btn.classList.toggle('muted', isMuted);
    });
}

function isColorMuted(color) {
    // If solo is active, only the solo color plays
    if (state.soloColor) {
        return color !== state.soloColor;
    }
    // Otherwise check individual mute
    return state.colorMuted[color];
}

function clearAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    saveHistory();

    if (state.isPlaying && state.canvasSnapshot) {
        state.canvasSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
}

function clearColor(color) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Use hue-based detection to catch anti-aliased intermediate colors
    // Updated hue ranges for new color palette:
    // red: #e85a71 → hue ~350° (coral/pink)
    // blue: #4a90a4 → hue ~195° (teal-blue)
    // green: #5d9b84 → hue ~150° (sage green)
    // yellow: #d4a574 → hue ~27° (tan/camel)
    const hueRanges = {
        red: { hMin: 340, hMax: 360, hMin2: 0, hMax2: 15 },  // Red/coral wraps around 0
        blue: { hMin: 180, hMax: 210 },  // Teal-blue range
        green: { hMin: 140, hMax: 170 },  // Sage green range
        yellow: { hMin: 15, hMax: 45 }  // Tan/camel range
    };

    const range = hueRanges[color];
    if (!range) return;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Skip transparent/nearly transparent pixels
        if (a < 10) continue;

        // Skip gray pixels (grid lines)
        const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
        if (maxDiff < 30) continue;

        // Convert RGB to HSL to get hue
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;

        if (d === 0) continue; // Achromatic

        let h;
        if (max === r) {
            h = ((g - b) / d) % 6;
        } else if (max === g) {
            h = (b - r) / d + 2;
        } else {
            h = (r - g) / d + 4;
        }
        h = Math.round(h * 60);
        if (h < 0) h += 360;

        // Check if hue matches the target color
        let matches = false;
        if (color === 'red') {
            // Red hue wraps around 0/360
            matches = (h >= range.hMin || h <= range.hMax2);
        } else {
            matches = (h >= range.hMin && h <= range.hMax);
        }

        if (matches) {
            data[i + 3] = 0; // Make transparent
        }
    }

    ctx.putImageData(imageData, 0, 0);
    drawGrid();
    saveHistory();

    if (state.isPlaying && state.canvasSnapshot) {
        state.canvasSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
}

// ==================== Drawing ====================
let isDrawing = false;
let lastX = 0;
let lastY = 0;

function setupDrawing() {
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);

    document.addEventListener('mousemove', draw);
    document.addEventListener('mouseup', stopDrawing);

    // Touch events
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    });

    document.addEventListener('touchmove', (e) => {
        if (!isDrawing && !state.djMode.active) return;
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        draw(mouseEvent);
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        if (!isDrawing && !state.djMode.active) return;
        e.preventDefault();
        stopDrawing();
    }, { passive: false });
}

function getCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function startDrawing(e) {
    const pos = getCoordinates(e);

    // DJ Mode: During playback, start DJ control
    if (state.isPlaying) {
        state.djMode.active = true;
        state.djMode.startX = pos.x;
        state.djMode.startY = pos.y;
        state.djMode.currentX = pos.x;
        state.djMode.currentY = pos.y;
        state.djMode.filterEnabled = false;
        state.djMode.filterCutoff = 10000;
        state.djMode.resonance = 0.5;

        document.getElementById('djOverlay').style.display = 'block';
        updateDJVisuals();
        return;
    }

    // Normal drawing mode
    isDrawing = true;
    lastX = pos.x;
    lastY = pos.y;
}

function draw(e) {
    const pos = getCoordinates(e);

    // DJ Mode: Update effects
    if (state.djMode.active) {
        state.djMode.currentX = pos.x;
        state.djMode.currentY = pos.y;

        const deltaY = state.djMode.startY - pos.y;
        const deltaX = pos.x - state.djMode.startX;

        const filterNormalized = Math.max(-1, Math.min(1, deltaY / 150));
        const logMin = Math.log(200);
        const logMax = Math.log(20000);
        const logCenter = (logMin + logMax) / 2;
        const logFilter = logCenter + filterNormalized * (logMax - logMin) / 2;
        state.djMode.filterCutoff = Math.exp(logFilter);
        state.djMode.filterCutoff = Math.max(200, Math.min(20000, state.djMode.filterCutoff));

        const resonanceNormalized = Math.max(0, Math.min(1, deltaX / 200));
        const logResMin = Math.log(0.5);
        const logResMax = Math.log(50);
        const logRes = logResMin + resonanceNormalized * (logResMax - logResMin);
        state.djMode.resonance = Math.exp(logRes);
        state.djMode.resonance = Math.max(0.5, Math.min(50, state.djMode.resonance));

        state.djMode.filterEnabled = true;
        updateDJVisuals();
        return;
    }

    // Normal drawing mode
    if (!isDrawing) return;

    ctx.strokeStyle = COLOR_MAP[state.currentColor];
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    // Preview Sound
    if (state.options.previewSound) {
        const now = Date.now();
        // Play sound if enough time passed (e.g., 50ms) or significant Y change
        if (now - state.lastDrawTime > 50 || Math.abs(pos.y - state.lastDrawY) > 20) {
            const frequency = yToFrequency(pos.y, canvas.height);
            const timbre = state.colorTimbres[state.currentColor];

            // Call playSound directly for lower latency/overhead, skip reverb/chords for preview to keep it clean?
            // Or use full playNote for full effect. Let's use playNote for full effect but short duration.
            // Using a slightly shorter duration for preview
            playNote(frequency, timbre, 0.1);

            state.lastDrawTime = now;
            state.lastDrawY = pos.y;
        }
    }

    lastX = pos.x;
    lastY = pos.y;
}

function stopDrawing() {
    if (state.djMode.active) {
        state.djMode.active = false;
        state.djMode.filterEnabled = false;
        state.djMode.filterCutoff = 10000;
        state.djMode.resonance = 0.5;
        document.getElementById('djOverlay').style.display = 'none';
    }

    if (isDrawing) {
        isDrawing = false;
        saveHistory();
    }
}

// ==================== DJ Mode Visuals ====================
function updateDJVisuals() {
    let filterDisplay;
    if (state.djMode.filterCutoff >= 1000) {
        filterDisplay = `${(state.djMode.filterCutoff / 1000).toFixed(1)}kHz`;
    } else {
        filterDisplay = `${Math.round(state.djMode.filterCutoff)}Hz`;
    }

    const resonanceDisplay = state.djMode.resonance.toFixed(1);

    document.getElementById('pitchValue').textContent = filterDisplay;
    document.getElementById('filterValue').textContent = resonanceDisplay;
}

function drawDJGuides() {
    if (!state.djMode.active || !state.canvasSnapshot) return;

    // Apply color inversion by manipulating pixel data directly
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];       // Red
        data[i + 1] = 255 - data[i + 1]; // Green
        data[i + 2] = 255 - data[i + 2]; // Blue
        // Alpha stays the same
    }
    ctx.putImageData(imageData, 0, 0);

    ctx.save();

    // Draw line connecting start point to current point
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(state.djMode.startX, state.djMode.startY);
    ctx.lineTo(state.djMode.currentX, state.djMode.currentY);
    ctx.stroke();

    // Start point (small filled circle)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(state.djMode.startX, state.djMode.startY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Current point (larger circle outline)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(state.djMode.currentX, state.djMode.currentY, 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
}

// ==================== Playback ====================
function togglePlayStop() {
    if (state.isPlaying) {
        stop();
    } else {
        play();
    }
}

async function play() {
    if (state.isPlaying) return;

    await initAudio();

    if (state.audioContext && state.audioContext.state === 'running') {
        const dummyOsc = state.audioContext.createOscillator();
        const dummyGain = state.audioContext.createGain();
        dummyGain.gain.value = 0;
        dummyOsc.connect(dummyGain);
        dummyGain.connect(state.audioContext.destination);
        dummyOsc.start();
        dummyOsc.stop(state.audioContext.currentTime + 0.001);
    }

    state.canvasSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    state.activeFlashes = [];
    state.playedGrids.clear();

    state.isPlaying = true;
    state.playbackPosition = 0;
    state.playbackDirection = 1;
    state.lastTime = performance.now();
    state.lastPlaybackX = -10;

    // Update UI
    document.body.classList.add('playing');
    document.getElementById('playBtn').textContent = '■ STOP';
    playbackLine.style.display = 'block';

    state.animationId = requestAnimationFrame(animate);
}

function stop() {
    state.isPlaying = false;
    state.playbackPosition = 0;
    state.lastPlaybackX = -10;

    if (state.animationId) {
        cancelAnimationFrame(state.animationId);
        state.animationId = null;
    }

    if (state.canvasSnapshot) {
        ctx.putImageData(state.canvasSnapshot, 0, 0);
        state.canvasSnapshot = null;
    }

    // Update UI
    document.body.classList.remove('playing');
    document.getElementById('playBtn').textContent = '▶ PLAY';
    playbackLine.style.display = 'none';
    playbackLine.style.left = '0%';
}

function animate(currentTime) {
    if (!state.isPlaying) return;

    if (!currentTime) {
        state.animationId = requestAnimationFrame(animate);
        return;
    }

    const deltaTime = currentTime - state.lastTime;
    state.lastTime = currentTime;

    const baseSpeed = 1200 / (5 * 1000);
    state.playbackPosition += deltaTime * baseSpeed * state.speed * state.playbackDirection;

    if (state.options.pingPong) {
        if (state.playbackPosition >= canvas.width) {
            state.playbackPosition = canvas.width - 1;
            state.playbackDirection = -1;
            state.lastPlaybackX = canvas.width + 10;
            state.playedGrids.clear();
        } else if (state.playbackPosition <= 0) {
            state.playbackPosition = 0;
            state.playbackDirection = 1;
            state.lastPlaybackX = -10;
            state.playedGrids.clear();
        }
    } else {
        if (state.playbackPosition >= canvas.width) {
            if (state.options.loop) {
                // Loop mode: restart from beginning
                state.playbackPosition = 0;
                state.lastPlaybackX = -10;
                state.activeFlashes = [];
                state.playedGrids.clear();
            } else {
                // Normal mode: stop playback
                stop();
                return;
            }
        }
    }

    if (state.canvasSnapshot) {
        ctx.putImageData(state.canvasSnapshot, 0, 0);

        drawDJGuides();

        state.activeFlashes.forEach(flash => {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = flash.color;
            ctx.globalAlpha = flash.alpha;
            ctx.beginPath();
            ctx.arc(flash.x, flash.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        state.activeFlashes = state.activeFlashes.map(flash => ({
            ...flash,
            alpha: flash.alpha * 0.9
        })).filter(flash => flash.alpha > 0.05);
    }

    const percentage = (state.playbackPosition / canvas.width) * 100;
    playbackLine.style.left = `${percentage}%`;

    checkAndPlayNotes(Math.floor(state.playbackPosition));

    state.animationId = requestAnimationFrame(animate);
}

function checkAndPlayNotes(x) {
    if (state.playbackDirection === 1) {
        if (x <= state.lastPlaybackX || x >= canvas.width) return;
    } else {
        if (x >= state.lastPlaybackX || x < 0) return;
    }

    const gridPosition = Math.round(x / GRID_SIZE) * GRID_SIZE;

    if (state.playedGrids.has(gridPosition)) {
        state.lastPlaybackX = x;
        return;
    }

    if (!state.canvasSnapshot) return;

    const snapshotData = state.canvasSnapshot.data;
    const width = state.canvasSnapshot.width;

    let hasDrawing = false;
    const detectedNotes = [];
    const yBuckets = new Map();
    const bucketSize = 30;

    for (let y = 0; y < canvas.height; y++) {
        const i = (y * width + x) * 4;
        const r = snapshotData[i];
        const g = snapshotData[i + 1];
        const b = snapshotData[i + 2];
        const a = snapshotData[i + 3];

        if (a > 200) {
            const colorInfo = getColorFromRGB(r, g, b);
            if (colorInfo) {
                hasDrawing = true;

                // Check if this color is muted
                if (isColorMuted(colorInfo.color)) {
                    continue;
                }

                const frequency = yToFrequency(y, canvas.height);
                const bucket = Math.floor(y / bucketSize);
                const key = `${colorInfo.timbre}_${bucket}`;

                if (!yBuckets.has(key)) {
                    detectedNotes.push({ frequency, timbre: colorInfo.timbre, y, color: colorInfo.color });
                    yBuckets.set(key, true);
                }
            }
        }
    }

    if (hasDrawing && detectedNotes.length > 0) {
        detectedNotes.forEach((note, index) => {
            // Humanize: add small random delay (0-50ms) for organic feel
            const humanizeDelay = state.options.humanize ? Math.random() * 50 : 0;
            setTimeout(() => {
                playNote(note.frequency, note.timbre);
            }, humanizeDelay);
            flashIntersection(x, note.y, note.color);
        });
        state.playedGrids.add(gridPosition);
    }

    state.lastPlaybackX = x;
}

function getColorFromRGB(r, g, b) {
    // Skip near-gray pixels (grid lines, etc)
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    if (maxDiff < 30) return null;

    // New color palette detection:
    // red: #e85a71 (R:232, G:90, B:113) - R dominant, low G
    // blue: #4a90a4 (R:74, G:144, B:164) - B highest, G mid, R low
    // green: #5d9b84 (R:93, G:155, B:132) - G highest
    // yellow: #d4a574 (R:212, G:165, B:116) - R highest, G mid-high, B low

    let color = null;

    // Red: R is much higher than G, and R > B
    if (r > 180 && r > g + 80 && r > b + 50) {
        color = 'red';
    }
    // Blue: B is highest, G is mid, R is low
    else if (b > r && b > 120 && r < 120) {
        color = 'blue';
    }
    // Green: G is highest, moderate difference from others
    else if (g > r && g > b && g > 120 && r < 150) {
        color = 'green';
    }
    // Yellow/Tan: R highest, G mid-high, B lowest
    else if (r > 180 && g > 130 && b < 150 && r > b + 50 && g > b) {
        color = 'yellow';
    }

    if (color) {
        return { color: color, timbre: state.colorTimbres[color] };
    }
    return null;
}

function flashIntersection(x, y, color) {
    state.activeFlashes.push({
        x: x,
        y: y,
        color: COLOR_MAP[color],
        alpha: 0.8
    });
}

// ==================== Start Application ====================
window.addEventListener('DOMContentLoaded', init);
