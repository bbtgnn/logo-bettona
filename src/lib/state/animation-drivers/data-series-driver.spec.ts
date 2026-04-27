import { describe, expect, it } from 'vitest';
import { createDataSeriesDriver } from './data-series-driver';

describe('createDataSeriesDriver', () => {
	it('interpolates per ring over normalized series with variable lengths', () => {
		const driver = createDataSeriesDriver({
			seriesByRingIndex: {
				0: [10, 20, 30],
				2: [100, 300]
			},
			speed: 1,
			loop: false
		});

		driver.init();
		const frame = driver.frame(500);

		expect(frame).toEqual({
			0: 0.5,
			2: 0.5
		});
	});

	it('omits rings with missing or empty series from frame output', () => {
		const driver = createDataSeriesDriver({
			seriesByRingIndex: {
				0: [0, 10],
				1: [],
				3: [5]
			},
			speed: 1,
			loop: false
		});

		driver.init();
		const frame = driver.frame(500);

		expect(frame).toEqual({
			0: 0.5,
			3: 0
		});
		expect(frame[1]).toBeUndefined();
		expect(frame[2]).toBeUndefined();
	});
});
