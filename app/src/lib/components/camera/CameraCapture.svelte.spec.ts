import { page } from 'vitest/browser';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CameraCapture from './CameraCapture.svelte';

function createFakeMediaStream() {
  const track = { stop: vi.fn(), kind: 'video' } as unknown as MediaStreamTrack;
  const stream = new MediaStream();
  vi.spyOn(stream, 'getTracks').mockReturnValue([track]);
  return stream;
}

let getUserMediaMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  getUserMediaMock = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: getUserMediaMock },
    writable: true,
    configurable: true,
  });
});

describe('CameraCapture', () => {
  describe('エラーハンドリング', () => {
    it('NotFoundErrorでカメラが見つからないメッセージを表示する', async () => {
      getUserMediaMock.mockRejectedValue(new DOMException('', 'NotFoundError'));

      render(CameraCapture, { oncapture: vi.fn() });

      await expect
        .element(
          page.getByText('カメラが見つかりません。カメラが接続されているか確認してください。'),
        )
        .toBeInTheDocument();
    });

    it('NotAllowedErrorで許可メッセージを表示する', async () => {
      getUserMediaMock.mockRejectedValue(new DOMException('', 'NotAllowedError'));

      render(CameraCapture, { oncapture: vi.fn() });

      await expect
        .element(
          page.getByText(
            'カメラの使用が許可されていません。ブラウザの設定からカメラへのアクセスを許可してください。',
          ),
        )
        .toBeInTheDocument();
    });

    it('NotReadableErrorでアクセスエラーメッセージを表示する', async () => {
      getUserMediaMock.mockRejectedValue(new DOMException('', 'NotReadableError'));

      render(CameraCapture, { oncapture: vi.fn() });

      await expect
        .element(
          page.getByText(
            'カメラにアクセスできません。他のアプリがカメラを使用している可能性があります。',
          ),
        )
        .toBeInTheDocument();
    });

    it('予期しないエラーで汎用メッセージを表示する', async () => {
      getUserMediaMock.mockRejectedValue(new Error('unknown'));

      render(CameraCapture, { oncapture: vi.fn() });

      await expect
        .element(page.getByText('カメラの起動中に予期しないエラーが発生しました。'))
        .toBeInTheDocument();
    });

    it('エラー時はシャッターボタンを表示しない', async () => {
      getUserMediaMock.mockRejectedValue(new DOMException('', 'NotFoundError'));

      render(CameraCapture, { oncapture: vi.fn() });

      await expect
        .element(
          page.getByText('カメラが見つかりません。カメラが接続されているか確認してください。'),
        )
        .toBeInTheDocument();
      expect(page.getByRole('button', { name: '撮影' }).elements()).toHaveLength(0);
    });
  });

  describe('カメラ起動', () => {
    it('カメラ起動成功時にシャッターボタンが有効になる', async () => {
      getUserMediaMock.mockResolvedValue(createFakeMediaStream());

      render(CameraCapture, { oncapture: vi.fn() });

      const shutter = page.getByRole('button', { name: '撮影' });
      await expect.element(shutter).toBeEnabled();
    });
  });
});
