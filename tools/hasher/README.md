# pai-hasher

パイ画像のpHash（知覚ハッシュ）を事前計算するツール。

`tools/extractor/output/` の84枚のPNG画像からpHashを計算し、`app/static/pais/hashes.json` に出力する。アプリのパイ識別処理（ハミング距離比較）で参照データとして使用される。

## 使い方

```bash
cd tools/hasher
npm install

# デフォルト（extractor/output/ → app/static/pais/hashes.json）
npm start

# 入出力を指定
npm start -- --input /path/to/images --output /path/to/hashes.json
npm start -- -i /path/to/images -o /path/to/hashes.json
```

```bash
# テスト

npm test
```

### オプション

| オプション | 短縮 | 説明                        | デフォルト                    |
| ---------- | ---- | --------------------------- | ----------------------------- |
| `--input`  | `-i` | 入力ディレクトリ（PNG画像） | `tools/extractor/output/`     |
| `--output` | `-o` | 出力ファイルパス            | `app/static/pais/hashes.json` |
| `--help`   | `-h` | ヘルプ表示                  | -                             |

## 出力形式

```json
{
  "001_muse_muse.png": "3f43248ef0e0cd9c",
  "002_muse_otonokizaka.png": "3e4fd4e7807cc094",
  ...
}
```

各エントリは `ファイル名: 16文字の16進数pHash` の形式。

## アルゴリズム

pHash（DCTベース知覚ハッシュ）:

1. 画像を32x32にリサイズ
2. グレースケール変換
3. 2D DCT（離散コサイン変換）を適用
4. 左上8x8の低周波成分を取得
5. 中央値と比較して64bitハッシュを生成

### 実測

衝突（距離0）はなし。84枚すべて区別可能です。

最も近いペア上位5件：

| 距離 | パイA                    | パイB               |
| ---- | ------------------------ | ------------------- |
| 8    | 音ノ木坂学院(エンブレム) | Musical(エンブレム) |
| 10   | 高坂穂乃果               | 星空凛              |
| 10   | 高坂穂乃果               | 三船美鈴            |
| 10   | 園田海未                 | 東條希              |
| 10   | 星空凛                   | 小泉花陽            |

最小ハミング距離は8。64bitのうち8bit差なので約87%一致しています。実際のマッチングでは撮影画像のpHashと84枚を比較して最小距離を選ぶので、撮影画像のpHashが参照データ±4bit以内に収まれば正しく識別できます。距離8の余裕があるので現時点では問題なしです。
