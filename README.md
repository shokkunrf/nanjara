# nanjara

アニメ調の麻雀パイをスマートフォンのカメラで撮影し、画像認識で得点計算を行うモバイルWebアプリ。

## セットアップ

`docs/official/manual_page2.png` にパイ画像のソースとなる画像を配置する。

```sh
npm --prefix tools/extractor i
npm --prefix tools/extractor start -- ../../docs/official/manual_page2.png ../../app/static/pai-images/

npm --prefix tools/hasher i
npm --prefix tools/hasher start -- ../../app/static/pai-images/ ../../app/static/pai-hashes.json

npm --prefix app i
```

アプリの開発・テスト・ビルドについては [app/README.md](app/README.md) を参照。

## ディレクトリ構成

| ディレクトリ       | 説明                                   |
| ------------------ | -------------------------------------- |
| `app/`             | SvelteKitアプリ本体                    |
| `tools/extractor/` | ソース画像からパイ画像を切り出すツール |
| `tools/hasher/`    | パイ画像のpHashを事前計算するツール    |
| `docs/`            | 仕様書・設計文書                       |
