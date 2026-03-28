<script lang="ts">
	import { colorMode, setColorMode } from '$lib/state/composition';
	import type { ColorMode } from '$lib/types';
	import MonochromePaletteEditor from './MonochromePaletteEditor.svelte';
	import FullPaletteEditor from './FullPaletteEditor.svelte';
	import SidebarCollapsible from './SidebarCollapsible.svelte';

	//

	const modes: { value: ColorMode; label: string }[] = [
		{ value: 'monochrome', label: 'Monochrome' },
		{ value: 'palette', label: 'Palette' },
		{ value: 'manual', label: 'Manual' }
	];
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		Colors
	{/snippet}

	{#snippet content()}
		<div class="flex overflow-hidden rounded-md border border-input text-xs">
			{#each modes as m (m.value)}
				<button
					class="flex-1 py-1 transition-colors {colorMode.mode === m.value
						? 'bg-foreground text-background'
						: 'hover:bg-muted'}"
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
	{/snippet}
</SidebarCollapsible>
