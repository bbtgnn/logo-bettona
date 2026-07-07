<script lang="ts">
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import {
		composition,
		setAspectRatio,
		canvasFormat,
		setPrintFormat,
		setPrintOrientation
	} from '$lib/state/composition';
	import { ASPECT_RATIOS } from '$lib/geometry/aspect-ratio';
	import { PRINT_FORMATS, type PrintFormatId, type Orientation } from '$lib/geometry/print-format';
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
					disabled={exportStatus.rendering || canvasFormat.printFormat !== null}
					onchange={(e) => setAspectRatio((e.target as HTMLSelectElement).value as AspectRatio)}
				>
					{#each ASPECT_RATIOS as ratio (ratio)}
						<option value={ratio}>{ratio}</option>
					{/each}
				</select>
			</div>

			<div class="flex flex-col gap-1">
				<Label for="canvas-print-format" class="text-xs">{m.composition_print_format()}</Label>
				<select
					id="canvas-print-format"
					class="h-9 w-full rounded-md border border-input bg-background py-1 text-xs disabled:opacity-50"
					value={canvasFormat.printFormat ?? ''}
					disabled={exportStatus.rendering}
					onchange={(e) => {
						const v = (e.target as HTMLSelectElement).value;
						setPrintFormat(v === '' ? null : (v as PrintFormatId));
					}}
				>
					<option value="">{m.composition_print_format_digital()}</option>
					{#each PRINT_FORMATS as format (format.id)}
						<option value={format.id}>{format.label}</option>
					{/each}
				</select>
			</div>

			{#if canvasFormat.printFormat !== null}
				<div class="flex flex-col gap-1">
					<Label for="canvas-orientation" class="text-xs">{m.composition_orientation()}</Label>
					<select
						id="canvas-orientation"
						class="h-9 w-full rounded-md border border-input bg-background py-1 text-xs disabled:opacity-50"
						value={canvasFormat.orientation}
						disabled={exportStatus.rendering}
						onchange={(e) =>
							setPrintOrientation((e.target as HTMLSelectElement).value as Orientation)}
					>
						<option value="portrait">{m.composition_orientation_portrait()}</option>
						<option value="landscape">{m.composition_orientation_landscape()}</option>
					</select>
				</div>
			{/if}
		</div>
	{/snippet}
</SidebarCollapsible>
