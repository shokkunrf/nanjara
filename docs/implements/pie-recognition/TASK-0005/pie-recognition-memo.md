# pie-recognition (OpenCV.jsローダー) TDD開発完了記録

## 確認すべきドキュメント

- `docs/tasks/pie-recognition/TASK-0005.md`
- `docs/implements/pie-recognition/TASK-0005/pie-recognition-requirements.md`
- `docs/implements/pie-recognition/TASK-0005/pie-recognition-testcases.md`

## 🎯 最終結果 (2026-03-20)
- **実装率**: 100% (12/12テストケース)
- **品質判定**: 合格（高品質）
- **TODO更新**: ✅完了マーク追加

## 💡 重要な技術学習

### 実装パターン
- モジュールスコープの `loadPromise: Promise<void> | null` 変数で冪等性を保証するシンプルなキャッシュ設計
- `preload()` は `void` を返し、内部で `import('@techstark/opencv-js').then(() => undefined)` を開始
- `ensureLoaded()` は `loadPromise === null` の場合に内部で `preload()` を呼ぶ防御的実装
- エラー後リトライ: `catch` ブロックで `loadPromise = null` にリセットして再試行を可能にする
- エラーメッセージ日本語化: `new Error(LOAD_ERROR_MESSAGE, { cause })` パターンで技術詳細を `cause` に保持

### テスト設計
- `vi.mock()` はファイル全体にhoistされるため、正常系で `vi.mock()` + 異常系で `vi.doMock()` を使い分ける
- `vi.resetModules()` を `beforeEach` で呼び出すことで各テストが独立したモジュール状態からスタートする
- 冪等性テスト: `importCallCount` カウンタをモック内に埋め込んで import 呼び出し回数を検証
- 競合状態テスト: `preload()` と `ensureLoaded()` を同一マイクロタスク内で呼び出してRace condition不在を確認

### 品質保証
- Non-null assertion（`!`）を排除し、変数に受けることで型安全性を確保
- ESLint 0 errors / svelte-check 0 errors を維持
- `LOAD_ERROR_MESSAGE` 定数抽出によりDRY原則を遵守

## 関連ファイル
- 実装ファイル: `app/src/lib/services/opencv-loader.ts`（99行）
- テストファイル: `app/src/lib/services/opencv-loader.spec.ts`（372行）
