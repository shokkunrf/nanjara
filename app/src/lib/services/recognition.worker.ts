/// <reference lib="webworker" />

/**
 * 認識パイプライン Web Worker
 *
 * メインスレッドをブロックせずに OpenCV.js ロード + 画像デコード + 検出 + 識別を実行する。
 * OpenCV.js の URL はメインスレッドから postMessage で受け取る。
 */

import type { CV } from '@techstark/opencv-js';
import type { RecognitionResult } from '../types.js';
import { detect } from './pai-detector.js';
import { recognize } from './pai-recognizer.js';

// --- プロトコル型 ---

/** メインスレッド → Worker */
export type WorkerRequest =
  | { type: 'preload'; opencvUrl: string }
  | { type: 'recognize'; opencvUrl: string; imageUrl: string };

/** Worker → メインスレッド */
export type WorkerResponse =
  | { type: 'result'; result: RecognitionResult }
  | { type: 'error'; error: Error };

// --- OpenCV.js ロード ---

declare const cv: CV | undefined;

function loadCv(opencvUrl: string): CV {
  if (typeof cv === 'undefined') {
    importScripts(opencvUrl);
    if (typeof cv === 'undefined') {
      throw new Error('global.cv not found');
    }
  }
  return cv;
}

// --- 画像デコード ---

async function loadImageData(imageUrl: string): Promise<ImageData> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// --- メッセージハンドラ ---

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  if (msg.type === 'preload') {
    loadCv(msg.opencvUrl);
    return;
  }

  if (msg.type === 'recognize') {
    try {
      const cv = loadCv(msg.opencvUrl);
      const imageData = await loadImageData(msg.imageUrl);
      const regions = detect(cv, imageData);
      const result = await recognize(regions);

      self.postMessage({ type: 'result', result } satisfies WorkerResponse);
    } catch (err) {
      self.postMessage({ type: 'error', error: toError(err) } satisfies WorkerResponse);
    }
  }
};
