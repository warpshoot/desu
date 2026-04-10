import { state, lassoCanvas, lassoCtx } from '../state.js';
import { getCanvasPoint } from '../utils.js';

// ============================================
// 投げ縄ツール（Interaction Logic）
// ============================================

// 手ぶれ補正: 投げ縄描画中のアンカー位置
let _lassoAnchorX = 0;
let _lassoAnchorY = 0;

/**
 * 現在のモード設定から手ぶれ補正設定を取得
 */
function _getLassoStab() {
    const slot = state.mode === 'eraser' ? state.activeEraserSlot : state.activeFillSlot;
    return {
        enabled:  slot.stabilizerEnabled  ?? false,
        distance: slot.stabilizerDistance ?? 20,
    };
}

/**
 * 手ぶれ補正の「糸」をlassoCanvas上に描画
 */
function _drawLassoStabString(cursorX, cursorY, anchorX, anchorY) {
    if (!lassoCtx) return;
    lassoCtx.save();
    lassoCtx.lineWidth = 3;
    lassoCtx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    lassoCtx.beginPath();
    lassoCtx.moveTo(cursorX, cursorY);
    lassoCtx.lineTo(anchorX, anchorY);
    lassoCtx.stroke();

    lassoCtx.lineWidth = 1.5;
    lassoCtx.strokeStyle = 'rgba(60, 130, 255, 0.85)';
    lassoCtx.beginPath();
    lassoCtx.moveTo(cursorX, cursorY);
    lassoCtx.lineTo(anchorX, anchorY);
    lassoCtx.stroke();

    // アンカー円
    lassoCtx.beginPath();
    lassoCtx.arc(anchorX, anchorY, 4, 0, Math.PI * 2);
    lassoCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    lassoCtx.fill();
    lassoCtx.lineWidth = 1.5;
    lassoCtx.strokeStyle = 'rgba(60, 130, 255, 0.9)';
    lassoCtx.stroke();

    // カーソル小円
    lassoCtx.beginPath();
    lassoCtx.arc(cursorX, cursorY, 2.5, 0, Math.PI * 2);
    lassoCtx.fillStyle = 'rgba(60, 130, 255, 0.7)';
    lassoCtx.fill();

    lassoCtx.restore();
}

/**
 * なげ縄描画開始
 */
export function startLasso(x, y) {
    state.isLassoing = true;
    state.lassoPoints = [{ x, y }];
    _lassoAnchorX = x;
    _lassoAnchorY = y;
    if (lassoCanvas) {
        lassoCanvas.style.display = 'block';
        lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
    }
}

/**
 * なげ縄描画更新
 */
export function updateLasso(rawX, rawY) {
    if (!state.isLassoing || !lassoCtx) return;

    const stab = _getLassoStab();
    let x = rawX, y = rawY;

    if (stab.enabled) {
        const dx = rawX - _lassoAnchorX;
        const dy = rawY - _lassoAnchorY;
        const d = Math.hypot(dx, dy);
        if (d <= stab.distance) {
            lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
            _drawLassoPath(state.lassoPoints);
            _drawLassoStabString(rawX, rawY, _lassoAnchorX, _lassoAnchorY);
            return;
        }
        const ratio = (d - stab.distance) / d;
        _lassoAnchorX += dx * ratio;
        _lassoAnchorY += dy * ratio;
        x = _lassoAnchorX;
        y = _lassoAnchorY;
    }

    state.lassoPoints.push({ x, y });

    lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
    _drawLassoPath(state.lassoPoints);

    if (stab.enabled) {
        _drawLassoStabString(rawX, rawY, _lassoAnchorX, _lassoAnchorY);
    }
}

/**
 * パスを青い線で描画
 */
function _drawLassoPath(points) {
    if (points.length < 1) return;
    lassoCtx.strokeStyle = '#0066ff';
    lassoCtx.lineWidth = 2;
    lassoCtx.beginPath();
    lassoCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        lassoCtx.lineTo(points[i].x, points[i].y);
    }
    // 始点に戻る線（プレビュー）
    lassoCtx.lineTo(points[0].x, points[0].y);
    lassoCtx.stroke();
}

/**
 * なげ縄描画終了：キャンバス座標の点列を返す
 */
export function finishLasso() {
    if (!state.isLassoing || state.lassoPoints.length < 3) {
        state.isLassoing = false;
        state.lassoPoints = [];
        if (lassoCanvas) lassoCanvas.style.display = 'none';
        return null;
    }

    const canvasPoints = state.lassoPoints.map(p => getCanvasPoint(p.x, p.y));

    state.isLassoing = false;
    state.lassoPoints = [];
    if (lassoCanvas) {
        lassoCanvas.style.display = 'none';
        lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
    }

    return canvasPoints;
}
