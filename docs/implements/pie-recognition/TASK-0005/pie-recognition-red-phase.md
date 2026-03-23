# TASK-0005: OpenCV.jsローダー実装 Redフェーズ記録

**作成日**: 2026-03-20
**タスクID**: TASK-0005
**要件名**: pie-recognition
**機能名**: OpenCV.jsローダー（pie-recognition）
**フェーズ**: Red（失敗するテスト作成）

---

## 1. 作成したテストケース一覧

| テストケース | テスト名 | 信頼性 | 分類 |
|---|---|---|---|
| TC-001 | preload呼び出しでOpenCV.jsの動的importが開始される | 🔵 | 正常系 |
| TC-002 | ensureLoaded呼び出しでロード完了後にPromiseがresolveする | 🔵 | 正常系 |
| TC-003 | 先読み完了後のensureLoadedは即座にresolveする | 🔵 | 正常系 |
| TC-004 | preload未呼び出しでもensureLoadedが正常にロードして返す | 🟡 | 正常系 |
| TC-005 | preloadはvoidを返す（Promiseを返さない） | 🔵 | 正常系 |
| TC-006 | WASMロード失敗時にensureLoadedがエラーをthrowする | 🟡 | 異常系 |
| TC-007 | ロード失敗後のリトライで正常にロードできる | 🟡 | 異常系 |
| TC-008 | preloadで開始したロードが失敗した場合、ensureLoadedでエラーが伝搬する | 🟡 | 異常系 |
| TC-009 | preloadを複数回呼んでもimportは1回しか実行されない | 🔵 | 境界値 |
| TC-010 | ensureLoadedを複数回呼んでもimportは1回しか実行されない | 🔵 | 境界値 |
| TC-011 | ロード完了後のensureLoadedは追加ロードなしで即座にresolveする | 🔵 | 境界値 |
| TC-012 | preloadとensureLoadedを同時に呼んでもロードは1回のみ | 🔵 | 境界値 |

**合計**: 12件 | 🔵 8件（67%）| 🟡 4件（33%）| 🔴 0件（0%）

---

## 2. テストファイル

`app/src/lib/services/opencv-loader.spec.ts`

---

## 3. 期待される失敗内容

```
Error: Cannot find module '/src/lib/services/opencv-loader'
```

全12テストケースが `opencv-loader.ts` 実装ファイルが存在しないため `ERR_MODULE_NOT_FOUND` エラーで失敗する。

### テスト実行結果（Redフェーズ確認）

```
Test Files  1 failed (1)
Tests       12 failed (12)
```

---

## 4. Greenフェーズで実装すべき内容

### 実装ファイル

`app/src/lib/services/opencv-loader.ts`

### 公開API

```typescript
export function preload(): void;
export function ensureLoaded(): Promise<void>;
```

### 実装要件

1. **内部状態管理**: ロード状態（未ロード / ロード中 / ロード完了 / エラー）を管理
2. **冪等性保証**: 複数回呼び出されても `import()` は1回のみ実行
3. **`preload()`**: 同期的に返り（void）、内部で動的 `import('@techstark/opencv-js')` を開始
4. **`ensureLoaded()`**: ロード完了を待つ Promise を返す。先読み済みなら即座に resolve
5. **エラーハンドリング**: ロード失敗時に reject し、エラーを呼び出し元に伝搬
6. **リトライ可能性**: 失敗後に `preload()` を再度呼ぶことで状態をリセットしてリトライ可能

### 実装例（最小実装の指針）

```typescript
// app/src/lib/services/opencv-loader.ts
let loadPromise: Promise<void> | null = null;

export function preload(): void {
  if (!loadPromise) {
    loadPromise = import('@techstark/opencv-js').then(() => undefined);
    loadPromise.catch(() => {
      // エラー発生時はリトライ可能にするためPromiseをリセット
      loadPromise = null;
    });
  }
}

export function ensureLoaded(): Promise<void> {
  if (!loadPromise) {
    preload();
  }
  return loadPromise!;
}
```
