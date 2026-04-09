<script lang="ts">
  import { onMount } from 'svelte';
  import type { PaiId, PaiDetailMap } from '$lib/types';

  const FRANCHISE_LABELS: Record<string, string> = {
    livelive: 'ラブライブ！',
    sunshine: 'サンシャイン!!',
    nijigaku: '虹ヶ咲',
    superstar: 'スーパースター!!',
    hasujo: '蓮ノ空',
    musical: 'ミュージカル',
    ikizu: 'いきづらい部！',
  };

  let {
    open,
    paiDetails,
    currentPaiIds,
    onselect,
    onclose,
  }: {
    open: boolean;
    paiDetails: PaiDetailMap;
    currentPaiIds: PaiId[];
    onselect: (paiId: PaiId) => void;
    onclose: () => void;
  } = $props();

  let groups = $derived.by(() => {
    const result: { key: string; label: string; pais: { id: PaiId; name: string }[] }[] = [];
    const ids = Object.keys(paiDetails).sort();
    const grouped: Record<string, { id: PaiId; name: string }[]> = {};

    for (const id of ids) {
      const prefix = id.split('_')[1];
      if (!grouped[prefix]) grouped[prefix] = [];
      grouped[prefix].push({ id, name: paiDetails[id].name });
    }

    for (const key of Object.keys(grouped)) {
      result.push({ key, label: FRANCHISE_LABELS[key] ?? key, pais: grouped[key] });
    }

    return result;
  });

  function isUsed(paiId: PaiId): boolean {
    return currentPaiIds.includes(paiId);
  }

  onMount(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  });
</script>

{#if open}
  <div class="overlay" onclick={onclose} role="presentation"></div>
  <div class="drawer">
    <div class="handle-bar"><span class="handle"></span></div>
    <div class="content">
      {#each groups as group (group.key)}
        <section>
          <h3>{group.label}</h3>
          <div class="grid">
            {#each group.pais as pai (pai.id)}
              <button
                class="pai-cell"
                class:used={isUsed(pai.id)}
                disabled={isUsed(pai.id)}
                onclick={() => onselect(pai.id)}
              >
                <img src={`/pai-images/${pai.id}`} alt={pai.name} />
                <span class="name">{pai.name}</span>
              </button>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 100;
  }

  .drawer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 70svh;
    background: #1a1a1a;
    border-radius: 16px 16px 0 0;
    z-index: 101;
    display: flex;
    flex-direction: column;
  }

  .handle-bar {
    display: flex;
    justify-content: center;
    padding: 12px 0 8px;
    flex-shrink: 0;
  }

  .handle {
    width: 40px;
    height: 4px;
    background: #555;
    border-radius: 2px;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 0 16px 24px;
    -webkit-overflow-scrolling: touch;
  }

  h3 {
    font-size: 13px;
    color: #aaa;
    margin: 16px 0 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #333;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .pai-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px 2px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    min-width: 0;
  }

  .pai-cell:active:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
  }

  .pai-cell.used {
    opacity: 0.25;
    cursor: default;
  }

  .pai-cell img {
    width: 48px;
    height: 64px;
    object-fit: contain;
    border-radius: 4px;
  }

  .name {
    font-size: 10px;
    color: #ccc;
    text-align: center;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
  }
</style>
