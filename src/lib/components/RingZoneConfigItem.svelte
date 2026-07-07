<script lang="ts">
	import { composition, updateRing } from '$lib/state/composition';
	import { resolveZoneIntensity } from '$lib/geometry/zones';
	import { m } from '$lib/paraglide/messages';
	import ZonePreview from './ZonePreview.svelte';
	import RingOverrideConfigItem from './RingOverrideConfigItem.svelte';
	import type { Ring, ZoneIntensity } from '$lib/types';

	let {
		ring,
		index,
		globalDefault
	}: {
		ring: Ring;
		index: number;
		globalDefault: ZoneIntensity;
	} = $props();

	const hasOverride = $derived(ring.zoneConfig != null);
	const resolved = $derived(resolveZoneIntensity(ring, globalDefault));

	function setOverride(enabled: boolean) {
		updateRing(index, { zoneConfig: enabled ? { ...globalDefault } : null });
	}

	const sliders = $derived(
		hasOverride
			? [
					{
						id: `ring-bass-${index}`,
						label: m.animate_ring_zone_bass(),
						min: 0,
						max: 1,
						step: 0.01,
						value: ring.zoneConfig!.bass,
						oninput: (v: number) =>
							updateRing(index, { zoneConfig: { ...ring.zoneConfig!, bass: v } })
					},
					{
						id: `ring-mid-${index}`,
						label: m.animate_ring_zone_mid(),
						min: 0,
						max: 1,
						step: 0.01,
						value: ring.zoneConfig!.mid,
						oninput: (v: number) =>
							updateRing(index, { zoneConfig: { ...ring.zoneConfig!, mid: v } })
					},
					{
						id: `ring-treble-${index}`,
						label: m.animate_ring_zone_treble(),
						min: 0,
						max: 1,
						step: 0.01,
						value: ring.zoneConfig!.treble,
						oninput: (v: number) =>
							updateRing(index, { zoneConfig: { ...ring.zoneConfig!, treble: v } })
					}
				]
			: []
	);
</script>

<RingOverrideConfigItem
	{index}
	{hasOverride}
	onToggle={setOverride}
	overrideId="zone-override-{index}"
	customizeLabel={m.animate_customize_zones()}
	testid="ring-zone-config-{index}"
	{sliders}
>
	{#snippet preview()}
		<ZonePreview
			template={ring.templatePath ?? null}
			copies={composition.copies}
			ringHeight={ring.ringHeight ?? 0.4}
			intensity={resolved}
		/>
	{/snippet}
</RingOverrideConfigItem>
