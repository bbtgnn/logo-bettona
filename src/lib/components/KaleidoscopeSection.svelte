<script lang="ts">
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import {
		kaleidoscope,
		setKaleidoscopeEnabled,
		setSectors,
		setRepeat,
		setOffsetDistance,
		setScale,
		setTileSize,
		setTileRotation,
		setCarpetRotation,
		setGlobalRotation,
		setCircularMask,
		setLiveTile,
		setTileBackground,
		setKaleidoscopeBackgroundColor,
		requestTileRefresh
	} from '$lib/state/kaleidoscope.svelte';

	const num = (e: Event) => Number((e.target as HTMLInputElement).value);
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

			<div class="flex flex-col gap-1">
				<Label for="k-sectors" class="text-xs">Settori ({kaleidoscope.sectors})</Label>
				<input
					id="k-sectors"
					aria-label="Settori"
					type="range"
					min="4"
					max="24"
					step="2"
					value={kaleidoscope.sectors}
					oninput={(e) => setSectors(num(e))}
				/>
			</div>

			<div class="flex flex-col gap-1">
				<Label for="k-repeat" class="text-xs">Ripetizioni ({kaleidoscope.repeat})</Label>
				<input
					id="k-repeat"
					aria-label="Ripetizioni"
					type="range"
					min="1"
					max="10"
					step="1"
					value={kaleidoscope.repeat}
					oninput={(e) => setRepeat(num(e))}
				/>
			</div>

			<div class="flex flex-col gap-1">
				<Label for="k-offset" class="text-xs">Distanza dal centro</Label>
				<input
					id="k-offset"
					aria-label="Distanza dal centro"
					type="range"
					min="0"
					max="1"
					step="0.01"
					value={kaleidoscope.offsetDistance}
					oninput={(e) => setOffsetDistance(num(e))}
				/>
			</div>

			<div class="flex flex-col gap-1">
				<Label for="k-scale" class="text-xs">Scala globale</Label>
				<input
					id="k-scale"
					aria-label="Scala globale"
					type="range"
					min="0.3"
					max="3"
					step="0.05"
					value={kaleidoscope.scale}
					oninput={(e) => setScale(num(e))}
				/>
			</div>

			<div class="flex flex-col gap-1">
				<Label for="k-tilesize" class="text-xs">Dimensione tessera</Label>
				<input
					id="k-tilesize"
					aria-label="Dimensione tessera"
					type="range"
					min="0.1"
					max="2"
					step="0.05"
					value={kaleidoscope.tileSize}
					oninput={(e) => setTileSize(num(e))}
				/>
			</div>

			<div class="flex flex-col gap-1">
				<Label for="k-tilerot" class="text-xs">Rotazione tessera</Label>
				<input
					id="k-tilerot"
					aria-label="Rotazione tessera"
					type="range"
					min="0"
					max="360"
					step="1"
					value={kaleidoscope.tileRotation}
					oninput={(e) => setTileRotation(num(e))}
				/>
			</div>

			<div class="flex flex-col gap-1">
				<Label for="k-carpetrot" class="text-xs">Rotazione tappeto</Label>
				<input
					id="k-carpetrot"
					aria-label="Rotazione tappeto"
					type="range"
					min="0"
					max="360"
					step="1"
					value={kaleidoscope.carpetRotation}
					oninput={(e) => setCarpetRotation(num(e))}
				/>
			</div>

			<div class="flex flex-col gap-1">
				<Label for="k-globalrot" class="text-xs">Rotazione globale</Label>
				<input
					id="k-globalrot"
					aria-label="Rotazione globale"
					type="range"
					min="0"
					max="360"
					step="1"
					value={kaleidoscope.globalRotation}
					oninput={(e) => setGlobalRotation(num(e))}
				/>
			</div>

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
