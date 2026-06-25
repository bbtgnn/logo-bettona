<script lang="ts">
	import { keyframes } from '$lib/state/keyframes.svelte';
	import { refreshPreview } from '$lib/state/animation';
	import { sampleTrack, type Track } from '$lib/animation/keyframes';
	import { xFromTime, timeFromX, yFromValue, valueFromY } from '$lib/animation/timeline-geometry';
	import { draggable } from '$lib/actions/draggable';

	let { paramId, min, max }: { paramId: string; min: number; max: number } = $props();

	const W = 600;
	const H = 160;

	let svgEl = $state<SVGSVGElement>();

	const track = $derived<Track>(
		keyframes.tracks[paramId] ?? { paramId, enabled: false, keyframes: [] }
	);
	const kfs = $derived(track.keyframes);

	const curve = $derived.by(() => {
		if (kfs.length === 0) return '';
		const pts: string[] = [];
		for (let i = 0; i <= 60; i++) {
			const t = i / 60;
			const v = sampleTrack(track, t);
			if (v === null) continue;
			pts.push(`${xFromTime(t, W)},${yFromValue(v, min, max, H)}`);
		}
		return pts.join(' ');
	});
</script>

<div class="flex flex-col gap-1">
	<p data-testid="graph-help" class="text-[10px] text-muted-foreground">
		Trascina i punti per regolare tempo e valore; le maniglie (Bézier) per l'accelerazione.
	</p>
	{#if kfs.length === 0}
		<p
			data-testid="graph-empty"
			class="flex h-40 w-full items-center justify-center rounded bg-muted/40 px-4 text-center text-xs text-muted-foreground"
		>
			Nessun keyframe su questo parametro. Aggiungine dalla vista Timeline per modellarne la curva.
		</p>
	{:else}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<svg
			bind:this={svgEl}
			data-testid="graph-{paramId}"
			viewBox="0 0 {W} {H}"
			class="h-40 w-full rounded bg-muted/40 text-foreground"
		>
			<polyline
				data-testid="graph-curve"
				points={curve}
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
			/>

			{#each kfs as kf (kf.id)}
				{@const px = xFromTime(kf.time, W)}
				{@const py = yFromValue(kf.value, min, max, H)}
				{#if kf.interp === 'bezier'}
					{@const hx = xFromTime(kf.time + kf.handleOut.dx * 0.15, W)}
					{@const hy = yFromValue(kf.value + kf.handleOut.dy * (max - min), min, max, H)}
					<line
						x1={px}
						y1={py}
						x2={hx}
						y2={hy}
						stroke="currentColor"
						stroke-width="1"
						opacity="0.5"
					/>
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<circle
						data-testid="graph-handle-{kf.id}"
						cx={hx}
						cy={hy}
						r="4"
						class="cursor-pointer fill-primary"
						use:draggable={{
							onStart: (e) => e.stopPropagation(),
							onMove: (e) => {
								if (!svgEl) return;
								const kf2 = kfs.find((k) => k.id === kf.id);
								if (!kf2) return;
								const rect = svgEl.getBoundingClientRect();
								const dx = Math.max(
									0,
									Math.min(1, timeFromX(e.clientX - rect.left, rect.width) - kf2.time)
								);
								const span = max - min || 1;
								const dy = (valueFromY(e.clientY - rect.top, min, max, rect.height) - kf2.value) / span;
								keyframes.setKeyframeHandle(paramId, kf.id, 'out', { dx, dy });
								refreshPreview();
							}
						}}
					/>
				{/if}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<rect
					data-testid="graph-pt-{kf.id}"
					x={px - 4}
					y={py - 4}
					width="8"
					height="8"
					class="cursor-pointer fill-foreground"
					use:draggable={{
						onStart: (e) => e.stopPropagation(),
						onMove: (e) => {
							if (!svgEl) return;
							const rect = svgEl.getBoundingClientRect();
							keyframes.moveKeyframe(paramId, kf.id, {
								time: timeFromX(e.clientX - rect.left, rect.width),
								value: valueFromY(e.clientY - rect.top, min, max, rect.height)
							});
							refreshPreview();
						}
					}}
				/>
			{/each}
		</svg>
	{/if}
</div>
