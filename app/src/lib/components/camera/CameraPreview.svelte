<script lang="ts">
	import { onMount } from 'svelte';
	import CameraLayout from './CameraLayout.svelte';

	let { oncapture }: { oncapture: (objectUrl: string) => void } = $props();

	let videoElement: HTMLVideoElement | undefined = $state();
	let canvasElement: HTMLCanvasElement | undefined = $state();
	let stream: MediaStream | undefined = $state();
	let errorMessage: string | undefined = $state();
	let capturing = $state(false);
	let mounted = true;

	onMount(() => {
		startCamera();
		return () => {
			mounted = false;
			stopCamera();
		};
	});

	$effect(() => {
		if (videoElement && stream) {
			videoElement.srcObject = stream;
		}
	});

	async function startCamera() {
		try {
			if (!navigator.mediaDevices?.getUserMedia) {
				errorMessage = 'このブラウザはカメラに対応していません。HTTPSでアクセスしてください。';
				return;
			}
			const mediaStream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: 'environment',
					width: { ideal: 4096 },
					height: { ideal: 4096 }
				},
				audio: false
			});
			if (!mounted) {
				mediaStream.getTracks().forEach((track) => track.stop());
				return;
			}
			stream = mediaStream;
		} catch (err) {
			if (err instanceof DOMException) {
				switch (err.name) {
					case 'NotAllowedError':
						errorMessage = 'カメラの使用が許可されていません。ブラウザの設定からカメラへのアクセスを許可してください。';
						break;
					case 'NotFoundError':
						errorMessage = 'カメラが見つかりません。カメラが接続されているか確認してください。';
						break;
					case 'NotReadableError':
						errorMessage = 'カメラにアクセスできません。他のアプリがカメラを使用している可能性があります。';
						break;
					default:
						errorMessage = `カメラの起動に失敗しました: ${err.message}`;
				}
			} else {
				errorMessage = 'カメラの起動中に予期しないエラーが発生しました。';
			}
		}
	}

	function stopCamera() {
		if (stream) {
			stream.getTracks().forEach((track) => track.stop());
			stream = undefined;
		}
	}

	function capture() {
		if (!videoElement || !canvasElement || !stream || capturing) return;
		capturing = true;

		const vw = videoElement.videoWidth;
		const vh = videoElement.videoHeight;

		// object-fit: cover で 9:16 にクロップされた領域と同じ範囲を切り出す
		const targetRatio = 9 / 16;
		const videoRatio = vw / vh;

		let sx: number, sy: number, sw: number, sh: number;
		if (videoRatio > targetRatio) {
			sh = vh;
			sw = vh * targetRatio;
			sx = (vw - sw) / 2;
			sy = 0;
		} else {
			sw = vw;
			sh = vw / targetRatio;
			sx = 0;
			sy = (vh - sh) / 2;
		}

		canvasElement.width = sw;
		canvasElement.height = sh;

		const ctx = canvasElement.getContext('2d');
		if (!ctx) {
			capturing = false;
			return;
		}

		ctx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, sw, sh);
		canvasElement.toBlob(
			(blob) => {
				if (!blob) {
					capturing = false;
					return;
				}
				const objectUrl = URL.createObjectURL(blob);
				stopCamera();
				oncapture(objectUrl);
			},
			'image/jpeg',
			0.92
		);
	}
</script>

<CameraLayout>
	{#snippet preview()}
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
		{#if !errorMessage}
			<button class="shutter" onclick={capture} disabled={!stream || capturing} aria-label="撮影">
				<span class="shutter-inner"></span>
			</button>
		{/if}
	{/snippet}
</CameraLayout>

<style>
	video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

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
