<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Input } from '$lib/shadcn/ui/input/index.js';
	import { Trash, Plus, Shuffle } from 'phosphor-svelte';
	import {
		composition,
		colorMode,
		setActivePalette,
		addFullPalette,
		updateFullPalette,
		removeFullPalette,
		reshuffle
	} from '$lib/state/composition';
	import { parseHexColors } from '$lib/color/apply';
	import { m } from '$lib/paraglide/messages';

	function paletteToInput(colors: string[]): string {
		return colors.join(', ');
	}

	function handleInput(e: Event) {
		const raw = (e.target as HTMLInputElement).value;
		const colors = parseHexColors(raw);
		updateFullPalette(colorMode.palette, { colors });
	}
</script>

<div class="flex flex-col gap-2">
	{#each composition.fullPalettes as palette, i (i)}
		<div
			class="flex cursor-pointer items-center gap-2 rounded border p-1.5 transition-colors {colorMode.palette ===
			i
				? 'border-foreground bg-muted'
				: 'border-border hover:border-muted-foreground'}"
			role="button"
			tabindex="0"
			aria-pressed={colorMode.palette === i}
			onclick={() => setActivePalette(i)}
			onkeydown={(e) => e.key === 'Enter' && setActivePalette(i)}
		>
			<div class="flex flex-1 flex-wrap gap-1">
				{#each palette.colors as color (color)}
					<div
						class="h-5 w-5 flex-shrink-0 rounded-sm border border-border"
						style="background-color: {color}"
					></div>
				{/each}
			</div>
			<Button
				variant="ghost"
				size="icon"
				class="h-5 w-5 flex-shrink-0 text-muted-foreground hover:text-destructive"
				disabled={composition.fullPalettes.length <= 1}
				onclick={(e) => {
					e.stopPropagation();
					removeFullPalette(i);
				}}
				aria-label={m.colors_delete_palette()}
			>
				<Trash size={12} />
			</Button>
		</div>
	{/each}

	{#if colorMode.palette < composition.fullPalettes.length}
		{@const active = composition.fullPalettes[colorMode.palette]}
		<div class="flex flex-col gap-1.5 pt-1">
			<Input
				value={paletteToInput(active.colors)}
				oninput={handleInput}
				placeholder="#000000, #ffffff"
				class="font-mono text-xs"
			/>
			<div class="flex flex-wrap gap-1">
				{#each active.colors as color (color)}
					<div
						class="h-5 w-5 rounded-sm border border-border"
						style="background-color: {color}"
						title={color}
					></div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="flex gap-2">
		<Button
			variant="outline"
			size="sm"
			class="flex-1 gap-1 text-xs"
			onclick={() => addFullPalette()}
		>
			<Plus size={12} />
			{m.colors_new_palette()}
		</Button>
		<Button
			variant="outline"
			size="sm"
			class="gap-1 text-xs"
			onclick={reshuffle}
			title={m.colors_reshuffle()}
		>
			<Shuffle size={12} />
		</Button>
	</div>
</div>
