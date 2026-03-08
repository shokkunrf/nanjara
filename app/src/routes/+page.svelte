<script lang="ts">
	import CameraPreview from '$lib/components/camera/CameraPreview.svelte';
	import CapturedImage from '$lib/components/camera/CapturedImage.svelte';

	let mode: 'camera' | 'captured' = $state('camera');
	let capturedImageUrl: string = $state('');

	function handleCapture(objectUrl: string) {
		capturedImageUrl = objectUrl;
		mode = 'captured';
	}

	function handleRetake() {
		if (capturedImageUrl) {
			URL.revokeObjectURL(capturedImageUrl);
		}
		capturedImageUrl = '';
		mode = 'camera';
	}
</script>

<div class="page">
	{#if mode === 'camera'}
		<CameraPreview oncapture={handleCapture} />
	{:else}
		<CapturedImage imageDataUrl={capturedImageUrl} onretake={handleRetake} />
	{/if}
</div>

<style>
	.page {
		width: 100%;
		height: 100svh;
		overflow: hidden;
	}
</style>
