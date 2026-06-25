<script lang="ts">
	import { animationState, getAudioBarsParams } from '$lib/state/animation';
	import { composition } from '$lib/state/composition';
	import { m } from '$lib/paraglide/messages';
	import AudioLayerSection from './AudioLayerSection.svelte';
	import RingWaveConfigItem from './RingWaveConfigItem.svelte';
	import type { WaveConfig } from '$lib/types';

	const barsParams = getAudioBarsParams();

	const globalWaveDefault = $derived<WaveConfig>({
		crests: animationState.audioBars.waveCrests,
		amplitudeGain: animationState.audioBars.waveAmplitudeGain,
		phaseSpeed: animationState.audioBars.wavePhaseSpeed
	});
</script>

<AudioLayerSection
	layerKey="audioBars"
	title={m.animate_layer_audio_bars()}
	params={barsParams}
	inputHint={m.animate_input_hint_bars()}
>
	{#snippet perRing()}
		<div class="flex flex-col gap-1">
			<p class="text-[11px] font-medium text-muted-foreground">{m.animate_wave_per_ring()}</p>
			{#each composition.rings as ring, i (ring.id)}
				<RingWaveConfigItem {ring} index={i} globalDefault={globalWaveDefault} />
			{/each}
		</div>
	{/snippet}
</AudioLayerSection>
