<script lang="ts">
	import * as SidebarUI from '$lib/shadcn/ui/sidebar/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import AnimationSection from './AnimationSection.svelte';
	import RingEditor from './RingEditor.svelte';
	import ColorsSection from './ColorsSection.svelte';
	import { composition, addRing, reorderRings } from '$lib/state/composition';
	import SettingsSection from './SettingsSection.svelte';
	import SidebarCollapsible from './SidebarCollapsible.svelte';

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

<SidebarUI.Sidebar>
	<SidebarUI.SidebarContent class="divide-y divide-border" data-testid="sidebar-content">
		<SettingsSection />

		<AnimationSection />

		<ColorsSection />

		<SidebarCollapsible>
			{#snippet trigger()}
				Rings
			{/snippet}

			{#snippet content()}
				<Button onclick={addRing} class="w-full">Add Ring</Button>

				{#if composition.rings.length === 0}
					<p class="py-8 text-center text-xs text-muted-foreground">
						No rings yet. Click "Add Ring" to start.
					</p>
				{:else}
					<div class="space-y-0.5">
						{#each composition.rings as ring, i (i)}
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
	</SidebarUI.SidebarContent>
</SidebarUI.Sidebar>
