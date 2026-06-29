import { describe, it, expect, beforeEach } from 'vitest';
import { pathLibrary, seedBuiltinCurves, duplicateEntry } from '$lib/state/path-library';
import { BUILTIN_CURVES } from '$lib/state/builtin-curves';

describe('seedBuiltinCurves', () => {
	beforeEach(() => {
		pathLibrary.entries = [];
	});

	it('inserts all 10 builtins when library is empty', () => {
		seedBuiltinCurves();
		const ids = pathLibrary.entries.map((e) => e.id);
		BUILTIN_CURVES.forEach((c) => expect(ids).toContain(c.id));
		expect(pathLibrary.entries.filter((e) => e.builtin)).toHaveLength(10);
	});

	it('is idempotent — running twice does not duplicate', () => {
		seedBuiltinCurves();
		seedBuiltinCurves();
		expect(pathLibrary.entries.filter((e) => e.id === 'builtin-0')).toHaveLength(1);
		expect(pathLibrary.entries.filter((e) => e.builtin)).toHaveLength(10);
	});

	it('preserves existing user entries', () => {
		pathLibrary.entries = [
			{ id: 'u1', name: 'Mia', createdAt: 1, path: { cmds: ['M'], crds: [0, 0] }, secondaryPath: null }
		];
		seedBuiltinCurves();
		expect(pathLibrary.entries.find((e) => e.id === 'u1')).toBeDefined();
		expect(pathLibrary.entries.filter((e) => e.builtin)).toHaveLength(10);
	});
});

describe('duplicateEntry', () => {
	beforeEach(() => {
		pathLibrary.entries = [];
	});

	it('creates a user copy with a new id and "(copia)" name', () => {
		const src = BUILTIN_CURVES[0];
		const copy = duplicateEntry(src);
		expect(copy.id).not.toBe(src.id);
		expect(copy.builtin).toBeFalsy();
		expect(copy.name).toBe(`${src.name} (copia)`);
		expect(copy.path).toEqual(src.path);
		expect(copy.path).not.toBe(src.path);
		expect(pathLibrary.entries).toContainEqual(copy);
	});
});
