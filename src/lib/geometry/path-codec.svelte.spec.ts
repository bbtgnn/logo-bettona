import { describe, it, expect, beforeEach } from 'vitest';
import paper from 'paper';
import type { Path } from '$lib/types';
import { toPaperPath, fromPaperPath } from './path-codec';

let scope: paper.PaperScope;

beforeEach(() => {
	scope = new paper.PaperScope();
	scope.setup(new paper.Size(1, 1));
});

function expectPathClose(actual: Path, expected: Path, eps = 1e-6) {
	expect(actual.cmds).toEqual(expected.cmds);
	expect(actual.crds.length).toBe(expected.crds.length);
	actual.crds.forEach((v, i) => expect(v).toBeCloseTo(expected.crds[i], 6));
}

describe('Path codec round-trip', () => {
	it('round-trips a cubic open path (M/C) as an identity', () => {
		// The default ring template shape: M then two cubics.
		const p: Path = {
			cmds: ['M', 'C', 'C'],
			crds: [20, 117.6, 59, 117.5, 32.4, 82.7, 61.7, 62.8, 83.4, 47.9, 101, 66.5, 180, 67.4]
		};
		expectPathClose(fromPaperPath(toPaperPath(p, scope)), p);
	});

	it('closes a polygon with an explicit closing edge before Z', () => {
		// A closed path gains the edge back to the start as an explicit command
		// (historical emit behaviour): M/L/L/Z → M/L/L/L/Z with the closing L to (0,0).
		const p: Path = { cmds: ['M', 'L', 'L', 'Z'], crds: [0, 0, 50, 100, -50, 100] };
		expectPathClose(fromPaperPath(toPaperPath(p, scope)), {
			cmds: ['M', 'L', 'L', 'L', 'Z'],
			crds: [0, 0, 50, 100, -50, 100, 0, 0]
		});
	});

	it('returns an empty Path for an empty paper path', () => {
		expect(fromPaperPath(new paper.Path())).toEqual({ cmds: [], crds: [] });
	});

	it('emits Z only when the paper path is closed', () => {
		const open = fromPaperPath(toPaperPath({ cmds: ['M', 'L'], crds: [0, 0, 10, 10] }, scope));
		expect(open.cmds).not.toContain('Z');
	});
});

describe('Path codec Q invariant', () => {
	it('accepts Q on the way in but never emits Q (quadratic survives as an equivalent cubic)', () => {
		const q: Path = { cmds: ['M', 'Q'], crds: [0, 0, 10, 20, 20, 0] };
		const out = fromPaperPath(toPaperPath(q, scope));
		expect(out.cmds).toEqual(['M', 'C']);
		// Endpoint preserved by the quadratic→cubic build.
		expect(out.crds.slice(-2)).toEqual([20, 0]);
	});
});
