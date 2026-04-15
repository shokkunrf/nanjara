/**
 * 撮影画像からパイのバンド領域を切り出すサービス（Pure JS実装）
 *
 * OpenCV不使用。垂直エッジ周期性検出 + 角度補正 + 品質検証。
 */

const MAX_DIMENSION = 960;
const WHITE_THRESHOLD = 170;
const PAI_ASPECT_RATIO = 174 / 236; // 幅/高さ

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

/**
 * 行ごとの色多様性 (有意な色相 bin 数) の連続高活性領域から、
 * パイ帯の縦範囲を推定する。
 *
 * パイの表側が並ぶ行では、各パイの背景色・髪色・衣装色など複数の
 * 色相が同時に存在し、bin 数 ≥ 3 になる。一方でテーブル面・無地の
 * 背景・裏向きの uniform pink 山などは 0〜2 bin しか持たない。
 * この差を使って「色多様性が高い行」だけを抽出すると、findBand の
 * 窓位置がパイ上端に張り付いていても、パイ帯全体を上下に拡張して
 * 取り出せるし、背景のパイ山を前景から分離できる。
 */
function refineBandYRange(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  approxCenterY: number,
  fullPaiH: number,
  colStart: number,
  colEnd: number,
): { yStart: number; yEnd: number } {
  const fallback = {
    yStart: Math.max(0, Math.round(approxCenterY - fullPaiH / 2)),
    yEnd: Math.min(height, Math.round(approxCenterY + fullPaiH / 2)),
  };
  const searchHalf = Math.round(fullPaiH * 1.1);
  const yMin = Math.max(0, approxCenterY - searchHalf);
  const yMax = Math.min(height - 1, approxCenterY + searchHalf);
  const rowLen = yMax - yMin + 1;
  if (rowLen < 4 || colEnd <= colStart) return fallback;

  // 行ごとに有意な色相 bin 数を計算
  const numBinsByRow = new Int8Array(rowLen);
  const hueBins = new Int32Array(12);
  const colStep = Math.max(1, Math.round((colEnd - colStart) / 80));
  for (let y = yMin; y <= yMax; y++) {
    hueBins.fill(0);
    let chromaPx = 0;
    for (let x = colStart; x < colEnd; x += colStep) {
      const idx = (y * width + x) * 4;
      const r = rgba[idx],
        g = rgba[idx + 1],
        b = rgba[idx + 2];
      const mx = Math.max(r, g, b),
        mn = Math.min(r, g, b);
      if (mx === 0 || (mx - mn) / mx < 0.2) continue;
      chromaPx++;
      const d = mx - mn;
      let h = 0;
      if (mx === r) h = 60 * (((g - b) / d) % 6);
      else if (mx === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
      if (h < 0) h += 360;
      hueBins[Math.min(11, Math.floor(h / 30))]++;
    }
    let numBins = 0;
    if (chromaPx >= 3) {
      for (let i = 0; i < 12; i++) {
        if (hueBins[i] > chromaPx * 0.1) numBins++;
      }
    }
    numBinsByRow[y - yMin] = numBins;
  }

  // approxCenterY を含む「numBins >= 3」の連続ブロックの上下端を探す。
  // approxCenterY 自体が低色多様性の行 (パイの白縁など) にある場合は、
  // fullPaiH/2 以内で最も近い閾値以上の行に seed を移す。
  const approxI = Math.max(0, Math.min(rowLen - 1, approxCenterY - yMin));
  const thresh = 3;
  let seedI = approxI;
  if (numBinsByRow[seedI] < thresh) {
    const maxShift = Math.round(fullPaiH / 2);
    let found = false;
    for (let d = 1; d <= maxShift; d++) {
      if (approxI + d < rowLen && numBinsByRow[approxI + d] >= thresh) {
        seedI = approxI + d;
        found = true;
        break;
      }
      if (approxI - d >= 0 && numBinsByRow[approxI - d] >= thresh) {
        seedI = approxI - d;
        found = true;
        break;
      }
    }
    if (!found) return fallback;
  }
  // walk の最大距離は seed から各方向に fullPaiH * 0.6 まで。
  // 複数のパイ行 (例: 背景のプリント物 + 前景のパイ行) が連続して
  // 色多様性を持つケースで walk が 2 行分に膨張するのを防ぐ。
  const halfLimit = Math.round(fullPaiH * 0.6);
  const topLimit = Math.max(0, seedI - halfLimit);
  const botLimit = Math.min(rowLen - 1, seedI + halfLimit);
  let topI = seedI;
  while (topI > topLimit && numBinsByRow[topI - 1] >= thresh) topI--;
  let botI = seedI;
  while (botI < botLimit && numBinsByRow[botI + 1] >= thresh) botI++;

  const detectedH = botI - topI;
  if (detectedH < fullPaiH * 0.4) {
    return fallback;
  }

  // 抽出ブロックが fullPaiH より大きく膨張した場合は、
  // fullPaiH サイズに切り詰めて中心を維持
  if (detectedH > fullPaiH * 1.15) {
    const centerI = (topI + botI) / 2;
    const half = fullPaiH / 2;
    return {
      yStart: Math.max(0, Math.round(yMin + centerI - half)),
      yEnd: Math.min(height, Math.round(yMin + centerI + half)),
    };
  }

  return { yStart: yMin + topI, yEnd: yMin + botI };
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
 * 帯の左半分と右半分それぞれで「白 (パイの枠)」の y 重心を求め、
 * その差から行全体の傾き角を推定する。背景 (赤布など) は白ではないので
 * 自動的に除外され、パイ本体だけで重心が決まる。
 *
 * 符号込みで角度を返し、呼び出し側で rect を回転させて tilted な行を覆う。
 */
function estimateTiltAngle(
  rgba: Uint8ClampedArray,
  width: number,
  band: { yStart: number; yEnd: number; colStart: number; colEnd: number },
): number {
  const cS = Math.max(0, Math.floor(band.colStart));
  const cE = Math.min(width, Math.ceil(band.colEnd));
  const bw = cE - cS;
  const bh = band.yEnd - band.yStart;
  if (bw < 40 || bh < 10) return 0;
  const midX = cS + (bw >> 1);
  const yS = Math.max(0, Math.floor(band.yStart));
  const yE = Math.min(Math.floor(rgba.length / 4 / width), Math.ceil(band.yEnd));

  const WHITE_TH = 180; // パイの白枠は十分明るい
  let lSum = 0,
    lWeighted = 0,
    rSum = 0,
    rWeighted = 0;
  for (let y = yS; y < yE; y++) {
    let ly = 0,
      ry = 0;
    const rowBase = y * width * 4;
    for (let x = cS; x < cE; x++) {
      const i = rowBase + x * 4;
      const r = rgba[i],
        g = rgba[i + 1],
        b = rgba[i + 2];
      if (r < WHITE_TH || g < WHITE_TH || b < WHITE_TH) continue;
      // 白い画素 1 とカウント
      if (x < midX) ly++;
      else ry++;
    }
    lSum += ly;
    lWeighted += ly * y;
    rSum += ry;
    rWeighted += ry * y;
  }
  if (lSum === 0 || rSum === 0) return 0;
  const lCy = lWeighted / lSum;
  const rCy = rWeighted / rSum;

  // 左右重心の x 距離は band 幅の半分
  const dx = bw / 2;
  const dy = rCy - lCy;
  const angle = Math.atan2(dy, dx);
  const maxTilt = (16 * Math.PI) / 180;
  return Math.max(-maxTilt, Math.min(maxTilt, angle));
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

  // 列ごとの累積和: colCumSum[(y+1) * width + x] = Σ_{yy=0..y} edge[yy][x]
  // 任意ウィンドウ [wy, wy+windowH) の列和を O(1) で取れる。
  // 最大値 = height * 255 (< 2^24) で Int32 に収まる。
  const colCumSum = new Int32Array((height + 1) * width);
  for (let y = 0; y < height; y++) {
    const srcBase = y * width;
    const prevBase = y * width;
    const dstBase = (y + 1) * width;
    for (let x = 0; x < width; x++) {
      colCumSum[dstBase + x] = colCumSum[prevBase + x] + edge[srcBase + x];
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
    // 画像の上 1/3 の window はスキップ。パイはテーブル (画像の下側) に
    // 置かれる前提なので、上側にある候補 (カメラの奥にある背景の
    // ポスターや印刷物等) を findBand が誤検出するのを防ぐ。
    // portrait 写真では 960 CW/CCW 回転後の空間で判定するため、この
    // "上 1/3" は元画像の左右 1/3 に相当するが、パイは通常中央に
    // 置かれるので問題にならない。
    if (wy + windowH / 2 < height * 0.33) continue;
    // この帯の列ごとのエッジ強度プロファイル
    const profile = new Float64Array(width);
    const topBase = wy * width;
    const bottomBase = (wy + windowH) * width;
    for (let x = 1; x < width; x++) {
      profile[x] = (colCumSum[bottomBase + x] - colCumSum[topBase + x]) / windowH;
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
    // 粗探索 (step=2) で概形を掴み、見つかった最大 lag の前後だけ精探索する。
    // 自己相関は lag について滑らかなので、粗探索で峰を逃すことはほぼない。
    const minLag = Math.max(5, Math.round(width / 14));
    const maxLag = Math.round(width / 5);
    const computeCorrAtLag = (lag: number): number => {
      let corr = 0;
      const n = width - lag;
      for (let x = 0; x < n; x++) {
        corr += (profile[x] - meanP) * (profile[x + lag] - meanP);
      }
      return corr / (n * varP);
    };

    let bestCorr = 0;
    let bestLag = minLag;
    for (let lag = minLag; lag <= maxLag; lag += 2) {
      const corr = computeCorrAtLag(lag);
      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }
    // 粗探索の最大 lag の前後 1 だけ確認して真の最大を捉える
    for (const lag of [bestLag - 1, bestLag + 1]) {
      if (lag >= minLag && lag <= maxLag) {
        const corr = computeCorrAtLag(lag);
        if (corr > bestCorr) bestCorr = corr;
      }
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

      // 色多様性が低い領域 (肌・布・壁・机など 1〜2 色相の背景) を
      // 候補から外す。周期性だけが強い背景領域がパイ行の候補を追い出す
      // regression を防ぐ。表向きのパイ行は通常 3 色相以上を含む
      // (各パイの背景色がバラバラのため)。
      if (significantBins < 3) continue;

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

  // 色多様性で重み付けした row activity (edge 強度 × 行の色相 bin 数) の
  // 連続ピークから pai 帯の縦範囲を推定し直す。best window は windowH が
  // pai 高の半分しかなく pai 上端/下端に張り付く傾向があるため、center ±
  // fullPaiH/2 だと帯がずれる。row activity なら pai 帯に限定して上下端を
  // 拾えるし、色相 bin 重みで背景の uniform pink stack 等の「edge は強いが
  // 色多様性が低い」帯を減点できる。
  const refined = refineBandYRange(
    rgba,
    width,
    height,
    bestY + windowH / 2,
    fullPaiH,
    bestColStart,
    bestColEnd,
  );
  const yStart = refined.yStart;
  const yEnd = refined.yEnd;

  const bandW = bestColEnd - bestColStart + 1;
  const bandH = yEnd - yStart;
  const aspectCount = estimateCountByAspectRatio(bandW, bandH);
  const edgeCount = estimateCountByEdges(gray, width, yStart, yEnd, bestColStart, bestColEnd);
  const edgeInRange = edgeCount !== null && edgeCount >= 5 && edgeCount <= 14;
  const count = edgeInRange ? edgeCount! : Math.max(5, Math.min(14, aspectCount));

  return { yStart, yEnd, colStart: bestColStart, colEnd: bestColEnd, count };
}

export interface Point {
  x: number;
  y: number;
}

/**
 * バンドの4頂点（検出空間での自然な順序）。
 * lt-rt が水平方向（パイの並び）、lt-lb が垂直方向（パイの高さ方向）。
 * 元画像が90°回転されて検出された場合でも、これら4点は元画像座標系に逆変換済み。
 */
export interface BandCorners {
  lt: Point;
  rt: Point;
  rb: Point;
  lb: Point;
}

/**
 * 撮影画像からパイの並びを検出して4頂点を返す。
 * 内部で複数解像度・回転で検出を試み、品質順に検証して最良の候補を返す。
 * 検出できなかった場合は null。
 */
export function detectBand(imageData: ImageData, marginScale = 1.0): BandCorners | null {
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

    type Candidate = {
      band: NonNullable<ReturnType<typeof findBand>>;
      rgba: Uint8ClampedArray;
      w: number;
      h: number;
      rotated: boolean;
      rotCcw?: boolean;
    };

    // 候補から4頂点を計算し、validateに通れば corners を返すヘルパ
    const processCandidate = (best: Candidate): BandCorners | null => {
      const band = best.band;
      const useRotated = best.rotated;

      // 検出空間での作業用画像サイズ（90°回転後）
      const workW = useRotated ? origH : origW;
      const workH = useRotated ? origW : origH;

      // パイ1枚の推定サイズからマージン計算
      const bw = band.colEnd - band.colStart;
      const bh = band.yEnd - band.yStart;
      const estPaiW = bw / band.count;
      const estPaiH = estPaiW / PAI_ASPECT_RATIO;
      const extraDown = Math.max(0, estPaiH - bh);

      // 切り出し範囲（検出解像度 → 作業空間）
      // 軽く控えめな余白のみ追加する。傾き補正は後段のコーナー回転で行うため
      // ここで tilt 用のマージンを足す必要はない。
      const fbScaleX = workW / best.w;
      const fbScaleY = workH / best.h;
      const detectedCenter = (band.colStart + band.colEnd) / 2;
      const requiredHalfWidth = (band.count * estPaiW) / 2;
      const rangeLeft = Math.min(band.colStart, detectedCenter - requiredHalfWidth);
      const rangeRight = Math.max(band.colEnd, detectedCenter + requiredHalfWidth);
      const fbMarginX = Math.round(estPaiW * 0.5 * marginScale);
      const fbMarginY = Math.round(estPaiH * 0.4 * marginScale);

      // 作業空間（90°回転済み）→ 元画像座標系へ逆変換
      const inverseRotate = (p: Point): Point => {
        if (!useRotated) return p;
        if (best.rotCcw) {
          // CCW回転の逆変換: 回転後(rx, ry) → 元(origW-1-ry, rx)
          return { x: origW - 1 - p.y, y: p.x };
        }
        // CW回転の逆変換: 回転後(rx, ry) → 元(ry, origH-1-rx)
        return { x: p.y, y: origH - 1 - p.x };
      };

      // 帯の傾き角度を白画素ベースで推定 (符号付き)
      const tiltAngle = estimateTiltAngle(best.rgba, best.w, {
        yStart: band.yStart,
        yEnd: band.yEnd,
        colStart: band.colStart,
        colEnd: band.colEnd,
      });

      // 検出空間の 4 頂点を計算 (tilt 角だけ中心回りに回転)
      const buildCorners = (marginY: number): BandCorners | null => {
        const fbL = Math.max(0, Math.round((rangeLeft - fbMarginX) * fbScaleX));
        const fbT = Math.max(0, Math.round((band.yStart - marginY) * fbScaleY));
        const fbR = Math.min(workW, Math.round((rangeRight + fbMarginX) * fbScaleX));
        const fbB = Math.min(
          workH,
          Math.round((band.yEnd + marginY + Math.round(extraDown)) * fbScaleY),
        );
        const fbW = fbR - fbL,
          fbH = fbB - fbT;
        if (fbW < 50 || fbH < 50) return null;
        const cx = (fbL + fbR) / 2;
        const cy = (fbT + fbB) / 2;
        const halfW = (fbR - fbL) / 2;
        const halfH = (fbB - fbT) / 2;
        const cosT = Math.cos(tiltAngle);
        const sinT = Math.sin(tiltAngle);
        const rot = (lx: number, ly: number): Point => ({
          x: cx + lx * cosT - ly * sinT,
          y: cy + lx * sinT + ly * cosT,
        });
        const workCorners: BandCorners = {
          lt: rot(-halfW, -halfH),
          rt: rot(halfW, -halfH),
          rb: rot(halfW, halfH),
          lb: rot(-halfW, halfH),
        };
        return {
          lt: inverseRotate(workCorners.lt),
          rt: inverseRotate(workCorners.rt),
          rb: inverseRotate(workCorners.rb),
          lb: inverseRotate(workCorners.lb),
        };
      };

      // 狭めの rect で validation を行う。wide rect は背景を含みすぎて
      // significantBins < 3 で false negative になるため、validation 用と
      // 出力用で margin を分ける。
      const tightMarginY = Math.round(estPaiH * 0.15 * marginScale);
      const tightCorners = buildCorners(tightMarginY);
      if (!tightCorners) return null;
      if (!validateCornersOnImage(origRgba, origW, origH, tightCorners)) return null;

      // 出力用は少し広めに取って、全てのパイ絵柄を確実に覆う
      return buildCorners(fbMarginY) ?? tightCorners;
    };

    // 画像の orientation で候補を絞る。landscape は非回転のみ、portrait は
    // 回転のみ、square は両方を試す。orientation を跨いで候補が混ざると
    // 片方の false positive が相手の正解を奪うため、最初から向きを絞る。
    const isLandscape = origW > origH * 1.3;
    const isPortrait = origH > origW * 1.3;

    const resized960 = resizeTo(origRgba, origW, origH, MAX_DIMENSION);

    // 非回転を順に試す。各段階で validate に通れば後続 findBand/rotation をスキップ。
    if (!isPortrait) {
      // 1) 960px 横向き (landscape 写真の第一候補、大半はここで確定)
      const hBand = findBand(resized960.rgba, resized960.w, resized960.h);
      if (hBand && hBand.count >= 5) {
        const corners = processCandidate({
          band: hBand,
          rgba: resized960.rgba,
          w: resized960.w,
          h: resized960.h,
          rotated: false,
          rotCcw: false,
        });
        if (corners) return corners;
      }

      // 2) 1920px 横向き (960h が弱かった/null だった場合の landscape 救済)
      const hires = resizeTo(origRgba, origW, origH, 1920);
      const hBand1920 = findBand(hires.rgba, hires.w, hires.h);
      if (hBand1920 && hBand1920.count >= 5) {
        const corners = processCandidate({
          band: hBand1920,
          rgba: hires.rgba,
          w: hires.w,
          h: hires.h,
          rotated: false,
          rotCcw: false,
        });
        if (corners) return corners;
      }
    }

    // 回転を順に試す。portrait 写真の主経路。
    // CCW を先に試すことで、縦の列が「元の上→左、下→右」の並びで crop される。
    if (!isLandscape) {
      // 3) 960px CCW 回転
      const rotCcw = rotateRgba90ccw(resized960.rgba, resized960.w, resized960.h);
      const ccwBand = findBand(rotCcw.data, rotCcw.width, rotCcw.height);
      if (ccwBand && ccwBand.count >= 5) {
        const corners = processCandidate({
          band: ccwBand,
          rgba: rotCcw.data,
          w: rotCcw.width,
          h: rotCcw.height,
          rotated: true,
          rotCcw: true,
        });
        if (corners) return corners;
      }

      // 4) 960px CW 回転
      const rotCw = rotateRgba90cw(resized960.rgba, resized960.w, resized960.h);
      const cwBand = findBand(rotCw.data, rotCw.width, rotCw.height);
      if (cwBand && cwBand.count >= 5) {
        const corners = processCandidate({
          band: cwBand,
          rgba: rotCw.data,
          w: rotCw.width,
          h: rotCw.height,
          rotated: true,
          rotCcw: false,
        });
        if (corners) return corners;
      }
    }

    return null;
  } catch (e) {
    console.error('[pai-detector] detectBandで予期しない例外', e);
    return null;
  }
}

/**
 * 4頂点で囲まれた領域に「パイらしさ」があるかを軽くサンプリングして検証する。
 * 全ピクセル走査せずに格子状にサンプリングし、色多様性と非空チェックを行う。
 *
 * 閾値の根拠（撮影サンプルから経験的に決定）:
 * - 8x8=64点サンプル: 全走査の1/1000以下のコストで主要色は十分捕捉できる
 * - 彩度 (max-min)/max >= 0.15: JPEG圧縮ノイズを除外して有彩色とみなす下限
 * - 白ピクセル比 > 70%: パイ側面やテーブル等の真っ白な誤検出を弾く
 * - 有彩色ピクセル >= 20%: テーブル面・床などの無彩色背景を弾く
 * - 色相 >= 3種類 (bin が chromaPixels の 5% 以上): パイはキャラ色が多様、単色背景を弾く
 */
function validateCornersOnImage(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  corners: BandCorners,
): boolean {
  // 4頂点をローカル座標に変換するためのベクトル
  const ux = corners.rt.x - corners.lt.x;
  const uy = corners.rt.y - corners.lt.y;
  const vx = corners.lb.x - corners.lt.x;
  const vy = corners.lb.y - corners.lt.y;

  const SAMPLES = 8; // 8x8 = 64点
  const hueBins = new Int32Array(12);
  let chromaPixels = 0;
  let whiteCount = 0;
  let totalSampled = 0;

  for (let i = 0; i < SAMPLES; i++) {
    for (let j = 0; j < SAMPLES; j++) {
      const u = (i + 0.5) / SAMPLES;
      const v = (j + 0.5) / SAMPLES;
      const px = Math.round(corners.lt.x + ux * u + vx * v);
      const py = Math.round(corners.lt.y + uy * u + vy * v);
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      const idx = (py * width + px) * 4;
      const r = rgba[idx],
        g = rgba[idx + 1],
        b = rgba[idx + 2];
      totalSampled++;

      if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) {
        whiteCount++;
        continue;
      }

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

  if (totalSampled === 0) return false;
  const whiteRatio = whiteCount / totalSampled;
  if (whiteRatio > 0.7) return false; // 真っ白＝側面誤検出
  if (chromaPixels < totalSampled * 0.2) return false; // 色がない＝テーブル等

  // 色の種類が3種以上あるか
  const significantBins = Array.from(hueBins).filter((c) => c > chromaPixels * 0.05).length;
  return significantBins >= 3;
}
