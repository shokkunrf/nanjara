import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CameraResult from './CameraResult.svelte';

vi.mock('$lib/services/recognition-service.js', () => ({
  recognizeImage: vi.fn().mockResolvedValue({ pais: [], processingTimeMs: 0 }),
}));

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
}));

vi.mock('$app/paths', () => ({
  resolve: (path: string) => path,
}));

describe('CameraResult', () => {
  it('撮影画像を表示する', async () => {
    render(CameraResult, { imageUrl: 'blob:http://localhost/test', onretake: vi.fn() });

    const img = page.getByRole('img', { name: '撮影画像' });
    await expect.element(img).toBeInTheDocument();
    await expect.element(img).toHaveAttribute('src', 'blob:http://localhost/test');
  });

  it('再撮影ボタンをクリックするとonretakeが呼ばれる', async () => {
    const onretake = vi.fn();
    render(CameraResult, { imageUrl: 'blob:http://localhost/test', onretake });

    await page.getByRole('button', { name: '再撮影' }).click();
    expect(onretake).toHaveBeenCalledOnce();
  });

  it('「認識する」ボタンが表示される', async () => {
    render(CameraResult, { imageUrl: 'blob:http://localhost/test', onretake: vi.fn() });

    const btn = page.getByRole('button', { name: '認識する' });
    await expect.element(btn).toBeInTheDocument();
  });
});
