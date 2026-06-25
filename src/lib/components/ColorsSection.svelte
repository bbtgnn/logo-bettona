<script lang="ts">
	import { colorMode, setColorMode } from '$lib/state/composition';
	import type { ColorMode } from '$lib/types';
	import MonochromePaletteEditor from './MonochromePaletteEditor.svelte';
	import FullPaletteEditor from './FullPaletteEditor.svelte';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import { m } from '$lib/paraglide/messages';

	const modes: ColorMode[] = ['monochrome', 'palette', 'manual'];

	function modeLabel(mode: ColorMode): string {
		if (mode === 'monochrome') return m.editor_color_monochrome();
		if (mode === 'palette') return m.editor_color_palette();
		return m.editor_color_manual();
	}
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{m.editor_colors()}
	{/snippet}

	{#snippet content()}
		<div class="flex overflow-hidden rounded-md border border-input text-xs">
			{#each modes as mode (mode)}
				<button
					class="flex-1 py-1 transition-colors {colorMode.mode === mode
						? 'bg-foreground text-background'
						: 'hover:bg-muted'}"
					onclick={() => setColorMode(mode)}
				>
					{modeLabel(mode)}
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
