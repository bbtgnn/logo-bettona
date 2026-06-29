import { describe, it, expect, beforeEach } from 'vitest';
import { composition } from '$lib/state/composition-persistence.svelte';
import { addRingWithPath } from '$lib/state/composition';
import type { Path } from '$lib/types';

const PRIMARY: Path = { cmds: ['M', 'L'], crds: [0, 0, 10, 10] };
const SECONDARY: Path = { cmds: ['M', 'L'], crds: [0, 0, 20, 20] };

describe('addRingWithPath', () => {
	beforeEach(() => {
		composition.rings = [];
	});

	it('appends a ring carrying a copy of the given primary path', () => {
		addRingWithPath(PRIMARY);
		expect(composition.rings).toHaveLength(1);
		expect(composition.rings[0].templatePath).toEqual(PRIMARY);
		// must be a copy, not the same reference
		expect(composition.rings[0].templatePath).not.toBe(PRIMARY);
		expect(composition.rings[0].secondaryTemplatePath).toBeNull();
		expect(composition.rings[0].morphT).toBe(0);
		expect(typeof composition.rings[0].id).toBe('string');
	});

	it('carries a secondary path and sets morphT to 1 when provided', () => {
		addRingWithPath(PRIMARY, SECONDARY);
		expect(composition.rings[0].secondaryTemplatePath).toEqual(SECONDARY);
		expect(composition.rings[0].secondaryTemplatePath).not.toBe(SECONDARY);
		expect(composition.rings[0].morphT).toBe(1);
	});

	it('appends without dropping existing rings', () => {
		addRingWithPath(PRIMARY);
		addRingWithPath(PRIMARY);
		expect(composition.rings).toHaveLength(2);
		expect(composition.rings[0].id).not.toBe(composition.rings[1].id);
	});
});
