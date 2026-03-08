<script lang="ts">
	import CameraPreview from './CameraPreview.svelte';
	import CapturedImage from './CapturedImage.svelte';

	let mode: 'preview' | 'captured' = $state('preview');
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
		mode = 'preview';
	}
</script>

{#if mode === 'preview'}
	<CameraPreview oncapture={handleCapture} />
{:else}
	<CapturedImage imageUrl={capturedImageUrl} onretake={handleRetake} />
{/if}
