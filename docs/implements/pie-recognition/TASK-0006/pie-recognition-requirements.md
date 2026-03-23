# TASK-0006: pHash計算モジュール実装 - TDD要件定義書

**作成日**: 2026-03-23
**タスクID**: TASK-0006
**要件名**: pie-recognition
**機能名**: pie-recognition
**フェーズ**: Phase 2 - 認識エンジン

---

## 1. 機能の概要

### 何をする機能か 🔵

ブラウザ内で動作するpHash（知覚ハッシュ）計算モジュール。撮影画像から検出されたパイ領域画像のpHashを計算し、事前処理済みの84種類のパイ参照ハッシュとハミング距離で比較することで、最も類似するパイを識別する。

- **参照したEARS要件**: REQ-002（検出した牌を84種類の中から識別）、REQ-301（事前にハッシュ化して認識速度向上）
- **参照した設計文書**: architecture.md「画像認識アーキテクチャ > パイ識別（Recognition）- pHash」

### どのような問題を解決するか 🔵

ゲーム中にスマホで撮影した手牌画像から個々のパイを識別する必要がある。84種類の固定パイ画像との1対Nマッチングにおいて、pHashによるハミング距離比較は軽量・高速であり、ブラウザ内での3秒以内の認識完了に貢献する。

- **参照したEARS要件**: NFR-001（3秒以内）、REQ-007（ブラウザ内で実行）

### 想定されるユーザー 🔵

本モジュールは内部サービスであり、直接のユーザーは `pai-recognizer.ts`（TASK-0008）である。最終的なエンドユーザーはゲーム中にパイの加点役・ジャラを確認したいプレイヤー。

- **参照したEARS要件**: REQ-002
- **参照した設計文書**: dataflow.md「機能2: 画像認識パイプライン」

### システム内での位置づけ 🔵

画像認識パイプラインの「パイ識別（Recognition）」段階を担当。パイ検出（OpenCV.js, TASK-0007）の後、切り出されたパイ領域画像を入力として受け取り、パイIDを出力する。

```
撮影画像 → パイ検出（OpenCV.js） → 各パイ領域画像
                                      ↓
                              pHash計算（本モジュール）
                                      ↓
                              ハミング距離比較
                                      ↓
                              最近傍パイID取得
```

- **参照した設計文書**: architecture.md「画像認識アーキテクチャ」、dataflow.md「機能2」

---

## 2. 入力・出力の仕様

### 関数1: `computePhash(imageData: ImageData): string` 🔵

#### 入力 🔵

| パラメータ | 型 | 説明 | 制約 |
|---|---|---|---|
| imageData | `ImageData` | パイ領域の切り出し画像データ | RGBA形式、任意サイズ（内部で32x32にリサイズ） |

- **参照したEARS要件**: REQ-002
- **参照した設計文書**: interfaces.ts `DetectedRegion.imageData`

#### 出力 🔵

| 型 | 説明 | 形式 |
|---|---|---|
| `string` | pHash値 | 16進数文字列、16文字（64bit） |

- **不変性**: 同一のImageData入力に対して常に同一のハッシュを返す
- **参照元**: tools/hasher/src/phash.ts の `computePHash()` と互換性のある出力形式

#### 処理フロー 🔵

1. ImageDataからグレースケール配列を生成（RGBA → 輝度値）
2. 32x32にリサイズ
3. 2D DCT（離散コサイン変換）を適用（1D-DCT: 行方向 → 列方向）
4. 左上8x8の低周波成分を取得（DC成分[0][0]を除く63要素）
5. 中央値を計算
6. 中央値と比較して64bitハッシュを生成（DC成分は常に0）
7. 2進数 → 16進数（16文字）に変換して返却

- **参照した設計文書**: tools/hasher/src/phash.ts（移植元アルゴリズム）

### 関数2: `hammingDistance(hash1: string, hash2: string): number` 🔵

#### 入力 🔵

| パラメータ | 型 | 説明 | 制約 |
|---|---|---|---|
| hash1 | `string` | 比較元pHash | 16進数16文字 |
| hash2 | `string` | 比較先pHash | 16進数16文字 |

#### 出力 🔵

| 型 | 説明 | 範囲 |
|---|---|---|
| `number` | ハミング距離 | 0（完全一致）~ 64（完全不一致） |

#### 処理フロー 🔵

1. 各文字（16進数1桁）をパースしてXOR
2. XOR結果のビットカウント（popcount）を加算
3. 全16文字分の合計を返却

- **参照元**: tools/hasher/src/phash.ts の `hammingDistance()` と完全互換

### 関数3: `findClosestMatch(hash: string, hashMap: PaiHashMap): { paiId: PaiId; distance: number }` 🔵

#### 入力 🔵

| パラメータ | 型 | 説明 | 制約 |
|---|---|---|---|
| hash | `string` | 識別対象のpHash | 16進数16文字 |
| hashMap | `PaiHashMap` | 参照用pHashマップ | `Record<PaiId, string>`、84エントリ |

- **参照した設計文書**: interfaces.ts `PaiHashMap`

#### 出力 🔵

| フィールド | 型 | 説明 |
|---|---|---|
| paiId | `PaiId` | 最も近いパイのID |
| distance | `number` | ハミング距離（0~64） |

#### 処理フロー 🔵

1. hashMapの全エントリに対してハミング距離を計算
2. 最小距離のエントリを特定
3. `{ paiId, distance }` を返却

- **参照したEARS要件**: REQ-002
- **参照した設計文書**: dataflow.md「パイ識別処理（pHash）」

### 入出力の関係性 🔵

```
DetectedRegion.imageData
    → computePhash() → hash (string)
    → findClosestMatch(hash, paiHashMap) → { paiId, distance }
    → RecognizedPai として結果に格納
```

- **参照した設計文書**: dataflow.md「機能2: 画像認識パイプライン」

---

## 3. 制約条件

### パフォーマンス要件 🔵

- **全体目標**: 撮影から認識結果表示まで3秒以内（NFR-001）
- **本モジュール内**:
  - 単一pHash計算: < 10ms 🟡 *タスクノートの推測値*
  - 84回ハミング距離計算: < 1ms 🔵 *整数演算のみで高速*
- **参照したEARS要件**: NFR-001

### 互換性要件 🔵

- tools/hasher/src/phash.ts のDCTベースpHashアルゴリズムと互換性のある出力を生成すること
- `hammingDistance()` は tools/hasher 版と完全に同一の結果を返すこと
- pai-hashes.json に格納された事前計算済みハッシュ値と比較可能であること
- **参照したEARS要件**: REQ-301（事前ハッシュ化）
- **参照した設計文書**: architecture.md「識別にpHashを選択した理由」

### プラットフォーム制約 🔵

- ブラウザ内で動作すること（Node.js依存の`sharp`ライブラリは使用不可）
- Canvas API を使用してグレースケール化・リサイズを実施
- iOS Safari / Android Chrome で動作すること
- **参照したEARS要件**: REQ-007（ブラウザ内実行）、REQ-401（SPA）、REQ-403（モバイルブラウザ）

### アーキテクチャ制約 🔵

- 実装ファイル: `app/src/lib/services/phash.ts`
- 純粋関数として実装（副作用なし）
- 外部ライブラリ依存なし（Canvas API + 数学関数のみ）
- 後続の `pai-recognizer.ts`（TASK-0008）から参照される
- **参照した設計文書**: architecture.md「ディレクトリ構造」

### メモリ制約 🟡

- DCT中間バッファ: 32x32 x float64 = ~8KB（許容範囲）
- Canvas ピクセルデータ: `getImageData()` で取得、GC対象（明示的解放不要）
- **参照した設計文書**: タスクノート「メモリ管理」セクション

### 数値精度制約 🟡

- DCT計算に `Math.cos()` を使用（浮動小数点演算）
- tools/hasher 版との完全一致には、同一の計算順序・精度が必要
- 32x32のサイズではFFTは不要（直接DCT計算で十分高速）
- **参照元**: tools/hasher/src/phash.ts の実装

---

## 4. 想定される使用例

### 基本的な使用パターン 🔵

#### パターン1: 単一パイのpHash計算と識別

```typescript
// パイ検出後の領域画像（DetectedRegion.imageData）
const hash = computePhash(detectedRegion.imageData);
const match = findClosestMatch(hash, paiHashMap);
// match.paiId: "003_livelive_honoka.png"
// match.distance: 3 (低い = 高類似度)
```

- **参照したEARS要件**: REQ-002

#### パターン2: 8-9枚の手牌の一括識別

```typescript
// 検出された8-9枚のパイ領域に対して順次計算
const results = detectedRegions.map(region => {
  const hash = computePhash(region.imageData);
  return findClosestMatch(hash, paiHashMap);
});
```

- **参照したEARS要件**: NFR-002（8-9枚同時認識）

### エッジケース 🟡

#### EDGE-1: 画像がブレている・暗い場合

- pHash計算自体は正常に完了するが、ハミング距離が大きくなる可能性
- `findClosestMatch` は常に最近傍を返す（距離閾値による棄却は本モジュールの責務外）
- **参照したEARS要件**: EDGE-001

#### EDGE-2: 非常に類似したパイ画像の区別

- 84種類のパイの中に視覚的に類似するペアが存在する可能性
- DCTベースpHashは色味・全体構造の違いを捉えるため、一定の区別は可能
- **参照元**: tools/hasher/src/phash.test.ts「見た目似ているペアの区別テスト」

#### EDGE-3: 極端に小さい・大きいImageData

- 内部で32x32にリサイズするため、入力サイズに依存しない
- ただし、極端に小さい画像（数ピクセル）ではリサイズによる情報喪失で精度低下の可能性 🔴 *設計文書にない推測*

### エラーケース 🟡

#### ERROR-1: hashMapが空の場合

- `findClosestMatch` に空のhashMapが渡された場合の振る舞い
- 設計文書に明示的な規定なし、実装時に決定 🔴 *設計文書にない推測*

#### ERROR-2: 不正なハッシュ文字列

- 16進数16文字でないハッシュが渡された場合の `hammingDistance` の振る舞い
- 現行の tools/hasher 版ではバリデーションなし 🟡 *tools/hasher 実装からの推測*

---

## 5. EARS要件・設計文書との対応関係

### 参照したユーザストーリー

- 手牌撮影 → 認識 → 加点役確認のフロー中、「認識」段階のパイ識別部分

### 参照した機能要件

- **REQ-002**: 検出した牌を84種類の中から識別する（本モジュールの主目的）
- **REQ-007**: すべての画像認識処理をブラウザ内で実行する（Canvas API使用）
- **REQ-301**: 牌画像を事前にハッシュ化して認識速度向上（pai-hashes.json活用）

### 参照した非機能要件

- **NFR-001**: 撮影から認識結果表示まで3秒以内
- **NFR-002**: 8-9枚の手牌を同時に認識

### 参照したEdgeケース

- **EDGE-001**: 撮影画像がブレている・暗すぎる場合の認識精度低下
- **EDGE-103**: 同じ種類の牌が複数枚ある場合の処理

### 参照した受け入れ基準

- phash.ts がexportされている
- tools/hasher との互換性が確認されている
- テストが通る

### 参照した設計文書

- **アーキテクチャ**: architecture.md「画像認識アーキテクチャ > パイ識別（Recognition）- pHash」「識別にpHashを選択した理由」「ディレクトリ構造」
- **データフロー**: dataflow.md「機能2: 画像認識パイプライン」「パイ識別処理（pHash）」
- **型定義**: interfaces.ts `PaiHashMap`, `DetectedRegion`, `RecognizedPai`, `PaiId`
- **移植元実装**: tools/hasher/src/phash.ts（DCTベースpHashアルゴリズム）
- **移植元テスト**: tools/hasher/src/phash.test.ts（テストケース設計の参考）

---

## 信頼性レベルサマリー

| レベル | 件数 | 割合 |
|---|---|---|
| 🔵 青信号 | 30 | 81% |
| 🟡 黄信号 | 5 | 14% |
| 🔴 赤信号 | 2 | 5% |

### 🔴 赤信号の項目（要確認）

1. **極端に小さいImageDataへの対応**: 数ピクセル程度の入力でのpHash精度（設計文書に規定なし）
2. **空のhashMapへの対応**: `findClosestMatch` に空データが渡された場合のエラーハンドリング（設計文書に規定なし）

---

**品質評価**: 高品質
