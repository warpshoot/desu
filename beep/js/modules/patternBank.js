import { MAX_PATTERNS, PATTERN_NAMES } from './constants.js';
import { saveState, createDefaultPattern } from './storage.js';

export class PatternBank {
    constructor(sequencer) {
        this.seq = sequencer;
        this.patternPads = [];
        this.patternMenu = null;
        this.patternMenuTarget = null;
        this.patternCopyBuffer = null;
    }

    init() {
        const container = document.getElementById('pattern-bank');
        if (!container) return;

        for (let i = 0; i < MAX_PATTERNS; i++) {
            const pad = document.createElement('button');
            pad.className = 'pattern-pad';
            pad.dataset.pattern = i;
            pad.textContent = PATTERN_NAMES[i];

            let longPressTimer = null;
            let isTouch = false;
            let didLongPress = false;

            const startLongPress = (e) => {
                didLongPress = false;
                longPressTimer = setTimeout(() => {
                    didLongPress = true;
                    e.preventDefault();
                    this.seq._suppressClick = true;
                    this.showContextMenu(i, pad);
                }, 500);
            };
            const cancelLongPress = () => {
                clearTimeout(longPressTimer);
            };

            pad.addEventListener('click', (e) => {
                e.stopPropagation();
                if (didLongPress) {
                    didLongPress = false;
                    return;
                }
                this.onPadTap(i);
            });

            pad.addEventListener('mousedown', (e) => { if (!isTouch) startLongPress(e); });
            pad.addEventListener('mouseup', () => { if (!isTouch) cancelLongPress(); });
            pad.addEventListener('mouseleave', cancelLongPress);
            pad.addEventListener('touchstart', (e) => {
                isTouch = true;
                startLongPress(e);
            }, { passive: false });
            pad.addEventListener('touchend', () => { cancelLongPress(); setTimeout(() => { isTouch = false; }, 300); });
            pad.addEventListener('touchmove', cancelLongPress);

            container.appendChild(pad);
            this.patternPads.push(pad);
        }

        this.patternMenu = document.getElementById('pattern-menu');
        if (this.patternMenu) {
            document.getElementById('pattern-copy').addEventListener('click', () => {
                this.copyPattern(this.patternMenuTarget);
                this.hideMenu();
            });
            document.getElementById('pattern-paste').addEventListener('click', () => {
                this.pastePattern(this.patternMenuTarget);
                this.hideMenu();
            });
            document.getElementById('pattern-clear').addEventListener('click', () => {
                this.clearSlot(this.patternMenuTarget);
                this.hideMenu();
            });
        }

        this.updateUI();
    }

    onPadTap(index) {
        const state = this.seq.state;
        if (index === state.currentPattern && state.nextPattern === null) return;

        if (this.seq.audioEngine.playing) {
            if (index === state.currentPattern) {
                state.nextPattern = null;
            } else {
                state.nextPattern = index;
            }
            this.updateUI();
            this.seq.chain.updateUI();
            saveState(state);
        } else {
            this.switchTo(index);
        }
    }

    switchTo(index) {
        if (index < 0 || index >= MAX_PATTERNS) return;
        const state = this.seq.state;

        state.currentPattern = index;
        state.nextPattern = null;

        this.seq.restoreState();
        saveState(state);
        this.updateUI();
        this.seq.chain.updateUI();
    }

    performQueuedSwitch() {
        const state = this.seq.state;
        if (state.nextPattern === null) return;

        const nextIdx = state.nextPattern;
        state.currentPattern = nextIdx;
        state.nextPattern = null;

        const gridContainer = document.getElementById('grid-container');
        if (gridContainer) gridContainer.innerHTML = '';
        this.seq.createGrid();

        this.seq.syncAudioWithState();

        this.seq.controls.setSwing(this.seq.pattern.swingEnabled);
        this.seq.controls.setScale(this.seq.pattern.scale);
        this.seq.setupTrackControls();

        this.updateUI();
        this.seq.chain.updateUI();
        saveState(state);
    }

    updateUI() {
        if (!this.patternPads.length) return;
        const state = this.seq.state;

        for (let i = 0; i < this.patternPads.length; i++) {
            const pad = this.patternPads[i];
            pad.classList.remove('active', 'queued', 'has-data');

            if (i === state.currentPattern) {
                pad.classList.add('active');
            }
            if (i === state.nextPattern) {
                pad.classList.add('queued');
            }
            if (this.isNonEmpty(i)) {
                pad.classList.add('has-data');
            }
        }
    }

    isNonEmpty(index) {
        const pat = this.seq.state.patterns[index];
        if (!pat || !pat.grid) return false;
        for (let t = 0; t < pat.grid.length; t++) {
            for (let s = 0; s < pat.grid[t].length; s++) {
                if (pat.grid[t][s].active) return true;
            }
        }
        return false;
    }

    showContextMenu(index, padElement) {
        this.patternMenuTarget = index;
        if (!this.patternMenu) return;

        const pasteBtn = document.getElementById('pattern-paste');
        if (pasteBtn) {
            pasteBtn.classList.toggle('disabled', !this.patternCopyBuffer);
        }

        const rect = padElement.getBoundingClientRect();
        this.patternMenu.style.left = `${rect.left}px`;
        this.patternMenu.style.top = `${rect.top - this.patternMenu.offsetHeight - 4}px`;
        this.patternMenu.classList.remove('hidden');
        this._menuOpenTime = Date.now();
    }

    hideMenu() {
        if (this.patternMenu) {
            this.patternMenu.classList.add('hidden');
        }
    }

    copyPattern(index) {
        this.patternCopyBuffer = JSON.parse(JSON.stringify(this.seq.state.patterns[index]));
    }

    pastePattern(index) {
        if (!this.patternCopyBuffer) return;
        this.seq.state.patterns[index] = JSON.parse(JSON.stringify(this.patternCopyBuffer));

        if (index === this.seq.state.currentPattern) {
            this.seq.restoreState();
        }

        saveState(this.seq.state);
        this.updateUI();
    }

    clearSlot(index) {
        this.seq.state.patterns[index] = createDefaultPattern();

        if (index === this.seq.state.currentPattern) {
            this.seq.restoreState();
        }

        saveState(this.seq.state);
        this.updateUI();
    }
}
