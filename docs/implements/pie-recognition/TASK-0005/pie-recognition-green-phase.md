# TASK-0005: OpenCV.jsローダー実装 Greenフェーズ記録

**作成日**: 2026-03-20
**タスクID**: TASK-0005
**要件名**: pie-recognition
**機能名**: OpenCV.jsローダー（pie-recognition）
**フェーズ**: Green（最小実装）

---

## 1. 実装方針

### 基本方針

モジュールスコープの `loadPromise` 変数でロード状態を管理し、冪等性を保証する最小実装。

- `preload()`: `loadPromise` が null のときのみ動的 import を開始（冪等性）
- `ensureLoaded()`: `loadPromise` が null の場合は内部で `preload()` を呼び出す（防御的プログラミング）
- リトライ: 失敗時に `loadPromise.catch()` で `loadPromise = null` にリセット

### 判断理由

Redフェーズ記録のサンプル実装をベースに、テストケースの要件をすべて満たす形で実装した。
特に TC-008（preload失敗→ensureLoaded エラー伝搬）のために、`catch` コールバックは非同期で実行されるため `preload()` 直後の `ensureLoaded()` 呼び出しは reject する Promise を正しく返す。

---

## 2. 実装コード

### `app/src/lib/services/opencv-loader.ts`（66行）

```typescript
/**
 * 【機能概要】: OpenCV.js WASMのブラウザ向け遅延ロード・先読みローダー
 * 【実装方針】: preload()でバックグラウンドロードを開始し、ensureLoaded()でロード完了を保証する
 * 【テスト対応】: TC-001〜TC-012 の全テストケースを通すための最小実装
 * 🔵 信頼性レベル: 要件定義セクション1〜6、dataflow.md「OpenCV.jsロード戦略」に基づく
 */

// 【内部状態】: ロードPromiseのキャッシュ（冪等性保証）
// - null: 未ロード状態
// - Promise<void>: ロード中またはロード完了状態
let loadPromise: Promise<void> | null = null;

export function preload(): void {
  if (loadPromise !== null) {
    return; // 冪等性保証
  }
  loadPromise = import('@techstark/opencv-js').then(() => undefined);
  loadPromise.catch(() => {
    loadPromise = null; // エラー時にリトライ可能にする
  });
}

export function ensureLoaded(): Promise<void> {
  if (loadPromise === null) {
    preload(); // preload未呼び出し時の防御的プログラミング
  }
  return loadPromise!;
}
```

---

## 3. テストファイル修正

### `app/src/lib/services/opencv-loader.spec.ts`

TC-006、TC-008 の `vi.mock()` を `vi.doMock()` に変更。

**理由**: `vi.mock()` はファイル全体に hoisted されるため、TC-006・TC-008 で定義したエラーモックが TC-002〜TC-005（正常系）にも影響していた。`vi.doMock()` は hoisted されないため、呼び出し箇所でのみ適用される。

---

## 4. テスト実行結果

```
Test Files  1 passed (1)
Tests       12 passed (12)
```

全12テストケース通過。

| テスト | 結果 |
|--------|------|
| TC-001: preload呼び出しでimportが開始される | ✅ |
| TC-002: ensureLoadedがresolveする | ✅ |
| TC-003: 先読み完了後のensureLoadedが即座にresolve | ✅ |
| TC-004: preload未呼び出しでもensureLoadedが正常動作 | ✅ |
| TC-005: preloadはvoidを返す | ✅ |
| TC-006: WASMロード失敗時にensureLoadedがreject | ✅ |
| TC-007: ロード失敗後のリトライで正常ロード | ✅ |
| TC-008: preload失敗→ensureLoadedでエラー伝搬 | ✅ |
| TC-009: preload複数回呼び出しの冪等性 | ✅ |
| TC-010: ensureLoaded複数回呼び出しの冪等性 | ✅ |
| TC-011: ロード完了後のensureLoadedが即座にresolve | ✅ |
| TC-012: 同時呼び出しでロードは1回のみ | ✅ |

---

## 5. 型チェック・Lint

```
svelte-check: 0 ERRORS 0 WARNINGS
ESLint: エラーなし
```

---

## 6. 品質チェック

- ファイルサイズ: 66行（800行制限以内）
- モック使用: 実装コードにモック・スタブなし
- 型安全: TypeScript エラーなし
- 冪等性: 複数回呼び出しでも import は1回のみ

---

## 7. 課題・改善点（Refactorフェーズで対応）

1. **ロード状態の明示化**: `loadPromise` の型だけでは「ロード中」「ロード完了」「エラー（リセット前）」が判別できない。`LoadState` 型の導入を検討
2. **エラーメッセージの拡充**: 現在はエラーをそのまま伝搬するだけ。「画像処理エンジンの読み込みに失敗しました」等の日本語メッセージでラップする改善余地あり
3. **ロード完了後の `cv` オブジェクト確認**: 現在は import 完了で resolve しているが、`cv.getBuildInformation()` 等でWASM初期化完了を確認する実装が望ましい可能性
