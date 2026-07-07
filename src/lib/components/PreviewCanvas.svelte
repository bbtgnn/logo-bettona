<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { previewPresenter } from './preview-presenter.svelte';
	import { exportStatus } from '$lib/state/export-status.svelte';
	import { m } from '$lib/paraglide/messages';

	// `animate` is set by the (app) layout only on the /animate route. Animation export
	// captures a timed animation, so it belongs to the animate surface. Static PNG/SVG
	// export now lives in the Composition sidebar (ExportSection).
	let { animate = false }: { animate?: boolean } = $props();

	const presenter = previewPresenter;
	const progressPercent = $derived(
		Math.round(Math.max(0, Math.min(1, presenter.exportProgress)) * 100)
	);
</script>

<div class="flex shrink-0 flex-col items-center gap-3">
	<canvas {@attach presenter.attach} width="600" height="600" class="rounded-lg border"
	></canvas>

	{#if animate}
		<div class="flex w-full max-w-[600px] flex-col gap-2">
			<Button
				variant="outline"
				onclick={presenter.exportAnimation}
				disabled={exportStatus.rendering || !presenter.animationExportSupported}
				class="w-full"
			>
				{m.preview_export_animation()}
			</Button>

			{#if exportStatus.rendering}
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

			{#if !presenter.animationExportSupported}
				<p class="text-[10px] text-muted-foreground">
					{m.preview_export_unsupported()}
				</p>
			{/if}
		</div>
	{/if}
</div>
