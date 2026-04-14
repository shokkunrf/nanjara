/**
 * detectBand を Web Worker で実行するためのワーカー。
 * メインスレッドのUI操作をブロックしない。
 */
import { detectBand, type BandCorners } from './pai-detector.js';

export interface DetectBandRequest {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export type DetectBandResponse = BandCorners | null;

self.onmessage = (e: MessageEvent<DetectBandRequest>) => {
  const { data, width, height } = e.data;
  const imageData = { data, width, height, colorSpace: 'srgb' } as ImageData;
  const result = detectBand(imageData);
  self.postMessage(result);
};
