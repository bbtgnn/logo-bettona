<script lang="ts">
	import SettingsSection from '$lib/components/SettingsSection.svelte';
	import RingEditor from '$lib/components/RingEditor.svelte';
	import ColorsSection from '$lib/components/ColorsSection.svelte';
	import SidebarCollapsible from '$lib/components/SidebarCollapsible.svelte';
	import { composition, reorderRings } from '$lib/state/composition';
	import { m } from '$lib/paraglide/messages';

	let dragFromIndex: number | null = null;

	function handleDragStart(index: number) {
		return (e: DragEvent) => {
			dragFromIndex = index;
			e.dataTransfer?.setData('text/plain', String(index));
		};
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
	}

	function handleDrop(toIndex: number) {
		return (e: DragEvent) => {
			e.preventDefault();
			if (dragFromIndex !== null && dragFromIndex !== toIndex) {
				reorderRings(dragFromIndex, toIndex);
			}
			dragFromIndex = null;
		};
	}
</script>

<SettingsSection />

<SidebarCollapsible>
	{#snippet trigger()}
		{m.editor_rings()}
	{/snippet}

	{#snippet content()}
		{#if composition.rings.length === 0}
			<p class="py-8 text-center text-xs text-muted-foreground">
				{m.editor_no_rings()}
			</p>
		{:else}
			<div class="space-y-0.5">
				{#each composition.rings as ring, i (ring.id)}
					<RingEditor
						{ring}
						index={i}
						ondragstart={handleDragStart(i)}
						ondragover={handleDragOver}
						ondrop={handleDrop(i)}
					/>
				{/each}
			</div>
		{/if}
	{/snippet}
</SidebarCollapsible>

<ColorsSection />
