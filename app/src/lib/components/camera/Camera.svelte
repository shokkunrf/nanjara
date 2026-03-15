<script lang="ts">
  import { onMount } from 'svelte';
  import type { HistoryBackEventDetail } from '$lib/types';
  import CameraCapture from './CameraCapture.svelte';
  import CameraResult from './CameraResult.svelte';

  let mode: 'capture' | 'result' = $state('capture');
  let capturedImageUrl: string = $state('');

  function handleCapture(blob: Blob) {
    capturedImageUrl = URL.createObjectURL(blob);
    mode = 'result';
    history.pushState({ label: 'camera-result' }, '');
  }

  function handleRetake() {
    if (capturedImageUrl) {
      URL.revokeObjectURL(capturedImageUrl);
    }
    capturedImageUrl = '';
    mode = 'capture';
  }

  onMount(() => {
    // Layoutからのhistory:backイベントを受け取る
    const handleBack = ((e: CustomEvent<HistoryBackEventDetail>) => {
      if (mode === 'result') {
        handleRetake();
        // 処理済みを通知（Layoutの離脱確認を抑止）
        e.detail.prevented = true;
      }
    }) as EventListener;
    window.addEventListener('history:back', handleBack);
    return () => {
      window.removeEventListener('history:back', handleBack);
      if (capturedImageUrl) {
        URL.revokeObjectURL(capturedImageUrl);
      }
    };
  });
</script>

{#if mode === 'capture'}
  <CameraCapture oncapture={handleCapture} />
{:else}
  <CameraResult imageUrl={capturedImageUrl} onretake={handleRetake} />
{/if}
