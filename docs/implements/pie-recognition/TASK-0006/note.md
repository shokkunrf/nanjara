# TASK-0006: pHash計算モジュール実装 - TDD開発ノート

**作成日**: 2026-03-23
**タスク**: pie-recognition TASK-0006
**フェーズ**: Phase 2 - 認識エンジン

---

## 1. 技術スタック

### フレームワーク・言語
- **フレームワーク**: SvelteKit 2.50.2 + Svelte 5.51.0
- **言語**: TypeScript 5.9.3
- **ビルドツール**: Vite 7.3.1
- **テストフレームワーク**: Vitest 4.0.18 + Playwright 4.0.18（ブラウザテスト）
- **テスト環境**: Node.js（サーバー側テスト）+ Chromium（ブラウザテスト）

### 参照元
- docs/spec/pie-recognition/note.md
- docs/design/pie-recognition/architecture.md

---

## 2. 開発ルール

### プロジェクト固有のルール
- **言語**: パイ/タイル統一はpai（パイ）に統一
- **ハッシュ関数**: pHash（知覚ハッシュ）をDCTベースで実装
- **ハッシュ形式**: 64bit → 16進数文字列（16文字）
- **ハミング距離**: ビット単位での比較により距離計算
- **Canvas API使用**: Node.jsのsharpライブラリの代わりにブラウザ内で動作するよう実装
- **メモリ管理**: 画像処理後のリソースは必ず明示的に解放

### コーディング規約
- ESLint + Prettier で自動フォーマット
- Svelte 5 runes パターン（`$state`, `$props`）で状態管理
- TypeScript strict モード有効
- 関数は純粋関数（副作用なし）を基本とする

### TDD アプローチ
- Red-Green-Refactor サイクルを厳密に実施
- ユニットテストから開始（ブラウザテスト前）
- 100%の相互参照テストケース（品質保証）

### 参照元
- docs/design/pie-recognition/architecture.md
- docs/design/pie-recognition/design-interview.md

---

## 3. 関連実装

### 既存pHash実装の参照
- **参照**: tools/hasher/src/phash.ts
- **特徴**: Node.js版（sharp使用）のDCTベースpHash実装
- **ポイント**:
  - 32x32グレースケール → DCT → 8x8低周波 → 中央値比較 → 64bitハッシュ
  - `computePHash(imagePath)` → 16進数16文字
  - `hammingDistance(hash1, hash2)` → 整数距離値
  - DCT計算は1D-DCT（行→列）で実装
  - メモリ効率の考慮（配列のインプレース処理）

### 既存テストパターン
- **参照**: tools/hasher/src/phash.test.ts
  - 同一画像一致テスト
  - 異なる画像相違テスト
  - ハミング距離計算テスト（0, 64, 1ビット差）
  - 84枚パイの一意性テスト（ハッシュ衝突検査）
  - 見た目似ているペアの区別テスト

### 画像データ参照
- **パイ画像**: app/static/pai-images/ （84枚PNG, 174x236px）
- **事前処理済みハッシュ**: app/static/pai-hashes.json
- **パイメタデータ**: app/static/pai-details.json （name + yaku配列）

### サービス設計
- **参照**: docs/design/pie-recognition/architecture.md
  - app/src/lib/services/ にpHash計算サービスを実装
  - app/src/lib/services/phash.ts が本モジュール
  - app/src/lib/services/pai-recognizer.ts から参照される（後続TASK-0008）

### 参照元
- tools/hasher/src/phash.ts
- tools/hasher/src/phash.test.ts
- docs/design/pie-recognition/dataflow.md（パイ識別処理フロー）
- app/src/lib/services/opencv-loader.spec.ts（テストパターン参考）

---

## 4. 設計文書

### アーキテクチャ概要
- **名称**: パイ識別モジュール（認識エンジンの一部）
- **責務**: 画像のpHash計算とハミング距離マッチング
- **位置付け**: パイ検出後の識別処理（OpenCV.js → pHash）

### 画像認識パイプライン内での位置
```
撮影画像 → パイ検出（OpenCV.js） → 各パイ領域画像
                                      ↓
                              pHash計算（本モジュール）
                                      ↓
                              ハミング距離比較
                                      ↓
                              最近傍パイID取得
```

### データフロー
- **入力**: ImageData / Canvas要素（検出済みのパイ領域）
- **処理**:
  1. 画像をグレースケール化
  2. 32x32にリサイズ
  3. DCT（離散コサイン変換）を適用
  4. 8x8低周波成分を抽出
  5. 中央値と比較して64bitハッシュ生成
  6. ハミング距離計算で最近傍マッチング
- **出力**: パイID + 信頼度（ハミング距離の逆数）

### パフォーマンス要件
- **目標**: 撮影から認識結果表示まで3秒以内
- **本モジュール内**: 84回のハミング距離計算が1ms以下
- **事前処理**: 84枚のpHash値をJSON（~4KB）で事前計算・キャッシュ

### 参照元
- docs/design/pie-recognition/architecture.md
- docs/design/pie-recognition/dataflow.md

---

## 5. テスト関連情報

### テストフレームワーク設定
- **Vitest 4.0.18**: ユニットテスト実行
- **Playwright**: ブラウザ環境テスト（Chromium）
- **設定ファイル**: app/vite.config.ts
  - サーバー側テスト（Node環境）: `src/**/*.{test,spec}.ts`（Svelte除外）
  - クライアント側テスト: `src/**/*.svelte.{test,spec}.ts`

### テスト実行コマンド
```bash
npm run test:unit          # ユニットテスト実行（watch mode）
npm run test               # ユニットテスト実行（--run）
```

### 既存テストパターン参考
- **参照**: app/src/lib/services/opencv-loader.spec.ts
  - ブラウザテスト環境での非同期テスト
  - Mock/Stub パターン
  - Canvas APIを使用したテスト

### Canvas APIに関するテスト考慮事項
- **ImageData生成**: Canvas.toImageData() で取得
- **グレースケール処理**: ピクセル配列の直接操作
- **メモリ解放**: 画像処理後のリソース明示的削除
- **ブラウザ互換性**: Chromium基準（Safari/Firefoxの差異は考慮不要）

### テストケース設計基準
- **同一画像の一致**: 同じ入力で同じハッシュを出力
- **異なる画像の相違**: 異なる入力で異なるハッシュを出力
- **ハミング距離計算**:
  - 同一ハッシュ → 距離0
  - 完全異なる → 距離64（16進数16文字 × 4bit）
  - n-bitずれ → 距離n
- **品質テスト**: 84枚パイの相互区別（ハッシュ衝突なし）

### パフォーマンステスト
- 単一pHash計算: < 10ms
- 84回ハミング距離計算: < 1ms
- メモリ使用量: < 10MB

### 参照元
- app/vite.config.ts（テスト設定）
- app/package.json（test scripts）
- tools/hasher/src/phash.test.ts（テストケース参考）
- app/src/lib/services/opencv-loader.spec.ts（ブラウザテストパターン）

---

## 6. 注意事項

### 技術的制約

#### Canvas API の制限
- **色空間**: グレースケール化は手動で実装（Canvas filterは遅い）
- **メモリ**: 大きな画像は事前にリサイズ（認識処理前に縮小済み）
- **精度**: ImageData取得時のピクセルフォーマット（RGBA）に注意

#### DCT計算の負荷
- **計算量**: O(n^2) の計算（32x32 DCT は~1ms）
- **浮動小数演算**: Math.cos() 多用のため精度注意
- **最適化**: DFT（高速フーリエ変換）は不使用（32x32なら十分高速）

#### ハミング距離の効率性
- **16進数処理**: 文字単位での16進数変換（parseInt）のオーバーヘッド
- **ビット演算**: XOR（^）とポップカウント（bitwise count）で高速化

### データモデル設計

#### ハッシュデータ構造
- **形式**: 16進数16文字（64bit）
- **不変性**: 同じ画像入力 → 常に同じハッシュ
- **索引化**: pai-hashes.json で事前計算済み

#### 信頼度スコア
- **計算**: 64 - ハミング距離（距離0 → スコア64）
- **閾値**: 通常20以上なら同一パイ（要調整）
- **複数候補**: 距離が近い場合は複数候補を返す設計も考慮

### メモリ管理

#### Canvas ピクセルデータ
- **割り当て**: getImageData() で取得時に新規割り当て
- **解放**: 明示的な削除は不要（GC対象）
- **最適化**: 不要な中間配列は避ける

#### DCT中間バッファ
- **メモリ**: 32x32 × float64 = ~8KB（許容範囲）
- **GC**: JavaScript GC に任せる（特にブラウザ環境では問題なし）

### パフォーマンス最適化

#### 事前処理活用
- **pai-hashes.json**: 84枚分のpHashを事前計算
- **メモリ**: ~4KB のJSONデータをメモリにキャッシュ
- **ランタイム**: ハミング距離比較のみ（84回 × ~100ns）

#### バックグラウンド先読み
- **OpenCV.js WASM**: プレビュー画面表示時に先読みロード開始
- **pHash**: 認識時に初回計算（後続は キャッシュ）
- **目標**: 総認識時間 3秒以内（パイ検出 + pHash計算 + ジャラ計算）

### 参照元
- docs/design/pie-recognition/architecture.md（非機能要件）
- docs/spec/pie-recognition/requirements.md（パフォーマンス要件NFR-001）

---

## 7. 実装関連情報

### 前提タスク（依存）
- **TASK-0003**: 型定義追加（types.ts更新）
  - 参照: docs/tasks/pie-recognition/TASK-0003.md

### 後続タスク（依存される）
- **TASK-0008**: パイ認識エンジン実装
  - 本モジュール（phash.ts）を pai-recognizer.ts から参照
  - 参照: docs/tasks/pie-recognition/TASK-0008.md

### 関連タスク
- **TASK-0005**: OpenCV.jsローダー実装（パイ検出準備）
  - 検出後のパイ領域画像が本モジュールの入力
- **TASK-0004**: ルールデータ作成（ジャラ計算に使用）
- **TASK-0007**: パイ検出エンジン実装（本モジュールの入力元）

### 実装チェックリスト
- [ ] `app/src/lib/services/phash.ts` を新規作成
- [ ] 関数エクスポート: `computePhash(imageData)`, `hammingDistance()`, `findClosestMatch()`
- [ ] Canvas API を使用したグレースケール化（sharp不使用）
- [ ] DCT計算実装（1D-DCT → 2D-DCT）
- [ ] ハッシュ生成（中央値比較 → 16進数16文字）
- [ ] ハミング距離計算（最小距離検索）
- [ ] tools/hasher との互換性検証
- [ ] テストスイート完成（全ケース green）

### 参照元
- docs/tasks/pie-recognition/TASK-0003.md
- docs/tasks/pie-recognition/TASK-0005.md
- docs/tasks/pie-recognition/TASK-0007.md
- docs/tasks/pie-recognition/TASK-0008.md

---

## 8. 関連文書一覧

### 要件定義・仕様
- docs/spec/pie-recognition/requirements.md
- docs/spec/pie-recognition/user-stories.md
- docs/spec/pie-recognition/acceptance-criteria.md
- docs/spec/pie-recognition/note.md

### 設計文書
- docs/design/pie-recognition/architecture.md
- docs/design/pie-recognition/dataflow.md
- docs/design/pie-recognition/design-interview.md

### 関連タスク
- docs/tasks/pie-recognition/overview.md
- docs/tasks/pie-recognition/TASK-0001.md
- docs/tasks/pie-recognition/TASK-0003.md
- docs/tasks/pie-recognition/TASK-0004.md
- docs/tasks/pie-recognition/TASK-0005.md
- docs/tasks/pie-recognition/TASK-0007.md
- docs/tasks/pie-recognition/TASK-0008.md

### 既存実装参考
- tools/hasher/src/phash.ts（Node.js版pHash）
- tools/hasher/src/phash.test.ts（テストケース）
- app/src/lib/services/opencv-loader.ts（非同期ロード戦略）
- app/src/lib/services/opencv-loader.spec.ts（Vitest pattern）

### パイデータ
- app/static/pai-details.json（メタデータ）
- app/static/pai-hashes.json（事前計算済みpHash）
- app/static/pai-images/（84枚のPNG画像）

---

## 要件対応マッピング

| 要件ID | 要件概要 | 実装範囲 | 優先度 |
|--------|---------|--------|--------|
| REQ-002 | 検出した牌を84種類から識別する | パイ識別ロジック全体 | 必須 |
| REQ-301 | 牌画像を事前にハッシュ化して認識速度向上 | pHash計算 + 事前処理活用 | 必須 |
| NFR-001 | パフォーマンス：3秒以内 | ハミング距離計算の高速化 | 必須 |

---

## 開発開始時のチェックリスト

- [ ] tools/hasher/src/phash.ts を読み込み（移植元）
- [ ] Canvas API のグレースケール実装方法を確認
- [ ] DCT計算の数学的正確性を検証
- [ ] app/static/pai-images/ に84枚のPNG確認
- [ ] app/static/pai-hashes.json の形式確認
- [ ] Vitest + Playwright のセットアップ確認
- [ ] テストコードの骨組みを作成（Red フェーズ）
- [ ] TDD サイクル開始

---

**ノート作成完了**: 2026-03-23
**最終確認**: すべてのファイルパスを相対パスで記載済み
