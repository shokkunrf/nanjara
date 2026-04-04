/**
 * 84枚の参照画像を1枚のカタログ画像（スプライトシート）に合成
 * 各セルにIDラベル付き
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PAI_IMAGES_DIR = process.argv[2];
const OUTPUT_DIR = process.argv[3];

if (!PAI_IMAGES_DIR || !OUTPUT_DIR) {
  console.error('Usage: node src/main.ts <PAI_IMAGES_DIR> <OUTPUT_DIR>');
  process.exit(1);
}

const CELL_W = 174;
const LABEL_H = 20;
const IMG_H = 236;
const CELL_H = IMG_H + LABEL_H;
const ITEMS_PER_CATALOG = 21;

async function buildCatalog(files: string[], index: number): Promise<void> {
  const COLS = 7;
  const rows = Math.ceil(files.length / COLS);
  const totalW = COLS * CELL_W;
  const totalH = rows * CELL_H;

  const composites: { input: Buffer; left: number; top: number }[] = [];

  for (let i = 0; i < files.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * CELL_W;
    const y = row * CELL_H;

    const resized = await sharp(path.join(PAI_IMAGES_DIR, files[i]))
      .resize(CELL_W, IMG_H, { fit: 'fill' })
      .toBuffer();
    composites.push({ input: resized, left: x, top: y });

    const shortLabel = files[i].substring(0, 3);
    const svg = Buffer.from(`<svg width="${CELL_W}" height="${LABEL_H}">
      <rect width="${CELL_W}" height="${LABEL_H}" fill="#333"/>
      <text x="${CELL_W/2}" y="15" font-size="14" fill="white" text-anchor="middle" font-family="monospace">${shortLabel}</text>
    </svg>`);
    composites.push({ input: svg, left: x, top: y + IMG_H });
  }

  // 罫線
  const lines: string[] = [];
  const BORDER = 2;
  for (let c = 0; c <= COLS; c++) {
    lines.push(`<rect x="${c * CELL_W}" y="0" width="${BORDER}" height="${totalH}" fill="black"/>`);
  }
  for (let r = 0; r <= rows; r++) {
    lines.push(`<rect x="0" y="${r * CELL_H}" width="${totalW}" height="${BORDER}" fill="black"/>`);
  }
  composites.push({ input: Buffer.from(`<svg width="${totalW}" height="${totalH}">${lines.join('')}</svg>`), left: 0, top: 0 });

  const outputPath = path.join(OUTPUT_DIR, `pai-catalog-${index + 1}.png`);
  await sharp({
    create: { width: totalW, height: totalH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);

  const stat = fs.statSync(outputPath);
  console.log(`  カタログ${index + 1}: ${totalW}x${totalH}, ${(stat.size / 1024).toFixed(1)}KB, ${files.length}枚 (${files[0]}〜${files[files.length - 1]})`);
}

async function main() {
  const allFiles = fs.readdirSync(PAI_IMAGES_DIR).filter(f => f.endsWith('.png')).sort();
  const catalogCount = Math.ceil(allFiles.length / ITEMS_PER_CATALOG);

  console.log(`${allFiles.length}枚 → ${catalogCount}カタログ (各${ITEMS_PER_CATALOG}枚, 横1列)\n`);

  for (let i = 0; i < catalogCount; i++) {
    const chunk = allFiles.slice(i * ITEMS_PER_CATALOG, (i + 1) * ITEMS_PER_CATALOG);
    await buildCatalog(chunk, i);
  }
}

main().catch(console.error);
