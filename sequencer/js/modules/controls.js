export class Controls {
    constructor(audioEngine, onBPMChange) {
        this.audioEngine = audioEngine;
        this.onBPMChange = onBPMChange;
        this.isPlaying = false;

        this.playBtn = document.getElementById('play-btn');
        this.playIcon = this.playBtn.querySelector('.play-icon');
        this.stopIcon = this.playBtn.querySelector('.stop-icon');
        this.bpmSlider = document.getElementById('bpm-slider');
        this.bpmDisplay = document.getElementById('bpm-display');

        this.setupEvents();
    }

    setupEvents() {
        // Play/Stop button
        this.playBtn.addEventListener('click', async () => {
            if (!this.audioEngine.initialized) {
                await this.audioEngine.init();
            }

            if (this.isPlaying) {
                this.stop();
            } else {
                this.play();
            }
        });

        // BPM slider
        this.bpmSlider.addEventListener('input', (e) => {
            const bpm = parseInt(e.target.value);
            this.audioEngine.setBPM(bpm);
            this.showBPMDisplay(bpm);
        });

        this.bpmSlider.addEventListener('change', (e) => {
            const bpm = parseInt(e.target.value);
            this.hideBPMDisplay();
            if (this.onBPMChange) {
                this.onBPMChange(bpm);
            }
        });

        // Hide BPM display on mouse leave
        this.bpmSlider.addEventListener('mouseleave', () => {
            if (!this.bpmSlider.matches(':active')) {
                this.hideBPMDisplay();
            }
        });
    }

    play() {
        this.audioEngine.play();
        this.isPlaying = true;
        this.playIcon.classList.add('hidden');
        this.stopIcon.classList.remove('hidden');
    }

    stop() {
        this.audioEngine.stop();
        this.isPlaying = false;
        this.playIcon.classList.remove('hidden');
        this.stopIcon.classList.add('hidden');
    }

    showBPMDisplay(bpm) {
        this.bpmDisplay.textContent = bpm;
        this.bpmDisplay.classList.remove('hidden');
    }

    hideBPMDisplay() {
        this.bpmDisplay.classList.add('hidden');
    }

    setBPM(bpm) {
        this.bpmSlider.value = bpm;
        this.audioEngine.setBPM(bpm);
    }
}
