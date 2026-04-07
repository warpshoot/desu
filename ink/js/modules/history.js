import {
    state,
    layers,
    getLayer,
    getActiveLayer,
    CANVAS_DPR
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

const _layerFingerprints = new Map();
let _fingerprintCounter = 0;

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

/**
 * レイヤーに変更があったことをマーク (描画操作の完了時に呼ぶ)
 */
export function markLayerDirty(layerId) {
    _layerFingerprints.set(layerId, ++_fingerprintCounter);
}

export async function saveState({ keepRedo = false } = {}) {
    // 1. 変更があるレイヤーを同期的に特定 (指紋チェック)
    //    createImageBitmap の呼び出し自体は RAF まで遅延する:
    //    - pen mode では RAF 発火時も layer.canvas が "ストローク前" 状態を保っている
    //      (ストロークは strokeCanvas に描かれ、endPenDrawing まで layer には触れない)
    //    - RAF は前フレームの GPU 書き込みが確実に完了した後に発火するため、
    //      GPU パイプライン同期のブロッキングが発生しない
    const snapshotFingerprints = new Map(_layerFingerprints);
    const layersToCaptureIds = new Set();

    for (const layer of layers) {
        const currentFp = snapshotFingerprints.get(layer.id) || 0;
        const lastSavedFp = _lastDispatchedFingerprints.get(layer.id) || 0;

        if (currentFp !== lastSavedFp) {
            layersToCaptureIds.add(layer.id);
            // 予約した指紋を即座に記録 (連続 saveState 呼び出しで重複キャプチャを防ぐ)
            _lastDispatchedFingerprints.set(layer.id, currentFp);
        }
    }

    // 2. RAF で GPU アイドル後に createImageBitmap を呼び出す
    //    RAF に入った時点では layer.canvas への書き込みは完了している
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

        state.undoStack.push(snapshot);
        saveLocalState();

        if (state.undoStack.length > state.MAX_HISTORY) {
            const old = state.undoStack.shift();
            _closeSnapshotBitmaps(old, state.undoStack[0]);
        }
    });
}

/**
 * Undo スタックの最新エントリを Dirty Rect パッチに縮小する
 *
 * ストローク完了後、変化した領域 (dirtyRect) のみを保存することで
 * メモリを大幅に削減する。フルキャンバスの ImageBitmap を解放し、
 * 矩形切り抜きのパッチ ImageBitmap に差し替える。
 *
 * @param {number} layerId
 * @param {{ x: number, y: number, w: number, h: number }} dirtyRect  CSS px 単位
 */
export async function shrinkLastUndoEntry(layerId, dirtyRect) {
    return _enqueue(async () => {
        if (state.undoStack.length === 0) return;
        const entry = state.undoStack[state.undoStack.length - 1];
        const fullBitmap = entry.bitmaps && entry.bitmaps.get(layerId);
        if (!fullBitmap) return;

        // 【安全性】もしこの Bitmap が一つ前のエントリと共有されている場合、
        // オリジナルを close してはいけない (共有先も消えるため)。
        const prevEntry = state.undoStack.length > 1 ? state.undoStack[state.undoStack.length - 2] : null;
        const isShared = prevEntry && prevEntry.bitmaps.get(layerId) === fullBitmap;

        const dpr = CANVAS_DPR;
        const sx = Math.max(0, Math.floor(dirtyRect.x * dpr));
        const sy = Math.max(0, Math.floor(dirtyRect.y * dpr));
        const sw = Math.min(fullBitmap.width  - sx, Math.ceil(dirtyRect.w * dpr));
        const sh = Math.min(fullBitmap.height - sy, Math.ceil(dirtyRect.h * dpr));

        if (sw <= 0 || sh <= 0) return;
        if (sw * sh > fullBitmap.width * fullBitmap.height * 0.75) return;

        const patchBitmap = await createImageBitmap(fullBitmap, sx, sy, sw, sh);
        
        // 共有されていない場合のみ元のフルサイズを close
        if (!isShared) {
            fullBitmap.close();
        }
        
        entry.bitmaps.delete(layerId);
        if (!entry.patches) entry.patches = new Map();
        entry.patches.set(layerId, { bitmap: patchBitmap, x: sx / dpr, y: sy / dpr });
    });
}

/**
 * Redo スタックを明示的にクリア (描画完了確定時に呼ぶ)
 */
export function commitRedoClear() {
    _clearRedoStack();
}

/**
 * ストローク前の "before" dirty rect パッチを履歴エントリとして保存する
 *
 * pen mode 専用: strokeCanvas に描いていたため layer.canvas は未変更。
 * pointerup で endPenDrawing() を呼ぶ前に layer.canvas の dirty 領域だけを
 * createImageBitmap でキャプチャし、フルキャンバスキャプチャを完全に省略する。
 *
 * @param {number} layerId
 * @param {{ x: number, y: number }} patchOrigin  パッチ左上座標 (CSS px)
 * @param {Promise<ImageBitmap>}     patchPromise  dirty rect の ImageBitmap Promise
 * @param {boolean}                  keepRedo
 */
export function savePatchState({ layerId, patchOrigin, patchPromise, keepRedo = false }) {
    return _enqueue(async () => {
        if (!keepRedo) _clearRedoStack();

        const prevEntry = state.undoStack.length > 0 ? state.undoStack[state.undoStack.length - 1] : null;

        const snapshot = {
            bitmaps: new Map(),
            patches: new Map(),
            layerMeta: layers.map(l => ({ id: l.id, opacity: l.opacity, visible: l.visible }))
        };

        // 変更のない他レイヤーは前回スナップショットの参照を再利用 (差分保存)
        for (const layer of layers) {
            if (layer.id !== layerId && prevEntry && prevEntry.bitmaps.has(layer.id)) {
                snapshot.bitmaps.set(layer.id, prevEntry.bitmaps.get(layer.id));
            }
        }

        const patchBitmap = await patchPromise;
        snapshot.patches.set(layerId, { bitmap: patchBitmap, x: patchOrigin.x, y: patchOrigin.y });

        state.undoStack.push(snapshot);
        saveLocalState();

        if (state.undoStack.length > state.MAX_HISTORY) {
            const old = state.undoStack.shift();
            _closeSnapshotBitmaps(old, state.undoStack[0]);
        }
    });
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
        layerMeta: layers.map(l => ({ id: l.id, opacity: l.opacity, visible: l.visible })),
        fingerprints: new Map(_layerFingerprints)
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
    return _enqueue(async () => {
        // 現在の状態を含めて2つ以上の履歴が必要 (戻り先があること)
        if (state.undoStack.length <= 1) return;

        // 現在の状態を Pop して Redo スタックへ移動
        const current = state.undoStack.pop();
        state.redoStack.push(current);
        
        // Redo スタックの上限管理
        if (state.redoStack.length > state.MAX_HISTORY) {
            const old = state.redoStack.shift();
            _closeSnapshotBitmaps(old, state.redoStack[0]);
        }

        // 新しいトップ (戻り先) を復元
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

        // Redo スタックから戻し、Undo スタックへ
        const next = state.redoStack.pop();
        state.undoStack.push(next);
        
        // Undo スタックの上限管理
        if (state.undoStack.length > state.MAX_HISTORY) {
            const old = state.undoStack.shift();
            _closeSnapshotBitmaps(old, state.undoStack[0]);
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
    const bitmaps = snapshot.bitmaps || snapshot; // 後方互換: 旧形式は Map 直接
    const patches = snapshot.patches || new Map();

    for (const layer of layers) {
        // 消しゴム等で汚染された合成モードをリセット
        layer.ctx.globalCompositeOperation = 'source-over';

        const bitmap = bitmaps instanceof Map ? bitmaps.get(layer.id) : undefined;
        if (bitmap) {
            // フルスナップショット: キャンバス全体を置き換え
            layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
            layer.ctx.imageSmoothingEnabled = false;
            layer.ctx.drawImage(bitmap, 0, 0, layer.canvas.width / dpr, layer.canvas.height / dpr);
            layer.ctx.imageSmoothingEnabled = true;
        } else if (patches.has(layer.id)) {
            // パッチ: dirty rect 領域のみを復元
            const patch = patches.get(layer.id);
            const pw = patch.bitmap.width  / dpr;
            const ph = patch.bitmap.height / dpr;
            layer.ctx.clearRect(patch.x, patch.y, pw, ph);
            layer.ctx.imageSmoothingEnabled = false;
            layer.ctx.drawImage(patch.bitmap, patch.x, patch.y, pw, ph);
            layer.ctx.imageSmoothingEnabled = true;
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
            if (bitmap && typeof bitmap.close === 'function') {
                bitmap.close();
            }
        }
    }
    if (snapshot.patches instanceof Map) {
        for (const patch of snapshot.patches.values()) {
            if (patch.bitmap && typeof patch.bitmap.close === 'function') {
                patch.bitmap.close();
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

    // パッチは参照共有しないので無条件で解放
    if (oldSnapshot.patches instanceof Map) {
        for (const patch of oldSnapshot.patches.values()) {
            if (patch.bitmap && typeof patch.bitmap.close === 'function') {
                patch.bitmap.close();
            }
        }
    }
}

function _clearRedoStack() {
    for (const entry of state.redoStack) {
        _closeAllBitmaps(entry);
    }
    state.redoStack = [];
}
