import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Path, PathLibrary, Ring } from '$lib/types';

const initialLibrary: PathLibrary = { entries: [] };

vi.mock('rune-sync/localstorage', () => ({
	lsSync: vi.fn((key: string) => {
		if (key === 'path-library') return structuredClone(initialLibrary);
		return {};
	})
}));

function makeRing(): Ring {
	return {
		id: 'test-ring',
		copies: 1,
		color: '#000',
		templatePath: { cmds: ['M', 'L'], crds: [0, 0, 1, 1] },
		secondaryTemplatePath: null,
		morphT: 0,
		ringHeight: 0.1
	};
}

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

describe('removeEntry', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('removes the entry with the given id', async () => {
		const mod = await import('./path-library');
		mod.pathLibrary.entries = [];
		const a = mod.saveEntry({ cmds: ['M', 'L'], crds: [0, 0, 1, 1] }, null);
		const b = mod.saveEntry({ cmds: ['M', 'L'], crds: [2, 2, 3, 3] }, null);

		mod.removeEntry(a.id);

		expect(mod.pathLibrary.entries.map((e) => e.id)).toEqual([b.id]);
	});

	it('never removes a builtin entry', async () => {
		const mod = await import('./path-library');
		mod.pathLibrary.entries = [];
		const a = mod.saveEntry({ cmds: ['M', 'L'], crds: [0, 0, 1, 1] }, null);
		mod.pathLibrary.entries = mod.pathLibrary.entries.map((e) =>
			e.id === a.id ? { ...e, builtin: true } : e
		);

		mod.removeEntry(a.id);

		expect(mod.pathLibrary.entries).toHaveLength(1);
	});
});

describe('renameEntry', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('renames a user entry (trimmed)', async () => {
		const mod = await import('./path-library');
		mod.pathLibrary.entries = [];
		const a = mod.saveEntry({ cmds: ['M', 'L'], crds: [0, 0, 1, 1] }, null);

		mod.renameEntry(a.id, '  Logo cerchio  ');

		expect(mod.pathLibrary.entries[0].name).toBe('Logo cerchio');
	});

	it('ignores an empty/whitespace name', async () => {
		const mod = await import('./path-library');
		mod.pathLibrary.entries = [];
		const a = mod.saveEntry({ cmds: ['M', 'L'], crds: [0, 0, 1, 1] }, null);

		mod.renameEntry(a.id, '   ');

		expect(mod.pathLibrary.entries[0].name).toBe('Path 1');
	});

	it('never renames a builtin entry', async () => {
		const mod = await import('./path-library');
		mod.pathLibrary.entries = [];
		const a = mod.saveEntry({ cmds: ['M', 'L'], crds: [0, 0, 1, 1] }, null);
		mod.pathLibrary.entries = mod.pathLibrary.entries.map((e) =>
			e.id === a.id ? { ...e, builtin: true } : e
		);

		mod.renameEntry(a.id, 'Cambiato');

		expect(mod.pathLibrary.entries[0].name).toBe('Path 1');
	});
});

describe('applyEntryToRing', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('slot "template" overwrites templatePath only (deep clone)', async () => {
		const mod = await import('./path-library');
		const entry = mod.saveEntry(
			{ cmds: ['M', 'L'], crds: [5, 5, 6, 6] },
			{ cmds: ['M', 'L'], crds: [7, 7, 8, 8] }
		);
		const ring = makeRing();

		mod.applyEntryToRing(ring, entry, 'template');

		expect(ring.templatePath).toEqual({ cmds: ['M', 'L'], crds: [5, 5, 6, 6] });
		expect(ring.templatePath).not.toBe(entry.path);
		expect(ring.secondaryTemplatePath).toBeNull();
	});

	it('slot "secondary" writes entry.path (not entry.secondaryPath) into secondary slot', async () => {
		const mod = await import('./path-library');
		const entry = mod.saveEntry(
			{ cmds: ['M', 'L'], crds: [5, 5, 6, 6] },
			{ cmds: ['M', 'L'], crds: [7, 7, 8, 8] }
		);
		const ring = makeRing();

		mod.applyEntryToRing(ring, entry, 'secondary');

		expect(ring.secondaryTemplatePath).toEqual({ cmds: ['M', 'L'], crds: [5, 5, 6, 6] });
		expect(ring.secondaryTemplatePath).not.toBe(entry.path);
		expect(ring.templatePath).toEqual({ cmds: ['M', 'L'], crds: [0, 0, 1, 1] });
	});

	it('slot "both" writes path → template and secondaryPath → secondary', async () => {
		const mod = await import('./path-library');
		const entry = mod.saveEntry(
			{ cmds: ['M', 'L'], crds: [5, 5, 6, 6] },
			{ cmds: ['M', 'L'], crds: [7, 7, 8, 8] }
		);
		const ring = makeRing();

		mod.applyEntryToRing(ring, entry, 'both');

		expect(ring.templatePath).toEqual({ cmds: ['M', 'L'], crds: [5, 5, 6, 6] });
		expect(ring.secondaryTemplatePath).toEqual({ cmds: ['M', 'L'], crds: [7, 7, 8, 8] });
	});
});
