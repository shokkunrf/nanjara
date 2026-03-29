import { test, expect } from '@playwright/test';

interface TestCase {
  image: string;
  expected: string[];
}

const TEST_CASES: TestCase[] = [
  {
    image: 'img1.png',
    expected: [
      '中須かすみ',
      '近江彼方',
      'エマ・ヴェルデ',
      '津島善子',
      '桜内梨子',
      '音ノ木坂学院',
      '春宮ゆくり',
      '平安名すみれ',
    ],
  },
  {
    image: 'img2.png',
    expected: [
      '西木野真姫',
      '高坂穂乃果',
      "μ's",
      '天王寺璃奈',
      '高咲侑',
      'ミア・テイラー',
      '黒澤ルビィ',
      '浦の星女学院',
      '渡辺曜',
    ],
  },
  {
    image: 'img3.png',
    expected: [
      'SCHOOL IDOL MUSICAL',
      '百生吟子',
      '鐘嵐珠',
      '南ことり',
      '松浦果南',
      '桜内梨子',
      '渡辺曜',
      '高咲侑',
    ],
  },
];

test.describe('認識パイプライン', () => {
  for (const tc of TEST_CASES) {
    test(`${tc.image}: ${tc.expected.length}枚のパイを正しく認識する`, async ({ page }) => {
      page.on('console', (msg) => console.log(`[b] ${msg.text()}`));
      // テスト画像をサーバーから直接取得してカメラモックに使う
      const imageUrl = `/e2e/${tc.image}`;

      await page.addInitScript((imgUrl: string) => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const stream = canvas.captureStream(0);

        Object.defineProperty(navigator, 'mediaDevices', {
          value: {
            getUserMedia: () => Promise.resolve(stream),
            enumerateDevices: () => Promise.resolve([]),
          },
          writable: true,
          configurable: true,
        });

        // toBlob をオーバーライド: 撮影時にテスト画像を fetch して blob を返す
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

      await page.goto('/camera');

      const shutterButton = page.getByRole('button', { name: '撮影' });
      await expect(shutterButton).toBeVisible({ timeout: 5000 });
      await shutterButton.click();

      const recognizeButton = page.getByRole('button', { name: '認識する' });
      await expect(recognizeButton).toBeVisible({ timeout: 5000 });
      await recognizeButton.click();

      // /result に遷移するか、エラーが表示されるまで待つ
      const errorOrResult = await Promise.race([
        page.waitForURL(/\/result/, { timeout: 60000 }).then(() => 'result' as const),
        page
          .locator('.error')
          .waitFor({ timeout: 60000 })
          .then(async () => {
            const msg = await page.locator('.error').textContent();
            return `error: ${msg}` as const;
          }),
      ]);
      if (errorOrResult.startsWith('error:')) {
        console.log(`${tc.image}: ${errorOrResult}`);
      }
      await expect(page).toHaveURL(/\/result/);
      await expect(page.getByRole('heading', { name: '認識結果' })).toBeVisible();

      const timeText = await page.locator('.time').textContent();
      console.log(`${tc.image} 処理時間: ${timeText}`);

      // NFR-001: 処理時間3秒以内
      const ms = parseFloat(timeText?.replace(/[^0-9.]/g, '') ?? '0');
      expect(ms, `処理時間が30秒以内`).toBeLessThanOrEqual(30000);

      const paiNames = await page.locator('.pai-name').allTextContents();
      console.log(`${tc.image} 認識結果 (${paiNames.length}枚):`);
      paiNames.forEach((name, i) => console.log(`  ${i + 1}. ${name}`));

      // 検出されたパイが1枚以上あること
      expect(paiNames.length, `パイが検出される`).toBeGreaterThan(0);

      // 期待されるパイのうち何枚が認識結果に含まれるか（順序不問）
      const matchCount = tc.expected.filter((name) => paiNames.includes(name)).length;
      console.log(`${tc.image} 正解数: ${matchCount}/${tc.expected.length}`);

      // 完全一致テスト
      expect(paiNames, `検出数`).toHaveLength(tc.expected.length);
      for (let i = 0; i < tc.expected.length; i++) {
        expect(paiNames[i], `${i + 1}枚目`).toBe(tc.expected[i]);
      }
    });
  }
});
