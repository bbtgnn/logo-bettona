import { untrack } from 'svelte';
import { localStorageSync } from 'rune-sync/localstorage';
import type { Composition } from '$lib/types';
import { DEFAULT_COMPOSITION } from './default';

/**
 * Returns a copy of the composition with transient fields (`wave`, `zoneDrive`)
 * removed from every ring. Persistence and the dirty-check both operate on this
 * shape, so audio-driven transients never reach localStorage and a reload never
 * restores them. The stored shape is byte-identical to the pre-transient format.
 */
function stripTransients(composition: Composition): Composition {
	return {
		...composition,
		rings: composition.rings.map((ring) => {
			const rest = { ...ring };
			delete rest.wave;
			delete rest.zoneDrive;
			return rest;
		})
	};
}

type LegacyMono = { main?: string; bg?: string };

/**
 * Migrates persisted monochrome palettes from the legacy `{main,bg}` shape to
 * `{primary,secondary,background}`. Idempotent: already-migrated entries pass through.
 * Mapping secondary+background both to the old `bg` preserves the previous look exactly.
 */
export function normalizeComposition(c: Composition): Composition {
	const palettes = c.monochromePalettes?.map((p) => {
		const legacy = p as LegacyMono;
		if (legacy.main !== undefined || legacy.bg !== undefined) {
			const primary = legacy.main ?? '#000000';
			const bg = legacy.bg ?? '#ffffff';
			return { primary, secondary: bg, background: bg };
		}
		return p;
	});
	return palettes ? { ...c, monochromePalettes: palettes } : c;
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
			if (saved && !(saved instanceof Promise)) Object.assign(state, normalizeComposition(saved));
			lastSavedStripped = JSON.stringify(stripTransients($state.snapshot(state) as Composition));
		});

		// The unsubscribe handle is intentionally discarded: `composition` is a
		// module-level singleton living inside a never-disposed effect root, so the
		// cross-tab listener is meant to last the whole app lifetime.
		if (localStorageSync.subscribe) {
			localStorageSync.subscribe<Composition>(key, (remote) => {
				untrack(() => {
					Object.assign(state, normalizeComposition(remote));
					lastSavedStripped = JSON.stringify(stripTransients($state.snapshot(state) as Composition));
				});
			});
		}

		$effect(() => {
			const stripped = stripTransients($state.snapshot(state) as Composition);
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