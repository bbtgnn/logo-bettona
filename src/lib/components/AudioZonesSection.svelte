<script lang="ts">
	import { animationState, getAudioZonesParams } from '$lib/state/animation';
	import { composition } from '$lib/state/composition';
	import { m } from '$lib/paraglide/messages';
	import AudioLayerSection from './AudioLayerSection.svelte';
	import RingZoneConfigItem from './RingZoneConfigItem.svelte';

	const zonesParams = getAudioZonesParams();
</script>

<AudioLayerSection
	layerKey="audioZones"
	title={m.animate_layer_audio_zones()}
	params={zonesParams}
	inputHint={m.animate_input_hint_zones()}
	paramsLabel={m.animate_intensity_per_band()}
>
	{#snippet perRing()}
		<div class="flex flex-col gap-1">
			<p class="text-[11px] font-medium text-muted-foreground">{m.animate_zones_per_ring()}</p>
			{#each composition.rings as ring, i (ring.id)}
				<RingZoneConfigItem
					{ring}
					index={i}
					globalDefault={animationState.audioZones.defaultIntensity}
				/>
			{/each}
		</div>
	{/snippet}
</AudioLayerSection>
