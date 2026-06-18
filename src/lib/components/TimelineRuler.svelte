<script lang="ts">
	import { animationState, applyKaleidoscopeKeyframes } from '$lib/state/animation';
	import { timeFromX, xFromTime } from '$lib/animation/timeline-geometry';

	let rulerEl = $state<HTMLDivElement>();

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
	class="relative h-6 w-full cursor-col-resize rounded bg-muted select-none"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
>
	<div
		data-testid="playhead"
		class="absolute top-0 h-full w-0.5 bg-primary"
		style="left: {xFromTime(animationState.progress, rulerEl?.clientWidth ?? 0)}px"
	></div>
</div>
