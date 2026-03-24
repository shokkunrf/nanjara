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

/**
 * 手牌のパイIDから加点役を判定し、ジャラを計算する。
 *
 * @param paiIds - 手牌のパイID配列
 * @returns 判定結果（成立した加点役一覧 + 合計ジャラ）
 * @throws {ScoringError} データ取得失敗時
 */
export async function score(paiIds: PaiId[]): Promise<ScoringResult> {
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
    const count = yakuCounts.get(rule.name) ?? 0;
    if (count >= rule.requiredCount) {
      matchedRules.push({ rule, matchedCount: count });
    }
  }

  const totalJara = matchedRules.reduce((sum, m) => sum + m.rule.jara, 0);

  return { matchedRules, totalJara };
}
