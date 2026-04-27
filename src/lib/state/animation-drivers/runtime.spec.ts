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
});
