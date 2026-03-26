import { test, expect } from '@playwright/test';

test.describe('トップページ', () => {
  test('タイトルと撮影ボタンが表示される', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'nanjara' })).toBeVisible();
    await expect(page.getByRole('link', { name: '撮影する' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ルール一覧' })).toBeVisible();
  });

  test('「撮影する」リンクで /camera に遷移する', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: '撮影する' }).click();

    await expect(page).toHaveURL('/camera');
  });

  test('「ルール一覧」リンクで /rules に遷移する', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'ルール一覧' }).click();

    await expect(page).toHaveURL('/rules');
  });
});

test.describe('ルール一覧ページ', () => {
  test('ルールが一覧表示される', async ({ page }) => {
    await page.goto('/rules');

    await expect(page.getByRole('heading', { name: 'ルール一覧' })).toBeVisible();

    const items = page.locator('.rule-item');
    await expect(items.first()).toBeVisible();
    expect(await items.count()).toBeGreaterThan(30);
  });

  test('「← 戻る」ボタンでトップに戻る', async ({ page }) => {
    await page.goto('/rules');

    await page.getByRole('button', { name: '← 戻る' }).click();

    await expect(page).toHaveURL('/');
  });
});

test.describe('認識結果ページ', () => {
  test('直接アクセスすると「認識結果がありません」が表示される', async ({ page }) => {
    await page.goto('/result');

    await expect(page.getByText('認識結果がありません')).toBeVisible();
    await expect(page.getByRole('button', { name: '撮影する' })).toBeVisible();
  });

  test('「撮影する」ボタンで /camera に遷移する', async ({ page }) => {
    await page.goto('/result');

    await page.getByRole('button', { name: '撮影する' }).click();

    await expect(page).toHaveURL('/camera');
  });
});
