# nanjara

アニメ調の麻雀パイをスマートフォンのカメラで撮影し、画像認識で得点計算を行うモバイルWebアプリ。

## セットアップ

### 1. パイ画像の準備

`docs/official/manual_page2.png` に説明書の2ページ目の画像を配置し、パイ画像を切り出す。

```sh
npm --prefix tools/extractor i
npm --prefix tools/extractor start -- ../../docs/official/manual_page2.png ../../app/static/pai-images/
```

### 2. カタログ画像の生成

切り出したパイ画像からGemini API用のカタログ画像を生成する。

```sh
npm --prefix tools/catalog-generator i
npm --prefix tools/catalog-generator start -- ../../app/static/pai-images/ ../../app/src/lib/server/assets/
```

### 3. アプリのセットアップ

```sh
cd app
npm i
cp .env.template .env
# .env の GEMINI_API_KEY を設定
```

### 4. 開発サーバーの起動

```sh
npm run dev -- --host
```

## 精度チェック

`app/static/e2e/input/` にテスト画像を配置し、以下を実行する。

```sh
cd app
npm run build && npm run preview -- --host  # 別ターミナルで
npm run bench
```

## ディレクトリ構成

| ディレクトリ               | 説明                                      |
| -------------------------- | ----------------------------------------- |
| `app/`                     | SvelteKitアプリ本体（Vercelデプロイ対応） |
| `app/src/lib/server/`      | サーバー専用アセット（カタログ画像）      |
| `app/src/routes/api/`      | サーバーサイドAPIエンドポイント           |
| `app/scripts/`             | 精度チェックスクリプト                    |
| `tools/extractor/`         | ソース画像からパイ画像を切り出すツール    |
| `tools/catalog-generator/` | パイ画像からカタログ画像を合成するツール  |
| `docs/`                    | 仕様書・設計文書                          |
