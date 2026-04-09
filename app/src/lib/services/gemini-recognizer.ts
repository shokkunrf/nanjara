/**
 * Geminiによる麻雀パイ認識サービス
 *
 * 撮影画像からバンド領域の切り出しなどの前処理を行い、
 * サーバーAPI（/api/recognize）へ送信して認識結果を取得する。
 */

import type { PaiId, RecognitionResult } from '../types.js';
import type { ExtractBandResult } from './extract-band.worker.js';
import ExtractBandWorker from './extract-band.worker.js?worker';

export class GeminiRecognitionError extends Error {
  override readonly name = 'GeminiRecognitionError';
}

/** Web WorkerでextractBandを実行 */
function runExtractBand(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<ExtractBandResult | null> {
  return new Promise((resolve) => {
    const worker = new ExtractBandWorker();
    worker.onmessage = (e: MessageEvent<ExtractBandResult | null>) => {
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = () => {
      worker.terminate();
      resolve(null);
    };
    worker.postMessage({ data, width, height }, { transfer: [data.buffer] });
  });
}

/**
 * 撮影画像からパイのバンド領域を切り出してJPEG Blobにする。
 * バンド検出に失敗した場合は全体画像をフォールバック。
 */
async function preparePhoto(imageUrl: string): Promise<Blob> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  // バンド切り出しを試みる
  const fullCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const fullCtx = fullCanvas.getContext('2d')!;
  fullCtx.drawImage(bitmap, 0, 0);
  const fullImageData = fullCtx.getImageData(0, 0, bitmap.width, bitmap.height);

  const bandImageData = await runExtractBand(
    new Uint8ClampedArray(fullImageData.data),
    fullImageData.width,
    fullImageData.height,
  );

  // バンド品質判定:
  // - 幅に対して高さが十分（>15%）
  // - 元画像の面積の10%以上を占める（極端に小さい切り出しを除外）
  const isBandUsable =
    bandImageData !== null &&
    bandImageData.height / bandImageData.width > 0.15 &&
    (bandImageData.width * bandImageData.height) / (bitmap.width * bitmap.height) > 0.1;

  let srcBitmap: ImageBitmap;
  if (isBandUsable && bandImageData) {
    // バンド切り出し成功 → RGBA データから ImageBitmap に変換
    const bandCanvas = new OffscreenCanvas(bandImageData.width, bandImageData.height);
    const bandCtx = bandCanvas.getContext('2d')!;
    const nativeImageData = bandCtx.createImageData(bandImageData.width, bandImageData.height);
    nativeImageData.data.set(bandImageData.data);
    bandCtx.putImageData(nativeImageData, 0, 0);
    srcBitmap = await createImageBitmap(bandCanvas);
    bitmap.close();
  } else {
    // フォールバック: 全体画像
    srcBitmap = bitmap;
  }

  // 長辺1024pxにリサイズ
  const maxDim = Math.max(srcBitmap.width, srcBitmap.height);
  const scale = maxDim > 1024 ? 1024 / maxDim : 1;
  const w = Math.round(srcBitmap.width * scale);
  const h = Math.round(srcBitmap.height * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(srcBitmap, 0, 0, w, h);
  srcBitmap.close();

  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
}

/**
 * 撮影画像からパイを認識する。
 * 画像前処理はクライアント、Gemini API呼び出しはサーバーで行う。
 *
 * @param imageUrl - 撮影画像の blob URL
 * @returns 認識結果
 */
export async function recognizeWithGemini(imageUrl: string): Promise<RecognitionResult> {
  const start = performance.now();

  const photoBlob = await preparePhoto(imageUrl);

  const formData = new FormData();
  formData.append('photo', photoBlob);

  const response = await fetch('/api/recognize', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new GeminiRecognitionError(`Recognition failed: ${errorText.slice(0, 200)}`);
  }

  const { paiIds } = (await response.json()) as { paiIds: PaiId[] };

  const pais = paiIds.map((paiId) => ({
    paiId,
    confidence: 1.0,
  }));

  return {
    pais,
    processingTimeMs: performance.now() - start,
  };
}
