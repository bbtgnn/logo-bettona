<script lang="ts">
	import paper from 'paper';
	import { onMount } from 'svelte';
	import type { Composition, Path } from '$lib/types';
	import { createRenderPipeline } from '$lib/geometry/render-pipeline';

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

	let canvas = $state<HTMLCanvasElement | null>(null);
	let hasError = $state(false);

	onMount(() => {
		if (!canvas) {
			hasError = true;
			return;
		}

		const scope = new paper.PaperScope();
		scope.setup(canvas);

		const composition: Composition = {
			baseRadius,
			ringIncrement,
			aspectRatio: '1:1',
			rings: [
				{
					copies,
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

		const pipeline = createRenderPipeline();

		try {
			pipeline.render({
				composition,
				scope,
				viewport: { width: size, height: size, padding: 20 }
			});
		} catch {
			hasError = true;
		}

		return () => {
			pipeline.dispose();
			scope.project.clear();
			scope.view.remove();
		};
	});
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
		bind:this={canvas}
		width={size}
		height={size}
		aria-hidden="true"
		data-testid="ring-preview-canvas"
	></canvas>
{/if}
