/** OpenCV.js WASMのブラウザ向け遅延ローダー */

export class OpenCVLoadError extends Error {
  override readonly name = 'OpenCVLoadError';

  constructor(cause: unknown) {
    super('OpenCV.js WASM load failed', { cause });
  }
}

let loadPromise: Promise<void> | null = null;

/**
 * 初回呼び出しでWASMのダウンロードを開始し、完了まで待機する。
 * 2回目以降はキャッシュから即座にresolveする（冪等）。
 *
 * @throws {OpenCVLoadError} ロード失敗時
 *
 * @example
 * // 先読み（プレビュー画面表示時）
 * load();
 *
 * // ロード完了を待つ（「認識する」ボタンタップ時）
 * await load();
 */
export async function load(): Promise<void> {
  if (loadPromise === null) {
    loadPromise = import('@techstark/opencv-js')
      .then(() => undefined)
      .catch((cause) => {
        loadPromise = null;
        throw new OpenCVLoadError(cause);
      });
  }

  await loadPromise;
}
