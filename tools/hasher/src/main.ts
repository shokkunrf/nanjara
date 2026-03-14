import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { computePHash } from './phash.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_INPUT_DIR = path.join(__dirname, '..', '..', 'extractor', 'output');
const DEFAULT_OUTPUT_FILE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'app',
  'static',
  'pais',
  'hashes.json',
);

function usage(): never {
  console.log(`Usage: npm start -- [options]

Options:
  --input, -i   入力ディレクトリ（PNG画像があるフォルダ）
                デフォルト: tools/extractor/output/
  --output, -o  出力ファイルパス（hashes.json）
                デフォルト: app/static/pais/hashes.json
  --help, -h    ヘルプを表示`);
  process.exit(0);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      input: { type: 'string', short: 'i' },
      output: { type: 'string', short: 'o' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) usage();

  const inputDir = values.input ? path.resolve(values.input) : DEFAULT_INPUT_DIR;
  const outputFile = values.output ? path.resolve(values.output) : DEFAULT_OUTPUT_FILE;

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
