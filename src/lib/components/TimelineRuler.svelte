<script lang="ts">
	import { animationState, scrubTo } from '$lib/state/animation';
	import {
		timeFromX,
		xFromTime,
		formatSeconds,
		snapProgressToFps
	} from '$lib/animation/timeline-geometry';

	let rulerEl = $state<HTMLDivElement>();
	// Measured reactively so ticks and the density threshold respond to zoom/resize.
	let rulerWidth = $state(0);

	// Below this per-frame pixel spacing, frame ticks are dropped (visual cap). Zooming
	// the timeline widens the ruler, lifting spacing back over the threshold.
	const MIN_FRAME_PX = 6;

	// One tick + label per integer second across the duration (always include the end).
	const secondMarks = $derived.by(() => {
		const dur = Math.max(0.1, animationState.durationSec);
		const marks: number[] = [];
		for (let s = 0; s <= Math.floor(dur); s++) marks.push(s);
		if (marks[marks.length - 1] !== dur) marks.push(dur);
		return marks;
	});

	// Total frames spanning the duration; a minor tick sits at each frame boundary.
	const totalFrames = $derived(
		Math.max(1, Math.round(animationState.fps * Math.max(0.1, animationState.durationSec)))
	);
	const showFrameTicks = $derived(rulerWidth / totalFrames >= MIN_FRAME_PX);
	const frameIndices = $derived(
		showFrameTicks ? Array.from({ length: totalFrames + 1 }, (_, i) => i) : []
	);

	function scrubFromEvent(clientX: number, shiftKey: boolean) {
		if (!rulerEl) return;
		const rect = rulerEl.getBoundingClientRect();
		// scrubTo moves the playhead and drives the kaleidoscope to it; tick() does the
		// same while playing, so a paused scrub still updates the preview. Shift snaps the
		// playhead to the nearest frame; free otherwise.
		let p = timeFromX(clientX - rect.left, rect.width);
		if (shiftKey) p = snapProgressToFps(p, animationState.durationSec, animationState.fps);
		scrubTo(p);
	}

	function onPointerDown(e: PointerEvent) {
		scrubFromEvent(e.clientX, e.shiftKey);
		try {
			rulerEl?.setPointerCapture(e.pointerId);
		} catch {
			// No active pointer (e.g. a synthetic event) — capture is best-effort.
		}
	}

	function onPointerMove(e: PointerEvent) {
		if (!rulerEl?.hasPointerCapture(e.pointerId)) return;
		scrubFromEvent(e.clientX, e.shiftKey);
	}

	function onPointerUp(e: PointerEvent) {
		if (rulerEl?.hasPointerCapture(e.pointerId)) rulerEl.releasePointerCapture(e.pointerId);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={rulerEl}
	bind:clientWidth={rulerWidth}
	data-testid="timeline-ruler"
	class="relative h-7 w-full cursor-col-resize rounded-md bg-muted/40 select-none"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
>
	{#each frameIndices as f (f)}
		<div
			data-testid="frame-tick"
			class="pointer-events-none absolute top-0 h-1 w-px bg-border/50"
			style="left: {xFromTime(f / totalFrames, rulerWidth)}px"
		></div>
	{/each}
	{#each secondMarks as s (s)}
		{@const frac = s / Math.max(0.1, animationState.durationSec)}
		<div
			class="pointer-events-none absolute top-0 h-2 w-px bg-border"
			style="left: {xFromTime(frac, rulerWidth)}px"
		></div>
		<span
			class="pointer-events-none absolute bottom-0 -translate-x-1/2 text-[10px] leading-none text-muted-foreground"
			style="left: {xFromTime(frac, rulerWidth)}px"
		>
			{formatSeconds(s)}
		</span>
	{/each}
</div>
