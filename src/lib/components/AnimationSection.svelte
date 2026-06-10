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
		togglePlay,
		setAudioBarsConfig,
		setAudioSource,
		audioSource
	} from '$lib/state/animation';
	import { composition } from '$lib/state/composition';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import RingWaveConfigItem from './RingWaveConfigItem.svelte';
	import AudioFilePanel from './AudioFilePanel.svelte';
	import type { WaveConfig } from '$lib/types';

	const globalWaveDefault = $derived<WaveConfig>({
		crests: animationState.audioBars.waveCrests,
		amplitudeGain: animationState.audioBars.waveAmplitudeGain,
		phaseSpeed: animationState.audioBars.wavePhaseSpeed
	});

	const progressPercent = $derived(
		Math.round(Math.max(0, Math.min(1, animationState.progress)) * 100)
	);
	const hasMorphRings = $derived(
		composition.rings.some((ring) => ring.secondaryTemplatePath !== null)
	);
	const requiresMorphRings = $derived(animationState.mode !== 'audioBars');
	const blockPlayback = $derived(requiresMorphRings && !hasMorphRings);

	const showInputLevel = $derived(
		animationState.mode === 'audioBars' && animationState.audioSource === 'mic'
	);

	const hideGlobalTransport = $derived(
		animationState.mode === 'audioBars' && animationState.audioSource === 'file'
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

	function formatElapsed(ms: number): string {
		const totalSec = Math.floor(ms / 1000);
		const m = Math.floor(totalSec / 60);
		const s = totalSec % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	}
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		Animation
	{/snippet}

	{#snippet content()}
		<div class="space-y-3">
			{#if blockPlayback}
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
						setAnimationMode(mode === '' ? null : (mode as 'simple' | 'audioBars' | 'dataSeries'));
					}}
				>
					<option value="simple">Simple</option>
					<option value="audioBars">Audio Bars</option>
					<option value="dataSeries">Data Series</option>
					<option value="">None</option>
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

			{#if animationState.mode === 'audioBars'}
				<div class="flex flex-col gap-2 rounded border border-border p-2">
					<div class="flex flex-col gap-1">
						<Label for="audio-source" class="text-xs">Audio source</Label>
						<select
							id="audio-source"
							class="h-9 rounded-md border border-input bg-background px-3 text-xs"
							value={animationState.audioSource}
							onchange={(e) =>
								setAudioSource(
									(e.target as HTMLSelectElement).value as 'demo' | 'mic' | 'file' | 'off'
								)}
						>
							<option value="demo">Demo</option>
							<option value="mic">Microphone</option>
							<option value="file">File</option>
						</select>
					</div>

					{#if showInputLevel}
						<div class="flex flex-col gap-1">
							<Label class="text-xs">Input level</Label>
							<div
								class="h-1.5 rounded bg-muted"
								role="meter"
								aria-label="Audio input level"
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
								Source is being heard when this moves. Still flower + moving meter → raise gain.
							</p>
						</div>
					{/if}

					{#if animationState.audioSource === 'mic'}
						<p class="text-[10px] text-muted-foreground">
							Listening — speak or play near the microphone.
						</p>
					{/if}

					{#if animationState.audioSource === 'file'}
						<AudioFilePanel />
					{/if}

					<div class="flex flex-col gap-1">
						<Label for="wave-crests" class="text-xs">Wave crests</Label>
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
						<Label for="amplitude-gain" class="text-xs">Amplitude gain</Label>
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
						<Label for="phase-speed" class="text-xs">Phase speed</Label>
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
						<Label for="smoothing" class="text-xs">Smoothing</Label>
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
						<Label for="input-gain" class="text-xs">Input gain</Label>
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
						<p class="text-[11px] font-medium text-muted-foreground">Wave per ring</p>
						{#each composition.rings as ring, i (i)}
							<RingWaveConfigItem {ring} index={i} globalDefault={globalWaveDefault} />
						{/each}
					</div>
				</div>
			{/if}

			{#if !hideGlobalTransport}
				{#if animationState.mode === 'audioBars'}
					<!-- audioBars mic/demo: Play/Pause + elapsed counter (no duration, no progress bar) -->
					<div class="flex items-center gap-2">
						<Button
							onclick={togglePlay}
							aria-pressed={animationState.isPlaying}
							disabled={blockPlayback}
						>{animationState.isPlaying ? 'Pause' : 'Play'}</Button>
						<span
							class="tabular-nums text-xs text-muted-foreground"
							aria-label="Elapsed time"
						>{formatElapsed(animationState.elapsedMs)}</span>
					</div>
				{:else}
					<!-- all other modes: duration field + Play/Pause + progress bar -->
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
						<Button
							onclick={togglePlay}
							aria-pressed={animationState.isPlaying}
							disabled={blockPlayback}>{animationState.isPlaying ? 'Pause' : 'Play'}</Button
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
				{/if}
			{/if}
		</div>
	{/snippet}
</SidebarCollapsible>
