import { describe, expect, it, vi } from 'vitest';
import { createAnimationRuntime } from './runtime';

describe('createAnimationRuntime', () => {
	it('applies active driver frame values and clamps output', () => {
		const applied: Array<{ index: number; t: number }> = [];
		const runtime = createAnimationRuntime({
			applyRingT: (index, t) => applied.push({ index, t })
		});

		runtime.setActive('dataSeries', true);
		runtime.registerDriver('dataSeries', {
			init: () => undefined,
			dispose: () => undefined,
			frame: () => ({ 0: 1.2, 1: -0.4, 2: Number.NaN })
		});

		runtime.tick(1000);

		expect(applied).toEqual([
			{ index: 0, t: 1 },
			{ index: 1, t: 0 },
			{ index: 2, t: 0 }
		]);
	});

	it('keeps omitted ring indices untouched across consecutive frames', () => {
		const applyRingT = vi.fn();
		const runtime = createAnimationRuntime({ applyRingT });
		let frameIndex = 0;
		runtime.registerDriver('dataSeries', {
			init: () => undefined,
			dispose: () => undefined,
			frame: (): Record<number, number> => {
				frameIndex += 1;
				if (frameIndex === 1) return { 0: 0.2, 1: 0.8 };
				return { 0: 0.4 };
			}
		});

		runtime.setActive('dataSeries', true);
		runtime.tick(0);
		runtime.tick(16);

		expect(applyRingT.mock.calls).toEqual([
			[0, 0.2],
			[1, 0.8],
			[0, 0.4]
		]);
	});

	it('an empty active set means no frame application', () => {
		const applyRingT = vi.fn();
		const runtime = createAnimationRuntime({ applyRingT });

		runtime.tick(1000);

		expect(applyRingT).not.toHaveBeenCalled();
	});

	it('auto-inits a driver registered for an already-active type', () => {
		const init = vi.fn();
		const frame = vi.fn(() => ({ 0: 0.4 }));
		const applyRingT = vi.fn();
		const runtime = createAnimationRuntime({ applyRingT });

		runtime.setActive('dataSeries', true);
		runtime.registerDriver('dataSeries', {
			init,
			dispose: vi.fn(),
			frame
		});
		runtime.tick(10);

		expect(init).toHaveBeenCalledOnce();
		expect(frame).toHaveBeenCalledWith(10);
		expect(applyRingT).toHaveBeenCalledWith(0, 0.4);
	});

	it('setActive(on) inits once and is idempotent; setActive(off) disposes once', () => {
		const init = vi.fn();
		const dispose = vi.fn();
		const runtime = createAnimationRuntime({ applyRingT: vi.fn() });
		runtime.registerDriver('simple', { init, dispose, frame: () => ({}) });

		runtime.setActive('simple', true);
		runtime.setActive('simple', true);
		expect(init).toHaveBeenCalledOnce();

		runtime.setActive('simple', false);
		runtime.setActive('simple', false);
		expect(dispose).toHaveBeenCalledOnce();
	});

	it('ticks every active driver; distinct-property drivers coexist', () => {
		const applyRingT = vi.fn();
		const runtime = createAnimationRuntime({ applyRingT });
		runtime.registerDriver('simple', { init() {}, dispose() {}, frame: () => ({ 0: 0.5 }) });
		const audioFrame = vi.fn(() => ({})); // audio self-applies wave, returns no morph map
		runtime.registerDriver('audioBars', { init() {}, dispose() {}, frame: audioFrame });

		runtime.setActive('simple', true);
		runtime.setActive('audioBars', true);
		runtime.tick(100);

		expect(applyRingT).toHaveBeenCalledWith(0, 0.5);
		expect(audioFrame).toHaveBeenCalledWith(100);
	});

	it('disposes previous active driver when replacing the same active type', () => {
		const previousInit = vi.fn();
		const previousDispose = vi.fn();
		const nextInit = vi.fn();
		const nextDispose = vi.fn();
		const runtime = createAnimationRuntime({ applyRingT: vi.fn() });

		runtime.registerDriver('dataSeries', {
			init: previousInit,
			dispose: previousDispose,
			frame: () => ({})
		});
		runtime.setActive('dataSeries', true);
		runtime.registerDriver('dataSeries', {
			init: nextInit,
			dispose: nextDispose,
			frame: () => ({})
		});

		expect(previousInit).toHaveBeenCalledOnce();
		expect(previousDispose).toHaveBeenCalledOnce();
		expect(nextInit).toHaveBeenCalledOnce();
		expect(nextDispose).not.toHaveBeenCalled();
	});
});
