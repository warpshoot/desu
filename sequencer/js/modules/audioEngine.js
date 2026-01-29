import { TRACKS, DEFAULT_BPM } from './constants.js';

export class AudioEngine {
    constructor() {
        this.initialized = false;
        this.playing = false;
        this.currentStep = 0;

        // Audio chain components
        this.instruments = [];
        this.filters = [];
        this.gains = [];
        this.limiter = null;

        // Callbacks
        this.onStepCallback = null;
    }

    async init() {
        if (this.initialized) return;

        await Tone.start();

        // Create master limiter
        this.limiter = new Tone.Limiter(-3).toDestination();

        // Create instruments and signal chain for each track
        for (let i = 0; i < 4; i++) {
            const track = TRACKS[i];

            // Create instrument
            let instrument;
            switch (track.type) {
                case 'membrane':
                    instrument = new Tone.MembraneSynth({
                        pitchDecay: 0.05,
                        octaves: 10,
                        oscillator: { type: 'sine' },
                        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }
                    });
                    break;
                case 'noise':
                    instrument = new Tone.NoiseSynth({
                        noise: { type: 'white' },
                        envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
                    });
                    break;
                case 'metal':
                    instrument = new Tone.MetalSynth({
                        frequency: 200,
                        envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
                        harmonicity: 5.1,
                        modulationIndex: 32,
                        resonance: 4000,
                        octaves: 1.5
                    });
                    break;
                case 'fm':
                    instrument = new Tone.PolySynth(Tone.FMSynth, {
                        harmonicity: 3,
                        modulationIndex: 10,
                        detune: 0,
                        oscillator: { type: 'sine' },
                        envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.5 },
                        modulation: { type: 'square' },
                        modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.5 }
                    });
                    break;
            }

            // Create filter
            const filter = new Tone.Filter({
                frequency: 2000,
                type: 'lowpass',
                rolloff: -24
            });

            // Create gain
            const gain = new Tone.Gain(0.7);

            // Connect: instrument -> filter -> gain -> limiter
            instrument.connect(filter);
            filter.connect(gain);
            gain.connect(this.limiter);

            this.instruments.push(instrument);
            this.filters.push(filter);
            this.gains.push(gain);
        }

        // Set up transport
        Tone.Transport.bpm.value = DEFAULT_BPM;
        Tone.Transport.scheduleRepeat((time) => {
            this.onStep(time);
        }, '16n');

        this.initialized = true;
    }

    onStep(time) {
        if (this.onStepCallback) {
            this.onStepCallback(this.currentStep, time);
        }
        this.currentStep = (this.currentStep + 1) % 16;
    }

    setStepCallback(callback) {
        this.onStepCallback = callback;
    }

    play() {
        if (!this.initialized) return;
        Tone.Transport.start();
        this.playing = true;
    }

    stop() {
        if (!this.initialized) return;
        Tone.Transport.stop();
        this.currentStep = 0;
        this.playing = false;
    }

    setBPM(bpm) {
        Tone.Transport.bpm.value = bpm;
    }

    triggerNote(track, pitch, duration, time) {
        const instrument = this.instruments[track];
        const trackConfig = TRACKS[track];

        if (trackConfig.type === 'membrane') {
            // Kick: pitch affects frequency
            const freq = Tone.Frequency(trackConfig.baseFreq).transpose(pitch);
            instrument.triggerAttackRelease(freq, duration * 0.3, time);
        } else if (trackConfig.type === 'noise' || trackConfig.type === 'metal') {
            // Snare/Hi-hat: no pitch, just trigger
            instrument.triggerAttackRelease(duration * 0.2, time);
        } else if (trackConfig.type === 'fm') {
            // Synth: polyphonic with pitch
            const freq = Tone.Frequency(trackConfig.baseFreq).transpose(pitch);
            instrument.triggerAttackRelease(freq, duration * 0.5, time);
        }
    }

    updateTrackParams(track, params) {
        Tone.Transport.scheduleOnce(() => {
            if (params.cutoff !== undefined) {
                this.filters[track].frequency.value = params.cutoff;
            }
            if (params.resonance !== undefined) {
                this.filters[track].Q.value = params.resonance;
            }
            if (params.release !== undefined) {
                const instrument = this.instruments[track];
                if (instrument.envelope) {
                    instrument.envelope.release = params.release;
                } else if (instrument.voice && instrument.voice.envelope) {
                    // For PolySynth
                    instrument.set({ envelope: { release: params.release } });
                }
            }
            if (params.modulation !== undefined) {
                const instrument = this.instruments[track];
                const trackType = TRACKS[track].type;

                if (trackType === 'membrane') {
                    // Kick: modulate pitch decay
                    instrument.pitchDecay = 0.01 + (params.modulation / 100) * 0.1;
                } else if (trackType === 'noise') {
                    // Snare: modulate noise color (brown to white)
                    const types = ['brown', 'pink', 'white'];
                    const index = Math.floor((params.modulation / 100) * (types.length - 1));
                    instrument.noise.type = types[index];
                } else if (trackType === 'metal') {
                    // Hi-hat: modulate harmonicity
                    instrument.harmonicity = 3 + (params.modulation / 100) * 5;
                } else if (trackType === 'fm') {
                    // Synth: modulate FM depth
                    instrument.set({ modulationIndex: (params.modulation / 100) * 20 });
                }
            }
        }, Tone.now());
    }

    dispose() {
        this.stop();
        this.instruments.forEach(inst => inst.dispose());
        this.filters.forEach(f => f.dispose());
        this.gains.forEach(g => g.dispose());
        if (this.limiter) this.limiter.dispose();
    }
}
