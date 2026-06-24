<script lang="ts">
	import { composition } from '$lib/state/composition';
	import { m } from '$lib/paraglide/messages';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import RingMorphConfigItem from './RingMorphConfigItem.svelte';
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{m.animate_layer_morph()}
	{/snippet}

	{#snippet content()}
		<div class="space-y-3">
			{#if composition.rings.length === 0}
				<p class="text-[11px] text-muted-foreground">{m.animate_simple_empty()}</p>
			{:else}
				{#each composition.rings as ring, i (ring.id)}
					<RingMorphConfigItem {ring} index={i} />
				{/each}
			{/if}
		</div>
	{/snippet}
</SidebarCollapsible>
