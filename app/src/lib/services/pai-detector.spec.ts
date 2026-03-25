import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detect, DetectionError } from './pai-detector.js';

function createImageData(width: number, height: number): ImageData {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
    colorSpace: 'srgb',
  } as ImageData;
}

/** findContours が返す矩形を定義するヘルパー */
function createMockCv(rects: { x: number; y: number; width: number; height: number }[]) {
  const deletedMats: { delete: ReturnType<typeof vi.fn> }[] = [];

  const mockContours = {
    size: () => rects.length,
    get: vi.fn((i: number) => ({ _index: i })),
    delete: vi.fn(),
  };

  class MockMat {
    rows: number;
    cols: number;
    data: Uint8Array;
    delete = vi.fn();
    roi = vi.fn(() => new MockMat(this.rows, this.cols));
    clone = vi.fn(() => new MockMat(this.rows, this.cols));
    constructor(rows = 0, cols = 0) {
      this.rows = rows;
      this.cols = cols;
      this.data = new Uint8Array(Math.max(rows * cols * 4, 1));
      deletedMats.push(this);
    }
  }

  class MockMatVector {
    size = mockContours.size;
    get = mockContours.get;
    delete = mockContours.delete;
  }

  const mockCv = {
    matFromImageData: vi.fn((imgData: { width: number; height: number }) => {
      return new MockMat(imgData.height, imgData.width);
    }),
    Mat: MockMat,
    MatVector: MockMatVector,
    Size: vi.fn((w: number, h: number) => ({ width: w, height: h })),
    cvtColor: vi.fn(),
    threshold: vi.fn(),
    resize: vi.fn(),
    findContours: vi.fn(),
    boundingRect: vi.fn((contour: { _index: number }) => rects[contour._index]),
    COLOR_RGBA2GRAY: 6,
    THRESH_BINARY_INV: 1,
    THRESH_OTSU: 8,
    RETR_EXTERNAL: 0,
    CHAIN_APPROX_SIMPLE: 2,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { mockCv: mockCv as any, deletedMats, mockContours };
}

describe('pai-detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('パイが検出されない場合、空の配列を返す', () => {
    const { mockCv } = createMockCv([]);

    const result = detect(mockCv, createImageData(640, 480));

    expect(result).toEqual([]);
  });

  it('検出されたパイを左から右へソートして返す', () => {
    const { mockCv } = createMockCv([
      { x: 300, y: 100, width: 50, height: 70 },
      { x: 100, y: 100, width: 50, height: 70 },
      { x: 200, y: 100, width: 50, height: 70 },
    ]);

    const result = detect(mockCv, createImageData(640, 480));

    expect(result).toHaveLength(3);
    expect(result[0].x).toBe(100);
    expect(result[1].x).toBe(200);
    expect(result[2].x).toBe(300);
  });

  it('各検出領域がDetectedRegionの形状を持つ', () => {
    const { mockCv } = createMockCv([{ x: 100, y: 50, width: 50, height: 70 }]);

    const result = detect(mockCv, createImageData(640, 480));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ x: 100, y: 50, width: 50, height: 70 });
    expect(result[0].imageData).toBeDefined();
  });

  it('アスペクト比が範囲外の矩形をフィルタリングする', () => {
    const { mockCv } = createMockCv([
      { x: 100, y: 100, width: 50, height: 70 }, // w/h=0.71 → OK
      { x: 200, y: 100, width: 200, height: 20 }, // w/h=10.0 → NG
      { x: 300, y: 100, width: 5, height: 100 }, // w/h=0.05 → NG
    ]);

    const result = detect(mockCv, createImageData(640, 480));

    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(100);
  });

  it('面積が極端に小さい矩形をフィルタリングする', () => {
    const { mockCv } = createMockCv([
      { x: 100, y: 100, width: 50, height: 70 },
      { x: 200, y: 100, width: 3, height: 3 },
    ]);

    const result = detect(mockCv, createImageData(640, 480));

    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(100);
  });

  it('面積が極端に大きい矩形をフィルタリングする', () => {
    const { mockCv } = createMockCv([
      { x: 100, y: 100, width: 50, height: 70 },
      { x: 0, y: 0, width: 600, height: 400 },
    ]);

    const result = detect(mockCv, createImageData(640, 480));

    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(100);
  });

  it('Matオブジェクトが成功時に解放される', () => {
    const { mockCv, deletedMats, mockContours } = createMockCv([]);

    detect(mockCv, createImageData(640, 480));

    for (const mat of deletedMats) {
      expect(mat.delete).toHaveBeenCalled();
    }
    expect(mockContours.delete).toHaveBeenCalled();
  });

  it('Matオブジェクトがエラー時にも解放される', () => {
    const { mockCv, deletedMats } = createMockCv([]);
    mockCv.cvtColor.mockImplementation(() => {
      throw new Error('OpenCV internal error');
    });

    expect(() => detect(mockCv, createImageData(640, 480))).toThrow(DetectionError);

    for (const mat of deletedMats) {
      expect(mat.delete).toHaveBeenCalled();
    }
  });
});
