import { TRACKS, DEFAULT_BPM, COLS, SWING_AMOUNT } from './constants.js';

export class AudioEngine {
    constructor() {
        this.initialized = false;
        this.playing = false;
        this.currentStep = 0;
        this.swingEnabled = false;

        this.loopStart = 0;
        this.loopEnd = COLS - 1;
        this.loopEnabled = true;

        // Audio chain components
        this.instruments = [];
        this.filters = [];
        this.gains = [];
        this.limiter = null;

        // Mute/Solo state
        this.mutedTracks = [false, false, false, false, false];
        this.soloedTracks = [false, false, false, false, false];

        // Volume state (default 0.7)
        this.trackVolumes = [0.7, 0.7, 0.7, 0.7, 0.7];

        // Callbacks
        this.onStepCallback = null;
    }

    async init() {
        if (this.initialized) return;

        await Tone.start();

        // Create master limiter
        this.limiter = new Tone.Limiter(-3).toDestination();

        // Create instruments and signal chain for each track
        for (let i = 0; i < TRACKS.length; i++) {
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
                        envelope: { attack: 0.001, decay: 0.1, release: 0.1 },
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
                frequency: (i === 1 || i === 2) ? 8000 : 2000,
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
        Tone.Transport.scheduleRepeat((time) => {
            this.onStep(time);
        }, '16n');

        this.initialized = true;
    }

    onStep(time) {
        // Apply swing: delay even steps
        let adjustedTime = time;
        if (this.swingEnabled && this.currentStep % 2 === 1) {
            const stepDuration = Tone.Time('16n').toSeconds();
            adjustedTime += stepDuration * SWING_AMOUNT;
        }

        if (this.onStepCallback) {
            this.onStepCallback(this.currentStep, adjustedTime);
        }

        // Calculate next step
        const nextStep = this.currentStep + 1;

        if (this.loopEnabled) {
            // Wrap within loop range
            this.currentStep = (nextStep > this.loopEnd) ? this.loopStart : nextStep;
        } else {
            // Stop at end of range or COLS
            if (nextStep > this.loopEnd || nextStep >= COLS) {
                Tone.Transport.scheduleOnce(() => {
                    this.stop();
                }, "+16n");
            } else {
                this.currentStep = nextStep;
            }
        }
    }

    setLoopRange(start, end, enabled) {
        this.loopStart = start;
        this.loopEnd = end;
        this.loopEnabled = enabled;

        // If current step is outside new range, jump to start
        if (this.currentStep < this.loopStart || this.currentStep > this.loopEnd) {
            this.currentStep = this.loopStart;
        }
    }

    setStepCallback(callback) {
        this.onStepCallback = callback;
    }

    play() {
        if (!this.initialized) return;
        Tone.Transport.start("+0.1");
        this.playing = true;
    }

    pause() {
        if (!this.initialized) return;
        Tone.Transport.pause();
        this.playing = false;
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

    setMasterVolume(db) {
        if (!this.initialized) return;
        Tone.Destination.volume.value = db;
    }

    setSwing(enabled) {
        this.swingEnabled = enabled;
    }

    triggerNote(track, pitch, duration, time, rollMode = false, rollSubdivision = 1, octaveShift = 0) {
        if (!this.initialized || !this.instruments[track]) return;
        const instrument = this.instruments[track];
        const trackConfig = TRACKS[track];

        // Calculate number of triggers
        const triggers = rollMode ? rollSubdivision : 1;

        // Calculate time between triggers (within one 16th note)
        const stepDuration = Tone.Time('16n').toSeconds();
        const triggerInterval = stepDuration / triggers;

        // Shorten note duration for rolls to avoid overlap
        const noteDuration = rollMode ? duration * 0.15 : duration;

        for (let i = 0; i < triggers; i++) {
            const triggerTime = time + (i * triggerInterval);

            if (trackConfig.type === 'membrane') {
                const totalPitch = pitch + (octaveShift * 12);
                const freq = Tone.Frequency(trackConfig.baseFreq).transpose(totalPitch);
                instrument.triggerAttackRelease(freq, noteDuration * 0.3, triggerTime);
            } else if (trackConfig.type === 'noise') {
                // Snare: trigger with duration and time
                const totalPitch = pitch + (octaveShift * 12);
                const freq = Tone.Frequency(trackConfig.baseFreq).transpose(totalPitch);
                instrument.triggerAttackRelease(noteDuration * 0.2, triggerTime);
            } else if (trackConfig.type === 'metal') {
                // Hi-hat (MetalSynth): (frequency, duration, time)
                const totalPitch = pitch + (octaveShift * 12);
                const freq = Tone.Frequency(trackConfig.baseFreq).transpose(totalPitch).toFrequency();
                instrument.triggerAttackRelease(freq, noteDuration * 0.2, triggerTime);
            } else if (trackConfig.type === 'fm') {
                const totalPitch = pitch + (octaveShift * 12);
                const freq = Tone.Frequency(trackConfig.baseFreq).transpose(totalPitch).toFrequency();
                instrument.triggerAttackRelease(freq, noteDuration * 0.5, triggerTime);
            }
        }
    }

    updateTrackParams(track, params) {
        if (!this.initialized || !this.filters[track]) return;

        // Apply immediately
        if (params.cutoff !== undefined) {
            // Filter frequency is likely a signal
            this.filters[track].frequency.rampTo(params.cutoff, 0.1);
        }
        if (params.resonance !== undefined) {
            this.filters[track].Q.rampTo(params.resonance, 0.1);
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
                if (instrument.harmonicity.rampTo) instrument.harmonicity.rampTo(3 + (params.modulation / 100) * 5, 0.1);
                else instrument.harmonicity = 3 + (params.modulation / 100) * 5;
            } else if (trackType === 'fm') {
                // Synth: modulate FM depth
                instrument.set({ modulationIndex: (params.modulation / 100) * 20 });
            }
        }
        if (params.vol !== undefined) {
            this.trackVolumes[track] = params.vol;
            this.updateTrackGains();
        }
    }

    dispose() {
        this.stop();
        this.instruments.forEach(inst => inst.dispose());
        this.filters.forEach(f => f.dispose());
        this.gains.forEach(g => g.dispose());
        if (this.limiter) this.limiter.dispose();
    }

    updateTrackGains() {
        const isAnySolo = this.soloedTracks.some(s => s);

        for (let i = 0; i < this.gains.length; i++) {
            const isMuted = this.mutedTracks[i];
            const isSoloed = this.soloedTracks[i];
            const baseVol = this.trackVolumes[i] !== undefined ? this.trackVolumes[i] : 0.7;

            let targetGain = baseVol;

            if (isAnySolo) {
                targetGain = isSoloed ? baseVol : 0;
            } else {
                targetGain = isMuted ? 0 : baseVol;
            }

            // Apply smoothly
            if (this.gains[i]) {
                this.gains[i].gain.rampTo(targetGain, 0.05);
            }
        }
    }

    setTrackMute(track, muted) {
        this.mutedTracks[track] = muted;
        this.updateTrackGains();
    }

    setTrackSolo(track, soloed) {
        this.soloedTracks[track] = soloed;
        this.updateTrackGains();
    }
}
