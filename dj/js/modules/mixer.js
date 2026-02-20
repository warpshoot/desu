/**
 * Mixer - Crossfader and master audio routing.
 * Equal-power crossfade between two deck outputs.
 */
export class Mixer {
    constructor() {
        this.gainA = null;
        this.gainB = null;
        this.limiter = null;
        this.crossfadePosition = 0.5;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        await Tone.start();

        this.gainA = new Tone.Gain(1);
        this.gainB = new Tone.Gain(1);
        this.limiter = new Tone.Limiter(0).toDestination();

        this.gainA.connect(this.limiter);
        this.gainB.connect(this.limiter);

        this.setCrossfade(this.crossfadePosition);
        this.initialized = true;
    }

    setCrossfade(position) {
        this.crossfadePosition = position;
        if (!this.gainA || !this.gainB) return;
        // Equal-power crossfade
        const angleA = (1 - position) * Math.PI / 2;
        const angleB = position * Math.PI / 2;
        this.gainA.gain.rampTo(Math.cos(angleB), 0.02);
        this.gainB.gain.rampTo(Math.cos(angleA), 0.02);
    }

    getOutputNodeA() { return this.gainA; }
    getOutputNodeB() { return this.gainB; }

    setMasterVolume(db) {
        if (Tone.Destination) Tone.Destination.volume.value = db;
    }

    dispose() {
        if (this.gainA) this.gainA.dispose();
        if (this.gainB) this.gainB.dispose();
        if (this.limiter) this.limiter.dispose();
    }
}
