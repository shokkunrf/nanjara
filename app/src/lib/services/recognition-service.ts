/** 認識パイプラインの Web Worker ラッパー */

import type { RecognitionResult } from '../types.js';
import type { WorkerRequest, WorkerResponse } from './recognition.worker.js';
import opencvUrl from '@techstark/opencv-js/dist/opencv.js?url';

export class RecognitionServiceError extends Error {
  override readonly name = 'RecognitionServiceError';
}

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./recognition.worker.ts', import.meta.url));
  }
  return worker;
}

/**
 * Worker を起動し、OpenCV.js の先読みを開始する。
 * メインスレッドをブロックしない。
 */
export function preload(): void {
  getWorker().postMessage({ type: 'preload', opencvUrl } satisfies WorkerRequest);
}

/**
 * 撮影画像から認識パイプラインを実行する。
 * 画像デコード、OpenCV.js のロード、検出、識別をすべて Worker 内で行う。
 *
 * @param imageUrl - 撮影画像の blob URL
 * @returns 認識結果
 * @throws {RecognitionServiceError} Worker 内でエラーが発生した場合
 */
export function recognizeImage(imageUrl: string): Promise<RecognitionResult> {
  const w = getWorker();

  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent<WorkerResponse>) => {
      w.removeEventListener('message', handler);
      if (e.data.type === 'result') {
        resolve(e.data.result);
      } else {
        reject(new RecognitionServiceError(e.data.error.message, { cause: e.data.error }));
      }
    };

    w.addEventListener('message', handler);
    w.addEventListener(
      'error',
      (e) => {
        w.removeEventListener('message', handler);
        reject(new RecognitionServiceError(e.message || 'Worker error'));
      },
      { once: true },
    );

    w.postMessage({
      type: 'recognize',
      opencvUrl,
      imageUrl,
    } satisfies WorkerRequest);
  });
}
