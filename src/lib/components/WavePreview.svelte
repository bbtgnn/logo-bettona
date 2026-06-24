<script lang="ts">
	import paper from 'paper';
	import type { Path, Ring } from '$lib/types';
	import { composeRingTemplate } from '$lib/geometry/compose-ring';
	import { buildRingPath } from '$lib/geometry/bend';

	// Parametric, audio-free preview of the wave the sliders sculpt. It renders the
	// SAME bent ring the engine does (buildRingPath), so ringHeight, copies and the
	// smooth taper all shape it faithfully — a flat petal could not show ringHeight,
	// which only bites once x→angle / y→radius. Two overlaid layers show the envelope
	// the audio modulates between: a static "rest" outline (amplitude 0, what silence
	// looks like) and a translucent "reach" fill at full amplitude (= waveAmplitudeGain,
	// audio maxed on that ring), animated by the phase at wavePhaseSpeed.
	let {
		template,
		copies,
		ringHeight,
		crests,
		amplitude,
		phaseSpeed
	}: {
		template: Path | null;
		copies: number;
		ringHeight: number;
		crests: number;
		amplitude: number;
		phaseSpeed: number;
	} = $props();

	const PREVIEW_RADIUS = 100;

	// Phase advances with real time, scaled by phaseSpeed — the same travelling-wave
	// motion the audioBars driver applies. rAF is the only way to drive it; reading
	// phaseSpeed reactively restarts the cadence when the slider moves.
	let phase = $state(0);
	$effect(() => {
		const speed = phaseSpeed;
		let last = performance.now();
		let raf = requestAnimationFrame(function loop(now: number) {
			phase += ((now - last) / 1000) * speed;
			last = now;
			raf = requestAnimationFrame(loop);
		});
		return () => cancelAnimationFrame(raf);
	});

	function fitToView(scope: paper.PaperScope) {
		const items = scope.project.activeLayer.children;
		if (items.length === 0) return;
		let bounds = items[0].bounds.clone();
		for (let i = 1; i < items.length; i++) bounds = bounds.unite(items[i].bounds);
		if (bounds.width === 0 || bounds.height === 0) return;
		const padding = 14;
		const available = Math.min(scope.view.size.width, scope.view.size.height) - padding * 2;
		if (available <= 0) return;
		const scale = available / Math.max(bounds.width, bounds.height);
		scope.project.activeLayer.scale(scale, bounds.center);
		scope.project.activeLayer.position = scope.view.center;
	}

	function setupCanvas(canvas: HTMLCanvasElement) {
		const scope = new paper.PaperScope();
		scope.setup(canvas);

		// Redraw on any parameter or phase change — paper.js only, no $state writes.
		$effect(() => {
			scope.activate();
			scope.project.clear();

			if (template) {
				const baseRing: Ring = {
					id: 'wave-preview-ring',
					copies: Math.max(1, Math.floor(copies)),
					color: '#000000',
					templatePath: template,
					secondaryTemplatePath: null,
					morphT: 0,
					ringHeight
				};

				// reach: full-amplitude wave on the primary template, translucent fill.
				const reach = buildRingPath(
					{
						...baseRing,
						templatePath: composeRingTemplate({
							...baseRing,
							wave: { amplitude, crests, phase }
						}).path
					},
					PREVIEW_RADIUS,
					scope
				);
				if (reach) {
					reach.fillColor = new paper.Color(0, 0, 0, 0.18);
					reach.strokeColor = null;
				}

				// rest: silent shape, crisp outline (strokeScaling off so fit doesn't fatten it).
				const rest = buildRingPath(baseRing, PREVIEW_RADIUS, scope);
				if (rest) {
					rest.fillColor = null;
					rest.strokeColor = new paper.Color(0, 0, 0);
					rest.strokeWidth = 1;
					rest.strokeScaling = false;
				}

				fitToView(scope);
			}

			scope.view.update();
		});

		return () => scope.project.clear();
	}
</script>

<div
	class="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded border bg-muted/50"
>
	<span
		class="absolute top-2 left-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground"
	>
		Wave preview
	</span>
	{#if !template}
		<span class="text-xs text-muted-foreground">Add a ring path to preview the wave</span>
	{/if}
	<canvas {@attach setupCanvas} width="200" height="200" class="h-full w-full"></canvas>
</div>
