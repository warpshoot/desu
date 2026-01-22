const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const controls = document.getElementById('controls');
const outputCanvas = document.getElementById('outputCanvas');
const ctx = outputCanvas.getContext('2d');
const generateBtn = document.getElementById('generateBtn');
const resetBtn = document.getElementById('resetBtn');
const generatingOverlay = document.getElementById('generating-overlay');
const progressText = document.getElementById('progress-text');
const sizeDisplay = document.getElementById('sizeDisplay');

// Levels UI
const levelsTrack = document.getElementById('levelsTrack');
const blackHandle = document.getElementById('blackHandle');
const midHandle = document.getElementById('midHandle');
const whiteHandle = document.getElementById('whiteHandle');

// State
let sourceImage = null;
let processedImage = null; // This will hold the RESIZED image (color)
let currentNoiseLevel = 1;
let currentScale = 1;

// Levels State
let blackPoint = 0;
let midPoint = 128;
let whitePoint = 255;
let processingTimeout = null;

// Noise Configuration
// Level 1: Micro jitter (1px) - Liquid effect
// Level 2: Scanline Shift - VHS Tracking error effect
// Level 3: Dust/Grain - Retro film dust
// Level 4: Block Glitch - Digital corruption (MPEG artifact style)
// Level 5: Vertical Jump - Analog roll/sync failure
const noiseLevelSettings = {
    1: { mode: 'jitter', maxDist: 1, percentages: [0.1, 0.3, 0.3] },
    2: { mode: 'scanline', maxShift: 20 },
    3: { mode: 'grain', amount: 0.05 },
    4: { mode: 'block', blockSize: 32, probability: 0.1, maxShift: 15 },
    5: { mode: 'vjump', maxShift: 15 } // Vertical jump amount
};

// Event Listeners
document.getElementById('noiseButtons').addEventListener('click', (e) => {
    if (e.target.classList.contains('option-btn')) {
        document.querySelectorAll('#noiseButtons .option-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentNoiseLevel = parseInt(e.target.dataset.noise);
        updatePreview();
    }
});

document.getElementById('scaleButtons').addEventListener('click', (e) => {
    if (e.target.classList.contains('option-btn')) {
        document.querySelectorAll('#scaleButtons .option-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentScale = parseInt(e.target.dataset.scale);
        updateSizeDisplay();
    }
});

// Levels Slider Logic
function initLevelsSlider() {
    function updateHandlePosition(handle, value) {
        const percentage = (value / 255) * 100;
        handle.style.left = `${percentage}%`;
    }

    updateHandlePosition(blackHandle, blackPoint);
    updateHandlePosition(midHandle, midPoint);
    updateHandlePosition(whiteHandle, whitePoint);

    let draggingHandle = null;
    let trackRect = null;

    function startDrag(handle, e) {
        e.preventDefault();
        draggingHandle = handle;
        trackRect = levelsTrack.getBoundingClientRect();
        handle.classList.add('dragging');
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchmove', onDrag);
        document.addEventListener('touchend', stopDrag);
    }

    function onDrag(e) {
        if (!draggingHandle) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const x = clientX - trackRect.left;
        const percentage = Math.max(0, Math.min(100, (x / trackRect.width) * 100));
        const value = Math.round((percentage / 100) * 255);

        const pointType = draggingHandle.dataset.point;

        // Allow free movement for flexibility
        if (pointType === 'black') blackPoint = value;
        else if (pointType === 'mid') midPoint = value;
        else if (pointType === 'white') whitePoint = value;

        updateHandlePosition(blackHandle, blackPoint);
        updateHandlePosition(midHandle, midPoint);
        updateHandlePosition(whiteHandle, whitePoint);

        // Debounce processing
        if (processedImage) {
            clearTimeout(processingTimeout);
            processingTimeout = setTimeout(() => {
                updatePreview();
            }, 50);
        }
    }

    function stopDrag() {
        if (draggingHandle) {
            draggingHandle.classList.remove('dragging');
            draggingHandle = null;
        }
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', onDrag);
        document.removeEventListener('touchend', stopDrag);
    }

    blackHandle.addEventListener('mousedown', (e) => startDrag(blackHandle, e));
    midHandle.addEventListener('mousedown', (e) => startDrag(midHandle, e));
    whiteHandle.addEventListener('mousedown', (e) => startDrag(whiteHandle, e));
    blackHandle.addEventListener('touchstart', (e) => startDrag(blackHandle, e));
    midHandle.addEventListener('touchstart', (e) => startDrag(midHandle, e));
    whiteHandle.addEventListener('touchstart', (e) => startDrag(whiteHandle, e));
}
initLevelsSlider();

// Upload Handlers
uploadArea.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) loadImage(e.target.files[0]);
});
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) loadImage(e.dataTransfer.files[0]);
});

function loadImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            sourceImage = img;
            uploadArea.classList.add('has-image');
            controls.classList.add('active');
            outputCanvas.classList.add('active');
            generateBtn.disabled = false;
            resetBtn.disabled = false;

            // Resize logic
            const maxSize = 1000;
            let w = sourceImage.width;
            let h = sourceImage.height;
            const maxDimension = Math.max(w, h);

            if (maxDimension > maxSize) {
                const ratio = maxSize / maxDimension;
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
            }

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w;
            tempCanvas.height = h;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(sourceImage, 0, 0, w, h);

            // Store the RESIZED COLOR image
            const processed = new Image();
            processed.onload = () => {
                processedImage = processed;
                updatePreview();
                updateSizeDisplay();
            };
            processed.src = tempCanvas.toDataURL();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Core Image Processing Pipeline
// 1. Levels (Gamma/Contrast)
// 2. Binarize (Threshold)
function processImageToBinarized(image) {
    const w = image.width;
    const h = image.height;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // Levels Calc
    const midNormalized = (midPoint - blackPoint) / (whitePoint - blackPoint);
    const gamma = midNormalized > 0 && midNormalized < 1
        ? Math.log(0.5) / Math.log(midNormalized)
        : 1.0;

    for (let i = 0; i < data.length; i += 4) {
        // Grayscale
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

        // Apply Levels
        let normalized = (gray - blackPoint) / (whitePoint - blackPoint);
        normalized = Math.max(0, Math.min(1, normalized));
        const gammaCorrected = Math.pow(normalized, gamma);
        const adjustedGray = gammaCorrected * 255;

        // Binarize (Threshold 128)
        const val = adjustedGray < 128 ? 0 : 255;

        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255; // Opaque
    }

    return imageData;
}


function updateSizeDisplay() {
    if (!processedImage) return;
    const finalW = processedImage.width * currentScale;
    const finalH = processedImage.height * currentScale;
    sizeDisplay.textContent = `${finalW} x ${finalH} px`;
}

function updatePreview() {
    if (!processedImage) return;

    outputCanvas.width = processedImage.width;
    outputCanvas.height = processedImage.height;

    // Process the image (Levels + Binarize)
    const binarizedData = processImageToBinarized(processedImage);

    // For preview, show Frame 2 if noise is active, else static
    // Let's just generate frames and show one
    const frames = generateGlitchFrames(binarizedData, currentNoiseLevel);
    ctx.putImageData(frames[1], 0, 0); // Show frame 1 (or 0)
}

function generateGlitchFrames(baseData, noiseLevel) {
    const w = baseData.width;
    const h = baseData.height;
    const data = baseData.data;

    const setting = noiseLevelSettings[noiseLevel] || noiseLevelSettings[1];

    if (setting.mode === 'grain') {
        // Grain Mode (Level 3)
        return [
            createGrainFrame(data, w, h, setting.amount, 1),
            createGrainFrame(data, w, h, setting.amount, 2),
            createGrainFrame(data, w, h, setting.amount, 3)
        ];
    } else if (setting.mode === 'scanline') {
        // Scanline Mode (Level 2)
        return [
            createScanlineFrame(data, w, h, setting.maxShift, 100),
            createScanlineFrame(data, w, h, setting.maxShift, 200),
            createScanlineFrame(data, w, h, setting.maxShift, 300)
        ];
    } else if (setting.mode === 'block') {
        // Block Mode (Level 4)
        return [
            createBlockGlitchFrame(data, w, h, setting.blockSize, setting.probability, setting.maxShift, 100),
            createBlockGlitchFrame(data, w, h, setting.blockSize, setting.probability, setting.maxShift, 200),
            createBlockGlitchFrame(data, w, h, setting.blockSize, setting.probability, setting.maxShift, 300)
        ];
    } else if (setting.mode === 'vjump') {
        // Vertical Jump Mode (Level 5)
        return [
            createVerticalJumpFrame(data, w, h, setting.maxShift, 100),
            createVerticalJumpFrame(data, w, h, setting.maxShift, 200),
            createVerticalJumpFrame(data, w, h, setting.maxShift, 300)
        ];
    } else {
        // Jitter Mode (Level 1)
        const blackPixels = [];
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                if (data[i] === 0) { // Black pixel
                    blackPixels.push({ x, y });
                }
            }
        }

        const percentages = setting.percentages;

        return [
            createJitterFrame(w, h, blackPixels, percentages[0], setting.maxDist, 100),
            createJitterFrame(w, h, blackPixels, percentages[1], setting.maxDist, 200),
            createJitterFrame(w, h, blackPixels, percentages[2], setting.maxDist, 300)
        ];
    }
}

// Helper: Create Jitter Frame
function createJitterFrame(w, h, blackPixels, percentage, maxDist, seed) {
    const frameData = new Uint8ClampedArray(w * h * 4);
    frameData.fill(255);

    function seededRandom(s) {
        let x = Math.sin(s++) * 10000;
        return x - Math.floor(x);
    }

    const outputPixels = [...blackPixels];

    outputPixels.forEach((p, index) => {
        let s = seed + index;
        const angle = seededRandom(s) * Math.PI * 2;
        const dist = seededRandom(s + 1) * maxDist;

        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;

        const newX = Math.round(p.x + dx);
        const newY = Math.round(p.y + dy);

        if (newX >= 0 && newX < w && newY >= 0 && newY < h) {
            const idx = (newY * w + newX) * 4;
            frameData[idx] = 0;
            frameData[idx + 1] = 0;
            frameData[idx + 2] = 0;
            frameData[idx + 3] = 255;
        }
    });

    return new ImageData(frameData, w, h);
}

// Helper: Create Scanline Frame (VHS effect)
function createScanlineFrame(originalData, w, h, maxShift, seed) {
    const frameData = new Uint8ClampedArray(originalData);

    function seededRandom(s) {
        let x = Math.sin(s++) * 10000;
        return x - Math.floor(x);
    }

    // Shift lines
    for (let y = 0; y < h; y++) {
        const lineSeed = seed + y * 0.1;
        const rawNoise = seededRandom(lineSeed);

        if (rawNoise > 0.7) {
            const shiftDir = seededRandom(lineSeed + 100) > 0.5 ? 1 : -1;
            const shiftAmt = Math.floor(seededRandom(lineSeed + 200) * maxShift) + 1;
            const shift = shiftDir * shiftAmt;

            const rowStart = y * w * 4;

            for (let x = 0; x < w; x++) {
                let srcX = x - shift;
                if (srcX < 0) srcX = 0;
                if (srcX >= w) srcX = w - 1;

                const srcIdx = rowStart + srcX * 4;
                const destIdx = rowStart + x * 4;

                frameData[destIdx] = originalData[srcIdx];
                frameData[destIdx + 1] = originalData[srcIdx + 1];
                frameData[destIdx + 2] = originalData[srcIdx + 2];
                frameData[destIdx + 3] = originalData[srcIdx + 3];
            }
        }
    }

    return new ImageData(frameData, w, h);
}

// Helper: Create Grain Frame
function createGrainFrame(originalData, w, h, amount, seed) {
    const frameData = new Uint8ClampedArray(originalData);

    function seededRandom(s) {
        let x = Math.sin(s++) * 10000;
        return x - Math.floor(x);
    }

    const totalPixels = w * h;
    const flipCount = Math.floor(totalPixels * amount);

    for (let i = 0; i < flipCount; i++) {
        const s = seed * totalPixels + i;
        const pxIndex = Math.floor(seededRandom(s) * totalPixels);
        const dataIdx = pxIndex * 4;

        const currentRef = frameData[dataIdx];
        const newVal = currentRef === 0 ? 255 : 0;

        frameData[dataIdx] = newVal;
        frameData[dataIdx + 1] = newVal;
        frameData[dataIdx + 2] = newVal;
    }

    return new ImageData(frameData, w, h);
}

// Helper: Block Glitch (Digital corruption)
function createBlockGlitchFrame(originalData, w, h, blockSize, probability, maxShift, seed) {
    const frameData = new Uint8ClampedArray(originalData);

    function seededRandom(s) {
        let x = Math.sin(s++) * 10000;
        return x - Math.floor(x);
    }

    // Iterate blocks
    const cols = Math.ceil(w / blockSize);
    const rows = Math.ceil(h / blockSize);

    for (let by = 0; by < rows; by++) {
        for (let bx = 0; bx < cols; bx++) {
            const blockSeed = seed + by * cols + bx;
            if (seededRandom(blockSeed) < probability) {
                // Glitch this block

                // Determine shift
                const moveX = Math.floor((seededRandom(blockSeed + 1) - 0.5) * 2 * maxShift);
                const moveY = Math.floor((seededRandom(blockSeed + 2) - 0.5) * 2 * maxShift);

                // Copy block from original with shift
                const startX = bx * blockSize;
                const startY = by * blockSize;

                for (let y = 0; y < blockSize; y++) {
                    for (let x = 0; x < blockSize; x++) {
                        const currentX = startX + x;
                        const currentY = startY + y;

                        if (currentX >= w || currentY >= h) continue;

                        // Source with offset
                        let srcX = currentX - moveX;
                        let srcY = currentY - moveY;

                        // Clamp source
                        if (srcX < 0) srcX = 0;
                        if (srcX >= w) srcX = w - 1;
                        if (srcY < 0) srcY = 0;
                        if (srcY >= h) srcY = h - 1;

                        const destIdx = (currentY * w + currentX) * 4;
                        const srcIdx = (srcY * w + srcX) * 4;

                        frameData[destIdx] = originalData[srcIdx];
                        frameData[destIdx + 1] = originalData[srcIdx + 1];
                        frameData[destIdx + 2] = originalData[srcIdx + 2];
                        frameData[destIdx + 3] = originalData[srcIdx + 3];
                    }
                }

            }
        }
    }

    return new ImageData(frameData, w, h);
}

// Helper: Vertical Jump (Analog sync error)
function createVerticalJumpFrame(originalData, w, h, maxShift, seed) {
    const frameData = new Uint8ClampedArray(w * h * 4);

    function seededRandom(s) {
        let x = Math.sin(s++) * 10000;
        return x - Math.floor(x);
    }

    // Shift entire image vertically
    const shift = Math.floor((seededRandom(seed) - 0.5) * 2 * maxShift);

    // Fill white first (since we might shift out of bounds)
    frameData.fill(255);

    for (let y = 0; y < h; y++) {
        let srcY = y - shift;

        // Wrap around? Or clamp? 
        // Sync roll usually wraps around.
        if (srcY < 0) srcY += h;
        if (srcY >= h) srcY -= h;

        const rowStart = y * w * 4;
        const srcRowStart = srcY * w * 4;

        // Copy row
        for (let i = 0; i < w * 4; i++) {
            frameData[rowStart + i] = originalData[srcRowStart + i];
        }
    }

    return new ImageData(frameData, w, h);
}

async function createGIF(frames, w, h, updateProgress) {
    return new Promise((resolve, reject) => {
        try {
            // eslint-disable-next-line no-undef
            const gif = new GIF({
                workers: 1, // Reduced to 1 to match paint app (stability)
                quality: 10,
                width: w,
                height: h,
                workerScript: './gif.worker.js',
                background: '#ffffff'
            });

            frames.forEach((frameData) => {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = w;
                tempCanvas.height = h;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.putImageData(frameData, 0, 0);
                gif.addFrame(tempCanvas, { delay: 50 });
            });

            gif.on('progress', updateProgress);
            gif.on('finished', blob => resolve(blob));
            gif.on('error', err => reject(err)); // Explicit error handling

            gif.render();

        } catch (e) {
            reject(e);
        }
    });
}

generateBtn.addEventListener('click', async () => {
    if (!processedImage) return;

    generatingOverlay.classList.add('active');
    progressText.textContent = "Processing... 0%";

    // 1. Levels + Binarize at original size (resized source)
    const binarizedData = processImageToBinarized(processedImage);

    // 2. Scale
    const bCanvas = document.createElement('canvas');
    bCanvas.width = processedImage.width;
    bCanvas.height = processedImage.height;
    bCanvas.getContext('2d').putImageData(binarizedData, 0, 0);

    const finalW = processedImage.width * currentScale;
    const finalH = processedImage.height * currentScale;

    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = finalW;
    scaledCanvas.height = finalH;
    const scaledCtx = scaledCanvas.getContext('2d');
    scaledCtx.imageSmoothingEnabled = false;

    scaledCtx.drawImage(bCanvas, 0, 0, finalW, finalH);
    const scaledData = scaledCtx.getImageData(0, 0, finalW, finalH);

    await new Promise(r => setTimeout(r, 50));

    try {
        const frames = generateGlitchFrames(scaledData, currentNoiseLevel);

        const blob = await createGIF(frames, finalW, finalH, (p) => {
            progressText.textContent = `Generating GIF... ${Math.round(p * 100)}%`;
        });

        const link = document.createElement('a');
        link.download = `desu_noise_${Date.now()}.gif`;
        link.href = URL.createObjectURL(blob);
        link.click();

    } catch (err) {
        console.error(err);
        alert('Error generating GIF: ' + err.message);
    } finally {
        generatingOverlay.classList.remove('active');
    }
});

resetBtn.addEventListener('click', () => {
    sourceImage = null;
    processedImage = null;
    uploadArea.classList.remove('has-image');
    controls.classList.remove('active');
    outputCanvas.classList.remove('active');
    generateBtn.disabled = true;
    resetBtn.disabled = true;
    fileInput.value = '';
    sizeDisplay.textContent = '';
    ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);

    // Reset Levels
    blackPoint = 0;
    midPoint = 128;
    whitePoint = 255;
    blackHandle.style.left = '0%';
    midHandle.style.left = '50%';
    whiteHandle.style.left = '100%';
});
