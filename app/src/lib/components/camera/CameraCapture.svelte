<script lang="ts">
  import { onMount } from 'svelte';
  import CameraLayout from './CameraLayout.svelte';

  const IDEAL_WIDTH = 1920;
  const IDEAL_HEIGHT = 1080;
  const JPEG_QUALITY = 0.92;

  let { oncapture, onclose }: { oncapture: (blob: Blob) => void; onclose: () => void } = $props();

  let videoElement: HTMLVideoElement | undefined = $state();
  let canvasElement: HTMLCanvasElement | undefined;
  let stream: MediaStream | undefined = $state();
  let errorMessage: string | undefined = $state();
  let capturing = $state(false);
  let mounted = true;

  onMount(() => {
    startCamera();
    return () => {
      mounted = false;
      stream?.getTracks().forEach((track) => track.stop());
    };
  });

  async function startCamera() {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: 'environment' },
          width: { ideal: IDEAL_WIDTH },
          height: { ideal: IDEAL_HEIGHT },
        },
        audio: false,
      });
      if (!mounted) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = mediaStream;
      videoElement!.srcObject = mediaStream;
    } catch (err) {
      if (err instanceof TypeError) {
        // HTTP環境などでnavigator.mediaDevicesが未定義の場合
        errorMessage = 'このブラウザはカメラに対応していません。HTTPSでアクセスしてください。';
      } else if (err instanceof DOMException) {
        switch (err.name) {
          case 'NotAllowedError':
            errorMessage =
              'カメラの使用が許可されていません。ブラウザの設定からカメラへのアクセスを許可してください。';
            break;
          case 'NotFoundError':
            errorMessage = 'カメラが見つかりません。カメラが接続されているか確認してください。';
            break;
          case 'NotReadableError':
            errorMessage =
              'カメラにアクセスできません。他のアプリがカメラを使用している可能性があります。';
            break;
          default:
            errorMessage = `カメラの起動に失敗しました: ${err.message}`;
        }
      } else {
        errorMessage = 'カメラの起動中に予期しないエラーが発生しました。';
      }
    }
  }

  function capture() {
    if (!videoElement || !canvasElement || !stream || capturing) return;
    capturing = true;

    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    const ctx = canvasElement.getContext('2d');
    if (!ctx) {
      capturing = false;
      return;
    }

    ctx.drawImage(videoElement, 0, 0);
    canvasElement.toBlob(
      (blob) => {
        if (!blob) {
          capturing = false;
          return;
        }
        oncapture(blob);
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
  }
</script>

<CameraLayout>
  {#snippet media()}
    {#if errorMessage}
      <div class="error">
        <p>{errorMessage}</p>
      </div>
    {:else}
      <video bind:this={videoElement} autoplay playsinline muted></video>
    {/if}
    <canvas bind:this={canvasElement} style="display: none;"></canvas>
  {/snippet}

  {#snippet controls()}
    <div class="controls-inner">
      <button class="close" onclick={onclose}>閉じる</button>
      {#if !errorMessage}
        <button class="shutter" onclick={capture} disabled={!stream || capturing} aria-label="撮影">
          <span class="shutter-inner"></span>
        </button>
      {/if}
    </div>
  {/snippet}
</CameraLayout>

<style>
  .error {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
  }

  .error p {
    font-size: 1rem;
    line-height: 1.6;
    color: #ccc;
  }

  .controls-inner {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    width: 100%;
    padding: 0 24px;
  }

  .close {
    justify-self: start;
    padding: 12px 24px;
    border-radius: 28px;
    border: 2px solid #fff;
    background: transparent;
    color: #fff;
    font-size: 1rem;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .close:active {
    background: rgba(255, 255, 255, 0.2);
  }

  .shutter {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    border: 4px solid #fff;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
  }

  .shutter-inner {
    width: 58px;
    height: 58px;
    border-radius: 50%;
    background-color: #fff;
    display: block;
    transition: background-color 0.15s;
  }

  .shutter:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .shutter:active:not(:disabled) .shutter-inner {
    background-color: #ccc;
  }
</style>
