<script lang="ts">
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import type { Snippet } from 'svelte';
	import RingConfigShell from './RingConfigShell.svelte';

	type SliderSpec = {
		id: string;
		label: string;
		min: number;
		max: number;
		step: number;
		value: number;
		oninput: (value: number) => void;
	};

	let {
		index,
		hasOverride,
		onToggle,
		overrideId,
		customizeLabel,
		sliders,
		testid,
		preview
	}: {
		index: number;
		hasOverride: boolean;
		onToggle: (enabled: boolean) => void;
		overrideId: string;
		customizeLabel: string;
		sliders: SliderSpec[];
		testid?: string;
		preview: Snippet;
	} = $props();
</script>

<RingConfigShell {index} {testid} badge={hasOverride}>
	{#snippet content()}
		{@render preview()}

		<div class="flex items-center gap-2">
			<input
				id={overrideId}
				type="checkbox"
				checked={hasOverride}
				onchange={(e) => onToggle((e.target as HTMLInputElement).checked)}
				class="h-4 w-4 cursor-pointer rounded border-input"
			/>
			<Label for={overrideId} class="cursor-pointer text-xs">{customizeLabel}</Label>
		</div>

		{#if hasOverride}
			{#each sliders as slider (slider.id)}
				<div class="flex flex-col gap-1">
					<Label for={slider.id} class="text-xs">{slider.label}</Label>
					<input
						id={slider.id}
						type="range"
						min={slider.min}
						max={slider.max}
						step={slider.step}
						value={slider.value}
						oninput={(e) => slider.oninput(Number((e.target as HTMLInputElement).value))}
					/>
				</div>
			{/each}
		{/if}
	{/snippet}
</RingConfigShell>
