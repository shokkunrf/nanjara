export interface HistoryBackEventDetail {
  prevented: boolean;
}

// ========================================
// カメラ
// ========================================

/**
 * /camera ルート内の画面モード
 *
 * - capture: カメラ撮影画面
 * - preview: 撮影画像確認（「再撮影」「認識する」ボタン）
 *
 * 認識処理中のローディングは CameraResult 内のローカル状態で管理。
 * 認識結果は /result ルートで表示するため CameraMode に含めない。
 */
export type CameraMode = 'capture' | 'preview';

// ========================================
// パイデータ
// ========================================

/**
 * パイID（ファイル名ベース）
 * 例: "001_livelive_muse.png", "003_livelive_honoka.png"
 */
export type PaiId = string;

/**
 * パイメタデータ（pai-details.json の1エントリに対応）
 *
 * pai-details.json の構造:
 * {
 *   "001_livelive_muse.png": { "name": "μ's", "yaku": ["ラブライブ！", "μ's", "国士無双"] },
 *   ...
 * }
 */
export interface PaiDetail {
  /** 日本語表示名 (例: "高坂穂乃果") */
  name: string;
  /** 該当する加点役名のリスト */
  yaku: string[];
}

/**
 * パイメタデータの辞書（ファイル名 → PaiDetail）
 */
export type PaiDetailMap = Record<PaiId, PaiDetail>;

// ========================================
// 画像認識（パイプライン内部）
// ========================================

/**
 * パイ検出結果（画像内の1パイの領域 + 切り出し画像）
 *
 * パイプライン内部で使用。検出後のpHash計算に imageData が必要。
 * 認識完了後は RecognizedPai に変換され、imageData は破棄される。
 */
export interface DetectedRegion {
  /** バウンディングボックス左上X座標 */
  x: number;
  /** バウンディングボックス左上Y座標 */
  y: number;
  /** 幅 */
  width: number;
  /** 高さ */
  height: number;
  /** 切り出した画像データ（pHash計算用、認識完了後は破棄） */
  imageData: ImageData;
}

/**
 * pHashデータ（事前処理結果）
 * pai-hashes.json の構造: { "001_livelive_muse.png": "3e4f64cea0608dbc", ... }
 */
export type PaiHashMap = Record<PaiId, string>;

// ========================================
// 認識結果（/result ルートに渡すデータ）
// ========================================

/**
 * パイ識別結果（1枚分）
 *
 * /result ルートに渡すデータ。表示に必要なのは paiId（参照画像・名前の取得）と confidence のみ。
 * 撮影画像上の座標（region）は結果表示に不要なため持たない。
 */
export interface RecognizedPai {
  /** 識別されたパイID */
  paiId: PaiId;
  /** 類似度スコア（ハミング距離の逆数等、0-1） */
  confidence: number;
}

/**
 * 認識処理全体の結果
 */
export interface RecognitionResult {
  /** 認識されたパイの配列（左から右の順） */
  pais: RecognizedPai[];
  /** 処理時間（ミリ秒） */
  processingTimeMs: number;
}

// ========================================
// 加点役・ジャラ（yaku配列ベース）
// ========================================

/**
 * 加点役ルール定義（rules.json の1エントリ）
 *
 * rules.json の構造:
 * [
 *   { "name": "μ's", "requiredCount": 2, "jara": 10 },
 *   { "name": "国士無双", "requiredCount": 8, "jara": 100 },
 *   ...
 * ]
 */
export interface ScoringRule {
  /** 加点役名（pai-details.json の yaku 配列の値と一致） */
  name: string;
  /** この加点役が成立するために必要なパイ枚数 */
  requiredCount: number;
  /** この加点役の固定ジャラ（点数） */
  jara: number;
}

/**
 * 加点役判定結果（1件分）
 *
 * ジャラは rule.jara で参照する（重複フィールドを持たない）。
 */
export interface MatchedRule {
  /** 該当した加点役 */
  rule: ScoringRule;
  /** 手牌内でこのyakuを持つパイの枚数 */
  matchedCount: number;
}

/**
 * ジャラ計算結果
 */
export interface ScoringResult {
  /** 該当した加点役の一覧 */
  matchedRules: MatchedRule[];
  /** 合計ジャラ（単純合算） */
  totalJara: number;
}
