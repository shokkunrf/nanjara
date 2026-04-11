import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import type { PaiDetailMap, ScoringRule } from '../types.js';

const testPaiDetails: PaiDetailMap = {
  '003_livelive_honoka.png': {
    name: '高坂穂乃果',
    yaku: ['ラブライブ！', "μ's", 'Printemps', '2年生', '8月生まれ', '主人公'],
  },
  '004_livelive_eli.png': {
    name: '絢瀬絵里',
    yaku: ['ラブライブ！', "μ's", 'BiBi', '3年生', '10月生まれ'],
  },
  '005_livelive_kotori.png': {
    name: '南ことり',
    yaku: ['ラブライブ！', "μ's", 'Printemps', '2年生', '9月生まれ'],
  },
  '006_livelive_umi.png': {
    name: '園田海未',
    yaku: ['ラブライブ！', "μ's", 'lily white', '2年生', '3月生まれ'],
  },
  '007_livelive_rin.png': {
    name: '星空凛',
    yaku: ['ラブライブ！', "μ's", 'lily white', 'にこりんぱな', '1年生', '11月生まれ'],
  },
  '008_livelive_maki.png': {
    name: '西木野真姫',
    yaku: ['ラブライブ！', "μ's", 'BiBi', '1年生', '4月生まれ'],
  },
  '009_livelive_nozomi.png': {
    name: '東條希',
    yaku: ['ラブライブ！', "μ's", 'lily white', '3年生', '6月生まれ'],
  },
  '010_livelive_hanayo.png': {
    name: '小泉花陽',
    yaku: ['ラブライブ！', "μ's", 'Printemps', 'にこりんぱな', '1年生', '1月生まれ'],
  },
  '011_livelive_nico.png': {
    name: '矢澤にこ',
    yaku: ['ラブライブ！', "μ's", 'BiBi', 'にこりんぱな', '3年生', '7月生まれ'],
  },
  '014_sunshine_chika.png': {
    name: '高海千歌',
    yaku: ['ラブライブ！サンシャイン!!', 'Aqours', 'CYaRon!', '2年生', '8月生まれ', '主人公'],
  },
  '015_sunshine_riko.png': {
    name: '桜内梨子',
    yaku: ['ラブライブ！サンシャイン!!', 'Aqours', 'Guilty Kiss', '2年生', '9月生まれ'],
  },
  '018_sunshine_you.png': {
    name: '渡辺曜',
    yaku: ['ラブライブ！サンシャイン!!', 'Aqours', 'CYaRon!', '2年生', '4月生まれ'],
  },
  '040_superstar_kanon.png': {
    name: '澁谷かのん',
    yaku: ['ラブライブ！スーパースター!!', 'Liella!', 'CatChu!', '2年生', '5月生まれ', '主人公'],
  },
  '041_superstar_kuku.png': {
    name: '唐可可',
    yaku: ['ラブライブ！スーパースター!!', 'Liella!', 'CatChu!', '2年生', '7月生まれ'],
  },
  '042_superstar_chisato.png': {
    name: '嵐千砂都',
    yaku: ['ラブライブ！スーパースター!!', 'Liella!', '5yncri5e!', '2年生', '2月生まれ'],
  },
};

const testRules: ScoringRule[] = [
  { name: 'ラブライブ！', requiredCount: 3, jara: 20000, color: '#e4007f' },
  { name: 'ラブライブ！', requiredCount: 9, jara: 360000, color: '#e4007f' },
  { name: 'ラブライブ！サンシャイン!!', requiredCount: 3, jara: 20000, color: '#009fe8' },
  { name: 'ラブライブ！サンシャイン!!', requiredCount: 9, jara: 360000, color: '#009fe8' },
  { name: 'ラブライブ！スーパースター!!', requiredCount: 3, jara: 20000, color: '#f5a100' },
  { name: 'ラブライブ！スーパースター!!', requiredCount: 9, jara: 360000, color: '#f5a100' },
  { name: "μ's", requiredCount: 9, jara: 240000, color: '#e4007f' },
  { name: 'Printemps', requiredCount: 3, jara: 120000, color: '#f8c1c8' },
  { name: 'BiBi', requiredCount: 3, jara: 120000, color: '#6a5ba5' },
  { name: 'lily white', requiredCount: 3, jara: 120000, color: '#91c882' },
  { name: 'CYaRon!', requiredCount: 3, jara: 120000, color: '#ff9547' },
  { name: 'CatChu!', requiredCount: 3, jara: 120000, color: '#f06292' },
  { name: 'にこりんぱな', requiredCount: 3, jara: 120000, color: '#ff80ab' },
  { name: '1年生', requiredCount: 5, jara: 60000, color: '#64dd17' },
  { name: '2年生', requiredCount: 5, jara: 60000, color: '#ffab00' },
  { name: '3年生', requiredCount: 5, jara: 60000, color: '#ff1744' },
  { name: '主人公', requiredCount: 1, jara: 20000, color: '#e040fb' },
  { name: '8月生まれ', requiredCount: 3, jara: 60000, color: '#b0bec5' },
];

describe('scoring-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('pai-details.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(testPaiDetails) });
      }
      if (url.includes('rules.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(testRules) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
  });

  it('単一加点役が成立する場合、matchedRulesに含まれる', async () => {
    const { score } = await import('./scoring-engine.js');

    const result = await score(
      ['003_livelive_honoka.png', '005_livelive_kotori.png', '006_livelive_umi.png'],
      new Set(),
    );

    const lovelive = result.matchedRules.find((m) => m.rule.name === 'ラブライブ！');
    expect(lovelive).toBeDefined();
    expect(lovelive!.rule.jara).toBe(20000);
    expect(lovelive!.matchedCount).toBe(3);
  });

  it('複数加点役が合算される', async () => {
    const { score } = await import('./scoring-engine.js');

    // ラブライブ！×3 → 20000, Printemps×2 → 不成立, 主人公×1 → 20000
    const result = await score(
      ['003_livelive_honoka.png', '005_livelive_kotori.png', '006_livelive_umi.png'],
      new Set(),
    );

    expect(result.totalJara).toBe(20000 + 20000); // ラブライブ！ + 主人公
  });

  it('requiredCountに満たない役は成立しない', async () => {
    const { score } = await import('./scoring-engine.js');

    const result = await score(
      ['003_livelive_honoka.png', '005_livelive_kotori.png', '006_livelive_umi.png'],
      new Set(),
    );

    // μ's: 3枚だが requiredCount=9 → 不成立
    const muse = result.matchedRules.find((m) => m.rule.name === "μ's");
    expect(muse).toBeUndefined();

    // Printemps: 2枚だが requiredCount=3 → 不成立
    const printemps = result.matchedRules.find((m) => m.rule.name === 'Printemps');
    expect(printemps).toBeUndefined();
  });

  it('requiredCount=1の役は1枚でも成立し、matchedCountが正確', async () => {
    const { score } = await import('./scoring-engine.js');

    const result = await score(['014_sunshine_chika.png', '040_superstar_kanon.png'], new Set());

    // 主人公×2 → requiredCount=1 なので成立
    const shujinko = result.matchedRules.find((m) => m.rule.name === '主人公');
    expect(shujinko).toBeDefined();
    expect(shujinko!.matchedCount).toBe(2);
  });

  it('空の手牌でtotalJara=0, matchedRules=[]', async () => {
    const { score } = await import('./scoring-engine.js');

    const result = await score([], new Set());

    expect(result.matchedRules).toEqual([]);
    expect(result.totalJara).toBe(0);
  });

  it('matchedCountは正確な出現回数を返す', async () => {
    const { score } = await import('./scoring-engine.js');

    const result = await score(
      ['003_livelive_honoka.png', '005_livelive_kotori.png', '006_livelive_umi.png'],
      new Set(),
    );

    const shujinko = result.matchedRules.find((m) => m.rule.name === '主人公');
    expect(shujinko).toBeDefined();
    expect(shujinko!.matchedCount).toBe(1); // 穂乃果のみ
  });

  it("μ's全員9枚で複数の加点役が同時に成立する", async () => {
    const { score } = await import('./scoring-engine.js');

    const result = await score(
      [
        '003_livelive_honoka.png', // Printemps, 2年生, 主人公
        '004_livelive_eli.png', // BiBi, 3年生
        '005_livelive_kotori.png', // Printemps, 2年生
        '006_livelive_umi.png', // lily white, 2年生
        '007_livelive_rin.png', // lily white, にこりんぱな, 1年生
        '008_livelive_maki.png', // BiBi, 1年生
        '009_livelive_nozomi.png', // lily white, 3年生
        '010_livelive_hanayo.png', // Printemps, にこりんぱな, 1年生
        '011_livelive_nico.png', // BiBi, にこりんぱな, 3年生
      ],
      new Set(),
    );

    // ラブライブ！×9 → requiredCount=3 (20000) と requiredCount=9 (360000) の両方成立
    // μ's×9 → 240000
    // Printemps×3 → 120000
    // BiBi×3 → 120000
    // lily white×3 → 120000
    // にこりんぱな×3 → 120000
    // 主人公×1 → 20000
    // 1年生×3, 2年生×3, 3年生×3 → いずれもrequiredCount=5に不足
    expect(result.totalJara).toBe(
      20000 + 360000 + 240000 + 120000 + 120000 + 120000 + 120000 + 20000,
    );
    expect(result.matchedRules).toHaveLength(8);
  });

  it('3シリーズ×3枚のアガりで各シリーズのrequiredCount=3が成立する', async () => {
    const { score } = await import('./scoring-engine.js');

    const result = await score(
      [
        // ラブライブ！×3
        '003_livelive_honoka.png',
        '005_livelive_kotori.png',
        '006_livelive_umi.png',
        // サンシャイン×3
        '014_sunshine_chika.png',
        '015_sunshine_riko.png',
        '018_sunshine_you.png',
        // スーパースター×3
        '040_superstar_kanon.png',
        '041_superstar_kuku.png',
        '042_superstar_chisato.png',
      ],
      new Set(),
    );

    // 各シリーズ3枚ずつ → requiredCount=3 がそれぞれ成立
    const lovelive = result.matchedRules.find(
      (m) => m.rule.name === 'ラブライブ！' && m.rule.requiredCount === 3,
    );
    expect(lovelive).toBeDefined();
    expect(lovelive!.matchedCount).toBe(3);

    const sunshine = result.matchedRules.find(
      (m) => m.rule.name === 'ラブライブ！サンシャイン!!' && m.rule.requiredCount === 3,
    );
    expect(sunshine).toBeDefined();
    expect(sunshine!.matchedCount).toBe(3);

    const superstar = result.matchedRules.find(
      (m) => m.rule.name === 'ラブライブ！スーパースター!!' && m.rule.requiredCount === 3,
    );
    expect(superstar).toBeDefined();
    expect(superstar!.matchedCount).toBe(3);

    // requiredCount=9 は不成立
    const lovelive9 = result.matchedRules.find(
      (m) => m.rule.name === 'ラブライブ！' && m.rule.requiredCount === 9,
    );
    expect(lovelive9).toBeUndefined();

    // 2年生×9 → requiredCount=5 成立
    const ninensei = result.matchedRules.find((m) => m.rule.name === '2年生');
    expect(ninensei).toBeDefined();
    expect(ninensei!.matchedCount).toBe(9);

    // 主人公×3（穂乃果、千歌、かのん）→ 成立
    const shujinko = result.matchedRules.find((m) => m.rule.name === '主人公');
    expect(shujinko).toBeDefined();
    expect(shujinko!.matchedCount).toBe(3);

    // 合計: ラブライブ！20000 + サンシャイン20000 + スーパースター20000
    //     + 2年生60000 + 主人公20000 = 140000
    // CYaRon!は2枚(千歌・曜)でrequiredCount=3に不足
    expect(result.totalJara).toBe(20000 + 20000 + 20000 + 60000 + 20000);
  });

  it('データ取得に失敗した場合ScoringErrorをスローする', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const { score, ScoringError } = await import('./scoring-engine.js');

    await expect(score(['003_livelive_honoka.png'], new Set())).rejects.toBeInstanceOf(
      ScoringError,
    );
  });
});
