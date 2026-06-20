import { lsSync } from 'rune-sync/localstorage';
import type { Path, PathLibrary, PathLibraryEntry, Ring } from '$lib/types';

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
