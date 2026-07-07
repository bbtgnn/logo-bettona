import { describe, it, expect } from 'vitest';
import {
	PRINT_FORMATS,
	orientedDimensionsMm,
	printFormatPixelSize
} from './print-format';

describe('print-format', () => {
	it('lists A5, A4, A3, Letter with portrait mm dimensions', () => {
		const ids = PRINT_FORMATS.map((f) => f.id);
		expect(ids).toEqual(['a5', 'a4', 'a3', 'letter']);
		const a4 = PRINT_FORMATS.find((f) => f.id === 'a4')!;
		expect(a4.widthMm).toBe(210);
		expect(a4.heightMm).toBe(297);
	});

	it('portrait keeps width < height; landscape swaps', () => {
		expect(orientedDimensionsMm('a4', 'portrait')).toEqual({ widthMm: 210, heightMm: 297 });
		expect(orientedDimensionsMm('a4', 'landscape')).toEqual({ widthMm: 297, heightMm: 210 });
	});

	it('A4 @ 300 DPI portrait is 2480 x 3508 px', () => {
		expect(printFormatPixelSize('a4', 'portrait', 300)).toEqual({ width: 2480, height: 3508 });
	});

	it('Letter has its own non-A proportion', () => {
		const letter = PRINT_FORMATS.find((f) => f.id === 'letter')!;
		expect(letter.widthMm).toBeCloseTo(215.9, 1);
		expect(letter.heightMm).toBeCloseTo(279.4, 1);
	});
});
