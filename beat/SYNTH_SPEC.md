# Beat App シンセ仕様書（AI作曲用）

このドキュメントは、AIにBeat AppのJSONを生成させて作曲するための仕様書です。

## エンジン

Tone.js（Web Audio APIラッパー）。サンプルベースではなく、すべてリアルタイム合成。

## トラック構成（5トラック × 16ステップ）

| # | 名前 | シンセタイプ | ベース音程 | 特徴 |
|---|------|------------|-----------|------|
| 0 | Kick | MembraneSynth | C1 | ピッチエンベロープ付きバスドラム |
| 1 | Snare | NoiseSynth | C4 | ホワイトノイズベースのスネア |
| 2 | Hi-hat | MetalSynth | 800Hz | 金属的なハイハット |
| 3 | Bass | FMSynth (polyphony: 2) | C2 | FM合成ベース（三角波キャリア） |
| 4 | Lead | FMSynth (polyphony: 6) | C4 | FM合成リード（サイン波キャリア） |

## トラックパラメータ（全パターン共通）

各トラックに以下の6つのノブがある：

| パラメータ | 範囲 | デフォルト | スケール | 説明 |
|-----------|------|-----------|---------|------|
| tune | -24〜+24 | 0 | linear | 半音単位のピッチシフト |
| cutoff | 100〜16000 | 4000 | log | ローパスフィルターのカットオフ周波数(Hz) |
| resonance | 0.5〜15 | 1 | log | フィルターのQ値 |
| drive | 0〜100 | 0 | linear | ソフトクリップ歪み(%) |
| decay | 0.01〜2.0 | 0.3 | log | 音の減衰時間(秒) |
| vol | 0〜2.0 | 0.7 | linear | 音量倍率 |

## セルパラメータ（1ステップごとの設定）

16ステップ各セルに以下の設定がある：

| パラメータ | 範囲 | デフォルト | 説明 |
|-----------|------|-----------|------|
| active | true/false | false | そのステップで音を鳴らすか |
| pitch | -12〜+12 | 0 | 半音単位のピッチオフセット |
| duration | 0.1〜1.0 | 0.5 | ノート長の倍率 |
| rollMode | true/false | false | 連打モード |
| rollSubdivision | 1, 2, 4, 8 | 4 | 連打の分割数 |

最終的なピッチ = ベース音程 + tune + (octave × 12) + pitch

## スケール

pitchの量子化に使われる。以下から選択：

- Chromatic: [0,1,2,3,4,5,6,7,8,9,10,11]
- Major: [0,2,4,5,7,9,11]
- Minor: [0,2,3,5,7,8,10]
- Dorian: [0,2,3,5,7,9,10]
- Phrygian: [0,1,3,5,7,8,10]
- Penta Maj: [0,2,4,7,9]
- Penta Min: [0,3,5,7,10]
- Blues: [0,3,5,6,7,10]
- Harm Min: [0,2,3,5,7,8,11]
- Ryukyu: [0,4,5,7,11]

## グローバル設定

- bpm: 60〜180（デフォルト: 120）
- masterVolume: dB単位（デフォルト: -12）
- パターンは最大8個
- chainで再生順を指定可能

## JSONの完全な構造

```json
{
  "bpm": 120,
  "masterVolume": -12,
  "currentPattern": 0,
  "nextPattern": null,
  "repeatEnabled": true,
  "chainEnabled": true,
  "trackParams": [
    {"tune": -12, "cutoff": 1000, "resonance": 1, "drive": 10, "decay": 0.4, "vol": 0.9},
    {"tune": 0, "cutoff": 8000, "resonance": 1, "drive": 0, "decay": 0.2, "vol": 0.7},
    {"tune": 0, "cutoff": 10000, "resonance": 1, "drive": 0, "decay": 0.1, "vol": 0.6},
    {"tune": -12, "cutoff": 4000, "resonance": 1, "drive": 15, "decay": 0.3, "vol": 1.1},
    {"tune": 0, "cutoff": 4000, "resonance": 1, "drive": 0, "decay": 0.3, "vol": 0.7}
  ],
  "patterns": [
    {
      "swingEnabled": false,
      "trackOctaves": [0, 0, 0, 0, 0],
      "mutedTracks": [false, false, false, false, false],
      "soloedTracks": [false, false, false, false, false],
      "scale": "Minor",
      "grid": [
        [
          {"active": true, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": true, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": true, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": true, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4}
        ],
        [
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": true, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": true, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4}
        ],
        [
          {"active": true, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": true, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": true, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": true, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": true, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": true, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": true, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": true, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4}
        ],
        [
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4}
        ],
        [
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4},
          {"active": false, "pitch": 0, "duration": 0.5, "rollMode": false, "rollSubdivision": 4}
        ]
      ]
    }
  ],
  "chain": [0, null, null, null, null, null, null, null]
}
```

上記の例は「4つ打ちKick + 2拍4拍Snare + 8分Hi-hat」の基本パターン。

## 音作りプリセット例

### Kick
| 名前 | tune | cutoff | resonance | drive | decay | vol |
|------|------|--------|-----------|-------|-------|-----|
| Thick & Strong | -12 | 1000 | 1 | 10 | 0.4 | 0.9 |
| Sub/Deep 808 | -18 | 600 | 0.5 | 5 | 0.8 | 1.0 |
| Punchy/Clicky | 0 | 3000 | 8 | 30 | 0.1 | 0.7 |
| Distorted | -8 | 2000 | 3 | 60 | 0.3 | 0.8 |

### Snare
| 名前 | tune | cutoff | resonance | drive | decay | vol |
|------|------|--------|-----------|-------|-------|-----|
| Standard | 0 | 8000 | 1 | 0 | 0.2 | 0.7 |
| Tight | 12 | 12000 | 10 | 15 | 0.08 | 0.6 |
| Lo-Fi | -12 | 4000 | 2 | 45 | 0.35 | 0.9 |
| Clap-ish | 0 | 5000 | 4 | 20 | 0.15 | 0.7 |

### Hi-hat
| 名前 | tune | cutoff | resonance | drive | decay | vol |
|------|------|--------|-----------|-------|-------|-----|
| Closed | 0 | 10000 | 1 | 0 | 0.05 | 0.6 |
| Open | 0 | 8000 | 2 | 0 | 0.3 | 0.6 |
| Chip | 24 | 14000 | 5 | 30 | 0.03 | 0.5 |
| Shaker | -6 | 6000 | 1 | 10 | 0.1 | 0.7 |

### Bass (FM Synth)
| 名前 | tune | cutoff | resonance | drive | decay | vol |
|------|------|--------|-----------|-------|-------|-----|
| Thick | -12 | 4000 | 1 | 15 | 0.3 | 1.1 |
| Sub | -12 | 1200 | 0.5 | 0 | 0.5 | 1.3 |
| Acid | 0 | 2000 | 12 | 40 | 0.15 | 1.0 |
| Pluck | 12 | 4000 | 2 | 10 | 0.08 | 1.0 |

### Lead (FM Synth)
| 名前 | tune | cutoff | resonance | drive | decay | vol |
|------|------|--------|-----------|-------|-------|-----|
| Soft | 0 | 4000 | 1 | 0 | 0.3 | 0.7 |
| Chime | 24 | 8000 | 4 | 10 | 0.6 | 0.7 |
| Retro | -12 | 2000 | 5 | 55 | 0.2 | 0.8 |
| Chip/Square | 12 | 12000 | 2 | 40 | 0.05 | 0.6 |

## 重要な制約

- gridは必ず **5トラック × 16ステップ**（省略不可）
- pitchはスケール設定に関係なく半音単位で指定（再生時にスケールで量子化される）
- Bass (track 3) のポリフォニーは最大2音、Lead (track 4) は最大6音
- Kick/Snare/Hi-hatはモノフォニック（pitchは音色変化に使える）
- activeがfalseのセルの他パラメータは無視される（が、省略せずデフォルト値を入れること）
- 未使用パターンもデフォルト値で全8パターン分出力すること
