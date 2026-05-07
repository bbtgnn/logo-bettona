import { describe, expect, it } from 'vitest';
import { createSimpleDriver } from './simple-driver';

describe('createSimpleDriver', () => {
	it('bounded per-ring emission', () => {
		const driver = createSimpleDriver({
			getRingCount: () => 3,
			getDurationSec: () => 2
		});
		driver.init();
		const frame = driver.frame(1000);

		expect(Object.keys(frame)).toEqual(['0', '1', '2']);
		expect(frame[0]).toBeGreaterThanOrEqual(0);
		expect(frame[0]).toBeLessThanOrEqual(1);
		expect(frame[1]).toBe(frame[0]);
		expect(frame[2]).toBe(frame[0]);
	});

	it('wrap progress when elapsed exceeds duration', () => {
		const driver = createSimpleDriver({
			getRingCount: () => 1,
			getDurationSec: () => 1
		});
		driver.init();
		driver.frame(0);
		const frame = driver.frame(1500);

		expect(frame[0]).toBeCloseTo(0.5, 5);
	});
});
