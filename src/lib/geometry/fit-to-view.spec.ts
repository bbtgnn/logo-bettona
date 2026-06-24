import { describe, it, expect } from 'vitest';
import { computeFitToView } from './fit-to-view';

const view = { width: 200, height: 200 };

describe('computeFitToView', () => {
	it('returns the scale that fits the larger bound into the padded view', () => {
		// available = min(200,200) - 14*2 = 172; larger bound = 100 → 1.72
		expect(computeFitToView({ width: 100, height: 50 }, view, 14)).toBeCloseTo(1.72, 5);
	});

	it('uses the larger of width/height as the divisor', () => {
		expect(computeFitToView({ width: 40, height: 80 }, view, 0)).toBeCloseTo(200 / 80, 5);
	});

	it('returns null for a degenerate bound (zero width or height)', () => {
		expect(computeFitToView({ width: 0, height: 50 }, view, 14)).toBeNull();
		expect(computeFitToView({ width: 50, height: 0 }, view, 14)).toBeNull();
	});

	it('returns null when padding leaves no available space', () => {
		expect(computeFitToView({ width: 50, height: 50 }, { width: 20, height: 20 }, 14)).toBeNull();
	});
});
