const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const controls = document.getElementById('controls');
const blackPoint = document.getElementById('blackPoint');
const whitePoint = document.getElementById('whitePoint');
const blackPointValue = document.getElementById('blackPointValue');
const whitePointValue = document.getElementById('whitePointValue');
const edgeToggle = document.getElementById('edgeToggle');
const edgeThreshold = document.getElementById('edgeThreshold');
const edgeThresholdValue = document.getElementById('edgeThresholdValue');
const edgeThresholdControl = document.getElementById('edgeThresholdControl');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const outputCanvas = document.getElementById('outputCanvas');
const ctx = outputCanvas.getContext('2d');
const toneModal = document.getElementById('toneModal');
const toneModalHeader = document.getElementById('toneModalHeader');
const toneModalGrid = document.getElementById('toneModalGrid');

let sourceImage = null;  // Original uploaded image
let processedImage = null;  // Resized image for processing
let processingTimeout = null;

// Define 18 tone presets
const TONE_PRESETS = [
    { id: 'white', name: 'A1', type: 'white', spacing: 0, dotSize: 0 },
    // Coarse dots (4 variations) - dotSize fixed at 4, spacing varies
    { id: 'coarse1', name: 'B1', type: 'coarse', spacing: 24, dotSize: 4 },
    { id: 'coarse2', name: 'B2', type: 'coarse', spacing: 18, dotSize: 4 },
    { id: 'coarse3', name: 'B3', type: 'coarse', spacing: 14, dotSize: 4 },
    { id: 'coarse4', name: 'B4', type: 'coarse', spacing: 10, dotSize: 4 },
    // Fine dots (4 variations) - dotSize fixed at 3, spacing varies
    { id: 'fine1', name: 'C1', type: 'fine', spacing: 9, dotSize: 3 },
    { id: 'fine2', name: 'C2', type: 'fine', spacing: 7, dotSize: 3 },
    { id: 'fine3', name: 'C3', type: 'fine', spacing: 5, dotSize: 3 },
    { id: 'fine4', name: 'C4', type: 'fine', spacing: 4, dotSize: 3 },
    // Diagonal lines (3 variations) - width fixed at 1, spacing varies
    { id: 'diag1', name: 'D1', type: 'diagonal', spacing: 8, angle: 45, width: 1 },
    { id: 'diag2', name: 'D2', type: 'diagonal', spacing: 6, angle: 45, width: 1 },
    { id: 'diag3', name: 'D3', type: 'diagonal', spacing: 4, angle: 45, width: 1 },
    // Grid patterns (3 variations) - width fixed at 1, spacing varies
    { id: 'grid1', name: 'E1', type: 'grid', spacing: 12, width: 1 },
    { id: 'grid2', name: 'E2', type: 'grid', spacing: 8, width: 1 },
    { id: 'grid3', name: 'E3', type: 'grid', spacing: 6, width: 1 },
    // Organic dots (2 variations) - dotSize and randomness fixed, spacing varies
    { id: 'organic1', name: 'F1', type: 'organic', spacing: 10, dotSize: 3, randomness: 0.3 },
    { id: 'organic2', name: 'F2', type: 'organic', spacing: 7, dotSize: 3, randomness: 0.3 },
    { id: 'black', name: 'G1', type: 'black', spacing: 0, dotSize: 0 }
];

// Selected presets for each level (default: white, coarse2, fine2, black)
const selectedPresets = {
    level1: 'white',
    level2: 'coarse2',
    level3: 'fine2',
    level4: 'black'
};

// Initialize preset UI
function initializePresetUI() {
    const levels = ['level1', 'level2', 'level3', 'level4'];
    const levelNames = ['Light', 'Mid-Light', 'Mid-Dark', 'Dark'];

    levels.forEach((level, index) => {
        const levelNum = index + 1;
        const previewCanvas = document.getElementById(`preview${levelNum}`);
        const label = document.getElementById(`label${levelNum}`);
        const toneBox = document.querySelector(`.tone-box[data-level="${level}"]`);

        // Draw initial preview
        const initialPreset = TONE_PRESETS.find(p => p.id === selectedPresets[level]);
        drawToneBoxPreview(previewCanvas, initialPreset);
        label.textContent = initialPreset.name;

        // Click to open modal
        toneBox.addEventListener('click', () => {
            openToneModal(level, levelNames[index]);
        });
    });
}

// Open tone selection modal
let currentEditingLevel = null;

function openToneModal(level, levelName) {
    currentEditingLevel = level;
    toneModalHeader.textContent = levelName;

    // Clear existing grid
    toneModalGrid.innerHTML = '';

    // Populate grid
    TONE_PRESETS.forEach(preset => {
        const option = document.createElement('div');
        option.className = 'tone-modal-option';
        option.dataset.presetId = preset.id;

        // Preview canvas
        const optionCanvas = document.createElement('canvas');
        optionCanvas.width = 50;
        optionCanvas.height = 50;
        drawPresetPreview(optionCanvas, preset);

        // Label
        const optionLabel = document.createElement('div');
        optionLabel.className = 'tone-modal-option-label';
        optionLabel.textContent = preset.name;

        option.appendChild(optionCanvas);
        option.appendChild(optionLabel);

        // Mark selected
        if (selectedPresets[level] === preset.id) {
            option.classList.add('selected');
        }

        // Click handler
        option.addEventListener('click', () => {
            selectPreset(level, preset.id);
            toneModal.classList.remove('active');
        });

        toneModalGrid.appendChild(option);
    });

    toneModal.classList.add('active');
}

// Close modal when clicking outside
toneModal.addEventListener('click', (e) => {
    if (e.target === toneModal) {
        toneModal.classList.remove('active');
    }
});

// Draw preview for tone box (small preview)
function drawToneBoxPreview(canvas, preset) {
    const ctx = canvas.getContext('2d');
    canvas.width = 40;
    canvas.height = 40;
    drawPresetPreview(canvas, preset);
}

// Draw preset preview on canvas
function drawPresetPreview(canvas, preset) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Disable image smoothing for crisp preview
    ctx.imageSmoothingEnabled = false;

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    if (preset.type === 'white') {
        // White - no pattern
        return;
    } else if (preset.type === 'black') {
        // Black - solid fill
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        return;
    }

    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';

    if (preset.type === 'diagonal') {
        // Diagonal line pattern - seamless tiling
        const spacing = preset.spacing;
        const lineWidth = Math.ceil(preset.width);

        // For 45-degree lines, draw pixel-by-pixel for uniform width
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Calculate distance from diagonal lines (normalize modulo for negative values)
                const diff = x - y;
                const dist = ((diff % spacing) + spacing) % spacing;
                const minDist = Math.min(dist, spacing - dist);

                if (minDist < lineWidth) {
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
        return;
    } else if (preset.type === 'grid') {
        // Grid pattern - seamless tiling
        const spacing = preset.spacing;
        const lineWidth = Math.ceil(preset.width);

        // Draw pixel-by-pixel for uniform lines
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const xDist = x % spacing;
                const yDist = y % spacing;
                if (xDist < lineWidth || yDist < lineWidth) {
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
        return;
    } else if (preset.type === 'organic') {
        // Organic dot pattern with randomness
        const spacing = preset.spacing;
        const dotSize = preset.dotSize;
        const randomness = preset.randomness;

        // Seed for consistent preview
        let seed = 12345;
        const seededRandom = () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };

        const angle = Math.PI / 4;
        const cos45 = Math.cos(angle);
        const sin45 = Math.sin(angle);
        const diagonal = Math.sqrt(width * width + height * height);
        const startPos = -diagonal / 2;
        const endPos = diagonal / 2;

        for (let gy = startPos; gy < endPos; gy += spacing) {
            for (let gx = startPos; gx < endPos; gx += spacing) {
                // Add randomness to position
                const offsetX = (seededRandom() - 0.5) * spacing * randomness;
                const offsetY = (seededRandom() - 0.5) * spacing * randomness;

                const x = (gx + offsetX) * cos45 - (gy + offsetY) * sin45 + width / 2;
                const y = (gx + offsetX) * sin45 + (gy + offsetY) * cos45 + height / 2;

                if (x >= 0 && x < width && y >= 0 && y < height) {
                    // Add randomness to size
                    const sizeVariation = 1 + (seededRandom() - 0.5) * randomness;
                    const currentDotSize = dotSize * sizeVariation;

                    ctx.beginPath();
                    ctx.arc(x, y, currentDotSize / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        return;
    } else if (preset.type === 'coarse' || preset.type === 'fine') {
        // Regular dot pattern - seamless tiling
        const spacing = preset.spacing;
        const dotSize = preset.dotSize;

        // 45-degree rotation for screen tone effect
        const angle = Math.PI / 4;
        const cos45 = Math.cos(angle);
        const sin45 = Math.sin(angle);

        // Draw seamless pattern by aligning to spacing grid
        const diagonal = Math.sqrt(width * width + height * height);

        // Calculate grid start position aligned to spacing for seamless tiling
        const gridSpacing = spacing * Math.sqrt(2);
        const startX = -Math.ceil(diagonal / gridSpacing) * spacing;
        const startY = -Math.ceil(diagonal / gridSpacing) * spacing;
        const endX = Math.ceil(diagonal / gridSpacing) * spacing + diagonal;
        const endY = Math.ceil(diagonal / gridSpacing) * spacing + diagonal;

        for (let gy = startY; gy < endY; gy += spacing) {
            for (let gx = startX; gx < endX; gx += spacing) {
                const x = gx * cos45 - gy * sin45 + width / 2;
                const y = gx * sin45 + gy * cos45 + height / 2;

                // Draw all dots to create seamless pattern
                ctx.beginPath();
                ctx.arc(x, y, dotSize / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

// Select preset for a level
function selectPreset(level, presetId) {
    selectedPresets[level] = presetId;

    const levelNum = ['level1', 'level2', 'level3', 'level4'].indexOf(level) + 1;
    const previewCanvas = document.getElementById(`preview${levelNum}`);
    const label = document.getElementById(`label${levelNum}`);

    // Update preview and label
    const preset = TONE_PRESETS.find(p => p.id === presetId);
    drawToneBoxPreview(previewCanvas, preset);
    label.textContent = preset.name;

    // Reprocess if image is loaded
    if (processedImage) {
        clearTimeout(processingTimeout);
        processingTimeout = setTimeout(() => {
            processMangaTone();
        }, 150);
    }
}

// Initialize UI on page load
initializePresetUI();

// Full size preview modal
const previewModal = document.getElementById('previewModal');
const previewCanvas = document.getElementById('previewCanvas');

outputCanvas.addEventListener('click', () => {
    // Copy canvas content to preview modal
    previewCanvas.width = outputCanvas.width;
    previewCanvas.height = outputCanvas.height;
    const previewCtx = previewCanvas.getContext('2d');
    previewCtx.drawImage(outputCanvas, 0, 0);

    previewModal.classList.add('active');
});

previewModal.addEventListener('click', () => {
    previewModal.classList.remove('active');
});

// Upload area click handler
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// File input change handler
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        loadImage(e.target.files[0]);
    }
});

// Drag and drop handlers
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        loadImage(e.dataTransfer.files[0]);
    }
});

// Load image
function loadImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            sourceImage = img;
            uploadArea.classList.add('has-image');
            controls.classList.add('active');
            outputCanvas.classList.add('active');
            downloadBtn.disabled = false;
            resetBtn.disabled = false;
            resizeAndProcess();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Resize image to fixed 1000px long edge and process
function resizeAndProcess() {
    const maxSize = 1000;
    const srcWidth = sourceImage.width;
    const srcHeight = sourceImage.height;
    const maxDimension = Math.max(srcWidth, srcHeight);

    // Calculate new dimensions (always scale to 1000px on long edge)
    const scale = maxSize / maxDimension;
    const newWidth = Math.round(srcWidth * scale);
    const newHeight = Math.round(srcHeight * scale);

    // Create temporary canvas for resizing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = false;

    // Draw resized image
    tempCtx.drawImage(sourceImage, 0, 0, newWidth, newHeight);

    // Convert canvas to image
    const resizedImg = new Image();
    resizedImg.onload = () => {
        processedImage = resizedImg;
        processMangaTone();
    };
    resizedImg.src = tempCanvas.toDataURL();
}

// Slider value display and processing trigger
function setupSlider(slider, valueDisplay) {
    slider.addEventListener('input', (e) => {
        valueDisplay.textContent = e.target.value;
        if (processedImage) {
            // Debounce processing
            clearTimeout(processingTimeout);
            processingTimeout = setTimeout(() => {
                processMangaTone();
            }, 150);
        }
    });
}

setupSlider(blackPoint, blackPointValue);
setupSlider(whitePoint, whitePointValue);
setupSlider(edgeThreshold, edgeThresholdValue);

// Edge toggle handler
edgeToggle.addEventListener('change', () => {
    edgeThresholdControl.style.display = edgeToggle.checked ? 'block' : 'none';
    if (processedImage) {
        clearTimeout(processingTimeout);
        processingTimeout = setTimeout(() => {
            processMangaTone();
        }, 150);
    }
});

// Download button handler
downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'manga-tone-output.png';
    link.href = outputCanvas.toDataURL();
    link.click();
});

// Reset button handler
resetBtn.addEventListener('click', () => {
    // Clear image data
    sourceImage = null;
    processedImage = null;

    // Reset UI
    uploadArea.classList.remove('has-image');
    controls.classList.remove('active');
    outputCanvas.classList.remove('active');

    // Reset sliders to default
    blackPoint.value = 0;
    blackPointValue.textContent = '0';
    whitePoint.value = 255;
    whitePointValue.textContent = '255';
    edgeThreshold.value = 50;
    edgeThresholdValue.textContent = '50';

    // Reset edge toggle
    edgeToggle.checked = false;
    edgeThresholdControl.style.display = 'none';

    // Disable buttons
    downloadBtn.disabled = true;
    resetBtn.disabled = true;

    // Clear file input
    fileInput.value = '';

    // Clear canvas
    ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
});

// Main processing function
function processMangaTone() {
    const width = processedImage.width;
    const height = processedImage.height;

    // Set canvas size
    outputCanvas.width = width;
    outputCanvas.height = height;

    // Disable image smoothing for crisp binary output
    ctx.imageSmoothingEnabled = false;

    // Draw processed image to temporary canvas for processing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(processedImage, 0, 0);

    // Get image data
    const imageData = tempCtx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Convert to grayscale (original, for edge detection)
    const originalGrayData = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        originalGrayData[i / 4] = gray;
    }

    // Apply level correction to create adjusted gray data for tone mapping
    const grayData = new Uint8Array(width * height);
    const blackPt = parseInt(blackPoint.value);
    const whitePt = parseInt(whitePoint.value);

    for (let i = 0; i < originalGrayData.length; i++) {
        const gray = originalGrayData[i];

        // Apply level correction
        let adjusted = (gray - blackPt) * 255 / (whitePt - blackPt);
        adjusted = Math.max(0, Math.min(255, adjusted));

        grayData[i] = adjusted;
    }

    // Create tone level map (1-4)
    const toneLevelMap = new Uint8Array(width * height);
    for (let i = 0; i < grayData.length; i++) {
        const brightness = grayData[i] / 255;

        // Determine tone level based on brightness
        if (brightness >= 0.75) {
            toneLevelMap[i] = 1; // Level 1 - brightest
        } else if (brightness >= 0.5) {
            toneLevelMap[i] = 2; // Level 2
        } else if (brightness >= 0.25) {
            toneLevelMap[i] = 3; // Level 3
        } else {
            toneLevelMap[i] = 4; // Level 4 - darkest
        }
    }

    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Get selected presets
    const level1Preset = TONE_PRESETS.find(p => p.id === selectedPresets.level1);
    const level2Preset = TONE_PRESETS.find(p => p.id === selectedPresets.level2);
    const level3Preset = TONE_PRESETS.find(p => p.id === selectedPresets.level3);
    const level4Preset = TONE_PRESETS.find(p => p.id === selectedPresets.level4);

    // Draw each level
    drawLevelPattern(ctx, width, height, toneLevelMap, 4, level4Preset);
    drawLevelPattern(ctx, width, height, toneLevelMap, 3, level3Preset);
    drawLevelPattern(ctx, width, height, toneLevelMap, 2, level2Preset);
    drawLevelPattern(ctx, width, height, toneLevelMap, 1, level1Preset);

    // Draw edge lines if enabled (use original grayscale, not adjusted)
    if (edgeToggle.checked) {
        const edgeData = detectEdges(originalGrayData, width, height, parseInt(edgeThreshold.value));
        drawEdges(ctx, edgeData, width, height);
    }

    // Binarize output (convert to pure black and white)
    binarizeOutput(ctx, width, height);
}

// Binarize output to pure black and white
function binarizeOutput(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Convert to pure black or white (threshold at 128)
    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i]; // R channel (all RGB are same for grayscale)
        const binaryValue = gray < 128 ? 0 : 255;

        data[i] = binaryValue;     // R
        data[i + 1] = binaryValue; // G
        data[i + 2] = binaryValue; // B
        // Alpha stays at 255
    }

    ctx.putImageData(imageData, 0, 0);
}

// Sobel edge detection
function detectEdges(grayData, width, height, threshold) {
    const edgeData = new Uint8Array(width * height);

    // Sobel kernels
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let gx = 0;
            let gy = 0;

            // Apply Sobel kernel
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = (y + ky) * width + (x + kx);
                    const kernelIdx = (ky + 1) * 3 + (kx + 1);
                    const pixel = grayData[idx];

                    gx += pixel * sobelX[kernelIdx];
                    gy += pixel * sobelY[kernelIdx];
                }
            }

            // Calculate gradient magnitude
            const magnitude = Math.sqrt(gx * gx + gy * gy);

            // Apply threshold
            const idx = y * width + x;
            edgeData[idx] = magnitude > threshold ? 255 : 0;
        }
    }

    return edgeData;
}

// Draw edges on canvas
function drawEdges(ctx, edgeData, width, height) {
    ctx.fillStyle = '#000000';

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (edgeData[idx] === 255) {
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
}

// Draw pattern for a specific level
function drawLevelPattern(ctx, width, height, toneLevelMap, level, preset) {
    if (!preset) return;

    if (preset.type === 'white') {
        // White - no pattern, already white background
        return;
    } else if (preset.type === 'black') {
        // Black - solid fill for this level
        ctx.fillStyle = '#000000';
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (toneLevelMap[idx] === level) {
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
        return;
    }

    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';

    if (preset.type === 'diagonal') {
        // Diagonal line pattern - pixel-perfect for uniform width
        const spacing = preset.spacing;
        const lineWidth = Math.ceil(preset.width);

        // Draw pixel-by-pixel for consistent line width
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (toneLevelMap[idx] === level) {
                    // Calculate distance from diagonal lines (normalize modulo for negative values)
                    const diff = x - y;
                    const dist = ((diff % spacing) + spacing) % spacing;
                    const minDist = Math.min(dist, spacing - dist);

                    if (minDist < lineWidth) {
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            }
        }
        return;
    } else if (preset.type === 'grid') {
        // Grid pattern - seamless tiling
        const spacing = preset.spacing;
        const lineWidth = Math.ceil(preset.width);

        // Draw grid lines only where this level exists
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (toneLevelMap[idx] === level) {
                    // Check if on grid line (seamless wrap)
                    const xDist = x % spacing;
                    const yDist = y % spacing;
                    if (xDist < lineWidth || yDist < lineWidth) {
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            }
        }
        return;
    } else if (preset.type === 'organic') {
        // Organic dot pattern
        const spacing = preset.spacing;
        const dotSize = preset.dotSize;
        const randomness = preset.randomness;

        // Seed for consistent results
        let seed = 54321;
        const seededRandom = () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };

        const angle = Math.PI / 4;
        const cos45 = Math.cos(angle);
        const sin45 = Math.sin(angle);
        const diagonal = Math.sqrt(width * width + height * height);
        const startPos = -diagonal;
        const endPos = diagonal;

        for (let gy = startPos; gy < endPos; gy += spacing) {
            for (let gx = startPos; gx < endPos; gx += spacing) {
                // Add randomness to position
                const offsetX = (seededRandom() - 0.5) * spacing * randomness;
                const offsetY = (seededRandom() - 0.5) * spacing * randomness;

                const x = Math.round((gx + offsetX) * cos45 - (gy + offsetY) * sin45 + width / 2);
                const y = Math.round((gx + offsetX) * sin45 + (gy + offsetY) * cos45 + height / 2);

                if (x < 0 || x >= width || y < 0 || y >= height) continue;

                const idx = y * width + x;
                if (toneLevelMap[idx] !== level) continue;

                // Check surrounding area
                let shouldDraw = false;
                const checkRadius = Math.floor(spacing / 2);

                for (let dy = -checkRadius; dy <= checkRadius; dy++) {
                    for (let dx = -checkRadius; dx <= checkRadius; dx++) {
                        const checkX = x + dx;
                        const checkY = y + dy;

                        if (checkX >= 0 && checkX < width && checkY >= 0 && checkY < height) {
                            const checkIdx = checkY * width + checkX;
                            if (toneLevelMap[checkIdx] === level) {
                                shouldDraw = true;
                                break;
                            }
                        }
                    }
                    if (shouldDraw) break;
                }

                if (shouldDraw) {
                    // Add randomness to size
                    const sizeVariation = 1 + (seededRandom() - 0.5) * randomness;
                    const currentDotSize = dotSize * sizeVariation;

                    ctx.beginPath();
                    ctx.arc(x, y, currentDotSize / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        return;
    } else if (preset.type === 'coarse' || preset.type === 'fine') {
        // Regular dot pattern - seamless tiling
        const spacing = preset.spacing;
        const dotSize = preset.dotSize;

        // 45-degree rotation for screen tone effect
        const angle = Math.PI / 4;
        const cos45 = Math.cos(angle);
        const sin45 = Math.sin(angle);

        // Create seamless pattern on temporary canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.imageSmoothingEnabled = false;

        // Fill with white background
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, width, height);
        tempCtx.fillStyle = '#000000';

        // Draw seamless dot pattern
        const diagonal = Math.sqrt(width * width + height * height);
        const gridSpacing = spacing * Math.sqrt(2);
        const startX = -Math.ceil(diagonal / gridSpacing) * spacing;
        const startY = -Math.ceil(diagonal / gridSpacing) * spacing;
        const endX = Math.ceil(diagonal / gridSpacing) * spacing + diagonal;
        const endY = Math.ceil(diagonal / gridSpacing) * spacing + diagonal;

        for (let gy = startY; gy < endY; gy += spacing) {
            for (let gx = startX; gx < endX; gx += spacing) {
                const x = gx * cos45 - gy * sin45 + width / 2;
                const y = gx * sin45 + gy * cos45 + height / 2;

                // Draw all dots to create seamless pattern
                tempCtx.beginPath();
                tempCtx.arc(x, y, dotSize / 2, 0, Math.PI * 2);
                tempCtx.fill();
            }
        }

        // Apply pattern only where this level exists
        const tempData = tempCtx.getImageData(0, 0, width, height).data;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (toneLevelMap[idx] === level) {
                    const dataIdx = idx * 4;
                    // Check if pixel is black (not white)
                    if (tempData[dataIdx] < 128) {
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            }
        }
    }
}
