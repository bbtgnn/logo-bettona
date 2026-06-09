<script lang="ts">
	import paper from 'paper';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { composition } from '$lib/state/composition';
	import { animationState } from '$lib/state/animation';
	import { createRenderPipeline } from '$lib/geometry/render-pipeline';

	let scope: paper.PaperScope;
	const renderPipeline = createRenderPipeline();

	function setupCanvas(canvas: HTMLCanvasElement) {
		scope = new paper.PaperScope();
		scope.setup(canvas);

		// redraw() only writes to paper.js canvas — no $state reassignment
		$effect(() => {
			const comp = composition;
			// audioBars rides the primary petal; bypass morph in the render only.
			const ignoreMorph = animationState.mode === 'audioBars';
			renderPipeline.render({
				composition: comp,
				scope,
				ignoreMorph,
				viewport: {
					width: scope.view.size.width,
					height: scope.view.size.height,
					padding: 32
				}
			});
		});

		return () => {
			scope.project.clear();
			renderPipeline.dispose();
		};
	}

	function exportSvg() {
		if (!scope) return;

		const hasContent = scope.project.activeLayer.children.length > 0;
		if (!hasContent) return;

		scope.activate();
		const svgData = scope.project.exportSVG({ asString: true }) as string;
		const blob = new Blob([svgData], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);

		const a = document.createElement('a');
		a.href = url;
		a.download = 'composition.svg';
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="flex shrink-0 flex-col items-center gap-3">
	<canvas {@attach setupCanvas} width="600" height="600" class="rounded-lg border bg-white"
	></canvas>
	<Button variant="outline" onclick={exportSvg} class="w-full max-w-[600px]">Export SVG</Button>
</div>
