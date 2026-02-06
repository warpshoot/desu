import { TRACKS, DEFAULT_BPM, COLS, SWING_AMOUNT } from './constants.js';

export class AudioEngine {
    constructor() {
        this.initialized = false;
        this.playing = false;
        this.currentStep = 0;
        this.swingEnabled = false;

        // Audio chain components
        this.instruments = [];
        this.distortions = [];
        this.filters = [];
        this.gains = [];
        this.limiter = null;

        // DJ Mode (master filter chain: HPF → LPF → Delay)
        this.djLPF = null;
        this.djHPF = null;
        this.djDelay = null;
        this.djFilterEnabled = false;

        // Mute/Solo state
        this.mutedTracks = [false, false, false, false, false];
        this.soloedTracks = [false, false, false, false, false];

        // Volume state (default 0.7)
        this.trackVolumes = [0.7, 0.7, 0.7, 0.7, 0.7];

        // Callbacks
        this.onStepCallback = null;
        this.onStopCallback = null;

        // Recorder
        this.recorder = null;
        this.isRecording = false;

        // Active configuration (clone of TRACKS to support tuning)
        this.activeTrackConfigs = JSON.parse(JSON.stringify(TRACKS)).map(track => ({
            ...track,
            originalBaseFreq: track.baseFreq // Store original frequency reference
        }));
    }

    presetSettings(settings) {
        if (settings.trackVolumes) this.trackVolumes = settings.trackVolumes;
        if (settings.mutedTracks) this.mutedTracks = settings.mutedTracks;
        if (settings.soloedTracks) this.soloedTracks = settings.soloedTracks;
    }

    async init() {
        if (this.initialized) return;

        await Tone.start();

        // Apply cached master volume if any
        if (this.cachedMasterVolume !== undefined) {
            Tone.Destination.volume.value = this.cachedMasterVolume;
        }

        // Create master DJ effect chain: HPF → LPF → Delay → Limiter
        this.djHPF = new Tone.Filter({
            frequency: 20,
            type: 'highpass',
            rolloff: -24,
            Q: 1
        });
        this.djLPF = new Tone.Filter({
            frequency: 20000,
            type: 'lowpass',
            rolloff: -24,
            Q: 1
        });
        this.djDelay = new Tone.FeedbackDelay({
            delayTime: '8n',
            feedback: 0.4,
            wet: 0
        });

        // Master limiter: -3dB gives headroom for driven kick/bass transients
        this.limiter = new Tone.Limiter(-3).toDestination();

        // Connect chain: HPF → LPF → Delay → Limiter
        this.djHPF.connect(this.djLPF);
        this.djLPF.connect(this.djDelay);
        this.djDelay.connect(this.limiter);

        // Create recorder (default format - browser dependent)
        this.recorder = new Tone.Recorder();
        this.limiter.connect(this.recorder);

        // Create instruments and signal chain for each track
        for (let i = 0; i < TRACKS.length; i++) {
            const track = TRACKS[i];

            // Create instrument
            let instrument;
            switch (track.type) {
                case 'membrane':
                    instrument = new Tone.MembraneSynth({
                        pitchDecay: 0.05,
                        octaves: 7,
                        oscillator: { type: 'sine' },
                        envelope: { attack: 0.01, decay: 0.4, sustain: 0.01, release: 1.0 }
                    });
                    break;
                case 'noise':
                    instrument = new Tone.NoiseSynth({
                        noise: { type: 'white' },
                        envelope: { attack: 0.008, decay: 0.2, sustain: 0 }
                    });
                    break;
                case 'metal':
                    instrument = new Tone.MetalSynth({
                        frequency: 200,
                        envelope: { attack: 0.008, decay: 0.1, release: 0.15 },
                        harmonicity: 5.1,
                        modulationIndex: 32,
                        resonance: 4000,
                        octaves: 1.5
                    });
                    break;
                case 'fm':
                    const isBass = (i === 3);
                    instrument = new Tone.PolySynth(Tone.FMSynth, {
                        maxPolyphony: isBass ? 2 : 6,
                        harmonicity: isBass ? 1 : 3,
                        modulationIndex: isBass ? 14 : 10,
                        detune: 0,
                        oscillator: { type: isBass ? 'triangle' : 'sine' },
                        envelope: { attack: 0.01, decay: 0.2, sustain: isBass ? 0.7 : 0.2, release: 0.4 },
                        modulation: { type: 'square' },
                        modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.4 }
                    });
                    break;
            }

            // Create distortion (drive knob)
            // oversample '4x' eliminates aliasing artifacts from the waveshaper,
            // critical for low-frequency content (kick/bass)
            const distortion = new Tone.Distortion({
                distortion: 0,
                oversample: '4x'
            });

            // Create filter
            const filter = new Tone.Filter({
                frequency: (i === 1 || i === 2) ? 8000 : 2000,
                type: 'lowpass',
                rolloff: -24
            });

            // Create gain (use preset volume if available)
            let initialGain = 0.7;
            if (this.trackVolumes[i] !== undefined) initialGain = this.trackVolumes[i];

            // Check mute/solo context
            const isAnySolo = this.soloedTracks.some(s => s);
            const isMuted = this.mutedTracks[i];
            const isSoloed = this.soloedTracks[i];

            if (isAnySolo) {
                initialGain = isSoloed ? initialGain : 0;
            } else {
                initialGain = isMuted ? 0 : initialGain;
            }

            const gain = new Tone.Gain(initialGain);

            // Connect: instrument -> distortion -> filter -> gain -> djHPF -> djLPF -> djDelay -> limiter
            instrument.connect(distortion);
            distortion.connect(filter);
            filter.connect(gain);
            gain.connect(this.djHPF);

            this.instruments.push(instrument);
            this.distortions.push(distortion);
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

        // Calculate next step (always loop 0 → COLS-1)
        this.currentStep = (this.currentStep + 1) % COLS;
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
        if (this.onStopCallback) {
            this.onStopCallback();
        }
    }

    setStopCallback(callback) {
        this.onStopCallback = callback;
    }

    setBPM(bpm) {
        Tone.Transport.bpm.value = bpm;
    }

    setMasterVolume(db) {
        this.cachedMasterVolume = db;
        if (!this.initialized) return;
        Tone.Destination.volume.value = db;
    }

    setSwing(enabled) {
        this.swingEnabled = enabled;
    }

    triggerNote(track, pitch, duration, time, rollMode = false, rollSubdivision = 1, octaveShift = 0) {
        if (!this.initialized || !this.instruments[track]) return;
        const instrument = this.instruments[track];
        const trackConfig = this.activeTrackConfigs[track];

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
                // Longer gate time lets the envelope release naturally without clipping
                instrument.triggerAttackRelease(freq, noteDuration * 0.6, triggerTime);
            } else if (trackConfig.type === 'noise') {
                // Snare: trigger with duration and time
                const totalPitch = pitch + (octaveShift * 12);
                const freq = Tone.Frequency(trackConfig.baseFreq).transpose(totalPitch);
                instrument.triggerAttackRelease(noteDuration * 0.3, triggerTime);
            } else if (trackConfig.type === 'metal') {
                // Hi-hat (MetalSynth): (frequency, duration, time)
                const totalPitch = pitch + (octaveShift * 12);
                const freq = Tone.Frequency(trackConfig.baseFreq).transpose(totalPitch).toFrequency();
                instrument.triggerAttackRelease(freq, noteDuration * 0.3, triggerTime);
            } else if (trackConfig.type === 'fm') {
                const totalPitch = pitch + (octaveShift * 12);
                const freq = Tone.Frequency(trackConfig.baseFreq).transpose(totalPitch).toFrequency();
                // Longer gate for bass/lead prevents release clipping with drive
                instrument.triggerAttackRelease(freq, noteDuration * 0.7, triggerTime);
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
        if (params.decay !== undefined) {
            const instrument = this.instruments[track];
            // Clamp minimum decay to avoid clicks from ultra-short envelopes
            const safeDecay = Math.max(0.02, params.decay);
            if (instrument.envelope) {
                instrument.envelope.decay = safeDecay;
            } else if (instrument.voice && instrument.voice.envelope) {
                // For PolySynth
                instrument.set({ envelope: { decay: safeDecay } });
            }
        }
        if (params.drive !== undefined) {
            if (this.distortions[track]) {
                // Smooth drive changes to avoid discontinuity clicks
                const target = params.drive / 100;
                const current = this.distortions[track].distortion;
                const diff = target - current;
                if (Math.abs(diff) < 0.01) {
                    this.distortions[track].distortion = target;
                } else {
                    // Interpolate in small steps over ~50ms to avoid pops
                    const steps = 5;
                    const stepSize = diff / steps;
                    for (let s = 0; s < steps; s++) {
                        setTimeout(() => {
                            if (this.distortions[track]) {
                                this.distortions[track].distortion = Math.min(1, Math.max(0, current + stepSize * (s + 1)));
                            }
                        }, s * 10);
                    }
                }
            }
        }
        if (params.tune !== undefined) {
            const trackConfig = this.activeTrackConfigs[track];
            // Update baseFreq based on originalBaseFreq and tune (semitones)
            const originalFreq = trackConfig.originalBaseFreq;

            if (trackConfig.type === 'membrane' || trackConfig.type === 'fm') {
                // Convert to Frequency to handle note names (e.g. "C1") + transposition
                const newFreq = Tone.Frequency(originalFreq).transpose(params.tune).toFrequency();
                trackConfig.baseFreq = newFreq;
            } else if (trackConfig.type === 'metal') {
                // MetalSynth baseFreq is usually a number (e.g. 200)
                // If it's a number, we can't use transpose() directly on it easily without converting to Frequency?
                // Tone.Frequency(800) works.
                const newFreq = Tone.Frequency(originalFreq).transpose(params.tune).toFrequency();
                trackConfig.baseFreq = newFreq;
            }
            // Noise (Snare) doesn't really pitch this way, ignoring for now or could modulate filter if added
        }
        if (params.vol !== undefined) {
            this.trackVolumes[track] = params.vol;
            this.updateTrackGains();
        }
    }

    // DJ Mode effect control (dual filter + delay)
    setDJFilter(lpfCutoff, hpfCutoff, resonance, delayWet) {
        if (!this.initialized || !this.djLPF) return;

        this.djFilterEnabled = true;
        this.djLPF.frequency.rampTo(lpfCutoff, 0.05);
        this.djHPF.frequency.rampTo(hpfCutoff, 0.05);
        this.djLPF.Q.rampTo(resonance, 0.05);
        this.djHPF.Q.rampTo(resonance, 0.05);
        this.djDelay.wet.rampTo(delayWet, 0.05);
    }

    resetDJFilter() {
        if (!this.initialized || !this.djLPF) return;

        this.djFilterEnabled = false;
        this.djLPF.frequency.rampTo(20000, 0.1);
        this.djHPF.frequency.rampTo(20, 0.1);
        this.djLPF.Q.rampTo(1, 0.1);
        this.djHPF.Q.rampTo(1, 0.1);
        this.djDelay.wet.rampTo(0, 0.15);
    }

    dispose() {
        this.stop();
        this.instruments.forEach(inst => inst.dispose());
        this.distortions.forEach(d => d.dispose());
        this.filters.forEach(f => f.dispose());
        this.gains.forEach(g => g.dispose());
        if (this.djLPF) this.djLPF.dispose();
        if (this.djHPF) this.djHPF.dispose();
        if (this.djDelay) this.djDelay.dispose();
        if (this.limiter) this.limiter.dispose();
    }

    updateTrackGains(immediate = false) {
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

            // Apply with ramp to avoid clicks from abrupt gain changes
            if (this.gains[i]) {
                if (immediate) {
                    this.gains[i].gain.cancelScheduledValues(0);
                    this.gains[i].gain.rampTo(targetGain, 0.01);
                } else {
                    this.gains[i].gain.rampTo(targetGain, 0.05);
                }
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

    loadKit(kitData) {
        if (!kitData || !kitData.tracks) return;

        // Update active configuration
        for (let i = 0; i < this.activeTrackConfigs.length; i++) {
            if (kitData.tracks[i]) {
                // Update baseFreq
                if (kitData.tracks[i].baseFreq) {
                    this.activeTrackConfigs[i].baseFreq = kitData.tracks[i].baseFreq;
                }
                // We could also update 'type' by re-creating instruments, but for 'Parameter Kits' we just update params
            }
        }
    }

    async startRecording() {
        if (!this.recorder || this.isRecording) return;

        this.isRecording = true;
        await this.recorder.start();
        console.log('Recording started');
    }

    async stopRecording() {
        if (!this.recorder || !this.isRecording) return;

        this.isRecording = false;
        const recording = await this.recorder.stop();

        // Detect actual file format from MIME type
        const mimeType = recording.type;
        let extension = 'webm'; // default
        if (mimeType.includes('mp4')) {
            extension = 'mp4';
        } else if (mimeType.includes('webm')) {
            extension = 'webm';
        } else if (mimeType.includes('ogg')) {
            extension = 'ogg';
        }

        // Download the recording
        const url = URL.createObjectURL(recording);
        const anchor = document.createElement('a');
        anchor.download = `beat-${Date.now()}.${extension}`;
        anchor.href = url;
        anchor.click();

        // Clean up
        URL.revokeObjectURL(url);
        console.log(`Recording stopped and downloaded as ${extension}`);
    }
}
