import { describe, it, expect } from 'vitest';
import { computeRingRadii } from './ring-radii';
import type { Composition, Ring } from '$lib/types';

function ring(overrides: Partial<Ring> = {}): Ring {
	return {
		id: Math.random().toString(),
		color: '#000',
		templatePath: null,
		secondaryTemplatePath: null,
		morphT: 0,
		ringHeight: 0.12,
		...overrides
	};
}

function comp(rings: Ring[]): Composition {
	return {
		baseRadius: 5,
		ringIncrement: 2,
		copies: 8,
		aspectRatio: '1:1',
		rings,
		monochromePalettes: [],
		fullPalettes: []
	};
}

describe('computeRingRadii', () => {
	it('places the innermost ring at baseRadius', () => {
		expect(computeRingRadii(comp([ring()]))[0]).toBe(5);
	});

	it('reduces to baseRadius + ringIncrement*i without overrides', () => {
		expect(computeRingRadii(comp([ring(), ring(), ring(), ring()]))).toEqual([5, 7, 9, 11]);
	});

	it('applies a per-ring override and shifts itself and every later ring', () => {
		const rings = [ring(), ring(), ring({ incrementOverride: 3 }), ring()];
		expect(computeRingRadii(comp(rings))).toEqual([5, 7, 10, 12]);
	});

	it('ignores the override on the innermost ring (no previous ring)', () => {
		const rings = [ring({ incrementOverride: 99 }), ring()];
		expect(computeRingRadii(comp(rings))).toEqual([5, 7]);
	});
});
