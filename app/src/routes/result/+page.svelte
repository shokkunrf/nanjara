<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { RecognitionResult, PaiDetailMap } from '$lib/types';

  let result: RecognitionResult | undefined = $derived(
    (page.state as { result?: RecognitionResult }).result,
  );

  let paiDetails: PaiDetailMap = $state({});

  onMount(() => {
    fetch('/pai-details.json')
      .then((r) => r.json())
      .then((data) => (paiDetails = data));
  });

  function getName(paiId: string): string {
    return paiDetails[paiId]?.name ?? paiId;
  }

  function formatConfidence(confidence: number): string {
    return `${Math.round(confidence * 100)}%`;
  }
</script>

{#if result}
  <div class="result">
    <h1>認識結果</h1>
    <p class="time">{result.processingTimeMs.toFixed(0)}ms</p>

    <ul class="pai-list">
      {#each result.pais as pai, i (i)}
        <li class="pai-item">
          <img src={`/pai-images/${pai.paiId}`} alt={getName(pai.paiId)} />
          <div class="pai-info">
            <span class="pai-name">{getName(pai.paiId)}</span>
            <span class="pai-confidence">{formatConfidence(pai.confidence)}</span>
          </div>
        </li>
      {/each}
    </ul>

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
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
    width: 100%;
    max-width: 400px;
  }

  .pai-item {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 8px;
    width: calc(50% - 6px);
  }

  .pai-item img {
    width: 48px;
    height: 64px;
    object-fit: contain;
    border-radius: 4px;
    background: #222;
  }

  .pai-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .pai-name {
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pai-confidence {
    font-size: 11px;
    color: #888;
  }

  .actions {
    margin-top: 24px;
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
