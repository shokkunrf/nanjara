<script lang="ts">
	import CameraLayout from './CameraLayout.svelte';

	let {
		imageDataUrl,
		onretake
	}: { imageDataUrl: string; onretake: () => void } = $props();
</script>

<CameraLayout>
	{#snippet preview()}
		<img src={imageDataUrl} alt="撮影画像" />
	{/snippet}

	{#snippet controls()}
		<button class="retake" onclick={onretake}>再撮影</button>
	{/snippet}
</CameraLayout>

<style>
	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.retake {
		padding: 12px 32px;
		border-radius: 28px;
		border: 2px solid #fff;
		background: rgba(0, 0, 0, 0.5);
		color: #fff;
		font-size: 1rem;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.retake:active {
		background: rgba(255, 255, 255, 0.2);
	}
</style>
