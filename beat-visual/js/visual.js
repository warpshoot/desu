/**
 * Visual effects engine.
 * Each track triggers different visual effects on the canvas.
 *
 * Track 0 (Kick)   → Shockwave ring expanding from center
 * Track 1 (Snare)  → Particle burst explosion
 * Track 2 (Hi-hat) → Sparkle scatter
 * Track 3 (Bass)   → Background color pulse
 * Track 4 (Lead)   → Floating orb at pitch-based Y position
 */

// --- Helpers ---

function hsl(h, s, l) {
    return `hsl(${h}, ${s}%, ${l}%)`;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function pitchToHue(pitch, base) {
    // Map pitch (-12 to +12 + octave offsets) to hue 0-360
    return ((base + pitch) * 15 + 360) % 360;
}

// --- Effect Classes ---

class Shockwave {
    constructor(x, y, intensity, hue, decay) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = 150 + intensity * 200;
        this.lineWidth = 3 + intensity * 4;
        this.life = 1.0;
        this.speed = 4 + intensity * 6;
        this.hue = hue;
        this.decayRate = 0.02 + (1 - decay) * 0.03;
    }

    update() {
        this.radius += this.speed;
        this.life -= this.decayRate;
        this.lineWidth *= 0.97;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${this.hue}, 60%, 60%, ${this.life * 0.8})`;
        ctx.lineWidth = this.lineWidth;
        ctx.stroke();
    }

    get dead() { return this.life <= 0; }
}

class Particle {
    constructor(x, y, hue, speed, size, life) {
        const angle = Math.random() * Math.PI * 2;
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed * (0.5 + Math.random());
        this.vy = Math.sin(angle) * speed * (0.5 + Math.random());
        this.size = size;
        this.life = life;
        this.maxLife = life;
        this.hue = hue;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.life -= 0.02;
        this.size *= 0.99;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        const alpha = this.life / this.maxLife;
        ctx.fillStyle = `hsla(${this.hue}, 80%, 65%, ${alpha})`;
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    }

    get dead() { return this.life <= 0; }
}

class Sparkle {
    constructor(x, y, hue) {
        this.x = x;
        this.y = y;
        this.size = 1 + Math.random() * 2;
        this.life = 0.3 + Math.random() * 0.4;
        this.maxLife = this.life;
        this.hue = hue;
    }

    update() {
        this.life -= 0.03;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        const alpha = this.life / this.maxLife;
        const l = 60 + alpha * 30;
        ctx.fillStyle = `hsla(${this.hue}, 50%, ${l}%, ${alpha})`;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }

    get dead() { return this.life <= 0; }
}

class Orb {
    constructor(x, y, hue, size, decay) {
        this.x = x;
        this.y = y;
        this.targetY = y;
        this.size = size;
        this.hue = hue;
        this.life = 1.0;
        this.decayRate = 0.01 + (1 - decay) * 0.02;
    }

    update() {
        this.life -= this.decayRate;
        this.y = lerp(this.y, this.targetY, 0.1);
    }

    draw(ctx) {
        if (this.life <= 0) return;
        const alpha = this.life;
        const glow = this.size * (1 + (1 - this.life) * 0.5);

        // Outer glow
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glow);
        grad.addColorStop(0, `hsla(${this.hue}, 80%, 70%, ${alpha * 0.6})`);
        grad.addColorStop(0.5, `hsla(${this.hue}, 70%, 50%, ${alpha * 0.2})`);
        grad.addColorStop(1, `hsla(${this.hue}, 60%, 40%, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(this.x - glow, this.y - glow, glow * 2, glow * 2);

        // Core
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 90%, 85%, ${alpha})`;
        ctx.fill();
    }

    get dead() { return this.life <= 0; }
}

// --- Main Visual Engine ---

export class VisualEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.effects = [];
        this.bgPulse = 0;       // background pulse intensity
        this.bgHue = 220;       // background hue
        this.currentStep = -1;
        this.resize();
    }

    resize() {
        this.canvas.width = window.innerWidth * devicePixelRatio;
        this.canvas.height = window.innerHeight * devicePixelRatio;
        this.ctx.scale(devicePixelRatio, devicePixelRatio);
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        this.cx = this.w / 2;
        this.cy = this.h / 2;
    }

    trigger(step, tracks) {
        this.currentStep = step;

        for (const track of tracks) {
            if (!track.active) continue;

            const p = track.params;
            const vol = p.vol ?? 0.7;
            const decay = Math.min(1, (p.decay ?? 0.3) / 2.0);  // normalize to 0-1
            const drive = (p.drive ?? 0) / 100;
            const cutoff = p.cutoff ?? 4000;
            const cutoffNorm = Math.log(cutoff / 100) / Math.log(160); // ~0 to 1
            const pitch = track.pitch + (track.octave * 12);

            switch (track.index) {
                case 0: this.triggerKick(vol, decay, drive, pitch); break;
                case 1: this.triggerSnare(vol, decay, drive, cutoffNorm); break;
                case 2: this.triggerHihat(vol, decay, cutoffNorm, pitch); break;
                case 3: this.triggerBass(vol, decay, drive, cutoffNorm, pitch); break;
                case 4: this.triggerLead(vol, decay, cutoffNorm, pitch); break;
            }
        }
    }

    triggerKick(vol, decay, drive, pitch) {
        const hue = 15 + drive * 30;  // orange-red
        const wave = new Shockwave(
            this.cx, this.cy,
            vol, hue, decay
        );
        this.effects.push(wave);

        // Background pulse
        this.bgPulse = Math.max(this.bgPulse, vol * 0.4);
    }

    triggerSnare(vol, decay, drive, cutoffNorm) {
        const hue = 40 + cutoffNorm * 40;  // yellow-orange
        const count = Math.floor(8 + vol * 20);
        const speed = 3 + vol * 5 + drive * 3;
        const size = 2 + vol * 3;

        for (let i = 0; i < count; i++) {
            this.effects.push(new Particle(
                this.cx + (Math.random() - 0.5) * 40,
                this.cy + (Math.random() - 0.5) * 40,
                hue + Math.random() * 30,
                speed,
                size,
                0.3 + decay * 0.7
            ));
        }

        // Flash
        this.bgPulse = Math.max(this.bgPulse, vol * 0.15);
    }

    triggerHihat(vol, decay, cutoffNorm, pitch) {
        const hue = 180 + cutoffNorm * 60;  // cyan-blue
        const count = Math.floor(5 + vol * 10);
        const spread = this.w * 0.6;

        for (let i = 0; i < count; i++) {
            this.effects.push(new Sparkle(
                this.cx + (Math.random() - 0.5) * spread,
                this.cy + (Math.random() - 0.5) * spread * 0.6,
                hue + Math.random() * 20
            ));
        }
    }

    triggerBass(vol, decay, drive, cutoffNorm, pitch) {
        const hue = pitchToHue(pitch, 260);  // purple-blue base
        this.bgHue = lerp(this.bgHue, hue, 0.3);
        this.bgPulse = Math.max(this.bgPulse, vol * 0.25 + drive * 0.15);
    }

    triggerLead(vol, decay, cutoffNorm, pitch) {
        const hue = pitchToHue(pitch, 120);  // green base, shifts with pitch
        // Y position: higher pitch = higher on screen
        const yNorm = 0.5 - (pitch / 36);  // -12 to +12 → 0.83 to 0.17
        const y = this.h * Math.max(0.1, Math.min(0.9, yNorm));
        // X position: slight random spread around center
        const x = this.cx + (Math.random() - 0.5) * this.w * 0.3;
        const size = 10 + vol * 20 + cutoffNorm * 10;

        this.effects.push(new Orb(x, y, hue, size, decay));
    }

    render() {
        const ctx = this.ctx;
        const w = this.w;
        const h = this.h;

        // Background: dark with pulse
        const bgL = 2 + this.bgPulse * 12;
        ctx.fillStyle = `hsl(${this.bgHue}, 30%, ${bgL}%)`;
        ctx.fillRect(0, 0, w, h);

        // Decay background pulse
        this.bgPulse *= 0.92;

        // Update and draw all effects
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const fx = this.effects[i];
            fx.update();
            if (fx.dead) {
                this.effects.splice(i, 1);
            } else {
                fx.draw(ctx);
            }
        }
    }

    clear() {
        this.effects = [];
        this.bgPulse = 0;
        this.currentStep = -1;
        const ctx = this.ctx;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.w, this.h);
    }
}
