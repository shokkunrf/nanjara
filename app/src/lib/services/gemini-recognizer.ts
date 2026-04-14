/**
 * Geminiによる麻雀パイ認識サービス
 *
 * 撮影画像からバンド領域の切り出しなどの前処理を行い、
 * サーバーAPI（/api/recognize）へ送信して認識結果を取得する。
 */

import type { PaiId, RecognitionResult } from '../types.js';
import type { BandCorners } from './pai-detector.js';
import type { DetectBandRequest, DetectBandResponse } from './extract-band.worker.js';
import ExtractBandWorker from './extract-band.worker.js?worker';

export class GeminiRecognitionError extends Error {
  override readonly name = 'GeminiRecognitionError';
}

/** Web Workerでバンド検出を実行 */
function runDetectBand(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<BandCorners | null> {
  return new Promise((resolve) => {
    const worker = new ExtractBandWorker();
    worker.onmessage = (e: MessageEvent<DetectBandResponse>) => {
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = () => {
      worker.terminate();
      resolve(null);
    };
    const req: DetectBandRequest = { data, width, height };
    worker.postMessage(req, { transfer: [data.buffer] });
  });
}

/** lt-rt 方向を水平とみなして4頂点領域を切り出す */
function cropBand(bitmap: ImageBitmap, corners: BandCorners): ImageBitmap {
  const ux = corners.rt.x - corners.lt.x;
  const uy = corners.rt.y - corners.lt.y;
  const bandW = Math.max(1, Math.round(Math.sqrt(ux * ux + uy * uy)));
  const vx = corners.lb.x - corners.lt.x;
  const vy = corners.lb.y - corners.lt.y;
  const bandH = Math.max(1, Math.round(Math.sqrt(vx * vx + vy * vy)));
  const angle = Math.atan2(uy, ux);

  const canvas = new OffscreenCanvas(bandW, bandH);
  const ctx = canvas.getContext('2d')!;
  ctx.rotate(-angle);
  ctx.translate(-corners.lt.x, -corners.lt.y);
  ctx.drawImage(bitmap, 0, 0);
  return canvas.transferToImageBitmap();
}

/**
 * 撮影画像からパイのバンド領域を切り出してJPEG Blobにする。
 * バンド検出に失敗した場合は全体画像をフォールバック。
 */
async function preparePhoto(imageUrl: string): Promise<Blob> {
  let t = performance.now();
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  if (import.meta.env.DEV) {
    console.debug(`[recognize] 画像読み込み: ${(performance.now() - t).toFixed(0)}ms`);
  }

  // バンド検出: 全画素を一度だけ取得して Worker に transfer
  t = performance.now();
  const fullCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const fullCtx = fullCanvas.getContext('2d')!;
  fullCtx.drawImage(bitmap, 0, 0);
  const fullImageData = fullCtx.getImageData(0, 0, bitmap.width, bitmap.height);

  const corners = await runDetectBand(
    new Uint8ClampedArray(fullImageData.data),
    fullImageData.width,
    fullImageData.height,
  );
  if (import.meta.env.DEV) {
    console.debug(`[recognize] バンド検出: ${(performance.now() - t).toFixed(0)}ms`);
  }

  // バンド品質判定:
  // - 幅に対して高さが十分（>15%）
  // - 元画像の面積の10%以上を占める（極端に小さい切り出しを除外）
  let isBandUsable = false;
  let bandW = 0;
  let bandH = 0;
  if (corners !== null) {
    const ux = corners.rt.x - corners.lt.x;
    const uy = corners.rt.y - corners.lt.y;
    bandW = Math.sqrt(ux * ux + uy * uy);
    const vx = corners.lb.x - corners.lt.x;
    const vy = corners.lb.y - corners.lt.y;
    bandH = Math.sqrt(vx * vx + vy * vy);
    isBandUsable = bandH / bandW > 0.15 && (bandW * bandH) / (bitmap.width * bitmap.height) > 0.1;
  }

  t = performance.now();
  let srcBitmap: ImageBitmap;
  if (isBandUsable && corners) {
    // バンド切り出し成功 → 4頂点から ImageBitmap を生成
    srcBitmap = cropBand(bitmap, corners);
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

  const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  if (import.meta.env.DEV) {
    console.debug(`[recognize] リサイズ+JPEG変換: ${(performance.now() - t).toFixed(0)}ms`);
  }

  return jpegBlob;
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
  if (import.meta.env.DEV) {
    console.debug(`[recognize] 前処理合計: ${(performance.now() - start).toFixed(0)}ms`);
  }

  const apiStart = performance.now();
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
  if (import.meta.env.DEV) {
    console.debug(`[recognize] APIリクエスト: ${(performance.now() - apiStart).toFixed(0)}ms`);
  }

  const pais = paiIds.map((paiId) => ({ paiId }));

  const total = performance.now() - start;
  if (import.meta.env.DEV) {
    console.debug(`[recognize] 全体: ${total.toFixed(0)}ms`);
  }

  return {
    pais,
    processingTimeMs: total,
  };
}
