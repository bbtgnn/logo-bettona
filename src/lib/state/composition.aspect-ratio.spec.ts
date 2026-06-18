import { describe, it, expect, beforeEach } from 'vitest';
import { composition } from './composition-persistence.svelte';
import { setAspectRatio } from './composition';

describe('setAspectRatio', () => {
	beforeEach(() => {
		composition.aspectRatio = '1:1';
	});

	it('updates composition.aspectRatio', () => {
		setAspectRatio('16:9');
		expect(composition.aspectRatio).toBe('16:9');
	});

	it('defaults to 1:1', () => {
		expect(['1:1', '16:9']).toContain(composition.aspectRatio);
	});
});
