import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CameraResult from './CameraResult.svelte';

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
}));

vi.mock('$app/paths', () => ({
  resolve: (path: string) => path,
}));

const defaultProps = {
  imageUrl: 'blob:http://localhost/test',
  recognitionPromise: Promise.resolve({ pais: [], processingTimeMs: 0 }),
  onretake: vi.fn(),
};

describe('CameraResult', () => {
  it('撮影画像を表示する', async () => {
    render(CameraResult, defaultProps);

    const img = page.getByRole('img', { name: '撮影画像' });
    await expect.element(img).toBeInTheDocument();
    await expect.element(img).toHaveAttribute('src', 'blob:http://localhost/test');
  });

  it('再撮影ボタンをクリックするとonretakeが呼ばれる', async () => {
    const onretake = vi.fn();
    render(CameraResult, { ...defaultProps, onretake });

    await page.getByRole('button', { name: '再撮影' }).click();
    expect(onretake).toHaveBeenCalledOnce();
  });

  it('「認識する」ボタンが表示される', async () => {
    render(CameraResult, defaultProps);

    const btn = page.getByRole('button', { name: '認識する' });
    await expect.element(btn).toBeInTheDocument();
  });
});
