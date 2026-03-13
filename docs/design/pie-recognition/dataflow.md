# パイ認識アプリ データフロー図

**作成日**: 2026-03-13
**関連アーキテクチャ**: [architecture.md](architecture.md)
**関連要件定義**: [requirements.md](../../spec/pie-recognition/requirements.md)

**【信頼性レベル凡例】**:
- 🔵 **青信号**: EARS要件定義書・設計文書・ユーザヒアリングを参考にした確実なフロー
- 🟡 **黄信号**: EARS要件定義書・設計文書・ユーザヒアリングから妥当な推測によるフロー
- 🔴 **赤信号**: EARS要件定義書・設計文書・ユーザヒアリングにない推測によるフロー

---

## システム全体のデータフロー 🔵

**信頼性**: 🔵 *要件定義・ユーザーストーリーより*

```mermaid
flowchart LR
    A[撮影] --> B[確認]
    B --> C[認識]
    C --> D[結果表示]

    subgraph 事前処理[事前処理 tools/hasher]
        E[牌画像 84枚] --> F[pHash計算]
        F --> G[hashes.json]
    end

    G --> C
```

## 主要機能のデータフロー

### 機能1: 牌の撮影と確認 🔵

**信頼性**: 🔵 *既存実装（CameraCapture → CameraResult）より*

**関連要件**: REQ-001, REQ-202

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant CC as CameraCapture
    participant Canvas as Canvas
    participant CR as CameraResult

    U->>CC: 撮影ボタンタップ
    CC->>Canvas: videoフレーム描画
    Canvas->>CC: JPEG Blob生成
    CC->>CR: Blob URL渡し
    CR->>U: 撮影画像プレビュー表示
    Note over CR: 「再撮影」「認識する」ボタン表示
```

**詳細ステップ**:
1. ユーザーが撮影ボタンをタップ
2. videoフレームをCanvasに描画し、JPEG Blobを生成（既存実装）
3. CameraResult画面で撮影画像をプレビュー表示
4. ユーザーは「再撮影」または「認識する」を選択

---

### 機能2: 画像認識パイプライン 🟡

**信頼性**: 🟡 *要件（ブラウザ内・3秒以内）+ 技術検討から妥当な推測*

**関連要件**: REQ-001, REQ-002, REQ-007, NFR-001

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant CR as CameraResult
    participant TD as TileDetector
    participant Canvas as Canvas API
    participant TR as TileRecognizer
    participant Hash as hashes.json
    participant RR as RecognitionResult

    U->>CR: 「認識する」ボタンタップ
    CR->>CR: ローディング表示
    CR->>TD: 撮影画像（Blob URL）
    TD->>Canvas: 画像ロード
    Canvas->>TD: ImageData取得

    Note over TD: 牌検出処理
    TD->>TD: グレースケール変換
    TD->>TD: 2値化（大津の方法）
    TD->>TD: 水平走査で牌領域検出
    TD->>TD: バウンディングボックス抽出

    TD->>TR: 牌領域画像[]（8-9枚）

    Note over TR: 牌識別処理
    TR->>Hash: pHash参照データ読み込み
    TR->>TR: 各牌領域のpHash計算
    TR->>TR: ハミング距離で最近傍マッチング
    TR->>TR: 識別結果（牌ID[]）生成

    TR->>RR: 認識結果データ
    RR->>U: 認識結果画面表示
```

**詳細ステップ**:
1. 撮影画像をCanvas APIで読み込み、ImageDataを取得
2. **牌検出**: グレースケール → 2値化 → 水平走査で矩形領域を検出
3. 検出した矩形をバウンディングボックスとして切り出し（8-9枚想定）
4. **牌識別**: 各切り出し画像のpHashを計算
5. 事前処理済みの84種類のpHashとハミング距離を比較
6. 最小距離の牌IDを識別結果として返す

---

### 機能3: 加点役判定・ジャラ計算 🔵

**信頼性**: 🔵 *要件定義REQ-004, REQ-005, REQ-006 + ユーザヒアリング「JSONで管理」より*

**関連要件**: REQ-004, REQ-005, REQ-006

```mermaid
sequenceDiagram
    participant RR as RecognitionResult
    participant SE as ScoringEngine
    participant Rules as rules.json

    RR->>SE: 認識された手牌（TileId[]）
    SE->>Rules: ルールデータ読み込み
    SE->>SE: 手牌の牌構成を分析
    SE->>SE: 各加点役の条件を評価
    SE->>SE: 該当する加点役を抽出
    SE->>SE: 各加点役のジャラを合算
    SE->>RR: 判定結果（加点役[] + 合計ジャラ）
    RR->>RR: 結果表示を更新
```

**詳細ステップ**:
1. 認識された手牌のID配列をScoringEngineに渡す
2. rules.jsonから加点役の定義を読み込み
3. 手牌の構成（グループ別枚数、キャラクター組み合わせ等）を分析
4. 各加点役の条件式を評価し、該当する加点役を抽出
5. 各加点役のジャラ値を合算し、合計ジャラを計算
6. 結果画面に加点役名・個別ジャラ・合計ジャラを表示

---

### 機能4: 事前処理パイプライン（開発時） 🔵

**信頼性**: 🔵 *PRD「事前に画像をベクトル化、ハッシュ化」+ REQ-301, REQ-405より*

**関連要件**: REQ-301, REQ-404, REQ-405

```mermaid
flowchart TD
    A[tools/extractor/output/<br>84枚のPNG + tiles.json] -->|コピー| B[app/static/tiles/<br>84枚のPNG + tiles.json]
    A -->|入力| C[tools/hasher/]
    C -->|pHash計算| D[各画像のpHashを計算]
    D -->|出力| E[app/static/tiles/hashes.json]

    F[docs/official/manual.pdf] -->|ルール読み取り| G[加点役・ジャラ定義]
    G -->|JSON構造化| H[app/static/rules/rules.json]
```

**詳細ステップ**:
1. `tools/extractor/output/` から牌画像84枚 + tiles.json を `app/static/tiles/` にコピー
2. `tools/hasher/` で84枚の画像を読み込み、pHashを計算
3. `app/static/tiles/hashes.json` に `{ filename: pHashValue }` 形式で出力
4. manual.pdfからルールを解読し、`app/static/rules/rules.json` に構造化

---

## データ処理パターン

### 同期処理 🔵

**信頼性**: 🔵 *アーキテクチャ設計より*

- **加点役判定**: ルールデータとの照合はCPU軽量のため同期処理
- **ジャラ計算**: 単純な加算処理のため同期処理
- **pHash比較**: ハミング距離計算は整数演算のみで高速

### 非同期処理 🟡

**信頼性**: 🟡 *パフォーマンス要件から妥当な推測*

- **画像読み込み**: Canvas APIでの画像ロードは非同期
- **牌検出**: ImageData処理は同期だが、全体フローはasync/awaitで管理
- **hashes.json/rules.jsonの読み込み**: fetch()で非同期取得（初回のみ）

## エラーハンドリングフロー 🟡

**信頼性**: 🟡 *既存実装パターン + 一般的なUXから妥当な推測*

```mermaid
flowchart TD
    A[認識処理開始] --> B{牌検出}
    B -->|0枚検出| C[「牌が検出されませんでした」表示]
    C --> D[再撮影を促す]
    B -->|1枚以上検出| E{牌識別}
    E -->|全牌識別成功| F[認識結果表示]
    E -->|一部識別失敗| G[識別できた牌のみ表示]
    G --> F
    F --> H{加点役判定}
    H -->|加点役あり| I[加点役 + ジャラ表示]
    H -->|加点役なし| J[「加点役なし」表示]
```

## 状態管理フロー 🔵

**信頼性**: 🔵 *既存実装パターン（Svelte 5 runes）より*

```mermaid
stateDiagram-v2
    [*] --> capture: アプリ起動
    capture --> preview: 撮影完了
    preview --> capture: 再撮影
    preview --> recognizing: 「認識する」タップ
    recognizing --> result: 認識成功
    recognizing --> preview: 認識失敗
    result --> capture: 再撮影
```

**Camera.svelte の状態拡張**:
```
type CameraMode = 'capture' | 'preview' | 'recognizing' | 'result';
```

既存の `'capture' | 'result'` を4状態に拡張:
- `capture`: カメラ撮影画面
- `preview`: 撮影画像確認（既存の `result` を改名）
- `recognizing`: 認識処理中（ローディング）
- `result`: 認識結果表示（新規）

## 静的データの読み込み戦略 🟡

**信頼性**: 🟡 *パフォーマンス要件から妥当な推測*

```mermaid
flowchart TD
    A[アプリ起動] --> B[tiles.json を fetch]
    A --> C[hashes.json を fetch]
    A --> D[rules.json を fetch]
    B --> E[メモリにキャッシュ]
    C --> E
    D --> E
    E --> F[認識処理で参照]
```

- **初回ロード時**: tiles.json, hashes.json, rules.json を fetch してメモリにキャッシュ
- **以降の認識**: キャッシュ済みデータを参照（追加fetch不要）
- **データサイズ見積り**:
  - tiles.json: ~5KB（84件のメタデータ）
  - hashes.json: ~10KB（84件のpHash値）
  - rules.json: ~5-20KB（加点役定義、要manual.pdf解読）

## 関連文書

- **アーキテクチャ**: [architecture.md](architecture.md)
- **型定義**: [interfaces.ts](interfaces.ts)
- **要件定義**: [requirements.md](../../spec/pie-recognition/requirements.md)

## 信頼性レベルサマリー

- 🔵 青信号: 9件 (64%)
- 🟡 黄信号: 5件 (36%)
- 🔴 赤信号: 0件 (0%)

**品質評価**: 高品質
