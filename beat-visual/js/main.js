import { Player } from './player.js';
import { VisualEngine } from './visual.js';

// --- Setup ---

const canvas = document.getElementById('canvas');
const loadBtn = document.getElementById('loadBtn');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const info = document.getElementById('info');
const fileInput = document.getElementById('fileInput');
const stepDots = document.getElementById('step-dots');

const player = new Player();
const visual = new VisualEngine(canvas);

// Create 16 step dots
for (let i = 0; i < 16; i++) {
    const dot = document.createElement('div');
    dot.className = 'step-dot';
    stepDots.appendChild(dot);
}
const dots = stepDots.querySelectorAll('.step-dot');

// --- Player callbacks ---

player.onStep = (step, patternIndex, tracks) => {
    visual.trigger(step, tracks);
    updateDots(step);
};

function updateDots(step) {
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === step);
        dot.classList.toggle('beat', i === step && step % 4 === 0);
    });
}

// --- Animation loop ---

function loop(now) {
    player.update(now);
    visual.render();
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// --- Load ---

loadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        loadFile(e.target.files[0]);
    }
    fileInput.value = '';
});

// Drag & drop
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
        loadFile(e.dataTransfer.files[0]);
    }
});

function loadFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            player.load(data);
            visual.clear();
            playBtn.disabled = false;
            stopBtn.disabled = false;
            info.textContent = `${data.bpm} BPM / ${data.patterns?.length || 0} patterns`;
            updateDots(-1);
        } catch (err) {
            info.textContent = 'Invalid JSON';
        }
    };
    reader.readAsText(file);
}

// --- Controls ---

playBtn.addEventListener('click', () => {
    if (player.playing) {
        player.pause();
        playBtn.textContent = 'PLAY';
    } else {
        player.play();
        playBtn.textContent = 'PAUSE';
    }
});

stopBtn.addEventListener('click', () => {
    player.stop();
    visual.clear();
    playBtn.textContent = 'PLAY';
    updateDots(-1);
});

// --- Resize ---

window.addEventListener('resize', () => {
    visual.resize();
});

// --- Keyboard ---

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        playBtn.click();
    }
});
