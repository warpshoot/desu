/**
 * Mixer - Crossfader and master audio routing.
 * Handles equal-power crossfade between two deck outputs.
 */
export class Mixer {
    constructor() {
        this.gainA = null;
        this.gainB = null;
        this.compressor = null;
        this.limiter = null;
        this.crossfadePosition = 0.5; // 0=A only, 1=B only, 0.5=both equal
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        await Tone.start();

        // Crossfader gains (Deck outputs connect here)
        this.gainA = new Tone.Gain(1);
        this.gainB = new Tone.Gain(1);

        // Master chain
        this.compressor = new Tone.Compressor({
            threshold: -12,
            ratio: 4,
            attack: 0.01,
            release: 0.15,
            knee: 6
        });

        this.limiter = new Tone.Limiter(0).toDestination();

        this.gainA.connect(this.compressor);
        this.gainB.connect(this.compressor);
        this.compressor.connect(this.limiter);

        // Set initial crossfade
        this.setCrossfade(this.crossfadePosition);

        this.initialized = true;
    }

    /**
     * Set crossfader position.
     * @param {number} position - 0 (full A) to 1 (full B)
     */
    setCrossfade(position) {
        this.crossfadePosition = position;
        if (!this.gainA || !this.gainB) return;

        // Equal-power crossfade using cos/sin curves
        const angleA = (1 - position) * Math.PI / 2;
        const angleB = position * Math.PI / 2;
        this.gainA.gain.rampTo(Math.cos(angleB), 0.02);
        this.gainB.gain.rampTo(Math.cos(angleA), 0.02);
    }

    getOutputNodeA() {
        return this.gainA;
    }

    getOutputNodeB() {
        return this.gainB;
    }

    setMasterVolume(db) {
        if (Tone.Destination) {
            Tone.Destination.volume.value = db;
        }
    }

    dispose() {
        if (this.gainA) this.gainA.dispose();
        if (this.gainB) this.gainB.dispose();
        if (this.compressor) this.compressor.dispose();
        if (this.limiter) this.limiter.dispose();
    }
}
