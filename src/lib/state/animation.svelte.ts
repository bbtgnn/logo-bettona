import { composition, setRingMorphT, setRingWave } from './composition';
import { createAudioBarsDriver } from './animation-drivers/audio-bars-driver';
import { createDataSeriesDriver } from './animation-drivers/data-series-driver';
import { createSimpleDriver } from './animation-drivers/simple-driver';
import { createAnimationRuntime } from './animation-drivers/runtime';
import { createFallbackBars } from './animation-drivers/fallback-bars';
import { createAudioSource } from './animation-drivers/audio-source';
import type {
	AnimationDriverType,
	AudioBarsConfig,
	DataSeriesConfig
} from './animation-drivers/types';

export type AnimationMode = AnimationDriverType | null;

export type AnimationState = {
	mode: AnimationMode;
	isPlaying: boolean;
	isPaused: boolean;
	progress: number;
	audioBars: AudioBarsConfig;
	audioSource: 'demo' | 'mic' | 'file' | 'off';
	dataSeries: DataSeriesConfig;
	durationSec: number;
	loop: boolean;
	alternate: boolean;
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
	audioSource: 'demo',
	dataSeries: defaultDataSeriesConfig,
	durationSec: 3,
	loop: false,
	alternate: false
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
	const progress = getProgressFromElapsed(logicalElapsedMs);

	if (hasRunnableMode()) {
		runtime.tick(logicalElapsedMs);
		animationState.progress = progress;
	} else {
		applyMorphT(progress);
		animationState.progress = progress;
	}

	if (hasCompleted(logicalElapsedMs)) {
		animationState.isPlaying = false;
		animationState.isPaused = false;
		lastTickNowMs = null;
		logicalElapsedMs = 0;
		frameRequestId = null;
		return;
	}
	frameRequestId = requestAnimationFrame(tick);
}

function startNewAnimation() {
	lastRingCount = composition.rings.length;
	if (!hasRunnableMode() && !hasMorphTargets()) {
		stopInternal(true);
		return;
	}
	animationState.progress = 0;
	lastTickNowMs = null;
	logicalElapsedMs = 0;
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

export function setAnimationLoop(value: boolean) {
	animationState.loop = value;
	reconfigureCurrentAnimation();
}

export function setAnimationAlternate(value: boolean) {
	animationState.alternate = value;
	reconfigureCurrentAnimation();
}

export function setAnimationMode(mode: AnimationMode): void {
	if (animationState.mode === 'audioBars' && mode !== 'audioBars') {
		audioSource.stop();
	}
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

	if (!hasRunnableMode() && !hasMorphTargets()) {
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
