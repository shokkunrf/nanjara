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

/** URLから画像を読み込んで ImageBitmap を返す */
async function loadImage(imageUrl: string): Promise<ImageBitmap> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  return createImageBitmap(blob);
}

/** バンド検出に渡す最大解像度。これ以上はネイティブ drawImage でダウンサンプリングする。 */
const DETECT_BAND_MAX_DIM = 1920;

/**
 * Web Workerでバンド検出を実行する。
 *
 * 4K クラスの画像をそのまま worker に渡すと、getImageData と worker 内の
 * JS bilinear 縮小が高コストになる。そこでネイティブ drawImage で
 * DETECT_BAND_MAX_DIM まで先に縮小し、縮小後の imageData だけを
 * transfer する。worker の 1920 フォールバックパスにも十分な解像度を保つ。
 *
 * NOTE: ピクセルデータは getImageData で一度だけ取得し、postMessage の transfer で
 * Worker に渡す。transfer 後は main thread 側の imageData は detached になるため、
 * この関数内・呼び出し後のいずれでも参照してはいけない。
 */
function runDetectBand(bitmap: ImageBitmap): Promise<BandCorners | null> {
  const maxDim = Math.max(bitmap.width, bitmap.height);
  const scale = maxDim > DETECT_BAND_MAX_DIM ? DETECT_BAND_MAX_DIM / maxDim : 1;
  const targetW = Math.max(1, Math.round(bitmap.width * scale));
  const targetH = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = new OffscreenCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  const imageData = ctx.getImageData(0, 0, targetW, targetH);

  return new Promise((resolve) => {
    const worker = new ExtractBandWorker();
    worker.onmessage = (e: MessageEvent<DetectBandResponse>) => {
      worker.terminate();
      const corners = e.data;
      if (corners === null) {
        resolve(null);
        return;
      }
      // worker は縮小後の座標系で corners を返すので bitmap 座標に戻す
      if (scale === 1) {
        resolve(corners);
      } else {
        const inv = 1 / scale;
        resolve({
          lt: { x: corners.lt.x * inv, y: corners.lt.y * inv },
          rt: { x: corners.rt.x * inv, y: corners.rt.y * inv },
          rb: { x: corners.rb.x * inv, y: corners.rb.y * inv },
          lb: { x: corners.lb.x * inv, y: corners.lb.y * inv },
        });
      }
    };
    worker.onerror = () => {
      worker.terminate();
      resolve(null);
    };
    const req: DetectBandRequest = {
      data: imageData.data,
      width: imageData.width,
      height: imageData.height,
    };
    worker.postMessage(req, { transfer: [imageData.data.buffer] });
  });
}

/** 4頂点から幅・高さ・lt-rt 方向の傾き角度を計算する */
function bandGeometry(corners: BandCorners): { bandW: number; bandH: number; angle: number } {
  const ux = corners.rt.x - corners.lt.x;
  const uy = corners.rt.y - corners.lt.y;
  const vx = corners.lb.x - corners.lt.x;
  const vy = corners.lb.y - corners.lt.y;
  return {
    bandW: Math.sqrt(ux * ux + uy * uy),
    bandH: Math.sqrt(vx * vx + vy * vy),
    angle: Math.atan2(uy, ux),
  };
}

/** 4頂点で囲まれた領域のサイズ・縦横比が妥当か */
function isCornersUsable(bitmap: ImageBitmap, corners: BandCorners): boolean {
  const { bandW, bandH } = bandGeometry(corners);
  if (bandW < 50 || bandH < 50) return false;
  if (bandH / bandW < 0.05 || bandH / bandW > 0.6) return false;
  if ((bandW * bandH) / (bitmap.width * bitmap.height) < 0.1) return false;
  return true;
}

/**
 * 元画像にバンドの4頂点を線で描いた OffscreenCanvas を返す（同期的に bitmap をコピー）。
 * corners が null の場合は元画像のみを描画（検出失敗時のデバッグに使う）。
 */
function drawBandOverlayCanvas(bitmap: ImageBitmap, corners: BandCorners | null): OffscreenCanvas {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  if (corners) {
    ctx.strokeStyle = 'lime';
    ctx.lineWidth = Math.max(3, Math.round(bitmap.width / 300));
    ctx.beginPath();
    ctx.moveTo(corners.lt.x, corners.lt.y);
    ctx.lineTo(corners.rt.x, corners.rt.y);
    ctx.lineTo(corners.rb.x, corners.rb.y);
    ctx.lineTo(corners.lb.x, corners.lb.y);
    ctx.closePath();
    ctx.stroke();
  }
  return canvas;
}

/** canvas を JPEG にエンコードして dev server のデバッグエンドポイントに送信する */
async function sendDebugImage(canvas: OffscreenCanvas): Promise<void> {
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  const buf = await blob.arrayBuffer();
  await fetch('/__debug-image', {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: buf,
  });
}

/**
 * 4頂点で囲まれた領域を切り出しつつ長辺 maxDim にリサイズして JPEG Blob を返す。
 * 切り出し・回転補正・リサイズを一つの変換行列に合成し drawImage 1 回で済ませる。
 * 中間 ImageBitmap の確保と二重リサンプリングが消えるので cost/品質とも改善する。
 * corners が null の場合は元画像全体を対象にする。
 */
async function cropAndEncode(
  bitmap: ImageBitmap,
  corners: BandCorners | null,
  maxDim = 1024,
): Promise<Blob> {
  if (!corners) {
    // crop 不要: 全体を長辺 maxDim にリサイズして JPEG
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    const s = Math.max(srcW, srcH) > maxDim ? maxDim / Math.max(srcW, srcH) : 1;
    const w = Math.max(1, Math.round(srcW * s));
    const h = Math.max(1, Math.round(srcH * s));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  }

  const { bandW: rawW, bandH: rawH, angle } = bandGeometry(corners);
  const scale = Math.max(rawW, rawH) > maxDim ? maxDim / Math.max(rawW, rawH) : 1;
  const targetW = Math.max(1, Math.round(rawW * scale));
  const targetH = Math.max(1, Math.round(rawH * scale));

  const canvas = new OffscreenCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  // 変換を合成: src(lt) → dst(0,0), src(rt) → dst(targetW, 0)
  // target = scale × R(-angle) × (src - lt)
  // canvas は post-multiply なので scale → rotate → translate の順で適用する
  ctx.scale(scale, scale);
  ctx.rotate(-angle);
  ctx.translate(-corners.lt.x, -corners.lt.y);
  ctx.drawImage(bitmap, 0, 0);
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
}

/**
 * 撮影画像からパイのバンド領域を切り出してJPEG Blobにする。
 * バンド検出に失敗した場合は全体画像をフォールバック。
 */
async function preparePhoto(imageUrl: string): Promise<Blob> {
  let t = performance.now();
  const bitmap = await loadImage(imageUrl);
  if (import.meta.env.DEV) {
    console.debug(`[recognize] 画像読み込み: ${(performance.now() - t).toFixed(0)}ms`);
  }

  try {
    t = performance.now();
    const corners = await runDetectBand(bitmap);
    if (import.meta.env.DEV) {
      console.debug(`[recognize] バンド検出: ${(performance.now() - t).toFixed(0)}ms`);
    }

    // DEV時のみ: オーバーレイ画像を dev server に送信（fire-and-forget）
    // corners が null でも元画像だけを送ることで、検出失敗ケースの調査に使える
    if (import.meta.env.DEV) {
      const overlayCanvas = drawBandOverlayCanvas(bitmap, corners);
      sendDebugImage(overlayCanvas).catch((e) => {
        console.debug('[recognize] デバッグ画像送信失敗', e);
      });
    }

    t = performance.now();
    const usable = corners !== null && isCornersUsable(bitmap, corners);
    const jpegBlob = await cropAndEncode(bitmap, usable ? corners : null);
    if (import.meta.env.DEV) {
      console.debug(
        `[recognize] 切り出し+リサイズ+JPEG変換: ${(performance.now() - t).toFixed(0)}ms`,
      );
    }

    return jpegBlob;
  } finally {
    bitmap.close();
  }
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
