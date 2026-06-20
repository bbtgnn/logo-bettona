import { composition, setRingMorphT, setRingWave, setRingZoneDrive } from './composition';
import { createAudioBarsDriver } from './animation-drivers/audio-bars-driver';
import { createAudioZonesDriver } from './animation-drivers/audio-zones-driver';
import { createDataSeriesDriver } from './animation-drivers/data-series-driver';
import { createSimpleDriver } from './animation-drivers/simple-driver';
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

export type AnimationMode = AnimationDriverType | null;

export type AnimationState = {
	mode: AnimationMode;
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
	mode: 'simple',
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
	'simple',
	createSimpleDriver({
		getRingCount: () => composition.rings.length,
		getDurationSec: () => animationState.durationSec,
		getLoop: () => animationState.loop
	})
);

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

function stopInternal(resetProgress = true) {
	audioSource.stop();
	cleanupCurrentAnimation();
	runtime.setMode(null);
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

function hasRunnableMode(): boolean {
	return animationState.mode !== null;
}

function hasMorphTargets(): boolean {
	animatedIndices = getMorphRingIndices();
	lastRingCount = composition.rings.length;
	return animatedIndices.length > 0;
}

function hasEnabledKeyframeTracks(): boolean {
	return keyframes.hasEnabledTracks();
}

/**
 * Applies every armed kaleidoscope keyframe track at the given normalized progress.
 * Each registry param samples its track; a disabled/empty track returns null and leaves
 * the static slider value in place. Discrete params (sectors/repeat) are rounded/clamped
 * by their setters.
 */
export function applyKaleidoscopeKeyframes(progress: number): void {
	for (const p of KALEIDO_PARAMS) {
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
	applyKaleidoscopeKeyframes(animationState.progress);
}

/**
 * Re-drive the kaleidoscope preview from the current playhead after a keyframe edit.
 * No-op while playing — tick() already applies every frame. Owns the "only when paused"
 * rule so the keyframe-editing UI never has to repeat it.
 */
export function refreshPreview(): void {
	if (animationState.isPlaying) return;
	applyKaleidoscopeKeyframes(animationState.progress);
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
	if (animationState.mode === 'audioBars' || animationState.mode === 'audioZones') return false;
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

	if (hasRunnableMode()) {
		runtime.tick(logicalElapsedMs);
		animationState.progress = progress;
	} else {
		applyMorphT(progress);
		animationState.progress = progress;
	}

	// Kaleidoscope keyframes ride the same clock regardless of driver mode.
	applyKaleidoscopeKeyframes(progress);

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
	if (!hasRunnableMode() && !hasMorphTargets() && !hasEnabledKeyframeTracks()) {
		stopInternal(true);
		return;
	}
	animationState.progress = 0;
	lastTickNowMs = null;
	logicalElapsedMs = 0;
	animationState.elapsedMs = 0;
	if (animationState.mode) {
		runtime.setMode(animationState.mode);
	}
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

export function setAnimationMode(mode: AnimationMode): void {
	if (animationState.mode === mode) return;
	if (animationState.mode === 'audioBars' || animationState.mode === 'audioZones') {
		audioSource.stop();
	}
	logicalElapsedMs = 0;
	animationState.elapsedMs = 0;
	animationState.mode = mode;
	if (animationState.isPlaying) {
		runtime.setMode(mode);
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

	if (!hasRunnableMode() && !hasMorphTargets() && !hasEnabledKeyframeTracks()) {
		stopInternal(true);
		return;
	}
	if (animationState.mode) {
		runtime.setMode(animationState.mode);
	}
	animationState.isPlaying = true;
	animationState.isPaused = false;
	frameRequestId = requestAnimationFrame(tick);
}

export function stopAnimation(resetProgress = true) {
	stopInternal(resetProgress);
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

	// Driver modes own their per-ring frame output semantics:
	// topology updates should be absorbed without forcing a playback reset.
	if (animationState.mode) {
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