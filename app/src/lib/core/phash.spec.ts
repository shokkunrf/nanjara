import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { computePhashFromRgba, hammingDistance } from './phash.js';

function createRgba(width: number, height: number, fillValue = 128): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillValue;
    data[i + 1] = fillValue;
    data[i + 2] = fillValue;
    data[i + 3] = 255;
  }
  return data;
}

describe('computePhashFromRgba', () => {
  it('全黒画像でもクラッシュしない', () => {
    const hash = computePhashFromRgba(createRgba(32, 32, 0), 32, 32);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('全白画像でもクラッシュしない', () => {
    const hash = computePhashFromRgba(createRgba(32, 32, 255), 32, 32);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('1x1の極小データでもクラッシュしない', () => {
    const hash = computePhashFromRgba(createRgba(1, 1, 128), 1, 1);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });
});

const PAI_IMAGES_DIR = path.resolve('static/pai-images');
const PAI_HASHES_PATH = path.resolve('static/pai-hashes.json');

async function loadPaiRgba(filename: string) {
  const { data, info } = await sharp(path.join(PAI_IMAGES_DIR, filename))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

describe('computePhashFromRgba: パイ画像', () => {
  const paiHashes: Record<string, string> = JSON.parse(fs.readFileSync(PAI_HASHES_PATH, 'utf-8'));
  const filenames = Object.keys(paiHashes);

  it('全パイ画像のpHashがpai-hashes.jsonと一致する', async () => {
    const mismatches: { file: string; expected: string; actual: string }[] = [];

    for (const filename of filenames) {
      const { data, width, height } = await loadPaiRgba(filename);
      const actual = computePhashFromRgba(data, width, height);
      if (actual !== paiHashes[filename]) {
        mismatches.push({ file: filename, expected: paiHashes[filename], actual });
      }
    }

    expect(mismatches, `${mismatches.length}件が不一致`).toHaveLength(0);
  });

  it('84枚すべてのパイが一意のpHashを持つ', async () => {
    const hashToFile = new Map<string, string>();
    const collisions: { file: string; collidedWith: string; hash: string }[] = [];

    for (const filename of filenames) {
      const { data, width, height } = await loadPaiRgba(filename);
      const hash = computePhashFromRgba(data, width, height);
      const existing = hashToFile.get(hash);
      if (existing) {
        collisions.push({ file: filename, collidedWith: existing, hash });
      }
      hashToFile.set(hash, filename);
    }

    expect(collisions, `ハッシュ衝突`).toHaveLength(0);
  });

  it('似ているパイ画像でもハッシュが異なる', async () => {
    const similarPairs = [
      // ハミング距離が最も近い上位5ペア
      ['061_musical_musical.png', '073_ikizu_ikizuraibu.png'], // 距離8
      ['007_livelive_rin.png', '010_livelive_hanayo.png'], // 距離10
      ['010_livelive_hanayo.png', '011_livelive_nico.png'], // 距離10
      ['048_superstar_natsumi.png', '049_superstar_wien.png'], // 距離10
      ['003_livelive_honoka.png', '069_musical_misuzu.png'], // 距離12
    ];

    for (const [fileA, fileB] of similarPairs) {
      const a = await loadPaiRgba(fileA);
      const b = await loadPaiRgba(fileB);
      const hashA = computePhashFromRgba(a.data, a.width, a.height);
      const hashB = computePhashFromRgba(b.data, b.width, b.height);

      expect(hashA, `${fileA} と ${fileB} のハッシュが衝突`).not.toBe(hashB);
      expect(hammingDistance(hashA, hashB)).toBeGreaterThan(0);
    }
  });
});

describe('hammingDistance', () => {
  it('同一ハッシュの距離は0', () => {
    expect(hammingDistance('abcdef0123456789', 'abcdef0123456789')).toBe(0);
  });

  it('完全に異なるハッシュの距離は64', () => {
    expect(hammingDistance('0000000000000000', 'ffffffffffffffff')).toBe(64);
  });

  it('1ビット異なるハッシュの距離は1', () => {
    expect(hammingDistance('0000000000000000', '0000000000000001')).toBe(1);
  });

  it('先頭1バイト異なるハッシュの距離は8', () => {
    expect(hammingDistance('ff00000000000000', '0000000000000000')).toBe(8);
  });
});
