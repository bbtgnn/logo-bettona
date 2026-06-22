<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { createPreviewPresenter } from './preview-presenter.svelte';
	import { exportStatus } from '$lib/state/export-status.svelte';
	import { m } from '$lib/paraglide/messages';

	// `animate` is set by the (app) layout only on the /animate route. Animation export
	// captures a timed animation, so it belongs to the animate surface; Export SVG is
	// always available.
	let { animate = false }: { animate?: boolean } = $props();

	const presenter = createPreviewPresenter();
	const progressPercent = $derived(
		Math.round(Math.max(0, Math.min(1, presenter.exportProgress)) * 100)
	);
	let includeBackground = $state(true);
	let pngScale = $state(1);
	const PNG_SCALES = [1, 2, 4];
</script>

<div class="flex shrink-0 flex-col items-center gap-3">
	<canvas {@attach presenter.attach} width="600" height="600" class="rounded-lg border"
	></canvas>

	<div class="flex w-full max-w-[600px] flex-col gap-2">
		<div class="flex gap-2">
			<Button
				variant="outline"
				onclick={() => presenter.exportSvg({ includeBackground })}
				disabled={exportStatus.rendering}
				class="flex-1"
			>
				{m.preview_export_svg()}
			</Button>
			<Button
				variant="outline"
				onclick={() => presenter.exportPng({ includeBackground, scale: pngScale })}
				disabled={exportStatus.rendering}
				class="flex-1"
			>
				{m.preview_export_png()}
			</Button>
			{#if animate}
				<Button
					variant="outline"
					onclick={presenter.exportAnimation}
					disabled={exportStatus.rendering || !presenter.animationExportSupported}
					class="flex-1"
				>
					{m.preview_export_animation()}
				</Button>
			{/if}
		</div>

		<div class="flex items-center gap-3 text-xs text-muted-foreground">
			<label class="flex items-center gap-1.5">
				<input type="checkbox" bind:checked={includeBackground} aria-label={m.preview_include_background()} />
				{m.preview_include_background()}
			</label>
			<label class="flex items-center gap-1.5">
				{m.preview_resolution()}
				<select
					aria-label={m.preview_resolution()}
					class="h-7 rounded border bg-background py-1 text-xs"
					value={pngScale}
					onchange={(e) => (pngScale = Number((e.target as HTMLSelectElement).value))}
				>
					{#each PNG_SCALES as s (s)}
						<option value={s}>{s}x</option>
					{/each}
				</select>
			</label>
		</div>

		{#if animate && exportStatus.rendering}
			<div class="space-y-1">
				<div
					class="h-1.5 rounded bg-muted"
					role="progressbar"
					aria-label={m.preview_rendering_progress()}
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow={progressPercent}
				>
					<div
						class="h-full rounded bg-foreground transition-all"
						style:width={`${progressPercent}%`}
					></div>
				</div>
				<p class="text-[10px] text-muted-foreground">
					{m.preview_rendering({ pct: progressPercent })}
				</p>
			</div>
		{/if}

		{#if animate && !presenter.animationExportSupported}
			<p class="text-[10px] text-muted-foreground">
				{m.preview_export_unsupported()}
			</p>
		{/if}
	</div>
</div>
