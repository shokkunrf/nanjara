<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { RecognitionResult, PaiDetailMap, ScoringResult, ScoringRule } from '$lib/types';
  import { score, loadInactiveYakuIds } from '$lib/services/scoring-engine.js';
  import PaiSelectDrawer from '$lib/components/PaiSelectDrawer.svelte';

  let result: RecognitionResult | undefined = $state();
  let paiDetails: PaiDetailMap = $state({});
  let scoringResult: ScoringResult | null = $state(null);
  let yakuColorMap: Record<string, string> = $state({});
  let errorMessage: string | undefined = $state();
  let editingIndex: number | null = $state(null);
  let drawerOpen = $derived(editingIndex !== null);
  let currentPaiIds = $derived(result?.pais.filter((p) => p.paiId).map((p) => p.paiId) ?? []);
  const HAND_SIZE = 9;

  onMount(async () => {
    result = (page.state as { result?: RecognitionResult }).result;
    if (!result) {
      try {
        const stored = sessionStorage.getItem('recognitionResult');
        if (stored) result = JSON.parse(stored);
      } catch {
        // ignore invalid data
      }
    }

    if (result) {
      while (result.pais.length < HAND_SIZE) {
        result.pais.push({ paiId: '' });
      }
    }

    try {
      const [pd, rules] = await Promise.all([
        fetch('/pai-details.json').then((r) => r.json()),
        fetch('/rules.json').then((r) => r.json()) as Promise<ScoringRule[]>,
      ]);
      paiDetails = pd;
      yakuColorMap = Object.fromEntries(rules.map((r) => [r.name, r.color]));
    } catch {
      errorMessage = 'データの読み込みに失敗しました。';
      return;
    }

    scoringResult = await score(currentPaiIds, loadInactiveYakuIds());
  });

  function getName(paiId: string): string {
    return paiDetails[paiId]?.name ?? paiId;
  }

  function yakuColor(yaku: string): string {
    return yakuColorMap[yaku] ?? '#888';
  }

  function formatJara(jara: number): string {
    return jara.toLocaleString();
  }

  async function handleReplace(paiId: string) {
    if (editingIndex === null || !result) return;
    result.pais[editingIndex] = { paiId };
    editingIndex = null;
    scoringResult = await score(currentPaiIds, loadInactiveYakuIds());
    sessionStorage.setItem('recognitionResult', JSON.stringify(result));
  }
</script>

{#if errorMessage}
  <div class="empty">
    <p class="error">{errorMessage}</p>
    <button class="btn" onclick={() => goto(resolve('/camera'))}>撮影する</button>
  </div>
{:else if result}
  <div class="result">
    <h1>認識結果</h1>
    <p class="time">{result.processingTimeMs.toFixed(0)}ms</p>

    <ul class="pai-list">
      {#each result.pais as pai, i (i)}
        <li class="pai-item">
          <button class="pai-button" onclick={() => (editingIndex = i)}>
            {#if pai.paiId}
              <img src={`/pai-images/${pai.paiId}`} alt={getName(pai.paiId)} />
              <div class="pai-info">
                <span class="pai-name">{getName(pai.paiId)}</span>
                {#if paiDetails[pai.paiId]?.yaku.length}
                  <div class="pai-yaku">
                    {#each paiDetails[pai.paiId].yaku as yaku (yaku)}
                      <span
                        class="yaku-tag"
                        style="border-color: {yakuColor(yaku)}; color: {yakuColor(yaku)}"
                        >{yaku}</span
                      >
                    {/each}
                  </div>
                {/if}
              </div>
            {:else}
              <div class="pai-empty"></div>
              <div class="pai-info">
                <span class="pai-name empty-label">未認識</span>
              </div>
            {/if}
          </button>
        </li>
      {/each}
    </ul>

    {#if scoringResult}
      <section class="scoring">
        <h2>合計 {formatJara(scoringResult.totalJara)} ジャラ</h2>

        {#if scoringResult.matchedRules.length > 0}
          <ul class="rule-list">
            {#each scoringResult.matchedRules as matched, i (i)}
              <li class="rule-item">
                <span class="rule-name">{matched.rule.name}</span>
                <span class="rule-detail"
                  >{matched.matchedCount}枚 / {matched.rule.requiredCount}枚</span
                >
                <span class="rule-jara">+{formatJara(matched.rule.jara)}</span>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="no-rules">加点役なし</p>
        {/if}
      </section>
    {/if}

    <div class="actions">
      <button class="btn" onclick={() => goto(resolve('/camera'))}>再撮影</button>
    </div>
  </div>
{:else}
  <div class="empty">
    <p>認識結果がありません</p>
    <button class="btn" onclick={() => goto(resolve('/camera'))}>撮影する</button>
  </div>
{/if}

<PaiSelectDrawer
  open={drawerOpen}
  {paiDetails}
  {currentPaiIds}
  onselect={handleReplace}
  onclose={() => (editingIndex = null)}
/>

<style>
  :global(body) {
    overflow: auto !important;
  }

  .result {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 16px;
    min-height: 100svh;
  }

  h1 {
    font-size: 20px;
    margin: 0 0 4px;
  }

  .time {
    font-size: 12px;
    color: #888;
    margin: 0 0 16px;
  }

  .pai-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 400px;
  }

  .pai-button {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 8px;
    width: 100%;
    border: none;
    color: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .pai-button:active {
    background: rgba(255, 255, 255, 0.2);
  }

  .pai-item img {
    width: 48px;
    height: 64px;
    object-fit: contain;
    border-radius: 4px;
    background: #222;
  }

  .pai-empty {
    width: 48px;
    height: 64px;
    border-radius: 4px;
    background: #222;
    border: 2px dashed #444;
  }

  .empty-label {
    color: #555;
  }

  .pai-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 0;
  }

  .pai-name {
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pai-yaku {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .yaku-tag {
    font-size: 10px;
    border: 1px solid;
    border-radius: 4px;
    padding: 1px 6px;
    white-space: nowrap;
  }

  .scoring {
    width: 100%;
    max-width: 400px;
    margin-top: 24px;
  }

  h2 {
    font-size: 24px;
    text-align: center;
    margin: 0 0 12px;
    color: #e91e63;
  }

  .rule-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rule-item {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px 12px;
  }

  .rule-name {
    font-size: 14px;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rule-detail {
    font-size: 12px;
    color: #888;
    white-space: nowrap;
  }

  .rule-jara {
    font-size: 14px;
    color: #e91e63;
    font-weight: 600;
    white-space: nowrap;
  }

  .no-rules {
    text-align: center;
    color: #888;
    font-size: 14px;
  }

  .actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
    padding-bottom: 24px;
  }

  .btn {
    padding: 12px 32px;
    border-radius: 28px;
    border: 2px solid #fff;
    background: transparent;
    color: #fff;
    font-size: 1rem;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .btn:active {
    background: rgba(255, 255, 255, 0.2);
  }

  .error {
    color: #ff5252;
    font-size: 14px;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100svh;
    color: #aaa;
    gap: 24px;
  }
</style>
