/** ブラウザ内で動作するpHash（知覚ハッシュ）計算モジュール */

import type { PaiHashMap, PaiId } from '../types.js';
import { computePhashFromRgba, hammingDistance } from '../core/phash.js';

export { hammingDistance };

export class EmptyHashMapError extends Error {
  override readonly name = 'EmptyHashMapError';

  constructor() {
    super('hashMap is empty');
  }
}

/**
 * ImageDataからpHashを計算する。
 *
 * @param imageData - RGBA形式、任意サイズ
 * @returns 16文字の16進数文字列（64bit pHash）
 */
export function computePhash(imageData: ImageData): string {
  return computePhashFromRgba(imageData.data, imageData.width, imageData.height);
}

/**
 * hashMapの中から最もハミング距離が小さいパイを返す。
 *
 * @throws {EmptyHashMapError} hashMapが空の場合
 */
export function findClosestMatch(
  hash: string,
  hashMap: PaiHashMap,
): { paiId: PaiId; distance: number } {
  const entries = Object.entries(hashMap);
  if (entries.length === 0) {
    throw new EmptyHashMapError();
  }

  let closestPaiId: PaiId = entries[0][0];
  let minDistance = hammingDistance(hash, entries[0][1]);

  for (let i = 1; i < entries.length; i++) {
    const [paiId, refHash] = entries[i];
    const dist = hammingDistance(hash, refHash);
    if (dist < minDistance) {
      minDistance = dist;
      closestPaiId = paiId;
    }
  }

  return { paiId: closestPaiId, distance: minDistance };
}
