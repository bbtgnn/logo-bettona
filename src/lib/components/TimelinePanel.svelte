<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { keyframes } from '$lib/state/keyframes.svelte';
	import { kaleidoscope } from '$lib/state/kaleidoscope.svelte';
	import { KALEIDO_PARAMS } from '$lib/state/kaleidoscope-params';
	import TimelineRuler from './TimelineRuler.svelte';
	import TimelineTrack from './TimelineTrack.svelte';
	import KeyframeGraphEditor from './KeyframeGraphEditor.svelte';

	let open = $state(false);
	let graphMode = $state(false);
	let graphParamId = $state<string | null>(null);

	const armedParams = $derived(KALEIDO_PARAMS.filter((p) => keyframes.tracks[p.id]?.enabled));

	// Keep the graph selection valid: default to / fall back to the first armed param.
	const graphParam = $derived(
		armedParams.find((p) => p.id === graphParamId) ?? armedParams[0] ?? null
	);
</script>

{#if kaleidoscope.enabled}
	<section data-testid="timeline-panel" class="w-full border-t bg-background">
		<div class="flex items-center gap-2 p-2">
			<Button variant="ghost" size="sm" onclick={() => (open = !open)}>Timeline</Button>
			{#if open}
				<Button
					variant={graphMode ? 'default' : 'ghost'}
					size="sm"
					onclick={() => (graphMode = !graphMode)}
				>
					Graph Editor
				</Button>
			{/if}
		</div>

		{#if open}
			<div data-testid="timeline-body" class="flex flex-col gap-1 p-2">
				{#if armedParams.length === 0}
					<p data-testid="timeline-empty" class="p-2 text-xs text-muted-foreground">
						Arma un cronometro ⏱ nella sidebar per animare un parametro.
					</p>
				{:else if graphMode}
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
					<div data-testid="timeline-tracks" class="flex flex-col gap-1">
						<TimelineRuler />
						{#each armedParams as p (p.id)}
							<TimelineTrack paramId={p.id} label={p.label} />
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</section>
{/if}
