// ==================== Global State ====================
const state = {
    isPlaying: false,
    playbackPosition: 0,
    speed: 1.0,
    tool: 'pen',
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
    pingPongMode: false,
    djMode: {
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        filterEnabled: false,
        filterCutoff: 10000,
        resonance: 0.5
    }
};

const GRID_SIZE = 30; // 16th notes grid (1200px / 40 = 30px)

const COLOR_MAP = {
    red: '#fc5c65',
    blue: '#45aaf2',
    green: '#26de81',
    yellow: '#fed330'
};

// Musical Scales
const SCALES = {
    pentatonic: [
        261.63, 293.66, 329.63, 392.00, 440.00,
        523.25, 587.33, 659.25, 783.99, 880.00, 1046.50
    ],
    major: [
        261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88,
        523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50
    ],
    minor: [
        261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16,
        523.25, 587.33, 622.25, 698.46, 783.99, 830.61, 932.33, 1046.50
    ],
    blues: [
        261.63, 311.13, 349.23, 369.99, 392.00, 466.16,
        523.25, 622.25, 698.46, 739.99, 783.99, 932.33, 1046.50
    ],
    wholetone: [
        261.63, 293.66, 329.63, 369.99, 415.30, 466.16,
        523.25, 587.33, 659.25, 739.99, 830.61, 932.33, 1046.50
    ],
    chromatic: [
        261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00,
        415.30, 440.00, 466.16, 493.88, 523.25, 554.37, 587.33, 622.25,
        659.25, 698.46, 739.99, 783.99, 830.61, 880.00, 932.33, 987.77, 1046.50
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
            console.log('AudioContext resumed, state:', state.audioContext.state);
        } catch (error) {
            console.error('Failed to resume AudioContext:', error);
        }
    }
    if (state.audioContext.state !== 'running') {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

function yToFrequency(y, canvasHeight) {
    const index = Math.floor((1 - y / canvasHeight) * currentScale.length);
    return currentScale[Math.max(0, Math.min(currentScale.length - 1, index))];
}

async function playNote(frequency, timbre, duration = 0.25) {
    const ctx = state.audioContext;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
        await ctx.resume();
    }

    if (ctx.state !== 'running') {
        console.warn('AudioContext not running:', ctx.state);
        return;
    }

    const now = ctx.currentTime;

    // Basic waveforms
    if (['square', 'triangle', 'sawtooth', 'sine'].includes(timbre)) {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = timbre;
        oscillator.frequency.setValueAtTime(frequency, now);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.02);
        gainNode.gain.linearRampToValueAtTime(0.12, now + 0.08);
        gainNode.gain.setValueAtTime(0.12, now + duration - 0.15);
        gainNode.gain.linearRampToValueAtTime(0, now + duration);

        if (state.djMode.filterEnabled) {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(state.djMode.filterCutoff, now);
            filter.Q.setValueAtTime(state.djMode.resonance, now);

            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(ctx.destination);
        } else {
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
        }

        oscillator.start(now);
        oscillator.stop(now + duration);
    }
    // Piano
    else if (timbre === 'piano') {
        const harmonics = [1, 2, 3, 4];
        const gains = [0.3, 0.15, 0.1, 0.05];

        harmonics.forEach((harmonic, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency * harmonic, now);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(gains[index], now + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            if (state.djMode.filterEnabled) {
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(state.djMode.filterCutoff, now);
                filter.Q.setValueAtTime(state.djMode.resonance, now);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);
            } else {
                osc.connect(gain);
                gain.connect(ctx.destination);
            }

            osc.start(now);
            osc.stop(now + duration);
        });
    }
    // Bell
    else if (timbre === 'bell') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration * 2);

        if (state.djMode.filterEnabled) {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(state.djMode.filterCutoff, now);
            filter.Q.setValueAtTime(state.djMode.resonance, now);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
        } else {
            osc.connect(gain);
            gain.connect(ctx.destination);
        }

        osc.start(now);
        osc.stop(now + duration * 2);
    }
    // Bass
    else if (timbre === 'bass') {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const djFilter = state.djMode.filterEnabled ? ctx.createBiquadFilter() : null;
        const gain = ctx.createGain();

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
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
    }
    // Strings
    else if (timbre === 'strings') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(frequency, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
        gain.gain.setValueAtTime(0.15, now + duration - 0.1);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        if (state.djMode.filterEnabled) {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(state.djMode.filterCutoff, now);
            filter.Q.setValueAtTime(state.djMode.resonance, now);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
        } else {
            osc.connect(gain);
            gain.connect(ctx.destination);
        }

        osc.start(now);
        osc.stop(now + duration);
    }
}

// ==================== Drawing Setup ====================
function init() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    playbackLine = document.getElementById('playbackLine');

    drawGrid();
    setupControls();
    setupDrawing();
    setupCredit();

    // Show instructions briefly
    const instructions = document.getElementById('instructions');
    instructions.classList.add('visible');
    setTimeout(() => {
        instructions.classList.remove('visible');
    }, 5000);
}

function drawGrid() {
    const w = canvas.width;
    const h = canvas.height;

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

// ==================== Controls ====================
function setupControls() {
    // Play/Stop
    document.getElementById('playBtn').addEventListener('click', play);
    document.getElementById('stopBtn').addEventListener('click', stop);

    // Ping-pong mode
    const pingPongCheck = document.getElementById('pingPongCheck');
    pingPongCheck.addEventListener('change', (e) => {
        state.pingPongMode = e.target.checked;
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

    // Tool buttons
    document.getElementById('penBtn').addEventListener('click', () => setTool('pen'));
    document.getElementById('eraserBtn').addEventListener('click', () => setTool('eraser'));

    // Clear all
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
    document.querySelectorAll('.color-clear-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.clearColor;
            if (confirm(`Clear all ${color} lines?`)) {
                clearColor(color);
            }
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

function setTool(tool) {
    state.tool = tool;

    const penBtn = document.getElementById('penBtn');
    const eraserBtn = document.getElementById('eraserBtn');

    if (tool === 'pen') {
        penBtn.classList.add('active');
        eraserBtn.classList.remove('active');
        canvas.classList.remove('eraser');
    } else {
        eraserBtn.classList.add('active');
        penBtn.classList.remove('active');
        canvas.classList.add('eraser');
    }
}

function clearAll() {
    if (confirm('Clear canvas?')) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        // Update snapshot if playing to prevent animation from restoring cleared canvas
        if (state.isPlaying && state.canvasSnapshot) {
            state.canvasSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
    }
}

function clearColor(color) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const colorRanges = {
        red: { rMin: 200, rMax: 255, gMin: 0, gMax: 150, bMin: 0, bMax: 150 },
        blue: { rMin: 0, rMax: 150, gMin: 150, gMax: 255, bMin: 200, bMax: 255 },
        green: { rMin: 0, rMax: 150, gMin: 200, gMax: 255, bMin: 0, bMax: 200 },
        yellow: { rMin: 200, rMax: 255, gMin: 200, gMax: 255, bMin: 0, bMax: 150 }
    };

    const range = colorRanges[color];
    if (!range) return;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a > 200 &&
            r >= range.rMin && r <= range.rMax &&
            g >= range.gMin && g <= range.gMax &&
            b >= range.bMin && b <= range.bMax) {
            data[i + 3] = 0;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    drawGrid();
    // Update snapshot if playing to prevent animation from restoring cleared lines
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

        // Filter Cutoff (Y-axis)
        const filterNormalized = Math.max(-1, Math.min(1, deltaY / 150));
        const logMin = Math.log(200);
        const logMax = Math.log(20000);
        const logCenter = (logMin + logMax) / 2;
        const logFilter = logCenter + filterNormalized * (logMax - logMin) / 2;
        state.djMode.filterCutoff = Math.exp(logFilter);
        state.djMode.filterCutoff = Math.max(200, Math.min(20000, state.djMode.filterCutoff));

        // Resonance (X-axis)
        const resonanceNormalized = Math.max(0, Math.min(1, deltaX / 800));
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

    if (state.tool === 'pen') {
        ctx.strokeStyle = COLOR_MAP[state.currentColor];
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    } else if (state.tool === 'eraser') {
        const eraserSize = 30;
        ctx.clearRect(pos.x - eraserSize / 2, pos.y - eraserSize / 2, eraserSize, eraserSize);

        // Redraw grid in erased area
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 1;

        const w = canvas.width;
        const h = canvas.height;

        for (let i = 1; i < 16; i++) {
            const x = (w / 16) * i;
            if (x >= pos.x - eraserSize / 2 && x <= pos.x + eraserSize / 2) {
                ctx.beginPath();
                ctx.moveTo(x, Math.max(0, pos.y - eraserSize / 2));
                ctx.lineTo(x, Math.min(h, pos.y + eraserSize / 2));
                ctx.stroke();
            }
        }

        for (let i = 1; i < 12; i++) {
            const y = (h / 12) * i;
            if (y >= pos.y - eraserSize / 2 && y <= pos.y + eraserSize / 2) {
                ctx.beginPath();
                ctx.moveTo(Math.max(0, pos.x - eraserSize / 2), y);
                ctx.lineTo(Math.min(w, pos.x + eraserSize / 2), y);
                ctx.stroke();
            }
        }
        ctx.restore();
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

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(state.djMode.startX, 0);
    ctx.lineTo(state.djMode.startX, canvas.height);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(0, state.djMode.startY);
    ctx.lineTo(canvas.width, state.djMode.startY);
    ctx.stroke();

    ctx.setLineDash([]);

    // Start point marker
    ctx.fillStyle = 'rgba(0, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(state.djMode.startX, state.djMode.startY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Current position marker
    ctx.strokeStyle = 'rgba(255, 0, 255, 1)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(state.djMode.currentX, state.djMode.currentY, 12, 0, Math.PI * 2);
    ctx.stroke();

    // Delta lines
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(state.djMode.startX, state.djMode.startY);
    ctx.lineTo(state.djMode.startX, state.djMode.currentY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(state.djMode.startX, state.djMode.currentY);
    ctx.lineTo(state.djMode.currentX, state.djMode.currentY);
    ctx.stroke();

    ctx.restore();
}

// ==================== Playback ====================
async function play() {
    if (state.isPlaying) return;

    await initAudio();

    // Silent note to activate AudioContext
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

    if (state.pingPongMode) {
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
            state.playbackPosition = 0;
            state.lastPlaybackX = -10;
            state.activeFlashes = [];
            state.playedGrids.clear();
        }
    }

    // Restore canvas
    if (state.canvasSnapshot) {
        ctx.putImageData(state.canvasSnapshot, 0, 0);

        drawDJGuides();

        // Redraw flashes
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

        // Fade flashes
        state.activeFlashes = state.activeFlashes.map(flash => ({
            ...flash,
            alpha: flash.alpha * 0.9
        })).filter(flash => flash.alpha > 0.05);
    }

    // Update playback line
    const percentage = (state.playbackPosition / canvas.width) * 100;
    playbackLine.style.left = `calc(50% - 600px + ${state.playbackPosition}px)`;

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
        detectedNotes.forEach(note => {
            playNote(note.frequency, note.timbre);
            flashIntersection(x, note.y, note.color);
        });
        state.playedGrids.add(gridPosition);
    }

    state.lastPlaybackX = x;
}

function getColorFromRGB(r, g, b) {
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    if (maxDiff < 50) return null;

    let color = null;
    if (r > 200 && g < 150 && b < 150) color = 'red';
    else if (r < 150 && g > 150 && b > 200) color = 'blue';
    else if (r < 150 && g > 200 && b < 200) color = 'green';
    else if (r > 200 && g > 200 && b < 150) color = 'yellow';

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
