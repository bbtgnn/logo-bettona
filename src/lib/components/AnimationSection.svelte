<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Input } from '$lib/shadcn/ui/input/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import {
		animationState,
		handleCompositionChanged,
		setAnimationAlternate,
		setAnimationDurationSec,
		setAnimationLoop,
		togglePlay
	} from '$lib/state/animation';
	import { composition } from '$lib/state/composition';
	import SidebarCollapsible from './SidebarCollapsible.svelte';

	const progressPercent = $derived(
		Math.round(Math.max(0, Math.min(1, animationState.progress)) * 100)
	);
const hasMorphRings = $derived(
	composition.rings.some((ring) => ring.secondaryTemplatePath !== null)
);

	$effect(() => {
		composition.rings.length;
		untrack(handleCompositionChanged);
	});
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		Animation
	{/snippet}

	{#snippet content()}
		<div class="space-y-3">
			{#if !hasMorphRings}
				<p
					class="rounded border border-yellow-300 bg-yellow-100 px-2 py-1 text-[11px] text-yellow-900"
				>
					Animation won’t run until at least one ring has a secondary path.
				</p>
			{/if}

			<div class="flex items-end gap-2">
				<div class="flex flex-1 flex-col gap-1">
					<Label for="animation-duration" class="text-xs">Duration (s)</Label>
					<Input
						id="animation-duration"
						type="number"
						min="0.1"
						step="0.1"
						value={animationState.durationSec}
						oninput={(e) => setAnimationDurationSec(Number((e.target as HTMLInputElement).value))}
					/>
				</div>
				<Button onclick={togglePlay} aria-pressed={animationState.isPlaying} disabled={!hasMorphRings}
					>{animationState.isPlaying ? 'Pause' : 'Play'}</Button
				>
			</div>

			<div class="flex items-center gap-4">
				<label class="flex items-center gap-2 text-xs" for="animation-loop">
					<input
						id="animation-loop"
						type="checkbox"
						checked={animationState.loop}
						onchange={(e) => setAnimationLoop((e.target as HTMLInputElement).checked)}
					/>
					Loop
				</label>
				<label class="flex items-center gap-2 text-xs" for="animation-alternate">
					<input
						id="animation-alternate"
						type="checkbox"
						checked={animationState.alternate}
						onchange={(e) => setAnimationAlternate((e.target as HTMLInputElement).checked)}
					/>
					Alternate
				</label>
			</div>

			<div class="space-y-1">
				<div
					class="h-1.5 rounded bg-muted"
					role="progressbar"
					aria-label="Animation progress"
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow={progressPercent}
				>
					<div
						class="h-full rounded bg-foreground transition-all"
						style:width={`${progressPercent}%`}
					></div>
				</div>
				<p class="text-[10px] text-muted-foreground">{progressPercent}%</p>
			</div>
		</div>
	{/snippet}
</SidebarCollapsible>
