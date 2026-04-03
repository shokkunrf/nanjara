/**
 * Gemini 3.1 Flash Lite による麻雀パイ認識サービス
 *
 * 撮影写真を送信し、写真内のパイIDをJSON配列で取得する。
 */

import { PUBLIC_GEMINI_API_KEY, PUBLIC_GEMINI_MODEL } from '$env/static/public';
import type { PaiId, RecognitionResult } from '../types.js';

export class GeminiRecognitionError extends Error {
  override readonly name = 'GeminiRecognitionError';
}

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${PUBLIC_GEMINI_MODEL}:generateContent`;

/** カタログキャッシュ */
let catalogCache: { idList: string; images: { number: string; base64: string }[] } | null = null;

/** 3桁番号→PaiId の対応マップ */
let numberToIdMap: Map<string, PaiId> | null = null;

async function loadCatalog(): Promise<{ idList: string; images: { number: string; base64: string }[] }> {
  if (catalogCache) return catalogCache;

  const response = await fetch('/pai-details.json');
  if (!response.ok) {
    throw new GeminiRecognitionError(`Failed to load pai-details.json: ${response.status}`);
  }
  const details: Record<string, { name: string }> = await response.json();
  const ids = Object.keys(details).sort();

  // 番号→ID対応マップを構築
  numberToIdMap = new Map();
  for (const id of ids) {
    numberToIdMap.set(id.substring(0, 3), id as PaiId);
  }

  const idList = ids.map((id) => `${id.substring(0, 3)}: ${id}`).join('\n');

  // 84枚のカタログ画像を並列で取得しBase64化
  const images = await Promise.all(
    ids.map(async (id) => {
      const res = await fetch(`/pai-images/${id}`);
      const blob = await res.blob();
      const base64 = await blobToBase64(blob);
      return { number: id.substring(0, 3), base64 };
    }),
  );

  catalogCache = { idList, images };
  return catalogCache;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data:image/png;base64,... → base64部分のみ
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 撮影画像をリサイズしてBase64化する。
 */
async function preparePhoto(imageUrl: string): Promise<string[]> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  // 長辺1024pxにリサイズ
  const maxDim = Math.max(bitmap.width, bitmap.height);
  const scale = maxDim > 1024 ? 1024 / maxDim : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  const base64 = await blobToBase64(jpegBlob);

  return [base64];
}

function buildPrompt(idList: string): string {
  return `撮影写真に写っている麻雀パイを識別してください。
参考画像として各パイのカタログ画像を番号順（001〜084）に添付しています。撮影写真は最後の画像です。

## 識別のコツ
- 各パイには特徴的な背景色があります（ピンク、青、オレンジ、黄色、緑、紫、赤など）
- まず背景色で候補を絞り、次に髪型・髪色で確定させてください
- ロゴ系のパイ（文字やエンブレム）は文字やデザインで判断してください
- 影や反射で色が変わって見えることがあります。絵柄の形状を重視してください
- カタログ画像と撮影写真を見比べて最も一致するパイを選んでください

## 番号→ID対応
${idList}

## ルール
- 裏向き（ピンク無地）パイは無視
- 横並びなら左→右、縦並びなら上→下の順
- 同じ番号を2回以上使わないこと。各パイはユニークなので結果に重複があってはならない
- 3桁番号のみのJSON配列を返す（例: ["003","008","015"]）`;
}

/** Gemini API に1回リクエストを送信してパイIDの配列を取得 */
async function callGeminiOnce(
  idList: string,
  catalogImages: { number: string; base64: string }[],
  photos: string[],
): Promise<PaiId[]> {
  const parts: Record<string, unknown>[] = [
    { text: buildPrompt(idList) },
    ...catalogImages.map((img) => ({ inline_data: { mime_type: 'image/png', data: img.base64 } })),
    ...photos.map((p) => ({ inline_data: { mime_type: 'image/jpeg', data: p } })),
  ];

  const body = {
    contents: [{ parts }],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0,
    },
  };

  const response = await fetch(`${API_URL}?key=${PUBLIC_GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new GeminiRecognitionError(
      `Gemini API error ${response.status}: ${errorText.slice(0, 200)}`,
    );
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new GeminiRecognitionError('No text in Gemini response');
  }

  const numbers: string[] = JSON.parse(text);
  return numbers
    .map((n) => {
      const padded = n.padStart(3, '0');
      return numberToIdMap?.get(padded) ?? null;
    })
    .filter((id): id is PaiId => id !== null);
}

/**
 * 撮影画像からGemini APIでパイを認識する。
 *
 * @param imageUrl - 撮影画像の blob URL
 * @returns 認識結果
 */
export async function recognizeWithGemini(imageUrl: string): Promise<RecognitionResult> {
  if (!PUBLIC_GEMINI_API_KEY) {
    throw new GeminiRecognitionError('GEMINI_API_KEY is not configured');
  }

  const start = performance.now();

  const [catalog, photos] = await Promise.all([
    loadCatalog(),
    preparePhoto(imageUrl),
  ]);

  const paiIds = await callGeminiOnce(catalog.idList, catalog.images, photos);

  const pais = paiIds.map((paiId) => ({
    paiId,
    confidence: 1.0,
  }));

  return {
    pais,
    processingTimeMs: performance.now() - start,
  };
}
