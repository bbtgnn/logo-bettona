<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { Input } from '$lib/shadcn/ui/input/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import {
		animationState,
		handleCompositionChanged,
		setAnimationMode,
		setAnimationDurationSec,
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

			<div class="flex flex-col gap-1">
				<Label for="animation-mode" class="text-xs">Animation mode</Label>
				<select
					id="animation-mode"
					class="h-9 rounded-md border border-input bg-background px-3 text-xs"
					value={animationState.mode ?? ''}
					onchange={(e) => {
						const mode = (e.target as HTMLSelectElement).value;
						setAnimationMode(mode === '' ? null : (mode as 'audioBars' | 'dataSeries'));
					}}
				>
					<option value="">None</option>
					<option value="audioBars">Audio Bars</option>
					<option value="dataSeries">Data Series</option>
				</select>
				{#if animationState.mode === 'dataSeries'}
					<p class="text-[11px] text-muted-foreground">
						Data Series mode maps each ring to your configured series values.
					</p>
				{:else if animationState.mode === 'audioBars'}
					<p class="text-[11px] text-muted-foreground">
						Audio Bars mode reacts to live frequency bands for each ring.
					</p>
				{/if}
			</div>

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
