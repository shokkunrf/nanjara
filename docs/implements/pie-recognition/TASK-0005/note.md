# TASK-0005 パイ認識アプリ - OpenCV.js ローダー実装 コンテキストノート

**作成日**: 2026-03-20
**要件**: pie-recognition TASK-0005
**関連タスク**: TASK-0003（型定義）, TASK-0004（ルールデータ）

---

## 1. 技術スタック

### フレームワーク・ライブラリ
- **フレームワーク**: SvelteKit 2.50.2 + Svelte 5.51.0
- **言語**: TypeScript 5.9.3
- **ビルド・実行環境**: Vite 7.3.1, Node.js v24（TS直接実行可能）
- **画像処理**: OpenCV.js 4.12.0-release.1（npm: @techstark/opencv-js）
- **テスト**: Vitest 4.0.18 + Playwright
- **コード品質**: ESLint 9.39.2, Prettier 3.8.1, svelte-check 4.4.2

### 参照元
- app/package.json

---

## 2. 開発ルール

### プロジェクト固有ルール
- **言語規約**: ユビキタス言語に従う（パイ/牌, 加点役, ジャラ, 認識）
- **ファイル命名**: 相対パス（プロジェクトルート基準）で記載
- **コミットメッセージ**: Co-Authored-Byは不要
- **テスト**: Vitest + Playwright（ブラウザテスト）
- **手牌枚数**: 8-9枚（ゲーム固有ルール）
- **処理時間目標**: 撮影完了から認識結果表示まで3秒以内
- **実行環境**: SPAのためブラウザ内（クライアントサイド）で全処理完結

### アーキテクチャルール
- **SPA構成**: 外部サーバー通信なし、ブラウザ内で画像認識・役判定・計算すべて実行
- **パイ画像データ**: tools/extractor/output/ → app/static/pai-images/ へ配置
- **メタデータ**: pai-details.json（ファイル名→名前・役リスト），pai-hashes.json（pHash値）
- **ルールデータ**: app/static/rules.json（JSON形式，REQ-006）

### 参照元
- docs/spec/pie-recognition/requirements.md
- docs/spec/pie-recognition/note.md
- docs/spec/pie-recognition/user-stories.md

---

## 3. 関連実装

### カメラ撮影機能（実装済み）
- **ファイル**: app/src/lib/components/camera/
  - Camera.svelte: 状態管理（capture/preview モード）
  - CameraCapture.svelte: getUserMedia，背面カメラ撮影（1920x1080，JPEG 0.92品質）
  - CameraResult.svelte: 撮影画像プレビュー＋再撮影ボタン
  - CameraLayout.svelte: Svelte 5 snippet活用の共通レイアウト
- **戻るボタンハンドリング**: app/src/routes/+layout.svelte（2タップで終了）

### 型定義（TASK-0003で整備済み）
- **ファイル**: app/src/lib/types.ts
- **主要型**:
  - `PaiDetail`: {name: string, yaku: string[]}
  - `PaiDetailMap`: Record<PaiId, PaiDetail>
  - `PaiHashMap`: Record<PaiId, string>（pHash値）
  - `DetectedRegion`: バウンディングボックス＋切り出し画像
  - `RecognizedPai`: {paiId: string, confidence: number}
  - `RecognitionResult`: {pais: RecognizedPai[], processingTimeMs: number}
  - `ScoringRule`: {name: string, requiredCount: number, jara: number}

### パイデータ構造
- **pai-details.json** (app/static/):
  ```json
  {
    "001_livelive_muse.png": {
      "name": "μ's",
      "yaku": ["ラブライブ！", "μ's", "国士無双"]
    },
    "003_livelive_honoka.png": {
      "name": "高坂穂乃果",
      "yaku": ["ラブライブ！", "μ's", "Printemps", "2年生", "8月生まれ", "主人公"]
    },
    ...（84件）
  }
  ```
- **pai-hashes.json** (app/static/): pHash値の辞書
- **pai-images/** (app/static/): 84枚のPNG（106x143px）

### ルールデータ（TASK-0004で作成済み）
- **ファイル**: app/static/rules.json
- **形式**: ScoringRule[] = [{name, requiredCount, jara}, ...]
- **件数**: 48種類の加点役
- **例示**:
  ```json
  [
    { "name": "国士無双", "requiredCount": 8, "jara": 100 },
    { "name": "主人公", "requiredCount": 2, "jara": 50 },
    { "name": "ラブライブ！", "requiredCount": 4, "jara": 30 },
    { "name": "μ's", "requiredCount": 2, "jara": 10 },
    ...
  ]
  ```

### 参照元
- app/src/lib/types.ts
- app/static/pai-details.json
- app/static/rules.json
- docs/implements/pie-recognition/TASK-0003/setup-report.md
- docs/implements/pie-recognition/TASK-0004/setup-report.md

---

## 4. 設計文書

### アーキテクチャ
- **パイプライン**:
  1. 撮影画像の取得（Camera.svelte）
  2. OpenCV.jsで牌検出（PaiDetector）← **TASK-0005で実装**
  3. pHashで牌識別（PaiRecognizer）
  4. 役判定・ジャラ計算（ScoringEngine）
  5. 結果表示（/result ルート）

- **参照元**: docs/design/pie-recognition/

### 型定義・データフロー
- **参照元**:
  - docs/design/pie-recognition/interfaces.ts
  - docs/design/pie-recognition/dataflow.md

### 要件定義（抜粋）
- **REQ-001**: 撮影画像から牌を検出しなければならない 🔵
- **REQ-002**: 検出した牌を84種類から識別しなければならない 🔵
- **REQ-007**: すべての画像認識をブラウザ内（クライアントサイド）で実行しなければならない 🔵
- **NFR-001**: 撮影から認識結果表示まで3秒以内 🔵
- **NFR-002**: 8-9枚の手牌を同時に認識できなければならない 🔵

---

## 5. テスト関連情報

### テストフレームワーク
- **ユニットテスト**: Vitest 4.0.18
- **ブラウザテスト**: Playwright + vitest-browser-svelte
- **テスト設定**: app/vite.config.ts
  - 2つのプロジェクト: client（Playwright），server（Node）
  - client: include = `src/**/*.svelte.{test,spec}.{js,ts}`
  - server: include = `src/**/*.{test,spec}.{js,ts}` (ただし svelte.spec.ts除外)

### 既存テストのパターン
- **Svelteコンポーネントテスト**: `*.svelte.spec.ts`
  - vitest-browser-svelte の render()を使用
  - page.getByText(), page.getByRole() で要素選択
  - expect.element() で検証
  - vi.fn(), vi.spyOn() でモック
  - 例: app/src/lib/components/camera/CameraCapture.svelte.spec.ts

- **ユニットテスト**: `*.spec.ts`
  - describe/it/expect の基本構文
  - 例: app/src/demo.spec.ts

### テストディレクトリ構成
- テストファイルはソースと同じディレクトリに配置
- ファイル名パターン: `<module>.spec.ts` or `<component>.svelte.spec.ts`

### 参照元
- app/vite.config.ts
- app/src/lib/components/camera/CameraCapture.svelte.spec.ts
- app/src/demo.spec.ts
- app/package.json

---

## 6. 注意事項

### 技術的制約
- **ブラウザ環境**: OpenCV.js はブラウザで動作することを前提
- **HTTPS要件**: カメラアクセスはHTTPS必須（ブラウザ制約）
- **モバイルのみ対応**: iOS/Android スマートフォンの WebView対応
- **ネットワーク**: オフライン環境でも動作（外部通信なし）

### パフォーマンス要件
- **処理時間**: 撮影から結果表示まで3秒以内（NFR-001）
- **同時認識数**: 8-9枚の手牌を同時認識（NFR-002）
- **メモリ効率**: DetectedRegion の imageData は認識完了後に破棄

### セキュリティ
- **撮影画像**: 外部に送信しない，ブラウザ内でのみ処理
- **プライバシー**: カメラアクセスはHTTPS環境のみ

### アーキテクチャ選択
- **Direct Image Matching方式**: 牌画像を直接比較（pHash）
- **ベクトル化/ハッシュ化**: 速度向上が必要な場合に後々実装（REQ-301, ストーリー1.2）
- **DIパターン**: SPAのため不要（型定義TASK-0003で削除済み）

### 参照元
- docs/spec/pie-recognition/requirements.md (REQ-001, REQ-007, NFR-001, NFR-002)
- docs/spec/pie-recognition/user-stories.md (ストーリー1.1, 1.2)
- docs/spec/pie-recognition/acceptance-criteria.md (TC-001〜TC-007)
- docs/design/pie-recognition/design-interview.md

---

## 7. 開発順序・依存関係

### 既完了タスク
1. **TASK-0003**: app/src/lib/types.ts の型定義整備 ✓
2. **TASK-0004**: app/static/rules.json の作成 ✓

### 本タスク
3. **TASK-0005**: OpenCV.js ローダー実装（本タスク）
   - **成果物**: lib/opencv-loader.ts
   - **責務**: OpenCV.js の初期化，グローバルスコープへの登録
   - **関連テスト**: TBD（ローダーのテストケース）

### 後続タスク
4. **TASK-0006**: PaiDetector 実装（OpenCV使用）
5. **TASK-0007**: PaiRecognizer 実装（pHash利用）
6. **TASK-0008**: 画像認識パイプライン統合
7. **TASK-0009**: ScoringEngine 実装（加点役判定・ジャラ計算）
8. **TASK-0010**: /result ルート・結果表示UI実装

### 参照元
- docs/implements/pie-recognition/TASK-0003/setup-report.md
- docs/implements/pie-recognition/TASK-0004/setup-report.md

---

## 補足

### ユビキタス言語チェックリスト
- [x] パイ / 牌 — 麻雀牌（アニメ柄）
- [x] 加点役 — 役（得点条件）
- [x] ジャラ — 点数
- [x] 撮影 — カメラで牌を撮影する行為
- [x] 認識 — 撮影画像から牌を識別する処理

### 外部仕様
- **OpenCV.js**: @techstark/opencv-js パッケージの Mat, cvtColor, findContours, drawContours などを活用
- **Canvas API**: 検出領域の切り出し・pHash計算用 ImageData
- **Web Workers**: 将来的な高速化オプション（REQ-301）

---

## 参照ファイル一覧

### 設計・要件文書
- docs/spec/pie-recognition/requirements.md
- docs/spec/pie-recognition/user-stories.md
- docs/spec/pie-recognition/acceptance-criteria.md
- docs/spec/pie-recognition/note.md
- docs/design/pie-recognition/architecture.md
- docs/design/pie-recognition/interfaces.ts
- docs/design/pie-recognition/dataflow.md

### 実装ファイル
- app/src/lib/types.ts
- app/src/lib/components/camera/Camera.svelte
- app/src/lib/components/camera/CameraCapture.svelte
- app/src/lib/components/camera/CameraResult.svelte
- app/static/pai-details.json
- app/static/pai-hashes.json
- app/static/rules.json
- app/static/pai-images/

### テストファイル
- app/vite.config.ts
- app/src/lib/components/camera/CameraCapture.svelte.spec.ts
- app/src/demo.spec.ts

### パッケージ・設定
- app/package.json
- app/tsconfig.json
- app/svelte.config.js

### 前タスク報告書
- docs/implements/pie-recognition/TASK-0003/setup-report.md
- docs/implements/pie-recognition/TASK-0004/setup-report.md
