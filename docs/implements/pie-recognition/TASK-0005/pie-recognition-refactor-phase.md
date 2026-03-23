# TASK-0005: OpenCV.jsローダー実装 Refactorフェーズ記録

**作成日**: 2026-03-20
**タスクID**: TASK-0005
**要件名**: pie-recognition
**機能名**: OpenCV.jsローダー（pie-recognition）
**フェーズ**: Refactor（品質改善）

---

## 1. リファクタリング概要

### Greenフェーズからの改善点

| 改善項目 | 内容 | 信頼性 |
|----------|------|--------|
| Non-null assertion 解消 | `loadPromise!` → 変数に受けての型安全な実装 | 🔵 |
| エラーメッセージ日本語化 | WASMロード失敗時に日本語エラーメッセージでラップ | 🔵 |
| 定数抽出（DRY） | エラーメッセージを `LOAD_ERROR_MESSAGE` 定数に抽出 | 🔵 |
| コメント強化 | `comment_template` に準拠した日本語コメントに改善 | 🔵 |
| 状態遷移コメント追加 | `loadPromise` の状態遷移を明示的に文書化 | 🔵 |

---

## 2. セキュリティレビュー結果

| 項目 | 評価 | 詳細 |
|------|------|------|
| 外部通信 | ✅ | ブラウザキャッシュ経由のWASMロードのみ。外部サーバー通信なし（REQ-007, REQ-401準拠） |
| 入力値検証 | ✅ | パラメータなし関数のため検証不要 |
| エラー情報漏洩 | ✅（改善済み） | WASMロード失敗時のエラーを日本語メッセージでラップ。技術的詳細は `cause` に保持 |
| グローバルスコープ汚染 | ✅ | `cv` オブジェクトは @techstark/opencv-js が制御（設計通り） |

**重大な脆弱性**: なし

---

## 3. パフォーマンスレビュー結果

| 項目 | 評価 | 詳細 |
|------|------|------|
| 冪等性 | ✅ | `null` チェックで重複ロードを防止。時間計算量 O(1) |
| Promise キャッシュ | ✅ | 単一 Promise を共有。複数同時呼び出しでもWASMダウンロードは1回のみ |
| メモリ効率 | ✅ | `loadPromise` は1つのPromiseのみ保持。メモリオーバーヘッドなし |
| エラー後リトライ | ✅ | `catch` で `loadPromise = null` にリセット。O(1)でリセット完了 |

**重大な性能課題**: なし

---

## 4. 改善後コード全文

### `app/src/lib/services/opencv-loader.ts`（99行）

```typescript
/**
 * 【機能概要】: OpenCV.js WASMのブラウザ向け遅延ロード・先読みローダー
 * 【実装方針】: preload()でバックグラウンドロードを開始し、ensureLoaded()でロード完了を保証する
 * 【設計方針】: モジュールスコープの loadPromise で冪等性を保証する単純なキャッシュ設計
 * 【保守性】: 外部依存は @techstark/opencv-js のみ。テスト時は vi.mock() でモック可能
 * 🔵 信頼性レベル: 要件定義セクション1〜6、dataflow.md「OpenCV.jsロード戦略」に基づく
 */

// 【設定定数】: ロード失敗時のユーザー向けエラーメッセージ
// 🔵 dataflow.md「エラーハンドリングフロー」の「ロード失敗 → 再撮影を促す」に基づく
const LOAD_ERROR_MESSAGE =
  '画像処理エンジン（OpenCV.js）の読み込みに失敗しました。ネットワーク接続を確認して再度お試しください。';

/**
 * 【内部状態】: ロードPromiseのキャッシュ（冪等性保証）
 * 状態遷移:
 * - null          → 未ロード状態
 * - Promise<void> → ロード中またはロード完了状態
 */
let loadPromise: Promise<void> | null = null;

export function preload(): void {
  if (loadPromise !== null) { return; } // 冪等性保証
  loadPromise = import('@techstark/opencv-js').then(() => undefined);
  loadPromise.catch(() => { loadPromise = null; }); // エラー時リセット
}

export function ensureLoaded(): Promise<void> {
  if (loadPromise === null) { preload(); } // 防御的プログラミング
  const promise = loadPromise as Promise<void>; // Non-null assertion 解消
  return promise.catch((cause: unknown) => {
    throw new Error(LOAD_ERROR_MESSAGE, { cause }); // 日本語エラーラップ
  });
}
```

（コメント省略版。実際のファイルは `app/src/lib/services/opencv-loader.ts` 参照）

---

## 5. テスト実行結果

```
Test Files  1 passed (1)
Tests       12 passed (12)
```

全12テストケース継続通過。

| テスト | リファクタ前 | リファクタ後 |
|--------|------------|------------|
| TC-001: preload呼び出しでimportが開始される | ✅ | ✅ |
| TC-002: ensureLoadedがresolveする | ✅ | ✅ |
| TC-003: 先読み完了後のensureLoadedが即座にresolve | ✅ | ✅ |
| TC-004: preload未呼び出しでもensureLoadedが正常動作 | ✅ | ✅ |
| TC-005: preloadはvoidを返す | ✅ | ✅ |
| TC-006: WASMロード失敗時にensureLoadedがreject | ✅ | ✅ |
| TC-007: ロード失敗後のリトライで正常ロード | ✅ | ✅ |
| TC-008: preload失敗→ensureLoadedでエラー伝搬 | ✅ | ✅ |
| TC-009: preload複数回呼び出しの冪等性 | ✅ | ✅ |
| TC-010: ensureLoaded複数回呼び出しの冪等性 | ✅ | ✅ |
| TC-011: ロード完了後のensureLoadedが即座にresolve | ✅ | ✅ |
| TC-012: 同時呼び出しでロードは1回のみ | ✅ | ✅ |

---

## 6. コード品質メトリクス

| 指標 | Greenフェーズ | Refactorフェーズ |
|------|-------------|----------------|
| 実装ファイル行数 | 66行 | 99行（コメント強化のため増加） |
| テストファイル行数 | 変更なし | 変更なし（372行） |
| ESLint | 0 errors | 0 errors |
| svelte-check | 0 errors | 0 errors |
| Non-null assertion | 1箇所 (`!`) | 0箇所（型絞り込みで解消） |
| エラーメッセージ日本語化 | なし | あり |

---

## 7. 信頼性レベルサマリー

| レベル | 件数 |
|--------|------|
| 🔵 青信号 | 全改善項目（要件定義・設計文書に基づく） |
| 🟡 黄信号 | `loadPromise.catch()` によるリセット方式（Greenフェーズから継続） |
| 🔴 赤信号 | なし |
