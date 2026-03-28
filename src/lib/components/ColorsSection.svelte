<script lang="ts">
	import * as Collapsible from '$lib/shadcn/ui/collapsible/index.js';
	import { CaretDown, CaretRight } from 'phosphor-svelte';
	import { colorMode, setColorMode } from '$lib/state/composition';
	import type { ColorMode } from '$lib/types';
	import MonochromePaletteEditor from './MonochromePaletteEditor.svelte';
	import FullPaletteEditor from './FullPaletteEditor.svelte';

	let open = $state(true);

	const modes: { value: ColorMode; label: string }[] = [
		{ value: 'monochrome', label: 'Monochrome' },
		{ value: 'palette', label: 'Palette' },
		{ value: 'manual', label: 'Manual' }
	];
</script>

<Collapsible.Collapsible bind:open>
	<div class="flex items-center gap-1 px-2 py-1.5">
		<Collapsible.CollapsibleTrigger
			class="flex flex-1 items-center gap-1 text-sm font-medium hover:text-foreground text-left"
		>
			{#if open}
				<CaretDown size={14} />
			{:else}
				<CaretRight size={14} />
			{/if}
			Colors
		</Collapsible.CollapsibleTrigger>
	</div>

	<Collapsible.CollapsibleContent class="px-3 pb-3 flex flex-col gap-3">
		<div class="flex rounded-md border border-input overflow-hidden text-xs">
			{#each modes as m (m.value)}
				<button
					class="flex-1 py-1 transition-colors {colorMode.mode === m.value ? 'bg-foreground text-background' : 'hover:bg-muted'}"
					onclick={() => setColorMode(m.value)}
				>
					{m.label}
				</button>
			{/each}
		</div>

		{#if colorMode.mode === 'monochrome'}
			<MonochromePaletteEditor />
		{:else if colorMode.mode === 'palette'}
			<FullPaletteEditor />
		{/if}
	</Collapsible.CollapsibleContent>
</Collapsible.Collapsible>
