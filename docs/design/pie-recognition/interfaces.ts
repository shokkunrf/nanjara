/**
 * パイ認識アプリ 型定義
 *
 * 作成日: 2026-03-14
 * 更新日: 2026-03-17
 * 関連設計: architecture.md
 *
 * 信頼性レベル:
 * - 🔵 青信号: EARS要件定義書・設計文書・既存実装を参考にした確実な型定義
 * - 🟡 黄信号: EARS要件定義書・設計文書・既存実装から妥当な推測による型定義
 * - 🔴 赤信号: EARS要件定義書・設計文書・既存実装にない推測による型定義
 *
 * 変更履歴:
 * - 2026-03-17: スコアリングモデルをyaku配列ベースに変更
 *              PaiAttributes/RuleConditionType/RuleCondition を削除（yaku配列方式では不要）
 * - 2026-03-17: PaiGroup削除（未使用）、CameraMode を 'capture' | 'preview' に縮小
 * - 2026-03-17: MatchedRule.jara削除（rule.jaraと重複）
 *              サービスインターフェース削除（DIなしSPAでは過剰）
 *              HistoryBackEventDetail削除（パイ認識の設計型ではない）
 *              DetectedRegion → 内部用と結果表示用に分離
 *
 * 注意:
 * - HistoryBackEventDetail は実装の types.ts には存在するが、
 *   パイ認識機能の設計型ではないためここには含めない
 */

// ========================================
// カメラ
// ========================================

/**
 * /camera ルート内の画面モード
 * 🔵 信頼性: 既存実装 + ユーザヒアリング（認識結果は別ルート /result）より
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
 * 🔵 信頼性: pai-details.json のキー構造より
 * 例: "001_livelive_muse.png", "003_livelive_honoka.png"
 */
export type PaiId = string;

/**
 * パイメタデータ（pai-details.json の1エントリに対応）
 * 🔵 信頼性: pai-details.json の実データ構造より
 *
 * pai-details.json の構造:
 * {
 *   "001_livelive_muse.png": { "name": "μ's", "yaku": ["ラブライブ！", "μ's", "国士無双"] },
 *   ...
 * }
 */
export interface PaiDetail {
	/** 日本語表示名 (例: "高坂穂乃果") */
	name: string; // 🔵 pai-details.json 値より
	/** 該当する加点役名のリスト */
	yaku: string[]; // 🔵 pai-details.json 値より・ユーザヒアリングで確定
}

/**
 * パイメタデータの辞書（ファイル名 → PaiDetail）
 * 🔵 信頼性: pai-details.json の構造より
 */
export type PaiDetailMap = Record<PaiId, PaiDetail>;

// ========================================
// 画像認識（パイプライン内部）
// ========================================

/**
 * パイ検出結果（画像内の1パイの領域 + 切り出し画像）
 * 🟡 信頼性: OpenCV.js findContours + boundingRect の出力から妥当な推測
 *
 * パイプライン内部で使用。検出後のpHash計算に imageData が必要。
 * 認識完了後は RecognizedPai に変換され、imageData は破棄される。
 */
export interface DetectedRegion {
	/** バウンディングボックス左上X座標 */
	x: number; // 🟡 OpenCV.js boundingRect出力
	/** バウンディングボックス左上Y座標 */
	y: number; // 🟡 OpenCV.js boundingRect出力
	/** 幅 */
	width: number; // 🟡 OpenCV.js boundingRect出力
	/** 高さ */
	height: number; // 🟡 OpenCV.js boundingRect出力
	/** 切り出した画像データ（pHash計算用、認識完了後は破棄） */
	imageData: ImageData; // 🟡 OpenCV.js Mat → ImageData変換後の出力
}

/**
 * pHashデータ（事前処理結果）
 * 🔵 信頼性: pai-hashes.json の実データ構造より
 * pai-hashes.json の構造: { "001_livelive_muse.png": "3e4f64cea0608dbc", ... }
 */
export type PaiHashMap = Record<PaiId, string>;

// ========================================
// 認識結果（/result ルートに渡すデータ）
// ========================================

/**
 * パイ識別結果（1枚分）
 * 🟡 信頼性: 認識パイプライン設計から妥当な推測
 *
 * /result ルートに渡すデータ。表示に必要なのは paiId（参照画像・名前の取得）と confidence のみ。
 * 撮影画像上の座標（region）は結果表示に不要なため持たない。
 */
export interface RecognizedPai {
	/** 識別されたパイID */
	paiId: PaiId; // 🟡 認識結果として
	/** 類似度スコア（ハミング距離の逆数等、0-1） */
	confidence: number; // 🟡 精度評価のため
}

/**
 * 認識処理全体の結果
 * 🟡 信頼性: 認識パイプライン設計から妥当な推測
 */
export interface RecognitionResult {
	/** 認識されたパイの配列（左から右の順） */
	pais: RecognizedPai[]; // 🟡 認識結果
	/** 処理時間（ミリ秒） */
	processingTimeMs: number; // 🟡 パフォーマンス計測用
}

// ========================================
// 加点役・ジャラ（yaku配列ベース）
// ========================================

/**
 * 加点役ルール定義（rules.json の1エントリ）
 * 🔵 信頼性: ユーザヒアリング（2026-03-17）で確定
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
	name: string; // 🔵 ユーザヒアリングより
	/** この加点役が成立するために必要なパイ枚数 */
	requiredCount: number; // 🔵 ユーザヒアリング「yakuごとに異なる」より
	/** この加点役の固定ジャラ（点数） */
	jara: number; // 🔵 ユーザヒアリング「固定点数」より
}

/**
 * 加点役判定結果（1件分）
 * 🔵 信頼性: 要件定義REQ-004, REQ-005「加点役名とジャラを表示」より
 *
 * ジャラは rule.jara で参照する（重複フィールドを持たない）。
 */
export interface MatchedRule {
	/** 該当した加点役 */
	rule: ScoringRule; // 🔵 要件定義より
	/** 手牌内でこのyakuを持つパイの枚数 */
	matchedCount: number; // 🔵 表示用
}

/**
 * ジャラ計算結果
 * 🔵 信頼性: 要件定義REQ-005「合計ジャラ + 内訳」+ ユーザヒアリング「単純合算」より
 */
export interface ScoringResult {
	/** 該当した加点役の一覧 */
	matchedRules: MatchedRule[]; // 🔵 要件定義より
	/** 合計ジャラ（単純合算） */
	totalJara: number; // 🔵 要件定義 + ユーザヒアリング「単純合算」より
}

// ========================================
// 信頼性レベルサマリー
// ========================================
/**
 * - 🔵 青信号: 13件 (59%)
 * - 🟡 黄信号: 9件 (41%)
 * - 🔴 赤信号: 0件 (0%)
 *
 * 品質評価: 高品質
 *
 * 備考:
 * - 🟡が残るのは、画像処理パイプラインの具体的な実装詳細
 *   （OpenCV.js出力形式等）が実装時に確定するため。
 * - サービスインターフェース（IOpenCVLoader等）は削除。
 *   DIコンテナのないSvelteKit SPAでは、モジュールを直接importするため不要。
 *   テスト時のモックは vi.mock() で対応。
 */
