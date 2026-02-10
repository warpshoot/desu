import { CHAIN_LENGTH, PATTERN_NAMES, MAX_PATTERNS } from './constants.js';
import { saveState } from './storage.js';

export class Chain {
    constructor(sequencer) {
        this.seq = sequencer;
        this.chainSlots = [];
        this.chainToggleBtn = null;
        this.chainPosition = -1; // -1 = not playing chain
    }

    init() {
        this.chainSlots = [];
        const container = document.getElementById('chain-container');
        if (!container) return;

        if (!this.seq.state.chain) {
            this.seq.state.chain = new Array(CHAIN_LENGTH).fill(null);
        }
        if (this.seq.state.chainEnabled === undefined) {
            this.seq.state.chainEnabled = true;
        }

        // CH toggle button
        this.chainToggleBtn = document.createElement('button');
        this.chainToggleBtn.id = 'chain-toggle';
        this.chainToggleBtn.textContent = 'CHAIN';

        let chPressTimer = null;
        let chDidLongPress = false;
        let chIsTouch = false;

        const chStartPress = () => {
            chDidLongPress = false;
            chPressTimer = setTimeout(() => {
                chDidLongPress = true;
                // Show chain context menu
                const chainMenu = document.getElementById('chain-menu');
                if (chainMenu) {
                    // Hide other menus
                    document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
                    document.querySelectorAll('.popup-menu').forEach(m => m.classList.add('hidden'));

                    const rect = this.chainToggleBtn.getBoundingClientRect();
                    chainMenu.style.left = `${rect.left}px`;
                    chainMenu.style.top = `${rect.top - chainMenu.offsetHeight - 4}px`;
                    chainMenu.classList.remove('hidden');
                }
            }, 500);
        };
        const chEndPress = () => {
            clearTimeout(chPressTimer);
            if (!chDidLongPress) {
                this.seq.state.chainEnabled = !this.seq.state.chainEnabled;
                if (!this.seq.state.chainEnabled) {
                    this.chainPosition = -1;
                }
                saveState(this.seq.state);
                this.updateUI();
            }
        };
        const chCancelPress = () => { clearTimeout(chPressTimer); };

        this.chainToggleBtn.addEventListener('mousedown', () => { if (!chIsTouch) chStartPress(); });
        this.chainToggleBtn.addEventListener('mouseup', () => { if (!chIsTouch) chEndPress(); });
        this.chainToggleBtn.addEventListener('mouseleave', chCancelPress);
        this.chainToggleBtn.addEventListener('touchstart', () => { chIsTouch = true; chStartPress(); }, { passive: true });
        this.chainToggleBtn.addEventListener('touchend', (e) => { e.preventDefault(); chEndPress(); setTimeout(() => { chIsTouch = false; }, 300); });
        this.chainToggleBtn.addEventListener('touchcancel', () => { chCancelPress(); setTimeout(() => { chIsTouch = false; }, 300); });

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
            let isTouch = false;

            const startPress = () => {
                didLongPress = false;
                pressTimer = setTimeout(() => {
                    didLongPress = true;
                    this.onSlotClear(i);
                }, 500);
            };

            const endPress = () => {
                clearTimeout(pressTimer);
                if (!didLongPress) {
                    this.onSlotTap(i);
                }
            };

            const cancelPress = () => {
                clearTimeout(pressTimer);
            };

            slot.addEventListener('mousedown', () => { if (!isTouch) startPress(); });
            slot.addEventListener('mouseup', () => { if (!isTouch) endPress(); });
            slot.addEventListener('mouseleave', cancelPress);
            slot.addEventListener('touchstart', () => { isTouch = true; startPress(); }, { passive: true });
            slot.addEventListener('touchend', (e) => {
                e.preventDefault();
                endPress();
                setTimeout(() => { isTouch = false; }, 300);
            });
            slot.addEventListener('touchcancel', () => { cancelPress(); setTimeout(() => { isTouch = false; }, 300); });

            container.appendChild(slot);
            this.chainSlots.push(slot);
        }

        this.updateUI();
    }

    onSlotClear(index) {
        if (this.seq.state.chain[index] !== null) {
            this.seq.state.chain[index] = null;
            saveState(this.seq.state);
            this.updateUI();
        }
    }

    onSlotTap(index) {
        const current = this.seq.state.chain[index];

        if (current === null) {
            this.seq.state.chain[index] = 0;
        } else if (current < MAX_PATTERNS - 1) {
            this.seq.state.chain[index] = current + 1;
        } else {
            this.seq.state.chain[index] = null;
        }

        saveState(this.seq.state);
        this.updateUI();
    }

    isActive() {
        const state = this.seq.state;
        return state.chainEnabled !== false && state.chain && state.chain.some(s => s !== null);
    }

    advance() {
        if (!this.isActive()) return;

        const nextPos = this.getNextPosition(this.chainPosition);
        if (nextPos === -1) return;

        this.chainPosition = nextPos;
        const targetPattern = this.seq.state.chain[nextPos];

        if (targetPattern !== this.seq.state.currentPattern) {
            this.seq.state.currentPattern = targetPattern;
            this.seq.state.nextPattern = null;

            const gridContainer = document.getElementById('grid-container');
            if (gridContainer) gridContainer.innerHTML = '';
            this.seq.createGrid();

            this.seq.syncAudioWithState();

            this.seq.controls.setBPM(this.seq.state.bpm);
            this.seq.controls.setSwing(this.seq.pattern.swingEnabled);
            this.seq.controls.setScale(this.seq.pattern.scale);
            this.seq.setupTrackControls();
        }

        this.seq.patternBank.updateUI();
        this.updateUI();
    }

    getFirstPosition() {
        for (let i = 0; i < CHAIN_LENGTH; i++) {
            if (this.seq.state.chain[i] !== null) return i;
        }
        return -1;
    }

    getNextPosition(currentPos) {
        for (let offset = 1; offset <= CHAIN_LENGTH; offset++) {
            const idx = (currentPos + offset) % CHAIN_LENGTH;
            if (this.seq.state.chain[idx] !== null) {
                return idx;
            }
        }
        return -1;
    }

    updateUI() {
        if (!this.chainSlots.length) return;

        const state = this.seq.state;
        const enabled = state.chainEnabled !== false;
        const container = document.getElementById('chain-container');
        if (container) {
            container.classList.toggle('chain-disabled', !enabled);
        }
        if (this.chainToggleBtn) {
            this.chainToggleBtn.classList.toggle('active', enabled);
        }

        for (let i = 0; i < CHAIN_LENGTH; i++) {
            const slot = this.chainSlots[i];
            const value = state.chain[i];

            slot.classList.toggle('filled', value !== null);
            slot.classList.toggle('playing', enabled && i === this.chainPosition && this.seq.audioEngine.playing);
            slot.textContent = value !== null ? PATTERN_NAMES[value] : '';
        }
    }
}
