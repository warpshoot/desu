# ローポリモデリングツール 計画書

## 概要

`/desu/lowpoly/` に配置するブラウザベースのローポリ3Dモデリングツール。Three.js (CDN) を使用し、頂点・辺・面レベルの編集でローポリモデルを作成・着色・エクスポートできる。

---

## ディレクトリ構成

```
lowpoly/
├── index.html              # HTML構造 + Three.js CDN読み込み
├── css/
│   └── style.css           # UI スタイル
└── js/
    ├── main.js             # エントリポイント (モジュール初期化)
    └── modules/
        ├── state.js        # グローバル状態管理
        ├── scene.js        # Three.js シーン・カメラ・レンダラー・グリッド
        ├── controls.js     # OrbitControls + カメラ操作
        ├── primitives.js   # プリミティブ生成 (Box, Icosphere, Cylinder等)
        ├── selection.js    # レイキャストによる頂点/辺/面選択
        ├── transform.js    # 移動・回転・スケール (ギズモ)
        ├── editing.js      # 押し出し・細分化・削除・マージ
        ├── color.js        # 面カラーリング
        ├── history.js      # Undo/Redo スタック
        ├── export.js       # OBJ / GLTFエクスポート
        └── ui.js           # ツールバー・パネルのイベント管理
```

---

## 外部依存

| ライブラリ | バージョン | 読み込み方法 | 用途 |
|---|---|---|---|
| Three.js | r162+ | CDN (ES module importmap) | 3D描画全般 |
| OrbitControls | 同上 | CDN | カメラ操作 |
| TransformControls | 同上 | CDN | ギズモ移動/回転/スケール |

```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.162.0/examples/jsm/"
  }
}
</script>
```

---

## UI レイアウト

```
┌─────────────────────────────────────────────────┐
│  LOWPOLY | DESU™                    [Dark BG]   │  ← ヘッダー
├────────┬────────────────────────────┬────────────┤
│        │                            │            │
│ ツール │     3D ビューポート         │ プロパティ │
│ バー   │     (WebGL Canvas)         │ パネル     │
│        │                            │            │
│ [Add]  │                            │ 頂点座標   │
│ [Sel]  │                            │ 面カラー   │
│ [Move] │                            │ マテリアル │
│ [Ext]  │                            │            │
│ [Sub]  │                            │            │
│ [Col]  │                            │            │
│ [Del]  │                            │            │
│        │                            │            │
├────────┴────────────────────────────┴────────────┤
│  モード: [Object ▼] [Vertex/Edge/Face]  Undo Redo│  ← ステータスバー
└─────────────────────────────────────────────────────┘
```

モバイル対応: 左ツールバーが下部に移動、プロパティパネルはスワイプで表示。

---

## 機能詳細

### 1. プリミティブ生成 (`primitives.js`)

| プリミティブ | パラメータ | 初期ポリ数 |
|---|---|---|
| Box | 幅/高さ/奥行, 分割数 | 12面 |
| Icosphere | 半径, 分割レベル(0-3) | 20面(Lv0) |
| Cylinder | 半径上/下, 高さ, 側面数 | ~20面 |
| Cone | 半径, 高さ, 側面数 | ~12面 |
| Plane | 幅/高さ, 分割数 | 2面 |
| Torus | 半径, チューブ半径, セグメント | ~48面 |

- 生成時に `BufferGeometry` を使用、`position` / `normal` / `color` 属性を持つ
- 全て indexed geometry で管理（頂点共有のため）

### 2. 選択システム (`selection.js`)

- **オブジェクトモード**: メッシュ全体を選択
- **頂点モード**: 個別頂点をクリック / 矩形選択
- **辺モード**: 2頂点間の辺を選択
- **面モード**: 三角面をクリック選択

実装方針:
- `Raycaster` で交差判定
- 選択中の要素はハイライト表示（頂点=黄色ドット、辺=黄色ライン、面=半透明オレンジ）
- Shift+クリックで複数選択
- `A` キーで全選択/解除

### 3. トランスフォーム (`transform.js`)

- **移動(G)**: 選択要素をドラッグまたは軸拘束(X/Y/Z)で移動
- **回転(R)**: オブジェクトモードのみ
- **スケール(S)**: オブジェクトモードのみ
- Three.js の `TransformControls` をオブジェクトモードで使用
- 頂点モードでは自前のドラッグ処理（選択頂点群をレイキャスト平面上で移動）

### 4. 編集操作 (`editing.js`)

| 操作 | ショートカット | 説明 |
|---|---|---|
| 押し出し(Extrude) | `E` | 選択面を法線方向に押し出し、新しい面を生成 |
| 細分化(Subdivide) | `Ctrl+D` | 選択面を4分割（Loop Subdivide の簡易版） |
| 削除(Delete) | `X` / `Delete` | 選択した頂点/辺/面を削除 |
| マージ(Merge) | `M` | 選択頂点を中心点にマージ |
| 面を張る(Fill) | `F` | 3-4頂点選択時に面を生成 |
| 法線反転(Flip) | `Ctrl+F` | 選択面の法線を反転 |

**Extrude 処理フロー:**
1. 選択面の頂点を複製
2. 元の面の頂点参照を複製頂点に変更
3. 元頂点と複製頂点の間に側面を生成
4. インタラクティブに法線方向へ移動

### 5. 面カラーリング (`color.js`)

- `geometry.attributes.color`（per-vertex color）で面ごとに着色
- カラーピッカーで色を選択 → 選択面に適用
- パレット機能: よく使う色を保存（最大16色）
- スポイトツール: 既存面から色を取得
- マテリアルは `MeshStandardLighting` + `vertexColors: true`

### 6. Undo/Redo (`history.js`)

- コマンドパターンで実装
- 各操作をスナップショット（geometry attributes のクローン）として保存
- 最大50段階
- `Ctrl+Z` / `Ctrl+Shift+Z`

### 7. エクスポート (`export.js`)

- **OBJ**: テキスト形式、頂点カラーは `# vertex color` 拡張で出力
- **GLTF/GLB**: Three.js の `GLTFExporter` を使用、カラー情報込み
- ファイル名は `lowpoly_YYYYMMDD_HHmmss.obj`

---

## 状態管理 (`state.js`)

```js
export const state = {
  mode: 'object',           // 'object' | 'vertex' | 'edge' | 'face'
  tool: 'select',           // 'select' | 'move' | 'extrude' | 'color'
  objects: [],              // シーン内の編集可能メッシュ一覧
  activeObject: null,       // 現在編集中のメッシュ
  selection: {
    vertices: new Set(),    // 選択中の頂点インデックス
    edges: new Set(),       // 選択中の辺 (頂点ペア)
    faces: new Set(),       // 選択中の面インデックス
  },
  currentColor: '#4a90d9',  // 現在の塗りカラー
  palette: [],              // 保存カラーパレット
  grid: { visible: true, size: 10 },
  snap: { enabled: false, step: 0.25 },
};
```

---

## キーボードショートカット一覧

| キー | 動作 |
|---|---|
| `1` / `2` / `3` | 頂点 / 辺 / 面モード切替 |
| `Tab` | オブジェクト ↔ 編集モード切替 |
| `G` | 移動 |
| `R` | 回転（オブジェクトモード） |
| `S` | スケール（オブジェクトモード） |
| `E` | 押し出し |
| `F` | 面を張る |
| `X` / `Delete` | 削除 |
| `M` | マージ |
| `A` | 全選択/解除 |
| `Ctrl+D` | 細分化 |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Numpad 1/3/7` | 正面/側面/上面ビュー |
| `Numpad 5` | 透視投影 ↔ 平行投影 |

---

## UI テーマ

既存の `pxl-ultra` に合わせたダークテーマ:

```css
:root {
  --bg: #0a0a0a;
  --fg: #e0e0e0;
  --accent: #4a90d9;
  --border: #333;
  --panel-bg: #151515;
  --selection: #f5a623;
  --hover: #ffffff22;
}
```

---

## 実装順序（推奨）

| Phase | 内容 | 依存 |
|---|---|---|
| **P1** | `index.html` + `style.css` + `scene.js` + `controls.js` — シーン描画とカメラ操作 | なし |
| **P2** | `primitives.js` + `state.js` + `ui.js` — プリミティブ追加とUI | P1 |
| **P3** | `selection.js` — レイキャストによる頂点/辺/面選択 | P2 |
| **P4** | `transform.js` — 選択要素の移動 | P3 |
| **P5** | `color.js` — 面カラーリング + パレット | P3 |
| **P6** | `editing.js` — 押し出し・細分化・削除・マージ | P3, P4 |
| **P7** | `history.js` — Undo/Redo | P6 |
| **P8** | `export.js` — OBJ/GLTFエクスポート | P2 |

P1→P2→P3 が最小動作版。P3まで完成すれば頂点を選択して動かせるローポリモデラーとして使える。
