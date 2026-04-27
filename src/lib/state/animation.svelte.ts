import { animate } from 'animejs';
import { composition, setRingMorphT } from './composition';
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

type AnimeTarget = { t: number };

type AnimeInstance = {
	play?: () => unknown;
	resume?: () => unknown;
	pause?: () => unknown;
	seek?: (value: number) => unknown;
	cancel?: () => unknown;
	revert?: () => unknown;
};

type AnimeUpdatePayload = {
	progress?: number;
};

type AnimeOptions = {
	t: number;
	duration: number;
	loop: boolean;
	alternate: boolean;
	autoplay: boolean;
	ease: 'linear';
	onUpdate: (animation: AnimeUpdatePayload) => void;
	onComplete: () => void;
};

let currentAnimation: AnimeInstance | null = null;
let lastRingCount = 0;
let animatedIndices: number[] = [];

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
	currentAnimation?.pause?.();
	currentAnimation?.cancel?.();
	currentAnimation?.revert?.();
}

function stopInternal(resetProgress = true) {
	cleanupCurrentAnimation();
	if (resetProgress) {
		applyMorphT(0);
		animationState.progress = 0;
	}
	currentAnimation = null;
	animationState.isPlaying = false;
	animationState.isPaused = false;
}

function createAnimeAnimation(target: AnimeTarget, options: AnimeOptions): AnimeInstance {
	return animate(target, options);
}

function startNewAnimation() {
	animatedIndices = getMorphRingIndices();
	lastRingCount = composition.rings.length;
	animationState.progress = 0;

	if (animatedIndices.length === 0) {
		stopInternal(true);
		return;
	}

	const target = { t: 0 };
	const handleUpdate = (_animation: AnimeUpdatePayload) => {
		applyMorphT(clamp01(target.t));
		animationState.progress = clamp01(target.t);
	};

	const handleComplete = () => {
		applyMorphT(1);
		animationState.isPlaying = false;
		animationState.isPaused = false;
		animationState.progress = 1;
		currentAnimation = null;
	};

	currentAnimation = createAnimeAnimation(target, {
		t: 1,
		duration: Math.max(0.1, animationState.durationSec) * 1000,
		loop: animationState.loop,
		alternate: animationState.alternate,
		autoplay: true,
		ease: 'linear',
		onUpdate: handleUpdate,
		onComplete: handleComplete
	});

	animationState.isPlaying = true;
	animationState.isPaused = false;
}

function reconfigureCurrentAnimation() {
	if (!currentAnimation) return;

	const wasPlaying = animationState.isPlaying;
	const wasPaused = animationState.isPaused;

	cleanupCurrentAnimation();
	currentAnimation = null;

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
}

export function setDataSeriesConfig(next: Partial<AnimationState['dataSeries']>): void {
	animationState.dataSeries = { ...animationState.dataSeries, ...next };
}

export function togglePlay() {
	if (!currentAnimation) {
		startNewAnimation();
		return;
	}

	if (animationState.isPlaying) {
		currentAnimation.pause?.();
		animationState.isPlaying = false;
		animationState.isPaused = true;
		return;
	}

	try {
		currentAnimation.play?.();
	} catch {
		// If anime internal timer state is stale (seen after pause in loop/alternate),
		// recreate from current settings rather than crashing UI event handlers.
		startNewAnimation();
	}
	animationState.isPlaying = true;
	animationState.isPaused = false;
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
