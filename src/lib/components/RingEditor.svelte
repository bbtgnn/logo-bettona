<script lang="ts">
	import paper from 'paper';
	import * as Collapsible from '$lib/shadcn/ui/collapsible/index.js';
	import { Slider } from '$lib/shadcn/ui/slider/index.js';
	import { Input } from '$lib/shadcn/ui/input/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { CaretDown, CaretRight, Trash, DotsSixVertical } from 'phosphor-svelte';
	import { updateRing, removeRing, setRingExpanded, isRingExpanded, colorMode } from '$lib/state/composition';
	import { importSvg } from '$lib/geometry/svg-import';
	import RingCanvas from './RingCanvas.svelte';
	import type { Ring } from '$lib/types';

	let {
		ring,
		index,
		ondragstart,
		ondragover,
		ondrop
	}: {
		ring: Ring;
		index: number;
		ondragstart?: (e: DragEvent) => void;
		ondragover?: (e: DragEvent) => void;
		ondrop?: (e: DragEvent) => void;
	} = $props();

	let open = $state(isRingExpanded(index));
	let importError = $state<string | null>(null);

	// Dedicated PaperScope for SVG import (not for display — RingCanvas has its own)
	const importScope = new paper.PaperScope();
	importScope.setup(new paper.Size(1, 1));

	async function handleFileChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		importError = null;
		const path = await importSvg(file, importScope);

		if (!path) {
			importError = 'No valid path found. Make sure the SVG contains a single-contour path.';
			return;
		}

		updateRing(index, { templatePath: path });
	}
</script>

<div
	class="border rounded mb-2 bg-background"
	draggable="true"
	role="listitem"
	{ondragstart}
	{ondragover}
	{ondrop}
>
	<Collapsible.Collapsible bind:open onOpenChange={(v) => setRingExpanded(index, v)}>
		<div class="flex items-center gap-1 px-2 py-1.5">
			<button class="cursor-grab text-muted-foreground hover:text-foreground" aria-label="Drag to reorder">
				<DotsSixVertical size={16} />
			</button>
			<Collapsible.CollapsibleTrigger
				class="flex flex-1 items-center gap-1 text-sm font-medium hover:text-foreground text-left"
			>
				{#if open}
					<CaretDown size={14} />
				{:else}
					<CaretRight size={14} />
				{/if}
				Ring {index + 1}
			</Collapsible.CollapsibleTrigger>
			<Button
				variant="ghost"
				size="icon"
				class="h-6 w-6 text-muted-foreground hover:text-destructive"
				onclick={() => removeRing(index)}
				aria-label="Delete ring"
			>
				<Trash size={14} />
			</Button>
		</div>

		<Collapsible.CollapsibleContent class="px-3 pb-3 space-y-3">
			<RingCanvas
				templatePath={ring.templatePath}
				onchange={(newPath) => updateRing(index, { templatePath: newPath })}
			/>

			<div class="flex flex-col gap-1">
				<Label for="svg-upload-{index}" class="text-xs">Import SVG</Label>
				<input
					id="svg-upload-{index}"
					type="file"
					accept=".svg,image/svg+xml"
					onchange={handleFileChange}
					class="text-xs file:mr-2 file:text-xs file:border-0 file:bg-muted file:rounded file:px-2 file:py-1 file:cursor-pointer cursor-pointer"
				/>
				{#if importError}
					<p class="text-xs text-destructive">{importError}</p>
				{/if}
			</div>

			<div class="flex flex-col gap-1">
				<Label for="copies-{index}" class="text-xs">Copies</Label>
				<Input
					id="copies-{index}"
					type="number"
					min="1"
					value={ring.copies}
					oninput={(e) =>
						updateRing(index, { copies: Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1) })}
				/>
			</div>

			<div class="flex flex-col gap-2">
				<Label class="text-xs">Ring height <span class="text-muted-foreground">{ring.ringHeight.toFixed(2)}</span></Label>
				<Slider
					type="single"
					min={0}
					max={1}
					step={0.01}
					value={ring.ringHeight}
					onValueChange={(v) => updateRing(index, { ringHeight: v })}
				/>
			</div>

			{#if colorMode.mode === 'manual'}
			<div class="flex flex-col gap-1">
				<Label for="color-{index}" class="text-xs">Color</Label>
				<div class="flex items-center gap-2">
					<input
						id="color-{index}"
						type="color"
						value={ring.color}
						oninput={(e) => updateRing(index, { color: (e.target as HTMLInputElement).value })}
						class="h-8 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
					/>
					<span class="text-xs text-muted-foreground font-mono">{ring.color}</span>
				</div>
			</div>
		{/if}
		</Collapsible.CollapsibleContent>
	</Collapsible.Collapsible>
</div>
