import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Path, PathLibrary } from '$lib/types';

const initialLibrary: PathLibrary = { entries: [] };

vi.mock('rune-sync/localstorage', () => ({
	lsSync: vi.fn((key: string) => {
		if (key === 'path-library') return structuredClone(initialLibrary);
		return {};
	})
}));

describe('saveEntry', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('appends a new entry with a unique id and auto name', async () => {
		const mod = await import('./path-library');
		const path: Path = { cmds: ['M', 'L'], crds: [0, 0, 10, 10] };

		const a = mod.saveEntry(path, null);
		const b = mod.saveEntry(path, null);

		expect(mod.pathLibrary.entries).toHaveLength(2);
		expect(a.id).not.toBe(b.id);
		expect(a.name).toBe('Path 1');
		expect(b.name).toBe('Path 2');
		expect(a.secondaryPath).toBeNull();
	});

	it('deep-clones the stored path (mutating source does not change entry)', async () => {
		const mod = await import('./path-library');
		const path: Path = { cmds: ['M', 'L'], crds: [0, 0, 10, 10] };
		const secondary: Path = { cmds: ['M', 'L'], crds: [1, 1, 5, 5] };

		const entry = mod.saveEntry(path, secondary);
		path.crds[0] = 999;
		secondary.crds[0] = 999;

		expect(entry.path.crds[0]).toBe(0);
		expect(entry.secondaryPath?.crds[0]).toBe(1);
	});
});
