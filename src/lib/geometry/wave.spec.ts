import { describe, expect, it } from 'vitest';
import type { Path, WaveState } from '$lib/types';
import { applyWaveToPath } from './wave';

const square: Path = {
	cmds: ['M', 'L', 'L', 'L', 'Z'],
	crds: [0, 0, 100, 0, 100, 100, 0, 100]
};

// Points at nx = 0 (axis), 0.5 (mid-petal) and 1 (copy junction). The mid point
// sits at ny=0 so the longitudinal sine collapses to sin(phase).
const bar: Path = {
	cmds: ['M', 'L', 'L', 'Z'],
	crds: [0, 0, 50, 0, 100, 0]
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

	it('tapers displacement to zero at the angular edges (nx=0 and nx=1)', () => {
		// Window W(nx)=sin(pi*nx) must vanish at nx=0 and nx=1 so the mirrored
		// half-arc and the tiled copies rejoin without a step.
		const wave: WaveState = { amplitude: 0.5, crests: 1, phase: Math.PI / 2 };
		const result = applyWaveToPath(bar, wave);

		// nx=0 (x=0) → W(0)=0 → dx=0.
		expect(result.crds[0]).toBeCloseTo(0, 6);
		// nx=1 (x=100) → W(1)=0 → dx=0.
		expect(result.crds[4]).toBeCloseTo(100, 6);
	});

	it('shifts x by amplitude*width*sin(crests*pi*ny + phase)*sin(pi*nx), y unchanged', () => {
		// width=100, minX=0. Mid point (50,0): nx=0.5 → W=1, ny=0 → sin(phase).
		// phase=pi/2 → sin(pi/2)=1 → dx = 0.5*100*1*1 = 50 → x = 100.
		const wave: WaveState = { amplitude: 0.5, crests: 1, phase: Math.PI / 2 };
		const result = applyWaveToPath(bar, wave);

		expect(result.crds[2]).toBeCloseTo(100, 6);
		expect(result.crds[3]).toBe(0); // y unchanged
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
