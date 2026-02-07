/**
 * Step sequencer timeline player.
 * Reads beat app JSON and advances steps at BPM.
 */

export class Player {
    constructor() {
        this.data = null;
        this.bpm = 120;
        this.playing = false;
        this.currentStep = 0;
        this.currentPatternIndex = 0;
        this.stepInterval = 0;     // ms per step
        this.lastStepTime = 0;

        this.onStep = null;        // callback(step, patternIndex, tracks)
        this.onPatternChange = null;
    }

    load(json) {
        this.data = json;
        this.bpm = json.bpm || 120;
        // 16 steps per bar in 4/4: step = 1/16th note
        // interval = (60 / bpm) * 4 / 16 = 15 / bpm seconds
        this.stepInterval = (15 / this.bpm) * 1000;
        this.currentStep = 0;
        this.currentPatternIndex = 0;
        this.playing = false;
    }

    play() {
        if (!this.data) return;
        this.playing = true;
        this.lastStepTime = performance.now();
    }

    pause() {
        this.playing = false;
    }

    stop() {
        this.playing = false;
        this.currentStep = 0;
        this.currentPatternIndex = 0;
    }

    update(now) {
        if (!this.playing || !this.data) return;

        const elapsed = now - this.lastStepTime;
        if (elapsed < this.stepInterval) return;

        this.lastStepTime = now - (elapsed % this.stepInterval);

        // Get current pattern
        const pattern = this.getCurrentPattern();
        if (!pattern) return;

        // Build step info for each track
        const tracks = pattern.grid.map((trackSteps, trackIndex) => {
            const cell = trackSteps[this.currentStep];
            const params = this.data.trackParams?.[trackIndex] || {};
            const muted = pattern.mutedTracks?.[trackIndex] || false;
            const soloed = pattern.soloedTracks || [];
            const hasSolo = soloed.some(s => s);
            const audible = !muted && (!hasSolo || soloed[trackIndex]);

            return {
                index: trackIndex,
                active: cell.active && audible,
                pitch: cell.pitch || 0,
                duration: cell.duration || 0.5,
                rollMode: cell.rollMode || false,
                rollSubdivision: cell.rollSubdivision || 4,
                params,
                octave: pattern.trackOctaves?.[trackIndex] || 0,
            };
        });

        if (this.onStep) {
            this.onStep(this.currentStep, this.currentPatternIndex, tracks);
        }

        // Advance step
        this.currentStep++;
        if (this.currentStep >= 16) {
            this.currentStep = 0;
            this.advancePattern();
        }
    }

    getCurrentPattern() {
        if (!this.data.patterns) return null;

        if (this.data.chainEnabled && this.data.chain) {
            const chainIdx = this.data.chain[this.currentPatternIndex];
            if (chainIdx != null && this.data.patterns[chainIdx]) {
                return this.data.patterns[chainIdx];
            }
        }

        return this.data.patterns[this.currentPatternIndex] || this.data.patterns[0];
    }

    advancePattern() {
        if (!this.data.chainEnabled || !this.data.chain) {
            // Loop current pattern
            if (this.data.repeatEnabled !== false) return;
            this.playing = false;
            return;
        }

        // Find next non-null chain entry
        let next = this.currentPatternIndex + 1;
        while (next < this.data.chain.length && this.data.chain[next] == null) {
            next++;
        }

        if (next >= this.data.chain.length) {
            // End of chain
            if (this.data.repeatEnabled !== false) {
                this.currentPatternIndex = 0;
            } else {
                this.playing = false;
            }
        } else {
            this.currentPatternIndex = next;
        }

        if (this.onPatternChange) {
            this.onPatternChange(this.currentPatternIndex);
        }
    }

    get patternCount() {
        return this.data?.patterns?.length || 0;
    }

    get scale() {
        const pattern = this.getCurrentPattern();
        return pattern?.scale || 'Chromatic';
    }
}
