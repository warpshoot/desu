import { TRACKS, ROWS, COLS, MAX_PATTERNS, DEFAULT_BPM, MIN_BPM, MAX_BPM, PRESET_PATTERNS } from './constants.js';

/**
 * Deck - Independent sequencer deck with its own audio, timing, and UI.
 * Each deck has 4 tracks x 16 steps, 8 pattern banks, independent BPM,
 * and a filter effect.
 */
export class Deck {
    constructor(id, containerEl, outputNode) {
        this.id = id; // 'a' or 'b'
        this.container = containerEl;
        this.outputNode = outputNode; // Tone.js Gain node to connect to

        // Audio
        this.instruments = [];
        this.filters = [];
        this.gains = [];
        this.deckGain = null;
        this.deckFilter = null; // LPF/HPF sweep
        this.deckHPF = null;

        // State
        this.bpm = DEFAULT_BPM;
        this.playing = false;
        this.currentStep = 0;
        this.currentPattern = 0;
        this.patterns = [];
        this.mutedTracks = [false, false, false, false];

        // Scheduler
        this.nextStepTime = 0;
        this.schedulerInterval = null;
        this.lookahead = 0.1; // seconds ahead to schedule
        this.scheduleMs = 25; // check interval in ms

        // Filter state: 0 = center (no filter), -1 = HPF, +1 = LPF
        this.filterPosition = 0;

        // UI refs
        this.cells = [];
        this.stepIndicators = [];
        this.bpmDisplay = null;
        this.playBtn = null;

        this.initialized = false;

        this._initPatterns();
    }

    _initPatterns() {
        for (let p = 0; p < MAX_PATTERNS; p++) {
            this.patterns[p] = this._createEmptyPattern();
        }
        // Load preset into pattern 0
        const presetKeys = Object.keys(PRESET_PATTERNS).filter(k => k !== 'Empty');
        const presetIdx = this.id === 'a' ? 0 : 1;
        const presetName = presetKeys[presetIdx % presetKeys.length];
        const preset = PRESET_PATTERNS[presetName];
        if (preset) {
            for (let t = 0; t < ROWS; t++) {
                for (let s = 0; s < COLS; s++) {
                    this.patterns[0][t][s] = preset.grid[t][s] ? 1 : 0;
                }
            }
        }
    }

    _createEmptyPattern() {
        const pattern = [];
        for (let t = 0; t < ROWS; t++) {
            pattern[t] = new Array(COLS).fill(0);
        }
        return pattern;
    }

    get pattern() {
        return this.patterns[this.currentPattern];
    }

    async init() {
        if (this.initialized) return;

        await Tone.start();

        // Deck output gain
        this.deckGain = new Tone.Gain(0.8);

        // Deck filter chain: HPF -> LPF -> deckGain -> output
        this.deckHPF = new Tone.Filter({
            frequency: 20,
            type: 'highpass',
            rolloff: -24,
            Q: 1
        });
        this.deckFilter = new Tone.Filter({
            frequency: 20000,
            type: 'lowpass',
            rolloff: -24,
            Q: 1
        });

        this.deckHPF.connect(this.deckFilter);
        this.deckFilter.connect(this.deckGain);
        this.deckGain.connect(this.outputNode);

        // Create instruments
        for (let i = 0; i < TRACKS.length; i++) {
            const track = TRACKS[i];
            let instrument;

            switch (track.type) {
                case 'membrane':
                    instrument = new Tone.MembraneSynth({
                        pitchDecay: 0.05,
                        octaves: 7,
                        oscillator: { type: 'sine' },
                        envelope: { attack: 0.01, decay: 0.4, sustain: 0.01, release: 1.0 }
                    });
                    break;
                case 'noise':
                    instrument = new Tone.NoiseSynth({
                        noise: { type: 'white' },
                        envelope: { attack: 0.008, decay: 0.2, sustain: 0 }
                    });
                    break;
                case 'metal':
                    instrument = new Tone.MetalSynth({
                        frequency: 200,
                        envelope: { attack: 0.008, decay: 0.1, release: 0.15 },
                        harmonicity: 5.1,
                        modulationIndex: 32,
                        resonance: 4000,
                        octaves: 1.5
                    });
                    break;
                case 'fm':
                    instrument = new Tone.PolySynth(Tone.FMSynth, {
                        maxPolyphony: 2,
                        harmonicity: 1,
                        modulationIndex: 14,
                        oscillator: { type: 'triangle' },
                        envelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.4 },
                        modulation: { type: 'square' },
                        modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.4 }
                    });
                    break;
            }

            const filter = new Tone.Filter({
                frequency: track.defaultParams.cutoff,
                type: 'lowpass',
                rolloff: -24
            });

            const gain = new Tone.Gain(track.defaultParams.vol);

            instrument.connect(filter);
            filter.connect(gain);
            gain.connect(this.deckHPF);

            this.instruments.push(instrument);
            this.filters.push(filter);
            this.gains.push(gain);
        }

        this.initialized = true;
    }

    // --- Audio ---

    triggerNote(track, time) {
        if (!this.initialized || !this.instruments[track]) return;
        if (this.mutedTracks[track]) return;

        const instrument = this.instruments[track];
        const trackConfig = TRACKS[track];
        const dur = trackConfig.defaultParams.decay;

        switch (trackConfig.type) {
            case 'membrane':
                instrument.triggerAttackRelease(trackConfig.baseFreq, dur * 0.6, time, 0.9);
                break;
            case 'noise':
                instrument.triggerAttackRelease(dur * 0.3, time, 0.7);
                break;
            case 'metal': {
                const freq = typeof trackConfig.baseFreq === 'number'
                    ? trackConfig.baseFreq
                    : Tone.Frequency(trackConfig.baseFreq).toFrequency();
                instrument.triggerAttackRelease(freq, dur * 0.3, time, 0.6);
                break;
            }
            case 'fm':
                instrument.triggerAttackRelease(trackConfig.baseFreq, dur * 0.7, time, 0.9);
                break;
        }
    }

    setFilterPosition(position) {
        // position: -1 (HPF full) to 0 (flat) to +1 (LPF full)
        this.filterPosition = position;
        if (!this.initialized) return;

        if (position > 0.02) {
            // LPF sweep: map 0..1 to 20000..200Hz
            const factor = Math.pow(0.01, position);
            const lpf = Math.max(200, 20000 * factor);
            this.deckFilter.frequency.rampTo(lpf, 0.05);
            this.deckHPF.frequency.rampTo(20, 0.05);
            this.deckFilter.Q.rampTo(1 + position * 8, 0.05);
            this.deckHPF.Q.rampTo(1, 0.05);
        } else if (position < -0.02) {
            // HPF sweep: map -1..0 to 6000..20Hz
            const absPos = Math.abs(position);
            const factor = Math.pow(300, absPos);
            const hpf = Math.min(6000, 20 * factor);
            this.deckHPF.frequency.rampTo(hpf, 0.05);
            this.deckFilter.frequency.rampTo(20000, 0.05);
            this.deckHPF.Q.rampTo(1 + absPos * 8, 0.05);
            this.deckFilter.Q.rampTo(1, 0.05);
        } else {
            // Flat
            this.deckFilter.frequency.rampTo(20000, 0.1);
            this.deckHPF.frequency.rampTo(20, 0.1);
            this.deckFilter.Q.rampTo(1, 0.1);
            this.deckHPF.Q.rampTo(1, 0.1);
        }
    }

    setVolume(value) {
        // value: 0..1
        if (this.deckGain) {
            this.deckGain.gain.rampTo(value, 0.05);
        }
    }

    // --- Scheduler ---

    play() {
        if (this.playing) return;
        this.playing = true;
        this.currentStep = 0;
        this.nextStepTime = Tone.now() + 0.05;
        this.schedulerInterval = setInterval(() => this._schedule(), this.scheduleMs);
        this._updatePlayButton();
    }

    stop() {
        this.playing = false;
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
        }
        this.currentStep = 0;
        this._clearPlayheads();
        this._updatePlayButton();
    }

    togglePlay() {
        if (this.playing) {
            this.stop();
        } else {
            this.play();
        }
    }

    setBPM(bpm) {
        this.bpm = Math.max(MIN_BPM, Math.min(MAX_BPM, bpm));
        if (this.bpmDisplay) {
            this.bpmDisplay.textContent = this.bpm;
        }
    }

    _schedule() {
        const now = Tone.now();
        while (this.nextStepTime < now + this.lookahead) {
            this._onStep(this.currentStep, this.nextStepTime);
            const secondsPerStep = 60.0 / this.bpm / 4; // 16th notes
            this.nextStepTime += secondsPerStep;
            this.currentStep = (this.currentStep + 1) % COLS;
        }
    }

    _onStep(step, time) {
        const pat = this.pattern;

        // Schedule audio
        for (let track = 0; track < ROWS; track++) {
            if (pat[track][step]) {
                this.triggerNote(track, time);
            }
        }

        // Schedule visual update
        const visualDelay = Math.max(0, (time - Tone.now()) * 1000);
        setTimeout(() => {
            this._updatePlayheads(step);
        }, visualDelay);
    }

    // --- Pattern Management ---

    switchPattern(index) {
        if (index < 0 || index >= MAX_PATTERNS) return;
        this.currentPattern = index;
        this._renderGrid();
        this._updatePatternBank();
    }

    loadPreset(presetName) {
        const preset = PRESET_PATTERNS[presetName];
        if (!preset) return;
        for (let t = 0; t < ROWS; t++) {
            for (let s = 0; s < COLS; s++) {
                this.pattern[t][s] = preset.grid[t][s] ? 1 : 0;
            }
        }
        this._renderGrid();
        this._updatePatternBank();
    }

    clearPattern() {
        for (let t = 0; t < ROWS; t++) {
            for (let s = 0; s < COLS; s++) {
                this.pattern[t][s] = 0;
            }
        }
        this._renderGrid();
        this._updatePatternBank();
    }

    hasData(patIndex) {
        const pat = this.patterns[patIndex];
        if (!pat) return false;
        for (let t = 0; t < ROWS; t++) {
            for (let s = 0; s < COLS; s++) {
                if (pat[t][s]) return true;
            }
        }
        return false;
    }

    // --- UI Building ---

    buildUI() {
        this.container.innerHTML = '';
        this.container.classList.add('deck', `deck-${this.id}`);

        // Header
        const header = document.createElement('div');
        header.className = 'deck-header';
        header.innerHTML = `<span class="deck-label">DECK ${this.id.toUpperCase()}</span>`;

        // Preset selector
        const presetSelect = document.createElement('select');
        presetSelect.className = 'preset-select';
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'Load...';
        presetSelect.appendChild(defaultOpt);
        Object.keys(PRESET_PATTERNS).forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            presetSelect.appendChild(opt);
        });
        presetSelect.addEventListener('change', () => {
            if (presetSelect.value) {
                this.loadPreset(presetSelect.value);
                presetSelect.value = '';
            }
        });
        header.appendChild(presetSelect);
        this.container.appendChild(header);

        // Pattern bank
        const bankEl = document.createElement('div');
        bankEl.className = 'pattern-bank';
        for (let i = 0; i < MAX_PATTERNS; i++) {
            const pad = document.createElement('button');
            pad.className = 'pat-pad';
            pad.textContent = i + 1;
            pad.dataset.index = i;
            if (i === this.currentPattern) pad.classList.add('active');
            if (this.hasData(i)) pad.classList.add('has-data');

            pad.addEventListener('click', () => this.switchPattern(i));

            // Long press to clear
            let longTimer = null;
            pad.addEventListener('mousedown', () => {
                longTimer = setTimeout(() => {
                    this.patterns[i] = this._createEmptyPattern();
                    if (i === this.currentPattern) this._renderGrid();
                    this._updatePatternBank();
                }, 600);
            });
            pad.addEventListener('mouseup', () => clearTimeout(longTimer));
            pad.addEventListener('mouseleave', () => clearTimeout(longTimer));

            bankEl.appendChild(pad);
        }
        this.container.appendChild(bankEl);

        // Grid with track labels
        const gridArea = document.createElement('div');
        gridArea.className = 'grid-area';

        const trackLabels = document.createElement('div');
        trackLabels.className = 'track-labels';

        for (let t = 0; t < ROWS; t++) {
            const label = document.createElement('div');
            label.className = 'track-label';
            label.textContent = TRACKS[t].short;
            label.addEventListener('click', () => {
                this.mutedTracks[t] = !this.mutedTracks[t];
                label.classList.toggle('muted', this.mutedTracks[t]);
            });
            trackLabels.appendChild(label);
        }

        const gridEl = document.createElement('div');
        gridEl.className = 'grid';

        this.cells = [];
        const pat = this.pattern;
        for (let t = 0; t < ROWS; t++) {
            this.cells[t] = [];
            for (let s = 0; s < COLS; s++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.track = t;
                cell.dataset.step = s;
                if (pat[t][s]) cell.classList.add('active');

                cell.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    this._toggleCell(t, s);
                    this._paintMode = true;
                    this._paintTrack = t;
                    this._paintValue = pat[t][s];
                });
                cell.addEventListener('mouseenter', () => {
                    if (this._paintMode && this._paintTrack === t) {
                        pat[t][s] = this._paintValue;
                        cell.classList.toggle('active', !!this._paintValue);
                        this._updatePatternBank();
                    }
                });

                // Touch support
                cell.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    this._toggleCell(t, s);
                }, { passive: false });

                this.cells[t][s] = cell;
                gridEl.appendChild(cell);
            }
        }

        // Global mouseup to end painting
        document.addEventListener('mouseup', () => {
            this._paintMode = false;
        });

        gridArea.appendChild(trackLabels);
        gridArea.appendChild(gridEl);
        this.container.appendChild(gridArea);

        // Step indicators
        const stepsEl = document.createElement('div');
        stepsEl.className = 'step-indicators';
        // Spacer for track labels
        const spacer = document.createElement('div');
        spacer.className = 'step-spacer';
        stepsEl.appendChild(spacer);
        this.stepIndicators = [];
        for (let s = 0; s < COLS; s++) {
            const dot = document.createElement('div');
            dot.className = 'step-dot';
            this.stepIndicators.push(dot);
            stepsEl.appendChild(dot);
        }
        this.container.appendChild(stepsEl);

        // Controls
        const controls = document.createElement('div');
        controls.className = 'deck-controls';

        // Play/Stop
        this.playBtn = document.createElement('button');
        this.playBtn.className = 'deck-btn play-btn';
        this.playBtn.innerHTML = '&#9654;';
        this.playBtn.addEventListener('click', async () => {
            if (!this.initialized) await this.init();
            this.togglePlay();
        });

        const stopBtn = document.createElement('button');
        stopBtn.className = 'deck-btn stop-btn';
        stopBtn.innerHTML = '&#9632;';
        stopBtn.addEventListener('click', () => this.stop());

        // BPM
        const bpmArea = document.createElement('div');
        bpmArea.className = 'bpm-area';
        this.bpmDisplay = document.createElement('div');
        this.bpmDisplay.className = 'bpm-value';
        this.bpmDisplay.textContent = this.bpm;

        // BPM drag
        let bpmDragging = false;
        let bpmStartY = 0;
        let bpmStartVal = 0;

        const bpmDragStart = (y) => {
            bpmDragging = true;
            bpmStartY = y;
            bpmStartVal = this.bpm;
        };
        const bpmDragMove = (y) => {
            if (!bpmDragging) return;
            const delta = Math.round((bpmStartY - y) / 3);
            this.setBPM(bpmStartVal + delta);
        };
        const bpmDragEnd = () => { bpmDragging = false; };

        this.bpmDisplay.addEventListener('mousedown', (e) => bpmDragStart(e.clientY));
        document.addEventListener('mousemove', (e) => bpmDragMove(e.clientY));
        document.addEventListener('mouseup', bpmDragEnd);
        this.bpmDisplay.addEventListener('touchstart', (e) => {
            bpmDragStart(e.touches[0].clientY);
        }, { passive: true });
        document.addEventListener('touchmove', (e) => {
            if (bpmDragging) bpmDragMove(e.touches[0].clientY);
        }, { passive: true });
        document.addEventListener('touchend', bpmDragEnd);

        const bpmLabel = document.createElement('div');
        bpmLabel.className = 'bpm-label';
        bpmLabel.textContent = 'BPM';

        bpmArea.appendChild(this.bpmDisplay);
        bpmArea.appendChild(bpmLabel);

        // Volume slider
        const volArea = document.createElement('div');
        volArea.className = 'vol-area';
        const volSlider = document.createElement('input');
        volSlider.type = 'range';
        volSlider.className = 'vol-slider';
        volSlider.min = '0';
        volSlider.max = '100';
        volSlider.value = '80';
        volSlider.addEventListener('input', () => {
            this.setVolume(parseInt(volSlider.value) / 100);
        });
        const volLabel = document.createElement('div');
        volLabel.className = 'vol-label';
        volLabel.textContent = 'VOL';
        volArea.appendChild(volSlider);
        volArea.appendChild(volLabel);

        // Filter knob area
        const filterArea = document.createElement('div');
        filterArea.className = 'filter-area';
        const filterSlider = document.createElement('input');
        filterSlider.type = 'range';
        filterSlider.className = 'filter-slider';
        filterSlider.min = '-100';
        filterSlider.max = '100';
        filterSlider.value = '0';
        filterSlider.addEventListener('input', () => {
            this.setFilterPosition(parseInt(filterSlider.value) / 100);
        });
        // Snap back to center on release
        filterSlider.addEventListener('mouseup', () => {
            filterSlider.value = '0';
            this.setFilterPosition(0);
        });
        filterSlider.addEventListener('touchend', () => {
            filterSlider.value = '0';
            this.setFilterPosition(0);
        });
        const filterLabel = document.createElement('div');
        filterLabel.className = 'filter-label';
        filterLabel.textContent = 'FILTER';
        filterArea.appendChild(filterSlider);
        filterArea.appendChild(filterLabel);

        controls.appendChild(this.playBtn);
        controls.appendChild(stopBtn);
        controls.appendChild(bpmArea);
        controls.appendChild(volArea);
        controls.appendChild(filterArea);

        this.container.appendChild(controls);
    }

    // --- UI Updates ---

    _toggleCell(track, step) {
        const pat = this.pattern;
        pat[track][step] = pat[track][step] ? 0 : 1;
        this.cells[track][step].classList.toggle('active', !!pat[track][step]);
        this._updatePatternBank();
    }

    _renderGrid() {
        const pat = this.pattern;
        for (let t = 0; t < ROWS; t++) {
            for (let s = 0; s < COLS; s++) {
                if (this.cells[t] && this.cells[t][s]) {
                    this.cells[t][s].classList.toggle('active', !!pat[t][s]);
                }
            }
        }
    }

    _updatePlayheads(step) {
        for (let s = 0; s < COLS; s++) {
            const isActive = s === step;
            if (this.stepIndicators[s]) {
                this.stepIndicators[s].classList.toggle('active', isActive);
            }
            for (let t = 0; t < ROWS; t++) {
                if (this.cells[t] && this.cells[t][s]) {
                    this.cells[t][s].classList.toggle('playhead', isActive);
                }
            }
        }
    }

    _clearPlayheads() {
        for (let s = 0; s < COLS; s++) {
            if (this.stepIndicators[s]) {
                this.stepIndicators[s].classList.remove('active');
            }
            for (let t = 0; t < ROWS; t++) {
                if (this.cells[t] && this.cells[t][s]) {
                    this.cells[t][s].classList.remove('playhead');
                }
            }
        }
    }

    _updatePlayButton() {
        if (this.playBtn) {
            this.playBtn.classList.toggle('active', this.playing);
            this.playBtn.innerHTML = this.playing ? '&#10074;&#10074;' : '&#9654;';
        }
    }

    _updatePatternBank() {
        const pads = this.container.querySelectorAll('.pat-pad');
        pads.forEach((pad, i) => {
            pad.classList.toggle('active', i === this.currentPattern);
            pad.classList.toggle('has-data', this.hasData(i));
        });
    }

    // --- Cleanup ---

    dispose() {
        this.stop();
        this.instruments.forEach(inst => { if (inst) inst.dispose(); });
        this.filters.forEach(f => { if (f) f.dispose(); });
        this.gains.forEach(g => { if (g) g.dispose(); });
        if (this.deckGain) this.deckGain.dispose();
        if (this.deckFilter) this.deckFilter.dispose();
        if (this.deckHPF) this.deckHPF.dispose();
    }
}
