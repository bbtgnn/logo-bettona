<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { createPreviewPresenter } from './preview-presenter.svelte';

	const presenter = createPreviewPresenter();
</script>

<div class="flex shrink-0 flex-col items-center gap-3">
	<canvas {@attach presenter.attach} width="600" height="600" class="rounded-lg border bg-white"
	></canvas>
	<Button variant="outline" onclick={presenter.exportSvg} class="w-full max-w-[600px]">
		Export SVG
	</Button>
</div>
