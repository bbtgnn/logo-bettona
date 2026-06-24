// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockComposition = {
	rings: [
		{ id: 'ring-a', secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 },
		{ id: 'ring-b', secondaryTemplatePath: null, morphT: 0 }
	]
};

vi.mock('./composition', () => ({
	composition: mockComposition,
	setRingMorphT: vi.fn(),
	setRingWave: vi.fn(),
	setRingZoneDrive: vi.fn(),
	updateRing: vi.fn(),
	createRingMorphTarget: vi.fn(),
	removeRingMorphTarget: vi.fn(),
	removeRing: vi.fn((index: number) => {
		mockComposition.rings = mockComposition.rings.filter((_, i) => i !== index);
	})
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
			{ id: 'ring-a', secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 },
			{ id: 'ring-b', secondaryTemplatePath: null, morphT: 0 }
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

	it('defaults to kaleidoscope layer on, others off', async () => {
		const animation = await import('./animation');
		expect(animation.animationState.layers.kaleidoscope).toBe(true);
		expect(animation.animationState.layers.audioBars).toBe(false);
		expect(animation.animationState.layers.audioZones).toBe(false);
		expect(animation.animationState.layers.dataSeries).toBe(false);
	});

	it('setLayerEnabled toggles a layer independently of the others', async () => {
		const animation = await import('./animation');
		animation.setLayerEnabled('audioBars', true);
		expect(animation.animationState.layers.audioBars).toBe(true);
		expect(animation.animationState.layers.kaleidoscope).toBe(true);
		animation.setLayerEnabled('audioBars', false);
		expect(animation.animationState.layers.audioBars).toBe(false);
		expect(animation.animationState.layers.kaleidoscope).toBe(true);
	});

	it('turning off the last audio layer stops the audio source', async () => {
		const animation = await import('./animation');
		const stopSpy = vi.spyOn(animation.audioSource, 'stop');
		animation.setLayerEnabled('audioBars', true);
		stopSpy.mockClear();
		animation.setLayerEnabled('audioBars', false); // last audio layer off
		expect(stopSpy).toHaveBeenCalled();
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

	it('keeps audio-driver playback running when composition topology changes', async () => {
		const animation = await import('./animation');
		animation.setLayerEnabled('audioBars', true);
		animation.togglePlay();
		flushNextAnimationFrame(0);
		flushNextAnimationFrame(300);
		expect(animation.animationState.isPlaying).toBe(true);

		mockComposition.rings.push({ id: 'ring-c', secondaryTemplatePath: null, morphT: 0 });
		animation.handleCompositionChanged();
		expect(animation.animationState.isPlaying).toBe(true);

		flushNextAnimationFrame(600);
		expect(animation.animationState.isPlaying).toBe(true);
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

	it('accepts dataSeries config updates (parked placeholder, not runnable)', async () => {
		const animation = await import('./animation');

		animation.setDataSeriesConfig({
			seriesByRingIndex: {
				0: [0, 1, 0.5]
			}
		});

		expect(animation.animationState.layers.dataSeries).toBe(false);
		expect(animation.animationState.dataSeries.seriesByRingIndex[0]).toEqual([0, 1, 0.5]);
	});
});

describe('animation runtime integration', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		rafCallbacks.length = 0;
		mockComposition.rings = [
			{ id: 'ring-a', secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 },
			{ id: 'ring-b', secondaryTemplatePath: null, morphT: 0 }
		];
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

	it('audioBars layer does not stop after durationSec elapses', async () => {
		const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
		const animation = await import('./animation');
		animation.setLayerEnabled('audioBars', true);
		animation.togglePlay();
		flushNextAnimationFrame(0);
		flushNextAnimationFrame(3000); // default durationSec = 3 s
		expect(animation.animationState.isPlaying).toBe(true);
		void requestAnimationFrameMock;
		void cancelAnimationFrameMock;
		vi.unstubAllGlobals();
	});

	it('elapsedMs increments each frame with an audio layer active', async () => {
		const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
		const animation = await import('./animation');
		animation.setLayerEnabled('audioBars', true);
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
		animation.setLayerEnabled('audioBars', true);
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

	it('elapsedMs resets to 0 when the bare-clock animation completes naturally', async () => {
		const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
		const animation = await import('./animation');
		// no driver layer enabled; default durationSec = 3
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

	it('toggling a layer mid-play keeps the shared clock running (no elapsed reset)', async () => {
		const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
		const animation = await import('./animation');
		animation.setLayerEnabled('audioBars', true);
		animation.togglePlay();
		flushNextAnimationFrame(0);
		flushNextAnimationFrame(10000); // 10 s > durationSec (3 s); audio layer keeps it alive
		expect(animation.animationState.elapsedMs).toBe(10000);
		expect(animation.animationState.isPlaying).toBe(true);

		// Enable another layer mid-play — the shared clock is NOT reset and
		// playback continues (layers are independent; no exclusive-mode switch).
		animation.setLayerEnabled('audioZones', true);
		expect(animation.animationState.elapsedMs).toBe(10000);
		expect(animation.animationState.isPlaying).toBe(true);

		flushNextAnimationFrame(10100);
		expect(animation.animationState.isPlaying).toBe(true);
		void requestAnimationFrameMock;
		void cancelAnimationFrameMock;
		vi.unstubAllGlobals();
	});
});

describe('kaleidoscope keyframe application', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('does nothing when the track is disabled (slider value stands)', async () => {
		const animation = await import('./animation');
		const { keyframes, KALEIDO_GLOBAL_ROTATION: ROT } = await import('./keyframes.svelte');
		const { kaleidoscope, setGlobalRotation } = await import('./kaleidoscope.svelte');
		setGlobalRotation(33);
		keyframes.addKeyframe(ROT, { time: 0, value: 0 });
		keyframes.addKeyframe(ROT, { time: 1, value: 360 });
		animation.applyKeyframes(0.5);
		expect(kaleidoscope.globalRotation).toBe(33);
	});

	it('applies the sampled rotation when the track is enabled', async () => {
		const animation = await import('./animation');
		const { keyframes, KALEIDO_GLOBAL_ROTATION: ROT } = await import('./keyframes.svelte');
		const { kaleidoscope } = await import('./kaleidoscope.svelte');
		keyframes.addKeyframe(ROT, { time: 0, value: 0 });
		keyframes.addKeyframe(ROT, { time: 1, value: 360 });
		keyframes.setTrackEnabled(ROT, true);
		animation.applyKeyframes(0.5);
		expect(kaleidoscope.globalRotation).toBeCloseTo(180, 4);
	});

	it('applies multiple armed params at the same progress', async () => {
		const animation = await import('./animation');
		const { keyframes } = await import('./keyframes.svelte');
		const { kaleidoscope } = await import('./kaleidoscope.svelte');
		const SCALE = 'kaleidoscope.scale';
		const TILEROT = 'kaleidoscope.tileRotation';
		keyframes.addKeyframe(SCALE, { time: 0, value: 1 });
		keyframes.addKeyframe(SCALE, { time: 1, value: 3 });
		keyframes.setTrackEnabled(SCALE, true);
		keyframes.addKeyframe(TILEROT, { time: 0, value: 0 });
		keyframes.addKeyframe(TILEROT, { time: 1, value: 100 });
		keyframes.setTrackEnabled(TILEROT, true);
		animation.applyKeyframes(0.5);
		expect(kaleidoscope.scale).toBeCloseTo(2, 4);
		expect(kaleidoscope.tileRotation).toBeCloseTo(50, 4);
	});

	it('leaves an unarmed param at its static value while another is armed', async () => {
		const animation = await import('./animation');
		const { keyframes } = await import('./keyframes.svelte');
		const { kaleidoscope, setOffsetDistance } = await import('./kaleidoscope.svelte');
		const SCALE = 'kaleidoscope.scale';
		setOffsetDistance(0.25); // unarmed
		keyframes.addKeyframe(SCALE, { time: 0, value: 1 });
		keyframes.addKeyframe(SCALE, { time: 1, value: 3 });
		keyframes.setTrackEnabled(SCALE, true);
		animation.applyKeyframes(0.5);
		expect(kaleidoscope.offsetDistance).toBe(0.25);
	});

	it('rounds a discrete (sectors) sample to a valid even value', async () => {
		const animation = await import('./animation');
		const { keyframes } = await import('./keyframes.svelte');
		const { kaleidoscope } = await import('./kaleidoscope.svelte');
		const SECTORS = 'kaleidoscope.sectors';
		keyframes.addKeyframe(SECTORS, { time: 0, value: 8 });
		keyframes.addKeyframe(SECTORS, { time: 1, value: 12 });
		keyframes.setTrackEnabled(SECTORS, true);
		animation.applyKeyframes(0.5); // sample ~10
		expect(kaleidoscope.sectors).toBe(10);
		expect(kaleidoscope.sectors % 2).toBe(0);
	});

	// Characterization (locks the invariant the restructure relies on): audio
	// reactivity is NOT exclusive with the kaleidoscope timeline. Keyframes ride
	// the same clock regardless of which layers drive, so an armed track must still
	// sample and apply even while an audio layer is active.
	it('applies kaleidoscope keyframes even when the audioBars layer is active', async () => {
		const animation = await import('./animation');
		const { keyframes } = await import('./keyframes.svelte');
		const { kaleidoscope } = await import('./kaleidoscope.svelte');
		const SCALE = 'kaleidoscope.scale';
		keyframes.addKeyframe(SCALE, { time: 0, value: 1 });
		keyframes.addKeyframe(SCALE, { time: 1, value: 3 });
		keyframes.setTrackEnabled(SCALE, true);

		animation.setLayerEnabled('audioBars', true);
		animation.applyKeyframes(0.5);

		// Track still samples (not nulled out by the audio layer)...
		expect(keyframes.sampleParam(SCALE, 0.5)).toBeCloseTo(2, 5);
		// ...and the sampled value was applied to the live kaleidoscope param.
		expect(kaleidoscope.scale).toBeCloseTo(2, 5);
	});

	// The kaleidoscope layer gates its own keyframe application: off → params hold
	// their static slider value; on → they sample again.
	it('layers.kaleidoscope=false skips kaleidoscope keyframe application', async () => {
		const animation = await import('./animation');
		const { keyframes } = await import('./keyframes.svelte');
		const { kaleidoscope, setGlobalRotation } = await import('./kaleidoscope.svelte');
		const ROT = 'kaleidoscope.globalRotation';
		setGlobalRotation(42);
		keyframes.addKeyframe(ROT, { time: 0, value: 0 });
		keyframes.addKeyframe(ROT, { time: 1, value: 360 });
		keyframes.setTrackEnabled(ROT, true);

		animation.setLayerEnabled('kaleidoscope', false);
		animation.applyKeyframes(0.5);
		expect(kaleidoscope.globalRotation).toBe(42); // gated → static value stands

		animation.setLayerEnabled('kaleidoscope', true);
		animation.applyKeyframes(0.5);
		expect(kaleidoscope.globalRotation).toBeCloseTo(180, 4);
	});

	// applyKeyframes now walks every registry, not just the kaleidoscope one: an
	// armed audioBars param must sample and apply through its setter too.
	it('drives an armed audioBars param through applyKeyframes', async () => {
		const animation = await import('./animation');
		const { keyframes } = await import('./keyframes.svelte');
		const CRESTS = 'audioBars.waveCrests';
		keyframes.addKeyframe(CRESTS, { time: 0, value: 1 });
		keyframes.addKeyframe(CRESTS, { time: 1, value: 8 });
		keyframes.setTrackEnabled(CRESTS, true);

		animation.applyKeyframes(0.5);

		expect(animation.animationState.audioBars.waveCrests).toBeCloseTo(4.5, 1);
	});
});

describe('setAnimationFps', () => {
	it('accepts an allowed frame rate', async () => {
		const animation = await import('./animation');
		animation.setAnimationFps(50);
		expect(animation.animationState.fps).toBe(50);
	});

	it('falls back to 30 for a value outside the allowed set', async () => {
		const animation = await import('./animation');
		animation.setAnimationFps(42);
		expect(animation.animationState.fps).toBe(30);
	});
});

describe('ring morph create/remove (a morph IS keyframes)', () => {
	beforeEach(() => {
		vi.resetModules();
		mockComposition.rings = [
			{ id: 'ring-a', secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 },
			{ id: 'ring-b', secondaryTemplatePath: null, morphT: 0 }
		];
	});

	it('createRingMorph seeds an armed bezier 0→1 morphT track', async () => {
		const animation = await import('./animation');
		const { keyframes } = await import('./keyframes.svelte');
		const { composition } = await import('./composition');
		const id = `ring.${composition.rings[0].id}.morphT`;
		keyframes.deleteTrack(id);

		animation.createRingMorph(0);

		const track = keyframes.tracks[id];
		expect(track?.enabled).toBe(true);
		const sorted = [...track.keyframes].sort((a, b) => a.time - b.time);
		expect(sorted.map((k) => [k.time, k.value])).toEqual([
			[0, 0],
			[1, 1]
		]);
		expect(sorted[0].interp).toBe('bezier');
	});

	it('removeRingMorph deletes the morphT track', async () => {
		const animation = await import('./animation');
		const { keyframes } = await import('./keyframes.svelte');
		const { composition } = await import('./composition');
		const id = `ring.${composition.rings[0].id}.morphT`;
		animation.createRingMorph(0);
		expect(keyframes.tracks[id]).toBeDefined();

		animation.removeRingMorph(0);
		expect(keyframes.tracks[id]).toBeUndefined();
	});
});

describe('removeRing also deletes the ring tracks', () => {
	beforeEach(() => {
		vi.resetModules();
		mockComposition.rings = [
			{ id: 'ring-a', secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 },
			{ id: 'ring-b', secondaryTemplatePath: null, morphT: 0 }
		];
	});

	it('drops the removed ring tracks and leaves siblings intact', async () => {
		const animation = await import('./animation');
		const { keyframes } = await import('./keyframes.svelte');
		const { composition } = await import('./composition');

		const victim = composition.rings[0].id;
		const survivor = composition.rings[1].id;
		keyframes.ensureTrack(`ring.${victim}.morphT`);
		keyframes.ensureTrack(`ring.${survivor}.morphT`);

		animation.removeRing(0);

		expect(keyframes.tracks[`ring.${victim}.morphT`]).toBeUndefined();
		expect(keyframes.tracks[`ring.${survivor}.morphT`]).toBeDefined();
		expect(composition.rings.some((r) => r.id === victim)).toBe(false);
	});
});
