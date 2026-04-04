/**
 * Gemini 3.1 Flash Lite による麻雀パイ認識サービス
 *
 * 4枚のカタログ画像（参照パイ84種）と撮影写真を送信し、
 * 写真内のパイIDをJSON配列で取得する。
 */

import { PUBLIC_GEMINI_API_KEY, PUBLIC_GEMINI_MODEL } from '$env/static/public';
import type { PaiId, RecognitionResult } from '../types.js';

export class GeminiRecognitionError extends Error {
  override readonly name = 'GeminiRecognitionError';
}

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${PUBLIC_GEMINI_MODEL}:generateContent`;
const CATALOG_COUNT = 4;

/** カタログ画像のBase64キャッシュ */
let catalogCache: string[] | null = null;

/** 番号→ID対応テキスト（プロンプト用） */
let idListCache: string | null = null;

/** 3桁番号→PaiId の対応マップ */
let numberToIdMap: Map<string, PaiId> | null = null;

async function loadCatalogs(): Promise<string[]> {
  if (catalogCache) return catalogCache;

  const catalogs: string[] = [];
  for (let i = 1; i <= CATALOG_COUNT; i++) {
    const response = await fetch(`/catalog-images/pai-catalog-${i}.png`);
    if (!response.ok) {
      throw new GeminiRecognitionError(
        `Failed to load catalog-images/pai-catalog-${i}.png: ${response.status}`,
      );
    }
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);
    catalogs.push(base64);
  }

  catalogCache = catalogs;
  return catalogs;
}

async function loadIdList(): Promise<string> {
  if (idListCache) return idListCache;

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

  idListCache = ids.map((id) => `${id.substring(0, 3)}: ${id}`).join('\n');
  return idListCache;
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
  return `以下に4枚の参照カタログ画像を提示します。各カタログは7列×3行のグリッドに21種の麻雀パイが並び、各セル下に3桁番号があります。

最後の1枚が撮影写真です。カタログの絵柄と視覚的に比較し識別してください。

## 識別のコツ
- 各パイには特徴的な背景色があります（ピンク、青、オレンジ、黄色、緑、紫、赤など）
- まず背景色で候補を絞り、次に髪型・髪色で確定させてください
- 背景色が似ているパイが複数ある場合は、髪型（ストレート/ツインテール/ショート/ポニーテール/三つ編み等）やアクセサリー（リボン・髪飾り）で判別してください
- ロゴ系のパイ（文字やエンブレム）は文字やデザインで判断してください
- 影や反射で色が変わって見えることがあります。絵柄の形状を重視してください

## 番号→ID対応
${idList}

## ルール
- 裏向き（ピンク無地）パイは無視
- 横並びなら左→右、縦並びなら上→下の順
- カタログの絵柄と写真のパイを見比べて最も似ているものを選ぶ
- 同じ番号を2回以上使わないこと。各パイはユニークなので結果に重複があってはならない
- 3桁番号のみのJSON配列を返す（例: ["003","008","015"]）`;
}

/** Gemini API に1回リクエストを送信してパイIDの配列を取得 */
async function callGeminiOnce(
  catalogs: string[],
  idList: string,
  photos: string[],
): Promise<PaiId[]> {
  const parts: Record<string, unknown>[] = [
    { text: buildPrompt(idList) },
    ...catalogs.map((c) => ({ inline_data: { mime_type: 'image/png', data: c } })),
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

  const [catalogs, idList, photos] = await Promise.all([
    loadCatalogs(),
    loadIdList(),
    preparePhoto(imageUrl),
  ]);

  const paiIds = await callGeminiOnce(catalogs, idList, photos);

  const pais = paiIds.map((paiId) => ({
    paiId,
    confidence: 1.0,
  }));

  return {
    pais,
    processingTimeMs: performance.now() - start,
  };
}
