# TASK-0006: pHash計算モジュール - Greenフェーズ記録

**作成日**: 2026-03-23
**タスクID**: TASK-0006
**要件名**: pie-recognition
**機能名**: pie-recognition
**フェーズ**: Green（最小実装完了）

---

## 実装方針と判断理由

### 基本方針

`tools/hasher/src/phash.ts`（Node.js版）のアルゴリズムを、Canvas APIを使わない純粋関数として移植した。

**理由**:
- テスト環境（Node.js）ではCanvas APIが使えない
- tools/hasher版のアルゴリズムは既に動作実績があり、DCT実装が正確
- 純粋関数にすることでテストしやすく、副作用がない

### 主要な実装判断

| 判断事項 | 採用した実装 | 理由 |
|---|---|---|
| リサイズ方式 | バイリニア補間 | Canvas APIなしで実装可能、品質と速度のバランス |
| グレースケール変換 | ITU-R BT.601 (0.299R+0.587G+0.114B) | tools/hasherのsharp.grayscale()と同等 |
| DCT計算 | 1D-DCT(行)→1D-DCT(列) の分離可能DCT | tools/hasher版を直接移植 |
| 空hashMapエラー | `throw new Error(...)` | TC-011の要求（エラーをスロー）に従う |
| 不正ハッシュ | NaN時はスキップ（0として扱う） | TC-012/013：NaN伝播を防ぐ |

---

## 実装コードの説明

### ファイル: `app/src/lib/services/phash.ts`

#### エクスポートする関数

1. **`computePhash(imageData: ImageData): string`**
   - RGBA→グレースケール変換（`toGrayscale`）
   - バイリニア補間で32x32にリサイズ（`resizeBilinear`）
   - 2D DCT計算（`dct2d`）
   - 8x8低周波成分抽出（DC成分を除く63要素）
   - 中央値比較で64bitビット列生成
   - 16進数16文字に変換して返却

2. **`hammingDistance(hash1: string, hash2: string): number`**
   - 各文字をXOR演算
   - ビットカウント（ポップカウント）で距離計算
   - NaN安全処理付き

3. **`findClosestMatch(hash: string, hashMap: PaiHashMap): { paiId: PaiId; distance: number }`**
   - 空hashMapはエラーをスロー
   - 全エントリとのハミング距離を計算
   - 最小距離のエントリを返却（同一距離は先着優先）

#### 内部ユーティリティ関数

- `toGrayscale`: RGBA → 輝度値変換（ITU-R BT.601）
- `resizeBilinear`: バイリニア補間リサイズ（Canvas API代替）
- `dct2d`: 2D DCT（行→列の分離可能DCT）
- `dct1d`: 1D DCT-II（tools/hasher版を直接移植）

---

## テスト実行結果

```
Test Files: 1 passed (1)
Tests:      21 passed (21)
```

全21テストケースが通過した。

| テストスイート | テスト数 | 結果 |
|---|---|---|
| computePhash - 正常系 | 3 | ✅ 全pass |
| computePhash - 異なるサイズ入力 | 1 | ✅ pass |
| computePhash - DC成分 | 1 | ✅ pass |
| hammingDistance - 正常系 | 4 | ✅ 全pass |
| hammingDistance - 境界値 | 2 | ✅ 全pass |
| findClosestMatch - 正常系 | 2 | ✅ 全pass |
| findClosestMatch - 境界値 | 2 | ✅ 全pass |
| findClosestMatch - 異常系 | 1 | ✅ pass |
| hammingDistance - 異常系 | 2 | ✅ 全pass |
| computePhash - 境界値 | 3 | ✅ 全pass |

---

## 品質評価

**✅ 高品質**

| 評価項目 | 評価 |
|---|---|
| テスト成功状況 | 21/21 全て成功 |
| 実装のシンプルさ | tools/hasher の直接移植で明確 |
| リファクタリング箇所 | バイリニアリサイズの最適化, DCT係数キャッシュ化 |
| 機能的問題 | なし |
| ファイルサイズ | 303行（800行制限内） |
| モック使用 | 実装コードにモック・スタブなし |

---

## 課題・改善点（Refactorフェーズで対応）

### パフォーマンス最適化候補

1. **DCT計算のキャッシュ化**: `Math.cos()` の計算結果をルックアップテーブルに変換することで高速化可能
2. **バイリニアリサイズの最適化**: 計算の順序や中間配列の削減
3. **型安全性の強化**: `PaiId` の型ガード追加

### コードスタイル改善候補

1. 定数のより明確な命名
2. 内部関数のJSDoc詳細化

---

**Green フェーズ完了**: 2026-03-23
