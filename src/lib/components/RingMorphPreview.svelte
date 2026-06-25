<script lang="ts">
	import paper from 'paper';
	import type { Composition, Path } from '$lib/types';
	import { createRenderPipeline } from '$lib/geometry/render-pipeline';
	import { paperCanvas } from './paper-canvas.svelte';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { m } from '$lib/paraglide/messages';

	let {
		path,
		secondaryPath = null,
		morphT = 0,
		copies = 8,
		baseRadius,
		ringIncrement,
		size = 280,
		showTry = false
	}: {
		path: Path | null;
		secondaryPath?: Path | null;
		morphT?: number;
		copies?: number;
		baseRadius: number;
		ringIncrement: number;
		size?: number;
		showTry?: boolean;
	} = $props();

	let hasError = $state(false);
	let playing = $state(false);
	let playT = $state(0);
	let rafId: number | null = null;

	const pipeline = createRenderPipeline();

	// While the Try loop runs it overrides the slider pose; otherwise the preview
	// mirrors the live morphT prop.
	const effectiveMorphT = $derived(playing ? playT : morphT);

	function draw(scope: paper.PaperScope) {
		if (!path) {
			hasError = true;
			return;
		}
		const comp: Composition = {
			baseRadius,
			ringIncrement,
			aspectRatio: '1:1',
			rings: [
				{
					id: 'ring-morph-preview-ring',
					copies,
					color: '#000000',
					templatePath: path,
					secondaryTemplatePath: secondaryPath ?? null,
					morphT: effectiveMorphT,
					ringHeight: 0.12
				}
			],
			monochromePalettes: [{ primary: '#000000', secondary: '#ffffff', background: '#ffffff' }],
			fullPalettes: []
		};
		try {
			scope.project.clear();
			pipeline.render({ composition: comp, scope, viewport: { width: size, height: size, padding: 20 } });
			hasError = false;
		} catch {
			hasError = true;
		}
	}

	function disposePreview() {
		if (rafId !== null) cancelAnimationFrame(rafId);
		pipeline.dispose();
	}

	function stopTry() {
		playing = false;
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
	}

	function startTry() {
		playing = true;
		const periodMs = 1500; // one 0→1 sweep; loops, matching the default morph keyframes
		let startTs: number | null = null;
		const tick = (ts: number) => {
			if (startTs === null) startTs = ts;
			playT = ((ts - startTs) / periodMs) % 1;
			rafId = requestAnimationFrame(tick);
		};
		rafId = requestAnimationFrame(tick);
	}

	function toggleTry() {
		if (playing) stopTry();
		else startTry();
	}
</script>

{#if hasError}
	<div
		style:width="{size}px"
		style:height="{size}px"
		class="flex items-center justify-center border border-dashed text-sm text-muted-foreground"
		data-testid="ring-morph-preview-placeholder"
	>
		?
	</div>
{:else}
	<canvas
		{@attach paperCanvas(draw, { dispose: disposePreview })}
		width={size}
		height={size}
		style:width="{size}px"
		style:height="{size}px"
		aria-hidden="true"
		data-testid="ring-morph-preview-canvas"
	></canvas>
{/if}

{#if showTry}
	<Button variant="outline" size="sm" onclick={toggleTry} data-testid="ring-morph-preview-try">
		{playing ? m.animate_morph_stop() : m.animate_morph_try()}
	</Button>
{/if}
