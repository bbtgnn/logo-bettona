<script lang="ts">
	import * as Collapsible from '$lib/shadcn/ui/collapsible/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { CaretDown, CaretRight } from 'phosphor-svelte';
	import { updateRing } from '$lib/state/composition';
	import { resolveZoneIntensity } from '$lib/geometry/zones';
	import ZonePreview from './ZonePreview.svelte';
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

	let open = $state(false);

	const hasOverride = $derived(ring.zoneConfig != null);
	const resolved = $derived(resolveZoneIntensity(ring, globalDefault));
</script>

<div class="rounded border bg-background">
	<Collapsible.Collapsible bind:open>
		<div class="flex items-center gap-1 px-2 py-1.5">
			<Collapsible.CollapsibleTrigger
				class="flex flex-1 items-center gap-1 text-left text-sm font-medium hover:text-foreground"
			>
				{#if open}
					<CaretDown size={14} />
				{:else}
					<CaretRight size={14} />
				{/if}
				Ring {index + 1}
				{#if hasOverride}
					<span
						class="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] font-normal text-muted-foreground"
						>(custom)</span
					>
				{/if}
			</Collapsible.CollapsibleTrigger>
		</div>

		<Collapsible.CollapsibleContent class="space-y-3 px-3 pb-3">
			<ZonePreview
				template={ring.templatePath ?? null}
				copies={ring.copies ?? 1}
				ringHeight={ring.ringHeight ?? 0.4}
				intensity={resolved}
			/>

			<div class="flex items-center gap-2">
				<input
					id="zone-override-{index}"
					type="checkbox"
					checked={hasOverride}
					onchange={(e) => {
						if ((e.target as HTMLInputElement).checked) {
							updateRing(index, { zoneConfig: { ...globalDefault } });
						} else {
							updateRing(index, { zoneConfig: null });
						}
					}}
					class="h-4 w-4 cursor-pointer rounded border-input"
				/>
				<Label for="zone-override-{index}" class="cursor-pointer text-xs"
					>Customize zones for this ring</Label
				>
			</div>

			{#if hasOverride}
				<div class="flex flex-col gap-1">
					<Label for="ring-bass-{index}" class="text-xs">Bass intensity</Label>
					<input
						id="ring-bass-{index}"
						type="range"
						min="0"
						max="1"
						step="0.01"
						value={ring.zoneConfig!.bass}
						oninput={(e) =>
							updateRing(index, {
								zoneConfig: {
									...ring.zoneConfig!,
									bass: Number((e.target as HTMLInputElement).value)
								}
							})}
					/>
				</div>

				<div class="flex flex-col gap-1">
					<Label for="ring-mid-{index}" class="text-xs">Mid intensity</Label>
					<input
						id="ring-mid-{index}"
						type="range"
						min="0"
						max="1"
						step="0.01"
						value={ring.zoneConfig!.mid}
						oninput={(e) =>
							updateRing(index, {
								zoneConfig: {
									...ring.zoneConfig!,
									mid: Number((e.target as HTMLInputElement).value)
								}
							})}
					/>
				</div>

				<div class="flex flex-col gap-1">
					<Label for="ring-treble-{index}" class="text-xs">Treble intensity</Label>
					<input
						id="ring-treble-{index}"
						type="range"
						min="0"
						max="1"
						step="0.01"
						value={ring.zoneConfig!.treble}
						oninput={(e) =>
							updateRing(index, {
								zoneConfig: {
									...ring.zoneConfig!,
									treble: Number((e.target as HTMLInputElement).value)
								}
							})}
					/>
				</div>
			{/if}
		</Collapsible.CollapsibleContent>
	</Collapsible.Collapsible>
</div>
