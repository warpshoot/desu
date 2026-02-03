# DESU™ rakugakki

Draw colorful musical trajectories and hear them play back as music.

## Features

- **4-Color Pen System**: Red, Blue, Green, Yellow - each with customizable timbre
- **8 Timbres**: Square, Triangle, Sawtooth, Sine, Piano, Bell, Bass, Strings
- **Musical Scales**: Pentatonic, Major, Minor, Blues, Wholetone, Chromatic
- **Playback Modes**: Loop or Ping-Pong
- **DJ Mode**: Real-time filter & resonance control during playback
- **Drawing Tools**: Pen and Eraser
- **Grid Quantization**: Automatic alignment to 16th note grid

## How to Use

1. **Draw**: Click and drag on the canvas to draw lines with the selected color
2. **Play**: Press the Play button to hear your drawing as music
3. **Adjust**: Change speed, scale, and timbre settings
4. **DJ Mode**: While playing, drag on the canvas to control filter (up/down) and resonance (left/right)

## Technical Details

- Built with Web Audio API for sound synthesis
- Canvas-based drawing with grid quantization
- Vertical position maps to pitch based on selected musical scale
- Horizontal position represents time (5 seconds total)
- DJ Mode applies real-time low-pass filter with adjustable cutoff and Q value

## Credits

- Created by [wpy](https://warpshoot.github.io/)
- Part of the [DESU™ universe](https://warpshoot.github.io/desu/)
