const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d', { alpha: true });

        // Constants
        const SCALE = 4; // High-DPI scaling
        const GRID_SIZE = 16;
        const CELL_SIZE = 30;
        const MAX_HISTORY = 50;

        // State
        let mode = 'triangle';
        let fillColor = '#000000';
        let symmetryMode = 'none'; // 'none', 'x', 'y', 'xy'
        let bgColor = '#ffffff';
        let showGrid = true;
        let grid = [];
        let scale = 1;
        let translateX = 0;
        let translateY = 0;
        let lastActionTime = 0; // For debounce

        // Undo/Redo
        let undoStack = [];
        let redoStack = [];

        // Pan/Zoom
        let isSpacePressed = false;
        let isCtrlPressed = false;
        let isAltPressed = false;
        let isPanning = false;
        let wasPanning = false; // Track if panning occurred during this interaction
        let wasPinching = false; // Track if pinching occurred during this interaction
        let panStartX = 0;
        let panStartY = 0;
        let lastPanX = 0;
        let lastPanY = 0;

        // Touch
        let activePointers = new Map();
        let isPinching = false;
        let lastPinchDist = 0;
        let lastPinchCenter = { x: 0, y: 0 };
        let initialPinchDist = 0;
        let initialPinchCenter = { x: 0, y: 0 };
        let maxFingers = 0;
        let touchStartTime = 0;
        let touchStartPos = { x: 0, y: 0 };
        let pencilDetected = false;
        let didInteract = false; // Track if drawing, panning, or pinching occurred

        // Save mode
        let isSaveMode = false;
        let selectionStart = null;
        let selectionEnd = null;
        let confirmedSelection = null;
        let selectedScale = 1;

        // Initialize grid
        function initGrid() {
            grid = Array(GRID_SIZE).fill(null).map(() =>
                Array(GRID_SIZE).fill(null).map(() => ({
                    type: null,
                    corner: null,
                    color: null,
                    inverted: false
                }))
            );
        }

        // Set canvas size
        function resizeCanvas() {
            const size = GRID_SIZE * CELL_SIZE;
            canvas.width = size * SCALE;
            canvas.height = size * SCALE;
            canvas.style.width = size + 'px';
            canvas.style.height = size + 'px';

            // Center canvas
            const centerX = (window.innerWidth - size) / 2;
            const centerY = (window.innerHeight - size) / 2;
            canvas.style.left = centerX + 'px';
            canvas.style.top = centerY + 'px';

            render();
        }

        // Fit canvas to screen (initial only)
        function fitCanvasToScreen() {
            const size = GRID_SIZE * CELL_SIZE;
            // Leave space for toolbars (120px left, 60px right, 60px top, 120px bottom)
            const availableWidth = window.innerWidth - 180;
            const availableHeight = window.innerHeight - 180;

            const scaleX = availableWidth / size;
            const scaleY = availableHeight / size;

            // Use larger scale to fit the longer dimension, max 3x
            scale = Math.min(Math.max(scaleX, scaleY), 3);

            // Don't scale too small
            if (scale < 0.5) scale = 0.5;

            // Center the scaled canvas
            const scaledWidth = size * scale;
            const scaledHeight = size * scale;
            translateX = (window.innerWidth - scaledWidth) / 2 - parseFloat(canvas.style.left || 0);
            translateY = (window.innerHeight - scaledHeight) / 2 - parseFloat(canvas.style.top || 0);

            updateTransform();
        }

        // Update transform
        function updateTransform() {
            canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

            const resetBtn = document.getElementById('resetZoomBtn');
            if (Math.abs(scale - 1) > 0.01 || Math.abs(translateX) > 1 || Math.abs(translateY) > 1) {
                resetBtn.classList.add('visible');
            } else {
                resetBtn.classList.remove('visible');
            }
        }

        // Get canvas point from screen coordinates
        function getCanvasPoint(clientX, clientY) {
            const rect = canvas.getBoundingClientRect();
            const x = (clientX - rect.left) / scale;
            const y = (clientY - rect.top) / scale;
            return { x, y };
        }

        // Get grid cell from canvas point
        function getGridCell(x, y) {
            const col = Math.floor(x / CELL_SIZE);
            const row = Math.floor(y / CELL_SIZE);
            if (col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE) {
                return { col, row };
            }
            return null;
        }

        // Get corner from relative position
        function getCorner(relX, relY) {
            const corners = [
                { name: 'tl', x: 0, y: 0 },
                { name: 'tr', x: 1, y: 0 },
                { name: 'bl', x: 0, y: 1 },
                { name: 'br', x: 1, y: 1 }
            ];

            let minDist = Infinity;
            let closestCorner = 'tl';

            corners.forEach(corner => {
                const dist = Math.sqrt(
                    Math.pow(relX - corner.x, 2) +
                    Math.pow(relY - corner.y, 2)
                );
                if (dist < minDist) {
                    minDist = dist;
                    closestCorner = corner.name;
                }
            });

            return closestCorner;
        }

        // Draw triangle
        function drawTriangle(x, y, size, corner, color, inverted) {
            ctx.fillStyle = color;
            ctx.beginPath();

            if (!inverted) {
                switch (corner) {
                    case 'tl':
                        ctx.moveTo(x, y);
                        ctx.lineTo(x + size, y);
                        ctx.lineTo(x, y + size);
                        break;
                    case 'tr':
                        ctx.moveTo(x + size, y);
                        ctx.lineTo(x + size, y + size);
                        ctx.lineTo(x, y);
                        break;
                    case 'bl':
                        ctx.moveTo(x, y + size);
                        ctx.lineTo(x, y);
                        ctx.lineTo(x + size, y + size);
                        break;
                    case 'br':
                        ctx.moveTo(x + size, y + size);
                        ctx.lineTo(x, y + size);
                        ctx.lineTo(x + size, y);
                        break;
                }
            } else {
                switch (corner) {
                    case 'tl':
                        ctx.moveTo(x + size, y);
                        ctx.lineTo(x + size, y + size);
                        ctx.lineTo(x, y + size);
                        break;
                    case 'tr':
                        ctx.moveTo(x, y);
                        ctx.lineTo(x, y + size);
                        ctx.lineTo(x + size, y + size);
                        break;
                    case 'bl':
                        ctx.moveTo(x, y);
                        ctx.lineTo(x + size, y);
                        ctx.lineTo(x + size, y + size);
                        break;
                    case 'br':
                        ctx.moveTo(x, y);
                        ctx.lineTo(x + size, y);
                        ctx.lineTo(x, y + size);
                        break;
                }
            }

            ctx.closePath();
            ctx.fill();
        }

        // Draw arc
        function drawArc(x, y, size, corner, color, inverted) {
            ctx.fillStyle = color;
            ctx.beginPath();

            if (!inverted) {
                switch (corner) {
                    case 'tl':
                        ctx.arc(x, y, size, 0, Math.PI / 2);
                        ctx.lineTo(x, y);
                        break;
                    case 'tr':
                        ctx.arc(x + size, y, size, Math.PI / 2, Math.PI);
                        ctx.lineTo(x + size, y);
                        break;
                    case 'bl':
                        ctx.arc(x, y + size, size, -Math.PI / 2, 0);
                        ctx.lineTo(x, y + size);
                        break;
                    case 'br':
                        ctx.arc(x + size, y + size, size, Math.PI, Math.PI * 1.5);
                        ctx.lineTo(x + size, y + size);
                        break;
                }
            } else {
                switch (corner) {
                    case 'tl':
                        ctx.arc(x, y, size, Math.PI / 2, 0, true);
                        ctx.lineTo(x + size, y);
                        ctx.lineTo(x + size, y + size);
                        ctx.lineTo(x, y + size);
                        break;
                    case 'tr':
                        ctx.arc(x + size, y, size, Math.PI, Math.PI / 2, true);
                        ctx.lineTo(x + size, y + size);
                        ctx.lineTo(x, y + size);
                        ctx.lineTo(x, y);
                        break;
                    case 'bl':
                        ctx.arc(x, y + size, size, 0, (3 * Math.PI) / 2, true);
                        ctx.lineTo(x, y);
                        ctx.lineTo(x + size, y);
                        ctx.lineTo(x + size, y + size);
                        break;
                    case 'br':
                        ctx.arc(x + size, y + size, size, (3 * Math.PI) / 2, Math.PI, true);
                        ctx.lineTo(x, y + size);
                        ctx.lineTo(x, y);
                        ctx.lineTo(x + size, y);
                        break;
                }
            }

            ctx.closePath();
            ctx.fill();
        }

        // Render
        function render(hideGrid = false) {
            // Reset transform and clear
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Apply scale for drawing
            ctx.scale(SCALE, SCALE);

            // Draw background
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE);

            // Draw grid lines
            if (showGrid && !hideGrid) {
                ctx.strokeStyle = bgColor === '#ffffff' ? '#e0e0e0' : '#444444';
                ctx.lineWidth = 1;

                for (let i = 0; i <= GRID_SIZE; i++) {
                    ctx.beginPath();
                    ctx.moveTo(i * CELL_SIZE, 0);
                    ctx.lineTo(i * CELL_SIZE, GRID_SIZE * CELL_SIZE);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(0, i * CELL_SIZE);
                    ctx.lineTo(GRID_SIZE * CELL_SIZE, i * CELL_SIZE);
                    ctx.stroke();
                }
            }

            // Draw cells
            for (let row = 0; row < GRID_SIZE; row++) {
                for (let col = 0; col < GRID_SIZE; col++) {
                    const cell = grid[row][col];
                    if (cell.type && cell.color) {
                        const x = col * CELL_SIZE;
                        const y = row * CELL_SIZE;

                        if (cell.type === 'triangle') {
                            drawTriangle(x, y, CELL_SIZE, cell.corner, cell.color, cell.inverted);
                        } else if (cell.type === 'arc') {
                            drawArc(x, y, CELL_SIZE, cell.corner, cell.color, cell.inverted);
                        } else if (cell.type === 'rect') {
                            ctx.fillStyle = cell.color;
                            ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
                        }
                    }
                }
            }

            // Draw symmetry axes
            if (symmetryMode !== 'none' && !hideGrid) {
                ctx.save();
                // Use a distinctive color for axes
                // Based on background brightness, choose a visible color
                // For simplicity, using a semi-transparent cyan/magenta or standard complement
                ctx.strokeStyle = 'rgba(0, 150, 255, 0.5)'; // Cyan-ish
                ctx.lineWidth = 2; // Slightly thicker

                const center = (GRID_SIZE * CELL_SIZE) / 2;

                if (symmetryMode === 'x' || symmetryMode === 'xy') {
                    // Vertical axis (at X center)
                    ctx.beginPath();
                    ctx.moveTo(center, 0);
                    ctx.lineTo(center, GRID_SIZE * CELL_SIZE);
                    ctx.stroke();
                }

                if (symmetryMode === 'y' || symmetryMode === 'xy') {
                    // Horizontal axis (at Y center)
                    ctx.beginPath();
                    ctx.moveTo(0, center);
                    ctx.lineTo(GRID_SIZE * CELL_SIZE, center);
                    ctx.stroke();
                }
                ctx.restore();
            }
        }

        // Save state for undo
        function saveState() {
            undoStack.push(JSON.stringify(grid));
            if (undoStack.length > MAX_HISTORY) {
                undoStack.shift();
            }
            redoStack = [];
        }

        // Show toast
        function showToast(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.classList.add('visible');
            setTimeout(() => {
                toast.classList.remove('visible');
            }, 1000);
        }

        // Undo
        function undo() {
            // Debounce
            const now = Date.now();
            if (now - lastActionTime < 300) return;
            lastActionTime = now;

            if (undoStack.length <= 1) return;

            const current = undoStack.pop();
            redoStack.push(current);

            const prev = undoStack[undoStack.length - 1];
            grid = JSON.parse(prev);
            render();

            showToast('Undo');
        }

        // Redo
        function redo() {
            // Debounce
            const now = Date.now();
            if (now - lastActionTime < 300) return;
            lastActionTime = now;

            if (redoStack.length === 0) return;

            const next = redoStack.pop();
            undoStack.push(next);

            grid = JSON.parse(next);
            render();

            showToast('Redo');
        }

        // Redo
        function redo() {
            if (redoStack.length === 0) return;

            const next = redoStack.pop();
            undoStack.push(next);

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(next, 0, 0);
            ctx.scale(SCALE, SCALE);
        }

        // Handle click
        // Helper function to flip corner for symmetry
        function flipCorner(corner, flipX, flipY) {
            if (!corner) return null;

            let result = corner;
            if (flipX) {
                // Flip horizontally: tl <-> tr, bl <-> br
                if (corner === 'tl') result = 'tr';
                else if (corner === 'tr') result = 'tl';
                else if (corner === 'bl') result = 'br';
                else if (corner === 'br') result = 'bl';
            }
            if (flipY) {
                // Flip vertically: tl <-> bl, tr <-> br
                if (result === 'tl') result = 'bl';
                else if (result === 'bl') result = 'tl';
                else if (result === 'tr') result = 'br';
                else if (result === 'br') result = 'tr';
            }
            return result;
        }

        // Helper function to draw a single cell
        function drawCell(row, col, corner) {
            if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null;

            const gridCell = grid[row][col];

            if (mode === 'rect') {
                if (gridCell.type === 'rect') {
                    gridCell.type = null;
                    gridCell.color = null;
                } else {
                    gridCell.type = 'rect';
                    gridCell.corner = null;
                    gridCell.color = fillColor;
                    gridCell.inverted = false;
                }
            } else {
                if (gridCell.type === mode && gridCell.corner === corner) {
                    if (!gridCell.inverted) {
                        gridCell.inverted = true;
                    } else {
                        gridCell.type = null;
                        gridCell.corner = null;
                        gridCell.color = null;
                        gridCell.inverted = false;
                    }
                } else {
                    gridCell.type = mode;
                    gridCell.corner = corner;
                    gridCell.color = fillColor;
                    gridCell.inverted = false;
                }
            }
            return gridCell;
        }

        // Helper function to force a cell to a specific state (for symmetry sync)
        function forceCellState(row, col, state) {
            if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;
            const gridCell = grid[row][col];
            gridCell.type = state.type;
            gridCell.corner = state.corner;
            gridCell.color = state.color;
            gridCell.inverted = state.inverted;
        }

        function handleClick(clientX, clientY) {
            if (isSaveMode) return;

            const p = getCanvasPoint(clientX, clientY);
            const cell = getGridCell(p.x, p.y);

            if (!cell) return;

            const { col, row } = cell;

            // Calculate corner for triangle and arc modes
            let corner = null;
            if (mode !== 'rect') {
                const relX = (p.x % CELL_SIZE) / CELL_SIZE;
                const relY = (p.y % CELL_SIZE) / CELL_SIZE;
                corner = getCorner(relX, relY);
            }

            // Draw at primary position
            const resultState = drawCell(row, col, corner);
            if (!resultState) return;

            // Draw at symmetric positions
            if (symmetryMode === 'x' || symmetryMode === 'xy') {
                // X-axis symmetry (left-right mirror)
                const symCol = GRID_SIZE - 1 - col;
                const symCorner = flipCorner(resultState.corner, true, false);

                forceCellState(row, symCol, {
                    ...resultState,
                    corner: symCorner
                });
            }

            if (symmetryMode === 'y' || symmetryMode === 'xy') {
                // Y-axis symmetry (top-bottom mirror)
                const symRow = GRID_SIZE - 1 - row;
                const symCorner = flipCorner(resultState.corner, false, true);

                forceCellState(symRow, col, {
                    ...resultState,
                    corner: symCorner
                });
            }

            if (symmetryMode === 'xy') {
                // Both axes symmetry (diagonal mirror)
                const symRow = GRID_SIZE - 1 - row;
                const symCol = GRID_SIZE - 1 - col;
                const symCorner = flipCorner(resultState.corner, true, true);

                forceCellState(symRow, symCol, {
                    ...resultState,
                    corner: symCorner
                });
            }
            render();
            saveState();
            didInteract = true; // Mark that drawing occurred
        }

        // Canvas events
        canvas.addEventListener('pointerdown', (e) => {
            if (isSaveMode) return;

            e.preventDefault();
            canvas.setPointerCapture(e.pointerId);
            // Track position and total movement
            activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, totalMove: 0 });

            if (e.pointerType === 'pen') {
                pencilDetected = true;
            }

            if (activePointers.size === 1) {
                touchStartTime = Date.now();
                touchStartPos = { x: e.clientX, y: e.clientY };
                maxFingers = 1;
                isPinching = false;
                wasPanning = false; // Reset panning flag for new interaction
                wasPinching = false; // Reset pinching flag for new interaction
                didInteract = false; // Reset interaction flag
            }
            maxFingers = Math.max(maxFingers, activePointers.size);

            // 2本指 = ピンチ/パン準備
            if (activePointers.size === 2) {
                isPinching = false;
                const pts = Array.from(activePointers.values());
                lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                lastPinchCenter = {
                    x: (pts[0].x + pts[1].x) / 2,
                    y: (pts[0].y + pts[1].y) / 2
                };
                initialPinchDist = lastPinchDist;
                initialPinchCenter = { x: lastPinchCenter.x, y: lastPinchCenter.y };
                return;
            }

            // 手のひらモード（スペースキー押下中）
            if (activePointers.size === 1 && isSpacePressed) {
                isPanning = true;
                panStartX = e.clientX;
                panStartY = e.clientY;
                lastPanX = translateX;
                lastPanY = translateY;
                canvas.style.cursor = 'grabbing';
                return;
            }

            // クリック/タッチで描画（ペン、マウス、またはApple Pencilが検出されていない指タッチ）
            const canDraw = e.pointerType === 'pen' || e.pointerType === 'mouse' || (e.pointerType === 'touch' && !pencilDetected);

            if (activePointers.size === 1 && canDraw) {
                // 描画処理はclickイベントで行う
            }
        });

        canvas.addEventListener('pointermove', (e) => {
            if (isSaveMode) return;

            if (!activePointers.has(e.pointerId)) return;
            e.preventDefault();

            const pointer = activePointers.get(e.pointerId);
            // Calculate movement delta
            const dx = e.clientX - pointer.x;
            const dy = e.clientY - pointer.y;
            const moveDist = Math.hypot(dx, dy);

            // accumulation
            pointer.totalMove = (pointer.totalMove || 0) + moveDist;

            // Update position
            pointer.x = e.clientX;
            pointer.y = e.clientY;
            activePointers.set(e.pointerId, pointer);

            // 2本指 = ピンチズーム / パン
            if (activePointers.size === 2) {
                const pts = Array.from(activePointers.values());
                const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                const center = {
                    x: (pts[0].x + pts[1].x) / 2,
                    y: (pts[0].y + pts[1].y) / 2
                };

                // 閾値: 10px以上動いたらピンチ開始
                const distDelta = Math.abs(dist - initialPinchDist);
                const centerDelta = Math.hypot(center.x - initialPinchCenter.x, center.y - initialPinchCenter.y);

                if (distDelta > 10 || centerDelta > 10) {
                    isPinching = true;
                    wasPinching = true; // Track that pinching occurred
                    // Also consider this interaction if meaningful movement happened
                    didInteract = true;
                }

                if (isPinching) {
                    const zoomFactor = dist / lastPinchDist;
                    const oldScale = scale;
                    scale = Math.max(0.1, Math.min(20, scale * zoomFactor));

                    // Zoom anchored at the pinch center (midpoint of two fingers)
                    translateX = center.x - (center.x - translateX) * (scale / oldScale);
                    translateY = center.y - (center.y - translateY) * (scale / oldScale);

                    updateTransform();
                    lastPinchDist = dist;
                    lastPinchCenter = center;
                }
                return;
            }

            // Pan
            if (isPanning && activePointers.size === 1) {
                translateX = lastPanX + (e.clientX - panStartX);
                translateY = lastPanY + (e.clientY - panStartY);
                updateTransform();
                wasPanning = true; // Mark that panning has occurred
                didInteract = true; // Mark interaction occurred
            }

            // Jitter threshold for general interaction
            // Only set didInteract if movement is significant (> 5px) to allow for sloppy taps
            if (pointer.totalMove > 5) {
                // If we are not pinching/panning but moving effectively (e.g. drawing)
                // Note: Drawing logic is in click, but this flag prevents undo.
                // If we are just tapping, totalMove should be low.
                // Only set didInteract if strict movement occurs that isn't a tap
            }
        });

        canvas.addEventListener('pointerup', (e) => {
            const pointer = activePointers.get(e.pointerId);

            // Always clean up pointer state, even in save mode
            activePointers.delete(e.pointerId);

            // Try to release pointer capture if it was set
            try {
                canvas.releasePointerCapture(e.pointerId);
            } catch (err) {
                // Ignore error if pointer was not captured
            }

            if (isSaveMode) return;

            // If significant movement occurred for this specific pointer, mark interaction
            if (pointer && pointer.totalMove > 8) {
                didInteract = true;
            }

            // Reset pinch if fingers dropped below 2
            if (activePointers.size < 2) {
                isPinching = false;
                lastPinchDist = 0;
                initialPinchDist = 0;
            }

            // Reset pan
            if (activePointers.size === 0) {
                isPanning = false;
                canvas.style.cursor = isSpacePressed ? 'grab' : '';

                // Check for gesture (2/3 finger tap for undo/redo)
                // Only trigger if no meaningful interaction occurred (pure tap gesture)
                const duration = Date.now() - touchStartTime;

                // Thresholds:
                // duration < 400ms (fast tap)
                // !didInteract (no significant movement/panning/zooming)
                if (duration < 400 && !didInteract) {
                    if (maxFingers === 2) undo();
                    if (maxFingers === 3) redo();
                }

                // Reset state (but keep wasPanning/wasPinching for click handler)
                touchStartTime = 0;
                maxFingers = 0;
                isPinching = false;
                didInteract = false;
                // Note: wasPanning and wasPinching are NOT reset here - they're used by click handler
            }
        });

        // Handle pointer cancellation (system interruptions, calls, etc.)
        canvas.addEventListener('pointercancel', (e) => {
            // Always clean up pointer state when cancelled
            activePointers.delete(e.pointerId);

            // Try to release pointer capture if it was set
            try {
                canvas.releasePointerCapture(e.pointerId);
            } catch (err) {
                // Ignore error if pointer was not captured
            }

            // Reset pinch if fingers dropped below 2
            if (activePointers.size < 2) {
                isPinching = false;
                lastPinchDist = 0;
                initialPinchDist = 0;
            }

            // Reset pan
            if (activePointers.size === 0) {
                isPanning = false;
                wasPanning = false;
                wasPinching = false;
                canvas.style.cursor = isSpacePressed ? 'grab' : '';
                touchStartTime = 0;
                maxFingers = 0;
                didInteract = false;
            }
        });

        canvas.addEventListener('click', (e) => {
            if (activePointers.size === 0) {
                // Skip click if panning or pinching occurred
                if (wasPanning || wasPinching) {
                    wasPanning = false; // Reset for next interaction
                    wasPinching = false; // Reset for next interaction
                    return;
                }

                // Ctrl + Space + Click: Zoom in/out
                if (isCtrlPressed && isSpacePressed) {
                    const zoomAmount = isAltPressed ? 0.8 : 1.25;
                    const oldScale = scale;
                    scale = Math.max(0.1, Math.min(20, scale * zoomAmount));

                    const rect = canvas.getBoundingClientRect();
                    const centerX = e.clientX;
                    const centerY = e.clientY;

                    translateX = centerX - (centerX - translateX) * (scale / oldScale);
                    translateY = centerY - (centerY - translateY) * (scale / oldScale);

                    updateTransform();
                } else if (!isSpacePressed) {
                    // Only draw if space is not pressed
                    handleClick(e.clientX, e.clientY);
                }
            }
        });

        // Mouse wheel zoom
        canvas.addEventListener('wheel', (e) => {
            if (isSaveMode) return;

            e.preventDefault();
            const zoomAmount = e.deltaY < 0 ? 1.1 : 0.9;
            const oldScale = scale;
            scale = Math.max(0.1, Math.min(20, scale * zoomAmount));

            const rect = canvas.getBoundingClientRect();
            const centerX = e.clientX;
            const centerY = e.clientY;

            translateX = centerX - (centerX - translateX) * (scale / oldScale);
            translateY = centerY - (centerY - translateY) * (scale / oldScale);

            updateTransform();
        }, { passive: false });

        // Mode buttons
        document.getElementById('triangleBtn').addEventListener('click', () => {
            mode = 'triangle';
            document.querySelectorAll('[data-tool]').forEach(btn => btn.classList.remove('active'));
            document.getElementById('triangleBtn').classList.add('active');
        });

        document.getElementById('arcBtn').addEventListener('click', () => {
            mode = 'arc';
            document.querySelectorAll('[data-tool]').forEach(btn => btn.classList.remove('active'));
            document.getElementById('arcBtn').classList.add('active');
        });

        document.getElementById('rectBtn').addEventListener('click', () => {
            mode = 'rect';
            document.querySelectorAll('[data-tool]').forEach(btn => btn.classList.remove('active'));
            document.getElementById('rectBtn').classList.add('active');
        });

        // Symmetry mode toggle
        function updateSymmetryIcon() {
            const lineV = document.getElementById('symmetryLineV');
            const lineH = document.getElementById('symmetryLineH');
            const btn = document.getElementById('symmetryBtn');

            switch (symmetryMode) {
                case 'none':
                    lineV.style.display = 'none';
                    lineH.style.display = 'none';
                    btn.classList.remove('active');
                    break;
                case 'x':
                    lineV.style.display = 'block';
                    lineH.style.display = 'none';
                    btn.classList.add('active');
                    break;
                case 'y':
                    lineV.style.display = 'none';
                    lineH.style.display = 'block';
                    btn.classList.add('active');
                    break;
                case 'xy':
                    lineV.style.display = 'block';
                    lineH.style.display = 'block';
                    btn.classList.add('active');
                    break;
            }
        }

        document.getElementById('symmetryBtn').addEventListener('click', () => {
            // Cycle through modes: none -> x -> y -> xy -> none
            switch (symmetryMode) {
                case 'none':
                    symmetryMode = 'x';
                    break;
                case 'x':
                    symmetryMode = 'y';
                    break;
                case 'y':
                    symmetryMode = 'xy';
                    break;
                case 'xy':
                    symmetryMode = 'none';
                    break;
            }
            updateSymmetryIcon();
            render();
        });

        // Color pickers
        function updateFillColor(color) {
            fillColor = color;
            document.getElementById('fillColorDisplay').style.background = fillColor;
            document.getElementById('fillColorPicker').value = fillColor;

            // Update all existing drawn cells to new color
            for (let row = 0; row < GRID_SIZE; row++) {
                for (let col = 0; col < GRID_SIZE; col++) {
                    const cell = grid[row][col];
                    if (cell.type && cell.color) {
                        cell.color = fillColor;
                    }
                }
            }

            render();
            saveState();
        }

        function updateBgColor(color) {
            bgColor = color;
            document.getElementById('bgColorDisplay').style.background = bgColor;
            document.getElementById('bgColorPicker').value = bgColor;
            render();
        }

        document.getElementById('fillColorPicker').addEventListener('input', (e) => {
            updateFillColor(e.target.value);
        });

        document.getElementById('fillColorPicker').addEventListener('change', (e) => {
            updateFillColor(e.target.value);
        });

        document.getElementById('bgColorPicker').addEventListener('input', (e) => {
            updateBgColor(e.target.value);
        });

        document.getElementById('bgColorPicker').addEventListener('change', (e) => {
            updateBgColor(e.target.value);
        });

        // Grid toggle
        document.getElementById('gridBtn').addEventListener('click', () => {
            showGrid = !showGrid;
            document.getElementById('gridBtn').classList.toggle('active', showGrid);
            render();
        });

        // Clear
        document.getElementById('clearBtn').addEventListener('click', () => {
            if (confirm('全てクリアしますか？')) {
                initGrid();
                render();
                saveState();
            }
        });

        // Save button (updated below with selection canvas)

        // Save all
        document.getElementById('saveAllBtn').addEventListener('click', () => {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');

            const useTransparent = document.getElementById('transparentBg').checked;
            const exportScale = selectedScale;
            const size = GRID_SIZE * CELL_SIZE * exportScale;

            tempCanvas.width = size;
            tempCanvas.height = size;
            tempCtx.scale(exportScale, exportScale);

            if (!useTransparent) {
                tempCtx.fillStyle = bgColor;
                tempCtx.fillRect(0, 0, GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE);
            }

            // Draw cells without grid
            for (let row = 0; row < GRID_SIZE; row++) {
                for (let col = 0; col < GRID_SIZE; col++) {
                    const cell = grid[row][col];
                    if (cell.type && cell.color) {
                        const x = col * CELL_SIZE;
                        const y = row * CELL_SIZE;

                        if (cell.type === 'triangle') {
                            drawTriangleToContext(tempCtx, x, y, CELL_SIZE, cell.corner, cell.color, cell.inverted);
                        } else if (cell.type === 'arc') {
                            drawArcToContext(tempCtx, x, y, CELL_SIZE, cell.corner, cell.color, cell.inverted);
                        } else if (cell.type === 'rect') {
                            tempCtx.fillStyle = cell.color;
                            tempCtx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
                            // BLEED FIX: Add stroke to cover gaps
                            tempCtx.strokeStyle = cell.color;
                            tempCtx.lineWidth = 1;
                            tempCtx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
                        }
                    }
                }
            }

            tempCanvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'desu_pattern_' + Date.now() + '.png';
                a.click();
                URL.revokeObjectURL(url);
            });
        });

        // Helper functions for export
        function drawTriangleToContext(context, x, y, size, corner, color, inverted) {
            context.fillStyle = color;
            context.beginPath();
            // Same logic as drawTriangle but for different context
            if (!inverted) {
                switch (corner) {
                    case 'tl': context.moveTo(x, y); context.lineTo(x + size, y); context.lineTo(x, y + size); break;
                    case 'tr': context.moveTo(x + size, y); context.lineTo(x + size, y + size); context.lineTo(x, y); break;
                    case 'bl': context.moveTo(x, y + size); context.lineTo(x, y); context.lineTo(x + size, y + size); break;
                    case 'br': context.moveTo(x + size, y + size); context.lineTo(x, y + size); context.lineTo(x + size, y); break;
                }
            } else {
                switch (corner) {
                    case 'tl': context.moveTo(x + size, y); context.lineTo(x + size, y + size); context.lineTo(x, y + size); break;
                    case 'tr': context.moveTo(x, y); context.lineTo(x, y + size); context.lineTo(x + size, y + size); break;
                    case 'bl': context.moveTo(x, y); context.lineTo(x + size, y); context.lineTo(x + size, y + size); break;
                    case 'br': context.moveTo(x, y); context.lineTo(x + size, y); context.lineTo(x, y + size); break;
                }
            }
            context.closePath();
            context.fill();

            // BLEED FIX: Add stroke to cover gaps
            context.lineWidth = 1;
            context.strokeStyle = color;
            context.stroke();
        }

        function drawArcToContext(context, x, y, size, corner, color, inverted) {
            context.fillStyle = color;
            context.beginPath();
            // Same logic as drawArc but for different context
            if (!inverted) {
                switch (corner) {
                    case 'tl': context.arc(x, y, size, 0, Math.PI / 2); context.lineTo(x, y); break;
                    case 'tr': context.arc(x + size, y, size, Math.PI / 2, Math.PI); context.lineTo(x + size, y); break;
                    case 'bl': context.arc(x, y + size, size, -Math.PI / 2, 0); context.lineTo(x, y + size); break;
                    case 'br': context.arc(x + size, y + size, size, Math.PI, Math.PI * 1.5); context.lineTo(x + size, y + size); break;
                }
            } else {
                switch (corner) {
                    case 'tl': context.arc(x, y, size, Math.PI / 2, 0, true); context.lineTo(x + size, y); context.lineTo(x + size, y + size); context.lineTo(x, y + size); break;
                    case 'tr': context.arc(x + size, y, size, Math.PI, Math.PI / 2, true); context.lineTo(x + size, y + size); context.lineTo(x, y + size); context.lineTo(x, y); break;
                    case 'bl': context.arc(x, y + size, size, 0, (3 * Math.PI) / 2, true); context.lineTo(x, y); context.lineTo(x + size, y); context.lineTo(x + size, y + size); break;
                    case 'br': context.arc(x + size, y + size, size, (3 * Math.PI) / 2, Math.PI, true); context.lineTo(x, y + size); context.lineTo(x, y); context.lineTo(x + size, y); break;
                }
            }
            context.closePath();
            context.fill();

            // BLEED FIX: Add stroke to cover gaps
            context.lineWidth = 1;
            context.strokeStyle = color;
            context.stroke();
        }

        // Scale buttons
        document.querySelectorAll('[data-scale]').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedScale = parseInt(btn.dataset.scale);
                document.querySelectorAll('[data-scale]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Reset zoom
        document.getElementById('resetZoomBtn').addEventListener('click', () => {
            scale = 1;
            translateX = 0;
            translateY = 0;
            updateTransform();
        });

        // Credit modal
        document.getElementById('credit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('credit-modal').classList.add('visible');
            // ヘルプモード有効化（ツールチップ表示）
            document.body.classList.add('help-mode');
        });

        document.getElementById('credit-modal').addEventListener('click', (e) => {
            if (e.target.id === 'credit-modal') {
                document.getElementById('credit-modal').classList.remove('visible');
                // ヘルプモード無効化（ツールチップ非表示）
                document.body.classList.remove('help-mode');
            }
        });

        // ヘルプモード時、モーダル外（ツールバーや？ボタン含む）のクリックで復帰
        document.addEventListener('click', (e) => {
            if (!document.body.classList.contains('help-mode')) return;

            const modal = document.getElementById('credit-modal');
            const creditContent = document.getElementById('credit-content');

            // credit-content内のクリックは無視
            if (creditContent.contains(e.target)) return;

            // それ以外の場所（ツール、？ボタン、モーダル背景など）ならヘルプモード解除
            e.preventDefault();
            e.stopPropagation();
            modal.classList.remove('visible');
            document.body.classList.remove('help-mode');
        }, true); // キャプチャフェーズで処理（ツールボタンのリスナーより先に実行）

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Track modifier keys
            if (e.key === 'Control' || e.metaKey) isCtrlPressed = true;
            if (e.key === 'Alt') isAltPressed = true;

            if (isSaveMode && e.key !== ' ') return;

            // Space: pan mode (or zoom mode with Ctrl)
            if (e.key === ' ' && !isSpacePressed) {
                e.preventDefault();
                isSpacePressed = true;
                if (!isPanning && !isCtrlPressed) {
                    canvas.style.cursor = 'grab';
                } else if (isCtrlPressed) {
                    canvas.style.cursor = isAltPressed ? 'zoom-out' : 'zoom-in';
                }
                return;
            }

            // Cmd/Ctrl + S: save
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                document.getElementById('saveBtn').click();
                return;
            }

            // Cmd/Ctrl + Shift + Z: redo
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
                e.preventDefault();
                redo();
                return;
            }

            // Cmd/Ctrl + Y: redo
            if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
                e.preventDefault();
                redo();
                return;
            }

            // Cmd/Ctrl + Z: undo
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                undo();
                return;
            }

            if (e.metaKey || e.ctrlKey || e.altKey) return;

            switch (e.key.toLowerCase()) {
                case '1':
                    document.getElementById('triangleBtn').click();
                    break;
                case '2':
                    document.getElementById('arcBtn').click();
                    break;
                case '3':
                    document.getElementById('rectBtn').click();
                    break;
                case 'x':
                    // Swap fill and bg colors
                    const tempColor = fillColor;
                    updateFillColor(bgColor);
                    updateBgColor(tempColor);
                    break;
                case 's':
                    document.getElementById('symmetryBtn').click();
                    break;
                case 'delete':
                case 'backspace':
                    e.preventDefault();
                    document.getElementById('clearBtn').click();
                    break;
                case 'tab':
                    e.preventDefault();
                    const toolbarLeft = document.getElementById('toolbar-left');
                    const toolbarRight = document.getElementById('toolbar-right');
                    const creditBtn = document.getElementById('credit-btn');

                    if (toolbarLeft.style.display === 'none') {
                        toolbarLeft.style.display = 'flex';
                        toolbarRight.style.display = 'flex';
                        creditBtn.style.display = 'flex';
                    } else {
                        toolbarLeft.style.display = 'none';
                        toolbarRight.style.display = 'none';
                        creditBtn.style.display = 'none';
                    }
                    break;
            }
        });

        document.addEventListener('keyup', (e) => {
            // Track modifier key release
            if (e.key === 'Control' || e.key === 'Meta') isCtrlPressed = false;
            if (e.key === 'Alt') isAltPressed = false;

            if (e.key === ' ') {
                e.preventDefault();
                isSpacePressed = false;
                isPanning = false;
                canvas.style.cursor = '';
            }
        });

        // Selection functionality
        const selectionCanvas = document.getElementById('selection-canvas');
        const selCtx = selectionCanvas.getContext('2d');
        const saveOverlay = document.getElementById('save-overlay');

        function updateSelectionCanvas() {
            selectionCanvas.width = window.innerWidth;
            selectionCanvas.height = window.innerHeight;
        }

        window.addEventListener('resize', () => {
            resizeCanvas();
            if (isSaveMode) updateSelectionCanvas();
        });

        // Selection drawing on overlay (not selection-canvas)
        saveOverlay.addEventListener('pointerdown', (e) => {
            if (!isSaveMode) return;
            selectionStart = { x: e.clientX, y: e.clientY };
            selectionEnd = { x: e.clientX, y: e.clientY };
            confirmedSelection = null;

            // 範囲選択開始時にモーダルを非表示
            document.getElementById('save-ui').classList.add('hidden-during-selection');
            document.getElementById('save-ui').classList.remove('in-confirmation-mode');
            document.getElementById('confirmSelectionBtn').style.display = 'none';
            document.getElementById('copySelectionBtn').style.display = 'none';
            document.getElementById('redoSelectionBtn').style.display = 'none';
        });

        saveOverlay.addEventListener('pointermove', (e) => {
            if (!isSaveMode || !selectionStart || confirmedSelection) return;
            selectionEnd = { x: e.clientX, y: e.clientY };

            const rectX = Math.min(selectionStart.x, selectionEnd.x);
            const rectY = Math.min(selectionStart.y, selectionEnd.y);
            const rectW = Math.abs(selectionEnd.x - selectionStart.x);
            const rectH = Math.abs(selectionEnd.y - selectionStart.y);

            selCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
            selCtx.strokeStyle = '#fff';
            selCtx.lineWidth = 2;
            selCtx.setLineDash([5, 5]);
            selCtx.strokeRect(rectX, rectY, rectW, rectH);
            // 選択中はほとんど透明にして背景を見やすく
            selCtx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            selCtx.fillRect(rectX, rectY, rectW, rectH);
        });

        saveOverlay.addEventListener('pointerup', (e) => {
            if (!isSaveMode || !selectionStart) return;

            const rectX = Math.min(selectionStart.x, selectionEnd.x);
            const rectY = Math.min(selectionStart.y, selectionEnd.y);
            const rectW = Math.abs(selectionEnd.x - selectionStart.x);
            const rectH = Math.abs(selectionEnd.y - selectionStart.y);

            if (rectW > 10 && rectH > 10) {
                confirmedSelection = { x: rectX, y: rectY, w: rectW, h: rectH };

                // 選択を確定して描画（最終状態）
                selCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
                selCtx.strokeStyle = '#fff';
                selCtx.lineWidth = 2;
                selCtx.setLineDash([5, 5]);
                selCtx.strokeRect(rectX, rectY, rectW, rectH);
                selCtx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                selCtx.fillRect(rectX, rectY, rectW, rectH);

                // サイズ表示を更新
                const sizeDisplay = document.getElementById('selection-size');
                if (sizeDisplay) {
                    const canvasRect = canvas.getBoundingClientRect();
                    const displayW = Math.round(rectW / scale * selectedScale);
                    const displayH = Math.round(rectH / scale * selectedScale);
                    sizeDisplay.textContent = `${displayW}px × ${displayH}px`;
                    sizeDisplay.style.display = 'block';
                }

                // 選択確定後、モーダルを表示して確認モードに
                document.getElementById('save-ui').classList.remove('hidden-during-selection');
                document.getElementById('save-ui').classList.add('in-confirmation-mode');
                document.getElementById('confirmSelectionBtn').style.display = 'inline-block';
                document.getElementById('copySelectionBtn').style.display = 'inline-block';
                document.getElementById('redoSelectionBtn').style.display = 'inline-block';
            } else {
                // 小さすぎる選択はキャンセル
                selectionStart = null;
                selectionEnd = null;
                selCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
                document.getElementById('save-ui').classList.remove('hidden-during-selection');
            }
        });

        // Confirm selection button
        document.getElementById('confirmSelectionBtn').addEventListener('click', () => {
            if (!confirmedSelection) return;
            saveSelection(confirmedSelection, false);
        });

        // Copy selection button
        document.getElementById('copySelectionBtn').addEventListener('click', async () => {
            if (!confirmedSelection) return;

            const btn = document.getElementById('copySelectionBtn');
            const originalText = btn.textContent;

            try {
                const canvasRect = canvas.getBoundingClientRect();
                const x = (confirmedSelection.x - canvasRect.left) / scale;
                const y = (confirmedSelection.y - canvasRect.top) / scale;
                const w = confirmedSelection.w / scale;
                const h = confirmedSelection.h / scale;

                const useTransparent = document.getElementById('transparentBg').checked;
                const exportScale = selectedScale;

                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');

                tempCanvas.width = w * exportScale;
                tempCanvas.height = h * exportScale;
                tempCtx.scale(exportScale, exportScale);

                if (!useTransparent) {
                    tempCtx.fillStyle = bgColor;
                    tempCtx.fillRect(0, 0, w, h);
                }

                // Draw visible cells in selection
                const startCol = Math.floor(x / CELL_SIZE);
                const startRow = Math.floor(y / CELL_SIZE);
                const endCol = Math.ceil((x + w) / CELL_SIZE);
                const endRow = Math.ceil((y + h) / CELL_SIZE);

                tempCtx.save();
                tempCtx.translate(-x, -y);

                for (let row = Math.max(0, startRow); row < Math.min(GRID_SIZE, endRow); row++) {
                    for (let col = Math.max(0, startCol); col < Math.min(GRID_SIZE, endCol); col++) {
                        const cell = grid[row][col];
                        if (cell.type && cell.color) {
                            const cellX = col * CELL_SIZE;
                            const cellY = row * CELL_SIZE;

                            if (cell.type === 'triangle') {
                                drawTriangleToContext(tempCtx, cellX, cellY, CELL_SIZE, cell.corner, cell.color, cell.inverted);
                            } else if (cell.type === 'arc') {
                                drawArcToContext(tempCtx, cellX, cellY, CELL_SIZE, cell.corner, cell.color, cell.inverted);
                            } else if (cell.type === 'rect') {
                                tempCtx.fillStyle = cell.color;
                                tempCtx.fillRect(cellX, cellY, CELL_SIZE, CELL_SIZE);
                                // BLEED FIX: Add stroke to cover gaps
                                tempCtx.strokeStyle = cell.color;
                                tempCtx.lineWidth = 1;
                                tempCtx.strokeRect(cellX, cellY, CELL_SIZE, CELL_SIZE);
                            }
                        }
                    }
                }

                tempCtx.restore();

                // Safari/iPadでの互換性のためにClipboardItemにPromiseを渡す
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'image/png': new Promise((resolve, reject) => {
                            tempCanvas.toBlob((blob) => {
                                if (blob) resolve(blob);
                                else reject(new Error('Blob generation failed'));
                            }, 'image/png');
                        })
                    })
                ]);

                btn.textContent = 'コピー完了!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 1500);
            } catch (err) {
                console.error('Failed to copy:', err);
                btn.textContent = 'コピー失敗';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 1500);
            }
        });

        // 倍率選択
        document.querySelectorAll('[data-scale]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-scale]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedScale = parseInt(btn.dataset.scale);

                // サイズ表示を更新（確定済みの場合のみ）
                if (confirmedSelection) {
                    const sizeDisplay = document.getElementById('selection-size');
                    if (sizeDisplay) {
                        const canvasRect = canvas.getBoundingClientRect();
                        const w = confirmedSelection.w / scale;
                        const h = confirmedSelection.h / scale;
                        const finalW = Math.round(w * selectedScale);
                        const finalH = Math.round(h * selectedScale);
                        sizeDisplay.textContent = `${finalW}px × ${finalH}px`;
                    }
                }
            });
        });


        // Redo selection button
        document.getElementById('redoSelectionBtn').addEventListener('click', () => {
            confirmedSelection = null;
            selectionStart = null;
            selectionEnd = null;
            selCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);

            // サイズ表示を非表示
            const sizeDisplay = document.getElementById('selection-size');
            if (sizeDisplay) {
                sizeDisplay.style.display = 'none';
            }

            // 確認モードを解除
            document.getElementById('save-ui').classList.remove('in-confirmation-mode');
            document.getElementById('confirmSelectionBtn').style.display = 'none';
            document.getElementById('copySelectionBtn').style.display = 'none';
            document.getElementById('redoSelectionBtn').style.display = 'none';
        });

        // Export selection
        function exportSelection(selection) {
            return new Promise((resolve) => {
                const canvasRect = canvas.getBoundingClientRect();
                const x = (selection.x - canvasRect.left) / scale;
                const y = (selection.y - canvasRect.top) / scale;
                const w = selection.w / scale;
                const h = selection.h / scale;

                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');

                const useTransparent = document.getElementById('transparentBg').checked;
                const exportScale = selectedScale;

                tempCanvas.width = w * exportScale;
                tempCanvas.height = h * exportScale;
                tempCtx.scale(exportScale, exportScale);

                if (!useTransparent) {
                    tempCtx.fillStyle = bgColor;
                    tempCtx.fillRect(0, 0, w, h);
                }

                // Draw visible cells in selection
                const startCol = Math.floor(x / CELL_SIZE);
                const startRow = Math.floor(y / CELL_SIZE);
                const endCol = Math.ceil((x + w) / CELL_SIZE);
                const endRow = Math.ceil((y + h) / CELL_SIZE);

                tempCtx.save();
                tempCtx.translate(-x, -y);

                for (let row = Math.max(0, startRow); row < Math.min(GRID_SIZE, endRow); row++) {
                    for (let col = Math.max(0, startCol); col < Math.min(GRID_SIZE, endCol); col++) {
                        const cell = grid[row][col];
                        if (cell.type && cell.color) {
                            const cellX = col * CELL_SIZE;
                            const cellY = row * CELL_SIZE;

                            if (cell.type === 'triangle') {
                                drawTriangleToContext(tempCtx, cellX, cellY, CELL_SIZE, cell.corner, cell.color, cell.inverted);
                            } else if (cell.type === 'arc') {
                                drawArcToContext(tempCtx, cellX, cellY, CELL_SIZE, cell.corner, cell.color, cell.inverted);
                            } else if (cell.type === 'rect') {
                                tempCtx.fillStyle = cell.color;
                                tempCtx.fillRect(cellX, cellY, CELL_SIZE, CELL_SIZE);
                                // BLEED FIX: Add stroke to cover gaps
                                tempCtx.strokeStyle = cell.color;
                                tempCtx.lineWidth = 1;
                                tempCtx.strokeRect(cellX, cellY, CELL_SIZE, CELL_SIZE);
                            }
                        }
                    }
                }

                tempCtx.restore();

                tempCanvas.toBlob((blob) => {
                    resolve(blob);
                });
            });
        }

        // Save selection
        function saveSelection(selection, copy = false) {
            exportSelection(selection).then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'desu_pattern_' + Date.now() + '.png';
                a.click();
                URL.revokeObjectURL(url);
            });
        }

        // Save mode
        document.getElementById('saveBtn').addEventListener('click', () => {
            isSaveMode = true;
            document.getElementById('save-overlay').classList.add('active');
            document.getElementById('save-ui').classList.add('active');
            document.getElementById('save-ui').classList.remove('hidden-during-selection');
            document.getElementById('save-ui').classList.remove('in-confirmation-mode');
            updateSelectionCanvas();
            selectionCanvas.style.display = 'block';
            selectionStart = null;
            selectionEnd = null;
            confirmedSelection = null;
        });

        document.getElementById('cancelSaveBtn').addEventListener('click', () => {
            isSaveMode = false;
            document.getElementById('save-overlay').classList.remove('active');
            document.getElementById('save-ui').classList.remove('active');
            document.getElementById('save-ui').classList.remove('hidden-during-selection');
            document.getElementById('save-ui').classList.remove('in-confirmation-mode');
            selectionCanvas.style.display = 'none';
            selCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
            selectionStart = null;
            selectionEnd = null;
            confirmedSelection = null;
            document.getElementById('confirmSelectionBtn').style.display = 'none';
            document.getElementById('copySelectionBtn').style.display = 'none';
            document.getElementById('redoSelectionBtn').style.display = 'none';

            // Clean up pointer state that may have been left during save mode
            activePointers.clear();
            isPanning = false;
            isPinching = false;
            wasPanning = false;
            wasPinching = false;
            canvas.style.cursor = '';
        });

        // Initialize
        initGrid();
        resizeCanvas();
        fitCanvasToScreen(); // Fit to screen on initial load
        saveState(); // Initial state
        updateSelectionCanvas();
