import { describe, expect, it } from 'vitest';
import { createFallbackBars } from './fallback-bars';

describe('createFallbackBars', () => {
	it('returns one value per ring in the 0..1 range', () => {
		const source = createFallbackBars({ getRingCount: () => 5 });
		const bars = source.readBars();

		expect(bars).toHaveLength(5);
		for (const value of bars) {
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(1);
		}
	});

	it('adapts length to the current ring count', () => {
		let count = 2;
		const source = createFallbackBars({ getRingCount: () => count });
		expect(source.readBars()).toHaveLength(2);
		count = 4;
		expect(source.readBars()).toHaveLength(4);
	});

	it('returns an empty array for a non-positive ring count', () => {
		const source = createFallbackBars({ getRingCount: () => 0 });
		expect(source.readBars()).toEqual([]);
	});
});
