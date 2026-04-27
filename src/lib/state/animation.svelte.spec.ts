// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const animeAnimate = vi.hoisted(() =>
	vi.fn(() => ({
		play: vi.fn(),
		pause: vi.fn(),
		resume: vi.fn(() => {
			throw new Error('resume should not be called');
		}),
		seek: vi.fn(),
		cancel: vi.fn(),
		revert: vi.fn()
	}))
);

type AnimateCall = {
	target: { t: number };
	options: { onUpdate?: (payload: { progress?: number }) => void };
};

function getLatestAnimateCall(): AnimateCall {
	const call = animeAnimate.mock.calls.at(-1) as [unknown, unknown] | undefined;
	if (!call) throw new Error('Expected animate() to be called');
	return {
		target: call[0] as { t: number },
		options: call[1] as { onUpdate?: (payload: { progress?: number }) => void }
	};
}

const mockComposition = {
	rings: [
		{ secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 },
		{ secondaryTemplatePath: null, morphT: 0 }
	]
};

vi.mock('animejs', () => ({
	animate: animeAnimate
}));

vi.mock('./composition', () => ({
	composition: mockComposition,
	setRingMorphT: vi.fn()
}));

describe('animation controller', () => {
	beforeEach(() => {
		vi.resetModules();
		animeAnimate.mockClear();
		mockComposition.rings = [
			{ secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 },
			{ secondaryTemplatePath: null, morphT: 0 }
		];
	});

	it('notifies Svelte consumers when exported state changes', async () => {
		const animation = await import('./animation');
		let isPlaying = $derived(animation.animationState.isPlaying);
		const readIsPlaying = () => isPlaying;

		expect(readIsPlaying()).toBe(false);
		animation.togglePlay();
		expect(readIsPlaying()).toBe(true);
	});

	it('starts from idle and flips to playing on toggle', async () => {
		const animation = await import('./animation');
		expect(animation.animationState.isPlaying).toBe(false);
		animation.togglePlay();
		expect(animation.animationState.isPlaying).toBe(true);
		expect(animeAnimate).toHaveBeenCalledOnce();
	});

	it('pauses when togglePlay is invoked while playing', async () => {
		const animation = await import('./animation');
		animation.togglePlay();
		animation.togglePlay();
		expect(animation.animationState.isPlaying).toBe(false);
		expect(animation.animationState.isPaused).toBe(true);
	});

	it('resumes from paused state on next toggle', async () => {
		const animation = await import('./animation');
		animation.togglePlay();
		animation.togglePlay();
		animation.togglePlay();
		expect(animation.animationState.isPlaying).toBe(true);
		expect(animation.animationState.isPaused).toBe(false);
	});

	it('resets when composition ring count changes during playback', async () => {
		const animation = await import('./animation');
		animation.togglePlay();
		mockComposition.rings.push({ secondaryTemplatePath: null, morphT: 0 });
		animation.handleCompositionChanged();
		expect(animation.animationState.isPlaying).toBe(false);
		expect(animation.animationState.progress).toBe(0);
	});

	it('resets when animated ring targets become stale during playback', async () => {
		const animation = await import('./animation');
		animation.togglePlay();
		mockComposition.rings = [
			{ secondaryTemplatePath: null, morphT: 0 },
			{ secondaryTemplatePath: null, morphT: 0 }
		];

		animation.handleCompositionChanged();

		expect(animation.animationState.isPlaying).toBe(false);
		expect(animation.animationState.progress).toBe(0);
	});

	it('keeps idle state when no ring has a morph target', async () => {
		mockComposition.rings = [{ secondaryTemplatePath: null, morphT: 0 }];
		const animation = await import('./animation');

		animation.togglePlay();

		expect(animation.animationState.isPlaying).toBe(false);
		expect(animation.animationState.progress).toBe(0);
		expect(animeAnimate).not.toHaveBeenCalled();
	});

	it('updates progress in loop mode from animated morph value', async () => {
		const animation = await import('./animation');
		animation.setAnimationLoop(true);
		animation.togglePlay();

		const running = getLatestAnimateCall();
		running.target.t = 0.42;
		running.options.onUpdate?.({});

		expect(animation.animationState.progress).toBe(0.42);
	});

	it('keeps play/pause functional after changing checkboxes while playing', async () => {
		const animation = await import('./animation');
		animation.togglePlay();

		animation.setAnimationLoop(true);
		animation.setAnimationAlternate(true);

		expect(animation.animationState.isPlaying).toBe(true);
		animation.togglePlay();
		expect(animation.animationState.isPlaying).toBe(false);
		expect(animation.animationState.isPaused).toBe(true);
	});

	it('does not crash when resuming after pause in loop and alternate mode', async () => {
		const animation = await import('./animation');
		animation.setAnimationLoop(true);
		animation.setAnimationAlternate(true);
		animation.togglePlay();
		animation.togglePlay();

		expect(() => animation.togglePlay()).not.toThrow();
		expect(animation.animationState.isPlaying).toBe(true);
		expect(animation.animationState.isPaused).toBe(false);
	});
});
