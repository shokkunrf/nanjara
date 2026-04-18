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

  let devices: MediaDeviceInfo[] = $state([]);
  let currentDeviceId: string | undefined = $state();

  onMount(() => {
    startCamera();
    return () => {
      mounted = false;
      stream?.getTracks().forEach((track) => track.stop());
    };
  });

  async function startCamera(deviceId?: string) {
    // 前のストリームを停止
    stream?.getTracks().forEach((track) => track.stop());
    stream = undefined;
    errorMessage = undefined;

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? {
              deviceId: { exact: deviceId },
              width: { ideal: IDEAL_WIDTH },
              height: { ideal: IDEAL_HEIGHT },
            }
          : {
              facingMode: 'environment',
              width: { ideal: IDEAL_WIDTH },
              height: { ideal: IDEAL_HEIGHT },
            },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!mounted) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = mediaStream;
      videoElement!.srcObject = mediaStream;

      // カメラ権限取得後にデバイス一覧を取得（ラベルが見える）
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      devices = allDevices.filter((d) => d.kind === 'videoinput');

      // 現在使用中のデバイスIDを記録
      const videoTrack = mediaStream.getVideoTracks()[0];
      currentDeviceId = videoTrack?.getSettings().deviceId;
    } catch (err) {
      if (err instanceof TypeError) {
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

  function switchCamera(event: Event) {
    const select = event.target as HTMLSelectElement;
    startCamera(select.value);
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
      <button class="close" onclick={onclose}>ホーム</button>
      {#if !errorMessage}
        <button class="shutter" onclick={capture} disabled={!stream || capturing} aria-label="撮影">
          <span class="shutter-inner"></span>
        </button>
      {/if}
      <select class="camera-select" onchange={switchCamera} value={currentDeviceId}>
        {#each devices as device, i (device.deviceId)}
          <option value={device.deviceId}>{device.label || `カメラ ${i + 1}`}</option>
        {/each}
      </select>
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

  .camera-select {
    justify-self: end;
    appearance: none;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    border: 2px solid #fff;
    border-radius: 28px;
    padding: 12px 28px 12px 16px;
    font-size: 13px;
    max-width: 120px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    text-overflow: ellipsis;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='white'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
  }

  .camera-select:active {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
