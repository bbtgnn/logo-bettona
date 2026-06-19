import { describe, it, expect } from 'vitest';
import { xFromTime, timeFromX, yFromValue, valueFromY, formatSeconds } from './timeline-geometry';

describe('timeline geometry', () => {
	it('maps time to x and back', () => {
		expect(xFromTime(0.5, 200)).toBe(100);
		expect(timeFromX(100, 200)).toBe(0.5);
	});

	it('clamps time from x to 0..1', () => {
		expect(timeFromX(-10, 200)).toBe(0);
		expect(timeFromX(999, 200)).toBe(1);
	});

	it('guards zero width', () => {
		expect(timeFromX(50, 0)).toBe(0);
	});

	it('maps value to y inverted (max at top = y 0)', () => {
		expect(yFromValue(360, 0, 360, 100)).toBe(0);
		expect(yFromValue(0, 0, 360, 100)).toBe(100);
		expect(yFromValue(180, 0, 360, 100)).toBe(50);
	});

	it('maps y back to value, clamped to range', () => {
		expect(valueFromY(0, 0, 360, 100)).toBeCloseTo(360, 6);
		expect(valueFromY(100, 0, 360, 100)).toBeCloseTo(0, 6);
		expect(valueFromY(-50, 0, 360, 100)).toBe(360);
		expect(valueFromY(150, 0, 360, 100)).toBe(0);
	});
});

describe('formatSeconds', () => {
	it('drops the decimal for whole seconds', () => {
		expect(formatSeconds(3)).toBe('3s');
		expect(formatSeconds(0)).toBe('0s');
	});
	it('keeps one decimal for fractional seconds', () => {
		expect(formatSeconds(1.5)).toBe('1.5s');
	});
	it('rounds to one decimal', () => {
		expect(formatSeconds(1.234)).toBe('1.2s');
	});
});
