<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import CameraLayout from './CameraLayout.svelte';
  import type { RecognitionResult } from '$lib/types';

  let {
    imageUrl,
    recognitionPromise,
    onretake,
  }: {
    imageUrl: string;
    recognitionPromise: Promise<RecognitionResult>;
    onretake: () => void;
  } = $props();

  let isRecognizing = $state(false);
  let errorMessage = $state('');

  async function handleRecognize() {
    isRecognizing = true;
    errorMessage = '';

    try {
      const result = await recognitionPromise;
      sessionStorage.setItem('recognitionResult', JSON.stringify(result));
      await goto(resolve('/hand'), { state: { result } });
    } catch {
      errorMessage = '認識に失敗しました。再撮影してください。';
      isRecognizing = false;
    }
  }
</script>

<CameraLayout>
  {#snippet media()}
    <img src={imageUrl} alt="撮影画像" />
    {#if errorMessage}
      <p class="error">{errorMessage}</p>
    {/if}
  {/snippet}

  {#snippet controls()}
    <div class="buttons">
      <button class="retake" onclick={onretake} disabled={isRecognizing}>再撮影</button>
      <button class="recognize" onclick={handleRecognize} disabled={isRecognizing}>
        {#if isRecognizing}
          認識中…
        {:else}
          認識する
        {/if}
      </button>
    </div>
  {/snippet}
</CameraLayout>

<style>
  .buttons {
    display: flex;
    gap: 16px;
  }

  .retake,
  .recognize {
    padding: 12px 32px;
    border-radius: 28px;
    border: 2px solid #fff;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    font-size: 1rem;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .retake:active,
  .recognize:active {
    background: rgba(255, 255, 255, 0.2);
  }

  .recognize {
    background: #e91e63;
    border-color: #e91e63;
  }

  .retake:disabled,
  .recognize:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error {
    position: absolute;
    bottom: 12px;
    left: 0;
    right: 0;
    text-align: center;
    color: #ff5252;
    font-size: 14px;
    margin: 0;
    padding: 8px 16px;
    background: rgba(0, 0, 0, 0.7);
  }
</style>
