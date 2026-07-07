import { describe, it, expect, beforeEach } from 'vitest';
import { composition } from '$lib/state/composition-persistence.svelte';
import {
	addRingWithPath,
	colorMode,
	duplicateRing,
	renameRing,
	setRingIncrementOverride
} from '$lib/state/composition';
import type { Path } from '$lib/types';

const P: Path = { cmds: ['M', 'L'], crds: [0, 0, 10, 10] };

describe('duplicateRing', () => {
	beforeEach(() => {
		composition.rings = [];
		// duplicateRing calls applyColorMode(), which recomputes colors from the
		// mono/palette scheme. That's a separate concern (already exercised by
		// addRingWithPath/reorderRings); set 'manual' so the dedicated `color`
		// field on the ring is what this test actually observes.
		colorMode.mode = 'manual';
		addRingWithPath(P);
		addRingWithPath(P);
	});

	it('inserts a clone right after the source with a new id', () => {
		const sourceId = composition.rings[0].id;
		duplicateRing(0);
		expect(composition.rings).toHaveLength(3);
		expect(composition.rings[1].id).not.toBe(sourceId);
	});

	it('clones dedicated params and the increment override', () => {
		renameRing(0, 'Corona');
		setRingIncrementOverride(0, 3);
		composition.rings = composition.rings.map((r, i) => (i === 0 ? { ...r, ringHeight: 0.4, color: '#abc' } : r));
		duplicateRing(0);
		const clone = composition.rings[1];
		expect(clone.name).toBe('Corona');
		expect(clone.incrementOverride).toBe(3);
		expect(clone.ringHeight).toBe(0.4);
		expect(clone.color).toBe('#abc');
	});

	it('deep-copies the template path (no shared reference)', () => {
		duplicateRing(0);
		expect(composition.rings[1].templatePath).toEqual(composition.rings[0].templatePath);
		expect(composition.rings[1].templatePath).not.toBe(composition.rings[0].templatePath);
	});

	it('does not inherit transient wave/zoneDrive runtime state from the source', () => {
		composition.rings = composition.rings.map((r, i) =>
			i === 0
				? {
						...r,
						wave: { amplitude: 0.5, crests: 2, phase: 0 },
						zoneDrive: { bassPush: 1, midPush: 0, trebleRetract: 0, trebleVibrate: 0 }
					}
				: r
		);
		duplicateRing(0);
		const clone = composition.rings[1];
		expect(clone.wave).toBeFalsy();
		expect(clone.zoneDrive).toBeFalsy();
	});
});
