import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import CustomCurveItem from './CustomCurveItem.svelte';
import { pathLibrary } from '$lib/state/path-library';
import type { PathLibraryEntry } from '$lib/types';

const ENTRY: PathLibraryEntry = {
	id: 'u1',
	name: 'Nuova curva 1',
	createdAt: 1,
	path: { cmds: ['M', 'Q'], crds: [20, 100, 100, 40, 180, 100] },
	secondaryPath: null
};

describe('CustomCurveItem', () => {
	beforeEach(() => {
		pathLibrary.entries = [{ ...ENTRY }];
	});

	it('calls onselect with the id when the row is clicked', async () => {
		const onselect = vi.fn();
		render(CustomCurveItem, { entry: ENTRY, selected: false, onselect });
		await page.getByTestId('custom-name-u1').click();
		expect(onselect).toHaveBeenCalledWith('u1');
	});

	it('deletes only after confirm', async () => {
		render(CustomCurveItem, { entry: ENTRY, selected: true, onselect: vi.fn() });
		await page.getByTestId('custom-delete-u1').click();
		// still present (armed, not removed)
		expect(pathLibrary.entries.find((e) => e.id === 'u1')).toBeDefined();
		await page.getByTestId('custom-delete-confirm-u1').click();
		expect(pathLibrary.entries.find((e) => e.id === 'u1')).toBeUndefined();
	});

	it('reveals the rename field when the pencil is clicked', async () => {
		render(CustomCurveItem, { entry: ENTRY, selected: true, onselect: vi.fn() });
		// name is a plain clickable row by default; the input only appears on rename
		await page.getByTestId('custom-rename-u1').click();
		await expect.element(page.getByTestId('custom-rename-input-u1')).toBeInTheDocument();
	});

	it('duplicates the entry', async () => {
		render(CustomCurveItem, { entry: ENTRY, selected: true, onselect: vi.fn() });
		await page.getByTestId('custom-duplicate-u1').click();
		expect(pathLibrary.entries.filter((e) => !e.builtin)).toHaveLength(2);
	});
});
