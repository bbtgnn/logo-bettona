<script lang="ts">
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import {
		animationState,
		setLayerEnabled,
		setAudioSource,
		audioSource,
		getAudioZonesParams
	} from '$lib/state/animation';
	import { m } from '$lib/paraglide/messages';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import AudioFilePanel from './AudioFilePanel.svelte';
	import AnimatableSlider from './AnimatableSlider.svelte';
	import RingZoneConfigItem from './RingZoneConfigItem.svelte';
	import { composition } from '$lib/state/composition';

	const zonesParams = getAudioZonesParams();

	const showInputLevel = $derived(
		animationState.layers.audioZones && animationState.audioSource === 'mic'
	);

	let inputLevel = $state(0);
	$effect(() => {
		if (!showInputLevel) {
			inputLevel = 0;
			return;
		}
		let raf = requestAnimationFrame(function loop() {
			inputLevel = audioSource.readLevel();
			raf = requestAnimationFrame(loop);
		});
		return () => cancelAnimationFrame(raf);
	});
	const inputLevelPercent = $derived(Math.round(Math.max(0, Math.min(1, inputLevel)) * 100));
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{m.animate_layer_audio_zones()}
	{/snippet}

	{#snippet content()}
		<div class="space-y-3">
			<label class="flex items-center gap-2 text-xs font-medium">
				<input
					type="checkbox"
					data-testid="layer-toggle-audioZones"
					aria-label={m.animate_layer_toggle()}
					checked={animationState.layers.audioZones}
					onchange={(e) => setLayerEnabled('audioZones', (e.target as HTMLInputElement).checked)}
				/>
				{m.animate_layer_audio_zones()}
			</label>

			<div class="flex flex-col gap-2 rounded border border-border p-2">
				<div class="flex flex-col gap-1">
					<Label for="audio-source-zones" class="text-xs">{m.animate_audio_source()}</Label>
					<select
						id="audio-source-zones"
						class="h-9 w-full rounded-md border border-input bg-background py-1 text-xs"
						value={animationState.audioSource}
						onchange={(e) =>
							setAudioSource((e.target as HTMLSelectElement).value as 'demo' | 'mic' | 'file' | 'off')}
					>
						<option value="demo">{m.animate_source_demo()}</option>
						<option value="mic">{m.animate_source_microphone()}</option>
						<option value="file">{m.animate_source_file()}</option>
					</select>
				</div>

				{#if showInputLevel}
					<div class="flex flex-col gap-1">
						<Label class="text-xs">{m.animate_input_level()}</Label>
						<div
							class="h-1.5 rounded bg-muted"
							role="meter"
							aria-label={m.animate_input_level_aria()}
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={inputLevelPercent}
						>
							<div class="h-full rounded bg-green-500" style:width={`${inputLevelPercent}%`}></div>
						</div>
						<p class="text-[10px] text-muted-foreground">{m.animate_input_hint_zones()}</p>
					</div>
				{/if}

				{#if animationState.audioSource === 'mic'}
					<p class="text-[10px] text-muted-foreground">{m.animate_mic_listening()}</p>
				{/if}

				{#if animationState.audioSource === 'file'}
					<AudioFilePanel />
				{/if}

				<div class="flex flex-col gap-2">
					<p class="text-[11px] font-medium text-muted-foreground">
						{m.animate_intensity_per_band()}
					</p>
					{#each zonesParams as param (param.id)}
						<AnimatableSlider {param} />
					{/each}
				</div>

				<div class="flex flex-col gap-1">
					<p class="text-[11px] font-medium text-muted-foreground">
						{m.animate_zones_per_ring()}
					</p>
					{#each composition.rings as ring, i (ring.id)}
						<RingZoneConfigItem
							{ring}
							index={i}
							globalDefault={animationState.audioZones.defaultIntensity}
						/>
					{/each}
				</div>
			</div>
		</div>
	{/snippet}
</SidebarCollapsible>
