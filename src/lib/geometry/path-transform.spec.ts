import { describe, it, expect } from 'vitest';
import { scalePath, mirrorX } from '$lib/geometry/path-transform';
import type { Path } from '$lib/types';

// Square corners 0,0 .. 10,10 → bbox center (5,5)
const SQUARE: Path = { cmds: ['M', 'L', 'L'], crds: [0, 0, 10, 0, 10, 10] };

describe('scalePath', () => {
	it('keeps cmds and crds length', () => {
		const out = scalePath(SQUARE, 0.5, 0.5);
		expect(out.cmds).toEqual(SQUARE.cmds);
		expect(out.crds).toHaveLength(SQUARE.crds.length);
	});

	it('scales around the bbox center', () => {
		// center (5,5); sx=2 → x' = 5 + (x-5)*2
		const out = scalePath(SQUARE, 2, 1);
		expect(out.crds[0]).toBeCloseTo(-5); // x 0 → 5 + (0-5)*2 = -5
		expect(out.crds[2]).toBeCloseTo(15); // x 10 → 5 + (10-5)*2 = 15
		expect(out.crds[1]).toBeCloseTo(0); // y untouched (sy=1)
	});

	it('does not mutate the input', () => {
		const before = JSON.stringify(SQUARE);
		scalePath(SQUARE, 3, 3);
		expect(JSON.stringify(SQUARE)).toBe(before);
	});
});

describe('mirrorX', () => {
	it('reflects x around the bbox center, leaves y', () => {
		const out = mirrorX(SQUARE);
		expect(out.crds[0]).toBeCloseTo(10); // x 0 → 10
		expect(out.crds[2]).toBeCloseTo(0); // x 10 → 0
		expect(out.crds[5]).toBeCloseTo(10); // y unchanged
	});
});
