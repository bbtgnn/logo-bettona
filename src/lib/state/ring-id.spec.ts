import { describe, it, expect } from 'vitest';
import { newRingId } from './ring-id';

describe('newRingId', () => {
	it('returns a non-empty string', () => {
		expect(newRingId().length).toBeGreaterThan(0);
	});

	it('returns a different id on each call', () => {
		const ids = new Set(Array.from({ length: 50 }, () => newRingId()));
		expect(ids.size).toBe(50);
	});
});
