/**
 * Playwright用カメラモック
 *
 * テスト画像を撮影画像として注入するための addInitScript 設定。
 */
import type { Page } from 'playwright';

/** 指定した画像URLを撮影結果として返すカメラモックを設定する */
export async function setupCameraMock(page: Page, imageUrl: string): Promise<void> {
  await page.addInitScript((imgUrl: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const stream = canvas.captureStream(0);

    for (const track of stream.getVideoTracks()) {
      const origGetSettings = track.getSettings.bind(track);
      track.getSettings = () => ({ ...origGetSettings(), deviceId: 'mock-device' });
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: () => Promise.resolve(stream),
        enumerateDevices: () => Promise.resolve([]),
      },
      writable: true,
      configurable: true,
    });

    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (this.style.display === 'none') {
        fetch(imgUrl)
          .then((r) => r.blob())
          .then((blob) => callback(blob));
      } else {
        originalToBlob.call(this, callback, type, quality);
      }
    };
  }, imageUrl);
}

/** 撮影→認識→結果ページ遷移を実行する */
export async function captureAndRecognize(page: Page): Promise<void> {
  const shutterButton = page.getByRole('button', { name: '撮影' });
  await shutterButton.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(
    () => !document.querySelector<HTMLButtonElement>('button[aria-label="撮影"]')?.disabled,
    { timeout: 10000 },
  );
  await shutterButton.click();

  const recognizeButton = page.getByRole('button', { name: '認識する' });
  await recognizeButton.waitFor({ timeout: 5000 });
  await recognizeButton.click();

  await page.waitForURL(/\/hand/, { timeout: 60000 });
}
