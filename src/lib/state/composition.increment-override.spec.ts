import { describe, it, expect, beforeEach } from 'vitest';
import { composition } from '$lib/state/composition-persistence.svelte';
import { addRingWithPath, setRingIncrementOverride } from '$lib/state/composition';
import type { Path } from '$lib/types';

const P: Path = { cmds: ['M', 'L'], crds: [0, 0, 10, 10] };

describe('setRingIncrementOverride', () => {
	beforeEach(() => {
		composition.rings = [];
		addRingWithPath(P);
		addRingWithPath(P);
	});

	it('sets a numeric override on a ring', () => {
		setRingIncrementOverride(1, 4);
		expect(composition.rings[1].incrementOverride).toBe(4);
	});

	it('clears the override back to null', () => {
		setRingIncrementOverride(1, 4);
		setRingIncrementOverride(1, null);
		expect(composition.rings[1].incrementOverride).toBeNull();
	});
});
