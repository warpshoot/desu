# PULSE ユーザーガイド (Unified Manual)

PULSEは、2つの異なる音響エンジン（BEAT / BEEP）を切り替えて使用できるハイブリッド・ミュージック・ワークステーションです。

---

## 🔄 モード切り替え (Mode Switching)
画面右上のボタンをクリックすることで、2つのエンジンを瞬時に切り替えられます。

*   **BEAT**: モダンで重厚なリズムメイク。5つのシンセエンジン（Membrane, Noise, FM）を搭載。
*   **BEEP**: 8bit/Chiptuneスタイルのレトロなサウンド。パルス波とチップノイズによるポップな音源。

---

## 🎹 メイングリッド (Sequencer)
5つのトラック × 16ステップのグリッドシーケンサー。

### トラック構成 (Tracks)
| トラック | BEAT (Modern) | BEEP (Retro) |
|:---:|:---|:---|
| **K** | Kick (Membrane) | Kick (Pulse Kick) |
| **S** | Snare (Noise) | Snare (Chip Noise) |
| **H** | Hi-hat (Metal) | Hi-hat (Chip Noise) |
| **B** | Bass (FM Synth) | Bass (Square Wave) |
| **L** | Lead (FM Synth) | Lead (Square Wave) |

### 操作方法
*   **タップ**: ノートの ON (Strong) / WEAK / OFF を切り替え。
*   **上下ドラッグ**: ピッチ（音の高さ）を調整。
*   **左右ドラッグ**: デュレーション（音の長さ）を調整。
*   **長押し**: 連打（ROLL）メニューを表示（1, 2, 4, 8分割）。
*   **なぞり入力**: 空のセルをドラッグすると連続入力（ペイントモード）。
*   **アイコン長押し**: トラックのコピー・ペースト・クリア。

---

## 🎛️ サウンドエディット (Tone Panel)
トラックアイコンをタップしてパネルを開きます。

*   **Knobs**: `TUNE` (音程), `CUT/RES` (フィルター), `DRIVE` (歪み), `DEC` (減衰/余韻), `VOL` (音量)。
*   **Presets**: 用意された4つの音色を選択。ノブを回すと自動で上書き保存されます。
*   **Scale Apply All**: 選択中のスケールを全パターンに適用。

---

## 💿 DJモード
再生中に中央のダンサーをタップして起動。

*   **XY Pad**: フィルターとディレイを操作。
*   **Ribbon**: 全体のピッチをダイナミックに変更。
*   **FX Buttons**: `STUT` (ループ), `SLOW` (テープストップ), `GATE` (断続音), `CRSH` (ビットクラッシュ)。
*   **AUTO記録**: 操作をステップに記録し、自動再生します。

---

## 🤖 AI向け楽曲作成仕様 (AI Composition Manual)

AIアシスタントがPULSE用の楽曲データ（JSON）を生成するための仕様です。

### 基本構造
JSONは `bpm`, `trackParams`, `patterns` 配列を含みます。

```json
{
  "bpm": 120,
  "masterVolume": -12,
  "trackParams": [
    {"tune": 0, "cutoff": 4000, "resonance": 1, "drive": 0, "decay": 0.3, "vol": 0.7},
    {"tune": 0, "cutoff": 8000, "resonance": 1, "drive": 0, "decay": 0.2, "vol": 0.7},
    {"tune": 0, "cutoff": 10000, "resonance": 1, "drive": 0, "decay": 0.1, "vol": 0.6},
    {"tune": -12, "cutoff": 4000, "resonance": 1, "drive": 15, "decay": 0.3, "vol": 1.1},
    {"tune": 0, "cutoff": 4000, "resonance": 1, "drive": 0, "decay": 0.3, "vol": 0.7}
  ],
  "patterns": [
    {
      "scale": "Minor",
      "grid": [
        [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
        [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
        [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
        [{"active":true,"pitch":0},0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
        [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]
      ]
    }
  ],
  "chain": [0, 0, 0, 0, null, null, null, null]
}
```

### セルパラメータ
*   `0`: デフォルト（非アクティブ）
*   `1`: デフォルト（アクティブ、Pitch=0, Dur=1.0, Vel=1.0）
*   `{"active":true, "pitch": n, "duration": n, "velocity": n, "rollMode": true, "rollSubdivision": n}`: 詳細設定。

### 構成のコツ
*   **BEATモード**: 太いバスドラムと複雑なFMシンセを活かしたテクノやハウス、アンビエントが得意です。
*   **BEEPモード**: `decay` を極端に短く（0.03〜0.1）設定し、`duration` も短くすることで、チップチューン特有の歯切れの良さを出せます。
*   **Chain機能**: `chain` 配列にパターンの並び順を指定することで、一曲の流れ（展開）を作成してください。

---

## ⚙️ システム機能
*   **REC**: 演奏を .webm/.mp4 で録音。
*   **PRJ**: プロジェクトの保存・読み込み。
*   **SWING**: ハネ具合を「OFF / LIGHT / HEAVY」から選択。
