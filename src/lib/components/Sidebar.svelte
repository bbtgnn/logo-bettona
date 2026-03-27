<script lang="ts">
	import * as SidebarUI from '$lib/shadcn/ui/sidebar/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Input } from '$lib/shadcn/ui/input/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import RingEditor from './RingEditor.svelte';
	import { composition, addRing, setBaseRadius, setRingIncrement, reorderRings } from '$lib/state/composition';

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
	<SidebarUI.SidebarHeader class="p-4 gap-4">
		<div class="grid grid-cols-2 gap-3">
			<div class="flex flex-col gap-1">
				<Label for="base-radius" class="text-xs">Base radius</Label>
				<Input
					id="base-radius"
					type="number"
					min="1"
					value={composition.baseRadius}
					oninput={(e) => setBaseRadius(Number((e.target as HTMLInputElement).value))}
				/>
			</div>
			<div class="flex flex-col gap-1">
				<Label for="ring-increment" class="text-xs">Ring increment</Label>
				<Input
					id="ring-increment"
					type="number"
					min="1"
					value={composition.ringIncrement}
					oninput={(e) => setRingIncrement(Number((e.target as HTMLInputElement).value))}
				/>
			</div>
		</div>
		<Button onclick={addRing} class="w-full">Add Ring</Button>
	</SidebarUI.SidebarHeader>

	<SidebarUI.SidebarContent class="p-2">
		{#each composition.rings as ring, i (i)}
			<RingEditor
				{ring}
				index={i}
				ondragstart={handleDragStart(i)}
				ondragover={handleDragOver}
				ondrop={handleDrop(i)}
			/>
		{/each}

		{#if composition.rings.length === 0}
			<p class="text-xs text-muted-foreground text-center py-8">No rings yet. Click "Add Ring" to start.</p>
		{/if}
	</SidebarUI.SidebarContent>
</SidebarUI.Sidebar>
