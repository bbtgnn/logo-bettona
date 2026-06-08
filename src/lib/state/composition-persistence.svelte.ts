import { untrack } from 'svelte';
import { localStorageSync } from 'rune-sync/localstorage';
import type { Composition } from '$lib/types';
import { DEFAULT_COMPOSITION } from './default';

/**
 * Returns a copy of the composition with the transient `wave` field removed from
 * every ring. Persistence and the dirty-check both operate on this shape, so the
 * audio-driven wave never reaches localStorage and a reload never restores a
 * rippled logo. The stored shape is byte-identical to the pre-wave format.
 */
function stripWave(composition: Composition): Composition {
	return {
		...composition,
		rings: composition.rings.map((ring) => {
			const rest = { ...ring };
			delete rest.wave;
			return rest;
		})
	};
}

/**
 * Creates a `$state` composition synced to localStorage via the genuine
 * `localStorageSync` driver, but with the dirty-check gated on the wave-stripped
 * snapshot: a frame that changes only `ring.wave` performs no `setItem`.
 *
 * Modeled on rune-sync's createSyncState lifecycle (effect root + read on init +
 * cross-tab subscribe), narrowed to our stripping requirement.
 */
export function createPersistedComposition(key: string, initial: Composition): Composition {
	const state = $state<Composition>(structuredClone(initial));

	if (typeof window === 'undefined') return state;

	$effect.root(() => {
		let lastSavedStripped: string;

		untrack(() => {
			const saved = localStorageSync.read<Composition>(key);
			if (saved) Object.assign(state, saved);
			lastSavedStripped = JSON.stringify(stripWave($state.snapshot(state) as Composition));
		});

		if (localStorageSync.subscribe) {
			localStorageSync.subscribe<Composition>(key, (remote) => {
				untrack(() => {
					Object.assign(state, remote);
					lastSavedStripped = JSON.stringify(stripWave($state.snapshot(state) as Composition));
				});
			});
		}

		$effect(() => {
			const stripped = stripWave($state.snapshot(state) as Composition);
			const serialized = JSON.stringify(stripped);
			if (serialized === lastSavedStripped) return; // wave-only change → no write
			untrack(() => {
				localStorageSync.write(key, stripped);
				lastSavedStripped = serialized;
			});
		});
	});

	return state;
}

export const composition = createPersistedComposition('composition', DEFAULT_COMPOSITION);
