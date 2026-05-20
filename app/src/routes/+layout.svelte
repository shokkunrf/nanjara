<script lang="ts">
  import { onMount } from 'svelte';
  import type { HistoryBackEventDetail } from '$lib/types';
  import favicon from '$lib/assets/favicon.svg';
  let { children } = $props();
  let showToast = $state(false);

  onMount(() => {
    // ガードエントリを積む（ユーザーがページを操作済みなら有効）
    history.pushState({ label: 'guard' }, '');

    let timer: ReturnType<typeof setTimeout>;

    const handlePopstate = () => {
      // 子コンポーネントに戻るイベントを通知
      const detail: HistoryBackEventDetail = { prevented: false };
      window.dispatchEvent(new CustomEvent<HistoryBackEventDetail>('history:back', { detail }));

      if (detail.prevented) {
        // アプリ内状態遷移で処理済み → ガードを積み直す
        history.pushState({ label: 'guard' }, '');
        return;
      }

      // 1回目 → トースト表示、ガードは積み直さない
      // 2回目（2秒以内）→ ガードがないのでそのまま離脱（popstate発火せず）
      showToast = true;

      timer = setTimeout(() => {
        // 2秒以内に2回目が来なかった → ガードを積み直す
        showToast = false;
        history.pushState({ label: 'guard' }, '');
      }, 2000);
    };
    window.addEventListener('popstate', handlePopstate);

    return () => {
      window.removeEventListener('popstate', handlePopstate);
      clearTimeout(timer);
    };
  });
</script>

<svelte:head>
  <title>nanjara</title>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

{#if showToast}
  <div class="toast">もう一度押すと終了します</div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(50, 50, 50, 0.9);
    color: #fff;
    padding: 12px 24px;
    border-radius: 24px;
    font-size: 14px;
    z-index: 9999;
    pointer-events: none;
  }

  :global(html, body) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100svh;
    overflow: hidden;
    background-color: #000;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
</style>
