import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computePHash, hammingDistance } from './phash.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '..', '..', '..', 'app', 'static', 'pai-images');

describe('computePHash', () => {
  it('同一画像のpHashは一致する', async () => {
    const imagePath = path.join(FIXTURES_DIR, '003_livelive_honoka.png');
    const hash1 = await computePHash(imagePath);
    const hash2 = await computePHash(imagePath);
    assert.equal(hash1, hash2);
  });

  it('pHashは16文字の16進数文字列を返す', async () => {
    const imagePath = path.join(FIXTURES_DIR, '003_livelive_honoka.png');
    const hash = await computePHash(imagePath);
    assert.equal(hash.length, 16);
    assert.match(hash, /^[0-9a-f]{16}$/);
  });

  it('異なる画像は異なるpHashを返す', async () => {
    const hash1 = await computePHash(path.join(FIXTURES_DIR, '003_livelive_honoka.png'));
    const hash2 = await computePHash(path.join(FIXTURES_DIR, '014_sunshine_chika.png'));
    assert.notEqual(hash1, hash2);
  });
});

describe('hammingDistance', () => {
  it('同一ハッシュの距離は0', () => {
    assert.equal(hammingDistance('abcdef0123456789', 'abcdef0123456789'), 0);
  });

  it('完全に異なるハッシュの距離は64', () => {
    assert.equal(hammingDistance('0000000000000000', 'ffffffffffffffff'), 64);
  });

  it('1ビット異なるハッシュの距離は1', () => {
    // 0x0 = 0000, 0x1 = 0001 → 1ビット差
    assert.equal(hammingDistance('0000000000000000', '0000000000000001'), 1);
  });

  it('既知のハッシュペアで正確な距離を返す', () => {
    // 0xff = 11111111, 0x00 = 00000000 → 最初の1バイトで8ビット差
    assert.equal(hammingDistance('ff00000000000000', '0000000000000000'), 8);
  });
});

describe('pHash品質', () => {
  it('似ているパイや近接ペアをすべて区別できる', async () => {
    const pairs = [
      // 見た目で似ているパイ
      ['025_nijigaku_yu.png', '032_nijigaku_setsuna.png'],
      ['063_musical_rurika.png', '064_musical_yuzuha.png'],
      // ハミング距離が最も近い上位5ペア
      ['006_livelive_umi.png', '009_livelive_nozomi.png'],
      ['010_livelive_hanayo.png', '011_livelive_nico.png'],
      ['007_livelive_rin.png', '010_livelive_hanayo.png'],
      ['002_livelive_otonokizaka.png', '073_ikizu_ikizuraibu.png'],
      ['003_livelive_honoka.png', '069_musical_misuzu.png'],
    ];

    for (const [a, b] of pairs) {
      const h1 = await computePHash(path.join(FIXTURES_DIR, a));
      const h2 = await computePHash(path.join(FIXTURES_DIR, b));
      const distance = hammingDistance(h1, h2);
      assert.ok(distance > 0, `${a} vs ${b} が区別できない（距離0）`);
      assert.notEqual(h1, h2, `${a} vs ${b} のハッシュが一致`);
    }
  });

  it('84枚すべてのパイが一意のpHashを持つ', async () => {
    const files = fs
      .readdirSync(FIXTURES_DIR)
      .filter((f: string) => f.endsWith('.png'))
      .sort();

    assert.equal(files.length, 84);

    const hashToFile = new Map<string, string>();
    for (const file of files) {
      const hash = await computePHash(path.join(FIXTURES_DIR, file));
      assert.equal(hash.length, 16, `${file} のハッシュ長が不正: ${hash}`);
      assert.match(hash, /^[0-9a-f]{16}$/, `${file} のハッシュ形式が不正: ${hash}`);

      const existing = hashToFile.get(hash);
      assert.equal(
        existing,
        undefined,
        `ハッシュ衝突: ${file} と ${existing} が同じハッシュ ${hash}`,
      );
      hashToFile.set(hash, file);
    }
  });
});
