<script lang="ts">
	import * as Collapsible from '$lib/shadcn/ui/collapsible/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { CaretDown, CaretRight } from 'phosphor-svelte';
	import { updateRing } from '$lib/state/composition';
	import { resolveWaveConfig } from '$lib/geometry/wave';
	import WavePreview from './WavePreview.svelte';
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

	let open = $state(false);

	const hasOverride = $derived(ring.waveConfig != null);
	const resolved = $derived(resolveWaveConfig(ring, globalDefault));
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
			<WavePreview
				template={ring.templatePath ?? null}
				copies={ring.copies ?? 1}
				ringHeight={ring.ringHeight ?? 0.4}
				crests={resolved.crests}
				amplitude={resolved.amplitudeGain}
				phaseSpeed={resolved.phaseSpeed}
			/>

			<div class="flex items-center gap-2">
				<input
					id="wave-override-{index}"
					type="checkbox"
					checked={hasOverride}
					onchange={(e) => {
						if ((e.target as HTMLInputElement).checked) {
							updateRing(index, { waveConfig: { ...globalDefault } });
						} else {
							updateRing(index, { waveConfig: null });
						}
					}}
					class="h-4 w-4 cursor-pointer rounded border-input"
				/>
				<Label for="wave-override-{index}" class="cursor-pointer text-xs"
					>Customize wave for this ring</Label
				>
			</div>

			{#if hasOverride}
				<div class="flex flex-col gap-1">
					<Label for="ring-crests-{index}" class="text-xs">Wave crests</Label>
					<input
						id="ring-crests-{index}"
						type="range"
						min="1"
						max="8"
						step="1"
						value={ring.waveConfig!.crests}
						oninput={(e) =>
							updateRing(index, {
								waveConfig: {
									...ring.waveConfig!,
									crests: Number((e.target as HTMLInputElement).value)
								}
							})}
					/>
				</div>

				<div class="flex flex-col gap-1">
					<Label for="ring-amplitude-{index}" class="text-xs">Amplitude gain</Label>
					<input
						id="ring-amplitude-{index}"
						type="range"
						min="0"
						max="1"
						step="0.01"
						value={ring.waveConfig!.amplitudeGain}
						oninput={(e) =>
							updateRing(index, {
								waveConfig: {
									...ring.waveConfig!,
									amplitudeGain: Number((e.target as HTMLInputElement).value)
								}
							})}
					/>
				</div>

				<div class="flex flex-col gap-1">
					<Label for="ring-phase-speed-{index}" class="text-xs">Phase speed</Label>
					<input
						id="ring-phase-speed-{index}"
						type="range"
						min="0"
						max="6"
						step="0.1"
						value={ring.waveConfig!.phaseSpeed}
						oninput={(e) =>
							updateRing(index, {
								waveConfig: {
									...ring.waveConfig!,
									phaseSpeed: Number((e.target as HTMLInputElement).value)
								}
							})}
					/>
				</div>
			{/if}
		</Collapsible.CollapsibleContent>
	</Collapsible.Collapsible>
</div>
