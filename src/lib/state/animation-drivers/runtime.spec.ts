import { describe, expect, it, vi } from 'vitest';
import { createAnimationRuntime } from './runtime';

describe('createAnimationRuntime', () => {
	it('applies active driver frame values and clamps output', () => {
		const applied: Array<{ index: number; t: number }> = [];
		const runtime = createAnimationRuntime({
			applyRingT: (index, t) => applied.push({ index, t })
		});

		runtime.setMode('dataSeries');
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

	it('mode null means no frame application', () => {
		const applyRingT = vi.fn();
		const runtime = createAnimationRuntime({ applyRingT });

		runtime.setMode(null);
		runtime.tick(1000);

		expect(applyRingT).not.toHaveBeenCalled();
	});

	it('auto-inits a driver registered for the currently active mode', () => {
		const init = vi.fn();
		const frame = vi.fn(() => ({ 0: 0.4 }));
		const applyRingT = vi.fn();
		const runtime = createAnimationRuntime({ applyRingT });

		runtime.setMode('dataSeries');
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

	it('disposes previous mode and inits next mode on switch', () => {
		const audioInit = vi.fn();
		const audioDispose = vi.fn();
		const dataInit = vi.fn();
		const dataDispose = vi.fn();
		const runtime = createAnimationRuntime({ applyRingT: vi.fn() });

		runtime.registerDriver('audioBars', {
			init: audioInit,
			dispose: audioDispose,
			frame: () => ({})
		});
		runtime.registerDriver('dataSeries', {
			init: dataInit,
			dispose: dataDispose,
			frame: () => ({})
		});

		runtime.setMode('audioBars');
		runtime.setMode('dataSeries');
		runtime.setMode(null);

		expect(audioInit).toHaveBeenCalledOnce();
		expect(audioDispose).toHaveBeenCalledOnce();
		expect(dataInit).toHaveBeenCalledOnce();
		expect(dataDispose).toHaveBeenCalledOnce();
	});
});
