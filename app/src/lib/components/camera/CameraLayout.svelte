<script lang="ts">
	import type { Snippet } from 'svelte';

	let { preview, controls }: { preview: Snippet; controls: Snippet } = $props();
</script>

<div class="container">
	<div class="preview">
		{@render preview()}
	</div>

	<div class="controls">
		{@render controls()}
	</div>
</div>

<style>
	.container {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.preview {
		width: 100%;
		aspect-ratio: 9 / 16;
		min-height: 0;
		position: relative;
		background-color: #000;
	}

	.controls {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding-bottom: env(safe-area-inset-bottom);
	}
</style>
