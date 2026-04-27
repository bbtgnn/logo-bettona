import { composition, setRingMorphT } from './composition';
import { createAudioBarsDriver } from './animation-drivers/audio-bars-driver';
import { createDataSeriesDriver } from './animation-drivers/data-series-driver';
import { createAnimationRuntime } from './animation-drivers/runtime';
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
	dataSeries: DataSeriesConfig;
	durationSec: number;
	loop: boolean;
	alternate: boolean;
};

const defaultAudioBarsConfig: AudioBarsConfig = {
	smoothing: 0.5,
	minHz: 20,
	maxHz: 20000
};

const defaultDataSeriesConfig: DataSeriesConfig = {
	seriesByRingIndex: {},
	speed: 1,
	loop: false
};

export const animationState = $state<AnimationState>({
	mode: null,
	isPlaying: false,
	isPaused: false,
	progress: 0,
	audioBars: defaultAudioBarsConfig,
	dataSeries: defaultDataSeriesConfig,
	durationSec: 3,
	loop: false,
	alternate: false
});

let lastRingCount = 0;
let animatedIndices: number[] = [];
let frameRequestId: number | null = null;
let startedAtMs: number | null = null;
let pausedElapsedMs = 0;

const runtime = createAnimationRuntime({
	applyRingT: (index, t) => setRingMorphT(index, t)
});

runtime.registerDriver(
	'audioBars',
	createAudioBarsDriver({
		getConfig: () => animationState.audioBars,
		getRingCount: () => composition.rings.length,
		readBars: () => []
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
	cleanupCurrentAnimation();
	runtime.setMode(null);
	if (resetProgress) {
		applyMorphT(0);
		animationState.progress = 0;
	}
	startedAtMs = null;
	pausedElapsedMs = 0;
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

function tick(nowMs: number) {
	if (!animationState.isPlaying) return;
	if (!Number.isFinite(nowMs)) {
		frameRequestId = requestAnimationFrame(tick);
		return;
	}

	if (startedAtMs === null) {
		startedAtMs = nowMs - pausedElapsedMs;
	}
	const elapsedMs = Math.max(0, nowMs - startedAtMs);
	const elapsedSec = elapsedMs / 1000;
	const durationSec = Math.max(0.1, animationState.durationSec);
	const progress = clamp01(elapsedSec / durationSec);

	if (hasRunnableMode()) {
		runtime.tick(nowMs);
		animationState.progress = progress;
	} else {
		applyMorphT(progress);
		animationState.progress = progress;
	}

	if (progress >= 1 && !animationState.loop) {
		animationState.isPlaying = false;
		animationState.isPaused = false;
		pausedElapsedMs = 0;
		startedAtMs = null;
		frameRequestId = null;
		return;
	}

	if (progress >= 1 && animationState.loop) {
		startedAtMs = nowMs;
		pausedElapsedMs = 0;
		if (!hasRunnableMode()) {
			applyMorphT(0);
			animationState.progress = 0;
		}
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
	startedAtMs = null;
	pausedElapsedMs = 0;
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
	const currentProgress = animationState.progress;

	cleanupCurrentAnimation();
	startedAtMs = null;
	pausedElapsedMs = currentProgress * Math.max(0.1, animationState.durationSec) * 1000;

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
	animationState.mode = mode;
	if (animationState.isPlaying) {
		runtime.setMode(mode);
	}
}

export function setDataSeriesConfig(next: Partial<AnimationState['dataSeries']>): void {
	animationState.dataSeries = { ...animationState.dataSeries, ...next };
}

export function togglePlay() {
	if (!animationState.isPlaying && !animationState.isPaused) {
		startNewAnimation();
		return;
	}

	if (animationState.isPlaying) {
		cleanupCurrentAnimation();
		if (startedAtMs !== null) {
			pausedElapsedMs = Math.max(0, animationState.progress * Math.max(0.1, animationState.durationSec) * 1000);
		}
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

	const hasCompositionChanged =
		composition.rings.length !== lastRingCount ||
		!haveSameIndices(currentIndices, animatedIndices);

	if (hasCompositionChanged) {
		stopInternal(true);
	}
}
