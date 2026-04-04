/**
 * extractBand を Web Worker で実行するためのワーカー。
 * メインスレッドのUI操作をブロックしない。
 */
import { extractBand } from './pai-detector.js';

export interface ExtractBandRequest {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface ExtractBandResult {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

self.onmessage = (e: MessageEvent<ExtractBandRequest>) => {
  const { data, width, height } = e.data;
  const imageData = { data, width, height, colorSpace: 'srgb' } as ImageData;
  const result = extractBand(imageData);

  if (result) {
    self.postMessage(
      { data: result.data, width: result.width, height: result.height },
      { transfer: [result.data.buffer] },
    );
  } else {
    self.postMessage(null);
  }
};
