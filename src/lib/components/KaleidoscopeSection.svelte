<script lang="ts">
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import AnimatableSlider from './AnimatableSlider.svelte';
	import {
		kaleidoscope,
		setKaleidoscopeEnabled,
		setCircularMask,
		setLiveTile,
		setTileBackground,
		setKaleidoscopeBackgroundColor,
		requestTileRefresh
	} from '$lib/state/kaleidoscope.svelte';
	import { KALEIDO_PARAMS } from '$lib/state/kaleidoscope-params';

	// animatable=false → static sliders (no stopwatch), for the Editor where the
	// kaleidoscope look is modelled but not keyframed. Animate uses the default.
	let { animatable = true }: { animatable?: boolean } = $props();

	const checked = (e: Event) => (e.target as HTMLInputElement).checked;
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		Caleidoscopio
	{/snippet}

	{#snippet content()}
		<div class="flex flex-col gap-3">
			<label class="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					aria-label="Modalità caleidoscopio"
					checked={kaleidoscope.enabled}
					onchange={(e) => setKaleidoscopeEnabled(checked(e))}
				/>
				Modalità caleidoscopio
			</label>

			{#each KALEIDO_PARAMS as param (param.id)}
				<AnimatableSlider {param} {animatable} />
			{/each}

			<label class="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					aria-label="Maschera circolare"
					checked={kaleidoscope.circularMask}
					onchange={(e) => setCircularMask(checked(e))}
				/>
				Maschera circolare
			</label>

			<label class="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					aria-label="Tessera viva"
					checked={kaleidoscope.liveTile}
					onchange={(e) => setLiveTile(checked(e))}
				/>
				Tessera viva (audio)
			</label>

			{#if !kaleidoscope.liveTile}
				<Button variant="outline" class="w-full" onclick={() => requestTileRefresh()}>
					Aggiorna istantanea
				</Button>
			{/if}

			<label class="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					aria-label="Sfondo tessera"
					checked={kaleidoscope.tileBackground}
					onchange={(e) => setTileBackground(checked(e))}
				/>
				Sfondo tessera
			</label>

			{#if !kaleidoscope.tileBackground}
				<div class="flex items-center gap-2">
					<Label for="k-bg" class="text-xs">Sfondo caleidoscopio</Label>
					<input
						id="k-bg"
						aria-label="Sfondo caleidoscopio"
						type="color"
						value={kaleidoscope.backgroundColor}
						oninput={(e) => setKaleidoscopeBackgroundColor((e.target as HTMLInputElement).value)}
					/>
				</div>
			{/if}
		</div>
	{/snippet}
</SidebarCollapsible>
