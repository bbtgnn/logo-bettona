import { lsSync } from 'rune-sync/localstorage';
import type { Path, PathLibrary, PathLibraryEntry, Ring } from '$lib/types';
import { BUILTIN_CURVES } from './builtin-curves';

export const pathLibrary = lsSync<PathLibrary>('path-library', { entries: [] });

function clonePath(p: Path): Path {
	return { cmds: [...p.cmds], crds: [...p.crds] };
}

export function saveEntry(path: Path, secondaryPath: Path | null): PathLibraryEntry {
	const entry: PathLibraryEntry = {
		id: crypto.randomUUID(),
		name: `Path ${pathLibrary.entries.length + 1}`,
		createdAt: Date.now(),
		path: clonePath(path),
		secondaryPath: secondaryPath ? clonePath(secondaryPath) : null
	};
	pathLibrary.entries = [...pathLibrary.entries, entry];
	return entry;
}

/** Removes a user entry by id. Built-in default curves are protected (no-op). */
export function removeEntry(id: string): void {
	pathLibrary.entries = pathLibrary.entries.filter((e) => e.id !== id || e.builtin === true);
}

/** Renames a user entry. Empty/whitespace names and built-in curves are ignored. */
export function renameEntry(id: string, name: string): void {
	const trimmed = name.trim();
	if (!trimmed) return;
	pathLibrary.entries = pathLibrary.entries.map((e) =>
		e.id === id && !e.builtin ? { ...e, name: trimmed } : e
	);
}

export type ApplySlot = 'template' | 'secondary' | 'both';

export function applyEntryToRing(ring: Ring, entry: PathLibraryEntry, slot: ApplySlot): void {
	if (slot === 'template' || slot === 'both') {
		ring.templatePath = clonePath(entry.path);
	}
	if (slot === 'secondary') {
		ring.secondaryTemplatePath = clonePath(entry.path);
	}
	if (slot === 'both') {
		ring.secondaryTemplatePath = entry.secondaryPath ? clonePath(entry.secondaryPath) : null;
	}
}

/**
 * Seeds the 10 builtin default curves into the library if missing. Idempotent:
 * a builtin already present (matched by id) is skipped, user entries are untouched.
 * Called once on the Tracciati landing.
 */
export function seedBuiltinCurves(): void {
	const present = new Set(pathLibrary.entries.map((e) => e.id));
	const missing = BUILTIN_CURVES.filter((c) => !present.has(c.id));
	if (missing.length === 0) return;
	pathLibrary.entries = [...missing, ...pathLibrary.entries];
}

/**
 * Duplicates a curve (builtin or user) into a fresh, editable user entry.
 * The source — notably a protected builtin — is never mutated. Used by "Edita".
 */
export function duplicateEntry(source: PathLibraryEntry): PathLibraryEntry {
	const copy: PathLibraryEntry = {
		id: crypto.randomUUID(),
		name: `${source.name} (copia)`,
		createdAt: Date.now(),
		path: clonePath(source.path),
		secondaryPath: source.secondaryPath ? clonePath(source.secondaryPath) : null
	};
	pathLibrary.entries = [...pathLibrary.entries, copy];
	return copy;
}

/** Replaces the path of a user entry (deep-copied). Builtins and unknown ids: no-op. */
export function updateEntryPath(id: string, path: Path): void {
	pathLibrary.entries = pathLibrary.entries.map((e) =>
		e.id === id && !e.builtin ? { ...e, path: clonePath(path) } : e
	);
}

// Seed shape for a brand-new custom curve: a simple arch in the same coordinate
// space (~0..180) as the builtin curves. The original single quadratic
// (M 20,100  Q 100,40  180,100) is split at its midpoint into two quadratics so
// the editable path exposes THREE anchor points — start, apex, end — instead of
// two. Splitting at t=0.5 preserves the exact silhouette: the apex lands at
// (100,70) and each half's control point is the midpoint of the original leg.
// Q is fine for display; once edited the RingCanvas emits L/C segments.
const SEED_ARC: Path = {
	cmds: ['M', 'Q', 'Q'],
	crds: [20, 100, 60, 70, 100, 70, 140, 70, 180, 100]
};

/** Creates and saves a new custom curve seeded from a simple arc. */
export function createCurveFromArc(): PathLibraryEntry {
	const count = pathLibrary.entries.filter((e) => !e.builtin).length;
	const entry: PathLibraryEntry = {
		id: crypto.randomUUID(),
		name: `Nuova curva ${count + 1}`,
		createdAt: Date.now(),
		path: clonePath(SEED_ARC),
		secondaryPath: null
	};
	pathLibrary.entries = [...pathLibrary.entries, entry];
	return entry;
}
