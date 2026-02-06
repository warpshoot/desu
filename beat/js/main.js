import { ROWS, COLS, TAP_THRESHOLD, TRACKS, KNOB_PARAMS, DEFAULT_BPM, DEFAULT_SCALE, DEFAULT_SWING_ENABLED, DEFAULT_OCTAVE, MAX_PATTERNS, PATTERN_NAMES, CHAIN_LENGTH } from './modules/constants.js';
import { AudioEngine } from './modules/audioEngine.js';
import { Cell } from './modules/cell.js';
import { Controls } from './modules/controls.js';
import { TonePanel } from './modules/tonePanel.js';
import { loadState, saveState, createDefaultState, createDefaultPattern, getCurrentPattern, exportProject, importProject } from './modules/storage.js';

class Sequencer {
    constructor() {
        this.state = loadState();

        this.audioEngine = new AudioEngine();

        // Preset audio settings
        // Sounds/BPM from Global State
        // Mute/Solo from Pattern (Local)
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

        // DJ Mode state
        this.djModeActive = false;
        this.djOverlay = null;
        this.djCursor = null;
        this.djFilterValue = null;
        this.djResValue = null;

        // Pattern copy buffer
        this.patternCopyBuffer = null;

        // Chain playback state (runtime only, not persisted)
        this.chainPosition = -1; // -1 = not playing chain
        this.chainSlots = [];

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
            (swingEnabled) => {
                this.pattern.swingEnabled = swingEnabled;
                saveState(this.state);
            },

            () => {
                this.onClearBtnClick();
            },
            () => {
                // onPlay
                if (this.dancer) {
                    this.dancer.classList.add('playing');
                    this.dancer.classList.remove('paused');
                }
                // Start chain from first filled slot
                if (this.isChainActive() && this.chainPosition === -1 && this.state.chainEnabled !== false) {
                    this.chainPosition = this.getFirstChainPosition();
                    const targetPattern = this.state.chain[this.chainPosition];
                    if (targetPattern !== this.state.currentPattern) {
                        this.state.currentPattern = targetPattern;
                        const gridContainer = document.getElementById('grid-container');
                        if (gridContainer) gridContainer.innerHTML = '';
                        this.createGrid();
                        // Only partial sync (Mutes etc) - Global settings persist
                        this.syncAudioWithState();

                        // Controls update
                        this.controls.setBPM(this.state.bpm);
                        this.controls.setSwing(this.pattern.swingEnabled);
                        this.controls.setScale(this.pattern.scale);
                        this.setupTrackControls();
                        this.updatePatternPadUI();
                    }
                    this.updateChainUI();
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
        this.controls.setSwing(this.pattern.swingEnabled || false);
        this.controls.setRepeat(this.state.repeatEnabled !== false);
        this.controls.setVolume(this.state.masterVolume || -12);
        this.controls.setScale(this.pattern.scale || 'Chromatic');

        const tonePanelEl = document.getElementById('tone-panel');
        if (tonePanelEl) {
            this.tonePanel = new TonePanel(
                tonePanelEl,
                this.audioEngine,
                (track, param, value) => {
                    this.state.trackParams[track][param] = value;
                    saveState(this.state);
                }
            );
        }

        this.initRollMenu();
        this.initClearMenu();

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
            this.closeDJMode(true);

            // Clear next pattern queue and chain position on stop
            this.state.nextPattern = null;
            this.chainPosition = -1;
            this.updatePatternPadUI();
            this.updateChainUI();
        });

        // Initialize dance animation
        this.dancer = document.getElementById('visualizer-display');
        if (this.dancer) {
            this.danceFrame = 0;
        }

        // Initialize DJ Mode
        this.initDJMode();

        // Initialize Pattern Bank UI
        this.initPatternBank();

        // Initialize Chain UI
        this.initChainUI();

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

        this.initCreditModal();
        this.setupFileUI();
    }

    // ========================
    // Pattern Bank
    // ========================

    initPatternBank() {
        this.patternPads = [];
        const container = document.getElementById('pattern-bank');
        if (!container) return;

        for (let i = 0; i < MAX_PATTERNS; i++) {
            const pad = document.createElement('button');
            pad.className = 'pattern-pad';
            pad.dataset.pattern = i;
            pad.textContent = PATTERN_NAMES[i];

            // Tap: switch pattern
            pad.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onPatternPadTap(i);
            });

            // Long press: context menu (copy/paste/clear)
            let longPressTimer = null;
            const startLongPress = (e) => {
                longPressTimer = setTimeout(() => {
                    e.preventDefault();
                    this.showPatternContextMenu(i, pad);
                }, 500);
            };
            const cancelLongPress = () => {
                clearTimeout(longPressTimer);
            };

            pad.addEventListener('mousedown', startLongPress);
            pad.addEventListener('mouseup', cancelLongPress);
            pad.addEventListener('mouseleave', cancelLongPress);
            pad.addEventListener('touchstart', (e) => {
                startLongPress(e);
            }, { passive: false });
            pad.addEventListener('touchend', cancelLongPress);
            pad.addEventListener('touchmove', cancelLongPress);

            container.appendChild(pad);
            this.patternPads.push(pad);
        }

        // Initialize context menu element
        this.patternMenu = document.getElementById('pattern-menu');
        if (this.patternMenu) {
            document.getElementById('pattern-copy').addEventListener('click', () => {
                this.copyPattern(this.patternMenuTarget);
                this.hidePatternMenu();
            });
            document.getElementById('pattern-paste').addEventListener('click', () => {
                this.pastePattern(this.patternMenuTarget);
                this.hidePatternMenu();
            });
            document.getElementById('pattern-clear').addEventListener('click', () => {
                this.clearPatternSlot(this.patternMenuTarget);
                this.hidePatternMenu();
            });

            // Close on outside click
            document.addEventListener('click', (e) => {
                if (this.patternMenu && !this.patternMenu.contains(e.target)) {
                    this.hidePatternMenu();
                }
            });
        }

        this.updatePatternPadUI();
    }

    onPatternPadTap(index) {
        if (index === this.state.currentPattern && this.state.nextPattern === null) return;

        if (this.audioEngine.playing) {
            // Queue pattern switch at loop end
            if (index === this.state.currentPattern) {
                // Cancel queue
                this.state.nextPattern = null;
            } else {
                this.state.nextPattern = index;
            }
            this.updatePatternPadUI();
            saveState(this.state);
        } else {
            // Immediate switch when stopped
            this.switchToPattern(index);
        }
    }

    switchToPattern(index) {
        if (index < 0 || index >= MAX_PATTERNS) return;

        this.state.currentPattern = index;
        this.state.nextPattern = null;

        // Restore UI from new pattern
        this.restoreState();

        saveState(this.state);
        this.updatePatternPadUI();
    }

    // Called from onStep when we reach loop end - performs the queued switch
    performQueuedSwitch() {
        if (this.state.nextPattern === null) return;

        const nextIdx = this.state.nextPattern;
        this.state.currentPattern = nextIdx;
        this.state.nextPattern = null;

        // Update grid UI
        const gridContainer = document.getElementById('grid-container');
        if (gridContainer) gridContainer.innerHTML = '';
        this.createGrid();

        // Sync audio params
        this.syncAudioWithState();

        // Update controls to reflect new pattern's settings (Local Only)
        // BPM/Volume/TrackParams are global, so no update needed
        this.controls.setSwing(this.pattern.swingEnabled);
        this.controls.setScale(this.pattern.scale);

        // Update track controls (mute/solo)
        this.setupTrackControls();

        this.updatePatternPadUI();
        saveState(this.state);
    }

    updatePatternPadUI() {
        if (!this.patternPads) return;

        for (let i = 0; i < this.patternPads.length; i++) {
            const pad = this.patternPads[i];
            pad.classList.remove('active', 'queued', 'has-data');

            if (i === this.state.currentPattern) {
                pad.classList.add('active');
            }
            if (i === this.state.nextPattern) {
                pad.classList.add('queued');
            }
            // Check if pattern has any active steps
            if (this.isPatternNonEmpty(i)) {
                pad.classList.add('has-data');
            }
        }
    }

    isPatternNonEmpty(index) {
        const pat = this.state.patterns[index];
        if (!pat || !pat.grid) return false;
        for (let t = 0; t < pat.grid.length; t++) {
            for (let s = 0; s < pat.grid[t].length; s++) {
                if (pat.grid[t][s].active) return true;
            }
        }
        return false;
    }

    showPatternContextMenu(index, padElement) {
        this.patternMenuTarget = index;
        if (!this.patternMenu) return;

        // Enable/disable paste
        const pasteBtn = document.getElementById('pattern-paste');
        if (pasteBtn) {
            pasteBtn.classList.toggle('disabled', !this.patternCopyBuffer);
        }

        const rect = padElement.getBoundingClientRect();
        this.patternMenu.style.left = `${rect.left}px`;
        this.patternMenu.style.top = `${rect.top - this.patternMenu.offsetHeight - 4}px`;
        this.patternMenu.classList.remove('hidden');
    }

    hidePatternMenu() {
        if (this.patternMenu) {
            this.patternMenu.classList.add('hidden');
        }
    }

    copyPattern(index) {
        this.patternCopyBuffer = JSON.parse(JSON.stringify(this.state.patterns[index]));
    }

    pastePattern(index) {
        if (!this.patternCopyBuffer) return;
        this.state.patterns[index] = JSON.parse(JSON.stringify(this.patternCopyBuffer));

        // If pasting to current pattern, refresh UI
        if (index === this.state.currentPattern) {
            this.restoreState();
        }

        saveState(this.state);
        this.updatePatternPadUI();
    }

    clearPatternSlot(index) {
        this.state.patterns[index] = createDefaultPattern();

        if (index === this.state.currentPattern) {
            this.restoreState();
        }

        saveState(this.state);
        this.updatePatternPadUI();
    }

    // ========================
    // Pattern Chain
    // ========================

    initChainUI() {
        this.chainSlots = [];
        const container = document.getElementById('chain-container');
        if (!container) return;

        // Ensure chain data exists
        if (!this.state.chain) {
            this.state.chain = new Array(CHAIN_LENGTH).fill(null);
        }
        if (this.state.chainEnabled === undefined) {
            this.state.chainEnabled = true;
        }

        // CH toggle button
        this.chainToggleBtn = document.createElement('button');
        this.chainToggleBtn.id = 'chain-toggle';
        this.chainToggleBtn.textContent = 'CH';

        let chPressTimer = null;
        let chDidLongPress = false;

        const chStartPress = () => {
            chDidLongPress = false;
            chPressTimer = setTimeout(() => {
                chDidLongPress = true;
                // Long press: clear all chain slots
                this.state.chain = new Array(CHAIN_LENGTH).fill(null);
                this.chainPosition = -1;
                saveState(this.state);
                this.updateChainUI();
            }, 500);
        };
        const chEndPress = () => {
            clearTimeout(chPressTimer);
            if (!chDidLongPress) {
                this.state.chainEnabled = !this.state.chainEnabled;
                if (!this.state.chainEnabled) {
                    this.chainPosition = -1;
                }
                saveState(this.state);
                this.updateChainUI();
            }
        };
        const chCancelPress = () => { clearTimeout(chPressTimer); };

        this.chainToggleBtn.addEventListener('mousedown', chStartPress);
        this.chainToggleBtn.addEventListener('mouseup', chEndPress);
        this.chainToggleBtn.addEventListener('mouseleave', chCancelPress);
        this.chainToggleBtn.addEventListener('touchstart', chStartPress, { passive: true });
        this.chainToggleBtn.addEventListener('touchend', (e) => { e.preventDefault(); chEndPress(); });
        this.chainToggleBtn.addEventListener('touchcancel', chCancelPress);

        container.appendChild(this.chainToggleBtn);

        for (let i = 0; i < CHAIN_LENGTH; i++) {
            if (i > 0) {
                const arrow = document.createElement('span');
                arrow.className = 'chain-arrow';
                arrow.textContent = '>';
                container.appendChild(arrow);
            }

            const slot = document.createElement('button');
            slot.className = 'chain-slot';
            slot.dataset.index = i;

            let pressTimer = null;
            let didLongPress = false;

            const startPress = (e) => {
                didLongPress = false;
                pressTimer = setTimeout(() => {
                    didLongPress = true;
                    this.onChainSlotClear(i);
                }, 500);
            };

            const endPress = (e) => {
                clearTimeout(pressTimer);
                if (!didLongPress) {
                    this.onChainSlotTap(i);
                }
            };

            const cancelPress = () => {
                clearTimeout(pressTimer);
            };

            slot.addEventListener('mousedown', startPress);
            slot.addEventListener('mouseup', endPress);
            slot.addEventListener('mouseleave', cancelPress);
            slot.addEventListener('touchstart', startPress, { passive: true });
            slot.addEventListener('touchend', (e) => {
                e.preventDefault();
                endPress(e);
            });
            slot.addEventListener('touchcancel', cancelPress);

            container.appendChild(slot);
            this.chainSlots.push(slot);
        }

        this.updateChainUI();
    }

    onChainSlotClear(index) {
        if (this.state.chain[index] !== null) {
            this.state.chain[index] = null;
            saveState(this.state);
            this.updateChainUI();
        }
    }

    onChainSlotTap(index) {
        const current = this.state.chain[index];

        if (current === null) {
            // Empty → set to 0 (pattern 1)
            this.state.chain[index] = 0;
        } else if (current < MAX_PATTERNS - 1) {
            // Cycle through patterns
            this.state.chain[index] = current + 1;
        } else {
            // Last pattern → clear
            this.state.chain[index] = null;
        }

        saveState(this.state);
        this.updateChainUI();
    }

    isChainActive() {
        return this.state.chainEnabled !== false && this.state.chain && this.state.chain.some(s => s !== null);
    }

    advanceChain() {
        if (!this.isChainActive()) return;

        // Find next filled slot
        const nextPos = this.getNextChainPosition(this.chainPosition);
        if (nextPos === -1) return; // No filled slots (shouldn't happen)

        this.chainPosition = nextPos;
        const targetPattern = this.state.chain[nextPos];

        // Switch pattern if different
        if (targetPattern !== this.state.currentPattern) {
            this.state.currentPattern = targetPattern;
            this.state.nextPattern = null;

            // Rebuild UI for new pattern
            const gridContainer = document.getElementById('grid-container');
            if (gridContainer) gridContainer.innerHTML = '';
            this.createGrid();

            // Sync audio
            this.syncAudioWithState();

            // Update controls
            this.controls.setBPM(this.pattern.bpm);
            this.controls.setSwing(this.pattern.swingEnabled);
            this.controls.setScale(this.pattern.scale);
            this.setupTrackControls();
        }

        this.updatePatternPadUI();
        this.updateChainUI();
    }

    getFirstChainPosition() {
        for (let i = 0; i < CHAIN_LENGTH; i++) {
            if (this.state.chain[i] !== null) return i;
        }
        return -1;
    }

    getNextChainPosition(currentPos) {
        // Search from currentPos + 1, wrapping around
        for (let offset = 1; offset <= CHAIN_LENGTH; offset++) {
            const idx = (currentPos + offset) % CHAIN_LENGTH;
            if (this.state.chain[idx] !== null) {
                return idx;
            }
        }
        return -1;
    }

    updateChainUI() {
        if (!this.chainSlots.length) return;

        const enabled = this.state.chainEnabled !== false;
        const container = document.getElementById('chain-container');
        if (container) {
            container.classList.toggle('chain-disabled', !enabled);
        }
        if (this.chainToggleBtn) {
            this.chainToggleBtn.classList.toggle('active', enabled);
        }

        for (let i = 0; i < CHAIN_LENGTH; i++) {
            const slot = this.chainSlots[i];
            const value = this.state.chain[i];

            slot.classList.toggle('filled', value !== null);
            slot.classList.toggle('playing', enabled && i === this.chainPosition && this.audioEngine.playing);
            slot.textContent = value !== null ? PATTERN_NAMES[value] : '';
        }
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
                this.updatePatternPadUI();
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
                    this.updatePatternPadUI();
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
        this.controls.setSwing(pat.swingEnabled); // Local
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
        this.audioEngine.setSwing(pat.swingEnabled); // Swing is local

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
    // Clear Menu
    // ========================

    initClearMenu() {
        this.clearMenuElement = document.getElementById('clear-menu');
        this.clearBtn = document.getElementById('clear-btn');

        if (!this.clearMenuElement || !this.clearBtn) return;

        // Menu button actions
        document.getElementById('clear-pattern-btn').addEventListener('click', () => {
            if (confirm('Clear current pattern steps and local settings?')) {
                this.clearCurrentPattern();
                this.clearMenuElement.classList.add('hidden');
            }
        });

        document.getElementById('clear-all-btn').addEventListener('click', () => {
            if (confirm('RESET ALL? This will clear all patterns and reset all sounds.')) {
                this.resetAll();
                this.clearMenuElement.classList.add('hidden');
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!this.clearMenuElement.classList.contains('hidden') &&
                !this.clearMenuElement.contains(e.target) &&
                !this.clearBtn.contains(e.target)) {
                this.clearMenuElement.classList.add('hidden');
            }
        });
    }

    onClearBtnClick() {
        if (!this.clearMenuElement || !this.clearBtn) return;

        const rect = this.clearBtn.getBoundingClientRect();
        this.clearMenuElement.style.position = 'fixed';
        this.clearMenuElement.style.bottom = (window.innerHeight - rect.top + 5) + 'px';
        this.clearMenuElement.style.left = (rect.left - 20) + 'px';
        this.clearMenuElement.style.top = 'auto';

        this.clearMenuElement.classList.toggle('hidden');

        // Close file menu if open
        const fileMenu = document.getElementById('file-menu');
        if (fileMenu && !fileMenu.classList.contains('hidden')) {
            fileMenu.classList.add('hidden');
        }
    }

    resetAll() {
        this.audioEngine.stop();
        this.state = createDefaultState();
        this.restoreState();
        this.updatePatternPadUI();
        this.updateChainUI(); // Also reset UI chain
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

    // ========================
    // Roll menu UI
    // ========================

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
                                pat.trackOctaves[t]
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
    }

    setupTrackIcons() {
        this.trackIcons = document.querySelectorAll('.track-icon');

        const tapState = [];
        for (let i = 0; i < TRACKS.length; i++) {
            tapState[i] = { count: 0, lastTapTime: 0, timer: null, longPressTimer: null, didLongPress: false };
        }

        this.trackIcons.forEach((icon, track) => {
            const state = tapState[track];

            // Long-press to clear track
            const startLongPress = () => {
                state.didLongPress = false;
                state.longPressTimer = setTimeout(() => {
                    state.didLongPress = true;
                    this.clearTrack(track);
                }, 500);
            };
            const cancelLongPress = () => {
                clearTimeout(state.longPressTimer);
            };

            icon.addEventListener('mousedown', startLongPress);
            icon.addEventListener('mouseup', cancelLongPress);
            icon.addEventListener('mouseleave', cancelLongPress);
            icon.addEventListener('touchstart', startLongPress, { passive: true });
            icon.addEventListener('touchend', cancelLongPress);
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


    clearCurrentPattern() {
        // Stop playback first
        if (this.controls) {
            this.controls.stop();
        }

        // Reset current pattern to defaults
        this.state.patterns[this.state.currentPattern] = createDefaultPattern();

        // Rebuild UI
        this.restoreState();

        // Update track controls
        document.querySelectorAll('.mute-btn, .solo-btn').forEach(btn => btn.classList.remove('active'));
        for (let i = 0; i < ROWS; i++) {
            this.audioEngine.setTrackMute(i, false);
            this.audioEngine.setTrackSolo(i, false);
        }

        saveState(this.state);
        this.updatePatternPadUI();

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
        this.updatePatternPadUI();

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
                }

                this.audioEngine.triggerNote(
                    track,
                    cell.getEffectivePitch(),
                    cell.data.duration,
                    time,
                    cell.data.rollMode,
                    cell.data.rollSubdivision,
                    pat.trackOctaves[track]
                );
            }
        }

        // At end of bar: chain advance, queued pattern switch, or one-shot stop
        if (step === COLS - 1) {
            if (this.isChainActive()) {
                // Check if repeat is OFF and this is the last chain slot
                const repeatEnabled = this.state.repeatEnabled !== false;
                if (!repeatEnabled && this.getNextChainPosition(this.chainPosition) <= this.chainPosition) {
                    // Reached end of chain — stop
                    requestAnimationFrame(() => {
                        this.controls.stop();
                    });
                } else {
                    requestAnimationFrame(() => {
                        this.advanceChain();
                    });
                }
            } else if (this.state.nextPattern !== null) {
                requestAnimationFrame(() => {
                    this.performQueuedSwitch();
                });
            } else if (this.state.repeatEnabled === false) {
                // One-shot mode: stop after this bar
                requestAnimationFrame(() => {
                    this.controls.stop();
                });
            }
        }

        // Update dance animation
        this.updateDanceFrame();

        // DJ Standby Pulse
        if (this.djState && this.djState.standby && this.dancer) {
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
                if (pat.mutedTracks && pat.mutedTracks[i]) {
                    newMuteBtn.classList.add('active');
                    this.audioEngine.setTrackMute(i, true);
                }
                if (pat.soloedTracks && pat.soloedTracks[i]) {
                    newSoloBtn.classList.add('active');
                    this.audioEngine.setTrackSolo(i, true);
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
        this.danceFrame = 0;
        this.dancer.style.backgroundPosition = '0px 0px';
        this.dancer.classList.remove('playing');
        this.dancer.classList.remove('paused');
    }

    // ========================
    // DJ Mode
    // ========================

    initDJMode() {
        this.djOverlay = document.getElementById('dj-overlay');
        this.djOrigin = document.getElementById('dj-origin');
        this.djCurrent = document.getElementById('dj-current');
        this.djLine = document.getElementById('dj-line');

        if (!this.djOverlay || !this.dancer) return;

        this.djState = {
            mode: 0,
            touching: false,
            x: 0.5, y: 0.5,
            startX: 0.5, startY: 0.5,
            targetX: 0.5, targetY: 0.5
        };

        this.renderDJLoop = this.renderDJLoop.bind(this);
        requestAnimationFrame(this.renderDJLoop);

        this.dancer.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.audioEngine.playing) {
                this.cycleDJMode();
            }
        });

        const onStart = (e) => {
            this.djState.touching = true;
            const pos = this.getDJPosition(e);
            this.djState.startX = pos.x;
            this.djState.startY = pos.y;
            this.djState.targetX = pos.x;
            this.djState.targetY = pos.y;
            this.djState.x = pos.x;
            this.djState.y = pos.y;
            this.djOrigin.classList.remove('hidden');
            this.djCurrent.classList.remove('hidden');
            this.djLine.classList.remove('hidden');
            this.updateDJAudio(0, 0);
        };

        const onMove = (e) => {
            if (!this.djState.touching) return;
            e.preventDefault();
            const pos = this.getDJPosition(e);
            this.djState.targetX = pos.x;
            this.djState.targetY = pos.y;
        };

        const onEnd = (e) => {
            this.djState.touching = false;
            this.djOrigin.classList.add('hidden');
            this.djCurrent.classList.add('hidden');
            this.djLine.classList.add('hidden');
            this.audioEngine.resetDJFilter();
            if (this.djState.mode === 1) {
                this.closeDJMode(true);
            }
        };

        this.djOverlay.addEventListener('mousedown', onStart);
        this.djOverlay.addEventListener('mousemove', onMove);
        this.djOverlay.addEventListener('mouseup', onEnd);
        this.djOverlay.addEventListener('mouseleave', onEnd);

        this.djOverlay.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                onStart(e);
            }
        }, { passive: false });

        this.djOverlay.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                onMove(e);
            }
        }, { passive: false });

        this.djOverlay.addEventListener('touchend', onEnd);
    }

    renderDJLoop() {
        if (this.djState.mode > 0) {
            const smoothing = 0.5;
            this.djState.x += (this.djState.targetX - this.djState.x) * smoothing;
            this.djState.y += (this.djState.targetY - this.djState.y) * smoothing;

            if (this.djState.touching) {
                const deltaX = this.djState.x - this.djState.startX;
                const deltaY = this.djState.startY - this.djState.y;
                this.updateDJAudio(deltaX, deltaY);
                this.updateDJVisuals();
            }
        }
        requestAnimationFrame(this.renderDJLoop);
    }

    getDJPosition(e) {
        const rect = this.djOverlay.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

        return { x, y };
    }

    updateDJVisuals() {
        const { startX, startY, x, y } = this.djState;
        const rect = this.djOverlay.getBoundingClientRect();

        if (this.djOrigin) {
            this.djOrigin.style.transform = `translate3d(${startX * rect.width}px, ${startY * rect.height}px, 0) translate(-50%, -50%)`;
        }

        if (this.djCurrent) {
            this.djCurrent.style.transform = `translate3d(${x * rect.width}px, ${y * rect.height}px, 0) translate(-50%, -50%)`;
        }

        if (this.djLine) {
            const p1 = { x: startX * rect.width, y: startY * rect.height };
            const p2 = { x: x * rect.width, y: y * rect.height };

            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

            this.djLine.style.width = `${dist}px`;
            this.djLine.style.transform = `translate3d(${p1.x}px, ${p1.y}px, 0) translateY(-50%) rotate(${angle}rad)`;
        }
    }

    updateDJAudio(deltaX, deltaY) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        let lpfCutoff = 20000;
        let hpfCutoff = 20;

        if (deltaX > 0) {
            const factor = Math.pow(0.001, Math.min(absX * 2, 1));
            lpfCutoff = 20000 * factor;
            lpfCutoff = Math.max(200, lpfCutoff);
        } else if (deltaX < 0) {
            const factor = Math.pow(300, Math.min(absX * 2, 1));
            hpfCutoff = 20 * factor;
            hpfCutoff = Math.min(6000, hpfCutoff);
        }

        let resonance = 1.0;
        let delayWet = 0;

        if (deltaY > 0) {
            resonance = 1.0 + (absY * 28);
            resonance = Math.min(15, resonance);
            delayWet = Math.min(0.6, absY * 2);
        }

        this.audioEngine.setDJFilter(lpfCutoff, hpfCutoff, resonance, delayWet);
    }

    cycleDJMode() {
        const nextMode = (this.djState.mode + 1) % 3;
        this.djState.mode = nextMode;

        this.dancer.classList.remove('standby');
        this.dancer.classList.remove('dj-keep');

        if (nextMode === 1) {
            this.djOverlay.classList.remove('hidden');
            this.dancer.classList.add('standby');
        } else if (nextMode === 2) {
            this.djOverlay.classList.remove('hidden');
            this.dancer.classList.add('dj-keep');
        } else {
            this.closeDJMode(true);
        }
    }

    closeDJMode(force = false) {
        if (this.djState.mode === 2 && !force) return;

        this.djState.mode = 0;
        this.djOverlay.classList.add('hidden');
        if (this.dancer) {
            this.dancer.classList.remove('standby');
            this.dancer.classList.remove('dj-keep');
        }
        this.audioEngine.resetDJFilter();
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
