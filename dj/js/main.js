import { Deck } from './modules/deck.js';
import { Mixer } from './modules/mixer.js';

class DJApp {
    constructor() {
        this.mixer = new Mixer();
        this.deckA = null;
        this.deckB = null;
        this.init();
    }

    async init() {
        await this.mixer.init();

        const deckAEl = document.getElementById('deck-a');
        const deckBEl = document.getElementById('deck-b');

        this.deckA = new Deck('a', deckAEl, this.mixer.getOutputNodeA());
        this.deckB = new Deck('b', deckBEl, this.mixer.getOutputNodeB());

        this.setupCrossfader();
        this.setupSync();
        this.setupMasterVolume();
        this.setupKeyboard();
    }

    setupCrossfader() {
        const slider = document.getElementById('crossfader');
        if (!slider) return;
        slider.addEventListener('input', () => {
            this.mixer.setCrossfade(parseInt(slider.value) / 100);
        });
        slider.addEventListener('dblclick', () => {
            slider.value = '50';
            this.mixer.setCrossfade(0.5);
        });
    }

    setupSync() {
        const syncAB = document.getElementById('sync-ab');
        const syncBA = document.getElementById('sync-ba');

        if (syncAB) {
            syncAB.addEventListener('click', () => {
                if (this.deckA && this.deckB) {
                    this.deckB.setBPM(this.deckA.bpm);
                    syncAB.classList.add('flash');
                    setTimeout(() => syncAB.classList.remove('flash'), 300);
                }
            });
        }
        if (syncBA) {
            syncBA.addEventListener('click', () => {
                if (this.deckA && this.deckB) {
                    this.deckA.setBPM(this.deckB.bpm);
                    syncBA.classList.add('flash');
                    setTimeout(() => syncBA.classList.remove('flash'), 300);
                }
            });
        }
    }

    setupMasterVolume() {
        const slider = document.getElementById('master-vol');
        if (!slider) return;
        slider.addEventListener('input', () => {
            this.mixer.setMasterVolume(parseInt(slider.value));
        });
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            switch (e.key.toLowerCase()) {
                case 'q': // Play/stop deck A
                    if (this.deckA?.loaded) this.deckA.togglePlay();
                    break;
                case 'p': // Play/stop deck B
                    if (this.deckB?.loaded) this.deckB.togglePlay();
                    break;
                case ' ': // Play/stop both
                    e.preventDefault();
                    if (this.deckA?.loaded) this.deckA.togglePlay();
                    if (this.deckB?.loaded) this.deckB.togglePlay();
                    break;
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DJApp();
});
