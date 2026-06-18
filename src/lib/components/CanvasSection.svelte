<script lang="ts">
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { composition, setAspectRatio } from '$lib/state/composition';
	import { ASPECT_RATIOS } from '$lib/geometry/aspect-ratio';
	import type { AspectRatio } from '$lib/types';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		Canvas
	{/snippet}

	{#snippet content()}
		<div class="flex flex-col gap-1">
			<Label for="canvas-ratio" class="text-xs">Aspect ratio</Label>
			<select
				id="canvas-ratio"
				class="h-9 rounded-md border border-input bg-background px-3 text-xs"
				value={composition.aspectRatio}
				onchange={(e) => setAspectRatio((e.target as HTMLSelectElement).value as AspectRatio)}
			>
				{#each ASPECT_RATIOS as ratio (ratio)}
					<option value={ratio}>{ratio}</option>
				{/each}
			</select>
		</div>
	{/snippet}
</SidebarCollapsible>
