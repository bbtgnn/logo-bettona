import { describe, it, expect, beforeEach } from 'vitest';
import { pathLibrary, updateEntryPath } from '$lib/state/path-library';
import type { Path } from '$lib/types';

const NEW: Path = { cmds: ['M', 'L'], crds: [1, 2, 3, 4] };

describe('updateEntryPath', () => {
	beforeEach(() => {
		pathLibrary.entries = [
			{ id: 'u1', name: 'Mia', createdAt: 1, path: { cmds: ['M'], crds: [0, 0] }, secondaryPath: null },
			{ id: 'builtin-0', name: 'B', createdAt: 0, path: { cmds: ['M'], crds: [0, 0] }, secondaryPath: null, builtin: true }
		];
	});

	it('updates a user entry path with a deep copy', () => {
		updateEntryPath('u1', NEW);
		const e = pathLibrary.entries.find((x) => x.id === 'u1')!;
		expect(e.path).toEqual(NEW);
		expect(e.path).not.toBe(NEW);
	});

	it('never mutates a builtin entry', () => {
		updateEntryPath('builtin-0', NEW);
		const e = pathLibrary.entries.find((x) => x.id === 'builtin-0')!;
		expect(e.path).toEqual({ cmds: ['M'], crds: [0, 0] });
	});

	it('is a no-op for unknown id', () => {
		expect(() => updateEntryPath('nope', NEW)).not.toThrow();
	});
});
