<script lang="ts">
	import paper from 'paper';
	import type { Composition, Path } from '$lib/types';
	import { createRenderPipeline } from '$lib/geometry/render-pipeline';
	import { paperCanvas } from './paper-canvas.svelte';

	let {
		path,
		secondaryPath = null,
		copies = 8,
		baseRadius,
		ringIncrement,
		morphT = 0,
		size = 280
	}: {
		path: Path;
		secondaryPath?: Path | null;
		copies?: number;
		baseRadius: number;
		ringIncrement: number;
		morphT?: number;
		size?: number;
	} = $props();

	let hasError = $state(false);
	const pipeline = createRenderPipeline();

	function draw(scope: paper.PaperScope) {
		const composition: Composition = {
			baseRadius,
			ringIncrement,
			copies,
			aspectRatio: '1:1',
			rings: [
				{
					id: 'ring-preview-ring',
					color: '#000000',
					templatePath: path,
					secondaryTemplatePath: secondaryPath ?? null,
					morphT,
					ringHeight: 0.12
				}
			],
			monochromePalettes: [{ primary: '#000000', secondary: '#ffffff', background: '#ffffff' }],
			fullPalettes: []
		};
		try {
			scope.project.clear();
			pipeline.render({ composition, scope, viewport: { width: size, height: size, padding: 20 } });
			hasError = false;
		} catch {
			hasError = true;
		}
	}
</script>

{#if hasError}
	<div
		style:width="{size}px"
		style:height="{size}px"
		class="flex items-center justify-center border border-dashed text-sm text-muted-foreground"
		data-testid="ring-preview-placeholder"
	>
		?
	</div>
{:else}
	<canvas
		{@attach paperCanvas(draw, { dispose: () => pipeline.dispose() })}
		width={size}
		height={size}
		aria-hidden="true"
		data-testid="ring-preview-canvas"
	></canvas>
{/if}
