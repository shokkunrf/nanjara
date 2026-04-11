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

test.describe('手牌ページ', () => {
  test('直接アクセスすると空の9枠が表示される', async ({ page }) => {
    await page.goto('/hand');

    await expect(page.getByRole('heading', { name: '手牌' })).toBeVisible();
    await expect(page.locator('.pai-item')).toHaveCount(9);
  });

  test('「撮影」ボタンで /camera に遷移する', async ({ page }) => {
    await page.goto('/hand');

    await page.getByRole('button', { name: '撮影' }).click();

    await expect(page).toHaveURL('/camera');
  });

  test('「ルール」ボタンで /rules に遷移する', async ({ page }) => {
    await page.goto('/hand');

    await page.getByRole('button', { name: 'ルール' }).click();

    await expect(page).toHaveURL('/rules');
  });
});
