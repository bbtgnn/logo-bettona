import { describe, it, expect, beforeEach } from 'vitest';
import paper from 'paper';
import { buildRingPath } from './bend';
import type { Ring, Path } from '$lib/types';

let scope: paper.PaperScope;

beforeEach(() => {
	scope = new paper.PaperScope();
	scope.setup(new paper.Size(600, 600));
});

// A simple rectangular template path
const rectPath: Path = {
	cmds: ['M', 'L', 'L', 'L', 'Z'],
	crds: [0, 0, 100, 0, 100, 50, 0, 50]
};

const baseRing = (overrides: Partial<Ring> = {}): Ring => ({
	copies: 4,
	color: '#000000',
	ringHeight: 0.5,
	templatePath: rectPath,
	secondaryTemplatePath: null,
	morphT: 0,
	...overrides
});

describe('buildRingPath', () => {
	it('returns null when templatePath is null', () => {
		const ring = baseRing({ templatePath: null });
		const result = buildRingPath(ring, 100, scope);
		expect(result).toBeNull();
	});

	it('returns null for an empty templatePath', () => {
		const ring = baseRing({ templatePath: { cmds: [], crds: [] } });
		const result = buildRingPath(ring, 100, scope);
		expect(result).toBeNull();
	});

	it('produces a closed path', () => {
		const ring = baseRing();
		const result = buildRingPath(ring, 100, scope);
		expect(result).not.toBeNull();
		expect(result!.closed).toBe(true);
	});

	it('all anchor points lie within the expected radial range', () => {
		const radius = 100;
		const ring = baseRing({ copies: 4, ringHeight: 0.5 });
		const result = buildRingPath(ring, radius, scope);
		expect(result).not.toBeNull();

		const rMin = radius * (1 - ring.ringHeight); // 50
		const rMax = radius; // 100

		for (const seg of result!.segments) {
			const dist = seg.point.getDistance(new paper.Point(0, 0));
			expect(dist).toBeGreaterThanOrEqual(rMin - 0.01);
			expect(dist).toBeLessThanOrEqual(rMax + 0.01);
		}
	});

	it('produces 4-fold rotational symmetry for copies=4', () => {
		const ring = baseRing({ copies: 4 });
		const path = buildRingPath(ring, 100, scope);
		expect(path).not.toBeNull();

		const segs = path!.segments;
		const n = segs.length;
		// Rotating the path by 90° should give points that match the originals (shifted by n/4)
		const step = n / 4;
		expect(Number.isInteger(step)).toBe(true);

		for (let i = 0; i < step; i++) {
			const pt = segs[i].point;
			const ptRotated = segs[i + step].point;
			// ptRotated should be pt rotated by 90°
			const expected = pt.rotate(90, new paper.Point(0, 0));
			expect(ptRotated.x).toBeCloseTo(expected.x, 1);
			expect(ptRotated.y).toBeCloseTo(expected.y, 1);
		}
	});

	it('preserves collinearity of handles through a smooth anchor', () => {
		// A path with one smooth (C1) anchor: the junction between two cubic curves
		// where handleIn and handleOut at the junction are opposite vectors
		const smoothPath: Path = {
			// M 0,50
			// C 10,0 40,0 50,50  (cp1=(10,0), cp2=(40,0), end=(50,50))
			// C 60,100 90,100 100,50  (cp1=(60,100), cp2=(90,100), end=(100,50))
			cmds: ['M', 'C', 'C'],
			crds: [
				0, 50,
				10, 0, 40, 0, 50, 50,
				60, 100, 90, 100, 100, 50
			]
		};

		const ring = baseRing({ templatePath: smoothPath, copies: 2 });
		const result = buildRingPath(ring, 150, scope);
		expect(result).not.toBeNull();

		// Check that at the junction segment (index 1), handleIn and handleOut are collinear
		// (cross product of the two handle vectors is ~0)
		const junctionSeg = result!.segments[1];
		const hIn = junctionSeg.handleIn;
		const hOut = junctionSeg.handleOut;

		if (!hIn.isZero() && !hOut.isZero()) {
			// Cross product in 2D: hIn.x * hOut.y - hIn.y * hOut.x ≈ 0 for collinear
			const cross = hIn.x * hOut.y - hIn.y * hOut.x;
			const mag = hIn.length * hOut.length;
			expect(Math.abs(cross) / mag).toBeCloseTo(0, 1);
		}
	});
});
