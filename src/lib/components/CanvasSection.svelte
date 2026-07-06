<script lang="ts">
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { composition, setAspectRatio } from '$lib/state/composition';
	import { ASPECT_RATIOS } from '$lib/geometry/aspect-ratio';
	import type { AspectRatio } from '$lib/types';
	import { exportStatus } from '$lib/state/export-status.svelte';
	import { m } from '$lib/paraglide/messages';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{m.editor_canvas()}
	{/snippet}

	{#snippet content()}
		<div class="flex flex-col gap-3">
			<div class="flex flex-col gap-1">
				<Label for="canvas-ratio" class="text-xs">{m.editor_aspect_ratio()}</Label>
				<select
					id="canvas-ratio"
					class="h-9 w-full rounded-md border border-input bg-background py-1 text-xs disabled:opacity-50"
					value={composition.aspectRatio}
					disabled={exportStatus.rendering}
					onchange={(e) => setAspectRatio((e.target as HTMLSelectElement).value as AspectRatio)}
				>
					{#each ASPECT_RATIOS as ratio (ratio)}
						<option value={ratio}>{ratio}</option>
					{/each}
				</select>
			</div>

			<!-- Reserved space for a future print-format control (disabled, no logic yet). -->
			<div class="flex flex-col gap-1">
				<Label for="canvas-print-format" class="text-xs">{m.composition_print_format()}</Label>
				<select
					id="canvas-print-format"
					class="h-9 w-full rounded-md border border-input bg-background py-1 text-xs disabled:opacity-50"
					disabled
				>
					<option>{m.composition_coming_soon()}</option>
				</select>
			</div>
		</div>
	{/snippet}
</SidebarCollapsible>
