/** 検出されたパイ領域を識別するサービス */

import type { DetectedRegion, PaiHashMap, RecognitionResult } from '../types.js';
import { computePhash, findClosestMatch } from './phash.js';

export class RecognitionError extends Error {
  override readonly name = 'RecognitionError';
}

const MAX_HAMMING_DISTANCE = 64;

let hashMapCache: PaiHashMap | null = null;

async function loadHashMap(): Promise<PaiHashMap> {
  if (hashMapCache) {
    return hashMapCache;
  }

  const response = await fetch('/pai-hashes.json');
  if (!response.ok) {
    throw new RecognitionError(`Failed to load pai-hashes.json: ${response.status}`);
  }

  const data: PaiHashMap = await response.json();
  hashMapCache = data;
  return data;
}

/**
 * 検出されたパイ領域を識別し、各パイのIDとconfidenceを返す。
 *
 * @param regions - pai-detector.detect() が返した検出領域の配列
 * @returns 識別結果（pais配列 + 処理時間）
 * @throws {RecognitionError} ハッシュデータの取得失敗時
 */
export async function recognize(regions: DetectedRegion[]): Promise<RecognitionResult> {
  const start = performance.now();

  const hashMap = await loadHashMap();

  const pais = regions.map((region) => {
    const hash = computePhash(region.imageData);
    const match = findClosestMatch(hash, hashMap);
    const confidence = 1 - match.distance / MAX_HAMMING_DISTANCE;

    return {
      paiId: match.paiId,
      confidence,
    };
  });

  return {
    pais,
    processingTimeMs: performance.now() - start,
  };
}
