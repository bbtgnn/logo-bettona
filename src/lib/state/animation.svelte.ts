import {
	composition,
	createRingMorphTarget,
	removeRingMorphTarget,
	removeRing as removeRingFromComposition,
	setRingMorphT,
	setRingWave,
	setRingZoneDrive,
	updateRing
} from './composition';
import { createAudioBarsDriver } from './animation-drivers/audio-bars-driver';
import { createAudioZonesDriver } from './animation-drivers/audio-zones-driver';
import { createDataSeriesDriver } from './animation-drivers/data-series-driver';
import { createAnimationRuntime } from './animation-drivers/runtime';
import { createFallbackBars } from './animation-drivers/fallback-bars';
import { createAudioSource } from './animation-drivers/audio-source';
import { demoZones } from './animation-drivers/demo-zones';
import type {
	AnimationDriverType,
	AudioBarsConfig,
	DataSeriesConfig
} from './animation-drivers/types';
import type { AudioZonesConfig, ZoneIntensity } from '$lib/types';
import { keyframes } from './keyframes.svelte';
import { KALEIDO_PARAMS } from './kaleidoscope-params';
import {
	buildAudioBarsParams,
	buildAudioZonesParams,
	buildRingWaveParams,
	buildRingMorphParams,
	type AnimatableParam
} from './animatable-params';
import { m } from '$lib/paraglide/messages';

export type AnimationLayer = 'audioBars' | 'audioZones' | 'dataSeries' | 'kaleidoscope';
export type AnimationLayers = Record<AnimationLayer, boolean>;

const AUDIO_LAYERS: AnimationLayer[] = ['audioBars', 'audioZones'];

export type AnimationState = {
	layers: AnimationLayers;
	isPlaying: boolean;
	isPaused: boolean;
	progress: number;
	audioBars: AudioBarsConfig;
	audioZones: AudioZonesConfig;
	audioSource: 'demo' | 'mic' | 'file' | 'off';
	dataSeries: DataSeriesConfig;
	durationSec: number;
	fps: number;
	loop: boolean;
	alternate: boolean;
	elapsedMs: number;
};

const defaultAudioBarsConfig: AudioBarsConfig = {
	smoothing: 0.5,
	minHz: 20,
	maxHz: 20000,
	waveCrests: 3,
	waveAmplitudeGain: 0.3,
	wavePhaseSpeed: 2.2,
	inputGain: 1
};

const defaultAudioZonesConfig: AudioZonesConfig = {
	defaultIntensity: { bass: 0.5, mid: 0.5, treble: 0.5 }
};

const defaultDataSeriesConfig: DataSeriesConfig = {
	seriesByRingIndex: {},
	speed: 1,
	loop: false
};

export const animationState = $state<AnimationState>({
	layers: { audioBars: false, audioZones: false, dataSeries: false, kaleidoscope: true },
	isPlaying: false,
	isPaused: false,
	progress: 0,
	audioBars: defaultAudioBarsConfig,
	audioZones: defaultAudioZonesConfig,
	audioSource: 'demo',
	dataSeries: defaultDataSeriesConfig,
	durationSec: 3,
	fps: 30,
	loop: false,
	alternate: false,
	elapsedMs: 0
});

let lastRingCount = 0;
let animatedIndices: number[] = [];
let frameRequestId: number | null = null;
let lastTickNowMs: number | null = null;
let logicalElapsedMs = 0;

const runtime = createAnimationRuntime({
	applyRingT: (index, t) => setRingMorphT(index, t)
});

const fallbackBars = createFallbackBars({
	getRingCount: () => composition.rings.length
});

const audioSource = createAudioSource({
	getRingCount: () => composition.rings.length,
	getConfig: () => animationState.audioBars
});

runtime.registerDriver(
	'audioBars',
	createAudioBarsDriver({
		getConfig: () => animationState.audioBars,
		getRingCount: () => composition.rings.length,
		getRing: (index) => composition.rings[index],
		readBars: () => {
			switch (animationState.audioSource) {
				case 'demo':
					return fallbackBars.readBars();
				case 'mic':
				case 'file':
					return audioSource.readBars();
				default:
					return []; // 'off' → logo at rest
			}
		},
		applyRingWave: (index, wave) => setRingWave(index, wave)
	})
);

runtime.registerDriver(
	'audioZones',
	createAudioZonesDriver({
		getDefaultIntensity: () => animationState.audioZones.defaultIntensity,
		getRingCount: () => composition.rings.length,
		getRing: (index) => composition.rings[index],
		readZones: () => {
			switch (animationState.audioSource) {
				case 'demo':
					return demoZones(performance.now());
				case 'mic':
				case 'file':
					return audioSource.readZones();
				default:
					return { bass: 0, mid: 0, treble: 0 };
			}
		},
		applyRingZoneDrive: (index, drive) => setRingZoneDrive(index, drive)
	})
);

runtime.registerDriver(
	'dataSeries',
	createDataSeriesDriver({
		getConfig: () => animationState.dataSeries
	})
);

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function getMorphRingIndices(): number[] {
	return composition.rings
		.map((ring, index) => (ring.secondaryTemplatePath ? index : -1))
		.filter((index) => index >= 0);
}

function haveSameIndices(left: number[], right: number[]): boolean {
	return left.length === right.length && left.every((index, offset) => index === right[offset]);
}

function applyMorphT(t: number) {
	for (const index of animatedIndices) {
		setRingMorphT(index, t);
	}
}

function cleanupCurrentAnimation() {
	if (frameRequestId !== null) {
		cancelAnimationFrame(frameRequestId);
		frameRequestId = null;
	}
}

// Mirror the runtime's active set onto the current layer flags. dataSeries is a
// placeholder (never runs); kaleidoscope is gated in applyKeyframes, not a driver.
function syncActiveDrivers(): void {
	runtime.setActive('audioBars', animationState.layers.audioBars);
	runtime.setActive('audioZones', animationState.layers.audioZones);
}

function stopInternal(resetProgress = true) {
	audioSource.stop();
	cleanupCurrentAnimation();
	runtime.setActive('audioBars', false);
	runtime.setActive('audioZones', false);
	if (resetProgress) {
		applyMorphT(0);
		animationState.progress = 0;
	}
	lastTickNowMs = null;
	logicalElapsedMs = 0;
	animationState.elapsedMs = 0;
	animationState.isPlaying = false;
	animationState.isPaused = false;
}

// Refresh the morph-ring bookkeeping (animatedIndices/lastRingCount) so a later
// stop zeroes the rings that were actually morphing.
function hasMorphTargets(): boolean {
	animatedIndices = getMorphRingIndices();
	lastRingCount = composition.rings.length;
	return animatedIndices.length > 0;
}

// Audio registries. Labels are getter objects so each param's `label` resolves the
// current locale lazily (the {#key currentLocale()} root re-render re-reads them on
// a language switch), mirroring KALEIDO_PARAMS.
const AUDIO_BARS_PARAMS = buildAudioBarsParams({
	getConfig: () => animationState.audioBars,
	setConfig: setAudioBarsConfig,
	labels: {
		get inputGain() {
			return m.animate_input_gain();
		},
		get waveCrests() {
			return m.animate_wave_crests();
		},
		get waveAmplitudeGain() {
			return m.animate_amplitude_gain();
		},
		get wavePhaseSpeed() {
			return m.animate_phase_speed();
		},
		get smoothing() {
			return m.animate_smoothing();
		}
	}
});

const AUDIO_ZONES_PARAMS = buildAudioZonesParams({
	getIntensity: () => animationState.audioZones.defaultIntensity,
	setIntensity: setAudioZonesDefaultIntensity,
	labels: {
		get bass() {
			return m.animate_zone_bass();
		},
		get mid() {
			return m.animate_zone_mid();
		},
		get treble() {
			return m.animate_zone_treble();
		}
	}
});

// The static audio registries, surfaced for the section UIs so each slider can carry
// a ⏱ stopwatch via AnimatableSlider (same param objects the apply-loop walks).
export function getAudioBarsParams(): AnimatableParam[] {
	return AUDIO_BARS_PARAMS;
}
export function getAudioZonesParams(): AnimatableParam[] {
	return AUDIO_ZONES_PARAMS;
}

/**
 * Every keyframable param across all registries, resolved against live state.
 * Per-ring wave params are rebuilt each call from `composition.rings` so they
 * track ring add/remove without stale indices.
 */
export function getAllAnimatableParams(): AnimatableParam[] {
	const globalDefault = {
		crests: animationState.audioBars.waveCrests,
		amplitudeGain: animationState.audioBars.waveAmplitudeGain,
		phaseSpeed: animationState.audioBars.wavePhaseSpeed
	};
	return [
		...KALEIDO_PARAMS,
		...AUDIO_BARS_PARAMS,
		...AUDIO_ZONES_PARAMS,
		...buildRingWaveParams(composition.rings, {
			updateRing,
			globalDefault: () => globalDefault,
			ringLabel: (i) => m.editor_ring_label({ index: i + 1 })
		}),
		...buildRingMorphParams(composition.rings, {
			setMorphT: setRingMorphT,
			ringLabel: (i) => m.editor_ring_label({ index: i + 1 })
		})
	];
}

/**
 * Applies every armed keyframe track at the given normalized progress. Walks every
 * registry (kaleidoscope + audio + per-ring wave). A disabled/empty track returns
 * null and leaves the static slider value in place. Discrete params (sectors/repeat)
 * are rounded/clamped by their setters.
 */
export function applyKeyframes(progress: number): void {
	const kaleidoOn = animationState.layers.kaleidoscope;
	for (const p of getAllAnimatableParams()) {
		if (!kaleidoOn && p.id.startsWith('kaleidoscope.')) continue;
		const v = keyframes.sampleParam(p.id, progress);
		if (v !== null) p.set(v);
	}
}

/**
 * Move the playhead to a normalized position and drive the preview to it. This is the
 * scrubbing entry point; tick() does the same continuously while playing.
 */
export function scrubTo(progress: number): void {
	animationState.progress = clamp01(progress);
	applyKeyframes(animationState.progress);
}

/**
 * Re-drive the kaleidoscope preview from the current playhead after a keyframe edit.
 * No-op while playing — tick() already applies every frame. Owns the "only when paused"
 * rule so the keyframe-editing UI never has to repeat it.
 */
export function refreshPreview(): void {
	if (animationState.isPlaying) return;
	applyKeyframes(animationState.progress);
}

function getProgressFromElapsed(elapsedMs: number): number {
	const durationMs = Math.max(0.1, animationState.durationSec) * 1000;
	const cycles = Math.max(0, elapsedMs / durationMs);

	if (!animationState.alternate) {
		return animationState.loop && cycles > 0 ? cycles - Math.floor(cycles) : clamp01(cycles);
	}

	const cyclePosition = cycles % 2;
	const triangle = cyclePosition <= 1 ? cyclePosition : 2 - cyclePosition;
	return clamp01(triangle);
}

function hasCompleted(elapsedMs: number): boolean {
	if (animationState.layers.audioBars || animationState.layers.audioZones) return false;
	if (animationState.loop) return false;
	const durationMs = Math.max(0.1, animationState.durationSec) * 1000;
	const cycles = Math.max(0, elapsedMs / durationMs);
	return cycles >= (animationState.alternate ? 2 : 1);
}

function tick(nowMs: number) {
	if (!animationState.isPlaying) return;
	if (!Number.isFinite(nowMs)) {
		frameRequestId = requestAnimationFrame(tick);
		return;
	}

	if (lastTickNowMs !== null) {
		logicalElapsedMs += Math.max(0, nowMs - lastTickNowMs);
	}
	lastTickNowMs = nowMs;
	animationState.elapsedMs = logicalElapsedMs;
	const progress = getProgressFromElapsed(logicalElapsedMs);

	runtime.tick(logicalElapsedMs);
	animationState.progress = progress;

	// Keyframes ride the same clock regardless of which layers drive.
	applyKeyframes(progress);

	if (hasCompleted(logicalElapsedMs)) {
		animationState.isPlaying = false;
		animationState.isPaused = false;
		lastTickNowMs = null;
		logicalElapsedMs = 0;
		animationState.elapsedMs = 0;
		frameRequestId = null;
		return;
	}
	frameRequestId = requestAnimationFrame(tick);
}

function startNewAnimation() {
	lastRingCount = composition.rings.length;
	// Sync the morph-ring bookkeeping so a stop still zeroes the right rings.
	hasMorphTargets();
	// Play is always activatable: the timeline always runs the clock, regardless of
	// whether any layer drives or any keyframe track is armed.
	animationState.progress = 0;
	lastTickNowMs = null;
	logicalElapsedMs = 0;
	animationState.elapsedMs = 0;
	syncActiveDrivers();
	animationState.isPlaying = true;
	animationState.isPaused = false;
	frameRequestId = requestAnimationFrame(tick);
}

function reconfigureCurrentAnimation() {
	if (!animationState.isPlaying && !animationState.isPaused) return;

	const wasPlaying = animationState.isPlaying;
	const wasPaused = animationState.isPaused;

	cleanupCurrentAnimation();
	lastTickNowMs = null;

	startNewAnimation();

	if (wasPaused || !wasPlaying) {
		togglePlay();
	}
}

export function setAnimationDurationSec(value: number) {
	animationState.durationSec = Number.isFinite(value) ? Math.max(0.1, value) : 3;
	reconfigureCurrentAnimation();
}

const ALLOWED_FPS = [25, 30, 50, 60] as const;

export function setAnimationFps(value: number) {
	animationState.fps = (ALLOWED_FPS as readonly number[]).includes(value) ? value : 30;
}

export function setAnimationLoop(value: boolean) {
	animationState.loop = value;
	reconfigureCurrentAnimation();
}

export function setAnimationAlternate(value: boolean) {
	animationState.alternate = value;
	reconfigureCurrentAnimation();
}

export function setLayerEnabled(layer: AnimationLayer, on: boolean): void {
	if (animationState.layers[layer] === on) return;

	animationState.layers = { ...animationState.layers, [layer]: on };

	// Turning off the last active audio layer tears down the live audio source,
	// preserving the old single-mode teardown behaviour.
	if ((layer === 'audioBars' || layer === 'audioZones') && !on) {
		const anyAudioLeft = AUDIO_LAYERS.some((l) => animationState.layers[l]);
		if (!anyAudioLeft) audioSource.stop();
	}

	// dataSeries is a placeholder (never runs); kaleidoscope is gated in
	// applyKeyframes, not a driver. The shared clock keeps running across toggles.
	if (layer !== 'dataSeries' && layer !== 'kaleidoscope' && animationState.isPlaying) {
		runtime.setActive(layer, on);
	}
}

export function setDataSeriesConfig(next: Partial<AnimationState['dataSeries']>): void {
	animationState.dataSeries = { ...animationState.dataSeries, ...next };
}

export function setAudioBarsConfig(next: Partial<AudioBarsConfig>): void {
	animationState.audioBars = { ...animationState.audioBars, ...next };
}

export function setAudioZonesDefaultIntensity(next: Partial<ZoneIntensity>): void {
	animationState.audioZones = {
		...animationState.audioZones,
		defaultIntensity: { ...animationState.audioZones.defaultIntensity, ...next }
	};
}

export async function setAudioSource(mode: AnimationState['audioSource']): Promise<void> {
	animationState.audioSource = mode;
	try {
		if (mode === 'mic' || mode === 'file') {
			await audioSource.setMode(mode);
		} else {
			void audioSource.setMode('off');
		}
	} catch {
		// Permission denied / unsupported: fall back to the demo source so the logo keeps moving.
		animationState.audioSource = 'demo';
		void audioSource.setMode('off');
	}
}

export { audioSource };

export function togglePlay() {
	if (!animationState.isPlaying && !animationState.isPaused) {
		startNewAnimation();
		return;
	}

	if (animationState.isPlaying) {
		cleanupCurrentAnimation();
		lastTickNowMs = null;
		animationState.isPlaying = false;
		animationState.isPaused = true;
		return;
	}

	// Resume is unconditional — the clock always runs (Play is always activatable).
	syncActiveDrivers();
	animationState.isPlaying = true;
	animationState.isPaused = false;
	frameRequestId = requestAnimationFrame(tick);
}

export function stopAnimation(resetProgress = true) {
	stopInternal(resetProgress);
}

/**
 * Create a ring morph target and seed its default animation: an armed morphT track
 * easing from 0 to 1 across the timeline (bezier ease-out/ease-in via addKeyframe's
 * default handles). This is the "a morph IS keyframes" policy — composition.ts stays
 * pure geometry; the keyframe seeding lives here.
 */
export function createRingMorph(index: number): void {
	createRingMorphTarget(index);
	const ring = composition.rings[index];
	if (!ring) return;
	const id = `ring.${ring.id}.morphT`;
	keyframes.ensureTrack(id);
	keyframes.setTrackEnabled(id, true);
	keyframes.addKeyframe(id, { time: 0, value: 0, interp: 'bezier' });
	keyframes.addKeyframe(id, { time: 1, value: 1, interp: 'bezier' });
	refreshPreview();
}

export function removeRingMorph(index: number): void {
	const ring = composition.rings[index];
	removeRingMorphTarget(index);
	if (ring) keyframes.deleteTrack(`ring.${ring.id}.morphT`);
	refreshPreview();
}

/**
 * Delete a ring AND its keyframe tracks. composition.ts stays pure geometry; the
 * "tracks die with the ring" policy lives here, where keyframe state is reachable.
 * Tracks key off the stable ring id, so siblings (whose indices shift) are untouched.
 */
export function removeRing(index: number): void {
	const ring = composition.rings[index];
	removeRingFromComposition(index);
	if (ring) keyframes.deleteTracksForRing(ring.id);
	refreshPreview();
}

/**
 * Audio stream for a video export, tapped from the live source. Only real sources
 * (mic/file) yield a stream; demo/off return null (no real audio to record).
 */
export function getExportAudioStream(): { stream: MediaStream; dispose: () => void } | null {
	if (animationState.audioSource === 'mic' || animationState.audioSource === 'file') {
		return audioSource.createRecordingStream();
	}
	return null;
}

export function handleCompositionChanged() {
	const currentIndices = getMorphRingIndices();

	if (!animationState.isPlaying) {
		lastRingCount = composition.rings.length;
		animatedIndices = currentIndices;
		return;
	}

	// Active driver layers own their per-ring frame output semantics:
	// topology updates should be absorbed without forcing a playback reset.
	if (animationState.layers.audioBars || animationState.layers.audioZones) {
		lastRingCount = composition.rings.length;
		animatedIndices = currentIndices;
		return;
	}

	const hasCompositionChanged =
		composition.rings.length !== lastRingCount ||
		!haveSameIndices(currentIndices, animatedIndices);

	if (hasCompositionChanged) {
		stopInternal(true);
	}
}