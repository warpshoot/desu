
import {
    state,
    roughCanvas,
    fillCanvas,
    lineCanvas
} from './state.js';

function exitSaveMode() {
    state.isSaveMode = false;
    document.getElementById('save-overlay').style.display = 'none';
    document.getElementById('save-ui').style.display = 'none';
    document.getElementById('save-ui').classList.remove('hidden-during-selection');
    document.getElementById('save-ui').classList.remove('in-confirmation-mode');
    document.getElementById('selection-canvas').style.display = 'none';
    document.getElementById('generating').style.display = 'none';
    document.getElementById('toolbar-left').style.display = 'flex';
    document.getElementById('toolbar-right').style.display = 'flex';
    document.getElementById('layer-controls').style.display = 'flex';
    document.getElementById('resetZoomBtn').style.display = '';  // インラインスタイルをクリア
    document.getElementById('confirmSelectionBtn').style.display = 'none';
    document.getElementById('copyClipboardBtn').style.display = 'none';
    document.getElementById('redoSelectionBtn').style.display = 'none';

    // applyTransform() call needed here but creates circular dependency if imported from canvas.js?
    // Using a custom event or callback might be cleaner, but for now we assume canvas state is preserved or re-applied by main/ui logic.
    // Ideally, UI module handles mode switching.

    const selCanvas = document.getElementById('selection-canvas');
    const selCtx = selCanvas.getContext('2d');
    selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);

    state.selectionStart = null;
    state.selectionEnd = null;
    state.confirmedSelection = null;

    // Helper to re-apply transform if needed, or simply let main loop handle it.
    // For this refactor, we'll dispatch a custom event that main.js or ui.js can listen to if needed.
    document.dispatchEvent(new CustomEvent('saveModeExited'));
}
// Exporting exitSaveMode for UI module to use
export { exitSaveMode };

export async function saveRegion(x, y, w, h) {
    const transparent = document.getElementById('transparentBg').checked;
    const outputScale = state.selectedScale;

    const flash = document.getElementById('flash');
    if (flash) {
        flash.style.opacity = '0.7';
        setTimeout(() => { flash.style.opacity = '0'; }, 100);
    }

    try {
        const outputW = w * outputScale;
        const outputH = h * outputScale;

        // レイヤーを合成した一時canvas
        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = w;
        mergedCanvas.height = h;
        const mergedCtx = mergedCanvas.getContext('2d');
        mergedCtx.imageSmoothingEnabled = false;

        // 背景不透過の場合、白背景を塗る
        if (!transparent) {
            mergedCtx.fillStyle = '#fff';
            mergedCtx.fillRect(0, 0, w, h);
        }

        // アタリレイヤー描画（表示されている場合）
        if (state.roughVisible) {
            mergedCtx.drawImage(roughCanvas, x, y, w, h, 0, 0, w, h);
        }

        // ベタレイヤー描画（表示されている場合）
        if (state.fillVisible) {
            mergedCtx.drawImage(fillCanvas, x, y, w, h, 0, 0, w, h);
        }

        // ペン入れレイヤー描画（表示されている場合）
        if (state.lineVisible) {
            mergedCtx.drawImage(lineCanvas, x, y, w, h, 0, 0, w, h);
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = outputW;
        tempCanvas.height = outputH;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.imageSmoothingEnabled = false;

        if (transparent) {
            const imgData = mergedCtx.getImageData(0, 0, w, h);
            const data = imgData.data;

            for (let i = 0; i < data.length; i += 4) {
                if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) {
                    data[i + 3] = 0;
                }
            }

            const sourceCanvas = document.createElement('canvas');
            sourceCanvas.width = w;
            sourceCanvas.height = h;
            sourceCanvas.getContext('2d').putImageData(imgData, 0, 0);
            tempCtx.drawImage(sourceCanvas, 0, 0, outputW, outputH);
        } else {
            tempCtx.drawImage(mergedCanvas, 0, 0, outputW, outputH);
        }

        const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png'));
        const fileName = 'desu_sketch-layer_' + Date.now() + '.png';

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => URL.revokeObjectURL(url), 1000);
        exitSaveMode();
    } catch (err) {
        console.error('保存エラー:', err);
        alert('保存に失敗しました: ' + err.message);
        exitSaveMode();
    }
}

export async function copyToClipboard(x, y, w, h) {
    const transparent = document.getElementById('transparentBg').checked;
    const outputScale = state.selectedScale;

    const flash = document.getElementById('flash');
    flash.style.opacity = '0.7';
    setTimeout(() => { flash.style.opacity = '0'; }, 100);

    let tempCanvas = null; // tempCanvasをtryブロックの外で宣言

    try {
        const outputW = w * outputScale;
        const outputH = h * outputScale;

        // レイヤーを合成した一時canvas
        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = w;
        mergedCanvas.height = h;
        const mergedCtx = mergedCanvas.getContext('2d');
        mergedCtx.imageSmoothingEnabled = false;

        // 背景不透過の場合、白背景を塗る
        if (!transparent) {
            mergedCtx.fillStyle = '#fff';
            mergedCtx.fillRect(0, 0, w, h);
        }

        // 描画順序: rough -> fill -> line (表示されているもののみ)
        // アタリレイヤー描画（表示されている場合）
        if (state.roughVisible) {
            mergedCtx.drawImage(roughCanvas, x, y, w, h, 0, 0, w, h);
        }

        // ベタレイヤー描画（表示されている場合）
        if (state.fillVisible) {
            mergedCtx.drawImage(fillCanvas, x, y, w, h, 0, 0, w, h);
        }

        // ペン入れレイヤー描画（表示されている場合）
        if (state.lineVisible) {
            mergedCtx.drawImage(lineCanvas, x, y, w, h, 0, 0, w, h);
        }

        tempCanvas = document.createElement('canvas'); // ここでtempCanvasを初期化
        tempCanvas.width = outputW;
        tempCanvas.height = outputH;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.imageSmoothingEnabled = false;

        if (transparent) {
            const imgData = mergedCtx.getImageData(0, 0, w, h);
            const data = imgData.data;

            for (let i = 0; i < data.length; i += 4) {
                if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) {
                    data[i + 3] = 0;
                }
            }

            const sourceCanvas = document.createElement('canvas');
            sourceCanvas.width = w;
            sourceCanvas.height = h;
            sourceCanvas.getContext('2d').putImageData(imgData, 0, 0);
            tempCtx.drawImage(sourceCanvas, 0, 0, outputW, outputH);
        } else {
            tempCtx.drawImage(mergedCanvas, 0, 0, outputW, outputH);
        }

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

        // コピー成功のフィードバック（ボタンテキストを一時的に変更）
        const copyBtn = document.getElementById('copyClipboardBtn');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'コピーしました！';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 1500);

        // モーダルは閉じない
    } catch (err) {
        console.error('クリップボードコピーエラー:', err);
        alert('クリップボードへのアクセスに失敗しました。画像をダウンロードします。');

        // フォールバック: 画像ダウンロード
        if (tempCanvas) { // tempCanvasが生成されていればダウンロードを試みる
            try {
                const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png'));
                const fileName = 'desu_sketch-layer_' + Date.now() + '.png';

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                setTimeout(() => URL.revokeObjectURL(url), 1000);
                // ダウンロード成功後もモーダルは閉じない（コピーと同じ挙動）
            } catch (downloadErr) {
                console.error('ダウンロードエラー:', downloadErr);
                alert('画像のダウンロードにも失敗しました: ' + downloadErr.message);
            }
        } else {
            alert('エラーが発生し、画像を生成できませんでした。');
        }
    }
}
