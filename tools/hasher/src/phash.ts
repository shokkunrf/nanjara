import sharp from 'sharp';

/**
 * 画像ファイルからpHash（知覚ハッシュ）を計算する
 *
 * アルゴリズム:
 * 1. 画像を32x32にリサイズ（DCT入力用）
 * 2. グレースケール変換
 * 3. DCT（離散コサイン変換）を適用
 * 4. 左上8x8の低周波成分を取得
 * 5. 中央値と比較して64bitハッシュを生成
 */
export async function computePHash(imagePath: string): Promise<string> {
  const SIZE = 32;
  const HASH_SIZE = 8;

  // 32x32グレースケールにリサイズ
  const buffer = await sharp(imagePath)
    .resize(SIZE, SIZE, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  // 2D DCT を計算
  const matrix: number[][] = [];
  for (let y = 0; y < SIZE; y++) {
    matrix[y] = [];
    for (let x = 0; x < SIZE; x++) {
      matrix[y][x] = buffer[y * SIZE + x];
    }
  }

  const dctMatrix = dct2d(matrix, SIZE);

  // 左上8x8の低周波成分を取得（DC成分[0][0]を除く）
  const lowFreq: number[] = [];
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      if (y === 0 && x === 0) continue;
      lowFreq.push(dctMatrix[y][x]);
    }
  }

  // 中央値を計算
  const sorted = [...lowFreq].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // 中央値と比較して64bitハッシュを生成
  let bits = '';
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      if (y === 0 && x === 0) {
        bits += '0'; // DC成分は常に0
      } else {
        bits += dctMatrix[y][x] > median ? '1' : '0';
      }
    }
  }

  // 2進数 → 16進数
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.substring(i, i + 4), 2).toString(16);
  }

  return hex;
}

/**
 * 2つのpHashのハミング距離を計算する
 */
export function hammingDistance(hash1: string, hash2: string): number {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const n1 = parseInt(hash1[i], 16);
    const n2 = parseInt(hash2[i], 16);
    let xor = n1 ^ n2;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/**
 * 2D DCT（離散コサイン変換）
 */
function dct2d(matrix: number[][], size: number): number[][] {
  // 行方向のDCT
  const rowDct: number[][] = [];
  for (let y = 0; y < size; y++) {
    rowDct[y] = dct1d(matrix[y]);
  }

  // 列方向のDCT
  const result: number[][] = [];
  for (let y = 0; y < size; y++) {
    result[y] = new Array(size);
  }

  for (let x = 0; x < size; x++) {
    const column: number[] = [];
    for (let y = 0; y < size; y++) {
      column.push(rowDct[y][x]);
    }
    const dctCol = dct1d(column);
    for (let y = 0; y < size; y++) {
      result[y][x] = dctCol[y];
    }
  }

  return result;
}

/**
 * 1D DCT-II
 */
function dct1d(input: number[]): number[] {
  const N = input.length;
  const output: number[] = new Array(N);

  for (let k = 0; k < N; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      sum += input[n] * Math.cos((Math.PI * (2 * n + 1) * k) / (2 * N));
    }
    output[k] = sum;
  }

  return output;
}
