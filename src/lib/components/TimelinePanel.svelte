<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Input } from '$lib/shadcn/ui/input/index.js';
	import { keyframes } from '$lib/state/keyframes.svelte';
	import { KALEIDO_PARAMS } from '$lib/state/kaleidoscope-params';
	import {
		animationState,
		refreshPreview,
		togglePlay,
		stopAnimation,
		setAnimationDurationSec,
		setAnimationFps
	} from '$lib/state/animation';
	import { composition } from '$lib/state/composition';
	import { xFromTime } from '$lib/animation/timeline-geometry';
	import { m } from '$lib/paraglide/messages';
	import type { Interp } from '$lib/animation/keyframes';
	import TimelineRuler from './TimelineRuler.svelte';
	import TimelineTrack from './TimelineTrack.svelte';
	import KeyframeGraphEditor from './KeyframeGraphEditor.svelte';

	let open = $state(true);
	let view = $state<'tracks' | 'graph'>('tracks');
	let graphParamId = $state<string | null>(null);

	const FPS_OPTIONS = [25, 30, 50, 60];

	// Audio modes run off a live clock with no fixed duration → show elapsed instead of a
	// duration field. blockPlayback mirrors the morph requirement for timed modes.
	const isAudioMode = $derived(
		animationState.mode === 'audioBars' || animationState.mode === 'audioZones'
	);
	const hasMorphRings = $derived(composition.rings.some((r) => r.secondaryTemplatePath !== null));
	const blockPlayback = $derived(!isAudioMode && !hasMorphRings);

	// Horizontal zoom of the tracks stage. The stage width is zoom×100% inside a scroll
	// container, so the ruler, keyframes and playhead all scale (they measure their own
	// width) and frame ticks pass their density threshold as zoom grows.
	const ZOOM_MIN = 1;
	const ZOOM_MAX = 8;
	let zoom = $state(1);
	const zoomPercent = $derived(Math.round(zoom * 100));
	function zoomIn() {
		zoom = Math.min(ZOOM_MAX, zoom * 1.5);
	}
	function zoomOut() {
		zoom = Math.max(ZOOM_MIN, zoom / 1.5);
	}

	function formatElapsed(ms: number): string {
		const totalSec = Math.floor(ms / 1000);
		const min = Math.floor(totalSec / 60);
		const s = totalSec % 60;
		return `${min}:${String(s).padStart(2, '0')}`;
	}

	// Spacebar toggles play, except while typing in a field. Window-level so the
	// timeline panel owns the shortcut without needing canvas focus.
	function onKeydown(e: KeyboardEvent) {
		if (e.key !== ' ' && e.code !== 'Space') return;
		const t = e.target as HTMLElement | null;
		const tag = t?.tagName;
		if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || t?.isContentEditable) return;
		e.preventDefault();
		if (!blockPlayback) togglePlay();
	}

	$effect(() => {
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});

	let laneColEl = $state<HTMLDivElement>();
	let selection = $state<{ paramId: string; keyframeId: string } | null>(null);

	const armedParams = $derived(KALEIDO_PARAMS.filter((p) => keyframes.tracks[p.id]?.enabled));

	// The selected keyframe, resolved against live state (null once it's deleted).
	const selectedKf = $derived(
		selection
			? (keyframes.tracks[selection.paramId]?.keyframes.find(
					(k) => k.id === selection!.keyframeId
				) ?? null)
			: null
	);

	function selectKeyframe(paramId: string, keyframeId: string | null) {
		selection = keyframeId ? { paramId, keyframeId } : null;
	}

	function setSelectedInterp(value: string) {
		if (!selection) return;
		keyframes.setKeyframeInterp(selection.paramId, selection.keyframeId, value as Interp);
		refreshPreview();
	}

	function deleteSelected() {
		if (!selection) return;
		keyframes.deleteKeyframe(selection.paramId, selection.keyframeId);
		selection = null;
		refreshPreview();
	}

	// One continuous playhead overlaid across ruler + lanes: the lane column is
	// measured at runtime so the line needs no hardcoded gutter width.
	const playheadLeft = $derived(
		(laneColEl?.offsetLeft ?? 0) + xFromTime(animationState.progress, laneColEl?.clientWidth ?? 0)
	);

	// Keep the graph selection valid. Prefer the explicit pick; otherwise default to
	// an armed param that already has keyframes (so the graph opens on a curve, not an
	// empty editor), then fall back to the first armed param.
	const graphParam = $derived(
		armedParams.find((p) => p.id === graphParamId) ??
			armedParams.find((p) => (keyframes.tracks[p.id]?.keyframes.length ?? 0) > 0) ??
			armedParams[0] ??
			null
	);
</script>

<section data-testid="timeline-panel" class="w-full border-t bg-background">
	<div class="flex items-center gap-3 p-3">
		<button
			type="button"
			aria-label={m.timeline_toggle()}
			class="flex items-center gap-1.5 text-sm font-medium text-foreground"
			onclick={() => (open = !open)}
		>
			<span
				class="inline-block text-muted-foreground transition-transform {open ? 'rotate-90' : ''}"
			>
				▸
			</span>
			{m.timeline_title()}
		</button>
		{#if open}
			<div class="flex items-center gap-2">
				<Button
					onclick={togglePlay}
					aria-pressed={animationState.isPlaying}
					disabled={blockPlayback}
					size="sm"
				>
					{animationState.isPlaying ? m.common_pause() : m.common_play()}
				</Button>
				<Button onclick={() => stopAnimation(true)} variant="ghost" size="sm"
					>{m.timeline_stop()}</Button
				>

				{#if isAudioMode}
					<span
						class="text-xs text-muted-foreground tabular-nums"
						aria-label={m.timeline_elapsed_aria()}
					>
						{formatElapsed(animationState.elapsedMs)}
					</span>
				{:else}
					<label class="flex items-center gap-1 text-xs text-muted-foreground">
						{m.timeline_duration_label()}
						<Input
							type="number"
							min="0.1"
							step="0.1"
							aria-label={m.timeline_duration_aria()}
							value={animationState.durationSec}
							oninput={(e) => setAnimationDurationSec(Number((e.target as HTMLInputElement).value))}
							class="h-7 w-16 text-xs"
						/>
						{m.timeline_seconds_unit()}
					</label>
				{/if}

				<label class="flex items-center gap-1 text-xs text-muted-foreground">
					{m.timeline_fps()}
					<select
						aria-label={m.timeline_fps_aria()}
						class="h-7 rounded border bg-background text-xs"
						value={animationState.fps}
						onchange={(e) => setAnimationFps(Number((e.target as HTMLSelectElement).value))}
					>
						{#each FPS_OPTIONS as f (f)}
							<option value={f}>{f}</option>
						{/each}
					</select>
				</label>
			</div>
			<div class="flex items-center gap-0.5 rounded-md bg-muted/40 p-0.5">
				<Button
					variant={view === 'tracks' ? 'default' : 'ghost'}
					size="sm"
					onclick={() => (view = 'tracks')}
				>
					{m.timeline_title()}
				</Button>
				<Button
					variant={view === 'graph' ? 'default' : 'ghost'}
					size="sm"
					onclick={() => (view = 'graph')}
				>
					{m.timeline_view_graph()}
				</Button>
			</div>

			{#if view === 'tracks' && armedParams.length > 0}
				<div class="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						aria-label={m.timeline_zoom_out()}
						onclick={zoomOut}
						disabled={zoom <= ZOOM_MIN}
					>
						−
					</Button>
					<span
						data-testid="timeline-zoom"
						class="w-10 text-center text-xs text-muted-foreground tabular-nums"
					>
						{zoomPercent}%
					</span>
					<Button
						variant="ghost"
						size="sm"
						aria-label={m.timeline_zoom_in()}
						onclick={zoomIn}
						disabled={zoom >= ZOOM_MAX}
					>
						+
					</Button>
				</div>
			{/if}
		{/if}
	</div>

	{#if open}
		<div data-testid="timeline-body" class="flex min-h-[220px] flex-col gap-2 px-3 pb-3">
			{#if armedParams.length === 0}
				<p data-testid="timeline-empty" class="p-2 text-xs text-muted-foreground">
					{m.timeline_empty_hint()}
				</p>
			{:else if view === 'graph'}
				<div data-testid="timeline-graph" class="flex flex-col gap-2">
					<select
						aria-label={m.timeline_graph_param()}
						class="h-7 w-fit rounded border bg-background text-xs"
						value={graphParam?.id ?? ''}
						onchange={(e) => (graphParamId = (e.target as HTMLSelectElement).value)}
					>
						{#each armedParams as p (p.id)}
							<option value={p.id}>{p.label}</option>
						{/each}
					</select>
					{#if graphParam}
						<KeyframeGraphEditor
							paramId={graphParam.id}
							min={graphParam.min}
							max={graphParam.max}
						/>
					{/if}
				</div>
			{:else}
				<div class="overflow-x-auto">
					<div
						data-testid="timeline-tracks"
						class="relative flex flex-col gap-1.5"
						style="width: {zoom * 100}%"
					>
						<div class="flex items-center gap-2">
							<span class="w-28 shrink-0"></span>
							<div bind:this={laneColEl} class="flex-1">
								<TimelineRuler />
							</div>
						</div>
						{#each armedParams as p (p.id)}
							<TimelineTrack
								paramId={p.id}
								label={p.label}
								selectedId={selection?.paramId === p.id ? selection.keyframeId : null}
								onselect={(id) => selectKeyframe(p.id, id)}
							/>
						{/each}
						<div
							data-testid="playhead"
							class="pointer-events-none absolute top-0 bottom-0 w-px bg-primary"
							style="left: {playheadLeft}px"
						></div>
						{#if selectedKf}
							<div data-testid="timeline-inspector" class="flex items-center gap-2 pt-2">
								<select
									aria-label={m.timeline_interp_aria()}
									class="h-7 rounded border bg-background text-xs"
									value={selectedKf.interp}
									onchange={(e) => setSelectedInterp((e.target as HTMLSelectElement).value)}
								>
									<option value="linear">{m.timeline_interp_linear()}</option>
									<option value="bezier">{m.timeline_interp_bezier()}</option>
									<option value="hold">{m.timeline_interp_hold()}</option>
								</select>
								<Button variant="ghost" size="sm" onclick={deleteSelected}
									>{m.timeline_delete_keyframe()}</Button
								>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</section>
