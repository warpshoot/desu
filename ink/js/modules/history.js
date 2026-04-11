import {
    state,
    layers,
    getLayer,
    getActiveLayer,
    CANVAS_DPR,
    createLayerDirect,
    updateLayerZIndices,
    syncLayerIdCounter
} from './state.js';
import { saveLocalState } from './storage.js';
import { applyTransform } from './canvas.js';

// ============================================
// Global History System (Unified, Differential)
// ============================================
// 差分ベース: 変更のあったレイヤーのみ新規 ImageBitmap を作成
// 未変更レイヤーは前回のスナップショットの参照を再利用
//
// Entry format: { bitmaps: Map<layerId, ImageBitmap>, layerMeta: [{id, opacity, visible}], layerIds: number[] }
// layerMeta はレイヤー構成変更の undo/redo をサポート

const _layerFingerprints = new Map();
let _fingerprintCounter = 0;
let _lastSavedLayerIds = ""; // 構造変化検知用

// 直近でキューに投げられた（保存予定の）指紋
const _lastDispatchedFingerprints = new Map();

// 履歴操作の直列実行キュー (Promise Queue)
let _historyQueue = Promise.resolve();

function _enqueue(task) {
    const p = _historyQueue.then(() => task()).catch(err => {
        console.error('[History Queue Error]', err);
    });
    _historyQueue = p;
    return p;
}

// ============================================
// Bitmap Reference Counting (Crash Prevention)
// ============================================
// 差分保存により ImageBitmap が複数の履歴エントリで共有されるため、
// 単純に close() すると別エントリで参照した際にクラッシュする。
// 参照カウントを導入し、どこからも使われなくなった時のみ close() する。

const _bitmapRegistry = new Map(); // ImageBitmap -> count

/** 参照カウントをインクリメント */
function _incRef(bitmap) {
    if (!bitmap) return;
    const count = _bitmapRegistry.get(bitmap) || 0;
    _bitmapRegistry.set(bitmap, count + 1);
}

/** 参照カウントをデクリメント、0になったら close */
function _decRef(bitmap) {
    if (!bitmap || typeof bitmap.close !== 'function') return;
    const count = (_bitmapRegistry.get(bitmap) || 0) - 1;
    if (count <= 0) {
        _bitmapRegistry.delete(bitmap);
        bitmap.close();
    } else {
        _bitmapRegistry.set(bitmap, count);
    }
}

/**
 * レイヤーに変更があったことをマーク (描画操作の完了時に呼ぶ)
 */
export function markLayerDirty(layerId) {
    _layerFingerprints.set(layerId, ++_fingerprintCounter);
}
window.markLayerDirty = markLayerDirty;

/**
 * レイヤーを最後の保存済み状態と「差分なし」に同期する
 * cancelCurrentOperation でピクセルを restoreLayer した後に呼び、
 * 次の saveState で不要なスナップショットが積まれないようにする
 */
export function syncLayerFingerprint(layerId) {
    const fp = _lastDispatchedFingerprints.get(layerId);
    if (fp !== undefined) {
        _layerFingerprints.set(layerId, fp);
    }
}

export async function saveState({ keepRedo = false, rect = null } = {}) {
    // 1. 変更があるレイヤーを同期的に特定 (指紋チェック)
    //    createImageBitmap の呼び出し自体は RAF まで遅延する:
    //    - pen mode では RAF 発火時も layer.canvas が "ストローク前" 状態を保っている
    //      (ストロークは strokeCanvas に描かれ、endPenDrawing まで layer には触れない)
    //    - RAF は前フレームの GPU 書き込みが確実に完了した後に発火するため、
    //      GPU パイプライン同期のブロッキングが発生しない
    const snapshotFingerprints = new Map(_layerFingerprints);
    const layersToCaptureIds = new Set();
    const currentLayerIdString = layers.map(l => l.id).join(',');
    const structureChanged = currentLayerIdString !== _lastSavedLayerIds;

    for (const layer of layers) {
        const currentFp = snapshotFingerprints.get(layer.id) || 0;
        const lastSavedFp = _lastDispatchedFingerprints.get(layer.id) || 0;

        if (currentFp !== lastSavedFp) {
            layersToCaptureIds.add(layer.id);
        }
    }

    // 変更も構造変化もない場合はスキップ (ただし初回保存や強制保存時は除く)
    if (layersToCaptureIds.size === 0 && !structureChanged && state.undoStack.length > 0) {
        if (!keepRedo) _clearRedoStack();
        return Promise.resolve();
    }

    _lastSavedLayerIds = currentLayerIdString;

    // 予約した指紋を即座に記録
    for (const id of layersToCaptureIds) {
        _lastDispatchedFingerprints.set(id, snapshotFingerprints.get(id));
    }

    // 2. RAF で GPU アイドル後に createImageBitmap を呼び出す
    const capturePromise = new Promise(resolve => {
        requestAnimationFrame(() => {
            const promises = new Map();
            for (const layer of layers) {
                if (layersToCaptureIds.has(layer.id)) {
                    promises.set(layer.id, createImageBitmap(layer.canvas));
                }
            }
            resolve(promises);
        });
    });

    // 3. キューには即時登録 (shrinkLastUndoEntry との順序を保証)
    return _enqueue(async () => {
        if (!keepRedo) {
            _clearRedoStack();
        }

        // RAF が完了するまで待機 (= GPU アイドル後)
        const snapshotPromises = await capturePromise;

        const prevEntry = state.undoStack.length > 0 ? state.undoStack[state.undoStack.length - 1] : null;

        const snapshot = {
            bitmaps: new Map(),
            layerMeta: layers.map(l => ({ id: l.id, opacity: l.opacity, visible: l.visible })),
            fingerprints: snapshotFingerprints
        };

        // 並列でキャプチャ完了を待つ ＆ 未変更レイヤーは参照を共有
        const captureTasks = layers.map(async (layer) => {
            if (snapshotPromises.has(layer.id)) {
                const bmp = await snapshotPromises.get(layer.id);
                snapshot.bitmaps.set(layer.id, bmp);
            } else if (prevEntry && prevEntry.bitmaps.has(layer.id)) {
                // 変更がないので前回の Bitmap 参照をそのまま使う (差分保存)
                snapshot.bitmaps.set(layer.id, prevEntry.bitmaps.get(layer.id));
            } else {
                // 初回保存など、どちらもない場合はキャプチャ
                const bmp = await createImageBitmap(layer.canvas);
                snapshot.bitmaps.set(layer.id, bmp);
            }
        });

        await Promise.all(captureTasks);

        // 4. 履歴スタックに採用されなかった（層が消えた等）孤立ビットマップを確実に破棄
        for (const [id, bmpPromise] of snapshotPromises) {
            const bmp = await bmpPromise;
            let isUsed = false;
            for (const usedBmp of snapshot.bitmaps.values()) {
                if (usedBmp === bmp) {
                    isUsed = true;
                    break;
                }
            }
            if (!isUsed) {
                bmp.close();
            }
        }

        // 5. 各 Bitmap の参照カウントを増やす
        // (注: ここで _incRef されるため、スタックに残る限り破棄されない)
        for (const bmp of snapshot.bitmaps.values()) {
            _incRef(bmp);
        }

        state.undoStack.push(snapshot);
        saveLocalState();

        const max = state.MAX_HISTORY || 10;
        if (state.undoStack.length > max) {
            const old = state.undoStack.shift();
            _closeAllBitmaps(old);
        }
    });
}

/**
 * Redo スタックを明示的にクリア (描画完了確定時に呼ぶ)
 */
export function commitRedoClear() {
    _clearRedoStack();
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
        const bmp = bitmaps[i];
        snapshot.bitmaps.set(layers[i].id, bmp);
        _incRef(bmp);
    }
    state.undoStack.push(snapshot);
}

/**
 * Helper: Create a full snapshot of current layers
 */
async function createSnapshot() {
    const snapshot = {
        bitmaps: new Map(),
        layerMeta: layers.map(l => ({ id: l.id, opacity: l.opacity, visible: l.visible })),
        fingerprints: new Map(_layerFingerprints)
    };
    const bitmaps = await Promise.all(
        layers.map(layer => createImageBitmap(layer.canvas))
    );
    for (let i = 0; i < layers.length; i++) {
        const bmp = bitmaps[i];
        snapshot.bitmaps.set(layers[i].id, bmp);
        _incRef(bmp);
    }
    return snapshot;
}

/**
 * Undo last action
 */
export async function undo() {
    // 1. もし未保存の変更（現在のキャンバス状態）があれば、まずそれを履歴として確定させる。
    //    これにより「最新の状態を Redo に回し、その1つ前を復元する」動作が確実になる。
    await saveState({ keepRedo: true });

    return _enqueue(async () => {
        if (state.undoStack.length <= 1) return; // 最初の状態は残す

        // 2. スタックのトップ（今のキャンバスの状態。さっき saveState した最新分）を Redo へ移動
        const current = state.undoStack.pop();
        state.redoStack.push(current);

        const max = state.MAX_HISTORY || 10;
        if (state.redoStack.length > max) {
            const old = state.redoStack.shift();
            _closeAllBitmaps(old);
        }

        // 3. その一個下にある「前の状態」を復元
        const prev = state.undoStack[state.undoStack.length - 1];
        restoreSnapshot(prev);
        
        if (prev.fingerprints) {
            for (const [id, fp] of prev.fingerprints) {
                _layerFingerprints.set(id, fp);
                _lastDispatchedFingerprints.set(id, fp);
            }
        }
        saveLocalState();
    });
}

/**
 * Redo last undone action
 */
export async function redo() {
    return _enqueue(async () => {
        if (state.redoStack.length === 0) return;

        // redoStack から undoStack へ戻す
        const next = state.redoStack.pop();
        state.undoStack.push(next);
        
        const max = state.MAX_HISTORY || 10;
        if (state.undoStack.length > max) {
            const old = state.undoStack.shift();
            _closeAllBitmaps(old);
        }

        restoreSnapshot(next);

        if (next.fingerprints) {
            for (const [id, fp] of next.fingerprints) {
                _layerFingerprints.set(id, fp);
                _lastDispatchedFingerprints.set(id, fp);
            }
        }
        saveLocalState();
    });
}

/**
 * Restore canvas contents from a snapshot
 */
function restoreSnapshot(snapshot) {
    const dpr = CANVAS_DPR;
    const bitmaps = snapshot.bitmaps || snapshot;

    // 1. レイヤー構成の同期 (snapshot.layerMeta に合わせる)
    const snapshotIds = snapshot.layerMeta.map(m => m.id);
    
    // 不要なレイヤーを削除 (スナップショットに存在しない ID)
    for (let i = layers.length - 1; i >= 0; i--) {
        if (!snapshotIds.includes(layers[i].id)) {
            layers[i].canvas.remove();
            layers.splice(i, 1);
        }
    }

    // 不足しているレイヤーを作成 ＆ 順序の整合性をとる
    const newLayers = [];
    snapshot.layerMeta.forEach((meta, index) => {
        let layer = layers.find(l => l.id === meta.id);
        if (!layer) {
            // 新規作成 (DOM にも追加)
            layer = createLayerDirect(meta.id);
        }
        newLayers[index] = layer;
    });

    // 参照を入れ替え
    layers.length = 0;
    layers.push(...newLayers);
    updateLayerZIndices();

    // 2. 各レイヤーの状態とピクセルを復元
    for (const layer of layers) {
        const meta = snapshot.layerMeta.find(m => m.id === layer.id);
        if (!meta) continue;

        // IDカウンターを同期 (復元された ID より未来の ID を生成するように)
        syncLayerIdCounter(layer.id);

        layer.ctx.globalCompositeOperation = 'source-over';

        // 状態復元
        layer.opacity = meta.opacity;
        layer.visible = meta.visible;
        layer.canvas.style.opacity = meta.opacity;
        layer.canvas.style.display = meta.visible ? 'block' : 'none';

        // ピクセル復元
        const bitmap = bitmaps.get(layer.id);
        if (bitmap) {
            layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
            layer.ctx.imageSmoothingEnabled = false;
            layer.ctx.drawImage(bitmap, 0, 0, layer.canvas.width / dpr, layer.canvas.height / dpr);
            layer.ctx.imageSmoothingEnabled = true;
        }
    }

    // アクティブレイヤーの安全策
    if (!layers.find(l => l.id === state.activeLayer)) {
        state.activeLayer = layers[layers.length - 1]?.id || 0;
    }

    // Sync transformation to all layers (especially new ones created via createLayerDirect)
    applyTransform();
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
        const dpr = CANVAS_DPR;
        // 消しゴム等で汚染された合成モードをリセット
        layer.ctx.globalCompositeOperation = 'source-over';
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        layer.ctx.imageSmoothingEnabled = false;
        layer.ctx.drawImage(bitmap, 0, 0, layer.canvas.width / dpr, layer.canvas.height / dpr);
        layer.ctx.imageSmoothingEnabled = true;
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
            _decRef(bitmap);
        }
    }
}

// _closeSnapshotBitmaps は不要になったので削除 (参照カウント方式に一本化)

function _clearRedoStack() {
    for (const entry of state.redoStack) {
        _closeAllBitmaps(entry);
    }
    state.redoStack = [];
}
