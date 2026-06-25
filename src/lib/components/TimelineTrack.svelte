<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { keyframes } from '$lib/state/keyframes.svelte';
	import { animationState, refreshPreview } from '$lib/state/animation';
	import { timeFromX, xFromTime, formatSeconds } from '$lib/animation/timeline-geometry';
	import { m } from '$lib/paraglide/messages';
	import { draggable } from '$lib/actions/draggable';

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

	const kfs = $derived(keyframes.tracks[paramId]?.keyframes ?? []);
	const selectedKf = $derived(kfs.find((k) => k.id === selectedId) ?? null);
	const trk = $derived(keyframes.tracks[paramId]);
	const inPoint = $derived(trk?.inPoint ?? 0);
	const outPoint = $derived(trk?.outPoint ?? 1);

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
</script>

<div class="flex items-center gap-2">
	<div class="flex w-28 shrink-0 items-center gap-1">
		<span class="flex-1 truncate text-xs text-muted-foreground">{label}</span>
		<Button
			variant="outline"
			size="sm"
			class="h-6 w-6 shrink-0 p-0"
			aria-label={m.timeline_add_keyframe()}
			onclick={addAtPlayhead}
		>
			+
		</Button>
	</div>
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
				use:draggable={{
					onStart: (e) => {
						e.stopPropagation();
						onselect?.(kf.id);
					},
					onMove: (e) => {
						if (!rowEl) return;
						const rect = rowEl.getBoundingClientRect();
						keyframes.moveKeyframe(paramId, kf.id, {
							time: timeFromX(e.clientX - rect.left, rect.width)
						});
						refreshPreview();
					}
				}}
			></button>
		{/each}
		{#if inPoint > 0}
			<div
				class="pointer-events-none absolute top-0 bottom-0 left-0 rounded-l-md bg-background/60"
				style="width: {xFromTime(inPoint, rowWidth())}px"
			></div>
		{/if}
		{#if outPoint < 1}
			<div
				class="pointer-events-none absolute top-0 right-0 bottom-0 rounded-r-md bg-background/60"
				style="width: {rowWidth() - xFromTime(outPoint, rowWidth())}px"
			></div>
		{/if}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			data-testid="trim-in-{paramId}"
			role="slider"
			tabindex="-1"
			aria-label={m.timeline_trim_in()}
			aria-valuemin={0}
			aria-valuemax={1}
			aria-valuenow={inPoint}
			class="absolute top-0 bottom-0 w-1.5 -translate-x-1/2 cursor-ew-resize bg-amber-400/70"
			style="left: {xFromTime(inPoint, rowWidth())}px"
			use:draggable={{
				onStart: (e) => e.stopPropagation(),
				onMove: (e) => {
					if (!rowEl) return;
					const rect = rowEl.getBoundingClientRect();
					keyframes.setTrackInPoint(paramId, timeFromX(e.clientX - rect.left, rect.width));
					refreshPreview();
				}
			}}
		></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			data-testid="trim-out-{paramId}"
			role="slider"
			tabindex="-1"
			aria-label={m.timeline_trim_out()}
			aria-valuemin={0}
			aria-valuemax={1}
			aria-valuenow={outPoint}
			class="absolute top-0 bottom-0 w-1.5 -translate-x-1/2 cursor-ew-resize bg-amber-400/70"
			style="left: {xFromTime(outPoint, rowWidth())}px"
			use:draggable={{
				onStart: (e) => e.stopPropagation(),
				onMove: (e) => {
					if (!rowEl) return;
					const rect = rowEl.getBoundingClientRect();
					keyframes.setTrackOutPoint(paramId, timeFromX(e.clientX - rect.left, rect.width));
					refreshPreview();
				}
			}}
		></div>
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
