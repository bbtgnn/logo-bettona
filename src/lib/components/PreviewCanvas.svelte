<script lang="ts">
	import paper from 'paper';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { composition } from '$lib/state/composition';
	import { animationState } from '$lib/state/animation';
	import { createRenderPipeline, computeRestScale } from '$lib/geometry/render-pipeline';

	let scope: paper.PaperScope;
	const renderPipeline = createRenderPipeline();

	// Rest mark fills this fraction of the frame, leaving headroom for petals to
	// open toward the edge. Coupled with BASS_REACH (zones.ts).
	const REST_FRACTION = 0.45;

	function setupCanvas(canvas: HTMLCanvasElement) {
		scope = new paper.PaperScope();
		scope.setup(canvas);

		// redraw() only writes to paper.js canvas — no $state reassignment
		$effect(() => {
			const comp = composition;
			const viewport = {
				width: scope.view.size.width,
				height: scope.view.size.height,
				padding: 32
			};
			// audioBars/audioZones ride the primary petal; bypass morph in the render only.
			const ignoreMorph =
				animationState.mode === 'audioBars' || animationState.mode === 'audioZones';

			if (animationState.mode === 'audioZones') {
				// Measure the rest pose (drive ignored), fix the scale with headroom,
				// then render the deformed pose at that fixed scale so opening petals
				// actually extend toward the reserved edge instead of being re-fitted away.
				const rest = renderPipeline.render({
					composition: comp,
					scope,
					ignoreMorph,
					ignoreZoneDrive: true,
					viewport
				});
				const fitScale = computeRestScale(rest.boundSide, viewport, REST_FRACTION);
				renderPipeline.render({ composition: comp, scope, ignoreMorph, viewport, fitScale });
			} else {
				renderPipeline.render({ composition: comp, scope, ignoreMorph, viewport });
			}
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