<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { previewPresenter } from './preview-presenter.svelte';
	import { exportStatus } from '$lib/state/export-status.svelte';
	import { m } from '$lib/paraglide/messages';
	import SidebarCollapsible from './SidebarCollapsible.svelte';

	const presenter = previewPresenter;
	let includeBackground = $state(true);
	let pngScale = $state(1);
	const PNG_SCALES = [1, 2, 4];
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
				{m.preview_resolution()}
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
			</label>

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
					onclick={() => presenter.exportPng({ includeBackground, scale: pngScale })}
				>
					{m.preview_export_png()}
				</Button>
			</div>
		</div>
	{/snippet}
</SidebarCollapsible>
