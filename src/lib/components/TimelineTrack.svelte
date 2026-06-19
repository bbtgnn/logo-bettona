<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { keyframes } from '$lib/state/keyframes.svelte';
	import { animationState, applyKaleidoscopeKeyframes } from '$lib/state/animation';
	import { timeFromX, xFromTime } from '$lib/animation/timeline-geometry';
	import type { Interp } from '$lib/animation/keyframes';

	let { paramId, label }: { paramId: string; label: string } = $props();

	// Editing a keyframe should refresh the paused preview; tick only applies while playing.
	function reapplyIfPaused() {
		if (!animationState.isPlaying) applyKaleidoscopeKeyframes(animationState.progress);
	}

	let rowEl = $state<HTMLDivElement>();
	let selectedId = $state<string | null>(null);
	let draggingId: string | null = null;

	const kfs = $derived(keyframes.tracks[paramId]?.keyframes ?? []);
	const selected = $derived(kfs.find((k) => k.id === selectedId) ?? null);

	function rowWidth(): number {
		return rowEl?.clientWidth ?? 0;
	}

	function onDblClick(e: MouseEvent) {
		if (!rowEl) return;
		const rect = rowEl.getBoundingClientRect();
		const time = timeFromX(e.clientX - rect.left, rect.width);
		selectedId = keyframes.addKeyframe(paramId, { time, value: 0 });
		reapplyIfPaused();
	}

	// Discoverable alternative to double-clicking the row: add a keyframe at the playhead.
	function addAtPlayhead() {
		selectedId = keyframes.addKeyframe(paramId, { time: animationState.progress, value: 0 });
		reapplyIfPaused();
	}

	function onDiamondDown(e: PointerEvent, id: string) {
		e.stopPropagation();
		selectedId = id;
		draggingId = id;
		try {
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} catch {
			// No active pointer (e.g. a synthetic event) — capture is best-effort.
		}
	}

	function onDiamondMove(e: PointerEvent) {
		if (!draggingId || !rowEl) return;
		const rect = rowEl.getBoundingClientRect();
		keyframes.moveKeyframe(paramId, draggingId, {
			time: timeFromX(e.clientX - rect.left, rect.width)
		});
		reapplyIfPaused();
	}

	function onDiamondUp(e: PointerEvent) {
		draggingId = null;
		const el = e.currentTarget as HTMLElement;
		if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
	}

	function deleteSelected() {
		if (selectedId) {
			keyframes.deleteKeyframe(paramId, selectedId);
			selectedId = null;
			reapplyIfPaused();
		}
	}

	function setInterp(value: string) {
		if (selectedId) {
			keyframes.setKeyframeInterp(paramId, selectedId, value as Interp);
			reapplyIfPaused();
		}
	}
</script>

<div class="flex items-center gap-2">
	<span class="w-28 shrink-0 truncate text-xs">{label}</span>
	<Button variant="outline" size="sm" onclick={addAtPlayhead}>+ Keyframe</Button>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={rowEl}
		data-testid="track-{paramId}"
		class="relative h-7 flex-1 rounded bg-muted/60"
		ondblclick={onDblClick}
	>
		{#each kfs as kf (kf.id)}
			<button
				type="button"
				data-testid="kf-{kf.id}"
				aria-label="Keyframe"
				class="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border {kf.id ===
				selectedId
					? 'bg-primary'
					: 'bg-foreground'}"
				style="left: {xFromTime(kf.time, rowWidth())}px"
				onpointerdown={(e) => onDiamondDown(e, kf.id)}
				onpointermove={onDiamondMove}
				onpointerup={onDiamondUp}
			></button>
		{/each}
	</div>

	<select
		aria-label="Interpolazione keyframe"
		class="h-7 rounded border bg-background text-xs"
		disabled={!selected}
		value={selected?.interp ?? 'linear'}
		onchange={(e) => setInterp((e.target as HTMLSelectElement).value)}
	>
		<option value="linear">Lineare</option>
		<option value="bezier">Bezier</option>
		<option value="hold">Hold</option>
	</select>

	<Button variant="ghost" size="sm" disabled={!selected} onclick={deleteSelected}>
		Elimina keyframe
	</Button>
</div>
