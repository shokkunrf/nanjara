# TASK-0006: pHash計算モジュール - Redフェーズ記録

**作成日**: 2026-03-23
**タスクID**: TASK-0006
**要件名**: pie-recognition
**機能名**: pie-recognition
**フェーズ**: Red（失敗するテスト作成完了）

---

## 作成したテストケース一覧

| テストケースID | テスト名 | 対象関数 | 信頼性 |
|---|---|---|---|
| TC-001 | 同一ImageDataのpHash一致 | computePhash | 🔵 |
| TC-002 | pHashの出力形式が正しい | computePhash | 🔵 |
| TC-003 | 異なる画像の区別 | computePhash | 🔵 |
| TC-004 | 同一ハッシュのハミング距離 | hammingDistance | 🔵 |
| TC-005 | 完全不一致のハミング距離 | hammingDistance | 🔵 |
| TC-006 | 1ビット差のハミング距離 | hammingDistance | 🔵 |
| TC-007 | 既知のハッシュペアで正確な距離を返す | hammingDistance | 🔵 |
| TC-008 | 完全一致のパイ識別 | findClosestMatch | 🔵 |
| TC-009 | 最近傍パイの選択 | findClosestMatch | 🔵 |
| TC-010 | 異なるサイズの入力画像処理 | computePhash | 🟡 |
| TC-011 | 空のhashMapでのエラー処理 | findClosestMatch | 🔴 |
| TC-012 | 不正な長さのハッシュ文字列 | hammingDistance | 🟡 |
| TC-013 | 不正な文字を含むハッシュ文字列 | hammingDistance | 🟡 |
| TC-014 | 極小ImageDataの処理 | computePhash | 🔴 |
| TC-015 | ハミング距離の最小値（0） | hammingDistance | 🔵 |
| TC-016 | ハミング距離の最大値（64） | hammingDistance | 🔵 |
| TC-017 | 全黒画像のpHash計算 | computePhash | 🟡 |
| TC-018 | 全白画像のpHash計算 | computePhash | 🟡 |
| TC-019 | 最小サイズのhashMapでの最近傍探索 | findClosestMatch | 🟡 |
| TC-020 | 同一距離の複数候補がある場合 | findClosestMatch | 🟡 |
| TC-021 | DC成分（[0][0]）が常に0として扱われる | computePhash | 🔵 |

**合計**: 21テストケース

---

## テストコードの全文

**テストファイル**: `app/src/lib/services/phash.spec.ts`

（ファイルを直接参照のこと）

---

## 期待される失敗内容

テスト実行コマンド: `npm test -- phash.spec`

**失敗理由**: `app/src/lib/services/phash.ts` が未実装のため、以下のエラーが発生する：

```
Error: Cannot find module './phash.js' imported from 'app/src/lib/services/phash.spec.ts'
```

全21テストケースが実行前にモジュールが見つからずに失敗する。

---

## Greenフェーズで実装すべき内容

### 実装ファイル

`app/src/lib/services/phash.ts`

### 実装が必要な関数

#### 1. `computePhash(imageData: ImageData): string`

- **処理フロー**:
  1. ImageDataのRGBAピクセルをグレースケール値に変換（輝度 = 0.299R + 0.587G + 0.114B）
  2. バイリニアまたはニアレストネイバーで32x32にリサイズ
  3. 2D DCT-II を適用（1D-DCT: 行方向 → 列方向）
  4. 左上8x8の低周波成分を取得（DC成分[0][0]を除く63要素）
  5. 63要素の中央値を計算
  6. DC成分は常に'0'、残りは中央値比較でビット列を生成（64bit）
  7. 4ビットずつ16進数に変換して16文字の文字列を返す

- **参照実装**: `tools/hasher/src/phash.ts` の `computePHash()` と互換性のある出力

#### 2. `hammingDistance(hash1: string, hash2: string): number`

- **処理フロー**:
  1. 各文字（16進数1桁）をparseIntで整数に変換
  2. XOR演算
  3. XOR結果のビットカウント（ポップカウント）を加算
  4. 全16文字分の合計を返却

- **参照実装**: `tools/hasher/src/phash.ts` の `hammingDistance()` と完全互換

#### 3. `findClosestMatch(hash: string, hashMap: PaiHashMap): { paiId: PaiId; distance: number }`

- **処理フロー**:
  1. 空のhashMapチェック（エラーをスローする）
  2. hashMapの全エントリに対してhammingDistanceを計算
  3. 最小距離のエントリを特定
  4. `{ paiId, distance }` を返却

### 技術的注意事項

- **Canvas API使用**: Node.js の sharp は使用不可。ブラウザ用に Canvas API で実装
- **グレースケール化**: `luma = 0.299*R + 0.587*G + 0.114*B` または `(R + G + B) / 3`（tools/hasherと同一手法）
- **リサイズ**: Canvas 2D Context の drawImage を使用（OffscreenCanvas対応）
- **DCT**: `tools/hasher/src/phash.ts` の `dct1d()`, `dct2d()` を移植
- **テスト環境**: Node.js 環境では Canvas API が使えないため、ImageData を直接処理する純粋関数として実装すること

### 信頼性レベルサマリー

| レベル | 件数 | 割合 |
|---|---|---|
| 🔵 青信号 | 12 | 57% |
| 🟡 黄信号 | 7 | 33% |
| 🔴 赤信号 | 2 | 10% |

### 🔴 赤信号の要確認事項

1. **TC-011 (空hashMap)**: `throw new Error('hashMapが空です')` でエラースロー推奨
2. **TC-014 (極小ImageData)**: 1x1入力でもクラッシュしないこと（精度は問わない）

---

## 品質判定結果

**✅ 高品質**

- テスト実行: 失敗を確認（モジュール未実装エラー）
- 期待値: 明確で具体的
- アサーション: 適切
- 実装方針: 明確
- 信頼性レベル: 🔵（青信号）が多数（57%）
