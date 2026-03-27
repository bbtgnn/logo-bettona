<script lang="ts">
	import paper from 'paper';
	import type { Path } from '$lib/types';

	let { templatePath }: { templatePath: Path | null } = $props();

	function setupCanvas(canvas: HTMLCanvasElement) {
		const scope = new paper.PaperScope();
		scope.setup(canvas);

		// draw() only writes to paper.js canvas — no $state reassignment
		$effect(() => {
			draw(scope, templatePath);
		});

		return () => {
			scope.project.clear();
		};
	}

	function draw(scope: paper.PaperScope, path: Path | null) {
		scope.activate();
		scope.project.clear();

		if (!path || path.cmds.length === 0) return;

		const paperPath = buildPaperPath(path, scope);

		paperPath.strokeColor = new paper.Color(0, 0, 0);
		paperPath.fillColor = null;
		paperPath.strokeWidth = 1;

		const padding = 16;
		const bounds = paperPath.bounds;
		const available = Math.min(scope.view.bounds.width, scope.view.bounds.height) - padding * 2;
		const scale = available / Math.max(bounds.width, bounds.height, 1);

		paperPath.scale(scale);
		paperPath.position = scope.view.center;

		scope.view.update();
	}

	function buildPaperPath(p: Path, s: paper.PaperScope): paper.Path {
		s.activate();
		const result = new paper.Path();
		let ci = 0;

		for (const cmd of p.cmds) {
			switch (cmd) {
				case 'M':
					result.moveTo(new paper.Point(p.crds[ci], p.crds[ci + 1]));
					ci += 2;
					break;
				case 'L':
					result.lineTo(new paper.Point(p.crds[ci], p.crds[ci + 1]));
					ci += 2;
					break;
				case 'Q':
					result.quadraticCurveTo(
						new paper.Point(p.crds[ci], p.crds[ci + 1]),
						new paper.Point(p.crds[ci + 2], p.crds[ci + 3])
					);
					ci += 4;
					break;
				case 'C':
					result.cubicCurveTo(
						new paper.Point(p.crds[ci], p.crds[ci + 1]),
						new paper.Point(p.crds[ci + 2], p.crds[ci + 3]),
						new paper.Point(p.crds[ci + 4], p.crds[ci + 5])
					);
					ci += 6;
					break;
				case 'Z':
					result.closePath();
					break;
			}
		}

		return result;
	}
</script>

<div class="w-full aspect-square bg-muted/50 rounded border flex items-center justify-center overflow-hidden relative">
	{#if !templatePath}
		<span class="text-xs text-muted-foreground absolute">Upload an SVG to preview</span>
	{/if}
	<canvas {@attach setupCanvas} width="200" height="200"></canvas>
</div>
