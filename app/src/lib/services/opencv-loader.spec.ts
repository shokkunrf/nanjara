import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCv = { version: 'mock' };

vi.mock('@techstark/opencv-js', () => ({ default: mockCv }));

describe('opencv-loader - 正常系', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-001: load呼び出しでOpenCV.jsの動的importが実行される', async () => {
    let importCallCount = 0;
    vi.doMock('@techstark/opencv-js', () => {
      importCallCount++;
      return { default: mockCv };
    });

    const { loadCv } = await import('./opencv-loader');

    await loadCv();

    expect(importCallCount).toBe(1);
  });

  it('TC-002: load呼び出しでcvオブジェクトを返す', async () => {
    vi.doMock('@techstark/opencv-js', () => ({ default: mockCv }));

    const { loadCv } = await import('./opencv-loader');

    const cv = await loadCv();

    expect(cv).toBe(mockCv);
  });

  it('TC-003: ロード完了後のloadは即座にresolveする', async () => {
    vi.doMock('@techstark/opencv-js', () => ({ default: mockCv }));

    const { loadCv } = await import('./opencv-loader');

    await loadCv();

    await expect(loadCv()).resolves.toBe(mockCv);
  });
});

describe('opencv-loader - 異常系', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-004: WASMロード失敗時にOpenCVLoadErrorをthrowする', async () => {
    vi.doMock('@techstark/opencv-js', () => {
      throw new Error('WASM load failed: network error');
    });

    const { loadCv, OpenCVLoadError } = await import('./opencv-loader');

    await expect(loadCv()).rejects.toBeInstanceOf(OpenCVLoadError);
  });

  it('TC-005: ロード失敗後のリトライで正常にロードできる', async () => {
    vi.doMock('@techstark/opencv-js', () => {
      throw new Error('WASM load failed: network error');
    });

    const { loadCv, OpenCVLoadError } = await import('./opencv-loader');

    await expect(loadCv()).rejects.toBeInstanceOf(OpenCVLoadError);
    await new Promise((resolve) => setTimeout(resolve, 0));

    vi.doMock('@techstark/opencv-js', () => ({ default: mockCv }));

    await expect(loadCv()).resolves.toBe(mockCv);
  });
});

describe('opencv-loader - 冪等性', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-006: loadを複数回呼んでもimportは1回しか実行されない', async () => {
    let importCallCount = 0;
    vi.doMock('@techstark/opencv-js', () => {
      importCallCount++;
      return { default: mockCv };
    });

    const { loadCv } = await import('./opencv-loader');

    await loadCv();
    await loadCv();
    await loadCv();

    expect(importCallCount).toBe(1);
  });

  it('TC-007: loadを同時に複数回呼んでもimportは1回しか実行されない', async () => {
    let importCallCount = 0;
    vi.doMock('@techstark/opencv-js', () => {
      importCallCount++;
      return { default: mockCv };
    });

    const { loadCv } = await import('./opencv-loader');

    const results = await Promise.all([loadCv(), loadCv(), loadCv()]);

    expect(results).toHaveLength(3);
    expect(importCallCount).toBe(1);
  });

  it('TC-008: awaitなしで呼んだ後にawaitありで呼んでもimportは1回のみ', async () => {
    let importCallCount = 0;
    vi.doMock('@techstark/opencv-js', () => {
      importCallCount++;
      return { default: mockCv };
    });

    const { loadCv } = await import('./opencv-loader');

    loadCv();
    await loadCv();

    expect(importCallCount).toBe(1);
  });
});
