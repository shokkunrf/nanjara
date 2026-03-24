import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('./phash.js', () => ({
  computePhash: vi.fn(() => 'abcd1234abcd1234'),
  findClosestMatch: vi.fn(() => ({ paiId: '003_livelive_honoka.png', distance: 2 })),
}));

import { computePhash, findClosestMatch } from './phash.js';

function createImageData(width: number, height: number): ImageData {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
    colorSpace: 'srgb',
  } as ImageData;
}

function createRegion(x: number) {
  return { x, y: 50, width: 50, height: 70, imageData: createImageData(50, 70) };
}

const mockHashes = {
  '003_livelive_honoka.png': 'abcd1234abcd1234',
  '014_sunshine_chika.png': '1234abcd1234abcd',
};

describe('pai-recognizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHashes),
    });
  });

  it('DetectedRegion[]からRecognitionResultを返す', async () => {
    const { recognize } = await import('./pai-recognizer.js');

    const result = await recognize([createRegion(100), createRegion(200)]);

    expect(result.pais).toHaveLength(2);
    expect(result.pais[0].paiId).toBe('003_livelive_honoka.png');
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('空のDetectedRegion[]で空のpaisを返す', async () => {
    const { recognize } = await import('./pai-recognizer.js');

    const result = await recognize([]);

    expect(result.pais).toEqual([]);
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('confidenceがハミング距離から計算される（距離0→1.0）', async () => {
    vi.mocked(findClosestMatch).mockReturnValue({ paiId: '003_livelive_honoka.png', distance: 0 });
    const { recognize } = await import('./pai-recognizer.js');

    const result = await recognize([createRegion(100)]);

    expect(result.pais[0].confidence).toBe(1.0);
  });

  it('ハミング距離が大きいほどconfidenceが低い（距離32→0.5）', async () => {
    vi.mocked(findClosestMatch).mockReturnValue({ paiId: '003_livelive_honoka.png', distance: 32 });
    const { recognize } = await import('./pai-recognizer.js');

    const result = await recognize([createRegion(100)]);

    expect(result.pais[0].confidence).toBe(0.5);
  });

  it('各regionに対してcomputePhashとfindClosestMatchが呼ばれる', async () => {
    const { recognize } = await import('./pai-recognizer.js');

    await recognize([createRegion(100), createRegion(200), createRegion(300)]);

    expect(computePhash).toHaveBeenCalledTimes(3);
    expect(findClosestMatch).toHaveBeenCalledTimes(3);
  });

  it('pai-hashes.jsonを2回目以降はキャッシュから取得する', async () => {
    const { recognize } = await import('./pai-recognizer.js');

    await recognize([createRegion(100)]);
    await recognize([createRegion(200)]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('pai-hashes.jsonのfetchが失敗した場合RecognitionErrorをスローする', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    const { recognize, RecognitionError } = await import('./pai-recognizer.js');

    await expect(recognize([createRegion(100)])).rejects.toBeInstanceOf(RecognitionError);
  });
});
