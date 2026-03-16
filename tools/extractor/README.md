# extractor

公式説明書の画像からパイ画像を個別に切り出すツール。

## 使い方

```sh
npm install
npm start -- input/_page2.png ../../app/static/pai-images/
```

## 入力

説明書のパイ一覧ページ画像(5453x7665 PNG)

座標はこの画像レイアウトにハードコードされているため、別の画像を使う場合は `SERIES` の値を調整する必要がある。

## 出力

`<output-dir>`に84枚のPNG(174x236px)を出力する。

ファイル名: `{連番}_{シリーズ}_{名前}.png`  
シリーズ名は公式サイトURLを参考

```
001_livelive_muse.png       ... 011_livelive_nico.png
012_sunshine_aqours.png     ... 022_sunshine_ruby.png
023_nijigaku_doukoukai.png  ... 037_nijigaku_lanzhu.png
038_superstar_liella.png    ... 050_superstar_tomari.png
051_hasujo_club.png         ... 060_hasujo_izumi.png
061_musical_musical.png     ... 072_musical_sayaka.png
073_ikizu_ikizuraibu.png    ... 084_ikizu_shion.png
```
