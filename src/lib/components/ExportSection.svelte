<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { previewPresenter } from './preview-presenter.svelte';
	import { exportStatus } from '$lib/state/export-status.svelte';
	import { m } from '$lib/paraglide/messages';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import {
		getCompositionBackgroundColor,
		setPaletteBackground,
		colorMode,
		canvasFormat,
		getEffectiveCanvasProportion
	} from '$lib/state/composition';
	import { printFormatPixelSize } from '$lib/geometry/print-format';
	import { proportionToCanvasSize } from '$lib/geometry/aspect-ratio';

	const presenter = previewPresenter;
	let includeBackground = $state(true);
	const PNG_SCALES = [1, 2, 4];
	const DPI_PRESETS = [150, 300, 600];
	const BASE_LONG_SIDE = 600;
	let pngScale = $state(1);
	let dpi = $state(300);

	const pngSize = $derived.by(() => {
		if (canvasFormat.printFormat) {
			return printFormatPixelSize(canvasFormat.printFormat, canvasFormat.orientation, dpi);
		}
		const p = getEffectiveCanvasProportion();
		return proportionToCanvasSize(p.width, p.height, BASE_LONG_SIDE * pngScale);
	});

	function exportPng() {
		if (canvasFormat.printFormat) {
			presenter.exportPng({ includeBackground, size: pngSize });
		} else {
			presenter.exportPng({ includeBackground, scale: pngScale });
		}
	}
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{m.composition_export()}
	{/snippet}

	{#snippet content()}
		<div class="flex flex-col gap-3">
			<label class="flex items-center gap-1.5 text-xs">
				<input
					type="checkbox"
					bind:checked={includeBackground}
					aria-label={m.preview_include_background()}
				/>
				{m.preview_include_background()}
			</label>

			<label class="flex items-center gap-2 text-xs">
				{m.composition_background_color()}
				<input
					type="color"
					aria-label={m.composition_background_color()}
					class="h-7 w-10 rounded border bg-background disabled:opacity-50"
					value={getCompositionBackgroundColor()}
					disabled={colorMode.mode !== 'monochrome'}
					oninput={(e) => setPaletteBackground((e.target as HTMLInputElement).value)}
				/>
			</label>

			<label class="flex items-center gap-2 text-xs">
				{m.preview_resolution()}
				{#if canvasFormat.printFormat}
					<select
						aria-label={m.preview_resolution()}
						class="h-8 rounded border bg-background px-1 text-xs"
						value={dpi}
						onchange={(e) => (dpi = Number((e.target as HTMLSelectElement).value))}
					>
						{#each DPI_PRESETS as d (d)}
							<option value={d}>{d} DPI</option>
						{/each}
					</select>
				{:else}
					<select
						aria-label={m.preview_resolution()}
						class="h-8 rounded border bg-background px-1 text-xs"
						value={pngScale}
						onchange={(e) => (pngScale = Number((e.target as HTMLSelectElement).value))}
					>
						{#each PNG_SCALES as s (s)}
							<option value={s}>{s}x</option>
						{/each}
					</select>
				{/if}
			</label>
			<p class="text-[10px] text-muted-foreground">{pngSize.width} × {pngSize.height} px</p>

			<div class="flex gap-2">
				<Button
					variant="outline"
					class="flex-1"
					disabled={exportStatus.rendering}
					onclick={() => presenter.exportSvg({ includeBackground })}
				>
					{m.preview_export_svg()}
				</Button>
				<Button
					variant="outline"
					class="flex-1"
					disabled={exportStatus.rendering}
					onclick={exportPng}
				>
					{m.preview_export_png()}
				</Button>
			</div>
		</div>
	{/snippet}
</SidebarCollapsible>
