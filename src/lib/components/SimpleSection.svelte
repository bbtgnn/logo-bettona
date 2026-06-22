<script lang="ts">
	import { animationState, setLayerEnabled } from '$lib/state/animation';
	import { composition, setRingMorphT } from '$lib/state/composition';
	import { Slider } from '$lib/shadcn/ui/slider/index.js';
	import { m } from '$lib/paraglide/messages';
	import SidebarCollapsible from './SidebarCollapsible.svelte';

	const morphRings = $derived(
		composition.rings
			.map((ring, index) => ({ ring, index }))
			.filter(({ ring }) => ring.secondaryTemplatePath !== null)
	);
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{m.animate_layer_simple()}
	{/snippet}

	{#snippet content()}
		<div class="space-y-3">
			<label class="flex items-center gap-2 text-xs font-medium">
				<input
					type="checkbox"
					data-testid="layer-toggle-simple"
					aria-label={m.animate_layer_toggle()}
					checked={animationState.layers.simple}
					onchange={(e) => setLayerEnabled('simple', (e.target as HTMLInputElement).checked)}
				/>
				{m.animate_layer_simple()}
			</label>

			{#if morphRings.length === 0}
				<p class="text-[11px] text-muted-foreground">{m.animate_simple_empty()}</p>
			{:else}
				{#each morphRings as { ring, index } (index)}
					<div class="flex flex-col gap-1">
						<span class="text-xs text-muted-foreground">
							{m.editor_ring_label({ index: index + 1 })} ({(ring.morphT ?? 0).toFixed(2)})
						</span>
						<Slider
							type="single"
							min={0}
							max={1}
							step={0.01}
							value={ring.morphT ?? 0}
							onValueChange={(v) => setRingMorphT(index, v)}
						/>
					</div>
				{/each}
			{/if}
		</div>
	{/snippet}
</SidebarCollapsible>
