/**
 * パイ認識アプリ 型定義
 *
 * 作成日: 2026-03-14
 * 関連設計: architecture.md
 *
 * 信頼性レベル:
 * - 🔵 青信号: EARS要件定義書・設計文書・既存実装を参考にした確実な型定義
 * - 🟡 黄信号: EARS要件定義書・設計文書・既存実装から妥当な推測による型定義
 * - 🔴 赤信号: EARS要件定義書・設計文書・既存実装にない推測による型定義
 */

// ========================================
// 既存型定義（拡張）
// ========================================

/**
 * Camera.svelte の画面モード
 * 🔵 信頼性: 既存実装（capture/result）+ ユーザヒアリング（認識結果は別画面）より
 *
 * 既存: 'capture' | 'result'
 * 拡張: 'capture' | 'preview' | 'recognizing' | 'result'
 */
export type CameraMode = 'capture' | 'preview' | 'recognizing' | 'result';

// ========================================
// パイデータ
// ========================================

/**
 * パイID（ファイル名ベース）
 * 🔵 信頼性: pais.json のキー構造より
 * 例: "001_muse_muse.png", "003_muse_honoka.png"
 */
export type PaiId = string;

/**
 * パイグループ
 * 🔵 信頼性: pais.json・extractor/src/main.ts のグループ定義より
 */
export type PaiGroup =
	| 'muse'
	| 'aqours'
	| 'nijigasaki'
	| 'liella'
	| 'hasunosora'
	| 'musical'
	| 'bluebird';

/**
 * パイ属性（加点役判定に使用）
 * 🔵 信頼性: manual.pdf解読済み + ユーザヒアリング「ユニット・学年・誕生月等」より
 *
 * 各パイが持つ属性。これらの属性の一致により加点役を判定する。
 * 属性の種類は拡張可能。
 */
export interface PaiAttributes {
	/** 所属グループ (例: "muse") */
	group: PaiGroup; // 🔵 pais.json・ファイル名規則より
	/** ユニット (例: "Printemps", "BiBi") */
	unit?: string; // 🔵 manual.pdf解読 + ユーザヒアリングより
	/** 学年 (例: 1, 2, 3) */
	schoolYear?: number; // 🔵 manual.pdf解読 + ユーザヒアリングより
	/** 誕生月 (例: 1-12) */
	birthMonth?: number; // 🔵 manual.pdf解読 + ユーザヒアリングより
	/** その他の属性（拡張用） */
	[key: string]: string | number | boolean | undefined; // 🟡 拡張性のため
}

/**
 * パイメタデータ（pais.json の1エントリに対応）
 * 🔵 信頼性: pais.json の構造 + manual.pdf解読より
 */
export interface PaiMeta {
	/** ファイル名 (例: "003_muse_honoka.png") */
	id: PaiId; // 🔵 pais.json キーより
	/** 日本語表示名 (例: "高坂穂乃果") */
	label: string; // 🔵 pais.json 値より
	/** パイの属性情報（加点役判定用） */
	attributes: PaiAttributes; // 🔵 manual.pdf解読 + ユーザヒアリングより
}

/**
 * パイメタデータの辞書（PaiId → PaiMeta）
 * 🟡 信頼性: pais.jsonの変換形式として妥当な推測
 */
export type PaiMetaMap = Record<PaiId, PaiMeta>;

// ========================================
// 画像認識
// ========================================

/**
 * パイ検出結果（画像内の1パイの領域）
 * 🟡 信頼性: OpenCV.js findContours + boundingRect の出力から妥当な推測
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
	/** 切り出した画像データ */
	imageData: ImageData; // 🟡 OpenCV.js Mat → ImageData変換後の出力
}

/**
 * pHashデータ（事前処理結果）
 * 🟡 信頼性: pHashアルゴリズム設計から妥当な推測
 * hashes.json の構造: { [PaiId]: pHashValue }
 */
export type PaiHashMap = Record<PaiId, string>;

/**
 * パイ識別結果（1枚分）
 * 🟡 信頼性: 認識パイプライン設計から妥当な推測
 */
export interface RecognizedPai {
	/** 識別されたパイID */
	paiId: PaiId; // 🟡 認識結果として
	/** 類似度スコア（ハミング距離の逆数等、0-1） */
	confidence: number; // 🟡 精度評価のため
	/** 検出された画像上の領域 */
	region: DetectedRegion; // 🟡 表示用
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
// 加点役・ジャラ
// ========================================

/**
 * 加点役の条件タイプ
 * 🔵 信頼性: manual.pdf解読済み + ユーザヒアリング「ユニット・学年・誕生月等」より
 *
 * 手牌内のパイが特定の属性を共有しているかで判定する。
 */
export type RuleConditionType =
	| 'same_attribute' // 手牌内のパイが同じ属性値を持つ（例: 同じユニット、同じ学年）
	| 'attribute_value'; // 特定の属性が特定の値を持つ（例: 誕生月が1月）

/**
 * 加点役の条件定義
 * 🔵 信頼性: manual.pdf解読済み + ユーザヒアリングより
 */
export interface RuleCondition {
	/** 条件タイプ */
	type: RuleConditionType; // 🔵 ユーザヒアリングより
	/** 対象属性名 (例: "unit", "schoolYear", "birthMonth") */
	attribute: string; // 🔵 ユーザヒアリングより
	/** 必要枚数（same_attribute時、デフォルト2） */
	count?: number; // 🟡 妥当な推測
	/** 特定の属性値（attribute_value時） */
	value?: string | number; // 🟡 妥当な推測
}

/**
 * 加点役の定義（rules.json の1エントリ）
 * 🔵 信頼性: 要件定義REQ-004, REQ-006 + manual.pdf解読済み + ユーザヒアリングより
 */
export interface ScoringRule {
	/** 加点役ID */
	id: string; // 🟡 ルール管理用
	/** 加点役名（日本語） */
	name: string; // 🔵 要件定義「加点役名を表示」より
	/** 加点役の条件（すべて満たす必要がある） */
	conditions: RuleCondition[]; // 🔵 ユーザヒアリングより
	/** この加点役の固定ジャラ（点数） */
	jara: number; // 🔵 ユーザヒアリング「固定点数」より
}

/**
 * ルールデータ全体（rules.json の構造）
 * 🔵 信頼性: REQ-006 + manual.pdf解読済み + ユーザヒアリングより
 */
export interface RulesData {
	/** 加点役の一覧（30個以上） */
	rules: ScoringRule[]; // 🔵 ユーザヒアリング「30個以上」より
}

/**
 * 加点役判定結果（1件分）
 * 🔵 信頼性: 要件定義REQ-004, REQ-005「加点役名とジャラを表示」より
 */
export interface MatchedRule {
	/** 該当した加点役 */
	rule: ScoringRule; // 🔵 要件定義より
	/** この加点役の固定ジャラ */
	jara: number; // 🔵 要件定義 + ユーザヒアリング「固定点数」より
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
// サービスインターフェース
// ========================================

/**
 * OpenCV.js ローダーのインターフェース
 * 🔵 信頼性: アーキテクチャ設計・先読みロード戦略・設計ヒアリングより確定
 */
export interface IOpenCVLoader {
	/**
	 * OpenCV.js WASMのバックグラウンド先読みを開始する
	 * プレビュー画面表示時に呼び出す
	 */
	preload(): void;

	/**
	 * OpenCV.js のロード完了を保証する
	 * 先読みが完了していれば即座に返る
	 * @returns ロード完了時に解決されるPromise
	 */
	ensureLoaded(): Promise<void>;
}

/**
 * パイ検出サービスのインターフェース
 * 🟡 信頼性: アーキテクチャ設計・データフロー設計から妥当な推測
 */
export interface IPaiDetector {
	/**
	 * 撮影画像からパイ領域を検出する
	 * OpenCV.js の findContours を使用し、任意角度のパイを検出する
	 * 内部で画像の縮小・Mat の解放を行う
	 * @param imageSource 撮影画像のBlob URLまたはImageBitmap
	 * @returns 検出されたパイ領域の配列（左から右の順）
	 */
	detect(imageSource: string | ImageBitmap): Promise<DetectedRegion[]>;
}

/**
 * パイ識別サービスのインターフェース
 * 🟡 信頼性: アーキテクチャ設計・データフロー設計から妥当な推測
 */
export interface IPaiRecognizer {
	/**
	 * パイ領域画像からパイを識別する
	 * pHash によるハミング距離比較で最近傍マッチングを行う
	 * @param regions 検出されたパイ領域の配列
	 * @returns 認識結果
	 */
	recognize(regions: DetectedRegion[]): Promise<RecognitionResult>;
}

/**
 * 加点役判定・ジャラ計算サービスのインターフェース
 * 🔵 信頼性: 要件定義REQ-004, REQ-005 + ユーザヒアリングより確定
 */
export interface IScoringEngine {
	/**
	 * 手牌から加点役を判定しジャラを計算する
	 * 各パイの属性を参照し、条件に一致する加点役を抽出、固定ジャラを単純合算する
	 * @param paiIds 認識されたパイIDの配列
	 * @returns 判定結果（加点役一覧 + 合計ジャラ）
	 */
	score(paiIds: PaiId[]): ScoringResult;
}

// ========================================
// 信頼性レベルサマリー
// ========================================
/**
 * - 🔵 青信号: 27件 (59%)
 * - 🟡 黄信号: 19件 (41%)
 * - 🔴 赤信号: 0件 (0%)
 *
 * 品質評価: 高品質
 *
 * 備考: 🟡が残るのは、画像処理パイプラインの具体的な実装詳細
 * （OpenCV.js出力形式等）が実装時に確定するため。
 * 加点役・ジャラ関連はmanual.pdf解読済み + ユーザヒアリングにより
 * 大幅に🔵に向上。
 */
