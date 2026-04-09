<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { HistoryBackEventDetail, RecognitionResult } from '$lib/types';
  import { recognizeImage } from '$lib/services/recognition-service.js';
  import CameraCapture from '$lib/components/camera/CameraCapture.svelte';
  import CameraResult from '$lib/components/camera/CameraResult.svelte';

  let capturedImageUrl: string = $state('');
  let recognitionPromise: Promise<RecognitionResult> | null = $state(null);

  function handleCapture(blob: Blob) {
    capturedImageUrl = URL.createObjectURL(blob);
    history.pushState({ label: 'camera-preview' }, '');
    recognitionPromise = recognizeImage(capturedImageUrl);
  }

  function handleRetake() {
    recognitionPromise = null;
    if (capturedImageUrl) {
      URL.revokeObjectURL(capturedImageUrl);
    }
    capturedImageUrl = '';
  }

  onMount(() => {
    const handleBack = ((e: CustomEvent<HistoryBackEventDetail>) => {
      if (recognitionPromise) {
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

{#if recognitionPromise}
  <CameraResult imageUrl={capturedImageUrl} {recognitionPromise} onretake={handleRetake} />
{:else}
  <CameraCapture oncapture={handleCapture} onclose={() => goto(resolve('/'))} />
{/if}
