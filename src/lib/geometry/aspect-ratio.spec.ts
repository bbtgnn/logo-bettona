import { describe, it, expect } from 'vitest';
import { ratioToCanvasSize, ASPECT_RATIOS } from './aspect-ratio';

describe('ratioToCanvasSize (longSide 600)', () => {
	it('1:1 → 600×600', () => {
		expect(ratioToCanvasSize('1:1', 600)).toEqual({ width: 600, height: 600 });
	});
	it('16:9 → 600×338 (long side on width)', () => {
		expect(ratioToCanvasSize('16:9', 600)).toEqual({ width: 600, height: 338 });
	});
	it('9:16 → 338×600 (long side on height)', () => {
		expect(ratioToCanvasSize('9:16', 600)).toEqual({ width: 338, height: 600 });
	});
	it('3:4 → 450×600, 4:3 → 600×450', () => {
		expect(ratioToCanvasSize('3:4', 600)).toEqual({ width: 450, height: 600 });
		expect(ratioToCanvasSize('4:3', 600)).toEqual({ width: 600, height: 450 });
	});
	it('4:5 → 480×600, 5:4 → 600×480', () => {
		expect(ratioToCanvasSize('4:5', 600)).toEqual({ width: 480, height: 600 });
		expect(ratioToCanvasSize('5:4', 600)).toEqual({ width: 600, height: 480 });
	});
	it('exposes all 7 presets in order', () => {
		expect(ASPECT_RATIOS).toEqual(['1:1', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9']);
	});
});
