# DESU™︎ ep. 0

デスとサカナの物語を描くビジュアルノベル。

## 概要

Web技術(HTML/CSS/JavaScript)で作られたビジュアルノベルゲームです。
キャラクターごとに異なる声のトーンと会話演出を楽しめます。

## 機能

- テキストの一文字ずつ表示アニメーション
- キャラクターごとの音声効果（Web Audio API）
- 顔アイコン表示
- 背景動画
- レスポンシブデザイン（モバイル対応）

## 起動方法

ローカルサーバーで起動してください：

```bash
# Pythonの場合
python -m http.server 8000

# Node.jsの場合（http-server）
npx http-server
```

ブラウザで `http://localhost:8000/visual-novel/` にアクセス。

## 構成

```
visual-novel/
├── index.html      # メインHTML
├── script.js       # ゲームロジック
├── style.css       # スタイルシート
└── images/         # 画像・動画アセット
    ├── desu.jpg
    ├── sakana.jpg
    ├── desu01.mp4
    └── ...
```

## 操作方法

- **クリック/タップ**: テキスト送り
- テキスト表示中にクリック: スキップして全文表示

## キャラクター

- **デス**: 主人公
- **サカナ**: 相棒

## 技術スタック

- HTML5
- CSS3
- Vanilla JavaScript
- Web Audio API
