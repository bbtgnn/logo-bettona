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
	import { m } from '$lib/paraglide/messages';
</script>

<div class="flex flex-col gap-2">
	{#each composition.monochromePalettes as palette, i (i)}
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
			<div class="flex flex-1 gap-1">
				<div
					class="h-5 w-5 flex-shrink-0 rounded-sm border border-border"
					style="background-color: {palette.primary}"
					title={m.colors_primary()}
				></div>
				<div
					class="h-5 w-5 flex-shrink-0 rounded-sm border border-border"
					style="background-color: {palette.secondary}"
					title={m.colors_secondary()}
				></div>
				<div
					class="h-5 w-5 flex-shrink-0 rounded-sm border border-border"
					style="background-color: {palette.background}"
					title={m.colors_background()}
				></div>
			</div>
			<Button
				variant="ghost"
				size="icon"
				class="h-5 w-5 flex-shrink-0 text-muted-foreground hover:text-destructive"
				disabled={composition.monochromePalettes.length <= 1}
				onclick={(e) => {
					e.stopPropagation();
					removeMonochromePalette(i);
				}}
				aria-label={m.colors_delete_palette()}
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
					<Label class="text-xs">{m.colors_primary()}</Label>
					<input
						type="color"
						value={active.primary}
						oninput={(e) =>
							updateMonochromePalette(colorMode.palette, {
								primary: (e.target as HTMLInputElement).value
							})}
						class="h-8 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
					/>
				</div>
				<div class="flex flex-col gap-1">
					<Label class="text-xs">{m.colors_secondary()}</Label>
					<input
						type="color"
						value={active.secondary}
						oninput={(e) =>
							updateMonochromePalette(colorMode.palette, {
								secondary: (e.target as HTMLInputElement).value
							})}
						class="h-8 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
					/>
				</div>
				<div class="flex flex-col gap-1">
					<Label class="text-xs">{m.colors_background()}</Label>
					<input
						type="color"
						value={active.background}
						oninput={(e) =>
							updateMonochromePalette(colorMode.palette, {
								background: (e.target as HTMLInputElement).value
							})}
						class="h-8 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
					/>
				</div>
			</div>
		</div>
	{/if}

	<Button
		variant="outline"
		size="sm"
		class="w-full gap-1 text-xs"
		onclick={() => addMonochromePalette()}
	>
		<Plus size={12} />
		{m.colors_new_palette()}
	</Button>
</div>
