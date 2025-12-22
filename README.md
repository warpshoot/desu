# DESU™

ビジュアルノベルとイラストギャラリーの統合コンテンツ

## 📖 Episodes

エピソード形式のビジュアルノベル

- **ep. 0**: はじまり ✅
- **ep. 1**: Coming Soon
- **ep. 2**: Coming Soon

## 🎨 Gallery

DESUのイラスト作品集

## 🚀 ローカル環境での実行

```bash
# HTTPサーバーを起動
python3 -m http.server 8000

# ブラウザでアクセス
# http://localhost:8000/
```

## 📁 ディレクトリ構造

```
desu/
├── index.html          # メインページ
├── style.css           # 共通スタイル
├── ep0/                # エピソード0
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── images/
├── ep1/                # 将来のエピソード
├── gallery/            # ギャラリー
│   ├── index.html
│   ├── style.css
│   ├── gallery.js
│   └── images/
└── README.md
```

## ✨ 機能

### ビジュアルノベル
- キャラクター別の音声効果
- テキスト表示アニメーション
- フェードイン/アウト演出
- モバイル対応

### ギャラリー
- グリッドレイアウト
- ライトボックス表示
- レスポンシブ対応

## 🌐 GitHub Pages

https://warpshoot.github.io/desu/

## 📝 ギャラリーに画像を追加する方法

1. 画像を `gallery/images/` に配置
2. `gallery/gallery.js` の `images` 配列に追加：

```javascript
const images = [
    { src: 'images/001.jpg', alt: 'DESU Illustration 1' },
    { src: 'images/002.jpg', alt: 'DESU Illustration 2' },
];
```

## © 2025 warpshoot
