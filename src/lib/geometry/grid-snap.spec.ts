import { describe, it, expect } from 'vitest';
import { snapToGrid, constrainTo45 } from './grid-snap';

const G = { left: 0, top: 0, stepX: 10, stepY: 10 };

describe('snapToGrid', () => {
	it('rounds to the nearest intersection', () => {
		expect(snapToGrid({ x: 13, y: 7 }, G)).toEqual({ x: 10, y: 10 });
		expect(snapToGrid({ x: 4, y: 4 }, G)).toEqual({ x: 0, y: 0 });
	});
	it('respects a grid offset and non-unit step', () => {
		expect(snapToGrid({ x: 26, y: 26 }, { left: 0, top: 0, stepX: 8, stepY: 8 })).toEqual({ x: 24, y: 24 });
		expect(snapToGrid({ x: 11, y: 11 }, { left: 5, top: 5, stepX: 10, stepY: 10 })).toEqual({ x: 15, y: 15 });
	});
});

describe('constrainTo45', () => {
	const o = { x: 0, y: 0 };
	it('snaps a near-horizontal vector to the horizontal axis', () => {
		const r = constrainTo45(o, { x: 10, y: 3 });
		expect(r.y).toBeCloseTo(0, 6);
		expect(r.x).toBeCloseTo(Math.hypot(10, 3), 6);
	});
	it('snaps a near-vertical vector to the vertical axis', () => {
		const r = constrainTo45(o, { x: 3, y: 10 });
		expect(r.x).toBeCloseTo(0, 6);
		expect(r.y).toBeCloseTo(Math.hypot(3, 10), 6);
	});
	it('keeps a 45° vector on the diagonal', () => {
		const r = constrainTo45(o, { x: 10, y: 10 });
		expect(r.x).toBeCloseTo(10, 6);
		expect(r.y).toBeCloseTo(10, 6);
	});
	it('handles the 135° diagonal', () => {
		const r = constrainTo45(o, { x: -10, y: 10 });
		expect(r.x).toBeCloseTo(-10, 6);
		expect(r.y).toBeCloseTo(10, 6);
	});
	it('preserves the vector length', () => {
		const r = constrainTo45(o, { x: 7, y: 2 });
		expect(Math.hypot(r.x, r.y)).toBeCloseTo(Math.hypot(7, 2), 6);
	});
	it('returns the origin for a zero-length vector', () => {
		expect(constrainTo45(o, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
	});
});
