<script lang="ts">
	import paper from 'paper';
	import type { Composition } from '$lib/types';
	import { createRenderPipeline } from '$lib/geometry/render-pipeline';

	const HERO_COMPOSITION: Composition = {
		baseRadius: 5,
		ringIncrement: 2,
		rings: [
			{
				copies: 8,
				color: '#000000',
				templatePath: {
					cmds: ['M', 'C', 'C'],
					crds: [
						20, 134.83, 52, 134.72, 39.43, 95.94, 68.68, 75.99, 90.43, 61.16, 146, 62.76, 180,
						65.6
					]
				},
				secondaryTemplatePath: {
					cmds: ['M', 'C', 'C'],
					crds: [
						22, 78.31, 54, 78.2, 126.43, 157.42, 155.68, 137.47, 177.43, 122.64, 146, 53.24, 180,
						56.08
					]
				},
				morphT: 0,
				ringHeight: 0.2
			},
			{
				copies: 8,
				color: '#000000',
				templatePath: {
					cmds: ['M', 'C', 'C'],
					crds: [
						22, 62.79, 61, 62.68, 64.43, 157.9, 93.68, 137.95, 115.43, 123.12, 116, 85.72, 180,
						87.56
					]
				},
				secondaryTemplatePath: {
					cmds: ['M', 'C', 'C'],
					crds: [
						20, 134.99, 59, 134.88, 39.43, 81.1, 68.68, 61.15, 90.43, 46.32, 116, 131.92, 180,
						84.76
					]
				},
				morphT: 0,
				ringHeight: 0.12
			}
		],
		monochromePalettes: [{ main: '#000000', bg: '#ffffff' }],
		fullPalettes: [{ colors: ['#000000', '#ffffff'] }]
	};

	function setupCanvas(canvas: HTMLCanvasElement) {
		const scope = new paper.PaperScope();
		scope.setup(canvas);
		const pipeline = createRenderPipeline();

		pipeline.render({
			composition: HERO_COMPOSITION,
			scope,
			viewport: {
				width: scope.view.size.width,
				height: scope.view.size.height,
				padding: 24
			}
		});

		return () => {
			scope.project.clear();
			pipeline.dispose();
		};
	}
</script>

<div
	class="flex items-center justify-center"
	aria-hidden="true"
	data-testid="about-hero-ring"
>
	<canvas
		{@attach setupCanvas}
		width="320"
		height="320"
		class="rounded-lg"
	></canvas>
</div>
