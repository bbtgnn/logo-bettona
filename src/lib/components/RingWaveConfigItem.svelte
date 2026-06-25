<script lang="ts">
	import { updateRing } from '$lib/state/composition';
	import { resolveWaveConfig } from '$lib/geometry/wave';
	import { m } from '$lib/paraglide/messages';
	import WavePreview from './WavePreview.svelte';
	import RingOverrideConfigItem from './RingOverrideConfigItem.svelte';
	import type { Ring, WaveConfig } from '$lib/types';

	let {
		ring,
		index,
		globalDefault
	}: {
		ring: Ring;
		index: number;
		globalDefault: WaveConfig;
	} = $props();

	const hasOverride = $derived(ring.waveConfig != null);
	const resolved = $derived(resolveWaveConfig(ring, globalDefault));

	function setOverride(enabled: boolean) {
		updateRing(index, { waveConfig: enabled ? { ...globalDefault } : null });
	}

	const sliders = $derived(
		hasOverride
			? [
					{
						id: `ring-crests-${index}`,
						label: m.animate_wave_crests(),
						min: 1,
						max: 8,
						step: 1,
						value: ring.waveConfig!.crests,
						oninput: (v: number) =>
							updateRing(index, { waveConfig: { ...ring.waveConfig!, crests: v } })
					},
					{
						id: `ring-amplitude-${index}`,
						label: m.animate_amplitude_gain(),
						min: 0,
						max: 1,
						step: 0.01,
						value: ring.waveConfig!.amplitudeGain,
						oninput: (v: number) =>
							updateRing(index, { waveConfig: { ...ring.waveConfig!, amplitudeGain: v } })
					},
					{
						id: `ring-phase-speed-${index}`,
						label: m.animate_phase_speed(),
						min: 0,
						max: 6,
						step: 0.1,
						value: ring.waveConfig!.phaseSpeed,
						oninput: (v: number) =>
							updateRing(index, { waveConfig: { ...ring.waveConfig!, phaseSpeed: v } })
					}
				]
			: []
	);
</script>

<RingOverrideConfigItem
	{index}
	{hasOverride}
	onToggle={setOverride}
	overrideId="wave-override-{index}"
	customizeLabel={m.animate_customize_wave()}
	{sliders}
>
	{#snippet preview()}
		<WavePreview
			template={ring.templatePath ?? null}
			copies={ring.copies ?? 1}
			ringHeight={ring.ringHeight ?? 0.4}
			crests={resolved.crests}
			amplitude={resolved.amplitudeGain}
			phaseSpeed={resolved.phaseSpeed}
		/>
	{/snippet}
</RingOverrideConfigItem>
