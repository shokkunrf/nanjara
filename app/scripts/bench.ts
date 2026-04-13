/**
 * 認識精度チェック＆処理時間計測スクリプト
 *
 * 専用ポート(5174)でdev serverを自動起動し、Playwright でアプリの実フローを通して
 * 認識精度と処理時間を集計する。
 *
 * 使い方:
 *   npm run bench            # 全テストケース
 *   npm run bench -- img1    # ファイル名先頭一致で1枚だけ実行
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { BASE_URL, startDevServer, stopDevServer } from './dev-server.ts';
import { setupCameraMock, captureAndRecognize } from './camera-mock.ts';

const filterArg = process.argv[2];

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
  {
    image: 'img4.jpg',
    expected: [
      "μ's",
      '嵐千砂都',
      '高橋ポルカ',
      '蓮ノ空女学院',
      'SCHOOL IDOL MUSICAL',
      '近江彼方',
      '星空凛',
      '園田海未',
      '若槻ミスズ',
    ],
  },
  {
    image: 'img5.jpg',
    expected: [
      '徒町小鈴',
      '嵐千砂都',
      '近江彼方',
      '此花輝夜',
      'エマ・ヴェルデ',
      '来栖トア',
      'SCHOOL IDOL MUSICAL',
      '高橋ポルカ',
    ],
  },
  {
    image: 'img6.jpg',
    expected: [
      '唐可可',
      '浦の星女学院',
      'ウィーン・マルガレーテ',
      '桜坂しずく',
      'ミア・テイラー',
      '上原歩夢',
      '米女メイ',
      '高海千歌',
      '駒形花火',
    ],
  },
  {
    image: 'img7.jpg',
    expected: [
      '高咲侑',
      '西木野真姫',
      '朝香果林',
      '鬼塚冬毬',
      '安養寺姫芽',
      '小泉花陽',
      '高坂穂乃果',
      '桜小路きな子',
      '北条ユキノ',
    ],
  },
  {
    image: 'img8.jpg',
    expected: [
      '松浦果南',
      '星空凛',
      '園田海未',
      '若槻ミスズ',
      '矢澤にこ',
      '春宮ゆくり',
      '村野さやか',
      '国木田花丸',
      '東條希',
    ],
  },
  {
    image: 'img9.jpg',
    expected: [
      '大沢瑠璃乃',
      '若菜四季',
      '滝沢アンズ',
      '三船栞子',
      '中須かすみ',
      '宮下愛',
      '天王寺璃奈',
      'Love学院高等学校',
      '桜内梨子',
    ],
  },
];

async function run() {
  console.log('dev server を起動中...');

  const serverLogs: string[] = [];
  await startDevServer((line) => {
    if (line.includes('[recognize:server]')) {
      serverLogs.push(line);
    }
  });
  console.log('dev server 起動完了');

  const outputDir = path.resolve(
    new URL('.', import.meta.url).pathname,
    '..',
    'static',
    'e2e',
    'output',
  );
  fs.mkdirSync(outputDir, { recursive: true });

  let totalCorrect = 0;
  let totalExpected = 0;
  const times: number[] = [];

  const cases = filterArg ? TEST_CASES.filter((tc) => tc.image.startsWith(filterArg)) : TEST_CASES;
  if (cases.length === 0) {
    console.error(`"${filterArg}" に一致するテストケースがありません`);
    stopDevServer(1);
  }

  const browser = await chromium.launch();

  try {
    for (const tc of cases) {
      serverLogs.length = 0;
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const imageUrl = `/e2e/input/${tc.image}`;

      const clientLogs: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'debug' && msg.text().startsWith('[recognize]')) {
          clientLogs.push(msg.text());
        }
      });

      // Gemini APIリクエストをインターセプトして送信画像を保存
      let geminiPhotoBase64: string | undefined;
      page.on('request', (req) => {
        if (req.url().includes('generativelanguage.googleapis.com')) {
          try {
            const body = JSON.parse(req.postData() ?? '{}');
            const parts: { inline_data?: { mime_type: string; data: string } }[] =
              body.contents?.[0]?.parts ?? [];
            const jpegs = parts.filter((p) => p.inline_data?.mime_type === 'image/jpeg');
            if (jpegs.length > 0) {
              geminiPhotoBase64 = jpegs[jpegs.length - 1].inline_data!.data;
            }
          } catch {
            // リクエストボディのパースに失敗した場合は無視
          }
        }
      });

      await setupCameraMock(page, imageUrl);
      await page.goto(`${BASE_URL}/camera`);

      // 結果ページまたはエラーを待つ
      const errorOrResult = await Promise.race([
        captureAndRecognize(page).then(() => 'result' as const),
        page
          .locator('.error')
          .waitFor({ timeout: 60000 })
          .then(() => 'error' as const),
      ]);

      if (errorOrResult === 'error') {
        console.log(`${tc.image}: エラー（スキップ）`);
        await context.close();
        continue;
      }

      // Geminiに送信した画像を保存
      if (geminiPhotoBase64) {
        const baseName = tc.image.replace(/\.[^.]+$/, '');
        const outPath = path.join(outputDir, `${baseName}_gemini.jpg`);
        fs.writeFileSync(outPath, Buffer.from(geminiPhotoBase64, 'base64'));
      }

      // 処理時間
      const timeText = await page.locator('.time').textContent();
      const ms = parseFloat(timeText?.replace(/[^0-9.]/g, '') ?? '0');
      times.push(ms);

      // pai-details.json の読み込み完了を待つ（名前がIDのままでなくなるまで）
      await page
        .waitForFunction(
          () => {
            const names = document.querySelectorAll('.pai-name');
            return names.length > 0 && ![...names].some((el) => el.textContent?.endsWith('.png'));
          },
          { timeout: 5000 },
        )
        .catch(() => {});

      // 認識結果
      const paiNames = await page.locator('.pai-name').allTextContents();

      // 精度集計
      let correct = 0;
      const maxLen = Math.max(tc.expected.length, paiNames.length);
      for (let i = 0; i < maxLen; i++) {
        const mark = tc.expected[i] === paiNames[i] ? '✓' : '✗';
        if (mark === '✓') correct++;
        const expected = tc.expected[i] ?? '—';
        const actual = paiNames[i] ?? '—';
        console.log(`  ${mark} ${i + 1}. ${actual}${mark === '✗' ? ` (期待: ${expected})` : ''}`);
      }

      totalCorrect += correct;
      totalExpected += tc.expected.length;

      console.log(`${tc.image}: ${correct}/${tc.expected.length} — ${ms.toFixed(0)}ms`);

      await new Promise((r) => setTimeout(r, 500));
      console.log('─'.repeat(40));
      console.log('クライアント:');
      for (const log of clientLogs) console.log(`  ${log}`);
      console.log('サーバー:');
      for (const log of serverLogs) console.log(`  ${log}`);
      console.log('─'.repeat(40));
      console.log();
      await context.close();
    }

    await browser.close();

    // 集計
    console.log('========================================');
    console.log(
      `合計: ${totalCorrect}/${totalExpected} (${((totalCorrect / totalExpected) * 100).toFixed(1)}%)`,
    );
    if (times.length > 0) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`平均処理時間: ${avg.toFixed(0)}ms`);
    }
  } catch (err) {
    console.error(err);
    stopDevServer(1);
  }
  stopDevServer(0);
}

run().catch((err) => {
  console.error(err);
  stopDevServer(1);
});
