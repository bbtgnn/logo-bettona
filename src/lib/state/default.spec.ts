import { describe, it, expect } from 'vitest';
import { DEFAULT_COMPOSITION, DEFAULT_RING_PATH } from './default';

describe('DEFAULT_COMPOSITION', () => {
	it('seeds exactly one ring on the default curve', () => {
		expect(DEFAULT_COMPOSITION.rings).toHaveLength(1);
	});

	it('seeds the ring with the default arc as its primary curve, no morph', () => {
		const ring = DEFAULT_COMPOSITION.rings[0];
		expect(ring.templatePath).toEqual(DEFAULT_RING_PATH);
		expect(ring.secondaryTemplatePath).toBeNull();
		expect(ring.morphT).toBe(0);
		expect(ring.copies).toBe(8);
	});
});
