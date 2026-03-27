<script lang="ts">
	import paper from 'paper';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { composition } from '$lib/state/composition';
	import { renderComposition, fitToView } from '$lib/geometry/compose';

	let scope: paper.PaperScope;

	function setupCanvas(canvas: HTMLCanvasElement) {
		scope = new paper.PaperScope();
		scope.setup(canvas);

		// redraw() only writes to paper.js canvas — no $state reassignment
		$effect(() => {
			redraw(composition);
		});

		return () => {
			scope.project.clear();
		};
	}

	function redraw(comp: typeof composition) {
		renderComposition(comp, scope);
		fitToView(scope);
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

<div class="flex flex-col items-center gap-3 shrink-0">
	<canvas {@attach setupCanvas} width="600" height="600" class="rounded-lg border bg-white"></canvas>
	<Button variant="outline" onclick={exportSvg} class="w-full max-w-[600px]">Export SVG</Button>
</div>
