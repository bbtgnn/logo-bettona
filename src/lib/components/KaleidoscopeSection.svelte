<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import AnimatableSlider from './AnimatableSlider.svelte';
	import {
		kaleidoscope,
		setKaleidoscopeEnabled,
		setCircularMask,
		setLiveTile,
		setTileBackground,
		requestTileRefresh
	} from '$lib/state/kaleidoscope.svelte';
	import { KALEIDO_PARAMS } from '$lib/state/kaleidoscope-params';
	import { animationState, setLayerEnabled } from '$lib/state/animation';
	import { m } from '$lib/paraglide/messages';

	// animatable=false → static sliders (no stopwatch), for the Editor where the
	// kaleidoscope look is modelled but not keyframed. Animate uses the default.
	let { animatable = true }: { animatable?: boolean } = $props();

	const checked = (e: Event) => (e.target as HTMLInputElement).checked;
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{m.editor_kaleidoscope()}
	{/snippet}

	{#snippet content()}
		<div class="flex flex-col gap-3">
			<label class="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					aria-label={m.editor_kaleido_mode()}
					checked={kaleidoscope.enabled}
					onchange={(e) => setKaleidoscopeEnabled(checked(e))}
				/>
				{m.editor_kaleido_mode()}
			</label>

			{#if animatable}
				<label class="flex items-center gap-2 text-xs">
					<input
						type="checkbox"
						data-testid="layer-toggle-kaleidoscope"
						aria-label={m.animate_kaleidoscope_layer_toggle()}
						checked={animationState.layers.kaleidoscope}
						onchange={(e) =>
							setLayerEnabled('kaleidoscope', (e.target as HTMLInputElement).checked)}
					/>
					{m.animate_kaleidoscope_layer_toggle()}
				</label>
			{/if}

			{#each KALEIDO_PARAMS as param (param.id)}
				<AnimatableSlider {param} {animatable} />
			{/each}

			<label class="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					aria-label={m.editor_kaleido_circular_mask()}
					checked={kaleidoscope.circularMask}
					onchange={(e) => setCircularMask(checked(e))}
				/>
				{m.editor_kaleido_circular_mask()}
			</label>

			<label class="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					aria-label={m.editor_kaleido_live_tile()}
					checked={kaleidoscope.liveTile}
					onchange={(e) => setLiveTile(checked(e))}
				/>
				{m.editor_kaleido_live_tile_audio()}
			</label>

			{#if !kaleidoscope.liveTile}
				<Button variant="outline" class="w-full" onclick={() => requestTileRefresh()}>
					{m.editor_kaleido_refresh_snapshot()}
				</Button>
			{/if}

			<label class="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					aria-label={m.editor_kaleido_tile_background()}
					checked={kaleidoscope.tileBackground}
					onchange={(e) => setTileBackground(checked(e))}
				/>
				{m.editor_kaleido_tile_background()}
			</label>
		</div>
	{/snippet}
</SidebarCollapsible>
