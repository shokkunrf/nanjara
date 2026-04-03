# extractor

切り出したパイ画像からGeminiに送信する用のカタログ画像を合成するツール。

## 使い方

```sh
npm install
npm start -- <PAI_IMAGES_DIR> <OUTPUT_DIR>
```

- `PAI_IMAGES_DIR`: パイ画像が格納されたディレクトリ
- `OUTPUT_DIR`: カタログ画像の出力先ディレクトリ

例:

```sh
npm start -- ../../app/static/pai-images ../../app/static
```

## 出力

`OUTPUT_DIR` に `pai-catalog-{番号}.png` を出力する。各カタログは21枚ずつ、7列×3行のスプライトシートで、各セルにIDラベルが付く。
