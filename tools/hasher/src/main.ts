import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { computePhashFromRgba } from '../../../app/src/lib/core/phash.ts';

function usage(): never {
  console.error('Usage: npm start -- <input-dir> <output-file>');
  process.exit(1);
}

async function main(): Promise<void> {
  const [inputDir, outputFile] = process.argv.slice(2).map((p) => path.resolve(p));

  if (!inputDir || !outputFile) usage();

  if (!fs.existsSync(inputDir)) {
    console.error(`Directory not found: ${inputDir}`);
    process.exit(1);
  }

  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files = fs
    .readdirSync(inputDir)
    .filter((f) => f.endsWith('.png'))
    .sort();

  if (files.length === 0) {
    console.error(`PNG files not found: ${inputDir}`);
    process.exit(1);
  }

  const hashes: Record<string, string> = {};

  for (const filename of files) {
    const { data, info } = await sharp(path.join(inputDir, filename))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    hashes[filename] = computePhashFromRgba(data, info.width, info.height);
    console.log(filename);
  }

  fs.writeFileSync(outputFile, JSON.stringify(hashes, null, 2) + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
