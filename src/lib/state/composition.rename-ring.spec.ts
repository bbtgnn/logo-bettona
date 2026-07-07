import { describe, it, expect, beforeEach } from 'vitest';
import { composition } from '$lib/state/composition-persistence.svelte';
import { addRingWithPath, renameRing } from '$lib/state/composition';
import type { Path } from '$lib/types';

const P: Path = { cmds: ['M', 'L'], crds: [0, 0, 10, 10] };

describe('renameRing', () => {
	beforeEach(() => {
		composition.rings = [];
		addRingWithPath(P);
	});

	it('stores a trimmed custom name', () => {
		renameRing(0, '  Corona  ');
		expect(composition.rings[0].name).toBe('Corona');
	});

	it('stores empty string when cleared', () => {
		renameRing(0, 'X');
		renameRing(0, '   ');
		expect(composition.rings[0].name).toBe('');
	});
});
