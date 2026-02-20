import { ROWS, COLS, TAP_THRESHOLD, TRACKS, KNOB_PARAMS, DEFAULT_BPM, DEFAULT_SCALE, DEFAULT_SWING_LEVEL, DEFAULT_OCTAVE, MAX_PATTERNS, PATTERN_NAMES, CHAIN_LENGTH, TRACK_PRESETS } from './modules/constants.js';
import { AudioEngine } from './modules/audioEngine.js';
import { Cell } from './modules/cell.js';
import { Controls } from './modules/controls.js';
import { TonePanel } from './modules/tonePanel.js';
import { loadState, saveState, createDefaultState, createDefaultPattern, getCurrentPattern, exportProject, importProject } from './modules/storage.js';
import { PatternBank } from './modules/patternBank.js';
import { Chain } from './modules/chain.js';
import { DJMode } from './modules/djMode.js';

class Sequencer {
    constructor() {
        this.state = loadState();

        this.audioEngine = new AudioEngine();

        // Preset audio settings
        const pat = getCurrentPattern(this.state);
        const volumes = this.state.trackParams ? this.state.trackParams.map(p => p.vol) : undefined;
        this.audioEngine.presetSettings({
            trackVolumes: volumes,
            mutedTracks: pat.mutedTracks,
            soloedTracks: pat.soloedTracks
        });

        this.cells = [];
        this.isPainting = false;
        this.paintingTrack = null;
        this.isTwoFingerTouch = false;

        // Dance animation
        this.danceFrame = 0;
        this.dancer = null;

        // Modules
        this.patternBank = new PatternBank(this);
        this.chain = new Chain(this);
        this.djMode = new DJMode(this);

        this.init();
    }

    // --- Helper: get current pattern ---
    get pattern() {
        return getCurrentPattern(this.state);
    }

    init() {
        this.createGrid();

        this.controls = new Controls(
            this.audioEngine,
            (bpm) => {
                this.state.bpm = bpm;
                this.updateVisualizerSpeed(bpm);
                saveState(this.state);
            },
            (swingLevel) => {
                this.state.swingLevel = swingLevel;
                saveState(this.state);
            },

            () => {
                // onClear - removed (CLR button eliminated)
            },
            () => {
                // onPlay
                if (this.dancer) {
                    this.dancer.classList.add('playing');
                    this.dancer.classList.remove('paused');
                }
                // Start chain from first filled slot
                if (this.chain.isActive() && this.chain.chainPosition === -1 && this.state.chainMode === 'chain') {
                    this.chain.chainPosition = this.chain.getFirstPosition();
                    const targetPattern = this.state.chain[this.chain.chainPosition];
                    if (targetPattern !== this.state.currentPattern) {
                        this.state.currentPattern = targetPattern;
                        const gridContainer = document.getElementById('grid-container');
                        if (gridContainer) gridContainer.innerHTML = '';
                        this.createGrid();
                        this.syncAudioWithState();

                        this.controls.setBPM(this.state.bpm);
                        this.controls.setSwing(this.state.swingLevel);
                        this.controls.setScale(this.pattern.scale);
                        this.setupTrackControls();
                        this.patternBank.updateUI();
                    }
                    this.chain.updateUI();
                }
            },
            () => {
                this.clearPlayheads();
                if (this.dancer) {
                    this.dancer.classList.remove('playing');
                }
            },
            (repeatEnabled) => { // onRepeatToggle
                this.state.repeatEnabled = repeatEnabled;
                saveState(this.state);
            },
            (scaleName) => { // onScaleChange
                this.pattern.scale = scaleName;
                // Update all cell visuals to reflect new scale
                for (let track = 0; track < ROWS; track++) {
                    for (let step = 0; step < COLS; step++) {
                        if (this.cells[track] && this.cells[track][step]) {
                            this.cells[track][step].updateVisuals();
                        }
                    }
                }
                saveState(this.state);
            },
            (scaleName) => { // onScaleApplyAll
                this.state.patterns.forEach(pat => {
                    if (pat) pat.scale = scaleName;
                });

                // Update visuals for active cells in current view
                for (let track = 0; track < ROWS; track++) {
                    for (let step = 0; step < COLS; step++) {
                        if (this.cells[track] && this.cells[track][step]) {
                            this.cells[track][step].updateVisuals();
                        }
                    }
                }
                saveState(this.state);
            },
            () => { // onInit (called when audioEngine is first initialized)
                this.syncAudioWithState();
            }
        );
        this.controls.onPause = () => {
            if (this.dancer) {
                this.dancer.classList.add('paused');
            }
        };
        this.controls.onVolumeChange = (vol) => {
            this.state.masterVolume = vol;
            this.audioEngine.setMasterVolume(vol);
            saveState(this.state);
        };

        this.controls.setBPM(this.state.bpm);
        this.controls.setSwing(this.state.swingLevel || 'OFF');
        this.controls.setRepeat(this.state.repeatEnabled !== false);
        this.controls.setVolume(this.state.masterVolume || -12);
        this.controls.setScale(this.pattern.scale || 'Chromatic');

        const tonePanelEl = document.getElementById('tone-panel');
        if (tonePanelEl) {
            this.tonePanel = new TonePanel(
                tonePanelEl,
                this.audioEngine,
                // onParamsChange
                (track, param, value) => {
                    this.state.trackParams[track][param] = value;

                    // Auto-save to active preset if exists
                    const activePreset = this.state.trackActivePresets ? this.state.trackActivePresets[track] : null;
                    if (activePreset) {
                        if (!this.state.userPresets[track]) this.state.userPresets[track] = {};
                        if (!this.state.userPresets[track][activePreset]) this.state.userPresets[track][activePreset] = {};
                        this.state.userPresets[track][activePreset][param] = value;
                    }
                    saveState(this.state);
                },
                // onPresetSelect
                (track, presetName) => {
                    this.state.trackActivePresets[track] = presetName;

                    if (presetName) {
                        // Load params: User modified > Factory default
                        let params = null;

                        // Check User Presets first
                        if (this.state.userPresets[track] && this.state.userPresets[track][presetName]) {
                            const factory = TRACK_PRESETS[track][presetName];
                            const user = this.state.userPresets[track][presetName];
                            params = Object.assign({}, factory, user);
                        } else {
                            // Factory only
                            params = Object.assign({}, TRACK_PRESETS[track][presetName]);
                        }

                        if (params) {
                            this.state.trackParams[track] = params;
                            this.audioEngine.updateTrackParams(track, params);
                            return params;
                        }
                    }
                    saveState(this.state);
                    return null;
                },
                // getActivePreset
                (track) => this.state.trackActivePresets ? this.state.trackActivePresets[track] : null,
                // onResetPreset
                (track) => {
                    const activePreset = this.state.trackActivePresets ? this.state.trackActivePresets[track] : null;
                    if (activePreset) {
                        // Clear user preset override
                        if (this.state.userPresets[track] && this.state.userPresets[track][activePreset]) {
                            delete this.state.userPresets[track][activePreset];
                        }
                        // Return original factory params
                        const params = Object.assign({}, TRACK_PRESETS[track][activePreset]);
                        this.state.trackParams[track] = params;
                        this.audioEngine.updateTrackParams(track, params);
                        saveState(this.state);
                        return params;
                    } else {
                        // No preset active, reset to track default
                        const defaults = TRACKS[track].defaultParams || {};
                        const params = {};
                        Object.keys(defaults).forEach(k => params[k] = defaults[k]);
                        // Fill missing with KNOB defaults
                        Object.keys(KNOB_PARAMS).forEach(k => {
                            if (params[k] === undefined) params[k] = KNOB_PARAMS[k].default;
                        });

                        this.state.trackParams[track] = params;
                        this.audioEngine.updateTrackParams(track, params);
                        saveState(this.state);
                        return params;
                    }
                }
            );
        }

        this.initRollMenu();
        this.initTrackMenu();
        this.initChainMenu();
        this.initMenuCloseHandler();

        this.setupTrackIcons();
        this.setupTrackControls();

        this.audioEngine.setStepCallback((step, time) => {
            this.onStep(step, time);
        });

        this.audioEngine.setStopCallback(async () => {
            // Stop recording if active
            if (this.audioEngine.isRecording) {
                await this.audioEngine.stopRecording();
                if (this.controls) {
                    this.controls.isRecordingArmed = false;
                    if (this.controls.recBtn) {
                        this.controls.recBtn.classList.remove('recording');
                        this.controls.recBtn.classList.remove('armed');
                    }
                }
            }

            if (this.controls) {
                this.controls.resetUI();
            }
            this.resetDanceAnimation();
            this.djMode.close(true);

            // Clear next pattern queue and chain position on stop
            this.state.nextPattern = null;
            this.chain.chainPosition = -1;
            this.patternBank.updateUI();
            this.chain.updateUI();
        });

        // Initialize dance animation
        this.dancer = document.getElementById('visualizer-display');
        if (this.dancer) {
            this.danceFrame = 0;
        }

        // Initialize modules
        this.djMode.init();
        this.patternBank.init();
        this.chain.init();

        // Global two-finger detection for pan scrolling
        window.addEventListener('touchstart', (e) => {
            if (e.touches.length >= 2) {
                this.isTwoFingerTouch = true;
                this.isPainting = false;
            }
        }, { passive: true });

        window.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                this.isTwoFingerTouch = false;
            }
            if (e.touches.length === 0) {
                this.isPainting = false;
            }
        }, { passive: true });

        // Global mouseup/touchend to stop painting
        window.addEventListener('mouseup', () => {
            this.isPainting = false;
        });

        // Touch painting support
        window.addEventListener('touchmove', (e) => {
            if (e.touches.length >= 2) {
                this.isTwoFingerTouch = true;
                this.isPainting = false;
                return;
            }

            if (this.isPainting && e.touches.length === 1) {
                e.preventDefault();
                const touch = e.touches[0];
                const element = document.elementFromPoint(touch.clientX, touch.clientY);
                if (element && element.classList.contains('cell')) {
                    const track = parseInt(element.dataset.track);
                    const step = parseInt(element.dataset.step);

                    if (!isNaN(track) && !isNaN(step)) {
                        if (this.paintingTrack === null || this.paintingTrack === track) {
                            this.cells[track][step].paintActivate();
                        }
                    }
                }
            }
        }, { passive: false });

        // Keyboard: number keys 1-8 for pattern switch
        document.addEventListener('keydown', (e) => {
            const num = parseInt(e.key);
            if (num >= 1 && num <= MAX_PATTERNS) {
                this.patternBank.onPadTap(num - 1);
            }
        });

        this.initCreditModal();
        this.setupFileUI();
    }

    // ========================
    // File UI
    // ========================

    setupFileUI() {
        const fileBtn = document.getElementById('file-btn');
        const fileMenu = document.getElementById('file-menu');
        const newBtn = document.getElementById('new-btn');
        const saveBtn = document.getElementById('save-btn');
        const loadBtn = document.getElementById('load-btn');
        const fileInput = document.getElementById('file-input');

        if (!fileBtn || !fileMenu) return;

        fileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = fileBtn.getBoundingClientRect();
            fileMenu.style.position = 'fixed';
            fileMenu.style.bottom = (window.innerHeight - rect.top + 5) + 'px';
            fileMenu.style.left = (rect.left - 20) + 'px';
            fileMenu.style.top = 'auto';
            fileMenu.style.zIndex = '2500';
            fileMenu.classList.toggle('hidden');

            // Close clear menu if open
            if (this.clearMenuElement && !this.clearMenuElement.classList.contains('hidden')) {
                this.clearMenuElement.classList.add('hidden');
            }
        });

        document.addEventListener('click', (e) => {
            if (!fileMenu.contains(e.target) && !fileBtn.contains(e.target)) {
                fileMenu.classList.add('hidden');
            }
        });

        newBtn.addEventListener('click', () => {
            if (confirm('Create new project? All patterns will be lost.')) {
                this.state = createDefaultState();
                this.audioEngine.stop();
                this.restoreState();
                this.patternBank.updateUI();
                this.chain.chainPosition = -1;
                this.chain.updateUI();
                saveState(this.state);
                fileMenu.classList.add('hidden');
            }
        });

        saveBtn.addEventListener('click', () => {
            exportProject(this.state);
            fileMenu.classList.add('hidden');
        });

        loadBtn.addEventListener('click', () => {
            fileInput.click();
            fileMenu.classList.add('hidden');
        });

        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                try {
                    const newState = await importProject(file);
                    this.state = newState;
                    this.audioEngine.stop();
                    this.restoreState();
                    this.patternBank.updateUI();
                    this.chain.chainPosition = -1;
                    this.chain.updateUI();
                    fileInput.value = '';
                } catch (err) {
                    alert('Failed to load project.');
                }
            }
        });
    }

    // ========================
    // State restore / sync
    // ========================

    restoreState() {
        const pat = this.pattern;

        // 1. Controls UI
        this.controls.setBPM(this.state.bpm); // Global
        this.controls.setSwing(this.state.swingLevel); // Global
        this.controls.setRepeat(this.state.repeatEnabled !== false);
        this.controls.setVolume(this.state.masterVolume);
        this.controls.setScale(pat.scale); // Local

        // 2. Audio Engine
        if (this.audioEngine.initialized) {
            this.syncAudioWithState();
        }

        // 3. Update UI Grid
        const gridContainer = document.getElementById('grid-container');
        if (gridContainer) gridContainer.innerHTML = '';
        this.createGrid();

        // 4. Update Track Controls UI (Mute/Solo buttons)
        this.setupTrackControls();
    }

    syncAudioWithState() {
        if (!this.audioEngine.initialized) return;

        const pat = this.pattern;

        // Global Params
        this.audioEngine.setBPM(this.state.bpm);
        this.audioEngine.setMasterVolume(this.state.masterVolume);
        this.audioEngine.setSwingLevel(this.state.swingLevel); // Global

        // Track Params (Global)
        for (let i = 0; i < ROWS; i++) {
            const params = this.state.trackParams[i];
            this.audioEngine.updateTrackParams(i, params);

            // Mute/Solo (Local)
            const isMuted = pat.mutedTracks ? pat.mutedTracks[i] : false;
            const isSoloed = pat.soloedTracks ? pat.soloedTracks[i] : false;

            this.audioEngine.setTrackMute(i, isMuted);
            this.audioEngine.setTrackSolo(i, isSoloed);
        }

        this.audioEngine.updateTrackGains(true);

        if (this.state.bpm) {
            this.updateVisualizerSpeed(this.state.bpm);
        }
    }

    // ========================
    // Credit modal
    // ========================

    initCreditModal() {
        const creditBtn = document.getElementById('credit-btn');
        const creditModal = document.getElementById('credit-modal');
        const creditContent = document.getElementById('credit-content');

        if (creditBtn && creditModal) {
            creditBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                creditModal.classList.add('visible');
            });

            creditModal.addEventListener('click', () => {
                creditModal.classList.remove('visible');
            });

            if (creditContent) {
                creditContent.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
        }
    }

    // ========================
    // Clear (called from File > New or other places)
    // ========================

    resetAll() {
        this.audioEngine.stop();
        this.state = createDefaultState();
        this.restoreState();
        this.patternBank.updateUI();
        this.chain.updateUI();
        saveState(this.state);

        if (this.tonePanel && this.tonePanel.isOpen()) {
            this.tonePanel.close();
        }
    }

    // ========================
    // Roll menu
    // ========================

    initRollMenu() {
        this.rollMenuElement = document.getElementById('roll-menu');
        this.currentRollCell = null;

        document.addEventListener('mousedown', (e) => {
            if (!this.rollMenuElement.contains(e.target)) {
                this.rollMenuElement.classList.add('hidden');
            }
        });

        this.rollMenuElement.querySelectorAll('.roll-option').forEach(option => {
            option.addEventListener('click', () => {
                if (this.currentRollCell) {
                    const sub = parseInt(option.dataset.roll);
                    this.currentRollCell.setRollSubdivision(sub);
                    this.rollMenuElement.classList.add('hidden');
                }
            });
        });
    }

    showRollMenu(cell, x, y) {
        this.currentRollCell = cell;

        const currentSub = cell.data.rollMode ? cell.data.rollSubdivision : 1;
        this.rollMenuElement.querySelectorAll('.roll-option').forEach(opt => {
            opt.classList.toggle('active', parseInt(opt.dataset.roll) === currentSub);
        });

        this.rollMenuElement.classList.remove('hidden');

        const menuRect = this.rollMenuElement.getBoundingClientRect();
        this.rollMenuElement.style.left = `${x - menuRect.width / 2}px`;
        this.rollMenuElement.style.top = `${y - menuRect.height - 10}px`;
    }

    // ========================
    // Grid
    // ========================

    createGrid() {
        const gridContainer = document.getElementById('grid-container');
        const pat = this.pattern;

        for (let track = 0; track < ROWS; track++) {
            const trackConfig = TRACKS[track];
            this.cells[track] = [];
            for (let step = 0; step < COLS; step++) {
                const cellElement = document.createElement('div');
                cellElement.className = 'cell';
                cellElement.dataset.track = track;
                cellElement.dataset.step = step;

                const cellData = pat.grid[track][step];
                if (cellData.active) {
                    cellElement.classList.add('active');
                }
                if (cellData.rollMode) {
                    cellElement.classList.add('roll');
                }

                const cell = new Cell(
                    cellElement,
                    track,
                    step,
                    cellData,
                    async (t, s, d, shouldPlay) => {
                        saveState(this.state);
                        if (shouldPlay) {
                            if (!this.audioEngine.initialized) {
                                await this.audioEngine.init();
                                this.syncAudioWithState();
                            }
                            const cellInstance = this.cells[t][s];
                            this.audioEngine.triggerNote(
                                t,
                                cellInstance.getEffectivePitch(),
                                d.duration,
                                Tone.now() + 0.05,
                                d.rollMode,
                                d.rollSubdivision,
                                pat.trackOctaves[t],
                                d.velocity
                            );
                        }
                    },
                    (c, x, y) => {
                        this.showRollMenu(c, x, y);
                    },
                    (isStart, trackId) => {
                        if (isStart) {
                            this.isPainting = true;
                            this.paintingTrack = trackId;
                        } else {
                            this.isPainting = false;
                            this.paintingTrack = null;
                        }
                    },
                    () => this.isPainting,
                    trackConfig.baseFreq,
                    document.getElementById('note-indicator'),
                    () => this.isTwoFingerTouch,
                    () => pat.scale || 'Chromatic'
                );

                this.cells[track][step] = cell;
                gridContainer.appendChild(cellElement);
            }
        }

        // Recalculate cell visuals when the grid resizes (orientation change, responsive layout).
        // Width-based sizing stores absolute px values, so a fresh updateVisuals() is needed
        // after the grid's column width changes.
        if (this._gridResizeObserver) this._gridResizeObserver.disconnect();
        this._gridResizeObserver = new ResizeObserver(() => {
            this.cells.forEach(trackCells => {
                if (trackCells) trackCells.forEach(cell => cell && cell.updateVisuals());
            });
        });
        this._gridResizeObserver.observe(gridContainer);
    }

    setupTrackIcons() {
        this.trackIcons = document.querySelectorAll('.track-icon');

        const tapState = [];
        for (let i = 0; i < TRACKS.length; i++) {
            tapState[i] = { count: 0, lastTapTime: 0, timer: null, longPressTimer: null, didLongPress: false, isTouch: false };
        }

        this.trackIcons.forEach((icon, track) => {
            const state = tapState[track];

            // Long-press to show track context menu
            const startLongPress = () => {
                state.didLongPress = false;
                state.longPressTimer = setTimeout(() => {
                    state.didLongPress = true;
                    this.showTrackMenu(track, icon);
                }, 500);
            };
            const cancelLongPress = () => {
                clearTimeout(state.longPressTimer);
            };

            icon.addEventListener('mousedown', () => { if (!state.isTouch) startLongPress(); });
            icon.addEventListener('mouseup', () => { if (!state.isTouch) cancelLongPress(); });
            icon.addEventListener('mouseleave', cancelLongPress);
            icon.addEventListener('touchstart', () => { state.isTouch = true; startLongPress(); }, { passive: true });
            icon.addEventListener('touchend', () => { cancelLongPress(); setTimeout(() => { state.isTouch = false; }, 300); });
            icon.addEventListener('touchmove', cancelLongPress, { passive: true });

            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (state.didLongPress) {
                    state.didLongPress = false;
                    return;
                }

                const now = Date.now();
                const timeSinceLastTap = now - state.lastTapTime;

                if (timeSinceLastTap < TAP_THRESHOLD) {
                    state.count++;
                } else {
                    state.count = 1;
                }

                state.lastTapTime = now;
                clearTimeout(state.timer);

                state.timer = setTimeout(() => {
                    if (state.count === 1) {
                        this.tonePanel.toggle(track, this.state.trackParams[track]);
                    }
                    state.count = 0;
                }, TAP_THRESHOLD);
            });
        });
    }

    // ========================
    // Track Context Menu
    // ========================

    initTrackMenu() {
        this.trackMenu = document.getElementById('track-menu');
        this.trackMenuTarget = null;
        this.trackCopyBuffer = null;

        if (!this.trackMenu) return;

        document.getElementById('track-copy').addEventListener('click', () => {
            this.copyTrack(this.trackMenuTarget);
            this.trackMenu.classList.add('hidden');
        });

        document.getElementById('track-paste').addEventListener('click', () => {
            this.pasteTrack(this.trackMenuTarget);
            this.trackMenu.classList.add('hidden');
        });

        document.getElementById('track-clear').addEventListener('click', () => {
            this.clearTrack(this.trackMenuTarget);
            this.trackMenu.classList.add('hidden');
        });
    }

    showTrackMenu(trackIndex, iconElement) {
        this.trackMenuTarget = trackIndex;
        if (!this.trackMenu) return;

        this.hideAllMenus();
        // this._suppressClick = true; // Removed

        const pasteBtn = document.getElementById('track-paste');
        if (pasteBtn) {
            pasteBtn.classList.toggle('disabled', !this.trackCopyBuffer);
        }

        const rect = iconElement.getBoundingClientRect();
        this.trackMenu.style.left = `${rect.right + 4}px`;
        this.trackMenu.style.top = `${rect.top}px`;
        this.trackMenu.classList.remove('hidden');
    }

    copyTrack(trackIndex) {
        const pat = this.pattern;
        this.trackCopyBuffer = [];
        for (let step = 0; step < COLS; step++) {
            this.trackCopyBuffer.push(JSON.parse(JSON.stringify(pat.grid[trackIndex][step])));
        }
    }

    pasteTrack(trackIndex) {
        if (!this.trackCopyBuffer) return;
        const pat = this.pattern;
        for (let step = 0; step < COLS; step++) {
            Object.assign(pat.grid[trackIndex][step], JSON.parse(JSON.stringify(this.trackCopyBuffer[step])));
            const el = this.cells[trackIndex][step].element;
            el.classList.toggle('active', pat.grid[trackIndex][step].active);
            el.classList.toggle('roll', pat.grid[trackIndex][step].rollMode);
            this.cells[trackIndex][step].updateVisuals();
        }
        saveState(this.state);
        this.patternBank.updateUI();
    }

    // ========================
    // Chain Context Menu
    // ========================

    initChainMenu() {
        this.chainMenu = document.getElementById('chain-menu');
        if (!this.chainMenu) return;

        const clearSlotBtn = document.getElementById('chain-clear-slot');
        const clearAllBtn = document.getElementById('chain-clear-all');

        if (clearSlotBtn) {
            clearSlotBtn.addEventListener('click', () => {
                const target = this.chain._chainMenuTarget;
                if (target !== null) {
                    this.chain.onSlotClear(target);
                }
                this.chainMenu.classList.add('hidden');
            });
        }

        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.state.chain = new Array(CHAIN_LENGTH).fill(null);
                this.chain.chainPosition = -1;
                saveState(this.state);
                this.chain.updateUI();
                this.chainMenu.classList.add('hidden');
            });
        }
    }

    // ========================
    // Menu Helpers
    // ========================

    hideAllMenus() {
        document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
        document.querySelectorAll('.popup-menu').forEach(m => m.classList.add('hidden'));
    }

    initMenuCloseHandler() {
        document.addEventListener('click', (e) => {
            // Close any open context menus on outside click
            document.querySelectorAll('.context-menu:not(.hidden)').forEach(menu => {
                if (!menu.contains(e.target)) {
                    menu.classList.add('hidden');
                }
            });
        });
    }


    clearCurrentPattern() {
        if (this.controls) {
            this.controls.stop();
        }

        this.state.patterns[this.state.currentPattern] = createDefaultPattern();
        this.restoreState();

        document.querySelectorAll('.mute-btn, .solo-btn').forEach(btn => btn.classList.remove('active'));
        for (let i = 0; i < ROWS; i++) {
            this.audioEngine.setTrackMute(i, false);
            this.audioEngine.setTrackSolo(i, false);
        }

        saveState(this.state);
        this.patternBank.updateUI();

        if (this.tonePanel && this.tonePanel.isOpen()) {
            this.tonePanel.close();
        }
    }

    clearTrack(trackIndex) {
        const pat = this.pattern;
        for (let step = 0; step < COLS; step++) {
            pat.grid[trackIndex][step].active = false;
            pat.grid[trackIndex][step].pitch = 0;
            pat.grid[trackIndex][step].duration = 0.5;
            pat.grid[trackIndex][step].rollMode = false;
            pat.grid[trackIndex][step].rollSubdivision = 4;
            this.cells[trackIndex][step].element.classList.remove('active', 'roll');
            this.cells[trackIndex][step].updateVisuals();
        }
        saveState(this.state);
        this.patternBank.updateUI();

        // Flash feedback
        const icon = this.trackIcons[trackIndex];
        if (icon) {
            icon.classList.add('cleared');
            setTimeout(() => icon.classList.remove('cleared'), 300);
        }
    }

    clearPlayheads() {
        for (let track = 0; track < ROWS; track++) {
            for (let step = 0; step < COLS; step++) {
                this.cells[track][step].setPlayhead(false);
            }
        }
    }

    // ========================
    // Instant pattern switch (LIVE mode)
    // ========================

    instantSwitch(patternIndex) {
        if (patternIndex < 0 || patternIndex >= MAX_PATTERNS) return;
        if (patternIndex === this.state.currentPattern) return;

        this.state.currentPattern = patternIndex;
        this.state.nextPattern = null;

        // Reset step position to 0 for instant restart
        this.audioEngine.currentStep = 0;

        // Rebuild grid
        const gridContainer = document.getElementById('grid-container');
        if (gridContainer) gridContainer.innerHTML = '';
        this.createGrid();

        this.syncAudioWithState();
        this.controls.setSwing(this.state.swingLevel);
        this.controls.setScale(this.pattern.scale);
        this.setupTrackControls();

        this.clearPlayheads();

        saveState(this.state);
        this.patternBank.updateUI();
    }

    triggerTrackPulse(trackIndex) {
        const icon = this.trackIcons[trackIndex];
        if (icon) {
            icon.classList.remove('playing');
            void icon.offsetWidth;
            icon.classList.add('playing');
        }
    }

    // ========================
    // Step callback (core sequencer)
    // ========================

    onStep(step, time) {
        const pat = this.pattern;

        // Update playhead visuals
        for (let track = 0; track < ROWS; track++) {
            for (let s = 0; s < COLS; s++) {
                this.cells[track][s].setPlayhead(s === step);
            }

            // Trigger notes for active cells
            const cell = this.cells[track][step];
            if (cell.data.active) {
                cell.triggerPulse();

                const isAnySolo = pat.soloedTracks && pat.soloedTracks.some(s => s);
                const isSoloed = pat.soloedTracks && pat.soloedTracks[track];
                const isMuted = pat.mutedTracks && pat.mutedTracks[track];

                let shouldPulse = true;
                if (isAnySolo) {
                    shouldPulse = isSoloed;
                } else {
                    shouldPulse = !isMuted;
                }

                if (shouldPulse) {
                    this.triggerTrackPulse(track);
                    // Kick ripple in DJ mode
                    if (track === 0) {
                        const vol = this.state.trackParams?.[0]?.vol ?? 0.7;
                        this.djMode.addRipple(vol);
                    }
                }

                this.audioEngine.triggerNote(
                    track,
                    cell.getEffectivePitch(),
                    cell.data.duration,
                    time,
                    cell.data.rollMode,
                    cell.data.rollSubdivision,
                    pat.trackOctaves[track],
                    cell.data.velocity
                );
            }
        }

        // At end of bar: chain advance, queued pattern switch, or one-shot stop
        if (step === COLS - 1) {
            if (this.chain.isActive()) {
                const repeatEnabled = this.state.repeatEnabled !== false;
                if (!repeatEnabled && this.chain.getNextPosition(this.chain.chainPosition) <= this.chain.chainPosition) {
                    requestAnimationFrame(() => {
                        this.controls.stop();
                    });
                } else {
                    requestAnimationFrame(() => {
                        this.chain.advance();
                    });
                }
            } else if (this.state.nextPattern !== null) {
                requestAnimationFrame(() => {
                    this.patternBank.performQueuedSwitch();
                });
            } else if (this.state.repeatEnabled === false) {
                requestAnimationFrame(() => {
                    this.controls.stop();
                });
            }
        }

        // Update dance animation
        // Update dance animation (2x per step for faster animation, BPM-linked)
        this.updateDanceFrame();
        const halfStep = (60 / this.state.bpm / 4) * 500; // half of one 16th-note step in ms
        this.danceTimer = setTimeout(() => this.updateDanceFrame(), halfStep);

        // DJ Automation and Recording
        try {
            this.djMode.onStep(step);
        } catch (e) {
            console.error('DJ Mode onStep error:', e);
        }

        // DJ Standby Pulse
        if (this.djMode.isStandby && this.dancer) {
            if (step % 4 === 0) {
                this.dancer.classList.add('pulse');
                setTimeout(() => {
                    if (this.dancer) this.dancer.classList.remove('pulse');
                }, 100);
            }
        }
    }

    // ========================
    // Track controls (mute/solo)
    // ========================

    setupTrackControls() {
        const pat = this.pattern;
        const controls = document.querySelectorAll('.track-ctrls');

        controls.forEach((ctrl, i) => {
            const muteBtn = ctrl.querySelector('.mute-btn');
            const soloBtn = ctrl.querySelector('.solo-btn');

            const newMuteBtn = muteBtn.cloneNode(true);
            const newSoloBtn = soloBtn.cloneNode(true);
            muteBtn.parentNode.replaceChild(newMuteBtn, muteBtn);
            soloBtn.parentNode.replaceChild(newSoloBtn, soloBtn);

            if (newMuteBtn && newSoloBtn) {
                // Clear any previous state
                newMuteBtn.classList.remove('active');
                newSoloBtn.classList.remove('active');

                // Set new state from pattern
                if (pat.mutedTracks && pat.mutedTracks[i]) {
                    newMuteBtn.classList.add('active');
                }
                if (pat.soloedTracks && pat.soloedTracks[i]) {
                    newSoloBtn.classList.add('active');
                }

                newMuteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    newMuteBtn.classList.toggle('active');
                    void newMuteBtn.offsetWidth;
                    const isMuted = newMuteBtn.classList.contains('active');

                    if (!pat.mutedTracks) pat.mutedTracks = [];
                    pat.mutedTracks[i] = isMuted;
                    this.audioEngine.setTrackMute(i, isMuted);

                    if (isMuted && newSoloBtn.classList.contains('active')) {
                        newSoloBtn.classList.remove('active');
                        void newSoloBtn.offsetWidth;
                        if (!pat.soloedTracks) pat.soloedTracks = [];
                        pat.soloedTracks[i] = false;
                        this.audioEngine.setTrackSolo(i, false);
                    }

                    saveState(this.state);
                });

                newSoloBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    newSoloBtn.classList.toggle('active');
                    const isSoloed = newSoloBtn.classList.contains('active');

                    if (!pat.soloedTracks) pat.soloedTracks = [];
                    pat.soloedTracks[i] = isSoloed;
                    this.audioEngine.setTrackSolo(i, isSoloed);

                    if (isSoloed && newMuteBtn.classList.contains('active')) {
                        newMuteBtn.classList.remove('active');
                        if (!pat.mutedTracks) pat.mutedTracks = [];
                        pat.mutedTracks[i] = false;
                        this.audioEngine.setTrackMute(i, false);
                    }

                    saveState(this.state);
                });
            }
        });
    }

    // ========================
    // Dance animation
    // ========================

    updateDanceFrame() {
        if (!this.dancer) return;
        this.danceFrame = (this.danceFrame + 1) % 8;
        const bgSize = window.getComputedStyle(this.dancer).backgroundSize;
        const totalWidth = parseInt(bgSize.split(' ')[0]);
        const frameWidth = totalWidth / 8;
        this.dancer.style.backgroundPosition = `${-this.danceFrame * frameWidth}px 0px`;
    }

    resetDanceAnimation() {
        if (!this.dancer) return;
        if (this.danceTimer) clearTimeout(this.danceTimer);
        this.danceFrame = 0;
        this.dancer.style.backgroundPosition = '0px 0px';
        this.dancer.classList.remove('playing');
        this.dancer.classList.remove('paused');
    }

    updateVisualizerSpeed(bpm) {
        if (!this.dancer) this.dancer = document.getElementById('visualizer-display');
        if (this.dancer) {
            const duration = 96 / bpm;
            this.dancer.style.animationDuration = `${duration}s`;
        }
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    new Sequencer();
});
