import { describe, it, expect } from 'vitest';
import { applyColors, applyMonochrome, applyPalette, parseHexColors } from './apply';

describe('parseHexColors', () => {
	it('parses valid 6-digit hex values', () => {
		expect(parseHexColors('#ff0000, #00ff00')).toEqual(['#ff0000', '#00ff00']);
	});

	it('parses valid 3-digit hex values', () => {
		expect(parseHexColors('#f00, #0f0')).toEqual(['#f00', '#0f0']);
	});

	it('skips invalid entries, keeps valid ones', () => {
		expect(parseHexColors('#ff0000, notacolor, #0000ff')).toEqual(['#ff0000', '#0000ff']);
	});

	it('falls back to black/white when all entries are invalid', () => {
		expect(parseHexColors('red, green, blue')).toEqual(['#000000', '#ffffff']);
	});

	it('falls back to black/white for empty input', () => {
		expect(parseHexColors('')).toEqual(['#000000', '#ffffff']);
	});
});

describe('applyMonochrome', () => {
	it('outermost ring (last index) gets main color', () => {
		const result = applyMonochrome({ main: '#000000', bg: '#ffffff' }, 4);
		expect(result[3]).toBe('#000000');
	});

	it('alternates strictly inward from outermost', () => {
		const result = applyMonochrome({ main: '#000000', bg: '#ffffff' }, 4);
		// index 3 = main, 2 = bg, 1 = main, 0 = bg
		expect(result).toEqual(['#ffffff', '#000000', '#ffffff', '#000000']);
	});

	it('even ring count: innermost gets bg', () => {
		const result = applyMonochrome({ main: '#111111', bg: '#eeeeee' }, 4);
		expect(result[0]).toBe('#eeeeee');
	});

	it('odd ring count: innermost gets main', () => {
		const result = applyMonochrome({ main: '#111111', bg: '#eeeeee' }, 3);
		// index 2 = main, 1 = bg, 0 = main
		expect(result[0]).toBe('#111111');
	});

	it('single ring gets main color', () => {
		const result = applyMonochrome({ main: '#ff0000', bg: '#0000ff' }, 1);
		expect(result).toEqual(['#ff0000']);
	});
});

describe('applyPalette', () => {
	it('single color palette applies that color to all rings', () => {
		const result = applyPalette({ colors: ['#ff0000'] }, 5);
		expect(result).toEqual(['#ff0000', '#ff0000', '#ff0000', '#ff0000', '#ff0000']);
	});

	it('no two adjacent rings share the same color (run multiple times)', () => {
		for (let run = 0; run < 20; run++) {
			const result = applyPalette({ colors: ['#ff0000', '#00ff00', '#0000ff'] }, 8);
			for (let i = 1; i < result.length; i++) {
				expect(result[i]).not.toBe(result[i - 1]);
			}
		}
	});

	it('loops when palette is shorter than ring count', () => {
		// 2 colors, 6 rings — all rings must get a color
		const result = applyPalette({ colors: ['#aaaaaa', '#bbbbbb'] }, 6);
		expect(result).toHaveLength(6);
		result.forEach((c) => expect(['#aaaaaa', '#bbbbbb']).toContain(c));
	});

	it('returns correct length', () => {
		const result = applyPalette({ colors: ['#ff0000', '#00ff00'] }, 10);
		expect(result).toHaveLength(10);
	});
});

describe('applyColors', () => {
	const mono = { main: '#000000', bg: '#ffffff' };
	const full = { colors: ['#ff0000', '#00ff00', '#0000ff'] };
	const current = ['#aabbcc', '#ddeeff'];

	it('manual mode returns current colors unchanged', () => {
		expect(applyColors('manual', mono, full, current, 2)).toEqual(current);
	});

	it('monochrome mode delegates to applyMonochrome', () => {
		const result = applyColors('monochrome', mono, full, current, 3);
		expect(result).toEqual(applyMonochrome(mono, 3));
	});

	it('palette mode returns correct length', () => {
		const result = applyColors('palette', mono, full, current, 5);
		expect(result).toHaveLength(5);
	});

	it('returns empty array for zero rings', () => {
		expect(applyColors('monochrome', mono, full, [], 0)).toEqual([]);
	});

	it('falls back to default mono palette when undefined', () => {
		const result = applyColors('monochrome', undefined, undefined, [], 2);
		expect(result).toHaveLength(2);
	});
});
