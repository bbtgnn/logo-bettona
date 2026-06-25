import { describe, it, expect } from 'vitest';
import { clampProgress } from './canvas-export';

describe('clampProgress', () => {
	it('is 0 at start, 0.5 at half, 1 at end', () => {
		expect(clampProgress(0, 5000)).toBe(0);
		expect(clampProgress(2500, 5000)).toBeCloseTo(0.5, 6);
		expect(clampProgress(5000, 5000)).toBe(1);
	});
	it('clamps past the end to 1 and never goes below 0', () => {
		expect(clampProgress(9999, 5000)).toBe(1);
		expect(clampProgress(-10, 5000)).toBe(0);
	});
	it('returns 1 for a non-positive duration (degenerate)', () => {
		expect(clampProgress(0, 0)).toBe(1);
	});
});
