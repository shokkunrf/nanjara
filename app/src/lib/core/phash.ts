/**
 * pHash（知覚ハッシュ）コアアルゴリズム
 *
 * プラットフォーム非依存の純粋な数値計算のみ。
 * ブラウザ (app) と Node.js (tools/hasher) の両方から使用される。
 */

const RESIZE_SIZE = 32;
const HASH_SIZE = 8;

/**
 * DCTコサインルックアップテーブル（RESIZE_SIZE x RESIZE_SIZE）
 * DCT_COS_TABLE[k][n] = cos(π * (2n+1) * k / (2N))
 */
const DCT_COS_TABLE: number[][] = (() => {
  const N = RESIZE_SIZE;
  const table: number[][] = [];
  for (let k = 0; k < N; k++) {
    table[k] = new Array(N);
    for (let n = 0; n < N; n++) {
      table[k][n] = Math.cos((Math.PI * (2 * n + 1) * k) / (2 * N));
    }
  }
  return table;
})();

/**
 * RGBAピクセルデータからpHashを計算する。
 *
 * @param data - RGBA形式のピクセルデータ（Uint8ClampedArray, Buffer等）
 * @param width - 画像の幅
 * @param height - 画像の高さ
 * @returns 16文字の16進数文字列（64bit pHash）
 */
export function computePhashFromRgba(
  data: ArrayLike<number>,
  width: number,
  height: number,
): string {
  const gray = toGrayscale(data, width, height);
  const resized = resizeBilinear(gray, width, height);

  const matrix: number[][] = [];
  for (let y = 0; y < RESIZE_SIZE; y++) {
    matrix[y] = [];
    for (let x = 0; x < RESIZE_SIZE; x++) {
      matrix[y][x] = resized[y * RESIZE_SIZE + x];
    }
  }
  const dctMatrix = dct2d(matrix);

  // 左上8x8の低周波成分を取得（DC成分[0][0]を除く63要素）
  const lowFreq: number[] = [];
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      if (y === 0 && x === 0) continue;
      lowFreq.push(dctMatrix[y][x]);
    }
  }

  const sorted = [...lowFreq].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // 4ビットずつニブル単位で16進数文字列を直接生成
  let hex = '';
  for (let nibble = 0; nibble < 16; nibble++) {
    let nibbleValue = 0;
    for (let bit = 0; bit < 4; bit++) {
      const idx = nibble * 4 + bit;
      const y = Math.floor(idx / HASH_SIZE);
      const x = idx % HASH_SIZE;
      const bitValue = y === 0 && x === 0 ? 0 : dctMatrix[y][x] > median ? 1 : 0;
      nibbleValue = (nibbleValue << 1) | bitValue;
    }
    hex += nibbleValue.toString(16);
  }

  return hex;
}

/**
 * 2つのpHash文字列のハミング距離を計算する。
 *
 * @returns ハミング距離（0〜64）
 */
export function hammingDistance(hash1: string, hash2: string): number {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    let xor = parseInt(hash1[i], 16) ^ parseInt(hash2[i], 16);
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

// ---- 内部関数 ----

/** RGBAピクセルをBT.601輝度に変換 */
function toGrayscale(data: ArrayLike<number>, width: number, height: number): number[] {
  const gray: number[] = new Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

/** バイリニア補間でRESIZE_SIZE x RESIZE_SIZEにリサイズ */
function resizeBilinear(src: number[], srcW: number, srcH: number): number[] {
  const dstW = RESIZE_SIZE;
  const dstH = RESIZE_SIZE;
  const dst: number[] = new Array(dstW * dstH);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcX = x * xRatio;
      const srcY = y * yRatio;
      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const y1 = Math.min(y0 + 1, srcH - 1);
      const fx = srcX - x0;
      const fy = srcY - y0;

      const v00 = src[y0 * srcW + x0];
      const v10 = src[y0 * srcW + x1];
      const v01 = src[y1 * srcW + x0];
      const v11 = src[y1 * srcW + x1];
      dst[y * dstW + x] = Math.round(
        v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy,
      );
    }
  }

  return dst;
}

/** 2D DCT-II（行方向→列方向の分離型） */
function dct2d(matrix: number[][]): number[][] {
  const rowDct: number[][] = [];
  for (let y = 0; y < RESIZE_SIZE; y++) {
    rowDct[y] = dct1d(matrix[y]);
  }

  const result: number[][] = [];
  for (let y = 0; y < RESIZE_SIZE; y++) {
    result[y] = new Array(RESIZE_SIZE);
  }

  for (let x = 0; x < RESIZE_SIZE; x++) {
    const column: number[] = [];
    for (let y = 0; y < RESIZE_SIZE; y++) {
      column.push(rowDct[y][x]);
    }
    const dctCol = dct1d(column);
    for (let y = 0; y < RESIZE_SIZE; y++) {
      result[y][x] = dctCol[y];
    }
  }

  return result;
}

/** 1D DCT-II（DCT_COS_TABLEを参照） */
function dct1d(input: number[]): number[] {
  const N = input.length;
  const output: number[] = new Array(N);

  for (let k = 0; k < N; k++) {
    let sum = 0;
    const cosRow = DCT_COS_TABLE[k];
    for (let n = 0; n < N; n++) {
      sum += input[n] * cosRow[n];
    }
    output[k] = sum;
  }

  return output;
}
