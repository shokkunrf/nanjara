# パイ認識アプリ コンテキストノート

**作成日**: 2026-03-12

## 技術スタック

- **フレームワーク**: SvelteKit 2.50.2 + Svelte 5.51.0
- **言語**: TypeScript 5.9.3
- **ビルドツール**: Vite 7.3.1
- **テスト**: Vitest 4.0.18 + Playwright（ブラウザテスト）
- **デプロイ**: @sveltejs/adapter-static（静的サイト生成）
- **コード品質**: ESLint, Prettier, svelte-check

## プロジェクト構造

```
app/
├── src/
│   ├── lib/
│   │   ├── components/camera/   # カメラ撮影機能（実装済み）
│   │   ├── types.ts             # 型定義
│   │   └── index.ts
│   └── routes/                  # SvelteKitルーティング
├── static/                      # 静的アセット
├── vite.config.ts
└── svelte.config.js
tools/
└── extractor/                   # 牌画像抽出ツール
    ├── output/                  # 抽出済み牌画像（84枚）+ tiles.json
    └── src/main.ts
docs/
├── aa.md                        # PRD
├── official/manual.pdf          # 公式ルールブック
└── spec/pie-recognition/        # 本要件定義
```

## 既存実装

### カメラ撮影機能（実装済み）
- `Camera.svelte`: 状態管理（capture/result モード切替）
- `CameraCapture.svelte`: getUserMedia による背面カメラ撮影（1920x1080、JPEG 0.92品質）
- `CameraResult.svelte`: 撮影画像プレビュー + 再撮影ボタン
- `CameraLayout.svelte`: 共通レイアウト（Svelte 5 snippet活用）
- `+layout.svelte`: 戻るボタンハンドリング（2タップで終了）

### 牌画像データ
- 84枚のPNG画像（106x143px → 統一高さにリサイズ）
- 7グループ: μ's(11), Aqours(11), 虹ヶ咲(15), Liella!(13), 蓮ノ空(10), Musical(12), Bluebird(12)
- 各グループ: グループエンブレム + 学校エンブレム + キャラクター牌
- tiles.json: ファイル名 → 日本語表示名のマッピング

## ユビキタス言語

| 用語 | 意味 |
|------|------|
| パイ / 牌 | 麻雀牌（アニメ柄） |
| 加点役 | 役（得点条件） |
| ジャラ | 点数 |
| 撮影 | カメラで牌を撮影する行為 |
| 認識 | 撮影画像から牌を識別する処理 |

## 開発上の注意事項

- 画像認識はブラウザ内（クライアントサイド）で実行
- 外部サーバー不要のSPA構成を維持
- スマホ（iOS/Android）のみ対応
- ルールデータ（加点役・ジャラ）はJSONで管理し `app/static/` に配置
- 手牌は8-9枚（このゲーム固有のルール）
- 撮影から結果表示まで3秒以内が目標
- まずは動くもの優先、精度は後から改善
