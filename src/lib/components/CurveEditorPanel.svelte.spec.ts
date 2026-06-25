import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import CurveEditorPanel from './CurveEditorPanel.svelte';
import { pathLibrary } from '$lib/state/path-library';
import type { PathLibraryEntry } from '$lib/types';

const ENTRY: PathLibraryEntry = {
	id: 'u1',
	name: 'Curva 1 (copia)',
	createdAt: 1,
	path: { cmds: ['M', 'C', 'C'], crds: [20, 134, 52, 134, 39, 95, 68, 75, 90, 61, 146, 62, 180, 65] },
	secondaryPath: null
};

describe('CurveEditorPanel', () => {
	beforeEach(() => {
		pathLibrary.entries = [{ ...ENTRY }];
	});

	it('calls ondone with the entry when Done is clicked', async () => {
		const ondone = vi.fn();
		render(CurveEditorPanel, { entry: ENTRY, oncancel: vi.fn(), ondone });
		await page.getByTestId('curve-editor-done').click();
		expect(ondone).toHaveBeenCalledWith(ENTRY);
	});

	it('calls oncancel when Cancel is clicked', async () => {
		const oncancel = vi.fn();
		render(CurveEditorPanel, { entry: ENTRY, oncancel, ondone: vi.fn() });
		await page.getByTestId('curve-editor-cancel').click();
		expect(oncancel).toHaveBeenCalled();
	});
});
