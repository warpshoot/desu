// ===== Phoneme Mapper =====
const VOWELS = ['a', 'i', 'u', 'e', 'o'];

const CONSONANT_INFO = {
    'k': { ctype: 'stop', freq: 2500, dur: 0.04 },
    's': { ctype: 'fric', freq: 6000, dur: 0.09 },
    't': { ctype: 'stop', freq: 3500, dur: 0.03 },
    'n': { ctype: 'nasal', freq: 300, dur: 0.06 },
    'h': { ctype: 'fric', freq: 3000, dur: 0.07 },
    'm': { ctype: 'nasal', freq: 250, dur: 0.07 },
    'r': { ctype: 'tap', freq: 1500, dur: 0.04 },
    'y': { ctype: 'glide', freq: 2200, dur: 0.05 },
    'w': { ctype: 'glide', freq: 700, dur: 0.05 },
    'g': { ctype: 'stop', freq: 2000, dur: 0.04 },
    'z': { ctype: 'fric', freq: 4500, dur: 0.08 },
    'd': { ctype: 'stop', freq: 3000, dur: 0.03 },
    'b': { ctype: 'stop', freq: 1500, dur: 0.04 },
    'p': { ctype: 'stop', freq: 2000, dur: 0.03 },
    'f': { ctype: 'fric', freq: 5000, dur: 0.07 },
    'j': { ctype: 'fric', freq: 3500, dur: 0.07 },
    'ch': { ctype: 'fric', freq: 5500, dur: 0.07 },
    'sh': { ctype: 'fric', freq: 6500, dur: 0.08 },
    'ts': { ctype: 'fric', freq: 5000, dur: 0.06 },
};

// Formant frequencies for Japanese vowels (F1, F2, F3 in Hz)
const FORMANTS = {
    'a': [800, 1200, 2500],
    'i': [270, 2300, 3000],
    'u': [300, 1000, 2300],
    'e': [500, 1800, 2500],
    'o': [450, 800, 2500],
};

// Build kana → phoneme map
const KANA_TO_PHONEME = {};
(function buildKanaMap() {
    const rows = [
        ['あ', 'a', ''], ['い', 'i', ''], ['う', 'u', ''], ['え', 'e', ''], ['お', 'o', ''],
        ['か', 'a', 'k'], ['き', 'i', 'k'], ['く', 'u', 'k'], ['け', 'e', 'k'], ['こ', 'o', 'k'],
        ['さ', 'a', 's'], ['し', 'i', 'sh'], ['す', 'u', 's'], ['せ', 'e', 's'], ['そ', 'o', 's'],
        ['た', 'a', 't'], ['ち', 'i', 'ch'], ['つ', 'u', 'ts'], ['て', 'e', 't'], ['と', 'o', 't'],
        ['な', 'a', 'n'], ['に', 'i', 'n'], ['ぬ', 'u', 'n'], ['ね', 'e', 'n'], ['の', 'o', 'n'],
        ['は', 'a', 'h'], ['ひ', 'i', 'h'], ['ふ', 'u', 'f'], ['へ', 'e', 'h'], ['ほ', 'o', 'h'],
        ['ま', 'a', 'm'], ['み', 'i', 'm'], ['む', 'u', 'm'], ['め', 'e', 'm'], ['も', 'o', 'm'],
        ['や', 'a', 'y'], ['ゆ', 'u', 'y'], ['よ', 'o', 'y'],
        ['ら', 'a', 'r'], ['り', 'i', 'r'], ['る', 'u', 'r'], ['れ', 'e', 'r'], ['ろ', 'o', 'r'],
        ['わ', 'a', 'w'], ['を', 'o', 'w'],
        ['が', 'a', 'g'], ['ぎ', 'i', 'g'], ['ぐ', 'u', 'g'], ['げ', 'e', 'g'], ['ご', 'o', 'g'],
        ['ざ', 'a', 'z'], ['じ', 'i', 'j'], ['ず', 'u', 'z'], ['ぜ', 'e', 'z'], ['ぞ', 'o', 'z'],
        ['だ', 'a', 'd'], ['ぢ', 'i', 'd'], ['づ', 'u', 'd'], ['で', 'e', 'd'], ['ど', 'o', 'd'],
        ['ば', 'a', 'b'], ['び', 'i', 'b'], ['ぶ', 'u', 'b'], ['べ', 'e', 'b'], ['ぼ', 'o', 'b'],
        ['ぱ', 'a', 'p'], ['ぴ', 'i', 'p'], ['ぷ', 'u', 'p'], ['ぺ', 'e', 'p'], ['ぽ', 'o', 'p'],
    ];
    rows.forEach(([kana, vowel, cons]) => {
        KANA_TO_PHONEME[kana] = { vowel, consonant: cons };
        // Katakana: code offset +0x60
        const kata = String.fromCharCode(kana.charCodeAt(0) + 0x60);
        KANA_TO_PHONEME[kata] = { vowel, consonant: cons };
    });
    // ん/ン special
    KANA_TO_PHONEME['ん'] = { vowel: '_n', consonant: '' };
    KANA_TO_PHONEME['ン'] = { vowel: '_n', consonant: '' };
    // Small kana
    'ぁぃぅぇぉ'.split('').forEach((k, i) => {
        KANA_TO_PHONEME[k] = { vowel: VOWELS[i], consonant: '' };
        KANA_TO_PHONEME[String.fromCharCode(k.charCodeAt(0) + 0x60)] = { vowel: VOWELS[i], consonant: '' };
    });
})();

// Convert text to phoneme sequence
function textToPhonemes(text) {
    const phonemes = [];
    const chars = [...text];
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];

        // っ/ッ geminate
        if (ch === 'っ' || ch === 'ッ') {
            phonemes.push({ type: 'pause', dur: 0.1 });
            continue;
        }
        // ー long vowel
        if (ch === 'ー') {
            if (phonemes.length > 0 && phonemes[phonemes.length - 1].type === 'vowel') {
                phonemes[phonemes.length - 1].dur += 0.15;
            }
            continue;
        }

        const mapped = KANA_TO_PHONEME[ch];
        if (mapped) {
            // Add consonant
            if (mapped.consonant && CONSONANT_INFO[mapped.consonant]) {
                const ci = CONSONANT_INFO[mapped.consonant];
                phonemes.push({ type: 'consonant', ctype: ci.ctype, freq: ci.freq, dur: ci.dur });
            }
            // Add vowel or nasal ん
            if (mapped.vowel === '_n') {
                phonemes.push({ type: 'nasal', dur: 0.12 });
            } else if (mapped.vowel) {
                phonemes.push({ type: 'vowel', vowel: mapped.vowel, dur: 0.18 });
            }
            continue;
        }

        // Punctuation / whitespace
        if (' 　、,'.includes(ch)) {
            phonemes.push({ type: 'pause', dur: 0.2 });
            continue;
        }
        if ('。.!?！？'.includes(ch)) {
            phonemes.push({ type: 'pause', dur: 0.35 });
            continue;
        }

        // Basic romaji fallback
        const lower = ch.toLowerCase();
        if (VOWELS.includes(lower)) {
            phonemes.push({ type: 'vowel', vowel: lower, dur: 0.18 });
        } else if (CONSONANT_INFO[lower]) {
            const ci = CONSONANT_INFO[lower];
            phonemes.push({ type: 'consonant', ctype: ci.ctype, freq: ci.freq, dur: ci.dur });
        }
    }
    return phonemes;
}


// ===== Voice Presets =====
const PRESETS = {
    normal: {
        pitch: 140, rate: 1.0, formantShift: 0,
        noiseMix: 10, vibrato: 30, distortion: 0,
        bitCrush: 16, reverb: 10, volume: 80, wave: 'sine'
    },
    robot: {
        pitch: 120, rate: 0.8, formantShift: -2,
        noiseMix: 5, vibrato: 0, distortion: 20,
        bitCrush: 4, reverb: 5, volume: 80, wave: 'square'
    },
    demon: {
        pitch: 60, rate: 0.6, formantShift: -8,
        noiseMix: 30, vibrato: 15, distortion: 80,
        bitCrush: 12, reverb: 70, volume: 80, wave: 'sawtooth'
    },
    whisper: {
        pitch: 200, rate: 1.2, formantShift: 4,
        noiseMix: 90, vibrato: 5, distortion: 0,
        bitCrush: 16, reverb: 30, volume: 60, wave: 'sine'
    },
    chipmunk: {
        pitch: 400, rate: 1.8, formantShift: 8,
        noiseMix: 5, vibrato: 40, distortion: 0,
        bitCrush: 16, reverb: 15, volume: 80, wave: 'triangle'
    },
};


// ===== Synth Engine =====
class SynthEngine {
    constructor() {
        this.ctx = null;
        this.playing = false;
        this.stopRequested = false;
        this.analyser = null;
        this.params = { ...PRESETS.normal };
        this._activeNodes = []; // prevent GC
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.connect(this.ctx.destination);
    }

    stop() {
        this.stopRequested = true;
        this.playing = false;
        // Stop all active source nodes
        this._activeNodes.forEach(n => { try { n.stop(); } catch (e) { } });
        this._activeNodes = [];
    }

    createReverbIR(duration, decay) {
        const len = this.ctx.sampleRate * duration;
        const ir = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = ir.getChannelData(ch);
            for (let i = 0; i < len; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
            }
        }
        return ir;
    }

    makeDistortionCurve(amount) {
        const k = amount * 4;
        const samples = 44100;
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    createBitCrusher(bits) {
        const bufSize = 4096;
        const node = this.ctx.createScriptProcessor(bufSize, 1, 1);
        const step = Math.pow(0.5, bits);
        let lastSample = 0;
        let counter = 0;
        const reduction = Math.max(1, Math.floor(17 - bits));
        node.onaudioprocess = (e) => {
            const inp = e.inputBuffer.getChannelData(0);
            const out = e.outputBuffer.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
                counter++;
                if (counter >= reduction) {
                    counter = 0;
                    lastSample = step * Math.floor(inp[i] / step + 0.5);
                }
                out[i] = lastSample;
            }
        };
        return node;
    }

    // Create a noise buffer source
    _makeNoise(dur) {
        const src = this.ctx.createBufferSource();
        const buf = this.ctx.createBuffer(1, Math.max(1, this.ctx.sampleRate * dur), this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        src.buffer = buf;
        return src;
    }

    async speak(text) {
        this.init();
        if (this.ctx.state === 'suspended') await this.ctx.resume();

        this.playing = true;
        this.stopRequested = false;
        this._activeNodes = [];

        const phonemes = textToPhonemes(text);
        if (phonemes.length === 0) { this.playing = false; return; }

        const p = this.params;
        const baseRate = p.rate;
        const basePitch = p.pitch;
        const formantMul = Math.pow(2, p.formantShift / 12);
        const noiseMix = p.noiseMix / 100;
        const vibratoAmt = p.vibrato / 100;
        const vol = p.volume / 100;

        // === Build effect chain ===
        const masterGain = this.ctx.createGain();
        masterGain.gain.value = vol;
        let lastNode = masterGain;

        if (p.distortion > 0) {
            const dist = this.ctx.createWaveShaper();
            dist.curve = this.makeDistortionCurve(p.distortion / 100);
            dist.oversample = '4x';
            lastNode.connect(dist);
            lastNode = dist;
        }

        if (p.bitCrush < 16) {
            const crusher = this.createBitCrusher(p.bitCrush);
            lastNode.connect(crusher);
            lastNode = crusher;
        }

        if (p.reverb > 5) {
            const wet = p.reverb / 100;
            const dryGain = this.ctx.createGain();
            dryGain.gain.value = 1 - wet * 0.5;
            const wetGain = this.ctx.createGain();
            wetGain.gain.value = wet;
            const convolver = this.ctx.createConvolver();
            convolver.buffer = this.createReverbIR(2, 2.5);
            const merger = this.ctx.createGain();
            lastNode.connect(dryGain);
            lastNode.connect(convolver);
            convolver.connect(wetGain);
            dryGain.connect(merger);
            wetGain.connect(merger);
            lastNode = merger;
        }

        lastNode.connect(this.analyser);

        // === Schedule each phoneme ===
        let t = this.ctx.currentTime + 0.05;

        for (const ph of phonemes) {
            if (this.stopRequested) break;

            const dur = (ph.dur || 0.15) / baseRate;

            // --- Pause ---
            if (ph.type === 'pause') {
                t += dur;
                continue;
            }

            // --- Consonant ---
            if (ph.type === 'consonant') {
                const noise = this._makeNoise(dur);
                const bp = this.ctx.createBiquadFilter();
                bp.type = 'bandpass';
                bp.frequency.value = (ph.freq || 3000) * formantMul;
                bp.Q.value = ph.ctype === 'fric' ? 2 : 5;

                const env = this.ctx.createGain();
                env.gain.setValueAtTime(0, t);
                if (ph.ctype === 'stop') {
                    // Burst: quick attack, quick decay
                    env.gain.linearRampToValueAtTime(0.5, t + dur * 0.1);
                    env.gain.exponentialRampToValueAtTime(0.01, t + dur);
                } else if (ph.ctype === 'fric') {
                    env.gain.linearRampToValueAtTime(0.35, t + dur * 0.15);
                    env.gain.setValueAtTime(0.3, t + dur * 0.7);
                    env.gain.linearRampToValueAtTime(0, t + dur);
                } else {
                    // nasal, tap, glide consonants
                    env.gain.linearRampToValueAtTime(0.3, t + dur * 0.2);
                    env.gain.linearRampToValueAtTime(0, t + dur);
                }

                noise.connect(bp);
                bp.connect(env);
                env.connect(masterGain);
                noise.start(t);
                noise.stop(t + dur);
                this._activeNodes.push(noise);

                // For glide/nasal consonants, also add a tonal component
                if (ph.ctype === 'nasal' || ph.ctype === 'glide') {
                    const osc = this.ctx.createOscillator();
                    osc.type = p.wave;
                    osc.frequency.value = basePitch;
                    const g = this.ctx.createGain();
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(0.2, t + dur * 0.3);
                    g.gain.linearRampToValueAtTime(0, t + dur);
                    const lp = this.ctx.createBiquadFilter();
                    lp.type = 'lowpass';
                    lp.frequency.value = 500 * formantMul;
                    osc.connect(lp);
                    lp.connect(g);
                    g.connect(masterGain);
                    osc.start(t);
                    osc.stop(t + dur);
                    this._activeNodes.push(osc);
                }

                t += dur;
                continue;
            }

            // --- Nasal (ん) ---
            if (ph.type === 'nasal') {
                const osc = this.ctx.createOscillator();
                osc.type = p.wave;
                osc.frequency.value = basePitch;

                const lp = this.ctx.createBiquadFilter();
                lp.type = 'lowpass';
                lp.frequency.value = 400 * formantMul;
                lp.Q.value = 1;

                const env = this.ctx.createGain();
                env.gain.setValueAtTime(0, t);
                env.gain.linearRampToValueAtTime(0.3, t + dur * 0.15);
                env.gain.setValueAtTime(0.3, t + dur * 0.75);
                env.gain.linearRampToValueAtTime(0, t + dur);

                osc.connect(lp);
                lp.connect(env);
                env.connect(masterGain);
                osc.start(t);
                osc.stop(t + dur);
                this._activeNodes.push(osc);

                t += dur;
                continue;
            }

            // --- Vowel ---
            if (ph.type === 'vowel') {
                const formant = FORMANTS[ph.vowel] || FORMANTS['a'];

                // Main oscillator
                const osc = this.ctx.createOscillator();
                osc.type = p.wave;
                osc.frequency.value = basePitch;
                this._activeNodes.push(osc);

                // Vibrato
                if (vibratoAmt > 0) {
                    const lfo = this.ctx.createOscillator();
                    const lfoG = this.ctx.createGain();
                    lfo.frequency.value = 5.5;
                    lfoG.gain.value = basePitch * 0.05 * vibratoAmt;
                    lfo.connect(lfoG);
                    lfoG.connect(osc.frequency);
                    lfo.start(t);
                    lfo.stop(t + dur);
                    this._activeNodes.push(lfo);
                }

                // 3 parallel formant filters
                const fMerge = this.ctx.createGain();
                fMerge.gain.value = 0.4;

                for (let fi = 0; fi < 3; fi++) {
                    const bp = this.ctx.createBiquadFilter();
                    bp.type = 'bandpass';
                    bp.frequency.value = formant[fi] * formantMul;
                    bp.Q.value = [5, 10, 12][fi];
                    osc.connect(bp);
                    bp.connect(fMerge);
                }

                // Amplitude envelope
                const env = this.ctx.createGain();
                env.gain.setValueAtTime(0.001, t);
                env.gain.linearRampToValueAtTime(0.7, t + dur * 0.1);
                env.gain.setValueAtTime(0.6, t + dur * 0.75);
                env.gain.linearRampToValueAtTime(0.001, t + dur);

                fMerge.connect(env);

                // Breathy noise layer
                if (noiseMix > 0.02) {
                    const nSrc = this._makeNoise(dur);
                    const nBp = this.ctx.createBiquadFilter();
                    nBp.type = 'bandpass';
                    nBp.frequency.value = formant[1] * formantMul;
                    nBp.Q.value = 1.5;
                    const nEnv = this.ctx.createGain();
                    nEnv.gain.setValueAtTime(0, t);
                    nEnv.gain.linearRampToValueAtTime(noiseMix * 0.5, t + dur * 0.1);
                    nEnv.gain.setValueAtTime(noiseMix * 0.4, t + dur * 0.8);
                    nEnv.gain.linearRampToValueAtTime(0, t + dur);

                    nSrc.connect(nBp);
                    nBp.connect(nEnv);
                    nEnv.connect(env);
                    nSrc.start(t);
                    nSrc.stop(t + dur);
                    this._activeNodes.push(nSrc);
                }

                env.connect(masterGain);
                osc.start(t);
                osc.stop(t + dur);

                t += dur;
                continue;
            }
        }

        // Wait for all scheduled sounds to finish
        const endTime = t - this.ctx.currentTime;
        const waitMs = Math.max(100, endTime * 1000 + 500);
        await new Promise(r => setTimeout(r, waitMs));

        this.playing = false;
        this._activeNodes = [];
        try { masterGain.disconnect(); } catch (e) { }
    }

    getAnalyserData() {
        if (!this.analyser) return null;
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteTimeDomainData(data);
        return data;
    }
}
