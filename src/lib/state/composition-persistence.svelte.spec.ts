import { beforeEach, describe, expect, it } from 'vitest';
import { flushSync } from 'svelte';
import type { Composition } from '$lib/types';
import { createPersistedComposition } from './composition-persistence.svelte';

function makeComposition(): Composition {
	return {
		baseRadius: 100,
		ringIncrement: 60,
		rings: [
			{
				copies: 4,
				color: '#000000',
				templatePath: { cmds: ['M', 'L'], crds: [0, 0, 10, 10] },
				secondaryTemplatePath: null,
				morphT: 0,
				ringHeight: 0.4
			}
		],
		monochromePalettes: [{ main: '#000', bg: '#fff' }],
		fullPalettes: [{ colors: ['#000', '#fff'] }]
	};
}

let key = '';
let counter = 0;

beforeEach(() => {
	counter += 1;
	key = `test-composition-${counter}`;
	localStorage.clear();
});

describe('createPersistedComposition', () => {
	it('persists non-wave changes to localStorage under the given key', () => {
		const state = createPersistedComposition(key, makeComposition());

		flushSync(() => {
			state.baseRadius = 200;
		});

		const stored = JSON.parse(localStorage.getItem(key) ?? '{}');
		expect(stored.baseRadius).toBe(200);
	});

	it('does not write to localStorage when only ring.wave changes', () => {
		const state = createPersistedComposition(key, makeComposition());

		// Establish a known stored baseline via a non-wave change.
		flushSync(() => {
			state.baseRadius = 150;
		});
		const before = localStorage.getItem(key);

		// Mutating only wave must not change what is stored.
		flushSync(() => {
			state.rings = state.rings.map((ring) => ({
				...ring,
				wave: { amplitude: 0.4, crests: 3, phase: 1.2 }
			}));
		});

		expect(localStorage.getItem(key)).toBe(before);
	});

	it('never includes a wave key in the stored blob', () => {
		const state = createPersistedComposition(key, makeComposition());

		flushSync(() => {
			state.rings = state.rings.map((ring) => ({
				...ring,
				wave: { amplitude: 0.4, crests: 3, phase: 1.2 }
			}));
			state.baseRadius = 175; // force a write
		});

		const stored = JSON.parse(localStorage.getItem(key) ?? '{}');
		expect(stored.rings[0].wave).toBeUndefined();
		expect(stored.baseRadius).toBe(175);
	});

	it('loads a previously stored wave-less composition unchanged', () => {
		const saved = makeComposition();
		saved.baseRadius = 321;
		localStorage.setItem(key, JSON.stringify(saved));

		const state = createPersistedComposition(key, makeComposition());
		expect(state.baseRadius).toBe(321);
	});

	it('persists ring.waveConfig to localStorage', () => {
		const state = createPersistedComposition(key, makeComposition());

		flushSync(() => {
			state.rings = state.rings.map((ring) => ({
				...ring,
				waveConfig: { crests: 5, amplitudeGain: 0.8, phaseSpeed: 1.0 }
			}));
		});

		const stored = JSON.parse(localStorage.getItem(key) ?? '{}');
		expect(stored.rings[0].waveConfig).toEqual({ crests: 5, amplitudeGain: 0.8, phaseSpeed: 1.0 });
	});

	it('strips ring.wave but preserves ring.waveConfig in the same write', () => {
		const state = createPersistedComposition(key, makeComposition());

		flushSync(() => {
			state.rings = state.rings.map((ring) => ({
				...ring,
				wave: { amplitude: 0.4, crests: 3, phase: 1.2 },
				waveConfig: { crests: 4, amplitudeGain: 0.5, phaseSpeed: 2.0 }
			}));
			state.baseRadius = 175; // force a write (wave-only change wouldn't trigger)
		});

		const stored = JSON.parse(localStorage.getItem(key) ?? '{}');
		expect(stored.rings[0].wave).toBeUndefined();
		expect(stored.rings[0].waveConfig).toEqual({ crests: 4, amplitudeGain: 0.5, phaseSpeed: 2.0 });
	});

	it('does not write to localStorage when only ring.zoneDrive changes', () => {
		const state = createPersistedComposition(key, makeComposition());

		flushSync(() => { state.baseRadius = 150; });
		const before = localStorage.getItem(key);

		flushSync(() => {
			state.rings = state.rings.map((ring) => ({
				...ring,
				zoneDrive: { bassPush: 10, midPush: 5, trebleRetract: 3, trebleVibrate: 2 }
			}));
		});

		expect(localStorage.getItem(key)).toBe(before);
	});

	it('never includes a zoneDrive key in the stored blob', () => {
		const state = createPersistedComposition(key, makeComposition());

		flushSync(() => {
			state.rings = state.rings.map((ring) => ({
				...ring,
				zoneDrive: { bassPush: 10, midPush: 5, trebleRetract: 3, trebleVibrate: 2 }
			}));
			state.baseRadius = 175; // force a write
		});

		const stored = JSON.parse(localStorage.getItem(key) ?? '{}');
		expect(stored.rings[0].zoneDrive).toBeUndefined();
		expect(stored.baseRadius).toBe(175);
	});

	it('persists ring.zoneConfig to localStorage', () => {
		const state = createPersistedComposition(key, makeComposition());

		flushSync(() => {
			state.rings = state.rings.map((ring) => ({
				...ring,
				zoneConfig: { bass: 0.8, mid: 0.4, treble: 0.6 }
			}));
		});

		const stored = JSON.parse(localStorage.getItem(key) ?? '{}');
		expect(stored.rings[0].zoneConfig).toEqual({ bass: 0.8, mid: 0.4, treble: 0.6 });
	});

	it('strips zoneDrive but preserves zoneConfig in the same write', () => {
		const state = createPersistedComposition(key, makeComposition());

		flushSync(() => {
			state.rings = state.rings.map((ring) => ({
				...ring,
				zoneDrive: { bassPush: 10, midPush: 5, trebleRetract: 3, trebleVibrate: 2 },
				zoneConfig: { bass: 0.9, mid: 0.5, treble: 0.1 }
			}));
			state.baseRadius = 175;
		});

		const stored = JSON.parse(localStorage.getItem(key) ?? '{}');
		expect(stored.rings[0].zoneDrive).toBeUndefined();
		expect(stored.rings[0].zoneConfig).toEqual({ bass: 0.9, mid: 0.5, treble: 0.1 });
	});
});