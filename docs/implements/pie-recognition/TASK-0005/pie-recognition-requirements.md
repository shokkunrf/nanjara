# TASK-0005: OpenCV.jsローダー実装 要件定義書

**作成日**: 2026-03-20
**タスクID**: TASK-0005
**要件名**: pie-recognition
**機能名**: OpenCV.jsローダー（opencv-loader.ts）
**フェーズ**: Phase 2 - 認識エンジン

---

## 1. 機能の概要

### 何をする機能か 🔵

OpenCV.js（WASM ~8MB）をブラウザ上で遅延ロード・先読みするローダーモジュール。`preload()` でバックグラウンド先読みを開始し、`ensureLoaded()` でロード完了を保証する。

- **参照したEARS要件**: REQ-007（ブラウザ内で画像認識処理を実行）
- **設計ヒアリング**: Q6「OpenCV.js + pHash を採用。先読みロード戦略」

### どのような問題を解決するか 🔵

- OpenCV.js WASM（~8MB）の初回ダウンロードがボトルネックとなり、「認識する」ボタンタップ後の待ち時間が長くなる問題
- プレビュー画面表示時にバックグラウンドで先読みすることで、ユーザーが画像確認中にダウンロードを完了させる
- **参照したEARS要件**: NFR-001（撮影から認識結果表示まで3秒以内）

### 想定されるユーザー 🔵

- **直接利用者**: 後続モジュール（PaiDetector: TASK-0007）が OpenCV.js を使用する際に、本ローダー経由で初期化済みの cv オブジェクトを取得する
- **間接利用者**: CameraResult コンポーネントがプレビュー表示時に `preload()` を呼び出す

### システム内での位置づけ 🔵

画像認識パイプラインの最前段に位置する基盤モジュール。

```
[CameraResult] --preload()--> [opencv-loader.ts] --ensureLoaded()--> [PaiDetector]
                                      |
                                  @techstark/opencv-js (WASM ~8MB)
```

- **参照した設計文書**: docs/design/pie-recognition/architecture.md「画像認識アーキテクチャ」セクション
- **参照した設計文書**: docs/design/pie-recognition/dataflow.md「OpenCV.js ロード戦略」セクション

---

## 2. 入力・出力の仕様

### 入力パラメータ 🔵

#### `preload(): void`

- **パラメータ**: なし
- **呼び出しタイミング**: CameraResult（プレビュー画面）の表示時
- **戻り値**: `void`（非同期ロードを開始するだけで完了を待たない）

#### `ensureLoaded(): Promise<void>`

- **パラメータ**: なし
- **呼び出しタイミング**: 「認識する」ボタンタップ後、PaiDetector が OpenCV.js を使用する前
- **戻り値**: `Promise<void>`（ロード完了で resolve、失敗で reject）

### 出力値 🔵

- `preload()`: 戻り値なし。内部で動的 `import()` によるバックグラウンドロードを開始する
- `ensureLoaded()`: ロード完了時に resolve。ロード済みの場合は即座に resolve
- **副作用**: OpenCV.js がグローバルスコープ（`cv` オブジェクト）で利用可能になる

### 入出力の関係性 🔵

```
preload() → 内部 Promise 生成（バックグラウンドロード開始）
                ↓
ensureLoaded() → 同じ Promise を await（先読み完了済みなら即座に返却）
                ↓
            cv オブジェクトが利用可能
```

### データフロー 🔵

- **参照元**: docs/design/pie-recognition/dataflow.md「OpenCV.js ロード戦略」

1. CameraResult 画面表示 → `preload()` 呼び出し
2. 動的 `import('@techstark/opencv-js')` でWASMダウンロード開始
3. ユーザーが「認識する」タップ → `ensureLoaded()` 呼び出し
4. 先読み完了済みならば即座に返却、未完了なら待機
5. 後続の PaiDetector が `cv` オブジェクトを使用

- **参照したEARS要件**: REQ-007, NFR-001
- **参照した設計文書**: docs/design/pie-recognition/dataflow.md「OpenCV.js ロード戦略」シーケンス図

---

## 3. 制約条件

### パフォーマンス要件 🔵

- OpenCV.js WASM（~8MB）はプレビュー画面表示時にバックグラウンドで先読み開始し、「認識する」ボタンタップ時に利用可能とする
- 2回目以降のロードはブラウザキャッシュから即座に完了する
- **参照元**: NFR-001（3秒以内）, architecture.md「パフォーマンス（3秒以内）」

### アーキテクチャ制約 🔵

- **SPA構成**: 外部サーバー通信なし（REQ-401）。WASMファイルはnpmパッケージ `@techstark/opencv-js` 経由で配信
- **モジュール形式**: `app/src/lib/services/opencv-loader.ts` にESモジュールとしてエクスポート
- **DIパターン不使用**: SPAのためサービスインターフェースは定義しない。テスト時は `vi.mock()` で対応
- **参照元**: architecture.md「アーキテクチャパターン」、design-interview.md Q22

### ブラウザ互換性要件 🔵

- iOS Safari / Android Chrome で動作すること（REQ-403）
- WASM対応ブラウザであること
- **参照元**: REQ-403, NFR-101

### エラー処理要件 🟡

- WASMロード失敗時のエラーハンドリング（ネットワークエラー、WASMコンパイルエラー等）
- エラー発生後のリトライ可能性（状態リセット）
- **参照元**: dataflow.md「エラーハンドリングフロー」（OpenCV.jsロード失敗ケース）
- **推測根拠**: タスク定義に「エラー時の処理（ロード失敗）🟡」と記載あり。具体的なエラーハンドリング方針は設計文書に詳細がないため推測

### キャッシュ要件 🔵

- 2回目以降の `preload()` / `ensureLoaded()` はキャッシュから即座に返す（冪等性）
- 同時に複数箇所から呼ばれても、ロード処理は1回のみ実行される
- **参照元**: TASK-0005タスク定義「2回目以降はキャッシュから即座に返す 🔵」

- **参照したEARS要件**: REQ-007, REQ-401, REQ-403, NFR-001
- **参照した設計文書**: architecture.md「パフォーマンス」「プラットフォーム制約」セクション

---

## 4. 想定される使用例

### 基本的な使用パターン 🔵

#### パターン1: 正常フロー（先読み完了後に使用）

```
1. CameraResult 画面表示
2. preload() 呼び出し → バックグラウンドロード開始
3. （ユーザーが画像を確認中、数秒経過）
4. ユーザーが「認識する」タップ
5. ensureLoaded() 呼び出し → 即座に resolve（先読み完了済み）
6. PaiDetector が cv オブジェクトを使用
```

- **参照元**: dataflow.md「OpenCV.js ロード戦略」シーケンス図

#### パターン2: 正常フロー（先読み未完了で使用）

```
1. CameraResult 画面表示
2. preload() 呼び出し → バックグラウンドロード開始
3. （ユーザーが即座に「認識する」タップ）
4. ensureLoaded() 呼び出し → ロード完了まで待機
5. ロード完了 → resolve
6. PaiDetector が cv オブジェクトを使用
```

- **参照元**: dataflow.md「OpenCV.js ロード戦略」の alt 分岐

#### パターン3: キャッシュ済みフロー（2回目以降）

```
1. CameraResult 画面表示（2回目の撮影）
2. preload() 呼び出し → 何もしない（既にロード済み）
3. ensureLoaded() 呼び出し → 即座に resolve
```

- **参照元**: TASK-0005タスク定義「2回目以降はキャッシュから即座に返す」

### エッジケース 🟡

#### エッジケース1: ロード失敗

```
1. preload() 呼び出し → ネットワークエラーでロード失敗
2. ensureLoaded() 呼び出し → reject（エラー throw）
3. 呼び出し元がエラーハンドリング（「画像処理エンジンの読み込みに失敗しました」表示）
4. 再度 preload() → リトライ可能（失敗状態がリセットされる）
```

- **推測根拠**: dataflow.md「エラーハンドリングフロー」に「ロード失敗 → 再撮影を促す」の記載あり。リトライ方式の詳細は推測

#### エッジケース2: preload() を呼ばずに ensureLoaded()

```
1. ensureLoaded() を直接呼び出し
2. 内部で自動的にロード開始 → ロード完了まで待機 → resolve
```

- **推測根拠**: 防御的プログラミングとして妥当。設計文書に明示なし

#### エッジケース3: 複数箇所から同時に preload() / ensureLoaded()

```
1. 複数コンポーネントから同時に preload() が呼ばれる
2. ロード処理は1回のみ実行（同一 Promise を共有）
3. すべての ensureLoaded() が同じ Promise を await
```

- **推測根拠**: 冪等性の要件（TASK-0005タスク定義）から妥当な推測

### エラーケース 🟡

- **ネットワークエラー**: WASM ダウンロード失敗（オフライン、タイムアウト等）
- **WASMコンパイルエラー**: ブラウザのWASM対応不足等
- **メモリ不足**: 低スペック端末でのWASMメモリ確保失敗

- **参照元**: dataflow.md「エラーハンドリングフロー」
- **推測根拠**: 一般的なWASMロードの障害パターン

---

## 5. EARS要件・設計文書との対応関係

### 参照したユーザストーリー

- ストーリー1.1: 手牌を撮影して加点役・ジャラを確認する

### 参照した機能要件

- **REQ-001**: 撮影画像から牌を検出しなければならない（本ローダーは検出の前提条件）
- **REQ-007**: すべての画像認識処理をブラウザ内で実行しなければならない（WASM利用の根拠）

### 参照した非機能要件

- **NFR-001**: 撮影から認識結果表示まで3秒以内（先読みロード戦略の根拠）
- **NFR-101**: カメラアクセスはHTTPS環境でのみ動作

### 参照したEdgeケース

- （直接対応するEdgeケースなし。エラーハンドリングは一般的なWASMロードパターンから推測）

### 参照した受け入れ基準

- opencv-loader.ts がエクスポートされている
- preload / ensureLoaded が動作する
- テストが通る

### 参照した設計文書

- **アーキテクチャ**: docs/design/pie-recognition/architecture.md
  - 「画像認識アーキテクチャ」セクション（OpenCV.js選択理由、先読みロード）
  - 「パフォーマンス（3秒以内）」セクション
  - 「ディレクトリ構造」セクション（`app/src/lib/services/opencv-loader.ts`）
- **データフロー**: docs/design/pie-recognition/dataflow.md
  - 「OpenCV.js ロード戦略」シーケンス図
  - 「エラーハンドリングフロー」
  - 「非同期処理」セクション
- **型定義**: docs/design/pie-recognition/interfaces.ts
  - （本タスクは型定義の追加不要。既存型への影響なし）
- **設計ヒアリング**: docs/design/pie-recognition/design-interview.md
  - Q6: OpenCV.js + pHash 採用決定、先読みロード戦略
  - Q22: サービスインターフェース不要（DIなしSPA）

---

## 6. 実装仕様（テスト設計用）

### 公開API 🔵

| 関数 | シグネチャ | 説明 |
|------|-----------|------|
| `preload` | `() => void` | OpenCV.js WASMのバックグラウンドロードを開始 |
| `ensureLoaded` | `() => Promise<void>` | ロード完了を保証（未ロードなら待機） |

### 内部状態 🔵

- ロード状態: `未ロード` / `ロード中` / `ロード完了` / `エラー`
- ロード Promise のキャッシュ（冪等性保証）

### 配置先 🔵

- `app/src/lib/services/opencv-loader.ts`

### テストファイル 🔵

- `app/src/lib/services/opencv-loader.spec.ts`（Vitest、serverプロジェクト）

### 依存パッケージ 🔵

- `@techstark/opencv-js` 4.12.0-release.1（package.json に追加済み）

---

## 信頼性レベルサマリー

| レベル | 件数 | 割合 |
|--------|------|------|
| 🔵 青信号 | 22件 | 85% |
| 🟡 黄信号 | 4件 | 15% |
| 🔴 赤信号 | 0件 | 0% |

### 🟡 黄信号の項目

1. **エラー処理要件**: WASMロード失敗時の具体的なハンドリング方針（リトライ方式等）
2. **エッジケース1（ロード失敗）**: リトライ時の状態リセット方式
3. **エッジケース2（preload未呼び出し）**: ensureLoaded単独呼び出し時の振る舞い
4. **エラーケース**: 具体的なエラー種別と対応方針

### 品質評価

**高品質**: EARS要件定義書・設計文書（特にdataflow.mdのOpenCV.jsロード戦略シーケンス図）に詳細な記載があり、推測箇所は限定的。エラーハンドリングの詳細のみ黄信号。
