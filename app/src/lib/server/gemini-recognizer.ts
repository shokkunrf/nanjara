import { read } from '$app/server';
import { GEMINI_API_KEY, GEMINI_MODEL } from '$env/static/private';
import sharp from 'sharp';
import catalog1 from '$lib/server/assets/pai-catalog-1.png';
import catalog2 from '$lib/server/assets/pai-catalog-2.png';
import catalog3 from '$lib/server/assets/pai-catalog-3.png';
import catalog4 from '$lib/server/assets/pai-catalog-4.png';
import paiDetailsJson from '../../../static/pai-details.json';

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** カタログ画像のBase64キャッシュ */
let catalogCache: string[] | null = null;

async function loadCatalogs(): Promise<string[]> {
  if (catalogCache) return catalogCache;

  const catalogs: string[] = [];
  for (const src of [catalog1, catalog2, catalog3, catalog4]) {
    const res = read(src);
    const buf = await res.arrayBuffer();
    catalogs.push(Buffer.from(buf).toString('base64'));
  }

  catalogCache = catalogs;
  return catalogs;
}

function buildPrompt(numberToIdMap: Map<string, string>): string {
  const idList = [...numberToIdMap.entries()].map(([num, id]) => `${num}: ${id}`).join('\n');
  return `以下に4枚の参照カタログ画像を提示します。各カタログは7列×3行のグリッドに21種の麻雀パイが並び、各セル下に3桁番号があります。

最後の2枚が撮影写真です（同じ写真の色調違い）。両方を見比べてカタログの絵柄と視覚的に比較し識別してください。

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
- 3桁番号のみのJSON配列を返す（例: ["003","008","015"])`;
}

/** 画像全体に一様な明度・コントラスト補正 */
function uniformBrightness(data: Uint8ClampedArray, brightness: number, contrast: number): void {
  const factor = contrast;
  const offset = 128 * (1 - contrast) + (brightness - 1) * 255;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, data[i] * factor + offset)) | 0;
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor + offset)) | 0;
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor + offset)) | 0;
  }
}

/** 彩度をブーストする（HSL空間で彩度を乗算） */
function boostSaturation(data: Uint8ClampedArray, factor: number): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255,
      g = data[i + 1] / 255,
      b = data[i + 2] / 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) continue;
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    const ns = Math.min(1, s * factor);
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q2 = l < 0.5 ? l * (1 + ns) : l + ns - l * ns;
    const p2 = 2 * l - q2;
    data[i] = Math.min(255, Math.max(0, hue2rgb(p2, q2, h + 1 / 3) * 255 + 0.5)) | 0;
    data[i + 1] = Math.min(255, Math.max(0, hue2rgb(p2, q2, h) * 255 + 0.5)) | 0;
    data[i + 2] = Math.min(255, Math.max(0, hue2rgb(p2, q2, h - 1 / 3) * 255 + 0.5)) | 0;
  }
}

/**
 * 1枚の写真バッファから無加工版と色調補正版の2枚のBase64を生成する。
 */
async function preparePhotos(photoBuffer: Buffer): Promise<string[]> {
  const base64Original = photoBuffer.toString('base64');

  const { data, info } = await sharp(photoBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  uniformBrightness(pixels, 1.15, 1.4);
  boostSaturation(pixels, 1.6);

  const correctedBuffer = await sharp(Buffer.from(pixels.buffer), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .jpeg({ quality: 85 })
    .toBuffer();

  return [base64Original, correctedBuffer.toString('base64')];
}

/**
 * 撮影写真からパイを識別する。
 * カタログ画像と写真をGemini APIに送信し、識別されたパイIDの配列を返す。
 *
 * @param photoBuffer - 撮影写真のJPEGバッファ
 * @returns パイIDの配列
 */
export async function recognizePais(photoBuffer: Buffer): Promise<string[]> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const [catalogs, preparedPhotos] = await Promise.all([
    loadCatalogs(),
    preparePhotos(photoBuffer),
  ]);

  const details: Record<string, { name: string }> = paiDetailsJson;
  const ids = Object.keys(details).sort();
  const numberToIdMap = new Map<string, string>();
  for (const id of ids) {
    numberToIdMap.set(id.substring(0, 3), id);
  }

  const parts: Record<string, unknown>[] = [
    { text: buildPrompt(numberToIdMap) },
    ...catalogs.map((c) => ({ inline_data: { mime_type: 'image/png', data: c } })),
    ...preparedPhotos.map((p) => ({ inline_data: { mime_type: 'image/jpeg', data: p } })),
  ];

  const body = {
    contents: [{ parts }],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0,
    },
  };

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const responseParts = data.candidates?.[0]?.content?.parts ?? [];
  const text = responseParts.filter((p: { thought?: boolean }) => !p.thought).pop()?.text;
  if (!text) {
    throw new Error('No text in Gemini response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from Gemini: ${text.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error(
      `Unexpected Gemini response format: expected string[], got: ${text.slice(0, 200)}`,
    );
  }

  const numbers: string[] = parsed;

  return numbers
    .map((n) => {
      const padded = n.padStart(3, '0');
      return numberToIdMap.get(padded) ?? null;
    })
    .filter((id): id is string => id !== null);
}
