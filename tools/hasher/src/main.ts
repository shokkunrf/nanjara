import fs from 'node:fs';
import path from 'node:path';
import { computePHash } from './phash.ts';

function usage(): never {
  console.log(`Usage: npm start -- <入力ディレクトリ> <出力ファイル>`);
  process.exit(1);
}

async function main(): Promise<void> {
  const [inputDir, outputFile] = process.argv.slice(2).map((p) => path.resolve(p));

  if (!inputDir || !outputFile) usage();

  if (!fs.existsSync(inputDir)) {
    console.error(`入力ディレクトリが見つかりません: ${inputDir}`);
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
    console.error(`PNG画像が見つかりません: ${inputDir}`);
    process.exit(1);
  }

  console.log(`入力: ${inputDir}`);
  console.log(`出力: ${outputFile}`);
  console.log(`${files.length}枚のPNG画像を処理します\n`);

  const hashes: Record<string, string> = {};

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const hash = await computePHash(path.join(inputDir, filename));
    hashes[filename] = hash;
    console.log(`[${i + 1}/${files.length}] ${filename}: ${hash}`);
  }

  fs.writeFileSync(outputFile, JSON.stringify(hashes, null, 2));
  console.log(`\nhashes.json を出力しました: ${outputFile}`);
  console.log(`処理画像数: ${Object.keys(hashes).length}`);
}

main();
