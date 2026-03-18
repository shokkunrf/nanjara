# TASK-0004 設定作業実行

## 作業概要

- **タスクID**: TASK-0004
- **作業内容**: `app/static/rules.json` の作成（加点役・ジャラ定義データ）
- **実行日時**: 2026-03-17
- **フェーズ**: Phase 1 - 基盤構築

## 設計文書参照

- **参照文書**:
  - `docs/design/pie-recognition/architecture.md`
  - `docs/design/pie-recognition/dataflow.md`
  - `docs/design/pie-recognition/interfaces.ts`
  - `docs/design/pie-recognition/design-interview.md`
  - `app/static/pai-details.json`（yaku配列から加点役を網羅）
  - `docs/official/manual_page2.png`（公式ルールマニュアル）
- **関連要件**: REQ-006, REQ-402

## 実行した作業

### 1. yaku一覧の抽出

`app/static/pai-details.json` から全パイのyaku配列を集計し、48種類のyakuと出現数を確認した。

```
国士無双: 14枚（各グループの代表パイ2枚ずつ）
ラブライブ！系作品: 11-15枚
大グループ（μ's/Aqours/Liella!等）: 10-12枚
サブユニット（Printemps/BiBi等）: 3枚
蓮ノ空ユニット（スリーズブーケ等）: 2枚
学年: 1年生14枚/2年生19枚/3年生17枚
誕生月: 2-5枚
主人公: 5枚（各作品の主人公キャラ）
```

### 2. ルール設計方針

設計文書 `design-interview.md` のQ16-Q17の確定事項と、`dataflow.md` の判定ロジック例を基準に以下の方針でルールを策定した:

| カテゴリ | requiredCount | jara | 根拠 |
|---------|--------------|------|------|
| 国士無双 | 8 | 100 | 設計文書の例示値（最高難度・最高得点） |
| 主人公 | 2 | 50 | 5枚しかないレア役 |
| 作品系（ラブライブ！系7作品） | 4 | 30 | 作品内パイが11-15枚あり現実的 |
| 大グループ（μ's/Aqours等） | 2 | 10 | 設計文書の例示値 |
| サブユニット3枚（Printemps等） | 2 | 15 | 設計文書の例示値 |
| 蓮ノ空ユニット2枚（スリーズブーケ等） | 2 | 20 | 全枚数が2枚のため高ジャラ |
| 学年系 | 3 | 10 | パイ数が多く取りやすい役 |
| 誕生月系 | 2 | 5 | パイ数が少なく低難度な役 |

### 3. rules.json 作成

**作成ファイル**: `app/static/rules.json`

`ScoringRule[]` 形式（`[{name, requiredCount, jara}]`）で48件の加点役を定義した。

```json
[
  { "name": "国士無双", "requiredCount": 8, "jara": 100 },
  { "name": "主人公", "requiredCount": 2, "jara": 50 },
  { "name": "ラブライブ！", "requiredCount": 4, "jara": 30 },
  ...（48件合計）
]
```

**加点役の分類**:

| 分類 | 件数 |
|-----|-----|
| 特殊（国士無双・主人公） | 2件 |
| 作品系（ラブライブ！系7作品） | 7件 |
| 大グループ（μ's/Aqours/Liella!/Musical/いきづらい部!） | 5件 |
| サブユニット（Printemps/BiBi/lily white等） | 12件 |
| 蓮ノ空ユニット（スリーズブーケ/DOLLCHESTRA等） | 4件 |
| 学年（1-3年生） | 3件 |
| 誕生月（1-12月生まれ） | 12件 |
| その他（クーカー/トマカノーテ） | 3件 |
| **合計** | **48件** |

### 4. ビルド確認

```bash
cd app && npm run build
# ✓ built in 3.12s
```

## 作業結果

- [x] `app/static/rules.json` が ScoringRule[] 形式で存在する
- [x] 48件（30件以上）の加点役が定義されている
- [x] name が `pai-details.json` の yaku 配列の値と一致
- [x] ビルドが通る

## 次のステップ

- `/tsumiki:direct-verify` を実行して設定を確認
- TASK-0009（ScoringEngine実装）でこのルールデータを活用
- TASK-0014（ルール一覧画面）でこのルールデータを表示
