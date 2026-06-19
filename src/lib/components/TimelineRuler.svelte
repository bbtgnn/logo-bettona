<script lang="ts">
	import { animationState, applyKaleidoscopeKeyframes } from '$lib/state/animation';
	import { timeFromX, xFromTime, formatSeconds } from '$lib/animation/timeline-geometry';

	let rulerEl = $state<HTMLDivElement>();

	// Minor ticks at quarter fractions; labelled ticks at start / middle / end.
	const TICK_FRACS = [0, 0.25, 0.5, 0.75, 1];
	const LABEL_FRACS = [0, 0.5, 1];

	function scrubFromEvent(clientX: number) {
		if (!rulerEl) return;
		const rect = rulerEl.getBoundingClientRect();
		animationState.progress = timeFromX(clientX - rect.left, rect.width);
		// tick() only runs while playing; re-apply here so scrubbing a paused
		// timeline still drives the kaleidoscope to the playhead's value.
		applyKaleidoscopeKeyframes(animationState.progress);
	}

	function onPointerDown(e: PointerEvent) {
		scrubFromEvent(e.clientX);
		try {
			rulerEl?.setPointerCapture(e.pointerId);
		} catch {
			// No active pointer (e.g. a synthetic event) — capture is best-effort.
		}
	}

	function onPointerMove(e: PointerEvent) {
		if (!rulerEl?.hasPointerCapture(e.pointerId)) return;
		scrubFromEvent(e.clientX);
	}

	function onPointerUp(e: PointerEvent) {
		if (rulerEl?.hasPointerCapture(e.pointerId)) rulerEl.releasePointerCapture(e.pointerId);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={rulerEl}
	data-testid="timeline-ruler"
	class="relative h-7 w-full cursor-col-resize rounded bg-muted select-none"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
>
	{#each TICK_FRACS as f (f)}
		<div
			class="pointer-events-none absolute top-0 h-2 w-px bg-border"
			style="left: {xFromTime(f, rulerEl?.clientWidth ?? 0)}px"
		></div>
	{/each}
	{#each LABEL_FRACS as f (f)}
		<span
			class="pointer-events-none absolute bottom-0 -translate-x-1/2 text-[10px] leading-none text-muted-foreground"
			style="left: {xFromTime(f, rulerEl?.clientWidth ?? 0)}px"
		>
			{formatSeconds(f * animationState.durationSec)}
		</span>
	{/each}
	<div
		data-testid="playhead"
		class="absolute top-0 h-full w-0.5 bg-primary"
		style="left: {xFromTime(animationState.progress, rulerEl?.clientWidth ?? 0)}px"
	></div>
</div>
