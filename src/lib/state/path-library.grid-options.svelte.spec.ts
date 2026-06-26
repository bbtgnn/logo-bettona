import { describe, it, expect, beforeEach } from 'vitest';
import { pathLibrary, updateEntryGridOptions } from '$lib/state/path-library';
import { DEFAULT_GRID_OPTIONS } from '$lib/types';

beforeEach(() => {
	pathLibrary.entries = [
		{ id: 'u1', name: 'Mia', createdAt: 1, path: { cmds: ['M'], crds: [0, 0] }, secondaryPath: null },
		{ id: 'builtin-0', name: 'B', createdAt: 0, path: { cmds: ['M'], crds: [0, 0] }, secondaryPath: null, builtin: true }
	];
});

describe('updateEntryGridOptions', () => {
	it('persists options on a user entry as a fresh object', () => {
		const opts = { visible: false, snap: true, density: 12 };
		updateEntryGridOptions('u1', opts);
		const e = pathLibrary.entries.find((x) => x.id === 'u1')!;
		expect(e.gridOptions).toEqual(opts);
		expect(e.gridOptions).not.toBe(opts);
	});
	it('never mutates a builtin entry', () => {
		updateEntryGridOptions('builtin-0', { visible: false, snap: true, density: 2 });
		const e = pathLibrary.entries.find((x) => x.id === 'builtin-0')!;
		expect(e.gridOptions).toBeUndefined();
	});
	it('is a no-op for unknown id', () => {
		expect(() => updateEntryGridOptions('nope', DEFAULT_GRID_OPTIONS)).not.toThrow();
	});
});
