/**
 * 撮影画像からパイのバンド領域を切り出すサービス（Pure JS実装）
 *
 * OpenCV不使用。垂直エッジ周期性検出 + 角度補正 + 品質検証。
 */

const MAX_DIMENSION = 960;
const WHITE_THRESHOLD = 170;
const PAI_ASPECT_RATIO = 174 / 236; // 幅/高さ

/**
 * RGBA画像を任意角度で回転する（バイリニア補間）。
 * 回転後の画像サイズは元画像を内包する矩形。
 */
function rotateRgbaByAngle(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  angle: number,
): { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number } {
  if (Math.abs(angle) < 0.01) return { data: new Uint8ClampedArray(rgba), width, height };

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const absCos = Math.abs(cos);
  const absSin = Math.abs(sin);

  // 回転後のサイズ
  const newW = Math.round(width * absCos + height * absSin);
  const newH = Math.round(width * absSin + height * absCos);

  // 元画像中心 / 新画像中心
  const cx = width / 2,
    cy = height / 2;
  const ncx = newW / 2,
    ncy = newH / 2;

  const result = new Uint8ClampedArray(newW * newH * 4);

  for (let ny = 0; ny < newH; ny++) {
    for (let nx = 0; nx < newW; nx++) {
      // 新画像の座標→元画像の座標（逆回転）
      const dx = nx - ncx;
      const dy = ny - ncy;
      const srcX = cos * dx + sin * dy + cx;
      const srcY = -sin * dx + cos * dy + cy;

      // バイリニア補間（範囲外は端ピクセルにクランプ）
      const clampedX = Math.min(Math.max(srcX, 0), width - 1);
      const clampedY = Math.min(Math.max(srcY, 0), height - 1);
      const x0 = Math.min(Math.floor(clampedX), width - 2);
      const y0 = Math.min(Math.floor(clampedY), height - 2);
      const fx = clampedX - x0;
      const fy = clampedY - y0;
      const dstIdx = (ny * newW + nx) * 4;

      for (let c = 0; c < 4; c++) {
        const v00 = rgba[(y0 * width + x0) * 4 + c];
        const v10 = rgba[(y0 * width + x0 + 1) * 4 + c];
        const v01 = rgba[((y0 + 1) * width + x0) * 4 + c];
        const v11 = rgba[((y0 + 1) * width + x0 + 1) * 4 + c];
        result[dstIdx + c] = Math.round(
          v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy,
        );
      }
    }
  }

  return { data: result, width: newW, height: newH };
}

/** RGBA → グレースケール (BT.601) */
function toGrayscale(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
  }
  return gray;
}

/**
 * 垂直エッジの列プロファイルからパイ境界を検出。
 * パイの左右端は強い垂直エッジを形成する。
 * ピーク間隔から枚数を推定。
 */
function estimateCountByEdges(
  gray: Uint8Array,
  width: number,
  yStart: number,
  yEnd: number,
  colStart: number,
  colEnd: number,
): number | null {
  const bh = yEnd - yStart;

  // 各列の水平勾配を合計
  const gradProfile = new Float64Array(width);
  for (let x = colStart + 1; x <= colEnd; x++) {
    let sum = 0;
    for (let y = yStart; y < yEnd; y++) {
      sum += Math.abs(gray[y * width + x] - gray[y * width + x - 1]);
    }
    gradProfile[x] = sum / bh;
  }

  // 平滑化
  const smoothed = new Float64Array(width);
  const kernel = 3;
  for (let x = colStart; x <= colEnd; x++) {
    let sum = 0,
      cnt = 0;
    for (let k = -kernel; k <= kernel; k++) {
      const idx = x + k;
      if (idx >= colStart && idx <= colEnd) {
        sum += gradProfile[idx];
        cnt++;
      }
    }
    smoothed[x] = sum / cnt;
  }

  // ピーク検出
  let total = 0,
    cnt = 0;
  for (let x = colStart; x <= colEnd; x++) {
    total += smoothed[x];
    cnt++;
  }
  const avg = total / cnt;
  const peakThresh = avg * 1.8;

  const peaks: number[] = [];
  const minPeakDist = 30;

  for (let x = colStart + 3; x <= colEnd - 3; x++) {
    if (
      smoothed[x] >= peakThresh &&
      smoothed[x] >= smoothed[x - 1] &&
      smoothed[x] >= smoothed[x + 1] &&
      smoothed[x] >= smoothed[x - 2] &&
      smoothed[x] >= smoothed[x + 2]
    ) {
      if (peaks.length === 0 || x - peaks[peaks.length - 1] >= minPeakDist) {
        peaks.push(x);
      }
    }
  }

  if (peaks.length < 3) return null;

  // ピーク間隔の中央値を計算
  const spacings: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    spacings.push(peaks[i] - peaks[i - 1]);
  }
  spacings.sort((a, b) => a - b);
  const median = spacings[Math.floor(spacings.length / 2)];

  // 全体幅をメディアン間隔で割って枚数推定
  const span = colEnd - colStart;
  const estimated = Math.round(span / median);

  return estimated >= 5 && estimated <= 14 ? estimated : null;
}

/**
 * アスペクト比からパイ枚数を推定
 */
function estimateCountByAspectRatio(bandWidth: number, bandHeight: number): number {
  const estimatedPaiWidth = bandHeight * PAI_ASPECT_RATIO;
  return Math.max(1, Math.min(14, Math.round(bandWidth / estimatedPaiWidth)));
}

/** ImageData をリサイズ (バイリニア補間) */
function resizeImageData(
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let dy = 0; dy < dstH; dy++) {
    for (let dx = 0; dx < dstW; dx++) {
      const srcX = dx * xRatio;
      const srcY = dy * yRatio;
      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const y1 = Math.min(y0 + 1, srcH - 1);
      const fx = srcX - x0;
      const fy = srcY - y0;

      const dstIdx = (dy * dstW + dx) * 4;
      for (let c = 0; c < 4; c++) {
        const v00 = src[(y0 * srcW + x0) * 4 + c];
        const v10 = src[(y0 * srcW + x1) * 4 + c];
        const v01 = src[(y1 * srcW + x0) * 4 + c];
        const v11 = src[(y1 * srcW + x1) * 4 + c];
        dst[dstIdx + c] = Math.round(
          v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy,
        );
      }
    }
  }
  return dst;
}

/** RGBA画像を90°反時計回りに回転 */
function rotateRgba90ccw(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number } {
  const newW = height;
  const newH = width;
  const rotated = new Uint8ClampedArray(newW * newH * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstX = y;
      const dstY = width - 1 - x;
      const dstIdx = (dstY * newW + dstX) * 4;
      rotated[dstIdx] = rgba[srcIdx];
      rotated[dstIdx + 1] = rgba[srcIdx + 1];
      rotated[dstIdx + 2] = rgba[srcIdx + 2];
      rotated[dstIdx + 3] = rgba[srcIdx + 3];
    }
  }
  return { data: rotated, width: newW, height: newH };
}

/** RGBA画像を90°時計回りに回転 */
function rotateRgba90cw(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number } {
  const newW = height;
  const newH = width;
  const rotated = new Uint8ClampedArray(newW * newH * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstX = height - 1 - y;
      const dstY = x;
      const dstIdx = (dstY * newW + dstX) * 4;
      rotated[dstIdx] = rgba[srcIdx];
      rotated[dstIdx + 1] = rgba[srcIdx + 1];
      rotated[dstIdx + 2] = rgba[srcIdx + 2];
      rotated[dstIdx + 3] = rgba[srcIdx + 3];
    }
  }
  return { data: rotated, width: newW, height: newH };
}

/** バンド座標 + メタ情報 */
interface BandInfo {
  /** リサイズ後座標系でのバンド範囲 */
  yStart: number;
  yEnd: number;
  colStart: number;
  colEnd: number;
  /** パイ枚数 */
  count: number;
  /** リサイズ後の画像サイズ */
  scaledW: number;
  scaledH: number;
  /** 回転したか */
  rotated: boolean;
}

/**
 * 帯内の列プロファイルから、白いブロックが等間隔に並んでいるかを検証する。
 * パイの列は白枠のブロックが規則的に並ぶが、テーブル面は均一。
 */
/**
 * バンド内の垂直エッジの傾きから画像の微小角度を推定する。
 * 帯の上半分と下半分でエッジピーク位置を比較し、水平方向のずれから角度を計算。
 */
function estimateTiltFromEdges(
  rgba: Uint8ClampedArray,
  width: number,
  band: { yStart: number; yEnd: number; colStart: number; colEnd: number },
): number {
  const bh = band.yEnd - band.yStart;
  if (bh < 10) return 0;

  const bw = band.colEnd - band.colStart + 1;
  const midY = Math.round((band.yStart + band.yEnd) / 2);

  // 上半分と下半分のエッジプロファイルを計算
  const getEdgeProfile = (yFrom: number, yTo: number): Float64Array => {
    const profile = new Float64Array(bw);
    const h = yTo - yFrom;
    for (let i = 1; i < bw; i++) {
      const x = band.colStart + i;
      let sum = 0;
      for (let y = yFrom; y < yTo; y++) {
        const idx1 = (y * width + x) * 4;
        const idx0 = (y * width + x - 1) * 4;
        const g1 = 0.299 * rgba[idx1] + 0.587 * rgba[idx1 + 1] + 0.114 * rgba[idx1 + 2];
        const g0 = 0.299 * rgba[idx0] + 0.587 * rgba[idx0 + 1] + 0.114 * rgba[idx0 + 2];
        sum += Math.abs(g1 - g0);
      }
      profile[i] = sum / h;
    }
    return profile;
  };

  const topProfile = getEdgeProfile(band.yStart, midY);
  const bottomProfile = getEdgeProfile(midY, band.yEnd);

  // 各プロファイルのピーク（区切り線）位置を検出
  const findPeaks = (profile: Float64Array): number[] => {
    let mean = 0;
    for (let i = 0; i < profile.length; i++) mean += profile[i];
    mean /= profile.length;
    const threshold = mean * 2;
    const minDist = Math.max(10, Math.round(bw / 14));

    const peaks: number[] = [];
    for (let i = 3; i < profile.length - 3; i++) {
      if (
        profile[i] >= threshold &&
        profile[i] >= profile[i - 1] &&
        profile[i] >= profile[i + 1] &&
        profile[i] >= profile[i - 2] &&
        profile[i] >= profile[i + 2]
      ) {
        if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDist) {
          peaks.push(i);
        }
      }
    }
    return peaks;
  };

  const topPeaks = findPeaks(topProfile);
  const bottomPeaks = findPeaks(bottomProfile);

  if (topPeaks.length < 3 || bottomPeaks.length < 3) return 0;

  // 上下のピーク位置を対応付けて水平方向のずれを計算
  const shifts: number[] = [];
  for (const tp of topPeaks) {
    // 最も近い下側ピークを見つける
    let bestDist = Infinity;
    let bestShift = 0;
    for (const bp of bottomPeaks) {
      const dist = Math.abs(tp - bp);
      if (dist < bestDist) {
        bestDist = dist;
        bestShift = bp - tp;
      }
    }
    // ずれが大きすぎるのは対応ミス
    if (bestDist < bw / 8) {
      shifts.push(bestShift);
    }
  }

  if (shifts.length < 3) return 0;

  // ずれの中央値
  shifts.sort((a, b) => a - b);
  const medianShift = shifts[Math.floor(shifts.length / 2)];
  const verticalDist = bh / 2; // 上半分の中心と下半分の中心の距離

  return Math.atan2(medianShift, verticalDist);
}

/**
 * 帯内に等間隔の垂直エッジ（パイの区切り線）があるかを検証する。
 * パイの列は隣接するパイの境界で垂直エッジが周期的に出現する。
 * テーブル面には周期的な垂直エッジがない。
 */
/**
 * 垂直エッジの周期性パターンを直接探してパイの列を検出する。
 * 白ピクセルに依存せず、等間隔の区切り線がある帯を見つける。
 */
function findBand(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Omit<BandInfo, 'scaledW' | 'scaledH' | 'rotated'> | null {
  const gray = toGrayscale(rgba, width, height);

  // 各ピクセルの水平方向エッジ強度を計算
  // edge[y][x] = |gray(x) - gray(x-1)|
  const edge = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 1; x < width; x++) {
      edge[y * width + x] = Math.abs(gray[y * width + x] - gray[y * width + x - 1]);
    }
  }

  // スライディングウィンドウ: 高さ windowH の水平帯を走査し、
  // 各帯のエッジプロファイルの周期性スコアを計算
  // パイ1枚の高さは画像幅の 1/8 / PAI_ASPECT_RATIO ≈ 幅の 0.17
  const estPaiH = Math.round(width / 8 / PAI_ASPECT_RATIO);
  const windowH = Math.max(20, Math.round(estPaiH * 0.5));
  const step = Math.max(1, Math.round(windowH / 4));

  let bestScore = 0;
  let bestY = 0;
  let bestColStart = 0;
  let bestColEnd = 0;

  for (let wy = 0; wy <= height - windowH; wy += step) {
    // この帯の列ごとのエッジ強度プロファイル
    const profile = new Float64Array(width);
    for (let x = 1; x < width; x++) {
      let sum = 0;
      for (let y = wy; y < wy + windowH; y++) {
        sum += edge[y * width + x];
      }
      profile[x] = sum / windowH;
    }

    // プロファイルの平均と分散
    let meanP = 0;
    for (let x = 0; x < width; x++) meanP += profile[x];
    meanP /= width;

    let varP = 0;
    for (let x = 0; x < width; x++) varP += (profile[x] - meanP) ** 2;
    varP /= width;
    if (varP < 1) continue;

    // 自己相関でパイ幅の周期性を検出
    const minLag = Math.max(5, Math.round(width / 14));
    const maxLag = Math.round(width / 5);

    let bestCorr = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      const n = width - lag;
      for (let x = 0; x < n; x++) {
        corr += (profile[x] - meanP) * (profile[x + lag] - meanP);
      }
      corr /= n * varP;
      if (corr > bestCorr) bestCorr = corr;
    }

    if (bestCorr > 0.3) {
      // エッジが強い列範囲を検出
      const threshold = meanP * 1.2;
      let cs = 0,
        ce = width - 1;
      for (let x = 0; x < width; x++) {
        if (profile[x] > threshold) {
          cs = Math.max(0, x - 15);
          break;
        }
      }
      for (let x = width - 1; x >= 0; x--) {
        if (profile[x] > threshold) {
          ce = Math.min(width - 1, x + 15);
          break;
        }
      }

      // 色多様性チェック: 表向きパイは複数の異なる色、裏向きは均一ピンク
      // 色相のヒストグラムで色の種類数を推定
      const hueBins = new Int32Array(12); // 30°ごとの色相ビン
      let chromaPixels = 0;
      const cStep = 4;
      for (let y = wy; y < wy + windowH; y += cStep) {
        for (let x = 0; x < width; x += cStep) {
          const idx = (y * width + x) * 4;
          const r = rgba[idx],
            g = rgba[idx + 1],
            b = rgba[idx + 2];
          const max = Math.max(r, g, b),
            min = Math.min(r, g, b);
          if (max === 0 || (max - min) / max < 0.15) continue;
          chromaPixels++;
          const delta = max - min;
          let h = 0;
          if (max === r) h = 60 * (((g - b) / delta) % 6);
          else if (max === g) h = 60 * ((b - r) / delta + 2);
          else h = 60 * ((r - g) / delta + 4);
          if (h < 0) h += 360;
          hueBins[Math.min(11, Math.floor(h / 30))]++;
        }
      }
      // 有意なビン（全体の3%以上を占めるビン）の数 = 色の種類
      const significantBins = Array.from(hueBins).filter((c) => c > chromaPixels * 0.03).length;
      // 表向きパイなら3種以上の色（各パイの背景色がバラバラ）、裏向きは1-2種
      // significantBins < 3 なら裏向きの可能性が高い
      const colorScore = significantBins >= 3 ? 1.0 : significantBins * 0.2;

      // 白ピクセル比率: 表向きパイは白枠がある、裏向きはピンクで白が少ない
      let whiteCount = 0,
        totalSampled = 0;
      for (let y = wy; y < wy + windowH; y += cStep) {
        for (let x = 0; x < width; x += cStep) {
          const idx = (y * width + x) * 4;
          if (
            rgba[idx] > WHITE_THRESHOLD &&
            rgba[idx + 1] > WHITE_THRESHOLD &&
            rgba[idx + 2] > WHITE_THRESHOLD
          )
            whiteCount++;
          totalSampled++;
        }
      }
      const whiteRatio = totalSampled > 0 ? whiteCount / totalSampled : 0;

      // 周期性 × 白枠 × 色多様性 × 帯幅 の複合スコア
      // 白枠あり(>10%)かつ白すぎない(<70%)＝絵柄面、白すぎ(>70%)＝側面
      const whiteScore = whiteRatio > 0.7 ? 0.05 : whiteRatio > 0.1 ? whiteRatio : whiteRatio * 0.1;
      const widthBonus = (ce - cs) / width;
      const compositeScore = bestCorr * whiteScore * (0.3 + colorScore) * (0.5 + widthBonus);

      if (compositeScore > bestScore) {
        bestScore = compositeScore;
        bestY = wy;
        bestColStart = cs;
        bestColEnd = ce;
      }
    }
  }

  if (bestScore < 0.01) return null;

  // 検出した帯を上下に拡張してパイ全体を含める
  const bw = bestColEnd - bestColStart + 1;
  const estPaiWidth = bw / 8;
  const fullPaiH = Math.round(estPaiWidth / PAI_ASPECT_RATIO);

  // 帯の中心を基準に上下に拡張
  const centerY = bestY + windowH / 2;
  const yStart = Math.max(0, Math.round(centerY - fullPaiH / 2));
  const yEnd = Math.min(height, Math.round(centerY + fullPaiH / 2));

  const bandW = bestColEnd - bestColStart + 1;
  const bandH = yEnd - yStart;
  const aspectCount = estimateCountByAspectRatio(bandW, bandH);
  const edgeCount = estimateCountByEdges(gray, width, yStart, yEnd, bestColStart, bestColEnd);
  const edgeInRange = edgeCount !== null && edgeCount >= 5 && edgeCount <= 14;
  const count = edgeInRange ? edgeCount! : Math.max(5, Math.min(14, aspectCount));

  return { yStart, yEnd, colStart: bestColStart, colEnd: bestColEnd, count };
}

/** バンドの品質スコア（タイルの平均面積 × 色多様性） */
function bandQuality(
  band: Omit<BandInfo, 'scaledW' | 'scaledH' | 'rotated'>,
  rgba: Uint8ClampedArray,
  width: number,
): number {
  const bw = band.colEnd - band.colStart;
  const bh = band.yEnd - band.yStart;
  const area = (bw * bh) / band.count;

  // 帯内の色多様性を計算（パイの列は白+カラフル、テーブル面は均一）
  // 彩度が高いピクセルの割合で判定
  let colorfulCount = 0;
  let totalCount = 0;
  const step = 3; // サンプリング間隔
  for (let y = band.yStart; y < band.yEnd; y += step) {
    for (let x = band.colStart; x < band.colEnd; x += step) {
      const idx = (y * width + x) * 4;
      const r = rgba[idx],
        g = rgba[idx + 1],
        b = rgba[idx + 2];
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      if (saturation > 0.2) colorfulCount++;
      totalCount++;
    }
  }
  const colorRatio = totalCount > 0 ? colorfulCount / totalCount : 0;

  // パイの列なら彩度の高いピクセルが15%以上あるはず
  if (colorRatio < 0.1) return 0;

  return area * (1 + colorRatio);
}

/**
 * パイが並んでいるバンド領域のみを切り出した画像を返す。
 * リサイズせずにバンド検出し、元画像から高解像度で切り出す。
 * 検出できなかった場合は null を返す（フォールバックとして元画像を使う）。
 */
export function extractBand(imageData: ImageData, marginScale = 1.9): ImageData | null {
  try {
    const origW = imageData.width;
    const origH = imageData.height;
    const origRgba = new Uint8ClampedArray(imageData.data);

    // 段階的リサイズ関数
    const resizeTo = (
      src: Uint8ClampedArray,
      sw: number,
      sh: number,
      maxDim: number,
    ): { rgba: Uint8ClampedArray; w: number; h: number } => {
      let r = src,
        rw = sw,
        rh = sh;
      while (Math.max(rw, rh) > maxDim * 2) {
        const hw = Math.round(rw / 2),
          hh = Math.round(rh / 2);
        r = resizeImageData(r, rw, rh, hw, hh);
        rw = hw;
        rh = hh;
      }
      if (Math.max(rw, rh) > maxDim) {
        const s = maxDim / Math.max(rw, rh);
        const nw = Math.round(rw * s),
          nh = Math.round(rh * s);
        r = resizeImageData(r, rw, rh, nw, nh);
        rw = nw;
        rh = nh;
      }
      return { rgba: r, w: rw, h: rh };
    };

    // 複数の解像度で帯検出を試み、最も品質の高い結果を使用
    type Candidate = {
      band: NonNullable<ReturnType<typeof findBand>>;
      rgba: Uint8ClampedArray;
      w: number;
      h: number;
      rotated: boolean;
      rotW: number;
      rotCcw?: boolean;
    };
    const candidates: Candidate[] = [];

    // 960px: 横向き + CW/CCW
    {
      const { rgba, w, h } = resizeTo(origRgba, origW, origH, MAX_DIMENSION);

      const hBand = findBand(rgba, w, h);
      if (hBand && hBand.count >= 5) {
        candidates.push({ band: hBand, rgba, w, h, rotated: false, rotW: 0, rotCcw: false });
      }

      const rotCw = rotateRgba90cw(rgba, w, h);
      const cwBand = findBand(rotCw.data, rotCw.width, rotCw.height);
      if (cwBand && cwBand.count >= 5) {
        candidates.push({
          band: cwBand,
          rgba: rotCw.data,
          w: rotCw.width,
          h: rotCw.height,
          rotated: true,
          rotW: rotCw.width,
          rotCcw: false,
        });
      }

      const rotCcw = rotateRgba90ccw(rgba, w, h);
      const ccwBand = findBand(rotCcw.data, rotCcw.width, rotCcw.height);
      if (ccwBand && ccwBand.count >= 5) {
        candidates.push({
          band: ccwBand,
          rgba: rotCcw.data,
          w: rotCcw.width,
          h: rotCcw.height,
          rotated: true,
          rotW: rotCcw.width,
          rotCcw: true,
        });
      }
    }

    // 1920px: 横向きのみ（CW/CCWは960pxで十分）
    {
      const { rgba, w, h } = resizeTo(origRgba, origW, origH, 1920);

      const hBand = findBand(rgba, w, h);
      if (hBand && hBand.count >= 5) {
        candidates.push({ band: hBand, rgba, w, h, rotated: false, rotW: 0, rotCcw: false });
      }
    }

    if (candidates.length === 0) return null;

    // 品質順にソートして順に試す
    candidates.sort((a, b) => bandQuality(b.band, b.rgba, b.w) - bandQuality(a.band, a.rgba, a.w));

    for (const best of candidates) {
      const band = best.band;
      const useRotated = best.rotated;

      // パイ1枚の推定サイズからマージン計算
      const bw = band.colEnd - band.colStart;
      const bh = band.yEnd - band.yStart;
      const estPaiW = bw / band.count;
      const estPaiH = estPaiW / PAI_ASPECT_RATIO;
      const extraDown = Math.max(0, estPaiH - bh);

      // 元画像を作業用に準備
      let workRgba = origRgba;
      let workW = origW;
      let workH = origH;

      // 縦長なら90°回転して横向きにする
      if (useRotated) {
        const rot = best.rotCcw
          ? rotateRgba90ccw(workRgba, workW, workH)
          : rotateRgba90cw(workRgba, workW, workH);
        workRgba = rot.data;
        workW = rot.width;
        workH = rot.height;
      }

      // 切り出し範囲を計算（回転前の座標系）
      const fbScaleX = workW / best.w;
      const fbScaleY = workH / best.h;
      const detectedCenter = (band.colStart + band.colEnd) / 2;
      const requiredHalfWidth = (band.count * estPaiW) / 2;
      const rangeLeft = Math.min(band.colStart, detectedCenter - requiredHalfWidth);
      const rangeRight = Math.max(band.colEnd, detectedCenter + requiredHalfWidth);
      const tiltMargin = Math.round(bh * 0.3);
      const fbMarginX = Math.round((estPaiW * 0.5 + tiltMargin) * marginScale);
      const fbMarginY = Math.round(estPaiH * 0.35 * marginScale);
      const fbL = Math.max(0, Math.round((rangeLeft - fbMarginX) * fbScaleX));
      const fbT = Math.max(0, Math.round((band.yStart - fbMarginY) * fbScaleY));
      const fbR = Math.min(workW, Math.round((rangeRight + fbMarginX) * fbScaleX));
      const fbB = Math.min(
        workH,
        Math.round((band.yEnd + fbMarginY + Math.round(extraDown)) * fbScaleY),
      );
      const fbW = fbR - fbL,
        fbH = fbB - fbT;
      if (fbW < 50 || fbH < 50) return null;

      // 角度補正: 切り出し前に元画像全体を回転して黒枠を防ぐ
      const tiltAngle = estimateTiltFromEdges(best.rgba, best.w, {
        yStart: Math.max(0, band.yStart - Math.round(estPaiH)),
        yEnd: Math.min(best.h, band.yEnd + Math.round(estPaiH)),
        colStart: band.colStart,
        colEnd: band.colEnd,
      });
      if (Math.abs(tiltAngle) > 0.052 && Math.abs(tiltAngle) < Math.PI / 4) {
        const rotated = rotateRgbaByAngle(workRgba, workW, workH, -tiltAngle);
        workRgba = rotated.data;
        workW = rotated.width;
        workH = rotated.height;
      }

      // 回転後の座標で切り出し範囲を再計算（回転で画像が拡大するのでオフセット補正）
      const offX = (workW - (useRotated ? origH : origW)) / 2;
      const offY = (workH - (useRotated ? origW : origH)) / 2;
      const adjFbL = Math.max(0, Math.round(fbL + offX));
      const adjFbT = Math.max(0, Math.round(fbT + offY));
      const adjFbR = Math.min(workW, Math.round(fbR + offX));
      const adjFbB = Math.min(workH, Math.round(fbB + offY));
      const adjFbW = adjFbR - adjFbL,
        adjFbH = adjFbB - adjFbT;
      if (adjFbW < 50 || adjFbH < 50) return null;

      const bandData = new Uint8ClampedArray(adjFbW * adjFbH * 4);
      for (let y = 0; y < adjFbH; y++) {
        for (let x = 0; x < adjFbW; x++) {
          const srcIdx = ((adjFbT + y) * workW + (adjFbL + x)) * 4;
          const dstIdx = (y * adjFbW + x) * 4;
          bandData[dstIdx] = workRgba[srcIdx];
          bandData[dstIdx + 1] = workRgba[srcIdx + 1];
          bandData[dstIdx + 2] = workRgba[srcIdx + 2];
          bandData[dstIdx + 3] = workRgba[srcIdx + 3];
        }
      }

      const validated = validateBandImage(bandData, adjFbW, adjFbH);
      if (validated) return validated;
      // この候補は検証失敗 → 次の候補を試す
    } // for (const best of candidates)

    return null;
  } catch {
    return null;
  }
}

/**
 * 切り出し画像がパイの列を含んでいるか最終検証する。
 * 色多様性と白ピクセル比率で、テーブル面などの誤切り出しを棄却。
 */
function validateBandImage(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): ImageData | null {
  const total = width * height;
  let whiteCount = 0;
  let colorfulCount = 0;
  const step = 5;
  let sampled = 0;

  for (let i = 0; i < total; i += step) {
    const idx = i * 4;
    const r = data[idx],
      g = data[idx + 1],
      b = data[idx + 2];
    if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) whiteCount++;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    if (max > 0 && (max - min) / max > 0.35) colorfulCount++;
    sampled++;
  }

  const whiteRatio = whiteCount / sampled;
  const colorRatio = colorfulCount / sampled;

  // パイの列: 白枠(>5%) + 高彩度の絵柄(>15%)
  // テーブル面は彩度0.35以上のピクセルが少ない
  // パイの列: 白枠(>3%) + 高彩度の絵柄(>10%)
  if (whiteRatio < 0.03 || colorRatio < 0.1) return null;

  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}
