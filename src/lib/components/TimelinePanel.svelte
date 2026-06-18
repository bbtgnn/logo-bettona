<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { keyframes, KALEIDO_GLOBAL_ROTATION } from '$lib/state/keyframes.svelte';
	import TimelineRuler from './TimelineRuler.svelte';
	import TimelineTrack from './TimelineTrack.svelte';
	import KeyframeGraphEditor from './KeyframeGraphEditor.svelte';

	keyframes.ensureTrack(KALEIDO_GLOBAL_ROTATION);

	let open = $state(false);
	let graphMode = $state(false);
</script>

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
			{#if graphMode}
				<div data-testid="timeline-graph" class="w-full">
					<KeyframeGraphEditor paramId={KALEIDO_GLOBAL_ROTATION} min={0} max={360} />
				</div>
			{:else}
				<div data-testid="timeline-tracks" class="flex flex-col gap-1">
					<TimelineRuler />
					<TimelineTrack paramId={KALEIDO_GLOBAL_ROTATION} label="Rotazione globale" />
				</div>
			{/if}
		</div>
	{/if}
</section>
