<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { Trash, Plus } from 'phosphor-svelte';
	import {
		composition,
		colorMode,
		setActivePalette,
		addMonochromePalette,
		updateMonochromePalette,
		removeMonochromePalette
	} from '$lib/state/composition';
</script>

<div class="flex flex-col gap-2">
	{#each composition.monochromePalettes as palette, i (i)}
		<div
			class="flex items-center gap-2 rounded border p-1.5 cursor-pointer transition-colors {colorMode.palette === i ? 'border-foreground bg-muted' : 'border-border hover:border-muted-foreground'}"
			role="button"
			tabindex="0"
			aria-pressed={colorMode.palette === i}
			onclick={() => setActivePalette(i)}
			onkeydown={(e) => e.key === 'Enter' && setActivePalette(i)}
		>
			<div class="flex gap-1 flex-1">
				<div
					class="h-5 w-5 rounded-sm border border-border flex-shrink-0"
					style="background-color: {palette.main}"
					title="Main"
				></div>
				<div
					class="h-5 w-5 rounded-sm border border-border flex-shrink-0"
					style="background-color: {palette.bg}"
					title="Background"
				></div>
			</div>
			<Button
				variant="ghost"
				size="icon"
				class="h-5 w-5 text-muted-foreground hover:text-destructive flex-shrink-0"
				disabled={composition.monochromePalettes.length <= 1}
				onclick={(e) => { e.stopPropagation(); removeMonochromePalette(i); }}
				aria-label="Delete palette"
			>
				<Trash size={12} />
			</Button>
		</div>
	{/each}

	{#if colorMode.palette < composition.monochromePalettes.length}
		{@const active = composition.monochromePalettes[colorMode.palette]}
		<div class="flex flex-col gap-2 pt-1">
			<div class="flex gap-3">
				<div class="flex flex-col gap-1">
					<Label class="text-xs">Main</Label>
					<input
						type="color"
						value={active.main}
						oninput={(e) => updateMonochromePalette(colorMode.palette, { main: (e.target as HTMLInputElement).value })}
						class="h-8 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
					/>
				</div>
				<div class="flex flex-col gap-1">
					<Label class="text-xs">Background</Label>
					<input
						type="color"
						value={active.bg}
						oninput={(e) => updateMonochromePalette(colorMode.palette, { bg: (e.target as HTMLInputElement).value })}
						class="h-8 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
					/>
				</div>
			</div>
		</div>
	{/if}

	<Button variant="outline" size="sm" class="w-full gap-1 text-xs" onclick={() => addMonochromePalette()}>
		<Plus size={12} /> New palette
	</Button>
</div>
