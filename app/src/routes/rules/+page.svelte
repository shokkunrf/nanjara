<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { ScoringRule } from '$lib/types';

  let rules: ScoringRule[] = $state([]);
  let errorMessage: string | undefined = $state();

  onMount(async () => {
    try {
      const res = await fetch('/rules.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      rules = await res.json();
    } catch {
      errorMessage = 'ルールの読み込みに失敗しました。';
    }
  });

  function formatJara(jara: number): string {
    return jara.toLocaleString();
  }
</script>

<div class="page">
  <header>
    <button class="back" onclick={() => goto(resolve('/'))}>← 戻る</button>
    <h1>ルール一覧</h1>
  </header>

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {:else if rules.length > 0}
    <ul class="rule-list">
      {#each rules as rule, i (i)}
        <li class="rule-item" style="border-left: 3px solid {rule.color}">
          <span class="rule-name">{rule.name}</span>
          <span class="rule-count">{rule.requiredCount}枚</span>
          <span class="rule-jara">{formatJara(rule.jara)} ジャラ</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  :global(body) {
    overflow: auto !important;
  }

  .page {
    padding: 16px;
    max-width: 480px;
    margin: 0 auto;
  }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .back {
    background: none;
    border: none;
    color: #e91e63;
    font-size: 14px;
    cursor: pointer;
    padding: 4px 0;
    -webkit-tap-highlight-color: transparent;
  }

  h1 {
    font-size: 20px;
    margin: 0;
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

  .rule-count {
    font-size: 12px;
    color: #888;
    white-space: nowrap;
  }

  .error {
    text-align: center;
    color: #ff5252;
    font-size: 14px;
  }

  .rule-jara {
    font-size: 14px;
    color: #e91e63;
    font-weight: 600;
    white-space: nowrap;
  }
</style>
