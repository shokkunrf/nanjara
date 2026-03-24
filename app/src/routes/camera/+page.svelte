<script lang="ts">
  import { onMount } from 'svelte';
  import type { CameraMode, HistoryBackEventDetail } from '$lib/types';
  import CameraCapture from '$lib/components/camera/CameraCapture.svelte';
  import CameraResult from '$lib/components/camera/CameraResult.svelte';

  let mode: CameraMode = $state('capture');
  let capturedImageUrl: string = $state('');

  function handleCapture(blob: Blob) {
    capturedImageUrl = URL.createObjectURL(blob);
    mode = 'preview';
    history.pushState({ label: 'camera-preview' }, '');
  }

  function handleRetake() {
    if (capturedImageUrl) {
      URL.revokeObjectURL(capturedImageUrl);
    }
    capturedImageUrl = '';
    mode = 'capture';
  }

  onMount(() => {
    const handleBack = ((e: CustomEvent<HistoryBackEventDetail>) => {
      if (mode === 'preview') {
        handleRetake();
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
