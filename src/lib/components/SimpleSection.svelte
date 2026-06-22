<script lang="ts">
	import { animationState, setLayerEnabled } from '$lib/state/animation';
	import { composition } from '$lib/state/composition';
	import { m } from '$lib/paraglide/messages';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import RingMorphConfigItem from './RingMorphConfigItem.svelte';
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

			{#if composition.rings.length === 0}
				<p class="text-[11px] text-muted-foreground">{m.animate_simple_empty()}</p>
			{:else}
				{#each composition.rings as ring, i (i)}
					<RingMorphConfigItem {ring} index={i} />
				{/each}
			{/if}
		</div>
	{/snippet}
</SidebarCollapsible>
