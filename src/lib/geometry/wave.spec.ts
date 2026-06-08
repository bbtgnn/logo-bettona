import { describe, expect, it } from 'vitest';
import type { Path, WaveState } from '$lib/types';
import { applyWaveToPath } from './wave';

const square: Path = {
	cmds: ['M', 'L', 'L', 'L', 'Z'],
	crds: [0, 0, 100, 0, 100, 100, 0, 100]
};

describe('applyWaveToPath', () => {
	it('returns an unchanged copy when amplitude is 0', () => {
		const wave: WaveState = { amplitude: 0, crests: 3, phase: 0 };
		const result = applyWaveToPath(square, wave);

		expect(result).not.toBe(square);
		expect(result.crds).not.toBe(square.crds);
		expect(result.crds).toEqual(square.crds);
		expect(result.cmds).toEqual(square.cmds);
	});

	it('shifts x by amplitude*width*sin(crests*pi*ny + phase), y unchanged', () => {
		// width = 100, height = 100, minX = 0, minY = 0.
		// phase = pi/2 so sin(crests*pi*ny + pi/2) = cos(crests*pi*ny).
		const wave: WaveState = { amplitude: 0.5, crests: 1, phase: Math.PI / 2 };
		const result = applyWaveToPath(square, wave);

		// Point (0,0): ny=0 → cos(0)=1 → dx = 0.5*100*1 = 50 → x = 50.
		expect(result.crds[0]).toBeCloseTo(50, 6);
		expect(result.crds[1]).toBe(0); // y unchanged
		// Point (100,100): ny=1 → cos(pi) = -1 → dx = 0.5*100*-1 = -50 → x = 50.
		expect(result.crds[4]).toBeCloseTo(50, 6);
		expect(result.crds[5]).toBe(100); // y unchanged
	});

	it('preserves command list and coordinate length', () => {
		const wave: WaveState = { amplitude: 0.3, crests: 4, phase: 1 };
		const result = applyWaveToPath(square, wave);

		expect(result.cmds).toEqual(square.cmds);
		expect(result.cmds).not.toBe(square.cmds);
		expect(result.crds).toHaveLength(square.crds.length);
	});

	it('is deterministic for the same input', () => {
		const wave: WaveState = { amplitude: 0.3, crests: 4, phase: 1 };
		expect(applyWaveToPath(square, wave).crds).toEqual(applyWaveToPath(square, wave).crds);
	});
});
