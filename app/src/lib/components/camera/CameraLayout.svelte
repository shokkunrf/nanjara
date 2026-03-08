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
		flex: 1;
		min-height: 0;
		position: relative;
		background-color: #000;
	}

	.preview :global(video),
	.preview :global(img) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.controls {
		height: calc(120px + env(safe-area-inset-bottom));
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding-bottom: env(safe-area-inset-bottom);
	}
</style>
