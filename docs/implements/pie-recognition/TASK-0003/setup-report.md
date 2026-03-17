# TASK-0003 設定作業実行

## 作業概要

- **タスクID**: TASK-0003
- **作業内容**: `app/src/lib/types.ts` を設計文書 `interfaces.ts` に合わせて更新
- **実行日時**: 2026-03-17
- **フェーズ**: Phase 1 - 基盤構築

## 設計文書参照

- **参照文書**:
  - `docs/design/pie-recognition/architecture.md`
  - `docs/design/pie-recognition/interfaces.ts`
  - `docs/design/pie-recognition/dataflow.md`
- **関連要件**: 全REQ（横断的）

## 実行した作業

### 1. 旧設計の型を削除

以下の型を `app/src/lib/types.ts` から削除した:

- `PaiGroup` — 未使用
- `PaiAttributes` — 属性ベース方式（廃止）
- `PaiMeta` — `PaiDetail` に置換
- `PaiMetaMap` — `PaiDetailMap` に置換
- `RuleConditionType` — 条件ベース方式（廃止）
- `RuleCondition` — 条件ベース方式（廃止）
- `RulesData` — 不要
- `IOpenCVLoader` — DIなしSPAでは不要
- `IPaiDetector` — DIなしSPAでは不要
- `IPaiRecognizer` — DIなしSPAでは不要
- `IScoringEngine` — DIなしSPAでは不要

### 2. 既存の型を変更

| 型 | 変更内容 |
|----|---------|
| `CameraMode` | `'capture' \| 'preview' \| 'recognizing' \| 'result'` → `'capture' \| 'preview'` |
| `ScoringRule` | `{id, name, conditions[], jara}` → `{name, requiredCount, jara}` |
| `MatchedRule` | `{rule, jara}` → `{rule, matchedCount}` |
| `RecognizedPai` | `{paiId, confidence, region}` → `{paiId, confidence}` |

### 3. 新しい型を追加

- `PaiDetail`: `{name: string, yaku: string[]}` — pai-details.json の1エントリに対応
- `PaiDetailMap`: `Record<PaiId, PaiDetail>` — pai-details.json 全体の辞書型

### 4. 維持した型

- `HistoryBackEventDetail` — 既存コンポーネントで使用中（+layout.svelte, Camera.svelte）
- `PaiId` — 変更なし
- `DetectedRegion` — 変更なし
- `PaiHashMap` — 変更なし
- `RecognitionResult` — 変更なし
- `ScoringResult` — 変更なし

## 検証結果

```bash
cd app && npm run check
# 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS

cd app && npm run build
# ✓ built in 3.51s
```

## 作業結果

- [x] `app/src/lib/types.ts` が設計文書 `interfaces.ts` と整合
- [x] 旧設計の型（属性ベース方式、サービスIF）が削除されている
- [x] `npm run check` が通る（エラー0件、警告0件）
- [x] ビルドが通る

## 遭遇した問題

なし。既存コンポーネント（Camera.svelte）は `CameraMode` 型を直接使用せず独自の型定義を持っていたため、`CameraMode` の変更が影響しなかった。

## 次のステップ

- TASK-0005: OpenCV.js ローダー実装
- TASK-0006: パイ検出器実装（PaiDetector）
- TASK-0009: ルールデータ作成（rules.json）
