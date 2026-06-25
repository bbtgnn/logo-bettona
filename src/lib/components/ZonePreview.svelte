<script lang="ts">
	import paper from 'paper';
	import type { Path, Ring, ZoneIntensity } from '$lib/types';
	import { buildRingPath } from '$lib/geometry/bend';
	import { paperCanvas, fitPreviewToView } from './paper-canvas.svelte';

	let {
		template,
		copies,
		ringHeight,
		intensity
	}: {
		template: Path | null;
		copies: number;
		ringHeight: number;
		intensity: ZoneIntensity;
	} = $props();

	const PREVIEW_RADIUS = 100;

	function draw(scope: paper.PaperScope) {
		scope.project.clear();

		if (template) {
			const baseRing: Ring = {
				id: 'zone-preview-ring',
				copies: Math.max(1, Math.floor(copies)),
				color: '#000000',
				templatePath: template,
				secondaryTemplatePath: null,
				morphT: 0,
				ringHeight
			};

			// Normalized 0..1 drive at full amplitude; buildRingPath deforms in final
			// polar space (ring-radius units). Vibration phase = 1 (max) for the preview.
			const maxDrive = {
				bassPush: intensity.bass,
				midPush: intensity.mid,
				trebleRetract: intensity.treble,
				trebleVibrate: intensity.treble
			};

			// reach: max-amplitude zone deformation, translucent fill
			const reach = buildRingPath({ ...baseRing, zoneDrive: maxDrive }, PREVIEW_RADIUS, scope);
			if (reach) {
				reach.fillColor = new paper.Color(0, 0, 0, 0.18);
				reach.strokeColor = null;
			}

			// rest: authored shape, crisp outline
			const rest = buildRingPath(baseRing, PREVIEW_RADIUS, scope);
			if (rest) {
				rest.fillColor = null;
				rest.strokeColor = new paper.Color(0, 0, 0);
				rest.strokeWidth = 1;
				rest.strokeScaling = false;
			}

			fitPreviewToView(scope);
		}

		scope.view.update();
	}
</script>

<div
	class="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded border bg-muted/50"
>
	<span
		class="absolute top-2 left-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground"
	>
		Zone preview
	</span>
	{#if !template}
		<span class="text-xs text-muted-foreground">Add a ring path to preview zones</span>
	{/if}
	<canvas {@attach paperCanvas(draw)} width="200" height="200" class="h-full w-full"></canvas>
</div>
