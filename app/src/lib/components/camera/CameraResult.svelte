<script lang="ts">
	import CameraLayout from './CameraLayout.svelte';

	let { imageUrl, onretake }: { imageUrl: string; onretake: () => void } = $props();
</script>

<CameraLayout>
	{#snippet media()}
		<img src={imageUrl} alt="撮影画像" />
	{/snippet}

	{#snippet controls()}
		<button class="retake" onclick={onretake}>再撮影</button>
	{/snippet}
</CameraLayout>

<style>
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
