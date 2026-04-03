/** 認識パイプライン: Gemini API を使用 */

import type { RecognitionResult } from '../types.js';
import { recognizeWithGemini, GeminiRecognitionError } from './gemini-recognizer.js';

export class RecognitionServiceError extends Error {
  override readonly name = 'RecognitionServiceError';
}

/**
 * 撮影画像から認識パイプラインを実行する。
 * Gemini API に写真とカタログ画像を送信して識別する。
 *
 * @param imageUrl - 撮影画像の blob URL
 * @returns 認識結果
 * @throws {RecognitionServiceError} 認識処理でエラーが発生した場合
 */
export async function recognizeImage(imageUrl: string): Promise<RecognitionResult> {
  try {
    return await recognizeWithGemini(imageUrl);
  } catch (error) {
    if (error instanceof GeminiRecognitionError) {
      throw new RecognitionServiceError(error.message, { cause: error });
    }
    throw new RecognitionServiceError(
      error instanceof Error ? error.message : 'Unknown recognition error',
      { cause: error },
    );
  }
}
