/* ============================================================
   DESU™ NURI — 厚塗りペイント
   ============================================================ */

'use strict';

// ---- Constants ----
const CANVAS_SIZES = {
  '1:1':  { w: 1080, h: 1080 },
  '4:5':  { w: 1080, h: 1350 },
  '9:16': { w: 1080, h: 1920 },
};
const MAX_UNDO = 25;
const MAX_RECENT = 12;
const DB_NAME = 'nuri-db';
const DB_VERSION = 1;
const DB_STORE = 'autosave';
const DB_KEY = 'nuri-autosave';

// ---- State ----
const state = {
  // Canvas dims
  cw: 1080,
  ch: 1350,

  // Viewport
  scale: 1,
  tx: 0,
  ty: 0,

  // Tool
  tool: 'brush',
  prevTool: 'brush',

  // Brush
  brushSize: 30,
  opacity: 80,

  // Color (HSB: h=0-360, s=0-100, b=0-100)
  hue: 20,
  sat: 90,
  bri: 10,

  // Handedness
  handedness: 'right',

  // Offset
  offsetEnabled: true,
  offsetAmount: 60,

  // Drawing
  isDrawing: false,
  lastDrawPoint: null,
  drawingPointerId: null,

  // Pinch
  isPinching: false,
  pinchStartDist: 0,
  pinchStartScale: 1,
  pinchStartMidX: 0,
  pinchStartMidY: 0,
  pinchStartTx: 0,
  pinchStartTy: 0,

  // Active pointers
  activePointers: new Map(),

  // Undo/Redo
  undoStack: [],
  redoStack: [],

  // Recent colors
  recentColors: [],

  // DB
  db: null,
};

// ---- Canvas refs ----
let displayCanvas, displayCtx;
let baseCanvas,    baseCtx;
let strokeCanvas,  strokeCtx;
let cursorCanvas,  cursorCtx;
let sbCanvas,      sbCtx;
let hueCanvas,     hueCtx;

// ---- Color utilities ----
function hsbToRgb(h, s, b) {
  s /= 100; b /= 100;
  const k = n => (n + h / 60) % 6;
  const f = n => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}

function rgbToHsb(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r)      h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else                h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, max === 0 ? 0 : (d / max) * 100, max * 100];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

function getColor() {
  const [r, g, b] = hsbToRgb(state.hue, state.sat, state.bri);
  return { r, g, b, hex: rgbToHex(r, g, b) };
}

// ---- Canvas / viewport setup ----
function initCanvases(w, h) {
  state.cw = w;
  state.ch = h;

  displayCanvas.width  = w;
  displayCanvas.height = h;
  baseCanvas.width     = w;
  baseCanvas.height    = h;
  strokeCanvas.width   = w;
  strokeCanvas.height  = h;

  // White background
  baseCtx.fillStyle = '#ffffff';
  baseCtx.fillRect(0, 0, w, h);

  fitToViewport();
  render();
}

function fitToViewport() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const m = 0.9;
  state.scale = Math.min((vw * m) / state.cw, (vh * m) / state.ch);
  state.tx = (vw - state.cw * state.scale) / 2;
  state.ty = (vh - state.ch * state.scale) / 2;
  applyViewportTransform();
}

function applyViewportTransform() {
  const t = `translate(${state.tx}px,${state.ty}px) scale(${state.scale})`;
  displayCanvas.style.transform = t;
}

// ---- Render ----
function render() {
  const { cw: W, ch: H } = state;
  displayCtx.clearRect(0, 0, W, H);
  displayCtx.fillStyle = '#ffffff';
  displayCtx.fillRect(0, 0, W, H);
  displayCtx.drawImage(baseCanvas, 0, 0);

  if (state.isDrawing && state.tool === 'brush') {
    displayCtx.globalAlpha = state.opacity / 100;
    displayCtx.drawImage(strokeCanvas, 0, 0);
    displayCtx.globalAlpha = 1;
  }
}

// ---- Coordinate transforms ----
function screenToCanvas(sx, sy) {
  return { x: (sx - state.tx) / state.scale, y: (sy - state.ty) / state.scale };
}

function getOffsetScreen(sx, sy) {
  if (!state.offsetEnabled || state.isPinching) return { x: sx, y: sy };
  const d = state.offsetAmount;
  return state.handedness === 'right'
    ? { x: sx - d, y: sy - d }
    : { x: sx + d, y: sy - d };
}

function getDrawPos(rawSx, rawSy) {
  const os = getOffsetScreen(rawSx, rawSy);
  return screenToCanvas(os.x, os.y);
}

// ---- Brush stamping ----
function stampBrush(ctx, x, y, size, r, g, b) {
  const radius = size / 2;
  const grd = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grd.addColorStop(0,   `rgba(${r},${g},${b},1)`);
  grd.addColorStop(0.5, `rgba(${r},${g},${b},0.85)`);
  grd.addColorStop(1,   `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function stampEraser(x, y, size) {
  const radius = size / 2;
  const grd = baseCtx.createRadialGradient(x, y, 0, x, y, radius);
  grd.addColorStop(0,   'rgba(255,255,255,1)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.85)');
  grd.addColorStop(1,   'rgba(255,255,255,0)');
  baseCtx.fillStyle = grd;
  baseCtx.beginPath();
  baseCtx.arc(x, y, radius, 0, Math.PI * 2);
  baseCtx.fill();
}

function strokeBetween(from, to, firstPoint) {
  const { r, g, b } = getColor();
  const size = state.brushSize;
  const spacing = Math.max(1, size * 0.25);
  const dx = to.x - from.x, dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.ceil(dist / spacing));
  const start = firstPoint ? 0 : 1;

  for (let i = start; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const x = from.x + dx * t;
    const y = from.y + dy * t;
    if (state.tool === 'brush') {
      stampBrush(strokeCtx, x, y, size, r, g, b);
    } else if (state.tool === 'eraser') {
      stampEraser(x, y, size);
    }
  }
}

// ---- Stroke lifecycle ----
function saveUndoState() {
  const imgData = baseCtx.getImageData(0, 0, state.cw, state.ch);
  state.undoStack.push(imgData);
  if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
  state.redoStack = [];
  updateUndoUI();
}

function startStroke(canvasPos) {
  saveUndoState();
  state.isDrawing = true;
  state.lastDrawPoint = canvasPos;

  if (state.tool === 'brush') {
    strokeCtx.clearRect(0, 0, state.cw, state.ch);
    const { r, g, b } = getColor();
    stampBrush(strokeCtx, canvasPos.x, canvasPos.y, state.brushSize, r, g, b);
  } else if (state.tool === 'eraser') {
    stampEraser(canvasPos.x, canvasPos.y, state.brushSize);
  }
  render();
}

function continueStroke(canvasPos) {
  if (!state.isDrawing || !state.lastDrawPoint) return;
  strokeBetween(state.lastDrawPoint, canvasPos, false);
  state.lastDrawPoint = canvasPos;
  render();
}

function endStroke() {
  if (!state.isDrawing) return;

  if (state.tool === 'brush') {
    baseCtx.globalAlpha = state.opacity / 100;
    baseCtx.drawImage(strokeCanvas, 0, 0);
    baseCtx.globalAlpha = 1;
    strokeCtx.clearRect(0, 0, state.cw, state.ch);
  }

  state.isDrawing = false;
  state.lastDrawPoint = null;

  addRecentColor();
  render();
  scheduleSave();
}

function cancelStroke() {
  if (!state.isDrawing) return;
  // Rollback the undo state we pushed at stroke start
  if (state.undoStack.length > 0) {
    const imgData = state.undoStack.pop();
    baseCtx.putImageData(imgData, 0, 0);
    state.redoStack = [];
    updateUndoUI();
  }
  strokeCtx.clearRect(0, 0, state.cw, state.ch);
  state.isDrawing = false;
  state.lastDrawPoint = null;
  render();
}

// ---- Undo / Redo ----
function undo() {
  if (state.undoStack.length === 0) return;
  state.redoStack.push(baseCtx.getImageData(0, 0, state.cw, state.ch));
  baseCtx.putImageData(state.undoStack.pop(), 0, 0);
  render();
  updateUndoUI();
  scheduleSave();
}

function redo() {
  if (state.redoStack.length === 0) return;
  state.undoStack.push(baseCtx.getImageData(0, 0, state.cw, state.ch));
  baseCtx.putImageData(state.redoStack.pop(), 0, 0);
  render();
  updateUndoUI();
  scheduleSave();
}

function updateUndoUI() {
  document.getElementById('btn-undo').disabled = state.undoStack.length === 0;
  document.getElementById('btn-redo').disabled = state.redoStack.length === 0;
}

// ---- Eyedropper ----
function pickColor(cx, cy) {
  const px = baseCtx.getImageData(
    Math.max(0, Math.min(state.cw - 1, Math.round(cx))),
    Math.max(0, Math.min(state.ch - 1, Math.round(cy))),
    1, 1
  ).data;
  const [h, s, b] = rgbToHsb(px[0], px[1], px[2]);
  state.hue = h;
  state.sat = s;
  state.bri = b;
  updateColorUI();
  setTool(state.prevTool);
}

// ---- Cursor ----
function drawCursor(rawSx, rawSy) {
  const vw = cursorCanvas.width, vh = cursorCanvas.height;
  cursorCtx.clearRect(0, 0, vw, vh);

  if (state.isPinching) return;

  const os = getOffsetScreen(rawSx, rawSy);
  const radiusPx = Math.max(4, (state.brushSize / 2) * state.scale);

  cursorCtx.save();

  // Brush circle
  cursorCtx.strokeStyle = 'rgba(255,255,255,0.85)';
  cursorCtx.lineWidth = 1.5;
  cursorCtx.setLineDash([4, 3]);
  cursorCtx.beginPath();
  cursorCtx.arc(os.x, os.y, radiusPx, 0, Math.PI * 2);
  cursorCtx.stroke();

  // Center dot
  cursorCtx.setLineDash([]);
  cursorCtx.fillStyle = 'rgba(255,255,255,0.9)';
  cursorCtx.beginPath();
  cursorCtx.arc(os.x, os.y, 2, 0, Math.PI * 2);
  cursorCtx.fill();

  // Offset line from raw touch to draw point
  if (state.offsetEnabled && (os.x !== rawSx || os.y !== rawSy)) {
    cursorCtx.strokeStyle = 'rgba(255,255,255,0.25)';
    cursorCtx.lineWidth = 1;
    cursorCtx.setLineDash([3, 5]);
    cursorCtx.beginPath();
    cursorCtx.moveTo(rawSx, rawSy);
    cursorCtx.lineTo(os.x, os.y);
    cursorCtx.stroke();

    // Touch indicator
    cursorCtx.setLineDash([]);
    cursorCtx.strokeStyle = 'rgba(255,255,255,0.3)';
    cursorCtx.lineWidth = 1;
    cursorCtx.beginPath();
    cursorCtx.arc(rawSx, rawSy, 5, 0, Math.PI * 2);
    cursorCtx.stroke();
  }

  cursorCtx.restore();
}

function clearCursor() {
  cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
}

// ---- Pointer events ----
function setupPointerEvents() {
  const wrap = document.getElementById('canvas-wrap');

  wrap.addEventListener('pointerdown', e => {
    e.preventDefault();
    state.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (state.activePointers.size >= 2) {
      if (state.isDrawing) cancelStroke();
      if (!state.isPinching) startPinch();
      return;
    }

    state.drawingPointerId = e.pointerId;

    if (state.tool === 'eyedropper') {
      const cp = getDrawPos(e.clientX, e.clientY);
      pickColor(cp.x, cp.y);
      clearCursor();
      return;
    }

    const cp = getDrawPos(e.clientX, e.clientY);
    startStroke(cp);
    drawCursor(e.clientX, e.clientY);
  }, { passive: false });

  wrap.addEventListener('pointermove', e => {
    e.preventDefault();
    if (!state.activePointers.has(e.pointerId)) return;
    state.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (state.activePointers.size >= 2 && state.isPinching) {
      updatePinch();
      return;
    }

    if (e.pointerId !== state.drawingPointerId) return;

    if (state.isDrawing) {
      const cp = getDrawPos(e.clientX, e.clientY);
      continueStroke(cp);
    }
    drawCursor(e.clientX, e.clientY);
  }, { passive: false });

  const onUp = e => {
    e.preventDefault();

    if (e.pointerId === state.drawingPointerId && state.isDrawing) {
      const cp = getDrawPos(e.clientX, e.clientY);
      continueStroke(cp);
      endStroke();
      clearCursor();
    }

    state.activePointers.delete(e.pointerId);

    if (state.activePointers.size < 2) {
      state.isPinching = false;
    }
    if (state.activePointers.size === 0) {
      state.drawingPointerId = null;
    }
  };

  wrap.addEventListener('pointerup',     onUp, { passive: false });
  wrap.addEventListener('pointercancel', onUp, { passive: false });
}

// ---- Pinch zoom / pan ----
function startPinch() {
  state.isPinching = true;
  const pts = [...state.activePointers.values()];
  const [p0, p1] = pts;
  state.pinchStartDist   = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  state.pinchStartMidX   = (p0.x + p1.x) / 2;
  state.pinchStartMidY   = (p0.y + p1.y) / 2;
  state.pinchStartScale  = state.scale;
  state.pinchStartTx     = state.tx;
  state.pinchStartTy     = state.ty;
}

function updatePinch() {
  const pts = [...state.activePointers.values()];
  if (pts.length < 2) return;
  const [p0, p1] = pts;

  const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const midX = (p0.x + p1.x) / 2;
  const midY = (p0.y + p1.y) / 2;

  const newScale = Math.max(0.08, Math.min(12,
    state.pinchStartScale * dist / state.pinchStartDist
  ));

  // Keep canvas point under initial pinch midpoint anchored to current midpoint
  const canvasAnchorX = (state.pinchStartMidX - state.pinchStartTx) / state.pinchStartScale;
  const canvasAnchorY = (state.pinchStartMidY - state.pinchStartTy) / state.pinchStartScale;

  state.scale = newScale;
  state.tx = midX - canvasAnchorX * newScale;
  state.ty = midY - canvasAnchorY * newScale;

  applyViewportTransform();
}

// ---- Color picker ----
function initColorPicker() {
  drawHueSlider();
  drawSBCanvas();

  // SB canvas
  sbCanvas.addEventListener('pointerdown',  onSBInteract, { passive: false });
  sbCanvas.addEventListener('pointermove',  e => { if (e.buttons) onSBInteract(e); }, { passive: false });

  // Hue canvas
  hueCanvas.addEventListener('pointerdown', onHueInteract, { passive: false });
  hueCanvas.addEventListener('pointermove', e => { if (e.buttons) onHueInteract(e); }, { passive: false });
}

function drawHueSlider() {
  const w = hueCanvas.width, h = hueCanvas.height;
  const grad = hueCtx.createLinearGradient(0, 0, w, 0);
  for (let i = 0; i <= 12; i++) {
    const [r, g, b] = hsbToRgb(i * 30, 100, 100);
    grad.addColorStop(i / 12, `rgb(${r},${g},${b})`);
  }
  hueCtx.fillStyle = grad;
  hueCtx.fillRect(0, 0, w, h);

  // Indicator
  const ix = (state.hue / 360) * w;
  hueCtx.strokeStyle = 'rgba(255,255,255,0.9)';
  hueCtx.lineWidth = 2;
  hueCtx.strokeRect(ix - 2, 1, 4, h - 2);
}

function drawSBCanvas() {
  const w = sbCanvas.width, h = sbCanvas.height;
  const [r, g, b] = hsbToRgb(state.hue, 100, 100);

  // Saturation: white → hue color
  const hGrad = sbCtx.createLinearGradient(0, 0, w, 0);
  hGrad.addColorStop(0, '#fff');
  hGrad.addColorStop(1, `rgb(${r},${g},${b})`);
  sbCtx.fillStyle = hGrad;
  sbCtx.fillRect(0, 0, w, h);

  // Brightness: transparent → black
  const vGrad = sbCtx.createLinearGradient(0, 0, 0, h);
  vGrad.addColorStop(0, 'rgba(0,0,0,0)');
  vGrad.addColorStop(1, 'rgba(0,0,0,1)');
  sbCtx.fillStyle = vGrad;
  sbCtx.fillRect(0, 0, w, h);

  // Indicator circle
  const ix = (state.sat / 100) * w;
  const iy = (1 - state.bri / 100) * h;
  sbCtx.strokeStyle = 'rgba(255,255,255,0.9)';
  sbCtx.lineWidth = 2;
  sbCtx.beginPath();
  sbCtx.arc(ix, iy, 7, 0, Math.PI * 2);
  sbCtx.stroke();
  sbCtx.strokeStyle = 'rgba(0,0,0,0.4)';
  sbCtx.lineWidth = 1;
  sbCtx.beginPath();
  sbCtx.arc(ix, iy, 7, 0, Math.PI * 2);
  sbCtx.stroke();
}

function onHueInteract(e) {
  e.preventDefault();
  e.stopPropagation();
  const rect = hueCanvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  state.hue = x * 360;
  drawHueSlider();
  drawSBCanvas();
  updateColorUI();
}

function onSBInteract(e) {
  e.preventDefault();
  e.stopPropagation();
  const rect = sbCanvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
  state.sat = x * 100;
  state.bri = (1 - y) * 100;
  drawSBCanvas();
  updateColorUI();
}

function updateColorUI() {
  const { hex } = getColor();
  document.getElementById('color-swatch').style.background = hex;
  document.getElementById('color-preview').style.background = hex;

  // Update settings hand buttons
  document.querySelectorAll('#settings-hand-group [data-hand]').forEach(b => {
    b.classList.toggle('active', b.dataset.hand === state.handedness);
  });
}

// ---- Recent colors ----
function addRecentColor() {
  const hex = getColor().hex;
  const idx = state.recentColors.indexOf(hex);
  if (idx >= 0) state.recentColors.splice(idx, 1);
  state.recentColors.unshift(hex);
  if (state.recentColors.length > MAX_RECENT) state.recentColors.pop();
  renderRecentColors();
}

function renderRecentColors() {
  const container = document.getElementById('recent-colors');
  container.innerHTML = '';
  state.recentColors.forEach(hex => {
    const btn = document.createElement('button');
    btn.className = 'recent-color-btn';
    btn.style.background = hex;
    btn.addEventListener('pointerdown', e => {
      e.stopPropagation();
      const [r, g, b] = hexToRgb(hex);
      [state.hue, state.sat, state.bri] = rgbToHsb(r, g, b);
      drawHueSlider();
      drawSBCanvas();
      updateColorUI();
    });
    container.appendChild(btn);
  });
}

// ---- IndexedDB ----
function openDB() {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE);
        }
      };
      req.onsuccess = e => { state.db = e.target.result; resolve(); };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

let _saveTimer = null;
function scheduleSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveNow, 1500);
}

function saveNow() {
  if (!state.db) return;
  const data = {
    cw: state.cw,
    ch: state.ch,
    imageData: baseCanvas.toDataURL('image/png'),
    timestamp: Date.now(),
    recentColors: state.recentColors,
    hue: state.hue,
    sat: state.sat,
    bri: state.bri,
    handedness: state.handedness,
    offsetEnabled: state.offsetEnabled,
    offsetAmount: state.offsetAmount,
  };
  const tx = state.db.transaction(DB_STORE, 'readwrite');
  tx.objectStore(DB_STORE).put(data, DB_KEY);
}

function loadSaved() {
  return new Promise(resolve => {
    if (!state.db) { resolve(null); return; }
    const tx = state.db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(DB_KEY);
    req.onsuccess = e => resolve(e.target.result || null);
    req.onerror = () => resolve(null);
  });
}

function restoreFromSaved(data) {
  return new Promise(resolve => {
    const w = data.cw || 1080;
    const h = data.ch || 1350;
    initCanvases(w, h);

    if (data.recentColors) state.recentColors = data.recentColors;
    if (data.hue      !== undefined) state.hue      = data.hue;
    if (data.sat      !== undefined) state.sat      = data.sat;
    if (data.bri      !== undefined) state.bri      = data.bri;
    if (data.handedness)             state.handedness = data.handedness;
    if (data.offsetEnabled !== undefined) state.offsetEnabled = data.offsetEnabled;
    if (data.offsetAmount)           state.offsetAmount = data.offsetAmount;

    const img = new Image();
    img.onload = () => {
      baseCtx.clearRect(0, 0, w, h);
      baseCtx.drawImage(img, 0, 0);
      render();
      resolve();
    };
    img.onerror = () => resolve();
    img.src = data.imageData;
  });
}

// ---- Export ----
function exportPNG() {
  const ec = document.createElement('canvas');
  ec.width = state.cw;
  ec.height = state.ch;
  const ectx = ec.getContext('2d');
  ectx.fillStyle = '#ffffff';
  ectx.fillRect(0, 0, ec.width, ec.height);
  ectx.drawImage(baseCanvas, 0, 0);

  ec.toBlob(blob => {
    const file = new File([blob], 'nuri.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'DESU™ NURI' }).catch(() => {});
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nuri.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
}

// ---- Tool management ----
function setTool(tool) {
  if (tool !== 'eyedropper') state.prevTool = state.tool;
  state.tool = tool;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
}

// ---- Layout (handedness) ----
function updateLayout() {
  const hand = state.handedness;
  document.getElementById('toolbar').className   = hand === 'right' ? 'right-hand' : 'left-hand';
  document.getElementById('sliders').className   = hand === 'right' ? 'right-hand' : 'left-hand';
  const cp = document.getElementById('color-panel');
  cp.classList.toggle('right-hand', hand === 'right');
  cp.classList.toggle('left-hand',  hand === 'left');

  // Zoom reset: opposite side from toolbar
  const zr = document.getElementById('btn-zoom-reset');
  if (hand === 'right') {
    zr.style.right = '';
    zr.style.left = '16px';
  } else {
    zr.style.left = '';
    zr.style.right = '16px';
  }

  // Update settings UI
  document.querySelectorAll('#settings-hand-group [data-hand]').forEach(b => {
    b.classList.toggle('active', b.dataset.hand === hand);
  });
}

// ---- Settings persistence ----
function saveSettings() {
  localStorage.setItem('nuri-settings', JSON.stringify({
    handedness:    state.handedness,
    offsetEnabled: state.offsetEnabled,
    offsetAmount:  state.offsetAmount,
    brushSize:     state.brushSize,
    opacity:       state.opacity,
    hue: state.hue, sat: state.sat, bri: state.bri,
  }));
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('nuri-settings') || 'null');
    if (!s) return;
    if (s.handedness)             state.handedness    = s.handedness;
    if (s.offsetEnabled !== undefined) state.offsetEnabled = s.offsetEnabled;
    if (s.offsetAmount)           state.offsetAmount  = s.offsetAmount;
    if (s.brushSize)              state.brushSize     = s.brushSize;
    if (s.opacity)                state.opacity       = s.opacity;
    if (s.hue !== undefined)      state.hue = s.hue;
    if (s.sat !== undefined)      state.sat = s.sat;
    if (s.bri !== undefined)      state.bri = s.bri;
  } catch { /* ignore */ }
}

// ---- Sync slider UI with state ----
function syncSliderUI() {
  const ss = document.getElementById('size-slider');
  const os = document.getElementById('opacity-slider');
  ss.value = state.brushSize;
  os.value = state.opacity;
  document.getElementById('size-value').textContent    = state.brushSize;
  document.getElementById('opacity-value').textContent = state.opacity + '%';
  document.getElementById('offset-slider').value = state.offsetAmount;
  document.getElementById('offset-value').textContent   = state.offsetAmount;
  document.getElementById('offset-toggle').textContent  = state.offsetEnabled ? 'ON' : 'OFF';
  document.getElementById('offset-toggle').classList.toggle('active', state.offsetEnabled);
}

// ---- UI bindings ----
function bindUI() {
  // Tool buttons
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  // Color button → toggle panel
  document.getElementById('btn-color').addEventListener('click', () => {
    document.getElementById('color-panel').classList.toggle('hidden');
  });

  // Dismiss color panel on outside tap
  document.addEventListener('pointerdown', e => {
    const panel = document.getElementById('color-panel');
    const colorBtn = document.getElementById('btn-color');
    if (!panel.classList.contains('hidden')
        && !panel.contains(e.target)
        && !colorBtn.contains(e.target)) {
      panel.classList.add('hidden');
    }
  }, true);

  // Undo / Redo
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);

  // Menu → settings
  document.getElementById('btn-menu').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.remove('hidden');
  });

  document.getElementById('btn-close-settings').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.add('hidden');
  });

  // Size slider
  document.getElementById('size-slider').addEventListener('input', function() {
    state.brushSize = +this.value;
    document.getElementById('size-value').textContent = this.value;
    saveSettings();
  });

  // Opacity slider
  document.getElementById('opacity-slider').addEventListener('input', function() {
    state.opacity = +this.value;
    document.getElementById('opacity-value').textContent = this.value + '%';
    saveSettings();
  });

  // Settings: handedness
  document.querySelectorAll('#settings-hand-group [data-hand]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.handedness = btn.dataset.hand;
      updateLayout();
      saveSettings();
    });
  });

  // Settings: offset toggle
  document.getElementById('offset-toggle').addEventListener('click', function() {
    state.offsetEnabled = !state.offsetEnabled;
    this.textContent = state.offsetEnabled ? 'ON' : 'OFF';
    this.classList.toggle('active', state.offsetEnabled);
    saveSettings();
  });

  // Settings: offset amount
  document.getElementById('offset-slider').addEventListener('input', function() {
    state.offsetAmount = +this.value;
    document.getElementById('offset-value').textContent = this.value;
    saveSettings();
  });

  // Export
  document.getElementById('btn-export').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.add('hidden');
    exportPNG();
  });

  // New canvas (from settings)
  document.getElementById('btn-new-canvas').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.add('hidden');
    showNewDialog();
  });

  // Zoom reset
  document.getElementById('btn-zoom-reset').addEventListener('click', fitToViewport);

  // Resize
  window.addEventListener('resize', () => {
    cursorCanvas.width  = window.innerWidth;
    cursorCanvas.height = window.innerHeight;
  });
}

// ---- Welcome / new dialog ----
function showNewDialog() {
  document.getElementById('welcome-resume').classList.add('hidden');
  document.getElementById('welcome-new').classList.remove('hidden');
  document.getElementById('welcome-dialog').classList.remove('hidden');
}

function bindWelcomeUI(onStart) {
  // Resume button
  document.getElementById('btn-resume').addEventListener('click', () => {
    document.getElementById('welcome-dialog').classList.add('hidden');
    onStart();
  }, { once: true });

  // "New canvas" from resume screen
  document.getElementById('btn-welcome-new').addEventListener('click', () => {
    document.getElementById('welcome-resume').classList.add('hidden');
    document.getElementById('welcome-new').classList.remove('hidden');
    // Reset canvas state for fresh start
    state.undoStack = [];
    state.redoStack = [];
    state.recentColors = [];
  });

  // Handedness selection
  document.querySelectorAll('#hand-group [data-hand]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#hand-group [data-hand]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.handedness = btn.dataset.hand;
    });
  });

  // Size selection
  document.querySelectorAll('#size-group [data-size]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#size-group [data-size]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Start button
  document.getElementById('btn-start').addEventListener('click', () => {
    const sizeBtn = document.querySelector('#size-group [data-size].active');
    const sizeKey = sizeBtn?.dataset.size || '4:5';
    const { w, h } = CANVAS_SIZES[sizeKey];

    document.getElementById('welcome-dialog').classList.add('hidden');

    initCanvases(w, h);
    onStart();
    saveSettings();
    scheduleSave();
  });
}

// ---- Init ----
async function init() {
  // Grab DOM refs
  displayCanvas = document.getElementById('drawing-canvas');
  displayCtx    = displayCanvas.getContext('2d');
  baseCanvas    = document.createElement('canvas');
  baseCtx       = baseCanvas.getContext('2d');
  strokeCanvas  = document.createElement('canvas');
  strokeCtx     = strokeCanvas.getContext('2d');
  cursorCanvas  = document.getElementById('cursor-canvas');
  cursorCtx     = cursorCanvas.getContext('2d');
  cursorCanvas.width  = window.innerWidth;
  cursorCanvas.height = window.innerHeight;
  sbCanvas  = document.getElementById('sb-canvas');
  sbCtx     = sbCanvas.getContext('2d');
  hueCanvas = document.getElementById('hue-canvas');
  hueCtx    = hueCanvas.getContext('2d');

  loadSettings();
  await openDB();

  const saved = await loadSaved();

  function startApp() {
    updateLayout();
    updateColorUI();
    initColorPicker();
    renderRecentColors();
    syncSliderUI();
    setupPointerEvents();
    bindUI();
    updateUndoUI();
  }

  bindWelcomeUI(startApp);

  if (saved) {
    // Restore saved artwork, then show resume prompt
    await restoreFromSaved(saved);
    document.getElementById('welcome-resume').classList.remove('hidden');
    document.getElementById('welcome-new').classList.add('hidden');
    document.getElementById('welcome-dialog').classList.remove('hidden');
    // btn-resume handler is already bound above in bindWelcomeUI
  } else {
    // Fresh: show new canvas dialog
    document.getElementById('welcome-resume').classList.add('hidden');
    document.getElementById('welcome-new').classList.remove('hidden');
    document.getElementById('welcome-dialog').classList.remove('hidden');
    // btn-start handler is already bound above in bindWelcomeUI
  }
}

document.addEventListener('DOMContentLoaded', init);
