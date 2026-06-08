import { describe, expect, it } from 'vitest';
import { reduceToBands } from './audio-source';

describe('reduceToBands', () => {
	it('returns an empty array for a non-positive ring count', () => {
		const freq = new Uint8Array(1024).fill(128);
		expect(reduceToBands(freq, 0, 20, 20000, 48000, 2048, 1)).toEqual([]);
	});

	it('returns one value per ring, all within 0..1', () => {
		const freq = new Uint8Array(1024).fill(128);
		const bands = reduceToBands(freq, 4, 20, 20000, 48000, 2048, 1);

		expect(bands).toHaveLength(4);
		for (const value of bands) {
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(1);
		}
		// 128/255 ≈ 0.502 with gain 1
		expect(bands[0]).toBeCloseTo(128 / 255, 2);
	});

	it('clamps at 1 when inputGain pushes a band over', () => {
		const freq = new Uint8Array(1024).fill(128);
		const bands = reduceToBands(freq, 2, 20, 20000, 48000, 2048, 4);
		expect(bands[0]).toBe(1);
	});

	it('puts energy in the matching log band (high bins → high band)', () => {
		const freq = new Uint8Array(1024).fill(0);
		for (let i = 800; i < 1024; i += 1) freq[i] = 200; // high-frequency bins
		const bands = reduceToBands(freq, 4, 20, 20000, 48000, 2048, 1);
		expect(bands[3]).toBeGreaterThan(bands[0]);
		expect(bands[0]).toBe(0);
	});
});
