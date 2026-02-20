import { BEAT_TRACKS, BEEP_TRACKS, ROWS, COLS, MAX_PATTERNS, CHAIN_LENGTH, DEFAULT_BPM, MIN_BPM, MAX_BPM, SWING_LEVELS } from './constants.js';
import { DeckAudioEngine } from './audioEngine.js';
import { loadProjectFile, detectProjectType } from './storage.js';

/**
 * Deck - DJ deck that loads BEAT/BEEP projects and plays them.
 * Read-only grid display, pattern switching, chain playback, DJ FX.
 * Independent timing (no Tone.Transport).
 */
export class Deck {
    constructor(id, containerEl, outputNode) {
        this.id = id; // 'a' or 'b'
        this.container = containerEl;
        this.outputNode = outputNode;

        // Mode & state
        this.mode = null; // 'beat' or 'beep'
        this.projectState = null;
        this.loaded = false;

        // Audio
        this.engine = null;

        // Playback
        this.playing = false;
        this.bpm = DEFAULT_BPM;
        this.currentStep = 0;
        this.currentPattern = 0;
        this.queuedPattern = null;
        this.swingAmount = 0;

        // Chain
        this.chainMode = 'chain';
        this.chain = new Array(CHAIN_LENGTH).fill(null);
        this.chainIndex = 0;
        this.chainEnabled = false;

        // Loop
        this.djLoopEnabled = false;
        this.loopStart = 0;

        // Slow
        this.djSlowEnabled = false;
        this.originalBPM = DEFAULT_BPM;

        // Scheduler (independent per deck, no Tone.Transport)
        this.nextStepTime = 0;
        this.schedulerInterval = null;
        this.lookahead = 0.1;
        this.scheduleMs = 25;

        // UI references
        this.cells = [];
        this.stepDots = [];
        this.patPads = [];
        this.chainSlots = [];
        this.bpmDisplay = null;
        this.playBtn = null;
        this.modeLabel = null;
        this.titleLabel = null;

        this.buildUI();
    }

    get tracks() {
        return this.mode === 'beep' ? BEEP_TRACKS : BEAT_TRACKS;
    }

    get pattern() {
        if (!this.projectState) return null;
        return this.projectState.patterns[this.currentPattern];
    }

    // --- Project Loading ---

    async loadProject(file) {
        try {
            this.stop();

            // Detect type & load
            this.mode = detectProjectType(file);
            this.projectState = await loadProjectFile(file);

            // Apply project state
            this.bpm = this.projectState.bpm || DEFAULT_BPM;
            this.currentPattern = this.projectState.currentPattern || 0;
            this.swingAmount = SWING_LEVELS[this.projectState.swingLevel] || 0;
            this.chain = this.projectState.chain || new Array(CHAIN_LENGTH).fill(null);
            this.chainMode = this.projectState.chainMode || 'chain';
            this.chainEnabled = this.chain.some(v => v !== null);

            // Rebuild audio engine for new track config
            if (this.engine) {
                this.engine.dispose();
                this.engine = null;
            }
            this.engine = new DeckAudioEngine(this.tracks, this.outputNode);
            await this.engine.init();

            // Apply track params
            if (this.projectState.trackParams) {
                for (let t = 0; t < this.projectState.trackParams.length; t++) {
                    this.engine.updateTrackParams(t, this.projectState.trackParams[t]);
                }
            }

            // Apply mute/solo from current pattern
            const pat = this.pattern;
            if (pat) {
                for (let t = 0; t < ROWS; t++) {
                    if (pat.mutedTracks[t]) this.engine.setTrackMute(t, true);
                    if (pat.soloedTracks[t]) this.engine.setTrackSolo(t, true);
                }
            }

            this.loaded = true;
            this.rebuildGrid();
            this.renderGrid();
            this.updatePatternBank();
            this.updateChainDisplay();
            this.updateLabels();
            if (this.bpmDisplay) this.bpmDisplay.textContent = this.bpm;

        } catch (err) {
            console.error('Failed to load project:', err);
        }
    }

    // --- Audio Init ---

    async ensureEngine() {
        if (this.engine && this.engine.initialized) return;
        if (!this.mode) this.mode = 'beat';
        this.engine = new DeckAudioEngine(this.tracks, this.outputNode);
        await this.engine.init();
    }

    // --- Playback ---

    async play() {
        if (this.playing) return;
        if (!this.loaded) return;
        await this.ensureEngine();
        this.playing = true;
        this.currentStep = 0;
        this.nextStepTime = Tone.now() + 0.05;
        this.schedulerInterval = setInterval(() => this._schedule(), this.scheduleMs);
        this.updatePlayBtn();
    }

    stop() {
        if (!this.playing) return;
        this.playing = false;
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
        }
        this.currentStep = 0;
        this.clearPlayheads();
        this.updatePlayBtn();

        // Reset DJ effects
        if (this.djSlowEnabled) this.disableSlow();
        if (this.djLoopEnabled) this.disableLoop();
        if (this.engine) {
            this.engine.disableStutter();
            this.engine.disableCrush();
            this.engine.resetDJFilter();
            this.engine.setOctaveShift(0);
        }
    }

    togglePlay() {
        if (this.playing) this.stop();
        else this.play();
    }

    setBPM(bpm) {
        this.bpm = Math.max(MIN_BPM, Math.min(MAX_BPM, bpm));
        if (this.bpmDisplay) this.bpmDisplay.textContent = this.bpm;
    }

    _schedule() {
        const now = Tone.now();
        while (this.nextStepTime < now + this.lookahead) {
            this._onStep(this.currentStep, this.nextStepTime);

            // Step duration based on BPM
            const stepTime = 60.0 / this.bpm / 4;
            this.nextStepTime += stepTime;

            // Advance step
            if (this.djLoopEnabled) {
                const loopEnd = this.loopStart + 4;
                this.currentStep++;
                if (this.currentStep >= loopEnd) this.currentStep = this.loopStart;
            } else {
                this.currentStep = (this.currentStep + 1) % COLS;
                // Pattern end -> chain advance or pattern switch
                if (this.currentStep === 0) this._onPatternEnd();
            }
        }
    }

    _onStep(step, time) {
        const pat = this.pattern;
        if (!pat || !this.engine) return;

        // Swing adjustment
        let adjustedTime = time;
        if (this.swingAmount > 0 && step % 2 === 1) {
            const stepDur = 60.0 / this.bpm / 4;
            adjustedTime += stepDur * this.swingAmount;
        }

        // Trigger notes
        for (let track = 0; track < ROWS; track++) {
            const cell = pat.grid[track]?.[step];
            if (!cell || !cell.active) continue;

            const octaveShift = pat.trackOctaves?.[track] || 0;
            this.engine.triggerNote(
                track, cell.pitch, cell.duration, adjustedTime,
                cell.rollMode, cell.rollSubdivision, octaveShift, cell.velocity
            );
        }

        // Visual update
        const delay = Math.max(0, (adjustedTime - Tone.now()) * 1000);
        setTimeout(() => this.updatePlayheads(step), delay);
    }

    _onPatternEnd() {
        // Queued pattern switch
        if (this.queuedPattern !== null) {
            this.switchPattern(this.queuedPattern, true);
            this.queuedPattern = null;
            return;
        }

        // Chain advance
        if (this.chainEnabled && this.chainMode === 'chain') {
            const activeSlots = [];
            for (let i = 0; i < this.chain.length; i++) {
                if (this.chain[i] !== null) activeSlots.push(i);
            }
            if (activeSlots.length > 0) {
                let nextIdx = -1;
                for (let i = 0; i < activeSlots.length; i++) {
                    if (activeSlots[i] > this.chainIndex) { nextIdx = activeSlots[i]; break; }
                }
                if (nextIdx === -1) nextIdx = activeSlots[0];
                this.chainIndex = nextIdx;
                this.switchPattern(this.chain[nextIdx], true);
            }
        }
    }

    switchPattern(index, immediate) {
        if (index < 0 || index >= MAX_PATTERNS) return;
        if (this.playing && !immediate) {
            this.queuedPattern = index;
            this.updatePatternBank();
            return;
        }
        this.currentPattern = index;
        this.queuedPattern = null;

        // Apply mute/solo
        const pat = this.pattern;
        if (pat && this.engine) {
            for (let t = 0; t < ROWS; t++) {
                this.engine.setTrackMute(t, pat.mutedTracks?.[t] || false);
                this.engine.setTrackSolo(t, pat.soloedTracks?.[t] || false);
            }
        }

        this.renderGrid();
        this.updatePatternBank();
        this.updateChainDisplay();
    }

    // --- DJ Effects ---

    enableLoop() {
        if (this.djLoopEnabled) return;
        this.djLoopEnabled = true;
        this.loopStart = Math.floor(this.currentStep / 4) * 4;
    }
    disableLoop() { this.djLoopEnabled = false; }

    enableSlow() {
        if (this.djSlowEnabled) return;
        this.djSlowEnabled = true;
        this.originalBPM = this.bpm;
        const target = 30;
        const steps = 60;
        let i = 0;
        const stepInterval = setInterval(() => {
            i++;
            this.bpm = this.originalBPM + (target - this.originalBPM) * (i / steps);
            if (this.bpmDisplay) this.bpmDisplay.textContent = Math.round(this.bpm);
            if (i >= steps) clearInterval(stepInterval);
        }, 33);
        this._slowInterval = stepInterval;
    }
    disableSlow() {
        if (!this.djSlowEnabled) return;
        this.djSlowEnabled = false;
        if (this._slowInterval) clearInterval(this._slowInterval);
        this.bpm = this.originalBPM;
        if (this.bpmDisplay) this.bpmDisplay.textContent = Math.round(this.bpm);
    }

    // --- UI Building ---

    buildUI() {
        this.container.innerHTML = '';
        this.container.classList.add('deck', `deck-${this.id}`);

        // Header
        const header = document.createElement('div');
        header.className = 'deck-header';

        this.titleLabel = document.createElement('span');
        this.titleLabel.className = 'deck-label';
        this.titleLabel.textContent = `DECK ${this.id.toUpperCase()}`;

        this.modeLabel = document.createElement('span');
        this.modeLabel.className = 'mode-label';
        this.modeLabel.textContent = '---';

        const loadBtn = document.createElement('button');
        loadBtn.className = 'load-btn';
        loadBtn.textContent = 'LOAD';
        loadBtn.addEventListener('click', () => this._openFileDialog());

        header.appendChild(this.titleLabel);
        header.appendChild(this.modeLabel);
        header.appendChild(loadBtn);
        this.container.appendChild(header);

        // Pattern bank
        const bank = document.createElement('div');
        bank.className = 'pattern-bank';
        this.patPads = [];
        for (let i = 0; i < MAX_PATTERNS; i++) {
            const pad = document.createElement('button');
            pad.className = 'pat-pad';
            pad.textContent = i + 1;
            pad.addEventListener('click', () => this.switchPattern(i));
            this.patPads.push(pad);
            bank.appendChild(pad);
        }
        this.container.appendChild(bank);

        // Grid area (empty until project loaded)
        this.gridArea = document.createElement('div');
        this.gridArea.className = 'grid-area';
        this.gridArea.innerHTML = '<div class="empty-msg">LOAD PROJECT</div>';
        this.container.appendChild(this.gridArea);

        // Step indicators
        const stepsRow = document.createElement('div');
        stepsRow.className = 'step-indicators';
        this.stepDots = [];
        for (let s = 0; s < COLS; s++) {
            const dot = document.createElement('div');
            dot.className = 'step-dot';
            this.stepDots.push(dot);
            stepsRow.appendChild(dot);
        }
        this.container.appendChild(stepsRow);

        // Chain display
        this.chainContainer = document.createElement('div');
        this.chainContainer.className = 'chain-row hidden';
        this.chainSlots = [];
        for (let i = 0; i < CHAIN_LENGTH; i++) {
            const slot = document.createElement('div');
            slot.className = 'chain-slot';
            slot.addEventListener('click', () => {
                if (this.chain[i] !== null) this.switchPattern(this.chain[i]);
            });
            this.chainSlots.push(slot);
            this.chainContainer.appendChild(slot);
        }
        this.container.appendChild(this.chainContainer);

        // Controls row
        const controls = document.createElement('div');
        controls.className = 'deck-controls';

        this.playBtn = document.createElement('button');
        this.playBtn.className = 'deck-btn play-btn';
        this.playBtn.innerHTML = '&#9654;';
        this.playBtn.addEventListener('click', () => { if (this.loaded) this.togglePlay(); });

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
        this._setupBPMDrag(this.bpmDisplay);
        const bpmLbl = document.createElement('div');
        bpmLbl.className = 'ctrl-label';
        bpmLbl.textContent = 'BPM';
        bpmArea.appendChild(this.bpmDisplay);
        bpmArea.appendChild(bpmLbl);

        // Volume
        const volArea = document.createElement('div');
        volArea.className = 'slider-area';
        const volSlider = document.createElement('input');
        volSlider.type = 'range';
        volSlider.className = 'deck-slider';
        volSlider.min = '0';
        volSlider.max = '100';
        volSlider.value = '80';
        volSlider.addEventListener('input', () => {
            if (!this.engine) return;
            const vol = parseInt(volSlider.value) / 100;
            for (let t = 0; t < ROWS; t++) {
                const base = this.projectState?.trackParams?.[t]?.vol ?? 0.7;
                if (this.engine.gains[t]) this.engine.gains[t].gain.rampTo(base * vol, 0.05);
            }
        });
        const volLbl = document.createElement('div');
        volLbl.className = 'ctrl-label';
        volLbl.textContent = 'VOL';
        volArea.appendChild(volSlider);
        volArea.appendChild(volLbl);

        controls.appendChild(this.playBtn);
        controls.appendChild(stopBtn);
        controls.appendChild(bpmArea);
        controls.appendChild(volArea);
        this.container.appendChild(controls);

        // FX buttons
        const fxRow = document.createElement('div');
        fxRow.className = 'fx-row';
        const fxDefs = [
            { label: 'LOOP', on: () => this.enableLoop(), off: () => this.disableLoop() },
            { label: 'SLOW', on: () => this.enableSlow(), off: () => this.disableSlow() },
            { label: 'STUT', on: () => this.engine?.enableStutter(), off: () => this.engine?.disableStutter() },
            { label: 'CRSH', on: () => this.engine?.enableCrush(), off: () => this.engine?.disableCrush() },
        ];
        fxDefs.forEach(fx => {
            const btn = document.createElement('button');
            btn.className = 'fx-btn';
            btn.textContent = fx.label;
            let active = false;
            const on = (e) => { e.preventDefault(); if (!this.playing || !this.engine) return; active = true; btn.classList.add('active'); fx.on(); };
            const off = (e) => { e.preventDefault(); if (!active) return; active = false; btn.classList.remove('active'); fx.off(); };
            btn.addEventListener('mousedown', on);
            btn.addEventListener('mouseup', off);
            btn.addEventListener('mouseleave', off);
            btn.addEventListener('touchstart', on, { passive: false });
            btn.addEventListener('touchend', off, { passive: false });
            btn.addEventListener('touchcancel', off, { passive: false });
            fxRow.appendChild(btn);
        });
        this.container.appendChild(fxRow);

        // Filter slider
        const filterArea = document.createElement('div');
        filterArea.className = 'slider-area';
        const filterSlider = document.createElement('input');
        filterSlider.type = 'range';
        filterSlider.className = 'deck-slider filter-slider';
        filterSlider.min = '-100';
        filterSlider.max = '100';
        filterSlider.value = '0';
        filterSlider.addEventListener('input', () => {
            if (!this.engine) return;
            const pos = parseInt(filterSlider.value) / 100;
            if (Math.abs(pos) < 0.05) {
                this.engine.resetDJFilter();
            } else if (pos > 0) {
                const lpf = 20000 * Math.pow(0.01, pos);
                this.engine.setDJFilter(Math.max(200, lpf), 20, 1 + pos * 12, pos * 0.4);
            } else {
                const absPos = Math.abs(pos);
                const hpf = 20 * Math.pow(300, absPos);
                this.engine.setDJFilter(20000, Math.min(6000, hpf), 1 + absPos * 12, absPos * 0.3);
            }
        });
        const snapBack = () => { filterSlider.value = '0'; if (this.engine) this.engine.resetDJFilter(); };
        filterSlider.addEventListener('mouseup', snapBack);
        filterSlider.addEventListener('touchend', snapBack);
        const filterLbl = document.createElement('div');
        filterLbl.className = 'ctrl-label';
        filterLbl.textContent = 'FILTER';
        filterArea.appendChild(filterSlider);
        filterArea.appendChild(filterLbl);
        this.container.appendChild(filterArea);
    }

    rebuildGrid() {
        this.gridArea.innerHTML = '';
        const labels = document.createElement('div');
        labels.className = 'track-labels';
        const tracks = this.tracks;
        for (let t = 0; t < ROWS; t++) {
            const lbl = document.createElement('div');
            lbl.className = 'track-label';
            lbl.textContent = tracks[t].short;
            lbl.style.color = tracks[t].color;
            labels.appendChild(lbl);
        }

        const grid = document.createElement('div');
        grid.className = 'grid';
        this.cells = [];
        for (let t = 0; t < ROWS; t++) {
            this.cells[t] = [];
            for (let s = 0; s < COLS; s++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.track = t;
                cell.dataset.step = s;
                this.cells[t][s] = cell;
                grid.appendChild(cell);
            }
        }

        this.gridArea.appendChild(labels);
        this.gridArea.appendChild(grid);
    }

    // --- UI Updates ---

    renderGrid() {
        const pat = this.pattern;
        if (!pat) return;
        for (let t = 0; t < ROWS; t++) {
            for (let s = 0; s < COLS; s++) {
                const cell = this.cells[t]?.[s];
                if (!cell) continue;
                const isActive = pat.grid[t]?.[s]?.active;
                cell.classList.toggle('active', !!isActive);
                const vel = pat.grid[t]?.[s]?.velocity;
                cell.classList.toggle('weak', isActive && vel !== undefined && vel < 1.0);
            }
        }
    }

    updatePlayheads(step) {
        for (let s = 0; s < COLS; s++) {
            const isHere = s === step;
            this.stepDots[s]?.classList.toggle('active', isHere);
            for (let t = 0; t < ROWS; t++) {
                this.cells[t]?.[s]?.classList.toggle('playhead', isHere);
            }
        }
    }

    clearPlayheads() {
        for (let s = 0; s < COLS; s++) {
            this.stepDots[s]?.classList.remove('active');
            for (let t = 0; t < ROWS; t++) {
                this.cells[t]?.[s]?.classList.remove('playhead');
            }
        }
    }

    updatePlayBtn() {
        if (!this.playBtn) return;
        this.playBtn.classList.toggle('active', this.playing);
        this.playBtn.innerHTML = this.playing ? '&#10074;&#10074;' : '&#9654;';
    }

    updatePatternBank() {
        for (let i = 0; i < MAX_PATTERNS; i++) {
            const pad = this.patPads[i];
            if (!pad) continue;
            pad.classList.toggle('active', i === this.currentPattern);
            pad.classList.toggle('queued', i === this.queuedPattern);
            const pat = this.projectState?.patterns?.[i];
            const hasData = pat?.grid?.some(row => row.some(c => c.active));
            pad.classList.toggle('has-data', !!hasData);
        }
    }

    updateChainDisplay() {
        for (let i = 0; i < CHAIN_LENGTH; i++) {
            const slot = this.chainSlots[i];
            if (!slot) continue;
            const val = this.chain[i];
            if (val !== null && val !== undefined) {
                slot.textContent = val + 1;
                slot.classList.add('filled');
            } else {
                slot.textContent = '';
                slot.classList.remove('filled');
            }
            slot.classList.toggle('playing', this.chainEnabled && i === this.chainIndex && this.playing);
        }
        this.chainContainer.classList.toggle('hidden', !this.chainEnabled);
    }

    updateLabels() {
        if (this.modeLabel) {
            this.modeLabel.textContent = this.mode ? this.mode.toUpperCase() : '---';
            this.modeLabel.classList.toggle('beat', this.mode === 'beat');
            this.modeLabel.classList.toggle('beep', this.mode === 'beep');
        }
    }

    _openFileDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.loadProject(file);
        });
        input.click();
    }

    _setupBPMDrag(el) {
        let dragging = false, startY = 0, startVal = 0;
        const start = (y) => { dragging = true; startY = y; startVal = this.bpm; };
        const move = (y) => { if (dragging) this.setBPM(startVal + Math.round((startY - y) / 3)); };
        const end = () => { dragging = false; };
        el.addEventListener('mousedown', (e) => start(e.clientY));
        document.addEventListener('mousemove', (e) => move(e.clientY));
        document.addEventListener('mouseup', end);
        el.addEventListener('touchstart', (e) => start(e.touches[0].clientY), { passive: true });
        document.addEventListener('touchmove', (e) => { if (dragging) move(e.touches[0].clientY); }, { passive: true });
        document.addEventListener('touchend', end);
    }

    dispose() {
        this.stop();
        if (this.engine) this.engine.dispose();
    }
}
