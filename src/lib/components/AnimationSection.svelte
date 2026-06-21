<script lang="ts">
	import { untrack } from 'svelte';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import {
		animationState,
		handleCompositionChanged,
		setAnimationMode,
		setAudioBarsConfig,
		setAudioZonesDefaultIntensity,
		setAudioSource,
		audioSource
	} from '$lib/state/animation';
	import { composition } from '$lib/state/composition';
	import { m } from '$lib/paraglide/messages';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import RingWaveConfigItem from './RingWaveConfigItem.svelte';
	import AudioFilePanel from './AudioFilePanel.svelte';
	import type { WaveConfig } from '$lib/types';

	type AudioMode = 'audioBars' | 'audioZones';
	type MotionMode = 'simple' | 'dataSeries' | null;

	// Audio reactivity is a trait of the mark that rides the same clock as the
	// kaleidoscope timeline — not an animation that excludes it. The UI presents it
	// as an always-available toggle rather than one entry in an exclusive dropdown.
	// The underlying animationState.mode is still a single value, so the toggle and
	// the motion-source selector each remember their last pick to restore it.
	const audioReactive = $derived(
		animationState.mode === 'audioBars' || animationState.mode === 'audioZones'
	);
	let lastAudioMode = $state<AudioMode>(
		animationState.mode === 'audioZones' ? 'audioZones' : 'audioBars'
	);
	let lastMotionMode = $state<MotionMode>(
		animationState.mode === 'dataSeries' ? 'dataSeries' : 'simple'
	);

	function selectAudioMode(mode: AudioMode) {
		lastAudioMode = mode;
		setAnimationMode(mode);
	}

	function selectMotionMode(mode: MotionMode) {
		lastMotionMode = mode;
		setAnimationMode(mode);
	}

	function toggleAudioReactivity(on: boolean) {
		setAnimationMode(on ? lastAudioMode : lastMotionMode);
	}

	const globalWaveDefault = $derived<WaveConfig>({
		crests: animationState.audioBars.waveCrests,
		amplitudeGain: animationState.audioBars.waveAmplitudeGain,
		phaseSpeed: animationState.audioBars.wavePhaseSpeed
	});

	const hasMorphRings = $derived(
		composition.rings.some((ring) => ring.secondaryTemplatePath !== null)
	);
	const requiresMorphRings = $derived(
		animationState.mode !== 'audioBars' && animationState.mode !== 'audioZones'
	);
	const blockPlayback = $derived(requiresMorphRings && !hasMorphRings);

	const showInputLevel = $derived(
		(animationState.mode === 'audioBars' || animationState.mode === 'audioZones') &&
			animationState.audioSource === 'mic'
	);

	// Live input meter: polls the analyser's raw peak each frame while a real source
	// is selected. Separate from playback so it reads even when paused — it answers
	// "is the source heard?" independently of whether the wave is being driven.
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

	$effect(() => {
		composition.rings.length;
		untrack(handleCompositionChanged);
	});
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{m.animate_animation()}
	{/snippet}

	{#snippet content()}
		<div class="space-y-3">
			{#if blockPlayback}
				<p
					class="rounded border border-yellow-300 bg-yellow-100 px-2 py-1 text-[11px] text-yellow-900"
				>
					{m.animate_block_warning()}
				</p>
			{/if}

			<div class="flex flex-col gap-2">
				<label class="flex items-center gap-2 text-xs font-medium">
					<input
						type="checkbox"
						data-testid="audio-reactivity-toggle"
						checked={audioReactive}
						onchange={(e) => toggleAudioReactivity((e.target as HTMLInputElement).checked)}
					/>
					{m.animate_audio_reactivity()}
				</label>
				<p class="text-[11px] text-muted-foreground">
					{m.animate_audio_reactivity_hint()}
				</p>

				{#if audioReactive}
					<div class="flex flex-col gap-1">
						<Label for="audio-mode" class="text-xs">{m.animate_reactivity_type()}</Label>
						<select
							id="audio-mode"
							class="h-9 w-full rounded-md border border-input bg-background py-1 text-xs"
							value={animationState.mode}
							onchange={(e) => selectAudioMode((e.target as HTMLSelectElement).value as AudioMode)}
						>
							<option value="audioBars">{m.animate_opt_audio_bars()}</option>
							<option value="audioZones">{m.animate_opt_audio_zones()}</option>
						</select>
					</div>
				{:else}
					<div class="flex flex-col gap-1">
						<Label for="motion-source" class="text-xs">{m.animate_motion_source()}</Label>
						<select
							id="motion-source"
							class="h-9 w-full rounded-md border border-input bg-background py-1 text-xs"
							value={animationState.mode ?? ''}
							onchange={(e) => {
								const v = (e.target as HTMLSelectElement).value;
								selectMotionMode(v === '' ? null : (v as MotionMode));
							}}
						>
							<option value="simple">{m.animate_opt_simple()}</option>
							<option value="dataSeries">{m.animate_opt_data_series()}</option>
							<option value="">{m.animate_opt_none()}</option>
						</select>
						{#if animationState.mode === 'dataSeries'}
							<p class="text-[11px] text-muted-foreground">
								{m.animate_data_series_hint()}
							</p>
						{/if}
					</div>
				{/if}
			</div>

			{#if animationState.mode === 'audioBars'}
				<div class="flex flex-col gap-2 rounded border border-border p-2">
					<div class="flex flex-col gap-1">
						<Label for="audio-source" class="text-xs">{m.animate_audio_source()}</Label>
						<select
							id="audio-source"
							class="h-9 w-full rounded-md border border-input bg-background py-1 text-xs"
							value={animationState.audioSource}
							onchange={(e) =>
								setAudioSource(
									(e.target as HTMLSelectElement).value as 'demo' | 'mic' | 'file' | 'off'
								)}
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
								<div
									class="h-full rounded bg-green-500"
									style:width={`${inputLevelPercent}%`}
								></div>
							</div>
							<p class="text-[10px] text-muted-foreground">
								{m.animate_input_hint_bars()}
							</p>
						</div>
					{/if}

					{#if animationState.audioSource === 'mic'}
						<p class="text-[10px] text-muted-foreground">
							{m.animate_mic_listening()}
						</p>
					{/if}

					{#if animationState.audioSource === 'file'}
						<AudioFilePanel />
					{/if}

					<div class="flex flex-col gap-1">
						<Label for="input-gain" class="text-xs">{m.animate_input_gain()}</Label>
						<input
							id="input-gain"
							type="range"
							min="0.5"
							max="4"
							step="0.1"
							value={animationState.audioBars.inputGain}
							oninput={(e) =>
								setAudioBarsConfig({ inputGain: Number((e.target as HTMLInputElement).value) })}
						/>
					</div>

					<div class="flex flex-col gap-1">
						<Label for="wave-crests" class="text-xs">{m.animate_wave_crests()}</Label>
						<input
							id="wave-crests"
							type="range"
							min="1"
							max="8"
							step="1"
							value={animationState.audioBars.waveCrests}
							oninput={(e) =>
								setAudioBarsConfig({ waveCrests: Number((e.target as HTMLInputElement).value) })}
						/>
					</div>

					<div class="flex flex-col gap-1">
						<Label for="amplitude-gain" class="text-xs">{m.animate_amplitude_gain()}</Label>
						<input
							id="amplitude-gain"
							type="range"
							min="0"
							max="1"
							step="0.01"
							value={animationState.audioBars.waveAmplitudeGain}
							oninput={(e) =>
								setAudioBarsConfig({
									waveAmplitudeGain: Number((e.target as HTMLInputElement).value)
								})}
						/>
					</div>

					<div class="flex flex-col gap-1">
						<Label for="phase-speed" class="text-xs">{m.animate_phase_speed()}</Label>
						<input
							id="phase-speed"
							type="range"
							min="0"
							max="6"
							step="0.1"
							value={animationState.audioBars.wavePhaseSpeed}
							oninput={(e) =>
								setAudioBarsConfig({
									wavePhaseSpeed: Number((e.target as HTMLInputElement).value)
								})}
						/>
					</div>

					<div class="flex flex-col gap-1">
						<Label for="smoothing" class="text-xs">{m.animate_smoothing()}</Label>
						<input
							id="smoothing"
							type="range"
							min="0"
							max="0.95"
							step="0.05"
							value={animationState.audioBars.smoothing}
							oninput={(e) =>
								setAudioBarsConfig({ smoothing: Number((e.target as HTMLInputElement).value) })}
						/>
					</div>

					<div class="flex flex-col gap-1">
						<p class="text-[11px] font-medium text-muted-foreground">{m.animate_wave_per_ring()}</p>
						{#each composition.rings as ring, i (i)}
							<RingWaveConfigItem {ring} index={i} globalDefault={globalWaveDefault} />
						{/each}
					</div>
				</div>
			{/if}

			{#if animationState.mode === 'audioZones'}
				<div class="flex flex-col gap-2 rounded border border-border p-2">
					<div class="flex flex-col gap-1">
						<Label for="audio-source-zones" class="text-xs">{m.animate_audio_source()}</Label>
						<select
							id="audio-source-zones"
							class="h-9 w-full rounded-md border border-input bg-background py-1 text-xs"
							value={animationState.audioSource}
							onchange={(e) =>
								setAudioSource(
									(e.target as HTMLSelectElement).value as 'demo' | 'mic' | 'file' | 'off'
								)}
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
								<div
									class="h-full rounded bg-green-500"
									style:width={`${inputLevelPercent}%`}
								></div>
							</div>
							<p class="text-[10px] text-muted-foreground">
								{m.animate_input_hint_zones()}
							</p>
						</div>
					{/if}

					{#if animationState.audioSource === 'mic'}
						<p class="text-[10px] text-muted-foreground">
							{m.animate_mic_listening()}
						</p>
					{/if}

					{#if animationState.audioSource === 'file'}
						<AudioFilePanel />
					{/if}

					<div class="flex flex-col gap-2">
						<p class="text-[11px] font-medium text-muted-foreground">
							{m.animate_intensity_per_band()}
						</p>
						<div class="flex flex-col gap-1">
							<Label for="zones-bass" class="text-xs">{m.animate_zone_bass()}</Label>
							<input
								id="zones-bass"
								type="range"
								min="0"
								max="1"
								step="0.01"
								value={animationState.audioZones.defaultIntensity.bass}
								oninput={(e) =>
									setAudioZonesDefaultIntensity({
										bass: Number((e.target as HTMLInputElement).value)
									})}
							/>
						</div>
						<div class="flex flex-col gap-1">
							<Label for="zones-mid" class="text-xs">{m.animate_zone_mid()}</Label>
							<input
								id="zones-mid"
								type="range"
								min="0"
								max="1"
								step="0.01"
								value={animationState.audioZones.defaultIntensity.mid}
								oninput={(e) =>
									setAudioZonesDefaultIntensity({
										mid: Number((e.target as HTMLInputElement).value)
									})}
							/>
						</div>
						<div class="flex flex-col gap-1">
							<Label for="zones-treble" class="text-xs">{m.animate_zone_treble()}</Label>
							<input
								id="zones-treble"
								type="range"
								min="0"
								max="1"
								step="0.01"
								value={animationState.audioZones.defaultIntensity.treble}
								oninput={(e) =>
									setAudioZonesDefaultIntensity({
										treble: Number((e.target as HTMLInputElement).value)
									})}
							/>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/snippet}
</SidebarCollapsible>
