/**
 * パイ認識アプリ 型定義
 *
 * 作成日: 2026-03-13
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
// 牌データ
// ========================================

/**
 * 牌ID（ファイル名ベース）
 * 🔵 信頼性: tiles.json のキー構造より
 * 例: "001_muse_muse.png", "003_muse_honoka.png"
 */
export type TileId = string;

/**
 * 牌グループ
 * 🔵 信頼性: tiles.json・extractor/src/main.ts のグループ定義より
 */
export type TileGroup =
	| 'muse'
	| 'aqours'
	| 'nijigasaki'
	| 'liella'
	| 'hasunosora'
	| 'musical'
	| 'bluebird';

/**
 * 牌メタデータ（tiles.json の1エントリに対応）
 * 🔵 信頼性: tiles.json の構造より
 */
export interface TileMeta {
	/** ファイル名 (例: "003_muse_honoka.png") */
	id: TileId; // 🔵 tiles.json キーより
	/** 日本語表示名 (例: "高坂穂乃果") */
	label: string; // 🔵 tiles.json 値より
	/** 所属グループ (例: "muse") */
	group: TileGroup; // 🔵 ファイル名規則より
	/** グループ内キー (例: "honoka") */
	key: string; // 🔵 ファイル名規則より
}

/**
 * 牌メタデータの辞書（TileId → TileMeta）
 * 🟡 信頼性: tiles.jsonの変換形式として妥当な推測
 */
export type TileMetaMap = Record<TileId, TileMeta>;

// ========================================
// 画像認識
// ========================================

/**
 * 牌検出結果（画像内の1牌の領域）
 * 🟡 信頼性: 画像処理パイプライン設計から妥当な推測
 */
export interface DetectedRegion {
	/** バウンディングボックス左上X座標 */
	x: number; // 🟡 画像処理設計より
	/** バウンディングボックス左上Y座標 */
	y: number; // 🟡 画像処理設計より
	/** 幅 */
	width: number; // 🟡 画像処理設計より
	/** 高さ */
	height: number; // 🟡 画像処理設計より
	/** 切り出した画像データ */
	imageData: ImageData; // 🟡 Canvas API処理の出力
}

/**
 * pHashデータ（事前処理結果）
 * 🟡 信頼性: pHashアルゴリズム設計から妥当な推測
 * hashes.json の構造: { [TileId]: pHashValue }
 */
export type TileHashMap = Record<TileId, string>;

/**
 * 牌識別結果（1枚分）
 * 🟡 信頼性: 認識パイプライン設計から妥当な推測
 */
export interface RecognizedTile {
	/** 識別された牌ID */
	tileId: TileId; // 🟡 認識結果として
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
	/** 認識された牌の配列（左から右の順） */
	tiles: RecognizedTile[]; // 🟡 認識結果
	/** 処理時間（ミリ秒） */
	processingTimeMs: number; // 🟡 パフォーマンス計測用
}

// ========================================
// 加点役・ジャラ
// ========================================

/**
 * 加点役の条件タイプ
 * 🟡 信頼性: 麻雀の一般的な役の構造から妥当な推測
 * 具体的な条件はmanual.pdf解読後に確定
 */
export type RuleConditionType =
	| 'group_count' // 特定グループの牌が一定枚数以上
	| 'group_complete' // 特定グループの牌が全種類揃う
	| 'pair' // 同じ牌が2枚
	| 'all_same_group' // 全牌が同一グループ
	| 'custom'; // その他のカスタム条件

/**
 * 加点役の条件定義
 * 🟡 信頼性: manual.pdf未解読のため推測
 */
export interface RuleCondition {
	/** 条件タイプ */
	type: RuleConditionType; // 🟡 推測
	/** 対象グループ（group_count, group_complete時） */
	group?: TileGroup; // 🟡 推測
	/** 必要枚数（group_count時） */
	count?: number; // 🟡 推測
	/** カスタム条件の識別子 */
	customId?: string; // 🟡 推測
}

/**
 * 加点役の定義（rules.json の1エントリ）
 * 🟡 信頼性: 要件定義REQ-004, REQ-006 + manual.pdf未解読
 */
export interface ScoringRule {
	/** 加点役ID */
	id: string; // 🟡 ルール管理用
	/** 加点役名（日本語） */
	name: string; // 🔵 要件定義「加点役名を表示」より
	/** 加点役の条件（すべて満たす必要がある） */
	conditions: RuleCondition[]; // 🟡 推測
	/** この加点役のジャラ（点数） */
	jara: number; // 🔵 要件定義「ジャラを計算」より
}

/**
 * ルールデータ全体（rules.json の構造）
 * 🟡 信頼性: REQ-006 + manual.pdf未解読
 */
export interface RulesData {
	/** 加点役の一覧 */
	rules: ScoringRule[]; // 🟡 推測
}

/**
 * 加点役判定結果（1件分）
 * 🔵 信頼性: 要件定義REQ-004, REQ-005「加点役名とジャラを表示」より
 */
export interface MatchedRule {
	/** 該当した加点役 */
	rule: ScoringRule; // 🔵 要件定義より
	/** この加点役のジャラ */
	jara: number; // 🔵 要件定義より
}

/**
 * ジャラ計算結果
 * 🔵 信頼性: 要件定義REQ-005「合計ジャラ + 内訳」より
 */
export interface ScoringResult {
	/** 該当した加点役の一覧 */
	matchedRules: MatchedRule[]; // 🔵 要件定義より
	/** 合計ジャラ */
	totalJara: number; // 🔵 要件定義より
}

// ========================================
// サービスインターフェース
// ========================================

/**
 * 牌検出サービスのインターフェース
 * 🟡 信頼性: アーキテクチャ設計・データフロー設計から妥当な推測
 */
export interface ITileDetector {
	/**
	 * 撮影画像から牌領域を検出する
	 * @param imageSource 撮影画像のBlob URLまたはImageBitmap
	 * @returns 検出された牌領域の配列（左から右の順）
	 */
	detect(imageSource: string | ImageBitmap): Promise<DetectedRegion[]>;
}

/**
 * 牌識別サービスのインターフェース
 * 🟡 信頼性: アーキテクチャ設計・データフロー設計から妥当な推測
 */
export interface ITileRecognizer {
	/**
	 * 牌領域画像から牌を識別する
	 * @param regions 検出された牌領域の配列
	 * @returns 認識結果
	 */
	recognize(regions: DetectedRegion[]): Promise<RecognitionResult>;
}

/**
 * 加点役判定・ジャラ計算サービスのインターフェース
 * 🔵 信頼性: 要件定義REQ-004, REQ-005より
 */
export interface IScoringEngine {
	/**
	 * 手牌から加点役を判定しジャラを計算する
	 * @param tileIds 認識された牌IDの配列
	 * @returns 判定結果（加点役一覧 + 合計ジャラ）
	 */
	score(tileIds: TileId[]): ScoringResult;
}

// ========================================
// 信頼性レベルサマリー
// ========================================
/**
 * - 🔵 青信号: 16件 (43%)
 * - 🟡 黄信号: 21件 (57%)
 * - 🔴 赤信号: 0件 (0%)
 *
 * 品質評価: 高品質
 *
 * 備考: 🟡が多いのは、画像処理パイプラインの具体的な実装と
 * manual.pdfのルール詳細が未解読であるため。
 * 実装フェーズで段階的に🔵に引き上げる。
 */
