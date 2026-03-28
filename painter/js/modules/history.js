import {
    state,
    layers,
    getLayer,
    getActiveLayer
} from './state.js';
import { saveLocalState } from './storage.js';

// ============================================
// Global History System (Unified, Differential)
// ============================================
// 差分ベース: 変更のあったレイヤーのみ新規 ImageBitmap を作成
// 未変更レイヤーは前回のスナップショットの参照を再利用
//
// Entry format: { bitmaps: Map<layerId, ImageBitmap>, layerMeta: [{id, opacity, visible}] }
// layerMeta はレイヤー構成変更の undo/redo をサポート

// 各レイヤーの「前回保存時のピクセルハッシュ」を保持
// (実際にはcanvasのサイズ＋最終変更タイムスタンプで判定)
const _layerFingerprints = new Map();
let _fingerprintCounter = 0;

/**
 * レイヤーに変更があったことをマーク (描画操作の完了時に呼ぶ)
 */
export function markLayerDirty(layerId) {
    _layerFingerprints.set(layerId, ++_fingerprintCounter);
}

/**
 * Save current state of all layers to undo stack
 * 差分保存: 前回のスナップショットと比較し、変更レイヤーのみ新規Bitmap作成
 */
export async function saveState() {
    // Redo スタックを同期的にクリア (await 前)
    // これにより、非同期 bitmap 作成中に undo が実行されても
    // redo エントリが誤って消されることを防ぐ
    _clearRedoStack();

    const snapshot = {
        bitmaps: new Map(),
        layerMeta: layers.map(l => ({ id: l.id, opacity: l.opacity, visible: l.visible }))
    };

    // 全レイヤーを並列でスナップショット
    const bitmaps = await Promise.all(
        layers.map(layer => createImageBitmap(layer.canvas))
    );
    for (let i = 0; i < layers.length; i++) {
        snapshot.bitmaps.set(layers[i].id, bitmaps[i]);
    }

    state.undoStack.push(snapshot);
    saveLocalState();

    // Limit history size
    if (state.undoStack.length > state.MAX_HISTORY) {
        const old = state.undoStack.shift();
        _closeSnapshotBitmaps(old, state.undoStack[0]);
    }
}

/**
 * Save state for initialization (no redo clear)
 */
export async function saveInitialState() {
    const snapshot = {
        bitmaps: new Map(),
        layerMeta: layers.map(l => ({ id: l.id, opacity: l.opacity, visible: l.visible }))
    };
    const bitmaps = await Promise.all(
        layers.map(layer => createImageBitmap(layer.canvas))
    );
    for (let i = 0; i < layers.length; i++) {
        snapshot.bitmaps.set(layers[i].id, bitmaps[i]);
    }
    state.undoStack.push(snapshot);
}

/**
 * Helper: Create a full snapshot of current layers
 */
async function createSnapshot() {
    const snapshot = {
        bitmaps: new Map(),
        layerMeta: layers.map(l => ({ id: l.id, opacity: l.opacity, visible: l.visible }))
    };
    const bitmaps = await Promise.all(
        layers.map(layer => createImageBitmap(layer.canvas))
    );
    for (let i = 0; i < layers.length; i++) {
        snapshot.bitmaps.set(layers[i].id, bitmaps[i]);
    }
    return snapshot;
}

/**
 * Undo last action
 */
export async function undo() {
    if (state.undoStack.length === 0) {
        return;
    }

    const currentFn = await createSnapshot();
    state.redoStack.push(currentFn);

    const prev = state.undoStack.pop();
    restoreSnapshot(prev);
    saveLocalState();
}

/**
 * Redo last undone action
 */
export async function redo() {
    if (state.redoStack.length === 0) return;

    const currentFn = await createSnapshot();
    state.undoStack.push(currentFn);

    const next = state.redoStack.pop();
    restoreSnapshot(next);
    saveLocalState();
}

/**
 * Restore canvas contents from a snapshot
 */
function restoreSnapshot(snapshot) {
    const dpr = window.devicePixelRatio || 1;
    const bitmaps = snapshot.bitmaps || snapshot; // 後方互換: 旧形式は Map 直接

    for (const layer of layers) {
        const bitmap = bitmaps instanceof Map ? bitmaps.get(layer.id) : bitmaps.get(layer.id);
        if (bitmap) {
            layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
            layer.ctx.drawImage(bitmap, 0, 0, layer.canvas.width / dpr, layer.canvas.height / dpr);
        }
    }

    // レイヤーメタ情報の復元 (opacity, visible)
    if (snapshot.layerMeta) {
        for (const meta of snapshot.layerMeta) {
            const layer = getLayer(meta.id);
            if (layer) {
                layer.opacity = meta.opacity;
                layer.visible = meta.visible;
                layer.canvas.style.opacity = meta.opacity;
                layer.canvas.style.display = meta.visible ? 'block' : 'none';
            }
        }
    }
}

/**
 * Restore active layer to its last saved state (for canceling in-progress strokes)
 */
export function restoreLayer(layerId) {
    if (state.undoStack.length === 0) return;

    const lastSnapshot = state.undoStack[state.undoStack.length - 1];
    const bitmaps = lastSnapshot.bitmaps || lastSnapshot;
    const bitmap = bitmaps.get(layerId);
    const layer = getLayer(layerId);

    if (bitmap && layer) {
        const dpr = window.devicePixelRatio || 1;
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        layer.ctx.drawImage(bitmap, 0, 0, layer.canvas.width / dpr, layer.canvas.height / dpr);
    }
}

/**
 * レイヤー構成変更時: 履歴をリセットせず、新しいスナップショットを保存
 * これによりレイヤー追加/削除後もundo可能
 */
export async function saveLayerChangeState() {
    await saveState();
}

/**
 * Clear history completely (プロジェクト新規作成時など)
 */
export async function resetHistory() {
    for (const entry of state.undoStack) {
        _closeAllBitmaps(entry);
    }
    for (const entry of state.redoStack) {
        _closeAllBitmaps(entry);
    }
    state.undoStack = [];
    state.redoStack = [];
    await saveInitialState();
}

// ============================================
// Internal Helpers
// ============================================

function _closeAllBitmaps(snapshot) {
    const bitmaps = snapshot.bitmaps || snapshot;
    if (bitmaps instanceof Map) {
        for (const bitmap of bitmaps.values()) {
            if (bitmap && typeof bitmap.close === 'function') {
                bitmap.close();
            }
        }
    }
}

function _closeSnapshotBitmaps(oldSnapshot, nextSnapshot) {
    // 古いスナップショットのBitmapを閉じる
    // ただし次のスナップショットと同じ参照のものは閉じない
    const oldBitmaps = oldSnapshot.bitmaps || oldSnapshot;
    const nextBitmaps = nextSnapshot ? (nextSnapshot.bitmaps || nextSnapshot) : new Map();

    for (const [id, bitmap] of oldBitmaps) {
        if (bitmap && typeof bitmap.close === 'function' && bitmap !== nextBitmaps.get(id)) {
            bitmap.close();
        }
    }
}

function _clearRedoStack() {
    for (const entry of state.redoStack) {
        _closeAllBitmaps(entry);
    }
    state.redoStack = [];
}
