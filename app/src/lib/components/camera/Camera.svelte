<script lang="ts">
	import CameraCapture from './CameraCapture.svelte';
	import CameraResult from './CameraResult.svelte';

	let mode: 'capture' | 'result' = $state('capture');
	let capturedImageUrl: string = $state('');

	function handleCapture(objectUrl: string) {
		capturedImageUrl = objectUrl;
		mode = 'result';
	}

	function handleRetake() {
		if (capturedImageUrl) {
			URL.revokeObjectURL(capturedImageUrl);
		}
		capturedImageUrl = '';
		mode = 'capture';
	}
</script>

{#if mode === 'capture'}
	<CameraCapture oncapture={handleCapture} />
{:else}
	<CameraResult imageUrl={capturedImageUrl} onretake={handleRetake} />
{/if}
