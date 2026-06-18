// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockComposition = {
	rings: [
		{ secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 },
		{ secondaryTemplatePath: null, morphT: 0 }
	]
};

vi.mock('./composition', () => ({
	composition: mockComposition,
	setRingMorphT: vi.fn(),
	setRingWave: vi.fn()
}));

const rafCallbacks: FrameRequestCallback[] = [];
let requestAnimationFrameMock: ReturnType<typeof vi.fn> | null = null;

function installRafMock() {
	requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
		rafCallbacks.push(callback);
		return rafCallbacks.length;
	});
	const cancelAnimationFrameMock = vi.fn((id: number) => {
		const index = id - 1;
		if (index >= 0 && index < rafCallbacks.length) {
			rafCallbacks[index] = () => undefined;
		}
	});
	vi.stubGlobal('requestAnimationFrame', requestAnimationFrameMock);
	vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameMock);
	return { requestAnimationFrameMock, cancelAnimationFrameMock };
}

function flushNextAnimationFrame(nowMs: number) {
	const callback = rafCallbacks.shift();
	if (!callback) throw new Error('Expected queued requestAnimationFrame callback');
	callback(nowMs);
}

describe('animation controller', () => {
	beforeEach(() => {
		vi.resetModules();
		rafCallbacks.length = 0;
		installRafMock();
		mockComposition.rings = [
			{ secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 },
			{ secondaryTemplatePath: null, morphT: 0 }
		];
	});

	afterEach(() => {
		vi.unstubAllGlobals();
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
		expect(requestAnimationFrameMock).toHaveBeenCalled();
	});

	it('defaults to simple mode at startup', async () => {
		const animation = await import('./animation');
		expect(animation.animationState.mode).toBe('simple');
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

	it('resets when composition ring count changes during legacy playback', async () => {
		const animation = await import('./animation');
		animation.setAnimationMode(null);
		animation.togglePlay();
		mockComposition.rings.push({ secondaryTemplatePath: null, morphT: 0 });
		animation.handleCompositionChanged();
		expect(animation.animationState.isPlaying).toBe(false);
		expect(animation.animationState.progress).toBe(0);
	});

	it('resets when animated ring targets become stale during legacy playback', async () => {
		const animation = await import('./animation');
		animation.setAnimationMode(null);
		animation.togglePlay();
		mockComposition.rings = [
			{ secondaryTemplatePath: null, morphT: 0 },
			{ secondaryTemplatePath: null, morphT: 0 }
		];

		animation.handleCompositionChanged();

		expect(animation.animationState.isPlaying).toBe(false);
		expect(animation.animationState.progress).toBe(0);
	});

	it('keeps driver playback running when composition topology changes', async () => {
		const animation = await import('./animation');
		animation.setAnimationMode('dataSeries');
		animation.setDataSeriesConfig({
			seriesByRingIndex: { 0: [0, 10] },
			speed: 1,
			loop: false
		});
		animation.togglePlay();
		flushNextAnimationFrame(0);
		flushNextAnimationFrame(300);
		expect(animation.animationState.isPlaying).toBe(true);
		expect(animation.animationState.progress).toBeCloseTo(0.1, 5);

		mockComposition.rings.push({ secondaryTemplatePath: null, morphT: 0 });
		animation.handleCompositionChanged();
		expect(animation.animationState.isPlaying).toBe(true);

		flushNextAnimationFrame(600);
		expect(animation.animationState.isPlaying).toBe(true);
		expect(animation.animationState.progress).toBeCloseTo(0.2, 5);
	});

	it('keeps idle state when no ring has a morph target', async () => {
		mockComposition.rings = [{ secondaryTemplatePath: null, morphT: 0 }];
		const animation = await import('./animation');
		animation.setAnimationMode(null);

		animation.togglePlay();

		expect(animation.animationState.isPlaying).toBe(false);
		expect(animation.animationState.progress).toBe(0);
		expect(requestAnimationFrameMock).not.toHaveBeenCalled();
	});

	it('updates progress in loop mode from animated morph value', async () => {
		const animation = await import('./animation');
		animation.setAnimationLoop(true);
		animation.togglePlay();
		flushNextAnimationFrame(0);
		flushNextAnimationFrame(420);

		expect(animation.animationState.progress).toBeCloseTo(0.14, 5);
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

	it('stores selected driver mode and accepts dataSeries config updates', async () => {
		const animation = await import('./animation');

		animation.setAnimationMode('dataSeries');
		animation.setDataSeriesConfig({
			seriesByRingIndex: {
				0: [0, 1, 0.5]
			}
		});

		expect(animation.animationState.mode).toBe('dataSeries');
		expect(animation.animationState.dataSeries.seriesByRingIndex[0]).toEqual([0, 1, 0.5]);
	});
});

describe('animation runtime integration', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		rafCallbacks.length = 0;
		mockComposition.rings = [
			{ secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 },
			{ secondaryTemplatePath: null, morphT: 0 }
		];
	});

	it('setAnimationMode(mode) drives runtime mode while playing', async () => {
		const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
		const { setRingMorphT } = await import('./composition');
		const animation = await import('./animation');

		animation.setDataSeriesConfig({
			seriesByRingIndex: { 0: [0, 10] },
			speed: 1,
			loop: false
		});
		animation.setAnimationMode('dataSeries');
		animation.togglePlay();
		flushNextAnimationFrame(0);
		flushNextAnimationFrame(500);

		expect(setRingMorphT).toHaveBeenCalledWith(0, 0.5);
		expect(animation.animationState.mode).toBe('dataSeries');

		void requestAnimationFrameMock;
		void cancelAnimationFrameMock;
		vi.unstubAllGlobals();
	});

	it('applies simple driver values when playing in default mode', async () => {
		const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
		const animation = await import('./animation');
		const { setRingMorphT } = await import('./composition');

		animation.togglePlay();
		flushNextAnimationFrame(0);
		flushNextAnimationFrame(600);

		expect(animation.animationState.mode).toBe('simple');
		expect(setRingMorphT).toHaveBeenCalledWith(0, 0.2);

		void requestAnimationFrameMock;
		void cancelAnimationFrameMock;
		vi.unstubAllGlobals();
	});

	it('simple non-loop reaches 1 at completion without wraparound reset', async () => {
		const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
		const animation = await import('./animation');
		const { setRingMorphT } = await import('./composition');

		animation.togglePlay();
		flushNextAnimationFrame(0);
		flushNextAnimationFrame(3000);

		expect(animation.animationState.mode).toBe('simple');
		expect(animation.animationState.isPlaying).toBe(false);
		expect(animation.animationState.progress).toBe(1);
		expect(setRingMorphT).toHaveBeenCalledWith(0, 1);
		expect(vi.mocked(setRingMorphT).mock.calls.at(-1)?.[1]).toBe(1);

		void requestAnimationFrameMock;
		void cancelAnimationFrameMock;
		vi.unstubAllGlobals();
	});

	it('setDataSeriesConfig updates are consumed dynamically by dataSeries driver', async () => {
		const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
		const { setRingMorphT } = await import('./composition');
		const animation = await import('./animation');

		animation.setDataSeriesConfig({
			seriesByRingIndex: { 0: [0, 10] },
			speed: 1,
			loop: false
		});
		animation.setAnimationMode('dataSeries');
		animation.togglePlay();
		flushNextAnimationFrame(0);
		flushNextAnimationFrame(500);
		expect(setRingMorphT).toHaveBeenLastCalledWith(0, 0.5);

		animation.setDataSeriesConfig({
			seriesByRingIndex: { 0: [0, 20] },
			speed: 2
		});
		flushNextAnimationFrame(750);
		expect(setRingMorphT).toHaveBeenLastCalledWith(0, 1);

		void requestAnimationFrameMock;
		void cancelAnimationFrameMock;
		vi.unstubAllGlobals();
	});

	it('preserves pause/resume continuity in dataSeries mode', async () => {
		const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
		const { setRingMorphT } = await import('./composition');
		const animation = await import('./animation');

		animation.setDataSeriesConfig({
			seriesByRingIndex: { 0: [0, 10] },
			speed: 1,
			loop: false
		});
		animation.setAnimationMode('dataSeries');
		animation.togglePlay();
		flushNextAnimationFrame(0);
		flushNextAnimationFrame(500);
		expect(setRingMorphT).toHaveBeenLastCalledWith(0, 0.5);

		animation.togglePlay();
		animation.togglePlay();
		flushNextAnimationFrame(10_500);

		expect(setRingMorphT).toHaveBeenLastCalledWith(0, 0.5);

		flushNextAnimationFrame(10_750);
		flushNextAnimationFrame(11_000);
		expect(setRingMorphT).toHaveBeenLastCalledWith(0, 0.75);

		void requestAnimationFrameMock;
		void cancelAnimationFrameMock;
		vi.unstubAllGlobals();
	});

	it('applies alternate progression to controller progress path', async () => {
		const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
		const animation = await import('./animation');

		animation.setAnimationDurationSec(1);
		animation.setAnimationLoop(true);
		animation.setAnimationAlternate(true);
		animation.togglePlay();

		flushNextAnimationFrame(0);
		flushNextAnimationFrame(500);
		expect(animation.animationState.progress).toBeCloseTo(0.5, 5);

		flushNextAnimationFrame(1000);
		expect(animation.animationState.progress).toBeCloseTo(1, 5);

		flushNextAnimationFrame(1500);
		expect(animation.animationState.progress).toBeCloseTo(0.5, 5);

		flushNextAnimationFrame(2000);
		expect(animation.animationState.progress).toBeCloseTo(0, 5);

		void requestAnimationFrameMock;
		void cancelAnimationFrameMock;
		vi.unstubAllGlobals();
	});

	it('dataSeries mode keeps untouched ring t when series is missing', async () => {
		const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
		const { setRingMorphT } = await import('./composition');
		const animation = await import('./animation');

		animation.setDataSeriesConfig({
			seriesByRingIndex: { 0: [0, 10] },
			speed: 1,
			loop: false
		});
		animation.setAnimationMode('dataSeries');
		animation.togglePlay();
		flushNextAnimationFrame(0);
		flushNextAnimationFrame(500);

		expect(setRingMorphT).toHaveBeenCalledWith(0, 0.5);
		expect(setRingMorphT).not.toHaveBeenCalledWith(1, expect.any(Number));

		void requestAnimationFrameMock;
		void cancelAnimationFrameMock;
		vi.unstubAllGlobals();
	});

	it('audioBars mode does not stop after durationSec elapses', async () => {
		const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
		const animation = await import('./animation');
		animation.setAnimationMode('audioBars');
		animation.togglePlay();
		flushNextAnimationFrame(0);
		flushNextAnimationFrame(3000); // default durationSec = 3 s
		expect(animation.animationState.isPlaying).toBe(true);
		void requestAnimationFrameMock;
		void cancelAnimationFrameMock;
		vi.unstubAllGlobals();
	});

	it('elapsedMs increments each frame in audioBars mode', async () => {
		const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
		const animation = await import('./animation');
		animation.setAnimationMode('audioBars');
		animation.togglePlay();
		flushNextAnimationFrame(0);
		flushNextAnimationFrame(1200);
		expect(animation.animationState.elapsedMs).toBe(1200);
		void requestAnimationFrameMock;
		void cancelAnimationFrameMock;
		vi.unstubAllGlobals();
	});

	it('elapsedMs resets to 0 when stopAnimation is called', async () => {
		const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
		const animation = await import('./animation');
		animation.setAnimationMode('audioBars');
		animation.togglePlay();
		flushNextAnimationFrame(0);
		flushNextAnimationFrame(1500);
		expect(animation.animationState.elapsedMs).toBe(1500);
		animation.stopAnimation();
		expect(animation.animationState.elapsedMs).toBe(0);
		void requestAnimationFrameMock;
		void cancelAnimationFrameMock;
		vi.unstubAllGlobals();
	});

	it('elapsedMs resets to 0 when simple animation completes naturally', async () => {
		const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
		const animation = await import('./animation');
		// default mode is 'simple', durationSec = 3
		animation.togglePlay();
		flushNextAnimationFrame(0);
		flushNextAnimationFrame(1000);
		expect(animation.animationState.elapsedMs).toBe(1000);
		flushNextAnimationFrame(3000); // past durationSec — hasCompleted fires
		expect(animation.animationState.isPlaying).toBe(false);
		expect(animation.animationState.elapsedMs).toBe(0);
		void requestAnimationFrameMock;
		void cancelAnimationFrameMock;
		vi.unstubAllGlobals();
	});

	it('switching from audioBars to simple mode while playing resets elapsed and does not instant-stop', async () => {
		const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
		const animation = await import('./animation');
		animation.setAnimationMode('audioBars');
		animation.togglePlay();
		flushNextAnimationFrame(0);
		flushNextAnimationFrame(10000); // 10 s > durationSec (3 s)
		expect(animation.animationState.elapsedMs).toBe(10000);
		expect(animation.animationState.isPlaying).toBe(true);

		// Switch to simple mode — should reset elapsed, NOT instantly stop
		animation.setAnimationMode('simple');
		expect(animation.animationState.elapsedMs).toBe(0);
		expect(animation.animationState.isPlaying).toBe(true);

		// One more frame to confirm simple mode runs normally
		flushNextAnimationFrame(10100);
		expect(animation.animationState.isPlaying).toBe(true);
		void requestAnimationFrameMock;
		void cancelAnimationFrameMock;
		vi.unstubAllGlobals();
	});
});

describe('kaleidoscope keyframe application', () => {
	it('does nothing when the track is disabled (slider value stands)', async () => {
		const animation = await import('./animation');
		const { keyframes, KALEIDO_GLOBAL_ROTATION: ROT } = await import('./keyframes.svelte');
		const { kaleidoscope, setGlobalRotation } = await import('./kaleidoscope.svelte');
		setGlobalRotation(33);
		keyframes.addKeyframe(ROT, { time: 0, value: 0 });
		keyframes.addKeyframe(ROT, { time: 1, value: 360 });
		animation.applyKaleidoscopeKeyframes(0.5);
		expect(kaleidoscope.globalRotation).toBe(33);
	});

	it('applies the sampled rotation when the track is enabled', async () => {
		const animation = await import('./animation');
		const { keyframes, KALEIDO_GLOBAL_ROTATION: ROT } = await import('./keyframes.svelte');
		const { kaleidoscope } = await import('./kaleidoscope.svelte');
		keyframes.addKeyframe(ROT, { time: 0, value: 0 });
		keyframes.addKeyframe(ROT, { time: 1, value: 360 });
		keyframes.setTrackEnabled(ROT, true);
		animation.applyKaleidoscopeKeyframes(0.5);
		expect(kaleidoscope.globalRotation).toBeCloseTo(180, 4);
	});
});
