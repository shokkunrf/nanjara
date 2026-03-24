/** OpenCV.js WASMのブラウザ向け遅延ローダー */

import type { CV } from '@techstark/opencv-js';

export class OpenCVLoadError extends Error {
  override readonly name = 'OpenCVLoadError';

  constructor(cause: unknown) {
    super('OpenCV.js WASM load failed', { cause });
  }
}

let loadPromise: Promise<CV> | null = null;

/**
 * 初回呼び出しでWASMのダウンロードを開始し、完了まで待機する。
 * 2回目以降はキャッシュから即座にresolveする（冪等）。
 *
 * @returns OpenCV.js の cv オブジェクト
 * @throws {OpenCVLoadError} ロード失敗時
 *
 * @example
 * // 先読み（プレビュー画面表示時）
 * loadCv();
 *
 * // ロード完了を待つ（「認識する」ボタンタップ時）
 * const cv = await loadCv();
 */
export async function loadCv(): Promise<CV> {
  if (loadPromise === null) {
    loadPromise = import('@techstark/opencv-js')
      .then((m) => m.default)
      .catch((cause) => {
        loadPromise = null;
        throw new OpenCVLoadError(cause);
      });
  }

  return loadPromise;
}
