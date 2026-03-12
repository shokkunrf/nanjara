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

## ビルド

本番用のビルドを作成

```sh
npm run build
```

ビルド結果をプレビュー

```sh
npm run preview
```
