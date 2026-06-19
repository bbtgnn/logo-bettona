<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { keyframes } from '$lib/state/keyframes.svelte';
	import { KALEIDO_PARAMS } from '$lib/state/kaleidoscope-params';
	import { animationState, applyKaleidoscopeKeyframes } from '$lib/state/animation';
	import { xFromTime } from '$lib/animation/timeline-geometry';
	import type { Interp } from '$lib/animation/keyframes';
	import TimelineRuler from './TimelineRuler.svelte';
	import TimelineTrack from './TimelineTrack.svelte';
	import KeyframeGraphEditor from './KeyframeGraphEditor.svelte';

	let open = $state(true);
	let view = $state<'tracks' | 'graph'>('tracks');
	let graphParamId = $state<string | null>(null);

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

	function reapplyIfPaused() {
		if (!animationState.isPlaying) applyKaleidoscopeKeyframes(animationState.progress);
	}

	function selectKeyframe(paramId: string, keyframeId: string | null) {
		selection = keyframeId ? { paramId, keyframeId } : null;
	}

	function setSelectedInterp(value: string) {
		if (!selection) return;
		keyframes.setKeyframeInterp(selection.paramId, selection.keyframeId, value as Interp);
		reapplyIfPaused();
	}

	function deleteSelected() {
		if (!selection) return;
		keyframes.deleteKeyframe(selection.paramId, selection.keyframeId);
		selection = null;
		reapplyIfPaused();
	}

	// One continuous playhead overlaid across ruler + lanes: the lane column is
	// measured at runtime so the line needs no hardcoded gutter width.
	const playheadLeft = $derived(
		(laneColEl?.offsetLeft ?? 0) + xFromTime(animationState.progress, laneColEl?.clientWidth ?? 0)
	);

	// Keep the graph selection valid: default to / fall back to the first armed param.
	const graphParam = $derived(
		armedParams.find((p) => p.id === graphParamId) ?? armedParams[0] ?? null
	);
</script>

<section data-testid="timeline-panel" class="w-full border-t bg-background">
	<div class="flex items-center gap-3 p-3">
		<button
			type="button"
			aria-label="Mostra/nascondi timeline"
			class="flex items-center gap-1.5 text-sm font-medium text-foreground"
			onclick={() => (open = !open)}
		>
			<span class="inline-block text-muted-foreground transition-transform {open ? 'rotate-90' : ''}">
				▸
			</span>
			Timeline
		</button>
		{#if open}
			<div class="flex items-center gap-0.5 rounded-md bg-muted/40 p-0.5">
				<Button
					variant={view === 'tracks' ? 'default' : 'ghost'}
					size="sm"
					onclick={() => (view = 'tracks')}
				>
					Timeline
				</Button>
				<Button
					variant={view === 'graph' ? 'default' : 'ghost'}
					size="sm"
					onclick={() => (view = 'graph')}
				>
					Graph Editor
				</Button>
			</div>
		{/if}
	</div>

	{#if open}
		<div data-testid="timeline-body" class="flex flex-col gap-2 px-3 pb-3">
			{#if armedParams.length === 0}
				<p data-testid="timeline-empty" class="p-2 text-xs text-muted-foreground">
					Arma un cronometro ⏱ nella sidebar per animare un parametro.
				</p>
			{:else if view === 'graph'}
				<div data-testid="timeline-graph" class="flex flex-col gap-2">
					<select
						aria-label="Parametro grafico"
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
				<div data-testid="timeline-tracks" class="relative flex flex-col gap-1.5">
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
								aria-label="Interpolazione keyframe"
								class="h-7 rounded border bg-background text-xs"
								value={selectedKf.interp}
								onchange={(e) => setSelectedInterp((e.target as HTMLSelectElement).value)}
							>
								<option value="linear">Lineare</option>
								<option value="bezier">Bezier</option>
								<option value="hold">Hold</option>
							</select>
							<Button variant="ghost" size="sm" onclick={deleteSelected}>Elimina keyframe</Button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</section>
