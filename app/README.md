# nanjara

## 開発

依存パッケージをインストールし、開発サーバーを起動

```sh
npm install
npm run dev -- --host
```

## テスト

初回のみ以下を実行

```sh
playwright install --with-deps chromium
```

テストを実行

```sh
npm run test
```

## 認識精度チェック

preview サーバーを起動した状態で実行する。

```sh
npm run build && npm run preview -- --host
# 別ターミナルで
npm run bench
```

全テスト画像（`static/e2e/input/`）に対してアプリの認識フローを通し、正解率と処理時間を集計する。

## ビルド

本番用のビルドを作成

```sh
npm run build
```

ビルド結果をプレビュー

```sh
npm run preview
```
