<script lang="ts">
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import { kaleidoscope, setLiveTile } from '$lib/state/kaleidoscope.svelte';
	import { animationState, setLayerEnabled } from '$lib/state/animation';
	import { m } from '$lib/paraglide/messages';

	const checked = (e: Event) => (e.target as HTMLInputElement).checked;
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{m.animate_kaleidoscope_audio()}
	{/snippet}

	{#snippet content()}
		<div class="flex flex-col gap-3">
			<label class="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					data-testid="layer-toggle-kaleidoscope"
					aria-label={m.animate_kaleidoscope_layer_toggle()}
					checked={animationState.layers.kaleidoscope}
					onchange={(e) => setLayerEnabled('kaleidoscope', checked(e))}
				/>
				{m.animate_kaleidoscope_layer_toggle()}
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
		</div>
	{/snippet}
</SidebarCollapsible>
