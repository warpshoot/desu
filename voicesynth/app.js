// ===== App Controller =====
const engine = new SynthEngine();

// DOM refs
const textInput = document.getElementById('textInput');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const vizCanvas = document.getElementById('vizCanvas');
const vizCtx = vizCanvas.getContext('2d');

// Param elements
const PARAM_IDS = ['pitch', 'rate', 'formant', 'noise', 'vibrato', 'distortion', 'bitcrush', 'reverb', 'volume'];
const paramEls = {};
const paramValEls = {};
PARAM_IDS.forEach(id => {
    paramEls[id] = document.getElementById(id);
    paramValEls[id] = document.getElementById(id + 'Val');
});
const waveEl = document.getElementById('wave');
const waveValEl = document.getElementById('waveVal');

// Sync UI → engine params
function readUIParams() {
    engine.params.pitch = parseFloat(paramEls.pitch.value);
    engine.params.rate = parseFloat(paramEls.rate.value);
    engine.params.formantShift = parseFloat(paramEls.formant.value);
    engine.params.noiseMix = parseFloat(paramEls.noise.value);
    engine.params.vibrato = parseFloat(paramEls.vibrato.value);
    engine.params.distortion = parseFloat(paramEls.distortion.value);
    engine.params.bitCrush = parseFloat(paramEls.bitcrush.value);
    engine.params.reverb = parseFloat(paramEls.reverb.value);
    engine.params.volume = parseFloat(paramEls.volume.value);
    engine.params.wave = waveEl.value;
}

function updateParamDisplay() {
    paramValEls.pitch.textContent = paramEls.pitch.value;
    paramValEls.rate.textContent = parseFloat(paramEls.rate.value).toFixed(2);
    paramValEls.formant.textContent = paramEls.formant.value;
    paramValEls.noise.textContent = paramEls.noise.value;
    paramValEls.vibrato.textContent = paramEls.vibrato.value;
    paramValEls.distortion.textContent = paramEls.distortion.value;
    paramValEls.bitcrush.textContent = paramEls.bitcrush.value;
    paramValEls.reverb.textContent = paramEls.reverb.value;
    paramValEls.volume.textContent = paramEls.volume.value;
    waveValEl.textContent = waveEl.value;
}

// Set UI from params object
function applyParamsToUI(p) {
    paramEls.pitch.value = p.pitch;
    paramEls.rate.value = p.rate;
    paramEls.formant.value = p.formantShift;
    paramEls.noise.value = p.noiseMix;
    paramEls.vibrato.value = p.vibrato;
    paramEls.distortion.value = p.distortion;
    paramEls.bitcrush.value = p.bitCrush;
    paramEls.reverb.value = p.reverb;
    paramEls.volume.value = p.volume;
    waveEl.value = p.wave;
    updateParamDisplay();
    readUIParams();
}

// Param input listeners
PARAM_IDS.forEach(id => {
    paramEls[id].addEventListener('input', () => {
        updateParamDisplay();
        readUIParams();
        clearActivePreset();
    });
});
waveEl.addEventListener('change', () => {
    updateParamDisplay();
    readUIParams();
    clearActivePreset();
});

// Presets
const presetBtns = document.querySelectorAll('.preset-btn');
function clearActivePreset() {
    presetBtns.forEach(b => b.classList.remove('active'));
}

presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const name = btn.dataset.preset;
        const preset = PRESETS[name];
        if (!preset) return;
        presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyParamsToUI(preset);
    });
});

// Play / Stop
playBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();
    if (!text) return;
    if (engine.playing) return;

    readUIParams();
    playBtn.classList.add('playing');
    playBtn.textContent = '● 再生中...';
    startViz();

    await engine.speak(text);

    playBtn.classList.remove('playing');
    playBtn.textContent = '▶ 再生';
    stopViz();
});

stopBtn.addEventListener('click', () => {
    engine.stop();
    playBtn.classList.remove('playing');
    playBtn.textContent = '▶ 再生';
    stopViz();
});

// Visualizer
let vizAnimId = null;

function startViz() {
    if (vizAnimId) return;
    drawViz();
}

function stopViz() {
    if (vizAnimId) {
        cancelAnimationFrame(vizAnimId);
        vizAnimId = null;
    }
    // Clear canvas
    vizCtx.fillStyle = '#111118';
    vizCtx.fillRect(0, 0, vizCanvas.width, vizCanvas.height);
    drawIdleLine();
}

function drawIdleLine() {
    vizCtx.strokeStyle = '#2a2a38';
    vizCtx.lineWidth = 1;
    vizCtx.beginPath();
    vizCtx.moveTo(0, vizCanvas.height / 2);
    vizCtx.lineTo(vizCanvas.width, vizCanvas.height / 2);
    vizCtx.stroke();
}

function drawViz() {
    const data = engine.getAnalyserData();
    const w = vizCanvas.width;
    const h = vizCanvas.height;

    vizCtx.fillStyle = 'rgba(17,17,24,0.3)';
    vizCtx.fillRect(0, 0, w, h);

    if (data) {
        const len = data.length;
        const sliceW = w / len;

        // Glow effect
        vizCtx.shadowBlur = 8;
        vizCtx.shadowColor = '#7c5aff';
        vizCtx.strokeStyle = '#7c5aff';
        vizCtx.lineWidth = 2;
        vizCtx.beginPath();

        for (let i = 0; i < len; i++) {
            const v = data[i] / 128.0;
            const y = (v * h) / 2;
            if (i === 0) vizCtx.moveTo(0, y);
            else vizCtx.lineTo(i * sliceW, y);
        }
        vizCtx.stroke();
        vizCtx.shadowBlur = 0;
    }

    if (engine.playing) {
        vizAnimId = requestAnimationFrame(drawViz);
    } else {
        vizAnimId = null;
        setTimeout(() => {
            vizCtx.fillStyle = '#111118';
            vizCtx.fillRect(0, 0, w, h);
            drawIdleLine();
        }, 300);
    }
}

// Resize canvas
function resizeCanvas() {
    const rect = vizCanvas.parentElement.getBoundingClientRect();
    vizCanvas.width = Math.floor(rect.width);
    vizCanvas.height = 80;
    vizCtx.fillStyle = '#111118';
    vizCtx.fillRect(0, 0, vizCanvas.width, vizCanvas.height);
    drawIdleLine();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Export / Import JSON
document.getElementById('exportBtn').addEventListener('click', () => {
    readUIParams();
    const data = {
        version: 1,
        text: textInput.value,
        voice: { ...engine.params, preset: getActivePreset() }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'voicesynth.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Export完了');
});

function getActivePreset() {
    const active = document.querySelector('.preset-btn.active');
    return active ? active.dataset.preset : 'custom';
}

const fileInput = document.getElementById('fileInput');
document.getElementById('importBtn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            if (data.text) textInput.value = data.text;
            if (data.voice) {
                const v = data.voice;
                engine.params = {
                    pitch: v.pitch ?? 140,
                    rate: v.rate ?? 1,
                    formantShift: v.formantShift ?? 0,
                    noiseMix: v.noiseMix ?? 10,
                    vibrato: v.vibrato ?? 30,
                    distortion: v.distortion ?? 0,
                    bitCrush: v.bitCrush ?? 16,
                    reverb: v.reverb ?? 10,
                    volume: v.volume ?? 80,
                    wave: v.wave ?? 'sine',
                };
                applyParamsToUI(engine.params);
                // Activate preset btn if matching
                if (v.preset && PRESETS[v.preset]) {
                    presetBtns.forEach(b => {
                        b.classList.toggle('active', b.dataset.preset === v.preset);
                    });
                } else {
                    clearActivePreset();
                }
            }
            showToast('Import完了');
        } catch (err) {
            showToast('JSONエラー');
        }
    };
    reader.readAsText(file);
    fileInput.value = '';
});

// Toast
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1500);
}

// Init display
updateParamDisplay();
