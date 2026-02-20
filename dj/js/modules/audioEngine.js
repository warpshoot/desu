import { COLS, SWING_LEVELS } from './constants.js';

/**
 * DeckAudioEngine - Per-deck audio engine.
 * Supports all synth types from both BEAT and BEEP.
 * Does NOT use Tone.Transport (decks have independent timing).
 * Outputs to a provided Tone.js node (crossfader gain).
 */
export class DeckAudioEngine {
    constructor(tracks, outputNode) {
        this.tracks = tracks;
        this.outputNode = outputNode;
        this.initialized = false;

        // Audio chain
        this.instruments = [];
        this.distortions = [];
        this.trackCompressors = [];
        this.filters = [];
        this.gains = [];

        // DJ master effects
        this.djLPF = null;
        this.djHPF = null;
        this.djDelay = null;
        this.djCrusher = null;
        this.djFolder = null;
        this.djCrushGain = null;
        this.djGate = null;
        this.stutterLFO = null;
        this.compressor = null;
        this.limiter = null;

        // DJ FX state
        this.djLoopEnabled = false;
        this.djSlowEnabled = false;
        this.djStutterEnabled = false;
        this.djCrushEnabled = false;

        // Curves
        this.linearCurve = new Float32Array([-1, 1]);
        this.foldCurve = this._makeWaveFoldCurve();

        // Track state
        this.mutedTracks = new Array(tracks.length).fill(false);
        this.soloedTracks = new Array(tracks.length).fill(false);
        this.trackVolumes = tracks.map(t => t.defaultParams.vol);

        // Active configs (for tune adjustments)
        this.activeTrackConfigs = JSON.parse(JSON.stringify(tracks)).map(t => ({
            ...t, originalBaseFreq: t.baseFreq
        }));
    }

    async init() {
        if (this.initialized) return;
        await Tone.start();

        // DJ effect chain: HPF → LPF → Delay → CrushGain → Folder → Crusher → Gate → Compressor → output
        this.djHPF = new Tone.Filter({ frequency: 20, type: 'highpass', rolloff: -24, Q: 1 });
        this.djLPF = new Tone.Filter({ frequency: 20000, type: 'lowpass', rolloff: -24, Q: 1 });
        this.djDelay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.4, wet: 0 });

        this.djCrusher = new Tone.BitCrusher({ bits: 2, wet: 0 });
        this.djCrushGain = new Tone.Gain(1);
        this.djFolder = new Tone.WaveShaper(this.linearCurve, 4096);
        this.djFolder.oversample = 'none';

        this.djGate = new Tone.Gain(1);
        this.stutterLFO = new Tone.LFO({ frequency: '16n', min: 0, max: 1, type: 'square' });
        this.stutterLFO.connect(this.djGate.gain);

        this.compressor = new Tone.Compressor({
            threshold: -12, ratio: 4, attack: 0.01, release: 0.15, knee: 6
        });

        // Connect: HPF → LPF → Delay → CrushGain → Folder → Crusher → Gate → Compressor → output
        this.djHPF.connect(this.djLPF);
        this.djLPF.connect(this.djDelay);
        this.djDelay.connect(this.djCrushGain);
        this.djCrushGain.connect(this.djFolder);
        this.djFolder.connect(this.djCrusher);
        this.djCrusher.connect(this.djGate);
        this.djGate.connect(this.compressor);
        this.compressor.connect(this.outputNode);

        // Create per-track instruments
        for (let i = 0; i < this.tracks.length; i++) {
            const track = this.tracks[i];
            let instrument;

            switch (track.type) {
                case 'membrane':
                    instrument = new Tone.MembraneSynth({
                        pitchDecay: 0.05, octaves: 7,
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
                        harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5
                    });
                    break;
                case 'fm': {
                    const isBass = (i === 3);
                    instrument = new Tone.PolySynth(Tone.FMSynth, {
                        maxPolyphony: isBass ? 2 : 6,
                        harmonicity: isBass ? 1 : 3,
                        modulationIndex: isBass ? 14 : 10,
                        oscillator: { type: isBass ? 'triangle' : 'sine' },
                        envelope: { attack: 0.01, decay: 0.2, sustain: isBass ? 0.7 : 0.2, release: 0.4 },
                        modulation: { type: 'square' },
                        modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.4 }
                    });
                    break;
                }
                case 'pulse-kick':
                    instrument = new Tone.MembraneSynth({
                        pitchDecay: 0.02, octaves: 4,
                        oscillator: { type: 'square' },
                        envelope: { attack: 0.001, decay: 0.2, sustain: 0.01, release: 0.1 }
                    });
                    break;
                case 'chip-noise':
                    instrument = new Tone.NoiseSynth({
                        noise: { type: 'white' },
                        envelope: { attack: 0.001, decay: 0.1, sustain: 0 }
                    });
                    break;
                case 'pulse':
                    instrument = new Tone.PolySynth(Tone.Synth, {
                        maxPolyphony: 4,
                        oscillator: { type: 'pulse', width: 0.5 },
                        envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1 }
                    });
                    break;
            }

            const waveshaper = new Tone.WaveShaper(this._makeSoftClipCurve(0), 8192);
            waveshaper.oversample = '4x';
            const dcBlocker = new Tone.Filter({ frequency: 15, type: 'highpass', rolloff: -12 });
            const filter = new Tone.Filter({
                frequency: (track.type === 'noise' || track.type === 'chip-noise' || track.type === 'metal') ? 8000 : 2000,
                type: 'lowpass', rolloff: -24
            });

            let initialGain = this.trackVolumes[i];
            const gain = new Tone.Gain(initialGain);

            let trackComp = null;
            if (track.type === 'noise' || track.type === 'chip-noise') {
                trackComp = new Tone.Compressor({
                    threshold: -20, ratio: 6, attack: 0.002, release: 0.08, knee: 10
                });
            }

            instrument.connect(waveshaper);
            waveshaper.connect(dcBlocker);
            dcBlocker.connect(filter);
            if (trackComp) {
                filter.connect(trackComp);
                trackComp.connect(gain);
            } else {
                filter.connect(gain);
            }
            gain.connect(this.djHPF);

            this.instruments.push(instrument);
            this.distortions.push({ waveshaper, dcBlocker });
            this.trackCompressors.push(trackComp);
            this.filters.push(filter);
            this.gains.push(gain);
        }

        this.initialized = true;
    }

    triggerNote(track, pitch, duration, time, rollMode, rollSubdivision, octaveShift, velocity) {
        if (!this.initialized || !this.instruments[track]) return;
        const instrument = this.instruments[track];
        const cfg = this.activeTrackConfigs[track];

        const triggers = rollMode ? rollSubdivision : 1;
        const stepDuration = 60.0 / 120 / 4; // approximate 16th note
        const triggerInterval = stepDuration / triggers;
        const noteDuration = rollMode ? duration * 0.15 : duration;

        let actualVelocity = velocity;
        if (velocity < 1.0) {
            if (cfg.type === 'noise' || cfg.type === 'chip-noise') actualVelocity = 0.7;
            else if (['fm', 'pulse', 'membrane', 'pulse-kick'].includes(cfg.type)) actualVelocity = 0.5;
            else actualVelocity = 0.65;
        }

        for (let i = 0; i < triggers; i++) {
            const t = time + (i * triggerInterval);
            const totalPitch = pitch + ((octaveShift || 0) * 12);

            if (cfg.type === 'membrane' || cfg.type === 'pulse-kick') {
                const freq = Tone.Frequency(cfg.baseFreq).transpose(totalPitch);
                instrument.triggerAttackRelease(freq, noteDuration * 0.6, t, actualVelocity);
            } else if (cfg.type === 'noise' || cfg.type === 'chip-noise') {
                instrument.triggerAttackRelease(noteDuration * 0.3, t, actualVelocity);
            } else if (cfg.type === 'metal') {
                const freq = Tone.Frequency(cfg.baseFreq).transpose(totalPitch).toFrequency();
                instrument.triggerAttackRelease(freq, noteDuration * 0.3, t, actualVelocity);
            } else if (cfg.type === 'fm' || cfg.type === 'pulse') {
                const freq = Tone.Frequency(cfg.baseFreq).transpose(totalPitch).toFrequency();
                instrument.triggerAttackRelease(freq, noteDuration * 0.7, t, actualVelocity);
            }
        }
    }

    updateTrackParams(track, params) {
        if (!this.initialized || !this.filters[track]) return;
        if (params.cutoff !== undefined) this.filters[track].frequency.rampTo(params.cutoff, 0.1);
        if (params.resonance !== undefined) this.filters[track].Q.rampTo(params.resonance, 0.1);
        if (params.decay !== undefined) {
            const inst = this.instruments[track];
            const safeDecay = Math.max(0.02, params.decay);
            if (inst.envelope) inst.envelope.decay = safeDecay;
            else if (inst.set) inst.set({ envelope: { decay: safeDecay } });
        }
        if (params.drive !== undefined) {
            const d = this.distortions[track];
            if (d && d.waveshaper) d.waveshaper.curve = this._makeSoftClipCurve(params.drive / 100);
        }
        if (params.tune !== undefined) {
            const cfg = this.activeTrackConfigs[track];
            if (['membrane', 'fm', 'pulse-kick', 'pulse', 'metal'].includes(cfg.type)) {
                cfg.baseFreq = Tone.Frequency(cfg.originalBaseFreq).transpose(params.tune).toFrequency();
            }
        }
        if (params.vol !== undefined) {
            this.trackVolumes[track] = params.vol;
            this.updateTrackGains();
        }
    }

    // --- DJ Effects ---

    setDJFilter(lpfCutoff, hpfCutoff, resonance, delayWet) {
        if (!this.initialized) return;
        this.djLPF.frequency.rampTo(lpfCutoff, 0.05);
        this.djHPF.frequency.rampTo(hpfCutoff, 0.05);
        this.djLPF.Q.rampTo(resonance, 0.05);
        this.djHPF.Q.rampTo(resonance, 0.05);
        this.djDelay.wet.rampTo(delayWet, 0.05);
    }

    resetDJFilter() {
        if (!this.initialized) return;
        this.djLPF.frequency.rampTo(20000, 0.1);
        this.djHPF.frequency.rampTo(20, 0.1);
        this.djLPF.Q.rampTo(1, 0.1);
        this.djHPF.Q.rampTo(1, 0.1);
        this.djDelay.wet.rampTo(0, 0.15);
    }

    setOctaveShift(shift) {
        if (!this.initialized) return;
        const cents = shift * 1200;
        this.instruments.forEach(inst => {
            if (inst.detune && typeof inst.detune.rampTo === 'function') inst.detune.rampTo(cents, 0.01);
            else if (inst.set) inst.set({ detune: cents });
        });
    }

    enableStutter() {
        if (this.djStutterEnabled || !this.initialized) return;
        this.djStutterEnabled = true;
        this.stutterLFO.connect(this.djGate.gain);
        this.stutterLFO.start();
    }

    disableStutter() {
        if (!this.djStutterEnabled) return;
        this.djStutterEnabled = false;
        this.stutterLFO.stop();
        this.stutterLFO.disconnect();
        this.djGate.gain.value = 1;
    }

    enableCrush() {
        if (this.djCrushEnabled || !this.initialized) return;
        this.djCrushEnabled = true;
        this.djFolder.curve = this.foldCurve;
        this.djCrushGain.gain.rampTo(8, 0.01);
        this.djCrusher.wet.rampTo(1, 0.01);
    }

    disableCrush() {
        if (!this.djCrushEnabled) return;
        this.djCrushEnabled = false;
        this.djFolder.curve = this.linearCurve;
        this.djCrushGain.gain.rampTo(1, 0.05);
        this.djCrusher.wet.rampTo(0, 0.05);
    }

    // --- Track Gains ---

    setTrackMute(track, muted) { this.mutedTracks[track] = muted; this.updateTrackGains(); }
    setTrackSolo(track, soloed) { this.soloedTracks[track] = soloed; this.updateTrackGains(); }

    updateTrackGains() {
        const anySolo = this.soloedTracks.some(s => s);
        for (let i = 0; i < this.gains.length; i++) {
            const base = this.trackVolumes[i] !== undefined ? this.trackVolumes[i] : 0.7;
            let target = base;
            if (anySolo) target = this.soloedTracks[i] ? base : 0;
            else target = this.mutedTracks[i] ? 0 : base;
            if (this.gains[i]) this.gains[i].gain.rampTo(target, 0.05);
        }
    }

    // --- Curves ---

    _makeSoftClipCurve(amount) {
        const n = 8192, curve = new Float32Array(n);
        const k = 1 + amount * 15, norm = 1 / Math.tanh(k);
        for (let i = 0; i < n; i++) {
            const x = (i / (n - 1)) * 2 - 1;
            curve[i] = Math.tanh(x * k) * norm;
        }
        return curve;
    }

    _makeWaveFoldCurve() {
        const n = 4096, curve = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const x = (i / (n - 1)) * 2 - 1;
            curve[i] = Math.abs((x * 4 + 1) % 4 - 2) - 1;
        }
        return curve;
    }

    // --- Cleanup ---

    dispose() {
        this.instruments.forEach(inst => { if (inst) inst.dispose(); });
        this.distortions.forEach(d => { if (d.waveshaper) d.waveshaper.dispose(); if (d.dcBlocker) d.dcBlocker.dispose(); });
        this.trackCompressors.forEach(c => { if (c) c.dispose(); });
        this.filters.forEach(f => { if (f) f.dispose(); });
        this.gains.forEach(g => { if (g) g.dispose(); });
        if (this.djLPF) this.djLPF.dispose();
        if (this.djHPF) this.djHPF.dispose();
        if (this.djDelay) this.djDelay.dispose();
        if (this.djCrusher) this.djCrusher.dispose();
        if (this.djFolder) this.djFolder.dispose();
        if (this.djCrushGain) this.djCrushGain.dispose();
        if (this.djGate) this.djGate.dispose();
        if (this.stutterLFO) this.stutterLFO.dispose();
        if (this.compressor) this.compressor.dispose();
        this.disableStutter();
        this.disableCrush();
    }
}
