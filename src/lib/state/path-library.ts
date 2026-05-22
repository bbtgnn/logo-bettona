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
