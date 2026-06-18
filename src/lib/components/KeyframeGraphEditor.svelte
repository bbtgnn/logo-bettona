<script lang="ts">
	import { keyframes } from '$lib/state/keyframes.svelte';
	import { sampleTrack, type Track } from '$lib/animation/keyframes';
	import { xFromTime, timeFromX, yFromValue, valueFromY } from '$lib/animation/timeline-geometry';

	let { paramId, min, max }: { paramId: string; min: number; max: number } = $props();

	const W = 600;
	const H = 160;

	let svgEl = $state<SVGSVGElement>();
	let dragKind: 'point' | 'handle' | null = null;
	let dragId: string | null = null;

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

	function capture(e: PointerEvent) {
		try {
			svgEl?.setPointerCapture(e.pointerId);
		} catch {
			// No active pointer (e.g. a synthetic event) — capture is best-effort.
		}
	}

	function onPointDown(e: PointerEvent, id: string) {
		e.stopPropagation();
		dragKind = 'point';
		dragId = id;
		capture(e);
	}

	function onHandleDown(e: PointerEvent, id: string) {
		e.stopPropagation();
		dragKind = 'handle';
		dragId = id;
		capture(e);
	}

	function onMove(e: PointerEvent) {
		if (!dragKind || !dragId || !svgEl) return;
		// Pointer coords are CSS pixels relative to the rendered box; map using the
		// element's actual size, not the viewBox units (W/H), which only drive drawing.
		const rect = svgEl.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		if (dragKind === 'point') {
			keyframes.moveKeyframe(paramId, dragId, {
				time: timeFromX(x, rect.width),
				value: valueFromY(y, min, max, rect.height)
			});
		} else {
			const kf = kfs.find((k) => k.id === dragId);
			if (!kf) return;
			const dx = Math.max(0, Math.min(1, timeFromX(x, rect.width) - kf.time));
			const span = max - min || 1;
			const dy = (valueFromY(y, min, max, rect.height) - kf.value) / span;
			keyframes.setKeyframeHandle(paramId, dragId, 'out', { dx, dy });
		}
	}

	function onUp(e: PointerEvent) {
		dragKind = null;
		dragId = null;
		if (svgEl?.hasPointerCapture(e.pointerId)) svgEl.releasePointerCapture(e.pointerId);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svg
	bind:this={svgEl}
	data-testid="graph-{paramId}"
	viewBox="0 0 {W} {H}"
	class="h-40 w-full rounded bg-muted/40 text-foreground"
	onpointermove={onMove}
	onpointerup={onUp}
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
			<line x1={px} y1={py} x2={hx} y2={hy} stroke="currentColor" stroke-width="1" opacity="0.5" />
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<circle
				data-testid="graph-handle-{kf.id}"
				cx={hx}
				cy={hy}
				r="4"
				class="cursor-pointer fill-primary"
				onpointerdown={(e) => onHandleDown(e, kf.id)}
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
			onpointerdown={(e) => onPointDown(e, kf.id)}
		/>
	{/each}
</svg>
