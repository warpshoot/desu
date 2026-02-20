import { Deck } from './modules/deck.js';
import { Mixer } from './modules/mixer.js';

class DJApp {
    constructor() {
        this.mixer = new Mixer();
        this.deckA = null;
        this.deckB = null;
        this.initialized = false;

        this.init();
    }

    async init() {
        // Initialize mixer first
        await this.mixer.init();

        // Create decks
        const deckAContainer = document.getElementById('deck-a');
        const deckBContainer = document.getElementById('deck-b');

        this.deckA = new Deck('a', deckAContainer, this.mixer.getOutputNodeA());
        this.deckB = new Deck('b', deckBContainer, this.mixer.getOutputNodeB());

        // Build UI
        this.deckA.buildUI();
        this.deckB.buildUI();

        // Setup crossfader
        this.setupCrossfader();

        // Setup sync button
        this.setupSync();

        // Setup master volume
        this.setupMasterVolume();

        // Setup keyboard shortcuts
        this.setupKeyboard();

        this.initialized = true;
    }

    setupCrossfader() {
        const slider = document.getElementById('crossfader');
        if (!slider) return;

        slider.addEventListener('input', () => {
            const value = parseInt(slider.value) / 100;
            this.mixer.setCrossfade(value);
        });

        // Double-click to center
        slider.addEventListener('dblclick', () => {
            slider.value = '50';
            this.mixer.setCrossfade(0.5);
        });
    }

    setupSync() {
        const syncBtn = document.getElementById('sync-btn');
        if (!syncBtn) return;

        syncBtn.addEventListener('click', () => {
            // Sync deck B to deck A's BPM
            if (this.deckA && this.deckB) {
                this.deckB.setBPM(this.deckA.bpm);
                syncBtn.classList.add('flash');
                setTimeout(() => syncBtn.classList.remove('flash'), 300);
            }
        });
    }

    setupMasterVolume() {
        const slider = document.getElementById('master-vol');
        if (!slider) return;

        slider.addEventListener('input', () => {
            const value = parseInt(slider.value);
            this.mixer.setMasterVolume(value);
        });
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Q = play/stop deck A
            if (e.key === 'q' || e.key === 'Q') {
                if (!this.deckA.initialized) {
                    this.deckA.init().then(() => this.deckA.togglePlay());
                } else {
                    this.deckA.togglePlay();
                }
            }
            // P = play/stop deck B
            if (e.key === 'p' || e.key === 'P') {
                if (!this.deckB.initialized) {
                    this.deckB.init().then(() => this.deckB.togglePlay());
                } else {
                    this.deckB.togglePlay();
                }
            }
            // Space = play/stop both
            if (e.key === ' ') {
                e.preventDefault();
                const initAndToggle = async (deck) => {
                    if (!deck.initialized) await deck.init();
                    deck.togglePlay();
                };
                initAndToggle(this.deckA);
                initAndToggle(this.deckB);
            }
            // S = sync
            if (e.key === 's' || e.key === 'S') {
                if (this.deckA && this.deckB) {
                    this.deckB.setBPM(this.deckA.bpm);
                }
            }
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new DJApp();
});
