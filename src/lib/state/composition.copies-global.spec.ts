import { describe, it, expect, beforeEach } from 'vitest';
import { composition } from '$lib/state/composition-persistence.svelte';
import { normalizeComposition } from '$lib/state/composition-persistence.svelte';
import { setCopies } from '$lib/state/composition';
import type { Composition } from '$lib/types';

function baseComposition(overrides: Partial<Composition> = {}): Composition {
	return {
		baseRadius: 5,
		ringIncrement: 2,
		copies: 8,
		aspectRatio: '1:1',
		rings: [],
		monochromePalettes: [{ primary: '#000', secondary: '#fff', background: '#fff' }],
		fullPalettes: [],
		...overrides
	};
}

describe('copies is global', () => {
	beforeEach(() => {
		composition.copies = 8;
	});

	it('setCopies writes the global value clamped to >= 1', () => {
		setCopies(12);
		expect(composition.copies).toBe(12);
		setCopies(0);
		expect(composition.copies).toBe(1);
	});
});

describe('normalizeComposition copies backfill', () => {
	it('adds copies from the first legacy ring when the global field is missing', () => {
		const legacy = baseComposition() as unknown as Record<string, unknown>;
		delete legacy.copies;
		(legacy.rings as unknown[]) = [{ id: 'a', copies: 6, color: '#000', templatePath: null, secondaryTemplatePath: null, morphT: 0, ringHeight: 0.12 }];
		const out = normalizeComposition(legacy as unknown as Composition);
		expect(out.copies).toBe(6);
	});

	it('defaults copies to 8 when neither global nor any ring carries it', () => {
		const legacy = baseComposition() as unknown as Record<string, unknown>;
		delete legacy.copies;
		const out = normalizeComposition(legacy as unknown as Composition);
		expect(out.copies).toBe(8);
	});

	it('keeps an already-present global copies value (idempotent)', () => {
		const out = normalizeComposition(baseComposition({ copies: 10 }));
		expect(out.copies).toBe(10);
	});
});
