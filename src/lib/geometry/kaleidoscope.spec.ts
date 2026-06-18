import { describe, it, expect } from 'vitest';
import {
	clampSectors,
	clampRepeat,
	wedgeAngle,
	isSectorMirrored,
	degToRad,
	carpetTileOffsets
} from './kaleidoscope';

describe('kaleidoscope geometry helpers', () => {
	it('clampSectors forces even and clamps to 4..24', () => {
		expect(clampSectors(1)).toBe(4);
		expect(clampSectors(7)).toBe(6);
		expect(clampSectors(8)).toBe(8);
		expect(clampSectors(99)).toBe(24);
	});

	it('clampRepeat clamps to integer 1..10', () => {
		expect(clampRepeat(0)).toBe(1);
		expect(clampRepeat(3.7)).toBe(3);
		expect(clampRepeat(50)).toBe(10);
	});

	it('wedgeAngle is 2π / sectors', () => {
		expect(wedgeAngle(6)).toBeCloseTo((2 * Math.PI) / 6, 10);
	});

	it('isSectorMirrored mirrors even indices', () => {
		expect(isSectorMirrored(0)).toBe(true);
		expect(isSectorMirrored(1)).toBe(false);
		expect(isSectorMirrored(2)).toBe(true);
	});

	it('degToRad converts degrees to radians', () => {
		expect(degToRad(180)).toBeCloseTo(Math.PI, 10);
	});

	it('carpetTileOffsets returns repeat² centered offsets', () => {
		const offsets = carpetTileOffsets(2, 10, 20);
		expect(offsets).toHaveLength(4);
		const sumX = offsets.reduce((a, o) => a + o.x, 0);
		const sumY = offsets.reduce((a, o) => a + o.y, 0);
		expect(sumX).toBeCloseTo(0, 10);
		expect(sumY).toBeCloseTo(0, 10);
		expect(offsets).toContainEqual({ x: -5, y: -10 });
	});
});
