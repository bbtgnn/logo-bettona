<script lang="ts">
	import { animationState, scrubTo } from '$lib/state/animation';
	import { timeFromX, xFromTime, formatSeconds } from '$lib/animation/timeline-geometry';

	let rulerEl = $state<HTMLDivElement>();

	// One tick + label per integer second across the duration (always include the end).
	const secondMarks = $derived.by(() => {
		const dur = Math.max(0.1, animationState.durationSec);
		const marks: number[] = [];
		for (let s = 0; s <= Math.floor(dur); s++) marks.push(s);
		if (marks[marks.length - 1] !== dur) marks.push(dur);
		return marks;
	});

	function scrubFromEvent(clientX: number) {
		if (!rulerEl) return;
		const rect = rulerEl.getBoundingClientRect();
		// scrubTo moves the playhead and drives the kaleidoscope to it; tick() does the
		// same while playing, so a paused scrub still updates the preview.
		scrubTo(timeFromX(clientX - rect.left, rect.width));
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
	class="relative h-7 w-full cursor-col-resize rounded-md bg-muted/40 select-none"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
>
	{#each secondMarks as s (s)}
		{@const frac = s / Math.max(0.1, animationState.durationSec)}
		<div
			class="pointer-events-none absolute top-0 h-2 w-px bg-border"
			style="left: {xFromTime(frac, rulerEl?.clientWidth ?? 0)}px"
		></div>
		<span
			class="pointer-events-none absolute bottom-0 -translate-x-1/2 text-[10px] leading-none text-muted-foreground"
			style="left: {xFromTime(frac, rulerEl?.clientWidth ?? 0)}px"
		>
			{formatSeconds(s)}
		</span>
	{/each}
</div>
