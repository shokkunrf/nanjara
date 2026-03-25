/** 撮影画像からパイ領域を検出するサービス */

import type { CV } from '@techstark/opencv-js';
import type { DetectedRegion } from '../types.js';

export class DetectionError extends Error {
  override readonly name = 'DetectionError';
}

const MAX_DIMENSION = 960;
const MIN_ASPECT_RATIO = 0.4;
const MAX_ASPECT_RATIO = 1.0;
const MIN_AREA_RATIO = 0.002;
const MAX_AREA_RATIO = 0.15;

/**
 * 撮影画像からパイ領域を検出する。
 *
 * @param cv - OpenCV.js の cv オブジェクト
 * @param imageData - 撮影画像のRGBAピクセルデータ
 * @returns 検出されたパイ領域の配列（左→右の順）
 * @throws {DetectionError} 処理中のエラー
 */
export function detect(cv: CV, imageData: ImageData): DetectedRegion[] {
  const mats: { delete(): void }[] = [];

  try {
    const original = cv.matFromImageData(imageData);
    mats.push(original);

    // 長辺が MAX_DIMENSION を超える場合リサイズ
    let src = original;
    const maxDim = Math.max(original.rows, original.cols);
    if (maxDim > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / maxDim;
      const resized = new cv.Mat();
      mats.push(resized);
      cv.resize(
        original,
        resized,
        new cv.Size(Math.round(original.cols * scale), Math.round(original.rows * scale)),
      );
      src = resized;
    }

    // グレースケール変換
    const gray = new cv.Mat();
    mats.push(gray);
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // 大津の2値化
    const binary = new cv.Mat();
    mats.push(binary);
    cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

    // 輪郭検出
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    mats.push(hierarchy);
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const imageArea = src.rows * src.cols;
    const regions: DetectedRegion[] = [];

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const rect = cv.boundingRect(contour);

      // アスペクト比フィルタ
      const aspectRatio = rect.width / rect.height;
      if (aspectRatio < MIN_ASPECT_RATIO || aspectRatio > MAX_ASPECT_RATIO) {
        continue;
      }

      // 面積フィルタ
      const areaRatio = (rect.width * rect.height) / imageArea;
      if (areaRatio < MIN_AREA_RATIO || areaRatio > MAX_AREA_RATIO) {
        continue;
      }

      // 領域の切り出し（roiは親Matのバッファを共有するためcloneで連続メモリにする）
      const roi = src.roi(rect);
      const roiClone = roi.clone();
      roi.delete();
      mats.push(roiClone);
      const roiData = new Uint8ClampedArray(roiClone.data.buffer.slice(0));
      const regionImageData = {
        data: roiData,
        width: rect.width,
        height: rect.height,
        colorSpace: 'srgb',
      } as ImageData;

      regions.push({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        imageData: regionImageData,
      });
    }

    contours.delete();

    // 左→右の順でソート
    regions.sort((a, b) => a.x - b.x);

    return regions;
  } catch (error) {
    if (error instanceof DetectionError) {
      throw error;
    }
    throw new DetectionError(error instanceof Error ? error.message : 'Unknown detection error', {
      cause: error,
    });
  } finally {
    for (const mat of mats) {
      mat.delete();
    }
  }
}
