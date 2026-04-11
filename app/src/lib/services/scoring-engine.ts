/** 加点役判定エンジン */

import type { PaiId, PaiDetailMap, ScoringRule, MatchedRule, ScoringResult } from '../types.js';

export class ScoringError extends Error {
  override readonly name = 'ScoringError';
}

let detailsCache: PaiDetailMap | null = null;
let rulesCache: ScoringRule[] | null = null;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new ScoringError(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

async function loadData(): Promise<{ details: PaiDetailMap; rules: ScoringRule[] }> {
  if (!detailsCache) {
    detailsCache = await fetchJson<PaiDetailMap>('/pai-details.json');
  }
  if (!rulesCache) {
    rulesCache = await fetchJson<ScoringRule[]>('/rules.json');
  }
  return { details: detailsCache, rules: rulesCache };
}

const INACTIVE_YAKU_IDS_KEY = 'inactiveYakuIds';

/** ルールを一意に識別するIDを生成する */
export function getYakuId(rule: ScoringRule): string {
  return `${rule.name}:${rule.requiredCount}`;
}

/** localStorageから無効化された役IDのSetを読み込む */
export function loadInactiveYakuIds(): Set<string> {
  try {
    const stored = localStorage.getItem(INACTIVE_YAKU_IDS_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch {
    // ignore
  }
  return new Set();
}

/** 無効化された役IDのSetをlocalStorageに保存する */
export function saveInactiveYakuIds(ids: Set<string>): void {
  localStorage.setItem(INACTIVE_YAKU_IDS_KEY, JSON.stringify([...ids]));
}

/**
 * 手牌のパイIDから加点役を判定し、ジャラを計算する。
 *
 * @param paiIds - 手牌のパイID配列
 * @param inactiveYakuIds - 除外する役のID（getYakuId()で生成）のSet
 * @returns 判定結果（成立した加点役一覧 + 合計ジャラ）
 * @throws {ScoringError} データ取得失敗時
 */
export async function score(paiIds: PaiId[], inactiveYakuIds: Set<string>): Promise<ScoringResult> {
  if (paiIds.length === 0) {
    return { matchedRules: [], totalJara: 0 };
  }

  const { details, rules } = await loadData();

  // 全パイのyaku出現回数をカウント
  const yakuCounts = new Map<string, number>();
  for (const paiId of paiIds) {
    const detail = details[paiId];
    if (!detail) continue;
    for (const yaku of detail.yaku) {
      yakuCounts.set(yaku, (yakuCounts.get(yaku) ?? 0) + 1);
    }
  }

  // 各ルールとの照合
  const matchedRules: MatchedRule[] = [];
  for (const rule of rules) {
    if (inactiveYakuIds.has(getYakuId(rule))) {
      continue;
    }
    const count = yakuCounts.get(rule.name) ?? 0;
    if (count >= rule.requiredCount) {
      matchedRules.push({ rule, matchedCount: count });
    }
  }

  const totalJara = matchedRules.reduce(
    (sum, m) => sum + m.rule.jara * (m.rule.perPai ? m.matchedCount : 1),
    0,
  );

  return { matchedRules, totalJara };
}
