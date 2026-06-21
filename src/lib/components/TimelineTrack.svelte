<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { keyframes } from '$lib/state/keyframes.svelte';
	import { animationState, refreshPreview } from '$lib/state/animation';
	import { timeFromX, xFromTime, formatSeconds } from '$lib/animation/timeline-geometry';
	import { m } from '$lib/paraglide/messages';

	let {
		paramId,
		label,
		selectedId = null,
		onselect
	}: {
		paramId: string;
		label: string;
		selectedId?: string | null;
		onselect?: (keyframeId: string | null) => void;
	} = $props();

	let rowEl = $state<HTMLDivElement>();
	let draggingId: string | null = null;

	const kfs = $derived(keyframes.tracks[paramId]?.keyframes ?? []);
	const selectedKf = $derived(kfs.find((k) => k.id === selectedId) ?? null);

	function rowWidth(): number {
		return rowEl?.clientWidth ?? 0;
	}

	function onDblClick(e: MouseEvent) {
		if (!rowEl) return;
		const rect = rowEl.getBoundingClientRect();
		const time = timeFromX(e.clientX - rect.left, rect.width);
		const id = keyframes.addKeyframe(paramId, { time, value: 0 });
		onselect?.(id);
		refreshPreview();
	}

	// Discoverable alternative to double-clicking the row: add a keyframe at the playhead.
	function addAtPlayhead() {
		const id = keyframes.addKeyframe(paramId, { time: animationState.progress, value: 0 });
		onselect?.(id);
		refreshPreview();
	}

	function onDiamondDown(e: PointerEvent, id: string) {
		e.stopPropagation();
		onselect?.(id);
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
		refreshPreview();
	}

	function onDiamondUp(e: PointerEvent) {
		draggingId = null;
		const el = e.currentTarget as HTMLElement;
		if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
	}
</script>

<div class="flex items-center gap-2">
	<span class="w-28 shrink-0 truncate text-xs text-muted-foreground">{label}</span>
	<Button
		variant="outline"
		size="sm"
		aria-label={m.timeline_add_keyframe()}
		onclick={addAtPlayhead}
	>
		+
	</Button>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={rowEl}
		data-testid="track-{paramId}"
		class="relative h-8 flex-1 rounded-md bg-muted/40"
		ondblclick={onDblClick}
	>
		{#each kfs as kf (kf.id)}
			<button
				type="button"
				data-testid="kf-{kf.id}"
				aria-label={m.timeline_keyframe()}
				class="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border bg-foreground {kf.id ===
				selectedId
					? 'ring-2 ring-sky-400'
					: ''}"
				style="left: {xFromTime(kf.time, rowWidth())}px"
				onpointerdown={(e) => onDiamondDown(e, kf.id)}
				onpointermove={onDiamondMove}
				onpointerup={onDiamondUp}
			></button>
		{/each}
		{#if selectedKf}
			<div
				class="pointer-events-none absolute top-0 bottom-0 w-px bg-sky-400/60"
				style="left: {xFromTime(selectedKf.time, rowWidth())}px"
			></div>
			<span
				data-testid="kf-time"
				class="pointer-events-none absolute -top-4 -translate-x-1/2 rounded bg-sky-400 px-1 text-[10px] leading-tight text-white"
				style="left: {xFromTime(selectedKf.time, rowWidth())}px"
			>
				{formatSeconds(selectedKf.time * animationState.durationSec)}
			</span>
		{/if}
	</div>
</div>
