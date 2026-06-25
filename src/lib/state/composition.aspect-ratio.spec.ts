import { describe, it, expect, beforeEach } from 'vitest';
import { composition } from './composition-persistence.svelte';
import { setAspectRatio } from './composition';
import { DEFAULT_COMPOSITION } from './default';

describe('setAspectRatio', () => {
	beforeEach(() => {
		composition.aspectRatio = '1:1';
	});

	it('updates composition.aspectRatio', () => {
		setAspectRatio('16:9');
		expect(composition.aspectRatio).toBe('16:9');
	});

	it('then back to another ratio (idempotent write)', () => {
		setAspectRatio('9:16');
		expect(composition.aspectRatio).toBe('9:16');
		setAspectRatio('4:5');
		expect(composition.aspectRatio).toBe('4:5');
	});

	it('the default composition starts at 1:1', () => {
		expect(DEFAULT_COMPOSITION.aspectRatio).toBe('1:1');
	});
});
