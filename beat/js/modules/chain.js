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
        this.arrows = [];
        const container = document.getElementById('chain-container');
        if (!container) return;

        if (!this.seq.state.chain) {
            this.seq.state.chain = new Array(CHAIN_LENGTH).fill(null);
        }
        if (!this.seq.state.chainMode) {
            this.seq.state.chainMode = 'chain';
        }

        // Mode toggle button: CHAIN / LIVE (simple click, no long-press)
        this.chainToggleBtn = document.createElement('button');
        this.chainToggleBtn.id = 'chain-toggle';

        this.chainToggleBtn.addEventListener('click', () => {
            this.seq.state.chainMode = this.seq.state.chainMode === 'chain' ? 'live' : 'chain';
            this.chainPosition = -1;
            saveState(this.seq.state);
            this.updateUI();
        });

        container.appendChild(this.chainToggleBtn);

        // Create slots (used for both CHAIN and LIVE modes)
        this._chainMenuTarget = null;

        for (let i = 0; i < CHAIN_LENGTH; i++) {
            if (i > 0) {
                const arrow = document.createElement('span');
                arrow.className = 'chain-arrow';
                arrow.textContent = '>';
                container.appendChild(arrow);
                this.arrows.push(arrow);
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
                    if (this.seq.state.chainMode === 'chain') {
                        this.showChainSlotMenu(i, slot);
                    }
                    // No long-press action in LIVE mode
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

    showChainSlotMenu(index, slotElement) {
        this._chainMenuTarget = index;
        const chainMenu = document.getElementById('chain-menu');
        if (!chainMenu) return;

        document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
        document.querySelectorAll('.popup-menu').forEach(m => m.classList.add('hidden'));

        this.seq._suppressClick = true;

        const rect = slotElement.getBoundingClientRect();
        chainMenu.style.left = `${rect.left}px`;
        chainMenu.style.top = `${rect.top - chainMenu.offsetHeight - 4}px`;
        chainMenu.classList.remove('hidden');
    }

    onSlotClear(index) {
        if (this.seq.state.chain[index] !== null) {
            this.seq.state.chain[index] = null;
            saveState(this.seq.state);
            this.updateUI();
        }
    }

    onSlotTap(index) {
        const mode = this.seq.state.chainMode;

        if (mode === 'live') {
            // LIVE mode: queue pattern switch at bar end (same as pattern bank)
            if (index >= MAX_PATTERNS) return;
            this.seq.patternBank.onPadTap(index);
            this.updateUI();
            return;
        }

        // CHAIN mode: cycle pattern assignment
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
        return state.chainMode === 'chain' && state.chain && state.chain.some(s => s !== null);
    }

    isLive() {
        return this.seq.state.chainMode === 'live';
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
        const mode = state.chainMode || 'chain';
        const isChainMode = mode === 'chain';
        const isLiveMode = mode === 'live';
        const container = document.getElementById('chain-container');

        // Toggle button label
        if (this.chainToggleBtn) {
            this.chainToggleBtn.textContent = isChainMode ? 'CHAIN' : 'LIVE';
            this.chainToggleBtn.classList.toggle('active', true);
        }

        // Container mode class
        if (container) {
            container.classList.remove('chain-disabled');
            container.classList.toggle('mode-live', isLiveMode);
            container.classList.toggle('mode-chain', isChainMode);
        }

        // Hide arrows in LIVE mode
        this.arrows.forEach(arrow => {
            arrow.style.display = isLiveMode ? 'none' : '';
        });

        for (let i = 0; i < CHAIN_LENGTH; i++) {
            const slot = this.chainSlots[i];

            if (isLiveMode) {
                // LIVE mode: show pattern numbers, highlight current, blink queued
                if (i < MAX_PATTERNS) {
                    slot.style.display = '';
                    slot.textContent = PATTERN_NAMES[i];
                    slot.classList.remove('filled', 'playing');
                    slot.classList.toggle('live-active', i === state.currentPattern);
                    slot.classList.toggle('queued', state.nextPattern !== null && i === state.nextPattern);
                } else {
                    slot.style.display = 'none';
                }
            } else {
                // CHAIN mode: existing behavior
                slot.style.display = '';
                slot.classList.remove('live-active', 'queued');
                const value = state.chain[i];
                slot.classList.toggle('filled', value !== null);
                slot.classList.toggle('playing', i === this.chainPosition && this.seq.audioEngine.playing);
                slot.textContent = value !== null ? PATTERN_NAMES[value] : '';
            }
        }
    }
}
